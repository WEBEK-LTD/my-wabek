import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const selfId = user.actualUserId || user.userId // the logged-in person's own devices

  if (req.method === 'GET') {
    // Auto-delete expired devices
    await db.from('trusted_devices')
      .delete()
      .eq('user_id', selfId)
      .lt('expires_at', new Date().toISOString())

    const { data } = await db.from('trusted_devices')
      .select('*')
      .eq('user_id', selfId)
      .order('last_used_at', { ascending: false })
    // The fingerprint is what skips "new device" 2FA — never send it back.
    const devices = (data || []).map(({ device_fingerprint: _fp, ...d }: Record<string, unknown>) => d)
    return res.status(200).json({ devices })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
