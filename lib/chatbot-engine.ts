import { smartSend, smartSendWAWeb, SmartSendResult } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { sendWAWebMessage } from './wa-web'
import { sendTextMessage } from './whatsapp'
import { v4 as uuidv4 } from 'uuid'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ChatbotNode {
  id: string
  type: 'start' | 'message' | 'question' | 'condition' | 'buttons' | 'delay' | 'tag' | 'assign' | 'end' | 'jump' | 'ai'
  data: Record<string, unknown>
}

interface ChatbotEdge {
  id: string
  source: string
  target: string
  label?: string
}

interface Session {
  id: string
  user_id: string
  flow_id: string
  contact_phone: string
  current_node_id: string
  variables: Record<string, unknown>
  is_active: boolean
}

// ─────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────

export async function processChatbotMessage(params: {
  userId: string
  instanceId: string
  instance: Record<string, unknown>
  from: string
  message: string
  contactName?: string
}): Promise<boolean> {
  const { userId, instanceId, instance, from, message, contactName } = params
  const db = supabaseAdmin()

  try {
    // 1. Check for active session first
    const { data: session } = await db
      .from('chatbot_sessions')
      .select('*, chatbot_flows(*)')
      .eq('user_id', userId)
      .eq('contact_phone', from)
      .eq('is_active', true)
      .maybeSingle()

    if (session) {
      console.log(`[CHATBOT] continuing session flow_id=${session.flow_id}`)
      const replied = await continueFlow(session, message, instance)
      return replied
    }

    // 2. Find matching active flows for this instance
    const { data: flows } = await db
      .from('chatbot_flows')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (!flows?.length) {
      console.log(`[CHATBOT] no active flows`)
      return false
    }

    // Filter flows for this instance (null instance_id = all instances)
    const eligible = flows.filter(f =>
      !f.instance_id || f.instance_id === instanceId
    )

    if (!eligible.length) return false

    // 3. Match flow by trigger
    let matched = null
    const msgLower = message.toLowerCase().trim()

    // First: try keyword match (more specific)
    for (const flow of eligible) {
      const keywords: string[] = flow.trigger_keywords || []
      if (keywords.length > 0) {
        const hit = keywords.some(k => msgLower.includes(k.toLowerCase().trim()))
        if (hit) { matched = flow; break }
      }
    }

    // Second: fallback to any_message ONLY if no keyword matched
    if (!matched) {
      for (const flow of eligible) {
        const keywords: string[] = flow.trigger_keywords || []
        if (keywords.length === 0) {
          matched = flow
          break
        }
      }
    }

    if (!matched) {
      console.log(`[CHATBOT] no flow matched message="${msgLower.substring(0, 30)}"`)
      return false
    }

    console.log(`[CHATBOT] matched flow="${matched.name}" keywords=${JSON.stringify(matched.trigger_keywords)}`)

    // 4. Validate flow has nodes
    const nodes: ChatbotNode[] = matched.nodes || []
    if (!nodes.length) {
      console.log(`[CHATBOT] flow has no nodes — AI will handle`)
      return false
    }

    const startNode = nodes.find(n => n.type === 'start') || nodes[0]
    if (!startNode) {
      console.log(`[CHATBOT] no start node — AI will handle`)
      return false
    }

    // 5. Create session
    const newSession: Session = {
      id: uuidv4(),
      user_id: userId,
      flow_id: matched.id,
      contact_phone: from,
      current_node_id: startNode.id,
      variables: { name: contactName || from, phone: from },
      is_active: true,
    }

    await db.from('chatbot_sessions').upsert(newSession, { onConflict: 'user_id,contact_phone' })

    // 6. Execute from start node
    const replied = await executeNode(startNode, newSession, matched, instance)

    // Update trigger count
    await db.from('chatbot_flows')
      .update({ trigger_count: (matched.trigger_count || 0) + 1 })
      .eq('id', matched.id)

    // Only block AI if chatbot actually sent a message
    return replied

  } catch (err) {
    console.error('[CHATBOT] error:', err)
    return false
  }
}

// ─────────────────────────────────────────────────────────
// Continue existing session
// ─────────────────────────────────────────────────────────

async function continueFlow(
  sessionData: Session & { chatbot_flows: Record<string, unknown> },
  userInput: string,
  instance: Record<string, unknown>
): Promise<boolean> {
  const db = supabaseAdmin()
  const flow = sessionData.chatbot_flows
  const nodes: ChatbotNode[] = (flow.nodes as ChatbotNode[]) || []
  const edges: ChatbotEdge[] = (flow.edges as ChatbotEdge[]) || []

  const currentNode = nodes.find(n => n.id === sessionData.current_node_id)
  if (!currentNode) {
    await db.from('chatbot_sessions').update({ is_active: false }).eq('id', sessionData.id)
    return false
  }

  // Handle question input
  if (currentNode.type === 'question') {
    const varName = (currentNode.data.variable as string) || 'answer'
    const updatedVars = { ...sessionData.variables, [varName]: userInput }
    await db.from('chatbot_sessions').update({ variables: updatedVars }).eq('id', sessionData.id)
    sessionData.variables = updatedVars

    // Move to next node
    const edge = edges.find(e => e.source === currentNode.id)
    if (edge) {
      const next = nodes.find(n => n.id === edge.target)
      if (next) {
        await db.from('chatbot_sessions').update({ current_node_id: next.id }).eq('id', sessionData.id)
        return await executeNode(next, sessionData, flow, instance)
      }
    }
    return true
  }

  // Handle button selection
  if (currentNode.type === 'buttons') {
    const buttons = (currentNode.data.buttons as Array<{ id: string; text: string }>) || []
    const matched = buttons.find(b =>
      b.text.toLowerCase() === userInput.toLowerCase() ||
      b.id === userInput ||
      String(buttons.indexOf(b) + 1) === userInput
    )

    const edge = matched
      ? edges.find(e => e.source === currentNode.id && (e.label === matched.text || e.label === matched.id))
        || edges.find(e => e.source === currentNode.id)
      : edges.find(e => e.source === currentNode.id)

    if (edge) {
      const next = nodes.find(n => n.id === edge.target)
      if (next) {
        await db.from('chatbot_sessions').update({ current_node_id: next.id }).eq('id', sessionData.id)
        return await executeNode(next, sessionData, flow, instance)
      }
    }
    // Re-send buttons
    await sendMsg(currentNode, sessionData, instance)
    return true
  }

  // Default: move to next node
  const edge = edges.find(e => e.source === currentNode.id)
  if (edge) {
    const next = nodes.find(n => n.id === edge.target)
    if (next) {
      await db.from('chatbot_sessions').update({ current_node_id: next.id }).eq('id', sessionData.id)
      return await executeNode(next, sessionData, flow, instance)
    }
  }

  return false
}

// ─────────────────────────────────────────────────────────
// Execute a single node — returns true if a message was sent
// ─────────────────────────────────────────────────────────

async function executeNode(
  node: ChatbotNode,
  session: Session,
  flow: Record<string, unknown>,
  instance: Record<string, unknown>
): Promise<boolean> {
  const db = supabaseAdmin()
  const edges: ChatbotEdge[] = (flow.edges as ChatbotEdge[]) || []
  const nodes: ChatbotNode[] = (flow.nodes as ChatbotNode[]) || []

  const next = async (): Promise<boolean> => {
    const edge = edges.find(e => e.source === node.id)
    if (!edge) return false
    const nextNode = nodes.find(n => n.id === edge.target)
    if (!nextNode) return false
    await db.from('chatbot_sessions').update({ current_node_id: nextNode.id }).eq('id', session.id)
    return await executeNode(nextNode, session, flow, instance)
  }

  switch (node.type) {
    case 'start': {
      const startEdge = edges.find(e => e.source === node.id)
      if (!startEdge) {
        // No connection drawn from Start. If there's exactly one other node,
        // assume it's meant to follow Start directly (common case: user adds
        // a single "message" node but never draws the connecting line).
        const others = nodes.filter(n => n.id !== node.id)
        if (others.length === 1) {
          console.log(`[CHATBOT] start node has no edge — auto-running single node "${others[0].id}" (${others[0].type})`)
          await db.from('chatbot_sessions').update({ current_node_id: others[0].id }).eq('id', session.id)
          return await executeNode(others[0], session, flow, instance)
        }
        console.log(`[CHATBOT] start node has no outgoing edge and ${others.length} other nodes — nothing to execute`)
        return false
      }
      return await next()
    }

    case 'message': {
      const sent = await sendMsg(node, session, instance)
      await next()
      return sent
    }

    case 'question': {
      await sendMsg(node, session, instance)
      await db.from('chatbot_sessions').update({ current_node_id: node.id }).eq('id', session.id)
      return true
    }

    case 'buttons': {
      await sendMsg(node, session, instance)
      await db.from('chatbot_sessions').update({ current_node_id: node.id }).eq('id', session.id)
      return true
    }

    case 'delay': {
      const ms = Math.min((node.data.seconds as number || 1) * 1000, 10000)
      await new Promise(r => setTimeout(r, ms))
      return await next()
    }

    case 'condition': {
      const variable = String(session.variables[node.data.variable as string] || '')
      const op = node.data.operator as string
      const val = node.data.value as string || ''
      let result = false

      if (op === 'equals')      result = variable === val
      else if (op === 'contains')   result = variable.toLowerCase().includes(val.toLowerCase())
      else if (op === 'starts_with') result = variable.toLowerCase().startsWith(val.toLowerCase())
      else if (op === 'not_empty')  result = !!variable

      const edge = edges.find(e => e.source === node.id && e.label === (result ? 'true' : 'false'))
        || edges.find(e => e.source === node.id)

      if (edge) {
        const nextNode = nodes.find(n => n.id === edge.target)
        if (nextNode) {
          await db.from('chatbot_sessions').update({ current_node_id: nextNode.id }).eq('id', session.id)
          return await executeNode(nextNode, session, flow, instance)
        }
      }
      return false
    }

    case 'tag': {
      const tags = (node.data.tags as string[]) || []
      if (tags.length) {
        const { data: contact } = await db.from('contacts')
          .select('tags').eq('phone', session.contact_phone).eq('user_id', session.user_id).maybeSingle()
        if (contact) {
          const existing = contact.tags || []
          const merged = existing.concat(tags).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
          await db.from('contacts').update({ tags: merged })
            .eq('phone', session.contact_phone).eq('user_id', session.user_id)
        }
      }
      return await next()
    }

    case 'assign': {
      const assignedTo = node.data.assigned_to as string
      if (assignedTo) {
        const { data: contact } = await db.from('contacts')
          .select('id').eq('phone', session.contact_phone).maybeSingle()
        if (contact) {
          await db.from('conversation_assignments').upsert({
            owner_id: session.user_id,
            contact_id: contact.id,
            assigned_to: assignedTo,
            status: 'open',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'owner_id,contact_id' })
        }
      }
      return await next()
    }

    case 'end': {
      await db.from('chatbot_sessions').update({ is_active: false }).eq('id', session.id)
      return false // end = let AI take over if needed
    }

    default:
      return await next()
  }
}

// ─────────────────────────────────────────────────────────
// Send a message — returns true if sent successfully
// ─────────────────────────────────────────────────────────

async function sendMsg(node: ChatbotNode, session: Session, instance: Record<string, unknown>): Promise<boolean> {
  let text = (node.data.text || node.data.message || node.data.question || '') as string

  // Build buttons text
  if (node.type === 'buttons') {
    const buttons = (node.data.buttons as Array<{ text: string }>) || []
    if (buttons.length) {
      text = `${text}\n\n${buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}`
    }
  }

  if (!text.trim()) return false

  // Replace {{variables}}
  for (const [key, val] of Object.entries(session.variables)) {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val))
  }

  try {
    const db = supabaseAdmin()
    // Support both instance_type and type column names
    const instType = (instance.instance_type || instance.type || 'cloud_api') as string
    let waMessageId = ''

    if (instType === 'wa_web' || instType === 'baileys') {
      const r = await sendWAWebMessage({ instanceId: instance.id as string, to: session.contact_phone, text })
      waMessageId = r?.messageId || ''
    } else {
      const r: SmartSendResult = await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id as string, accessToken: instance.access_token as string, to: session.contact_phone, text: text, source: 'chatbot' as any })
      waMessageId = r.messageId || ''
    }

    await db.from('messages').insert({
      id: uuidv4(),
      user_id: session.user_id,
      instance_id: instance.id,
      direction: 'outbound',
      type: 'text',
      content: text,
      wa_message_id: waMessageId,
      status: 'sent',
    })

    return true
  } catch (err) {
    console.error('[CHATBOT] send error:', err)
    return false
  }
}
