import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { assertPublicUrl } from '@/lib/security'
import { isRedactedPlaceholder } from '@/lib/settings'
import { lookup } from 'dns/promises'
import net from 'net'
import nodemailer from 'nodemailer'

const ALLOWED_PORTS = new Set([25, 465, 587, 2525])
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { host, port, secure, username, from_name, from_email, to } = req.body || {}
  let { password } = req.body || {}

  if (typeof host !== 'string' || !host || typeof username !== 'string' || !username || typeof to !== 'string' || !to) {
    return res.status(400).json({ error: 'host, username, password, and to are required' })
  }
  if (!EMAIL_RE.test(to) || (from_email && !EMAIL_RE.test(String(from_email)))) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const portNum = parseInt(String(port || '587'), 10)
  if (!ALLOWED_PORTS.has(portNum)) return res.status(400).json({ error: 'Port must be 25, 465, 587 or 2525' })

  // Masked password from the settings page → use the stored one, but only
  // against the stored host/user (never send it to a different server).
  if (!password || isRedactedPlaceholder(password)) {
    const { data } = await supabaseAdmin().from('system_settings').select('value').eq('key', 'smtp_settings').maybeSingle()
    const stored = (data?.value || null) as { host?: string; username?: string; password?: string } | null
    password = stored && stored.host === host && stored.username === username ? stored.password : undefined
  }
  if (!password) return res.status(400).json({ error: 'host, username, password, and to are required' })

  // SSRF guard: host must resolve only to public addresses. Connect to the
  // vetted IP (TLS still verifies the hostname) so DNS can't be re-bound.
  let address: string
  try {
    await assertPublicUrl(`https://${host}`)
    address = net.isIP(host) ? host : (await lookup(host)).address
    await assertPublicUrl(`https://${net.isIPv6(address) ? `[${address}]` : address}`)
  } catch {
    return res.status(400).json({ error: 'SMTP host is not allowed' })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: address,
      port: portNum,
      secure: secure === 'ssl',
      requireTLS: secure === 'tls',
      auth: { user: username, pass: String(password) },
      tls: { servername: net.isIP(host) ? undefined : host },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })

    const safeName = String(from_name || 'WABEK').replace(/["\r\n<>]/g, '').slice(0, 100)
    await transporter.sendMail({
      from: `"${safeName}" <${from_email || username}>`,
      to,
      subject: '✅ WABEK SMTP Test',
      text: 'Your SMTP configuration is working correctly!',
      html: '<p>Your SMTP configuration is working correctly! ✅</p><p>Sent from <strong>WABEK</strong></p>',
    })

    return res.status(200).json({ success: true, message: 'Test email sent successfully' })
  } catch (e) {
    console.error('[test-smtp] failed:', e instanceof Error ? e.message : e)
    return res.status(500).json({ error: 'SMTP connection failed. Check host, port, encryption and credentials.' })
  }
}
