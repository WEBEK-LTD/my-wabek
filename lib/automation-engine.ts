import { smartSend, smartSendWAWeb } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { sendTextMessage } from './whatsapp'
import { sendWAWebMessage } from './wa-web'
import { v4 as uuidv4 } from 'uuid'

export async function executeAutomationFlow(params: {
  userId: string
  instanceId: string
  from: string
  message: string
  flowId?: string
}) {
  const db = supabaseAdmin()
  const { userId, instanceId, from, message } = params

  // Get instance details
  const { data: instance } = await db.from('whatsapp_instances').select('*').eq('id', instanceId).single()
  if (!instance) return

  // Find matching flows
  const { data: flows } = await db.from('automation_flows').select('*')
    .eq('user_id', userId).eq('is_active', true)
    .or(`instance_id.eq.${instanceId},instance_id.is.null`)

  if (!flows?.length) return

  for (const flow of flows) {
    let triggered = false
    if (flow.trigger_type === 'message_received') triggered = true
    else if (flow.trigger_type === 'keyword' && flow.trigger_value) {
      const keywords = flow.trigger_value.split(',').map((k: string) => k.trim().toLowerCase())
      triggered = keywords.some((kw: string) => message.toLowerCase().includes(kw))
    }
    if (!triggered) continue

    // Execute nodes
    const nodes: Array<{ type: string; data: Record<string, string>; next?: string }> = flow.nodes || []
    for (const node of nodes) {
      if (node.type === 'send_message' && node.data?.text) {
        try {
          let msgId = uuidv4()
          if ((instance.instance_type || instance.type) === 'wa_web') {
            const result = await sendWAWebMessage({ instanceId, to: from, text: node.data.text })
            msgId = result.messageId || msgId
          } else {
            const result = await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id, accessToken: instance.access_token, to: from, text: node.data.text, source: 'automation' as any })
            msgId = result?.messageId || msgId
          }
          await db.from('messages').insert({
            id: uuidv4(), user_id: userId, instance_id: instanceId,
            direction: 'outbound', type: 'text', content: node.data.text,
            wa_message_id: msgId, status: 'sent',
          })
        } catch (e) { console.error('Automation send error:', e) }
      }
      if (node.type === 'delay' && node.data?.seconds) {
        await new Promise(r => setTimeout(r, Math.min(parseInt(node.data.seconds) * 1000, 10000)))
      }
      if (node.type === 'tag_contact' && node.data?.tag) {
        const { data: contact } = await db.from('contacts').select('tags').eq('phone', from).eq('user_id', userId).single()
        if (contact) {
          const tags = contact.tags || []
          if (!tags.includes(node.data.tag)) {
            await db.from('contacts').update({ tags: [...tags, node.data.tag] }).eq('phone', from).eq('user_id', userId)
          }
        }
      }
    }
    await db.from('automation_flows').update({ trigger_count: (flow.trigger_count || 0) + 1 }).eq('id', flow.id)
  }
}
