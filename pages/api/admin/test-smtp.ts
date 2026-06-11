import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import nodemailer from 'nodemailer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { host, port, secure, username, password, from_name, from_email, to } = req.body

  if (!host || !username || !password || !to) {
    return res.status(400).json({ error: 'host, username, password, and to are required' })
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port) || 587,
      secure: secure === 'ssl',
      requireTLS: secure === 'tls',
      auth: { user: username, pass: password },
    })

    await transporter.sendMail({
      from: `"${from_name || 'WABEK'}" <${from_email || username}>`,
      to,
      subject: '✅ WABEK SMTP Test',
      text: 'Your SMTP configuration is working correctly!',
      html: '<p>Your SMTP configuration is working correctly! ✅</p><p>Sent from <strong>WABEK</strong></p>',
    })

    return res.status(200).json({ success: true, message: 'Test email sent successfully' })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'SMTP connection failed' })
  }
}
