import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/security'
import { getClientIp } from '@/lib/middleware'

const MAX_PER_IP_PER_HOUR = 5
const SAME_EMAIL_COOLDOWN_MS = 10 * 60 * 1000
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin()

  if (req.method === 'POST') {
    const { name, email, subject, message } = req.body || {}
    if (!name || !email || !subject || !message) return res.status(400).json({ error: 'All fields required' })
    if ([name, email, subject, message].some(v => typeof v !== 'string')) return res.status(400).json({ error: 'Invalid input' })
    if (name.length > 200 || email.length > 254 || subject.length > 300 || message.length > 5000) {
      return res.status(400).json({ error: 'Input too long' })
    }
    const cleanEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email' })

    // ── Rate limiting (DB-backed, works across serverless instances) ──
    const ip = getClientIp(req).trim().slice(0, 64)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const cooldownStart = new Date(Date.now() - SAME_EMAIL_COOLDOWN_MS).toISOString()
    const [{ count: ipCount, error: ipErr }, { count: emailCount }] = await Promise.all([
      db.from('status_messages').select('id', { count: 'exact', head: true }).eq('ip_address', ip).gte('created_at', hourAgo),
      db.from('status_messages').select('id', { count: 'exact', head: true }).eq('email', cleanEmail).gte('created_at', cooldownStart),
    ])
    if ((emailCount ?? 0) > 0 || (!ipErr && (ipCount ?? 0) >= MAX_PER_IP_PER_HOUR)) {
      return res.status(429).json({ error: 'Too many messages. Please try again later.' })
    }

    const row = { name: name.trim(), email: cleanEmail, subject: subject.trim(), message }
    let { error } = await db.from('status_messages').insert({ ...row, ip_address: ip })
    if (error && ipErr) {
      // ip_address column missing (migration 026 not yet applied)
      ({ error } = await db.from('status_messages').insert(row))
    }
    if (error) {
      console.error('[status/contact] insert error:', error.message)
      return res.status(500).json({ error: 'Failed to send message' })
    }

    // Notify admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'support@waabek.com'
      await sendEmail({
        to: adminEmail,
        subject: `New contact message: ${row.subject.replace(/[\r\n]+/g, ' ').slice(0, 150)}`,
        html: `<div style="font-family:sans-serif"><h2>New message from ${escapeHtml(row.name)}</h2><p><strong>Email:</strong> ${escapeHtml(row.email)}</p><p><strong>Subject:</strong> ${escapeHtml(row.subject)}</p><p><strong>Message:</strong></p><p style="white-space:pre-wrap">${escapeHtml(row.message)}</p></div>`,
      })
    } catch {}

    return res.status(200).json({ success: true })
  }

  if (req.method === 'GET') {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    const { data } = await db.from('status_messages').select('*').order('created_at', { ascending: false }).limit(500)
    return res.status(200).json({ messages: data || [] })
  }

  return res.status(405).end()
}
