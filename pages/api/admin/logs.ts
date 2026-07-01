import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const db = supabaseAdmin()

  const { search, page = '1', action_filter, user_id, date_from, date_to, mode = 'system' } = req.query
  const pageNum = parseInt(page as string)
  const limit   = 50
  const offset  = (pageNum - 1) * limit

  // Join with users to get name/email
  let query = db.from('system_logs')
    .select(`
      id, action, resource, resource_id, details, ip_address, created_at, user_id,
      users(id, name, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // mode=user: filter to a specific user's activity
  if (mode === 'user' && user_id) {
    query = query.eq('user_id', user_id as string)
  }

  // action filter
  if (action_filter && action_filter !== 'all') {
    query = query.eq('action', action_filter as string)
  }

  // search: by action, IP, or resource
  if (search) {
    query = query.or(`action.ilike.%${search}%,ip_address.ilike.%${search}%,resource.ilike.%${search}%`)
  }

  // date range
  if (date_from) query = query.gte('created_at', new Date(date_from as string).toISOString())
  if (date_to)   query = query.lte('created_at', new Date(date_to as string + 'T23:59:59').toISOString())

  const { data, error, count } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Get distinct actions for filter dropdown
  const { data: actionRows } = await db.from('system_logs')
    .select('action').order('action')
  const actions = [...new Set((actionRows || []).map(r => r.action))].sort()

  // For user search mode: find users matching search
  let userSuggestions: { id: string; name: string | null; email: string }[] = []
  if (mode === 'user' && search && !user_id) {
    const { data: users } = await db.from('users')
      .select('id, name, email')
      .or(`email.ilike.%${search}%,name.ilike.%${search}%`)
      .limit(10)
    userSuggestions = users || []
  }

  return res.status(200).json({
    logs: data || [],
    total: count || 0,
    page: pageNum,
    actions,
    userSuggestions,
  })
}
