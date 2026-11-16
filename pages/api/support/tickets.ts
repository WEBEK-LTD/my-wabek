import { NextApiRequest, NextApiResponse } from 'next'
import { sendAdminPush } from '@/lib/mobile-push'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/security'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireMemberAccess(req, res, 'inbox')
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
    const { subject, message, whatsapp_phone } = req.body || {}
    if (!subject || !message || typeof subject !== 'string' || typeof message !== 'string') {
      return res.status(400).json({ error: 'subject and message required' })
    }
    if (subject.length > 300 || message.length > 10000) return res.status(400).json({ error: 'Input too long' })

    // Race-free ticket numbers from a Postgres sequence (migration 026).
    // Fallback to max+1 only if the function isn't deployed yet.
    let ticketNumber: number
    const { data: seqVal, error: seqErr } = await db.rpc('next_support_ticket_number')
    if (!seqErr && typeof seqVal === 'number') {
      ticketNumber = seqVal
    } else {
      const { data: maxRow } = await db.from('support_tickets').select('ticket_number').order('ticket_number', { ascending: false }).limit(1).maybeSingle()
      ticketNumber = (maxRow?.ticket_number || 7253) + 1
    }
    const { data: userRow } = await db.from('users').select('email, name').eq('id', user.userId).single()
    const safeSubject = escapeHtml(subject)
    const safeName = escapeHtml(userRow?.name || 'there')

    const { data: ticket, error } = await db.from('support_tickets').insert({
      ticket_number: ticketNumber,
      user_id: user.userId,
      subject,
      status: 'open',
      whatsapp_phone: typeof whatsapp_phone === 'string' ? whatsapp_phone.slice(0, 32) : null,
    }).select().single()
    if (error) {
      console.error('[support/tickets] insert error:', error.message)
      return res.status(500).json({ error: 'Failed to create ticket' })
    }

    await db.from('support_messages').insert({
      ticket_id: ticket.id, sender_type: 'user', sender_id: user.userId, content: message,
    })
    await sendAdminPush('support_ticket', { number: ticketNumber, from: userRow?.name || userRow?.email || 'Customer', subject: String(subject).slice(0, 120) }, { ticket_id: String(ticket.id) })

    try {
      await sendEmail({
        to: userRow?.email || '',
        subject: `Ticket #${ticketNumber} opened — ${subject.replace(/[\r\n]+/g, ' ').slice(0, 150)}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2>Ticket #${ticketNumber} opened ✅</h2><p>Hi ${safeName},</p><p>We received your request. Our team will reply during business hours <strong>(9 AM – 6 PM daily)</strong>.</p><div style="background:#f9fafb;border:1px solid #e9edef;border-radius:8px;padding:16px"><p><strong>Subject:</strong> ${safeSubject}</p><p><strong>Ticket #:</strong> ${ticketNumber}</p></div></div>`,
      })
    } catch {}

    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'support@waabek.com'
      await sendEmail({
        to: adminEmail,
        subject: `New ticket #${ticketNumber} — ${String(userRow?.name || userRow?.email || '').replace(/[\r\n]+/g, ' ').slice(0, 100)}`,
        html: `<div style="font-family:sans-serif"><h2>New ticket #${ticketNumber}</h2><p><strong>From:</strong> ${escapeHtml(userRow?.name)} (${escapeHtml(userRow?.email)})</p><p><strong>Subject:</strong> ${safeSubject}</p><blockquote style="white-space:pre-wrap">${escapeHtml(message)}</blockquote><a href="https://waabek.com/admin/support">View in admin →</a></div>`,
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
