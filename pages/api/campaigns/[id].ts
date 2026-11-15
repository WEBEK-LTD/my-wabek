import { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuth } from '@/lib/auth'
import { isCronRequest } from '@/lib/security'
import { smartSend, smartSendWAWeb, TEMPLATES, resolveProvider } from '@/lib/wa-smart-send'
import { notifyCampaignComplete } from '@/lib/notifications'
import { v4 as uuidv4 } from 'uuid'

export const config = {
  api: {
    responseLimit: false,
    externalResolver: true,  // Prevent Netlify from auto-closing after response
  },
  maxDuration: 26,  // Netlify max is 26s on Pro
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  instance_id: z.string().uuid().optional(),
  message: z.string().min(1).optional(),
  media_url: z.string().url().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  delay_seconds: z.number().min(1).max(60).optional(),
  template_name: z.string().nullable().optional(),
  template_language: z.string().nullable().optional(),
  template_variables: z.array(z.string().max(1024)).max(20).nullable().optional(),
})

const STARTABLE = ['draft', 'scheduled', 'paused']
const CONTACT_PAGE_SIZE = 200
const CONNECTED_STATUSES = ['connected', 'active', 'open', 'ready']

type CampaignContact = { id: string; phone: string | null; name: string | null; variables: Record<string, string> | null }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = supabaseAdmin()
  const id = typeof req.query.id === 'string' ? req.query.id : ''
  if (!id) return res.status(400).json({ error: 'Campaign id required' })

  // Internal scheduler calls authenticate with CRON_SECRET (x-cron-secret
  // header or `Authorization: Bearer <CRON_SECRET>`). They act as the
  // campaign's owner — never with elevated privileges — and may only start
  // (resume) a campaign.
  const isSystemCall = isCronRequest(req)

  let userId: string
  let campaign: any = null

  if (isSystemCall) {
    if (req.method !== 'POST' || req.body?.action !== 'start') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { data } = await db.from('campaigns').select('*').eq('id', id).maybeSingle()
    campaign = data
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
    userId = campaign.user_id
  } else {
    const authed = await requireAuth(req, res)
    if (!authed) return
    userId = authed.userId
    const { data } = await db.from('campaigns').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
    campaign = data
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  }

  if (req.method === 'GET') return res.status(200).json({ campaign })

  if (req.method === 'PUT') {
    const parsed = updateSchema.safeParse(req.body || {})
    if (!parsed.success) return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors })
    const b = parsed.data
    if (!['draft', 'scheduled'].includes(campaign.status)) return res.status(400).json({ error: 'Cannot edit running campaign' })

    if (b.instance_id) {
      const { data: inst } = await db.from('whatsapp_instances').select('id')
        .eq('id', b.instance_id).eq('user_id', userId).maybeSingle()
      if (!inst) return res.status(400).json({ error: 'Instance not found' })
    }

    const { data, error } = await db.from('campaigns').update({
      name: b.name, message: b.message, media_url: b.media_url, scheduled_at: b.scheduled_at,
      delay_seconds: b.delay_seconds,
      ...(b.instance_id ? { instance_id: b.instance_id } : {}),
      template_name: b.template_name || null,
      template_language: b.template_language || 'en',
      template_variables: b.template_variables || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('user_id', userId).in('status', ['draft', 'scheduled']).select().maybeSingle()
    if (error) {
      console.error('[Campaign] update error:', error.message)
      return res.status(500).json({ error: 'Failed to update campaign' })
    }
    if (!data) return res.status(409).json({ error: 'Cannot edit running campaign' })
    return res.status(200).json({ campaign: data })
  }

  if (req.method === 'POST') {
    const { action } = req.body || {}

    if (action === 'start') {
      if (!STARTABLE.includes(campaign.status)) return res.status(400).json({ error: 'Cannot start' })

      // The instance must belong to the campaign owner
      const { data: instance } = await db.from('whatsapp_instances').select('*')
        .eq('id', campaign.instance_id).eq('user_id', userId).maybeSingle()
      if (!instance) return res.status(400).json({ error: 'Instance not found' })
      if (!CONNECTED_STATUSES.includes(instance.status)) {
        console.log(`[Campaign] ABORT: instance not connected status=${instance.status}`)
        return res.status(400).json({ error: `Instance not connected (status: ${instance.status})` })
      }

      const filter = (campaign.contact_filter as { tags?: string[]; all?: boolean }) || {}

      // Total audience — exact count, no 1000-row truncation
      let countQuery = db.from('contacts').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('is_blocked', false).eq('opted_out', false)
      if (filter.tags?.length) countQuery = countQuery.overlaps('tags', filter.tags)
      const { count: totalCount } = await countQuery
      const totalContacts = totalCount || 0

      // ── Batch resume support ──────────────────────────────────────────
      // A single serverless invocation has a hard ~26s limit, so large lists
      // are sent over several invocations. Contacts are walked in `id` order
      // with a keyset cursor (`meta.last_contact_id`) so nothing is skipped or
      // sent twice between batches, even if contacts are added/removed.
      const isFreshStart = campaign.status === 'draft'
      const meta = (campaign.meta as Record<string, any>) || {}
      let cursor: string | null = isFreshStart ? null : (meta.last_contact_id || null)
      let processedTotal = isFreshStart ? 0 : (Number(meta.offset) || 0)
      let sent = isFreshStart ? 0 : (campaign.sent_count || 0)
      let failed = isFreshStart ? 0 : (campaign.failed_count || 0)
      let reengagementBlocked = isFreshStart ? 0 : (meta.reengagement_blocked || 0)

      // Backward compatibility: campaigns paused/rescheduled by the previous
      // version stored only a numeric `meta.offset` into an unordered list,
      // which can't be mapped onto id order. Instead, skip every contact that
      // already got an outbound message on this instance since the campaign
      // started. After this batch the keyset cursor takes over.
      let legacySkip: Set<string> | null = null
      if (!isFreshStart && !meta.last_contact_id && Number(meta.offset) > 0) {
        legacySkip = new Set<string>()
        const since = campaign.started_at || campaign.created_at
        for (let from = 0; ; from += 1000) {
          const { data: rows } = await db.from('messages').select('id, contact_id')
            .eq('user_id', userId).eq('instance_id', campaign.instance_id)
            .eq('direction', 'outbound').gte('created_at', since)
            .not('contact_id', 'is', null)
            .order('id').range(from, from + 999)
          for (const r of rows || []) legacySkip.add(r.contact_id as string)
          if (!rows || rows.length < 1000) break
        }
        console.log(`[Campaign] legacy resume offset=${meta.offset} skip=${legacySkip.size}`)
      }

      // ── Atomic start: only one invocation may claim the campaign ──────
      const { data: claimed } = await db.from('campaigns').update({
        status: 'running',
        started_at: campaign.started_at || new Date().toISOString(),
        total_contacts: totalContacts,
        ...(isFreshStart ? { sent_count: 0, failed_count: 0 } : {}),
      }).eq('id', id).eq('user_id', userId).in('status', STARTABLE).select('id')
      if (!claimed?.length) {
        return res.status(409).json({ error: 'Campaign is already running or cannot be started' })
      }

      if (totalContacts === 0) {
        await db.from('campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
        return res.status(200).json({ success: true, message: 'No contacts found' })
      }

      // ONLY trust instance_type — the 'type' column is legacy and may contain wrong values
      const provider = resolveProvider(instance)
      const isWAWeb = provider === 'wa_web'
      console.log(`[Campaign] start id=${id} provider=${provider} fresh=${isFreshStart} cursor=${cursor || 'none'} total=${totalContacts}`)

      // Cloud API: use selected template or fall back to marketing_offer
      if (!isWAWeb && !campaign.template_name) {
        await db.from('campaigns').update({ template_name: 'marketing_offer', template_language: 'en' }).eq('id', id)
        campaign.template_name = 'marketing_offer'
        campaign.template_language = 'en'
      }

      const buildMeta = () => ({
        ...meta,
        reengagement_blocked: reengagementBlocked,
        last_contact_id: cursor,
        offset: processedTotal,
      })

      // NOTE: We respond AFTER the loop so Netlify keeps the function alive
      const delayMs = (campaign.delay_seconds || 3) * 1000

      // Hard time budget per invocation — must stay under Netlify's 26s
      // function limit. Leave a safety margin for the final DB write + response.
      const BATCH_TIME_BUDGET_MS = 20000
      const batchStartedAt = Date.now()
      let processedInBatch = 0
      let externalStatus: string | null = null
      let exhausted = false

      const fetchPage = async (after: string | null): Promise<CampaignContact[]> => {
        let q = db.from('contacts').select('id, phone, name, variables')
          .eq('user_id', userId).eq('is_blocked', false).eq('opted_out', false)
        if (filter.tags?.length) q = q.overlaps('tags', filter.tags)
        if (after) q = q.gt('id', after)
        const { data, error } = await q.order('id', { ascending: true }).limit(CONTACT_PAGE_SIZE)
        if (error) throw new Error(`contacts query failed: ${error.message}`)
        return (data || []) as CampaignContact[]
      }

      const sendOne = async (contact: CampaignContact): Promise<void> => {
        const rawPhone = contact.phone || ''
        if (rawPhone.includes('@lid') || rawPhone.includes('@newsletter') || rawPhone.includes('@broadcast')) {
          failed++
          return
        }
        // Validate and normalize phone (E.164 — digits only, starts with country code)
        const cleanPhone = rawPhone.replace(/[^0-9]/g, '')
        if (cleanPhone.length < 7 || cleanPhone.length > 15) {
          failed++
          return
        }

        let payloadType = 'text'
        try {
          // Build personalized message
          let msg = campaign.message || ''
          msg = msg.replace(/\{\{name\}\}/gi, contact.name || cleanPhone)
                   .replace(/\{\{phone\}\}/gi, cleanPhone)
          if (contact.variables) {
            for (const [k, v] of Object.entries(contact.variables)) {
              const key = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              msg = msg.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(v))
            }
          }
          msg = msg.replace(/\{\{[^}]+\}\}/g, '').trim()

          const templateLang = campaign.template_language || 'en'
          const templateVars = (campaign.template_variables as string[]) || []
          const resolvedVars = templateVars.map((v: string) =>
            v.replace(/\{\{name\}\}/gi, contact.name || cleanPhone)
             .replace(/\{\{phone\}\}/gi, cleanPhone)
          )

          if (isWAWeb) {
            const r = await smartSendWAWeb({
              userId, instanceId: instance.id,
              to: cleanPhone, text: msg, contactId: contact.id,
              source: 'campaign',
            })
            if (r.error && !r.messageId) throw new Error(r.error)
          } else {
            // Campaigns ALWAYS use templates — never text, no 24h window check
            const campaignTemplate = campaign.template_name || TEMPLATES.MARKETING

            // marketing_offer's approved body:
            //   "Hello {{customer_name}}, {{offer_details}} Thank you, Wabek Team"
            const contactName = contact.name || 'Customer'
            // Meta template parameters cannot contain newlines, tabs, or 4+
            // consecutive spaces, and have a practical length limit.
            const offerDetails = (msg || 'We have a special offer for you.')
              .replace(/[\r\n\t]+/g, ' ')
              .replace(/ {2,}/g, ' ')
              .trim()
              .slice(0, 1024)

            let bodyParams: any[]
            if (resolvedVars.length > 0) {
              bodyParams = resolvedVars.map((v: string) => ({ type: 'text', parameter_name: 'customer_name', text: v }))
            } else if (campaignTemplate === 'marketing_offer') {
              bodyParams = [
                { type: 'text', parameter_name: 'customer_name', text: contactName },
                { type: 'text', parameter_name: 'offer_details', text: offerDetails },
              ]
            } else {
              bodyParams = [{ type: 'text', parameter_name: 'customer_name', text: contactName }]
            }
            payloadType = 'template'

            const r = await smartSend({
              userId,
              instanceId: instance.id,
              phoneNumberId: instance.phone_number_id,
              accessToken: instance.access_token,
              to: cleanPhone,
              text: msg,
              contactId: contact.id,
              templateKey: 'MARKETING',
              templateNameOverride: campaignTemplate,
              templateLanguage: templateLang,
              templateComponents: [{ type: 'body', parameters: bodyParams }],
              forceTemplate: true,
              source: 'campaign',
              campaignId: id,
            })
            payloadType = r.method === 'template' ? 'template' : 'text'
            if (r.error?.includes('131047') || r.error?.includes('Re-engagement')) reengagementBlocked++
            // smartSend reports failures via `error` instead of throwing
            if (r.error && !r.messageId) throw new Error(r.error)
          }
          // smartSend / smartSendWAWeb already persist the outbound message
          sent++
        } catch (e: any) {
          const metaBody = e?.response?.data
          const errMsg = metaBody?.error?.message || e?.message || 'Unknown error'
          const errCode = metaBody?.error?.code
          const errSubcode = metaBody?.error?.error_subcode
          console.error(`[Campaign] FAILED contact=${contact.id} code=${errCode} reason="${String(errMsg).slice(0, 200)}"`)
          if (errCode === 131047) reengagementBlocked++
          const { error: failInsertErr } = await db.from('messages').insert({
            id: uuidv4(), user_id: userId, instance_id: campaign.instance_id,
            contact_id: contact.id, campaign_id: id,
            wa_message_id: uuidv4(), direction: 'outbound',
            type: payloadType, content: campaign.template_name || campaign.message, status: 'failed',
            meta: { error: errMsg, code: errCode, subcode: errSubcode, source: 'campaign' },
          })
          if (failInsertErr) console.log(`[Campaign] failed message insert warn: ${failInsertErr.message}`)
          failed++
        }
      }

      try {
        let page = await fetchPage(cursor)
        outer: while (true) {
          if (!page.length) { exhausted = true; break }
          for (let i = 0; i < page.length; i++) {
            const contact = page[i]
            if (Date.now() - batchStartedAt > BATCH_TIME_BUDGET_MS) break outer

            if (legacySkip?.has(contact.id)) { cursor = contact.id; continue }

            const { data: current } = await db.from('campaigns').select('status').eq('id', id).maybeSingle()
            if (current?.status !== 'running') {
              externalStatus = current?.status || null
              break outer
            }

            await sendOne(contact)
            cursor = contact.id
            processedTotal++
            processedInBatch++

            // Persist progress (and cursor) after every message so a crash or
            // timeout never re-sends to contacts already processed.
            await db.from('campaigns').update({
              sent_count: sent, failed_count: failed, accepted_count: sent,
              meta: buildMeta(),
            }).eq('id', id)

            const isLastOnPage = i === page.length - 1
            const maybeMore = !isLastOnPage || page.length === CONTACT_PAGE_SIZE
            if (delayMs > 0 && maybeMore) await new Promise(r => setTimeout(r, delayMs))
          }
          if (page.length < CONTACT_PAGE_SIZE) { exhausted = true; break }
          page = await fetchPage(cursor)
        }

        if (exhausted) {
          await db.from('campaigns').update({
            status: 'completed', completed_at: new Date().toISOString(),
            sent_count: sent, failed_count: failed,
            meta: buildMeta(),
          }).eq('id', id)
          console.log(`[Campaign] COMPLETE id=${id} sent=${sent} failed=${failed} reengagement_blocked=${reengagementBlocked}`)
          await notifyCampaignComplete(userId, campaign.name, sent, failed)
          return res.status(200).json({ success: true, sent, failed, done: true, message: `Campaign completed — sent to ${sent} contacts` })
        }

        if (externalStatus === 'paused' || externalStatus === 'failed') {
          // User explicitly paused/cancelled mid-batch. Save progress but DO NOT
          // override their chosen status with 'scheduled' — that would silently
          // resume a paused campaign via the next scheduler tick.
          await db.from('campaigns').update({
            sent_count: sent, failed_count: failed, meta: buildMeta(),
          }).eq('id', id)
          return res.status(200).json({
            success: true, sent, failed, done: false, status: externalStatus,
            offset: processedTotal, total: totalContacts,
            message: `Campaign ${externalStatus} — progress saved at ${processedTotal}/${totalContacts}. Resume with "start" to continue from here.`,
          })
        }

        // Batch time limit reached with contacts remaining. Reschedule for
        // immediate pickup by the scheduler cron (runs every minute).
        await db.from('campaigns').update({
          status: 'scheduled',
          scheduled_at: new Date().toISOString(),
          sent_count: sent, failed_count: failed,
          meta: buildMeta(),
        }).eq('id', id).eq('status', 'running')
        console.log(`[Campaign] BATCH DONE id=${id} processed=${processedInBatch} total=${processedTotal}/${totalContacts} — rescheduled`)
        return res.status(200).json({
          success: true, sent, failed, done: false,
          offset: processedTotal, total: totalContacts,
          message: `Batch sent ${processedInBatch} (${processedTotal}/${totalContacts}) — campaign rescheduled to continue`,
        })
      } catch (loopErr: any) {
        console.error(`[Campaign] LOOP ERROR id=${id}: ${loopErr?.message}`)
        await db.from('campaigns').update({
          status: 'failed', completed_at: new Date().toISOString(),
          sent_count: sent, failed_count: failed,
          meta: { ...buildMeta(), error: 'Campaign stopped due to an internal error' },
        }).eq('id', id)
        return res.status(200).json({ success: false, sent, failed, error: 'Campaign stopped due to an internal error' })
      }
    }

    if (action === 'pause') {
      await db.from('campaigns').update({ status: 'paused' }).eq('id', id).eq('user_id', userId)
      return res.status(200).json({ success: true })
    }
    if (action === 'cancel') {
      await db.from('campaigns').update({ status: 'failed' }).eq('id', id).eq('user_id', userId)
      return res.status(200).json({ success: true })
    }
    return res.status(400).json({ error: 'Unknown action' })
  }

  if (req.method === 'DELETE') {
    if (campaign.status === 'running') return res.status(400).json({ error: 'Pause campaign before deleting' })
    await db.from('campaigns').delete().eq('id', id).eq('user_id', userId)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
