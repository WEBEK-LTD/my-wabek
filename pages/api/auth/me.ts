import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Never returned: password_hash, api_key, tokens or any other secret.
const SELF_COLUMNS = 'id, email, name, role, phone, otp_mode, is_verified, last_login_at, last_login_ip, last_login_device, created_at, language, timezone, avatar_url, sub_account_of'
const SELF_COLUMNS_FALLBACK = 'id, email, name, role, phone, otp_mode, is_verified, last_login_at, last_login_ip, last_login_device, created_at, sub_account_of'
const PLAN_COLUMNS = 'plan_id, trial_ends_at, plan_expires_at'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const user = await requireAuth(req, res)
    if (!user) return

    const db = supabaseAdmin()
    const selfId = user.actualUserId || user.userId

    let { data: self, error } = await db.from('users').select(SELF_COLUMNS).eq('id', selfId).maybeSingle()
    if (error) {
      ;({ data: self, error } = await db.from('users').select(SELF_COLUMNS_FALLBACK).eq('id', selfId).maybeSingle())
    }
    if (error || !self) {
      if (error) console.error('[me] lookup failed:', error.message)
      return res.status(500).json({ error: 'Could not load profile' })
    }

    // Plan/feature state belongs to the account (the owner for team members).
    const { data: account } = await db.from('users')
      .select(`${PLAN_COLUMNS}, api_key`)
      .eq('id', user.userId)
      .maybeSingle()

    // Wix-origin accounts: looked up via the link table (users has no
    // wix_instance_id column). Used by the dashboard to redirect/hide
    // billing UI (Wix Internal Pricing requirement).
    const { data: wixLinks } = await db
      .from('wix_user_links')
      .select('wix_instance_id')
      .eq('user_id', user.userId)
      .order('connected_at', { ascending: false })

    const isOwner = !user.actualUserId
    const apiKey = (account as { api_key?: string | null } | null)?.api_key || null

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      user: {
        ...self,
        role: user.role,
        plan_id: account?.plan_id ?? null,
        trial_ends_at: account?.trial_ends_at ?? null,
        plan_expires_at: account?.plan_expires_at ?? null,
        sub_account_of: user.actualUserId ? user.userId : null,
        member_role: user.memberRole || null,
        // Effective per-section levels (none/view/edit) — the dashboard hides what is 'none'.
        member_permissions: user.actualUserId ? (user.memberPermissions || null) : null,
        // The default API key itself is only available to the owner via
        // GET /api/settings/default-api-key.
        has_api_key: isOwner ? !!apiKey : undefined,
        api_key_prefix: isOwner && apiKey ? apiKey.slice(0, 12) : undefined,
        wix_instance_id: wixLinks?.[0]?.wix_instance_id || null,
      },
    })
  }

  if (req.method === 'POST') {
    res.setHeader('Set-Cookie', `wabek_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
