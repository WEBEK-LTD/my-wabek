import { GetServerSideProps } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default function RedirectPage() {
  return <div>Redirecting...</div>
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { code } = context.params as { code: string }
  const db = supabaseAdmin()

  const { data: link } = await db.from('tracked_links').select('*').eq('short_code', code).single()

  if (!link) return { redirect: { destination: '/', permanent: false } }

  // Record click
  const ip = (context.req.headers['x-forwarded-for'] as string)?.split(',')[0] || context.req.socket.remoteAddress || ''
  const ua = context.req.headers['user-agent'] || ''

  await db.from('link_clicks').insert({
    id: uuidv4(),
    link_id: link.id,
    ip_address: ip,
    user_agent: ua,
  })

  // Update click count
  await db.from('tracked_links').update({
    click_count: (link.click_count || 0) + 1,
  }).eq('id', link.id)

  return { redirect: { destination: link.original_url, permanent: false } }
}
