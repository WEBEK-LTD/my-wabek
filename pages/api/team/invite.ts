import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail, teamInviteEmail } from '@/lib/email'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'token required' })

  const db = supabaseAdmin()
  const { data: invite } = await db.from('team_members').select('*, owner:owner_id(name, email)').eq('invite_token', token as string).eq('status', 'pending').single()
  if (!invite) return res.status(404).json({ error: 'Invalid or expired invitation' })

  return res.status(200).json({
    invite: {
      name: invite.name,
      email: invite.email,
      role: invite.role,
      owner_name: invite.owner?.name,
    }
  })
}
