import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrPermission } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// Owner-only, on-demand reveal of the account's default API key (users.api_key).
// It is intentionally NOT part of /api/auth/me any more, so it is not persisted
// in the browser's auth store or exposed to team members.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireOwnerOrPermission(req, res, 'integrations', 'edit')
  if (!user) return

  const { data } = await supabaseAdmin().from('users').select('api_key').eq('id', user.userId).maybeSingle()
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ api_key: data?.api_key || null })
}
