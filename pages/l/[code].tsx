import { GetServerSideProps } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { emitWebhookEvent } from '@/lib/outgoing-webhooks'

export default function RedirectPage() {
  return <div>Redirecting...</div>
}

// Only plain web links may be redirected to (blocks javascript:, data:, etc.)
function safeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { code } = context.params as { code: string }
  if (!code || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) return { redirect: { destination: '/', permanent: false } }
  const db = supabaseAdmin()

  // Atomic click increment (migration 026); falls back to a plain lookup.
  let link: { id: string; original_url: string } | null = null
  let counted = false
  const { data: rpcRows, error: rpcErr } = await db.rpc('increment_link_clicks', { p_code: code })
  if (!rpcErr) {
    link = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) || null
    counted = true
  } else {
    const { data } = await db.from('tracked_links').select('id, original_url, click_count').eq('short_code', code).maybeSingle()
    if (data) {
      link = data
      await db.from('tracked_links').update({ click_count: (data.click_count || 0) + 1 }).eq('id', data.id)
      counted = true
    }
  }

  if (!link) return { redirect: { destination: '/', permanent: false } }

  const destination = safeHttpUrl(link.original_url)
  if (!destination) return { redirect: { destination: '/', permanent: false } }

  // Record click
  if (counted) {
    const ip = (context.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || context.req.socket.remoteAddress || ''
    const ua = String(context.req.headers['user-agent'] || '').slice(0, 500)
    await db.from('link_clicks').insert({
      id: uuidv4(),
      link_id: link.id,
      ip_address: ip.slice(0, 64),
      user_agent: ua,
    })
    try {
      const { data: owner } = await db.from('tracked_links').select('user_id, short_code').eq('id', link.id).maybeSingle()
      if (owner?.user_id) {
        // Do not hold the visitor's redirect for a slow receiver
        await Promise.race([
          emitWebhookEvent(owner.user_id, 'link_clicked', {
            link_id: link.id, short_code: owner.short_code || code, url: destination, clicked_at: new Date().toISOString(),
          }),
          new Promise(r => setTimeout(r, 1500)),
        ])
      }
    } catch { /* never block the redirect */ }
  }

  return { redirect: { destination, permanent: false } }
}
