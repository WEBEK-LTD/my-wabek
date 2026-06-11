import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  const { flow_id, message } = req.body
  if (!flow_id || !message) return res.status(400).json({ error: 'flow_id and message required' })

  const db = supabaseAdmin()
  const { data: flow } = await db.from('chatbot_flows')
    .select('id, name, nodes, edges, trigger_keywords')
    .eq('id', flow_id)
    .eq('user_id', user.userId)
    .single()

  if (!flow) return res.status(404).json({ error: 'Flow not found' })

  const nodes = flow.nodes || []
  const msgLower = message.toLowerCase()
  const triggeredNodes: string[] = []
  let response = ''

  // Check trigger keywords
  const keywords = flow.trigger_keywords || []
  const triggered = keywords.length === 0 ||
    keywords.some((kw: string) => msgLower.includes(kw.toLowerCase()))

  if (!triggered) {
    return res.status(200).json({
      response: `No trigger matched. This flow triggers on: ${keywords.join(', ') || 'any message'}`,
      triggered_nodes: [],
      triggered: false,
    })
  }

  // Walk through nodes and build response
  for (const node of nodes) {
    if (!node.data) continue
    const type = node.type || node.data.type

    if (type === 'message' || type === 'sendMessage') {
      const text = node.data.message || node.data.text || ''
      if (text) {
        response += (response ? '\n\n' : '') + text
        triggeredNodes.push(node.data.label || 'Message')
      }
    } else if (type === 'condition') {
      triggeredNodes.push(`Condition: ${node.data.condition || node.data.label || 'check'}`)
    } else if (type === 'ai') {
      response += (response ? '\n\n' : '') + `[AI Response would appear here based on: "${node.data.prompt || 'prompt'}"]`
      triggeredNodes.push('AI Node')
    } else if (type === 'delay') {
      triggeredNodes.push(`Delay: ${node.data.delay || 1}s`)
    } else if (type === 'button' || type === 'buttons') {
      const btns = node.data.buttons || []
      if (btns.length > 0) {
        response += (response ? '\n\n' : '') + 'Options:\n' + btns.map((b: { label?: string; text?: string }, i: number) => `${i + 1}. ${b.label || b.text}`).join('\n')
        triggeredNodes.push('Buttons')
      }
    }
  }

  if (!response) response = '(Flow triggered but no message nodes found)'

  return res.status(200).json({
    response,
    triggered_nodes: triggeredNodes,
    triggered: true,
    flow_name: flow.name,
  })
}
