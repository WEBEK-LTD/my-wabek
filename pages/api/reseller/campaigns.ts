import { cleanTemplateParam } from '@/lib/campaign-templates'
import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { NextApiRequest, NextApiResponse } from 'next'
import { requireOwnerOrRole } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireOwnerOrRole(req, res)
  if (!user) return
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    // Get all referral users
    const { data: referrals } = await db
      .from('reseller_referrals')
      .select('referred_user_id')
      .eq('reseller_id', user.userId)

    const referredIds = (referrals || []).map(r => r.referred_user_id)

    // Get reseller's own instances
    const { data: instances } = await db
      .from('whatsapp_instances')
      .select('id, display_name, phone_number, status, type')
      .eq('user_id', user.userId)
      .eq('status', 'connected')

    // Get past reseller campaigns
    const { data: campaigns } = await db
      .from('reseller_campaigns')
      .select('*')
      .eq('reseller_id', user.userId)
      .order('created_at', { ascending: false })
      .limit(50)

    return res.status(200).json({
      referrals: referredIds,
      referral_count: referredIds.length,
      instances: instances || [],
      campaigns: campaigns || [],
    })
  }

  if (req.method === 'POST') {
    const { instance_id, message, target, scheduled_at, delay_seconds = 3 } = req.body || {}
    // target: 'all' | 'active' | specific user_ids[]

    if (typeof instance_id !== 'string' || typeof message !== 'string' || !instance_id || !message.trim()) {
      return res.status(400).json({ error: 'instance_id and message required' })
    }
    if (message.length > 4096) return res.status(400).json({ error: 'Message too long' })
    const delay = Math.min(Math.max(Number(delay_seconds) || 0, 1), 60)

    // Verify instance belongs to reseller
    const { data: instance } = await db
      .from('whatsapp_instances')
      .select('id, status')
      .eq('id', instance_id)
      .eq('user_id', user.userId)
      .single()

    if (!instance) return res.status(404).json({ error: 'Instance not found' })
    if (instance.status !== 'connected') return res.status(400).json({ error: 'Instance is not connected' })

    // Get target users
    // Only the reseller's OWN referrals can ever be targeted.
    const { data: refs } = await db
      .from('reseller_referrals')
      .select('referred_user_id')
      .eq('reseller_id', user.userId)
      .eq('status', 'active')
    const ownReferrals = new Set((refs || []).map(r => r.referred_user_id as string))

    let targetUserIds: string[] = []
    if (target === 'all' || target === 'active' || !target) {
      targetUserIds = Array.from(ownReferrals)
    } else if (Array.isArray(target)) {
      targetUserIds = Array.from(new Set(target.filter((id: unknown): id is string => typeof id === 'string' && ownReferrals.has(id))))
    }

    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: 'No target users found' })
    }

    // Get phone numbers for target users
    const { data: users } = await db
      .from('users')
      .select('id, name, phone')
      .in('id', targetUserIds)
      .eq('is_active', true)

    const contacts = (users || []).filter(u => u.phone)

    // Create campaign record
    const campaignId = uuidv4()
    await db.from('reseller_campaigns').insert({
      id: campaignId,
      reseller_id: user.userId,
      instance_id,
      message,
      target_count: contacts.length,
      status: scheduled_at ? 'scheduled' : 'sending',
      scheduled_at: scheduled_at || null,
      created_at: new Date().toISOString(),
    })

    if (!scheduled_at) {
      // Send immediately in background
      sendToContacts(contacts, message, instance_id, campaignId, delay, user.userId)
    }

    return res.status(201).json({
      campaign_id: campaignId,
      target_count: contacts.length,
      status: scheduled_at ? 'scheduled' : 'sending',
    })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function sendToContacts(
  contacts: { id: string; name: string; phone: string }[],
  message: string,
  instanceId: string,
  campaignId: string,
  delay: number,
  resellerUserId: string
) {
  const db = supabaseAdmin()
  let sent = 0

  for (const contact of contacts) {
    try {
      const msg = message
        .replace('{{name}}', contact.name || '')
        .replace('{{phone}}', contact.phone || '')

      // Send via smart-send (handles both WA Web and Cloud API)
      const { data: inst } = await supabaseAdmin()
        .from('whatsapp_instances')
        .select('id,phone_number_id,access_token,instance_type,type,status')
        .eq('id', instanceId).maybeSingle()
      if (inst) {
        const isWAWeb = inst.instance_type === 'wa_web'
        if (isWAWeb) {
          await smartSendWAWeb({ userId: resellerUserId, instanceId: inst.id, to: contact.phone, text: msg, source: 'campaign' })
        } else {
          await smartSend({ userId: resellerUserId, instanceId: inst.id, phoneNumberId: inst.phone_number_id, accessToken: inst.access_token, to: contact.phone, text: msg, forceTemplate: false, source: 'campaign',
            // Outside the 24h window: the marketing template carries this text
            templateKey: 'MARKETING', templateComponents: [{ type: 'body', parameters: [{ type: 'text', parameter_name: 'customer_name', text: cleanTemplateParam(contact.name || 'Customer') }, { type: 'text', parameter_name: 'offer_details', text: cleanTemplateParam(msg) }] }] })
        }
      }
      sent++

      if (delay > 0) {
        await new Promise(r => setTimeout(r, delay * 1000))
      }
    } catch {}
  }

  await db.from('reseller_campaigns').update({
    status: 'completed',
    sent_count: sent,
    completed_at: new Date().toISOString(),
  }).eq('id', campaignId)
}
