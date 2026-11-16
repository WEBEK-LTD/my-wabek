import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buttonEdge, conditionEdge, evaluateCondition, firstEdge, matchButton, nodeMessageText, renderFlowText,
} from '@/lib/chatbot-engine'

interface FlowNode {
  id: string
  type: string
  data: Record<string, any>
}
interface FlowEdge {
  source: string
  target: string
  label?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireMemberAccess(req, res, 'chatbot', { write: false })
  if (!user) return

  const { flow_id, message } = req.body || {}
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message required' })

  let nodes: FlowNode[] = req.body.nodes
  let edges: FlowEdge[] = req.body.edges
  let triggerKeywords: string[] = req.body.trigger_keywords
  let flowName = 'Flow'

  // If nodes/edges weren't provided directly (e.g. testing from the flow
  // list, not the live editor), load the saved version from the DB.
  if (!Array.isArray(nodes)) {
    if (!flow_id) return res.status(400).json({ error: 'flow_id or nodes required' })
    const db = supabaseAdmin()
    const { data: flow } = await db.from('chatbot_flows')
      .select('id, name, nodes, edges, trigger_keywords')
      .eq('id', flow_id)
      .eq('user_id', user.userId)
      .single()

    if (!flow) return res.status(404).json({ error: 'Flow not found' })
    nodes = flow.nodes || []
    edges = flow.edges || []
    triggerKeywords = flow.trigger_keywords || []
    flowName = flow.name
  }
  edges = edges || []
  triggerKeywords = triggerKeywords || []

  if (!nodes.length) {
    return res.status(200).json({ response: '(This flow has no nodes yet)', triggered_nodes: [], triggered: false })
  }

  // Simulated session, round-tripped by the tester UI: where the flow paused
  // (question / buttons) and the collected variables — the same state the
  // real engine keeps in chatbot_sessions.
  const rawState = req.body?.state
  const stateVars: Record<string, unknown> = {}
  if (rawState && typeof rawState === 'object' && rawState.variables && typeof rawState.variables === 'object') {
    for (const [k, v] of Object.entries(rawState.variables as Record<string, unknown>).slice(0, 50)) {
      if (/^[\w.-]{1,60}$/.test(k) && (typeof v === 'string' || typeof v === 'number')) stateVars[k] = String(v).slice(0, 1000)
    }
  }
  const variables: Record<string, unknown> = { name: 'Test User', phone: '+1234567890', ...stateVars }
  const pausedId = rawState && typeof rawState.node_id === 'string' ? rawState.node_id : null
  const paused = pausedId ? nodes.find(n => n.id === pausedId && (n.type === 'question' || n.type === 'buttons')) : undefined

  const responses: string[] = []
  const triggeredNodes: string[] = []
  const byId = (id?: string) => (id ? nodes.find(n => n.id === id) : undefined)
  const say = (node: FlowNode) => {
    const text = nodeMessageText({ type: node.type, data: node.data || {} })
    if (text.trim()) responses.push(renderFlowText(text, variables))
  }
  const reply = (state: { node_id: string } | null) => {
    const response = responses.length ? responses.join('\n\n') : '(Flow triggered but produced no message — check that your nodes are connected and have text)'
    return res.status(200).json({
      response,
      triggered_nodes: triggeredNodes,
      triggered: true,
      flow_name: flowName,
      // Send back as `state` with the next message to continue the conversation.
      state: state ? { ...state, variables } : null,
    })
  }

  let current: FlowNode | undefined

  if (paused) {
    // Continue a paused run with this message as the user's answer (continueFlow).
    if (paused.type === 'question') {
      const varName = (paused.data?.variable as string) || 'answer'
      variables[varName] = message
      triggeredNodes.push(`Answer saved as {{${varName}}}`)
      current = byId(firstEdge(edges, paused.id)?.target)
    } else {
      const buttons = (paused.data?.buttons as Array<{ id?: string; text: string }>) || []
      const matched = matchButton(buttons, message)
      triggeredNodes.push(matched ? `Button: ${matched.text}` : 'Button: (no match)')
      current = byId(buttonEdge(edges, paused.id, matched)?.target)
      if (!current) {
        // The engine re-sends the buttons and keeps waiting.
        say(paused)
        return reply({ node_id: paused.id })
      }
    }
    if (!current) return reply(null)
  } else {
    // 1. Check trigger keywords (empty = matches any message)
    const msgLower = message.toLowerCase()
    const triggered = triggerKeywords.length === 0 ||
      triggerKeywords.some((kw: string) => msgLower.includes(kw.toLowerCase().trim()))

    if (!triggered) {
      return res.status(200).json({
        response: `No trigger matched. This flow triggers on: ${triggerKeywords.join(', ') || 'any message'}`,
        triggered_nodes: [],
        triggered: false,
        state: null,
      })
    }

    // 2. Start like the engine: "start" (or the first node); a Start with no
    //    edge runs the only other node directly.
    current = nodes.find(n => n.type === 'start') || nodes[0]
    if (current?.type === 'start') {
      const startEdge = firstEdge(edges, current.id)
      if (!startEdge) {
        const others = nodes.filter(n => n.id !== current!.id)
        current = others.length === 1 ? others[0] : undefined
        if (!current) {
          return res.status(200).json({
            response: others.length === 0
              ? '(Flow only has a Start node — add a Message node)'
              : '(Start node has no connection — draw a line from Start to your first node, or use exactly one node total)',
            triggered_nodes: [],
            triggered: true,
            flow_name: flowName,
            state: null,
          })
        }
      } else {
        current = byId(startEdge.target)
      }
    }
  }

  // 3. Walk the graph with the engine's branch selection (executeNode):
  //    conditions take their true/false edge, question/buttons pause.
  const visited = new Set<string>()
  let steps = 0
  while (current && !visited.has(current.id) && steps++ < 25) {
    visited.add(current.id)
    const node: FlowNode = current
    const type = node.type
    let nextEdge: FlowEdge | undefined = firstEdge(edges, node.id)

    if (type === 'message') {
      say(node)
      triggeredNodes.push(node.data?.label || type)
    } else if (type === 'end') {
      say(node)
      triggeredNodes.push('End')
      return reply(null)
    } else if (type === 'question') {
      say(node)
      triggeredNodes.push('Question (waits for reply)')
      return reply({ node_id: node.id })
    } else if (type === 'buttons') {
      say(node)
      triggeredNodes.push('Buttons (waits for reply)')
      return reply({ node_id: node.id })
    } else if (type === 'delay') {
      triggeredNodes.push(`Delay ${node.data?.seconds || 1}s`)
    } else if (type === 'condition') {
      const result = evaluateCondition(node.data || {}, variables)
      triggeredNodes.push(`Condition: ${node.data?.variable} ${node.data?.operator} ${node.data?.value ?? ''} → ${result ? 'true' : 'false'}`)
      nextEdge = conditionEdge(edges, node.id, result)
    } else if (type === 'tag') {
      triggeredNodes.push(`Tag: ${(node.data?.tags || []).join(', ')}`)
    } else if (type === 'assign') {
      triggeredNodes.push(`Assign to: ${node.data?.assigned_to || '(unassigned)'}`)
    }

    current = byId(nextEdge?.target)
  }

  return reply(null)
}
