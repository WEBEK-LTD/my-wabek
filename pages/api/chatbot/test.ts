import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

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
  const user = await requireAuth(req, res)
  if (!user) return

  const { flow_id, message } = req.body
  if (!message) return res.status(400).json({ error: 'message required' })

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

  // 1. Check trigger keywords (empty = matches any message)
  const msgLower = message.toLowerCase()
  const triggered = triggerKeywords.length === 0 ||
    triggerKeywords.some((kw: string) => msgLower.includes(kw.toLowerCase().trim()))

  if (!triggered) {
    return res.status(200).json({
      response: `No trigger matched. This flow triggers on: ${triggerKeywords.join(', ') || 'any message'}`,
      triggered_nodes: [],
      triggered: false,
    })
  }

  // 2. Walk the graph starting from "start" (or first node), following
  // edges — same logic as the real chatbot engine (v505/v506):
  //   - If "start" has no outgoing edge but there's exactly one other node,
  //     run that node directly.
  //   - Otherwise follow edges until a node with no outgoing edge,
  //     "question", or "buttons" (which pause for user input).
  const startNode = nodes.find(n => n.type === 'start') || nodes[0]
  const responses: string[] = []
  const triggeredNodes: string[] = []
  const visited = new Set<string>()

  const renderText = (text: string): string =>
    text.replace(/\{\{name\}\}/gi, 'Test User').replace(/\{\{phone\}\}/gi, '+1234567890')

  let current: FlowNode | undefined = startNode

  // Handle "start has no edge, exactly one other node" auto-run case
  if (current?.type === 'start') {
    const hasEdge = edges.some(e => e.source === current!.id)
    if (!hasEdge) {
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
        })
      }
    } else {
      const edge = edges.find(e => e.source === current!.id)
      current = nodes.find(n => n.id === edge!.target)
    }
  }

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const type = current.type

    if (type === 'message' || type === 'end') {
      const text = current.data?.text || current.data?.message || ''
      if (text) {
        responses.push(renderText(text))
        triggeredNodes.push(current.data?.label || type)
      }
      if (type === 'end') break
    } else if (type === 'question') {
      const text = current.data?.question || ''
      if (text) responses.push(renderText(text))
      triggeredNodes.push('Question (waits for reply)')
      break // pauses for user input
    } else if (type === 'buttons') {
      const text = current.data?.text || ''
      const buttons = (current.data?.buttons as Array<{ text: string }>) || []
      let out = text
      if (buttons.length) out += '\n\n' + buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n')
      if (out.trim()) responses.push(renderText(out))
      triggeredNodes.push('Buttons (waits for reply)')
      break // pauses for user input
    } else if (type === 'delay') {
      triggeredNodes.push(`Delay ${current.data?.seconds || 1}s`)
    } else if (type === 'condition') {
      triggeredNodes.push(`Condition: ${current.data?.variable} ${current.data?.operator} ${current.data?.value}`)
    } else if (type === 'tag') {
      triggeredNodes.push(`Tag: ${(current.data?.tags || []).join(', ')}`)
    } else if (type === 'assign') {
      triggeredNodes.push(`Assign to: ${current.data?.assigned_to || '(unassigned)'}`)
    }

    const edge = edges.find(e => e.source === current!.id)
    current = edge ? nodes.find(n => n.id === edge.target) : undefined
  }

  const response = responses.length ? responses.join('\n\n') : '(Flow triggered but produced no message — check that your nodes are connected and have text)'

  return res.status(200).json({
    response,
    triggered_nodes: triggeredNodes,
    triggered: true,
    flow_name: flowName,
  })
}
