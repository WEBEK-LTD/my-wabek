import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { code } = req.query
  if (typeof code !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(code)) return res.status(400).json({ error: 'code required' })

  const db = supabaseAdmin()
  const { data: invite } = await db.from('reseller_invites')
    .select('*, reseller:reseller_id(name), reseller_plan:reseller_plan_id(custom_name, custom_price_monthly, base_plan:base_plan_id(name, max_contacts, max_instances, max_messages_month))')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (!invite) return res.status(404).json({ error: 'Invalid or expired invite code' })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'This invite has expired' })
  if (invite.max_uses && invite.use_count >= invite.max_uses) return res.status(410).json({ error: 'This invite has reached its limit' })

  // Only invites of approved resellers are honoured at registration.
  const { data: rp } = await db.from('reseller_profiles').select('is_approved').eq('user_id', invite.reseller_id).maybeSingle()
  if (!rp?.is_approved) return res.status(404).json({ error: 'Invalid or expired invite code' })

  // Get white label settings for this reseller
  const { data: wl } = await db.from('white_label_settings').select('brand_name, brand_logo, brand_color').eq('user_id', invite.reseller_id).maybeSingle()

  return res.status(200).json({
    valid: true,
    invite: {
      code: invite.code,
      reseller_name: wl?.brand_name || invite.reseller?.name,
      reseller_logo: wl?.brand_logo,
      reseller_color: wl?.brand_color,
      trial_days: Math.min(Math.max(invite.trial_days || 0, 0), 30),
      discount_pct: invite.discount_pct,
      plan: invite.reseller_plan,
    }
  })
}
