import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/email'
import { smartSend, smartSendWAWeb, resolveProvider } from '@/lib/wa-smart-send'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { ticket_id, content } = req.body
  if (!ticket_id || !content) return res.status(400).json({ error: 'ticket_id and content required' })

  const db = supabaseAdmin()

  const { error: tableCheck } = await db.from('support_tickets').select('id').limit(1)
  if (tableCheck?.message?.includes('relation') || tableCheck?.message?.includes('schema cache')) {
    return res.status(503).json({ error: 'Run migration 012_support_tickets.sql first' })
  }

  const { data: ticket } = await db
    .from('support_tickets')
    .select('*, users(id,name,email,phone), whatsapp_phone')
    .eq('id', ticket_id)
    .maybeSingle()
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

  const ticketUser = ticket.users as any
  const ticketNum = ticket.ticket_number

  // Save admin message
  await db.from('support_messages').insert({
    ticket_id, sender_type: 'admin', sender_id: admin.userId, content,
  })

  await db.from('support_tickets').update({
    status: 'pending', updated_at: new Date().toISOString(),
  }).eq('id', ticket_id)

  const results: Record<string, string> = {}

  // ── 1. Email ──────────────────────────────────────────────
  if (ticketUser?.email) {
    try {
      await sendEmail({
        to: ticketUser.email,
        subject: `We replied to your ticket #${ticketNum} — ${ticket.subject}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2>We replied to your ticket #${ticketNum} 💬</h2>
          <p>Hi ${ticketUser.name || 'there'},</p>
          <div style="background:#f0fdf4;border-left:4px solid #25D366;padding:16px;margin:16px 0;border-radius:0 8px 8px 0">
            <p style="margin:0;white-space:pre-wrap">${content}</p>
          </div>
          <p><strong>Ticket:</strong> #${ticketNum} — ${ticket.subject}</p>
        </div>`,
      })
      results.email = 'sent'
    } catch (e: any) {
      console.error('[support reply] email error:', e?.message)
      results.email = 'failed'
    }
  }

  // ── 2. WhatsApp ───────────────────────────────────────────
  const waMessage = `Hi ${ticketUser?.name || 'there'} 👋\n\nWe replied to your support ticket *#${ticketNum}*\n${ticket.subject}\n\n${content}`

  let userPhone: string | null = (ticket as any).whatsapp_phone || ticketUser?.phone || null
  if (!userPhone) {
    const { data: cr } = await db.from('contacts').select('phone').eq('user_id', ticketUser?.id).limit(1).maybeSingle()
    userPhone = cr?.phone || null
  }
  if (userPhone) userPhone = userPhone.replace(/[^0-9]/g, '')

  console.log(`[support reply] ticket #${ticketNum} phone=${userPhone}`)

  if (userPhone) {
    const { data: insts } = await db.from('whatsapp_instances')
      .select('id,phone_number_id,access_token,instance_type,type,status')
      .eq('user_id', admin.userId)
      .in('status', ['connected', 'active', 'open'])
      .limit(1)

    let inst = insts?.[0]
    if (!inst) {
      const { data: anyInst } = await db.from('whatsapp_instances')
        .select('id,phone_number_id,access_token,instance_type,type,status')
        .eq('user_id', admin.userId).limit(1)
      inst = anyInst?.[0]
    }

    console.log(`[support reply] instance found=${!!inst} id=${inst?.id} type=${inst?.instance_type}`)

    if (inst) {
      try {
        const provider = resolveProvider(inst)
        console.log(`[support reply] instance_id=${inst.id} instance_type=${inst.instance_type} provider=${provider.toUpperCase()} phone=${userPhone}`)
        const { data: cr } = await db.from('contacts').select('id').eq('user_id', admin.userId).eq('phone', userPhone).maybeSingle()

        let waResult: { messageId: string | null; method: string; error?: string }

        if (provider === 'wa_web') {
          waResult = await smartSendWAWeb({
            userId: admin.userId, instanceId: inst.id,
            to: userPhone, text: waMessage, contactId: cr?.id || null,
          })
        } else {
          // Support Tickets ALWAYS use support_ticket_update template
          // No window check — template is mandatory regardless of 24h window
          const customerName = ticketUser?.name || 'Customer'
          waResult = await smartSend({
            userId: admin.userId, instanceId: inst.id,
            phoneNumberId: inst.phone_number_id, accessToken: inst.access_token,
            to: userPhone, text: waMessage, contactId: cr?.id || null,
            templateKey: 'SUPPORT_REPLY', templateLanguage: 'en',
            templateComponents: [{
              type: 'body',
              parameters: [
                { type: 'text', parameter_name: 'customer_name', text: customerName },
              ]
            }],
            source: 'support_reply',
            ticketId: ticket_id,
            forceTemplate: true,
          })
        }

        const inWindow = (waResult as any).inWindow
        const usedTemplate = waResult.method === 'template'
        console.log(`[SEND] source=support_reply instance_id=${inst.id} provider=${resolveProvider(inst).toUpperCase()} phone=${userPhone} method=${waResult.method} inWindow=${inWindow} template=${(waResult as any).templateUsed || 'none'} ticket_id=${ticket_id}`)

        if (usedTemplate) {
          results.window_notice = 'Customer is outside the 24-hour window. A template message was used automatically.'
        }

        if (waResult.messageId) {
          await db.from('support_messages')
            .update({ wa_message_id: waResult.messageId })
            .eq('ticket_id', ticket_id)
            .eq('sender_type', 'admin')
            .order('created_at', { ascending: false })
            .limit(1)
          results.whatsapp = `sent via ${waResult.method}`
        } else {
          results.whatsapp = `failed: ${waResult.error || 'unknown'}`
        }
      } catch (e: any) {
        console.error(`[support reply] WA error:`, e?.message)
        results.whatsapp = `failed: ${e?.message}`
      }
    } else {
      results.whatsapp = 'skipped: no WhatsApp instance'
    }
  } else {
    results.whatsapp = 'skipped: no phone number'
  }

  return res.status(200).json({ success: true, results })
}
