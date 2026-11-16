import { smartSend, smartSendWAWeb, SmartSendResult } from '@/lib/wa-smart-send'
import { supabaseAdmin } from './supabase'
import { isValidAssignee, saveConversationAssignment } from './inbox-access'
import { emitWebhookEvent } from './outgoing-webhooks'
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
// Branch selection (pure; shared with the flow tester /api/chatbot/test)
// ─────────────────────────────────────────────────────────

type EdgeLike = { source: string; target: string; label?: string }
export type ChatbotButton = { id?: string; text: string }

/** First outgoing edge of a node (unlabelled flow). */
export function firstEdge<E extends EdgeLike>(edges: E[], nodeId: string): E | undefined {
  return edges.find(e => e.source === nodeId)
}

/** Result of a condition node against the session variables. */
export function evaluateCondition(data: Record<string, unknown>, variables: Record<string, unknown>): boolean {
  const variable = String(variables[data.variable as string] || '')
  const op = data.operator as string
  const val = (data.value as string) || ''
  if (op === 'equals') return variable === val
  if (op === 'contains') return variable.toLowerCase().includes(val.toLowerCase())
  if (op === 'starts_with') return variable.toLowerCase().startsWith(val.toLowerCase())
  if (op === 'not_empty') return !!variable
  return false
}

/** Edge labelled 'true' / 'false' for the result, else the first edge. */
export function conditionEdge<E extends EdgeLike>(edges: E[], nodeId: string, result: boolean): E | undefined {
  return edges.find(e => e.source === nodeId && e.label === (result ? 'true' : 'false')) || firstEdge(edges, nodeId)
}

/** The button the user picked: by text (case-insensitive), id, or its 1-based number. */
export function matchButton<B extends ChatbotButton>(buttons: B[], input: string): B | undefined {
  return buttons.find((b, i) =>
    String(b.text || '').toLowerCase() === input.toLowerCase() ||
    (b.id !== undefined && b.id === input) ||
    String(i + 1) === input
  )
}

/** Edge labelled with the picked button's text or id, else the first edge. */
export function buttonEdge<E extends EdgeLike>(edges: E[], nodeId: string, matched: ChatbotButton | undefined): E | undefined {
  return matched
    ? edges.find(e => e.source === nodeId && (e.label === matched.text || (matched.id !== undefined && e.label === matched.id))) || firstEdge(edges, nodeId)
    : firstEdge(edges, nodeId)
}

/** Replace {{variable}} placeholders with session variables. */
export function renderFlowText(text: string, variables: Record<string, unknown>): string {
  let out = text
  for (const [key, val] of Object.entries(variables)) {
    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(new RegExp(`\\{\\{${safeKey}\\}\\}`, 'gi'), String(val))
  }
  return out
}

/** Message text of a node as sent (buttons are listed as numbered options). */
export function nodeMessageText(node: { type: string; data: Record<string, unknown> }): string {
  let text = (node.data.text || node.data.message || node.data.question || '') as string
  if (node.type === 'buttons') {
    const buttons = (node.data.buttons as Array<{ text: string }>) || []
    if (buttons.length) text = `${text}\n\n${buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}`
  }
  return text
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
  contactId?: string | null
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

    // `first_message` flows only run on the contact's first ever inbound
    // message to this instance (the current message is already stored).
    let firstInbound: boolean | null = null
    const isFirstInbound = async (): Promise<boolean> => {
      if (firstInbound !== null) return firstInbound
      firstInbound = await isFirstInboundMessage(userId, instanceId, from, params.contactId)
      return firstInbound
    }
    const candidates: typeof eligible = []
    for (const flow of eligible) {
      if (flow.trigger_type === 'first_message' && !(await isFirstInbound())) continue
      candidates.push(flow)
    }

    // First: try keyword match (more specific)
    for (const flow of candidates) {
      const keywords: string[] = flow.trigger_keywords || []
      if (keywords.length > 0) {
        const hit = keywords.some(k => msgLower.includes(k.toLowerCase().trim()))
        if (hit) { matched = flow; break }
      }
    }

    // Second: a first_message flow (when this is the first message), then
    // any_message — ONLY if no keyword matched
    if (!matched) {
      matched = candidates.find(f => f.trigger_type === 'first_message' && !(f.trigger_keywords || []).length) || null
    }
    if (!matched) {
      for (const flow of candidates) {
        const keywords: string[] = flow.trigger_keywords || []
        if (keywords.length === 0 && flow.trigger_type !== 'first_message') {
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

    await emitWebhookEvent(userId, 'chatbot_triggered', {
      flow_id: matched.id, flow_name: matched.name, trigger_type: matched.trigger_type || null,
      from, instance_id: instanceId, message,
    })

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
    const matched = matchButton(buttons, userInput)
    const edge = buttonEdge(edges, currentNode.id, matched)

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

  // No further node to go to — the flow has ended. Deactivate this session
  // so the NEXT incoming message starts fresh via flow matching (step 2-6),
  // instead of being silently swallowed here forever.
  await db.from('chatbot_sessions').update({ is_active: false }).eq('id', sessionData.id)
  return false
}

// ─────────────────────────────────────────────────────────
// Execute a single node — returns true if a message was sent
// ─────────────────────────────────────────────────────────

// Guards against misconfigured / malicious flows: a single inbound message may
// execute at most MAX_STEPS_PER_RUN nodes, never the same node twice (no input
// is awaited inside a run, so a revisit is always a loop), and sleep at most
// MAX_DELAY_MS_PER_RUN in total.
const MAX_STEPS_PER_RUN = 25
const MAX_DELAY_MS_PER_RUN = 15000

interface RunContext { steps: number; visited: Set<string>; delayMs: number }
const newRun = (): RunContext => ({ steps: 0, visited: new Set<string>(), delayMs: 0 })

async function executeNode(
  node: ChatbotNode,
  session: Session,
  flow: Record<string, unknown>,
  instance: Record<string, unknown>,
  run: RunContext = newRun()
): Promise<boolean> {
  const db = supabaseAdmin()
  const edges: ChatbotEdge[] = (flow.edges as ChatbotEdge[]) || []
  const nodes: ChatbotNode[] = (flow.nodes as ChatbotNode[]) || []

  run.steps++
  if (run.steps > MAX_STEPS_PER_RUN || run.visited.has(node.id)) {
    console.warn(`[CHATBOT] run aborted flow=${String(flow.id)} node=${node.id} steps=${run.steps} (loop or step limit)`)
    await db.from('chatbot_sessions').update({ is_active: false }).eq('id', session.id)
    return false
  }
  run.visited.add(node.id)

  const next = async (): Promise<boolean> => {
    const edge = edges.find(e => e.source === node.id)
    if (!edge) return false
    const nextNode = nodes.find(n => n.id === edge.target)
    if (!nextNode) return false
    await db.from('chatbot_sessions').update({ current_node_id: nextNode.id }).eq('id', session.id)
    return await executeNode(nextNode, session, flow, instance, run)
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
          return await executeNode(others[0], session, flow, instance, run)
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
      const secs = Number(node.data.seconds) || 1
      const requested = Math.max(0, Math.min(secs * 1000, 10000))
      const ms = Math.min(requested, Math.max(0, MAX_DELAY_MS_PER_RUN - run.delayMs))
      run.delayMs += ms
      if (ms > 0) await new Promise(r => setTimeout(r, ms))
      return await next()
    }

    case 'condition': {
      const result = evaluateCondition(node.data, session.variables)
      const edge = conditionEdge(edges, node.id, result)

      if (edge) {
        const nextNode = nodes.find(n => n.id === edge.target)
        if (nextNode) {
          await db.from('chatbot_sessions').update({ current_node_id: nextNode.id }).eq('id', session.id)
          return await executeNode(nextNode, session, flow, instance, run)
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
          .select('id').eq('phone', session.contact_phone).eq('user_id', session.user_id).maybeSingle()
        // The assignee must be the owner or one of the owner's team members
        const assigneeOk = await isValidAssignee(db, session.user_id, assignedTo)
        if (contact && assigneeOk) {
          const { error } = await saveConversationAssignment(db, {
            owner_id: session.user_id,
            contact_id: contact.id,
            instance_id: (instance.id as string) || null,
            assigned_to: assignedTo,
            status: 'open',
            updated_at: new Date().toISOString(),
          })
          if (error) console.error('[CHATBOT] assign failed:', error.message)
        }
      }
      return await next()
    }

    case 'end': {
      // Optional closing message (the editor's "رسالة ختامية").
      const sent = await sendMsg(node, session, instance)
      await db.from('chatbot_sessions').update({ is_active: false }).eq('id', session.id)
      return sent // nothing sent → let AI take over if needed
    }

    default:
      return await next()
  }
}

// ─────────────────────────────────────────────────────────
// Send a message — returns true if sent successfully
// ─────────────────────────────────────────────────────────

async function sendMsg(node: ChatbotNode, session: Session, instance: Record<string, unknown>): Promise<boolean> {
  // Buttons are listed as numbered options; {{variables}} are filled in.
  const raw = nodeMessageText(node)
  if (!raw.trim()) return false
  const text = renderFlowText(raw, session.variables)

  try {
    const db = supabaseAdmin()
    // Support both instance_type and type column names
    const instType = (instance.instance_type || instance.type || 'cloud_api') as string
    let waMessageId = ''

    if (instType === 'wa_web' || instType === 'baileys') {
      // Guarded send (plan limit / opt-out); smartSendWAWeb persists the row.
      const r = await smartSendWAWeb({ userId: session.user_id, instanceId: instance.id as string, to: session.contact_phone, text, source: 'chatbot' })
      if (r.error && !r.messageId) return false
      waMessageId = r.messageId || ''
    } else {
      const r: SmartSendResult = await smartSend({ userId: (instance as any)?.user_id || (instance as any)?.userId || '', instanceId: (instance as any)?.id || '', phoneNumberId: instance.phone_number_id as string, accessToken: instance.access_token as string, to: session.contact_phone, text: text, source: 'chatbot' as any })
      if (r.error && !r.messageId) return false
      waMessageId = r.messageId || ''
      // NOTE: smartSend already inserts the outbound `messages` row
      // (with wa_message_id dedup + meta.source='chatbot') — do not
      // insert again here, that previously caused duplicate rows.
    }

    return true
  } catch (err) {
    console.error('[CHATBOT] send error:', err)
    return false
  }
}

/**
 * True when the contact has at most one inbound message on this instance
 * (the message being processed, already stored by the webhook).
 */
async function isFirstInboundMessage(userId: string, instanceId: string, phone: string, contactId?: string | null): Promise<boolean> {
  try {
    const db = supabaseAdmin()
    let ids: string[] = contactId ? [contactId] : []
    if (!ids.length) {
      const digits = String(phone || '').replace(/[^0-9]/g, '')
      const { data: rows } = await db.from('contacts').select('id').eq('user_id', userId)
        .in('phone', Array.from(new Set([phone, digits, `+${digits}`].filter(Boolean)))).limit(5)
      ids = (rows || []).map(r => r.id)
    }
    if (!ids.length) return true
    const { count, error } = await db.from('messages').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('instance_id', instanceId).eq('direction', 'inbound').in('contact_id', ids)
    if (error || count === null) return false
    return count <= 1
  } catch {
    return false
  }
}
