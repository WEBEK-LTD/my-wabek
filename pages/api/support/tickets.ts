import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()

  // Check table exists
  const { error: tableCheck } = await db.from('support_tickets').select('id').limit(1)
  if (tableCheck?.message?.includes('relation') || tableCheck?.message?.includes('schema cache')) {
    return res.status(503).json({ error: 'Support tables not found. Run migration 012_support_tickets.sql in Supabase SQL Editor.' })
  }

  if (req.method === 'GET') {
    const { data } = await db
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: false })
    return res.status(200).json({ tickets: data || [] })
  }

  if (req.method === 'POST') {
    const { subject, message } = req.body
    if (!subject || !message) return res.status(400).json({ error: 'subject and message required' })

    const { data: maxRow } = await db.from('support_tickets').select('ticket_number').order('ticket_number', { ascending: false }).limit(1).maybeSingle()
    const ticketNumber = (maxRow?.ticket_number || 7253) + 1
    const { data: userRow } = await db.from('users').select('email, name').eq('id', user.userId).single()

    const { whatsapp_phone } = req.body

    const { data: ticket, error } = await db.from('support_tickets').insert({
      ticket_number: ticketNumber,
      user_id: user.userId,
      subject,
      status: 'open',
      whatsapp_phone: whatsapp_phone || null,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })

    await db.from('support_messages').insert({
      ticket_id: ticket.id, sender_type: 'user', sender_id: user.userId, content: message,
    })

    try {
      await sendEmail({
        to: userRow?.email || '',
        subject: `Ticket #${ticketNumber} opened — ${subject}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Ticket #${ticketNumber} opened ✅</h2><p>Hi ${userRow?.name || 'there'},</p><p>We received your request. Our team will reply during business hours <strong>(9 AM – 6 PM daily)</strong>.</p><div style="background:#f9fafb;border:1px solid #e9edef;border-radius:8px;padding:16px"><p><strong>Subject:</strong> ${subject}</p><p><strong>Ticket #:</strong> ${ticketNumber}</p></div></div>`,
      })
    } catch {}

    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'support@waabek.com'
      await sendEmail({
        to: adminEmail,
        subject: `New ticket #${ticketNumber} — ${userRow?.name || userRow?.email}`,
        html: `<div style="font-family:sans-serif"><h2>New ticket #${ticketNumber}</h2><p><strong>From:</strong> ${userRow?.name} (${userRow?.email})</p><p><strong>Subject:</strong> ${subject}</p><blockquote>${message}</blockquote><a href="https://waabek.com/admin/support">View in admin →</a></div>`,
      })
    } catch {}

    // WhatsApp confirmation via notification system
    const userPhone = (userRow as any)?.phone
    if (userPhone) {
      try {
        const { sendNotification } = await import('@/lib/wa-notifications')
        await sendNotification({
          userId: user.userId,
          phone: userPhone,
          templateKey: 'SUPPORT_TICKET_OPEN',
          params: {},
          fallbackText: `Hi ${userRow?.name || 'there'} 👋

🎫 Ticket #${ticketNumber} opened!
📝 ${subject}

We'll reply during business hours (9AM–6PM).

Track: waabek.com/dashboard/support`,
        })
      } catch (e: any) { console.error('[ticket open] WA error:', e.message) }
    }

    return res.status(200).json({ ticket, ticketNumber })
  }

  return res.status(405).end()
}
