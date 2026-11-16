import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth, comparePassword, bumpTokenVersion } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { hitRateLimit, logAction, getClientIp } from '@/lib/middleware'
import { sendAdminPush } from '@/lib/mobile-push'

// POST /api/mobile/delete-account {password, confirm: "DELETE"}
// In-app account deletion (App Store 5.1.1(v) / Google Play). The owner
// confirms with their password; the account is suspended immediately, every
// session is revoked, app push tokens are removed and the admins are told to
// complete the deletion (subscription, data). Team members cannot delete the
// owner's account.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return
  if (user.actualUserId) return res.status(403).json({ error: 'Only the account owner can delete the account', code: 'owner_only' })

  const { password, confirm } = (req.body || {}) as { password?: unknown; confirm?: unknown }
  if (confirm !== 'DELETE') return res.status(400).json({ error: 'Confirmation missing', code: 'confirm_required' })
  if (await hitRateLimit(`delete-account:${user.userId}`, 5, 15 * 60)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' })
  }

  const db = supabaseAdmin()
  const { data: row } = await db.from('users').select('id, email, password_hash').eq('id', user.userId).maybeSingle()
  if (!row) return res.status(404).json({ error: 'Account not found' })
  // Accounts created with Google / Apple have no password: the active session is the proof.
  if (row.password_hash && !(await comparePassword(String(password ?? ''), row.password_hash))) {
    return res.status(400).json({ error: 'Wrong password', code: 'wrong_password' })
  }

  const now = new Date().toISOString()
  let { error } = await db.from('users').update({ is_active: false, deletion_requested_at: now }).eq('id', user.userId)
  if (error && /deletion_requested_at/.test(error.message || '')) {
    ;({ error } = await db.from('users').update({ is_active: false }).eq('id', user.userId))
  }
  if (error) {
    console.error('[delete-account] failed:', error.message)
    return res.status(500).json({ error: 'Could not delete the account. Please contact support.' })
  }
  await bumpTokenVersion(user.userId)
  await db.from('mobile_push_tokens').delete().eq('user_id', user.userId)

  const { data: admins } = await db.from('users').select('id').eq('role', 'admin').limit(20)
  if (admins?.length) {
    await db.from('notifications').insert(admins.map(a => ({
      user_id: a.id,
      type: 'warning',
      title: 'Account deletion requested',
      body: `${row.email} asked to delete their account from the mobile app. Cancel billing and remove the data.`,
      link: `/admin/users?search=${encodeURIComponent(row.email)}`,
      is_read: false,
    })))
  }
  await sendAdminPush('deletion_request', { email: row.email })
  await logAction({ userId: user.userId, action: 'account_deletion_requested', ipAddress: getClientIp(req) })
  return res.status(200).json({ success: true })
}
