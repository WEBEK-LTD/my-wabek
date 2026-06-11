import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin()

  if (req.method === 'POST') {
    const { name, email, subject, message } = req.body
    if (!name || !email || !subject || !message) return res.status(400).json({ error: 'All fields required' })
    const { error } = await db.from('status_messages').insert({ name, email, subject, message })
    if (error) return res.status(500).json({ error: error.message })

    // Notify admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'support@waabek.com'
      await sendEmail({
        to: adminEmail,
        subject: `New contact message: ${subject}`,
        html: `<div style="font-family:sans-serif"><h2>New message from ${name}</h2><p><strong>Email:</strong> ${email}</p><p><strong>Subject:</strong> ${subject}</p><p><strong>Message:</strong></p><p>${message}</p></div>`,
      })
    } catch {}

    return res.status(200).json({ success: true })
  }

  if (req.method === 'GET') {
    const admin = await requireAdmin(req, res)
    if (!admin) return
    const { data } = await db.from('status_messages').select('*').order('created_at', { ascending: false })
    return res.status(200).json({ messages: data || [] })
  }

  return res.status(405).end()
}
