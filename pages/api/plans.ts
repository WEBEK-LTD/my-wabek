import { NextApiResponse, NextApiRequest } from 'next'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const db = supabaseAdmin()
  const { data } = await db
    .from('plans')
    .select('id,name,description,price_monthly,price_annual,features,is_popular,is_active,sort_order,cta_text,badge')
    .eq('is_active', true)
    .order('sort_order')
  return res.status(200).json({ plans: data || [] })
}
