import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { sendMediaMessage } from '@/lib/whatsapp'
import { smartSend, smartSendWAWeb, TEMPLATES, resolveProvider } from '@/lib/wa-smart-send'
import { sendNotification } from '@/lib/wa-notifications'
import { notifyCampaignComplete } from '@/lib/notifications'
import { v4 as uuidv4 } from 'uuid'

export const config = {
  api: {
    responseLimit: false,
    externalResolver: true,  // Prevent Netlify from auto-closing after response
  },
  maxDuration: 26,  // Netlify max is 26s on Pro
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const { id } = req.query

  const { data: campaign } = await db.from('campaigns').select('*').eq('id', id as string).eq('user_id', user.userId).single()
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })

  if (req.method === 'GET') return res.status(200).json({ campaign })

  if (req.method === 'PUT') {
    const { name, message, media_url, scheduled_at, delay_seconds, template_name, template_language, template_variables } = req.body
    if (!['draft', 'scheduled'].includes(campaign.status)) return res.status(400).json({ error: 'Cannot edit running campaign' })
    const { data, error } = await db.from('campaigns').update({
      name, message, media_url, scheduled_at, delay_seconds,
      template_name: template_name || null,
      template_language: template_language || 'en',
      template_variables: template_variables || null,
      updated_at: new Date().toISOString()
    }).eq('id', id as string).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ campaign: data })
  }

  if (req.method === 'POST') {
    const { action } = req.body

    if (action === 'start') {
      if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) return res.status(400).json({ error: 'Cannot start' })

      // Validate template if specified
      // Template check will happen after instance is loaded below
      if (campaign.template_name) {
        console.log(`[Campaign] Using template: ${campaign.template_name} lang=${campaign.template_language}`)
      }

      const filter = campaign.contact_filter as { tags?: string[]; all?: boolean }
      let contactQuery = db.from('contacts').select('id, phone, name, variables').eq('user_id', user.userId).eq('is_blocked', false).eq('opted_out', false)
      if (filter.tags?.length) contactQuery = contactQuery.overlaps('tags', filter.tags)
      const { data: contacts } = await contactQuery

      console.log(`[Campaign] contacts found: ${contacts?.length || 0}`)
      if (!contacts?.length) {
        console.log(`[Campaign] ABORT: no contacts`)
        await db.from('campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id as string)
        return res.status(200).json({ success: true, message: 'No contacts found' })
      }

      const { data: instance } = await db.from('whatsapp_instances').select('*').eq('id', campaign.instance_id).maybeSingle()
      if (!instance) return res.status(400).json({ error: 'Instance not found' })
      const CONNECTED_STATUSES = ['connected', 'active', 'open', 'ready']
      console.log(`[Campaign] instance.status=${instance.status} connected=${CONNECTED_STATUSES.includes(instance.status)}`)
      if (!CONNECTED_STATUSES.includes(instance.status)) {
        console.log(`[Campaign] ABORT: instance not connected status=${instance.status}`)
        return res.status(400).json({ error: `Instance not connected (status: ${instance.status})` })
      }

      // ONLY trust instance_type — the 'type' column is legacy and may contain wrong values
      const provider = resolveProvider(instance)
      const isWAWeb = provider === 'wa_web'
      console.log(`[Campaign] instance_id=${instance.id} instance_type=${instance.instance_type} provider=${provider.toUpperCase()}`)

      // Cloud API: use selected template or fall back to marketing_offer
      let effectiveTemplate = campaign.template_name
      if (!isWAWeb && !effectiveTemplate) {
        effectiveTemplate = 'marketing_offer'
        console.log(`[Campaign] no template selected → using default: marketing_offer`)
        await db.from('campaigns').update({ template_name: 'marketing_offer', template_language: 'en' }).eq('id', id as string)
        campaign.template_name = 'marketing_offer'
        campaign.template_language = 'en'
      }
      console.log(`[Campaign] template=${campaign.template_name} isWAWeb=${isWAWeb}`)

      await db.from('campaigns').update({
        status: 'running',
        started_at: new Date().toISOString(),
        total_contacts: contacts.length,
        sent_count: 0, failed_count: 0,
      }).eq('id', id as string)

      // NOTE: We respond AFTER the loop so Netlify keeps the function alive
      let sent = 0, failed = 0, reengagementBlocked = 0
      const delayMs = (campaign.delay_seconds || 3) * 1000
      console.log(`[Campaign] START loop contacts=${contacts.length} delayMs=${delayMs} template=${campaign.template_name}`)

      try { for (const contact of contacts) {
        const { data: current } = await db.from('campaigns').select('status').eq('id', id as string).maybeSingle()
        if (current?.status !== 'running') break

        // Skip invalid recipients
        const rawPhone = contact.phone || ''
        if (rawPhone.includes('@lid') || rawPhone.includes('@newsletter') || rawPhone.includes('@broadcast')) {
          console.log(`[Campaign] SKIP invalid recipient: ${rawPhone}`)
          failed++
          continue
        }

        // Validate and normalize phone (E.164 format — digits only, starts with country code)
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '')
        if (cleanPhone.length < 7 || cleanPhone.length > 15) {
          console.log(`[Campaign] SKIP invalid phone length: ${rawPhone} → ${cleanPhone}`)
          failed++
          continue
        }
        // Use clean phone for sending
        contact.phone = cleanPhone

        let waMessageId = uuidv4()
        let payloadType = 'text'

        try {
          // Build personalized message
          let msg = campaign.message || ''
          msg = msg.replace(/\{\{name\}\}/gi, contact.name || contact.phone)
                   .replace(/\{\{phone\}\}/gi, contact.phone)
          if (contact.variables) {
            for (const [k, v] of Object.entries(contact.variables as Record<string, string>)) {
              msg = msg.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), String(v))
            }
          }
          msg = msg.replace(/\{\{[^}]+\}\}/g, '').trim()

          // Determine template — explicit > campaign default > marketing_offer
          const templateName = campaign.template_name || TEMPLATES.MARKETING
          const templateLang = campaign.template_language || 'en'
          const templateVars = campaign.template_variables as string[] || []
          const resolvedVars = templateVars.map((v: string) =>
            v.replace(/\{\{name\}\}/gi, contact.name || contact.phone)
             .replace(/\{\{phone\}\}/gi, contact.phone)
          )

          if (isWAWeb) {
            console.log(`[Campaign] SENDING via WA_WEB to ${contact.phone}`)
            const r = await smartSendWAWeb({
              userId: user.userId, instanceId: instance.id,
              to: contact.phone, text: msg, contactId: contact.id,
            })
            waMessageId = r.messageId || waMessageId
            payloadType = 'text'
            console.log(`[Campaign] WA Web sent phone=${contact.phone} msgId=${r.messageId} error=${r.error || 'none'}`)

          } else {
            // Campaigns ALWAYS use templates — never text, no 24h window check
            const campaignTemplate = campaign.template_name || 'marketing_offer'

            // Build template body parameters:
            // 1. Use campaign-defined resolvedVars if present
            // 2. Otherwise use contact name (required by most templates like marketing_offer)
            const contactName = contact.name || 'Customer'
            // Named parameters required for templates using {{variable_name}} syntax
            const bodyParams = resolvedVars.length > 0
              ? resolvedVars.map((v: string) => ({ type: 'text', parameter_name: 'customer_name', text: v }))
              : [{ type: 'text', parameter_name: 'customer_name', text: contactName }]

            const templateComponents = [{
              type: 'body',
              parameters: bodyParams,
            }]

            const finalPayload = { template: campaignTemplate, lang: templateLang, components: [{ type: 'body', parameters: bodyParams }] }
            console.log(`[Campaign] Cloud API phone=${contact.phone} PAYLOAD=${JSON.stringify(finalPayload)}`)
            payloadType = 'template'

            const r = await smartSend({
              userId: user.userId,
              instanceId: instance.id,
              phoneNumberId: instance.phone_number_id,
              accessToken: instance.access_token,
              to: contact.phone,
              text: msg,
              contactId: contact.id,
              templateKey: 'MARKETING',
              templateLanguage: templateLang,
              templateComponents,
              forceTemplate: true,
              source: 'campaign',
              campaignId: id as string,
            })
            waMessageId = r.messageId || waMessageId
            payloadType = r.method === 'template' ? 'template' : 'text'
            console.log(`[Campaign] result phone=${contact.phone} method=${r.method} msgId=${r.messageId} template=${r.templateUsed || 'none'} error=${r.error || 'none'}`)

            if (r.error?.includes('131047') || r.error?.includes('Re-engagement')) {
              console.log(`[Campaign] ⚠️ 131047 phone=${contact.phone}`)
              reengagementBlocked++
            }
          }

          // Check for duplicate wa_message_id before insert
          const realMsgId = waMessageId.startsWith('00000000') ? null : waMessageId
          if (realMsgId) {
            // smartSend already saves to messages table with campaign_id
            // No duplicate insert needed here
          }
          sent++
          // Update DB after every message so status is visible in real-time
          await db.from('campaigns').update({
            sent_count: sent,
            failed_count: failed,
            accepted_count: sent,
            // Mark completed if this is the last contact
            ...(sent + failed >= contacts.length ? {
              status: 'completed',
              completed_at: new Date().toISOString(),
            } : {}),
          }).eq('id', id as string)
          console.log(`[Campaign] Progress: sent=${sent} failed=${failed} total=${contacts.length}`)

        } catch (e: any) {
          const metaBody = e?.response?.data
          const errMsg = metaBody?.error?.message || e?.message || 'Unknown error'
          const errCode = metaBody?.error?.code
          const errSubcode = metaBody?.error?.error_subcode
          console.error(`[Campaign] ❌ FAILED phone=${contact.phone} status=${e?.response?.status} code=${errCode} subcode=${errSubcode} reason="${errMsg}" body=${JSON.stringify(metaBody)}`)
          if (errCode === 131047 || errMsg?.includes('Re-engagement')) {
            reengagementBlocked++
            console.log(`[Campaign] ⚠️ 131047 RE-ENGAGEMENT: phone=${contact.phone} — outside 24h, template required`)
          }
          const { error: failInsertErr } = await db.from('messages').insert({
            id: uuidv4(), user_id: user.userId, instance_id: campaign.instance_id,
            contact_id: contact.id, campaign_id: id as string,
            wa_message_id: uuidv4(), direction: 'outbound',
            type: payloadType, content: campaign.template_name || campaign.message, status: 'failed',
            meta: { error: errMsg, code: errCode, subcode: errSubcode },
          })
          if (failInsertErr) console.log(`[Campaign] failed message insert warn: ${failInsertErr.message}`)
          failed++
        }

        if ((sent + failed) % 5 === 0) {
          await db.from('campaigns').update({ sent_count: sent, failed_count: failed }).eq('id', id as string)
        }

        if (delayMs > 0 && contacts.indexOf(contact) < contacts.length - 1) {
          await new Promise(r => setTimeout(r, delayMs))
        }
      }

        await db.from('campaigns').update({
          status: 'completed', completed_at: new Date().toISOString(),
          sent_count: sent, failed_count: failed,
          meta: { reengagement_blocked: reengagementBlocked },
        }).eq('id', id as string)
        console.log(`[Campaign] COMPLETE sent=${sent} failed=${failed} reengagement_blocked=${reengagementBlocked}`)
        await notifyCampaignComplete(user.userId, campaign.name, sent, failed)
      } catch (loopErr: any) {
        console.error(`[Campaign] LOOP ERROR: ${loopErr?.message}`)
        await db.from('campaigns').update({
          status: 'failed', completed_at: new Date().toISOString(),
          sent_count: sent, failed_count: failed,
          meta: { error: loopErr?.message },
        }).eq('id', id as string)
      }
      return res.status(200).json({ success: true, sent, failed, message: `Campaign completed — sent to ${sent} contacts` })
    }

    if (action === 'pause') { await db.from('campaigns').update({ status: 'paused' }).eq('id', id as string); return res.status(200).json({ success: true }) }
    if (action === 'cancel') { await db.from('campaigns').update({ status: 'failed' }).eq('id', id as string); return res.status(200).json({ success: true }) }
  }

  if (req.method === 'DELETE') {
    if (campaign.status === 'running') return res.status(400).json({ error: 'Pause campaign before deleting' })
    await db.from('campaigns').delete().eq('id', id as string)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
