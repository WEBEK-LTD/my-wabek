/**
 * AI Quality Review Engine
 * Uses DeepSeek (default) to analyze conversations and score team members.
 * READ-ONLY: never sends messages or interacts with customers.
 */

import { supabaseAdmin } from './supabase'
import { v4 as uuidv4 } from 'uuid'

// JSONB values come back as JSON strings — strip outer quotes
function jsonVal(v: string | undefined): string {
  if (!v) return ''
  try { return JSON.parse(v) } catch { return v }
}

interface AISettings {
  provider: string
  apiKey: string
  maxMessages: number
  enabled: boolean
}

// Load AI settings from system_settings table (not env vars)
async function getAISettings(): Promise<AISettings | null> {
  const db = supabaseAdmin()
  const { data } = await db.from('system_settings')
    .select('key, value')
    .in('key', ['ai_provider', 'ai_deepseek_api_key', 'ai_reviews_enabled', 'ai_max_messages'])

  const s: Record<string, string> = {}
  for (const row of data || []) s[row.key] = row.value

  if (jsonVal(s['ai_reviews_enabled']) !== 'true') return null
  if (!jsonVal(s['ai_deepseek_api_key'])) return null

  return {
    provider:    jsonVal(s['ai_provider']) || 'deepseek',
    apiKey:      jsonVal(s['ai_deepseek_api_key']),
    maxMessages: parseInt(jsonVal(s['ai_max_messages']) || '100'),
    enabled:     true,
  }
}

// Call DeepSeek API (swappable for other providers)
async function callAI(settings: AISettings, prompt: string): Promise<string> {
  const endpoints: Record<string, string> = {
    deepseek: 'https://api.deepseek.com/v1/chat/completions',
    openai:   'https://api.openai.com/v1/chat/completions',
  }
  const models: Record<string, string> = {
    deepseek: 'deepseek-chat',
    openai:   'gpt-4o-mini',
  }

  const endpoint = endpoints[settings.provider] || endpoints.deepseek
  const model    = models[settings.provider]    || models.deepseek

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI API error: ${response.status} ${err}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || '{}'
}

// Main review function — analyzes one conversation
export async function reviewConversation(
  ownerId: string,
  contactId: string,
  reviewVersion: number,
  messageRangeStart: string,
  messageRangeEnd: string
): Promise<void> {
  const db = supabaseAdmin()

  const settings = await getAISettings()
  if (!settings) {
    console.log('[ai-review] AI reviews disabled or no API key')
    return
  }

  // Fetch messages for this conversation session
  const { data: messages } = await db.from('messages')
    .select('direction, content, type, created_at, meta')
    .eq('user_id', ownerId)
    .eq('contact_id', contactId)
    .gte('created_at', messageRangeStart)
    .lte('created_at', messageRangeEnd)
    .order('created_at', { ascending: true })
    .limit(settings.maxMessages)

  if (!messages || messages.length < 2) {
    console.log('[ai-review] Not enough messages to review')
    return
  }

  // Get contact info
  const { data: contact } = await db.from('contacts')
    .select('name, phone').eq('id', contactId).maybeSingle()

  // Build member map from meta.sent_by
  const memberIds = [...new Set(
    messages
      .filter(m => m.direction === 'outbound' && (m.meta as any)?.sent_by)
      .map(m => (m.meta as any).sent_by)
  )] as string[]

  if (memberIds.length === 0) {
    console.log('[ai-review] No tracked member messages found')
    return
  }

  // Get member names
  const { data: memberUsers } = await db.from('users')
    .select('id, name, email').in('id', memberIds)
  const memberMap: Record<string, string> = {}
  for (const u of memberUsers || []) {
    memberMap[u.id] = u.name || u.email || u.id
  }

  // Format conversation for AI
  const convoText = messages.map(m => {
    const who = m.direction === 'inbound'
      ? `Customer (${contact?.name || contact?.phone || 'Unknown'})`
      : `Agent (${memberMap[(m.meta as any)?.sent_by] || 'Unknown'})`
    const time = new Date(m.created_at).toLocaleTimeString()
    return `[${time}] ${who}: ${m.content || '[media]'}`
  }).join('\n')

  const membersList = memberIds.map(id => `- ${memberMap[id]} (ID: ${id})`).join('\n')

  const prompt = `You are a professional customer service quality analyst. Analyze this WhatsApp conversation and provide detailed feedback for each agent who participated.

CONVERSATION:
${convoText}

AGENTS WHO PARTICIPATED:
${membersList}

Return a JSON object with this exact structure:
{
  "overall_summary": "Brief summary of the conversation outcome",
  "overall_score": 7.5,
  "members": [
    {
      "member_user_id": "exact_id_here",
      "member_name": "Agent Name",
      "messages_count": 5,
      "score_overall": 8.5,
      "score_accuracy": 9.0,
      "score_professionalism": 8.0,
      "score_clarity": 8.5,
      "score_empathy": 7.0,
      "score_helpfulness": 9.0,
      "score_completeness": 8.0,
      "score_grammar": 9.0,
      "score_sales": 7.0,
      "score_compliance": 9.0,
      "strengths": ["Fast response time", "Professional tone"],
      "issues": ["Did not follow up on customer concern", "Response was unclear"],
      "suggested_reply": "Here is a better way to handle this situation: ...",
      "coaching_notes": "Focus on asking clarifying questions and ensuring the customer feels heard."
    }
  ]
}

Scoring criteria (0-10):
- accuracy: Correctness of information provided
- professionalism: Tone, language, and conduct
- clarity: How clear and understandable the responses are
- empathy: Understanding and acknowledging customer feelings
- helpfulness: Did they actually solve the problem?
- completeness: Did they address all customer questions?
- grammar: Language quality and spelling
- sales: Missed upsell or cross-sell opportunities
- compliance: Following company policies and best practices

Be specific, constructive, and fair. Base everything ONLY on what appears in the conversation.`

  let reviewId: string

  try {
    // Create review record
    const { data: review, error: reviewErr } = await db.from('ai_reviews').insert({
      id: uuidv4(),
      owner_id: ownerId,
      contact_id: contactId,
      conversation_key: `${ownerId}:${contactId}`,
      review_version: reviewVersion,
      message_range_start: messageRangeStart,
      message_range_end: messageRangeEnd,
      message_count: messages.length,
      status: 'processing',
      ai_provider: settings.provider,
    }).select().single()

    if (reviewErr || !review) throw new Error(reviewErr?.message || 'Failed to create review')
    reviewId = review.id

    // Call AI
    const rawResponse = await callAI(settings, prompt)
    const parsed = JSON.parse(rawResponse)

    // Save member review items
    for (const memberReview of parsed.members || []) {
      await db.from('ai_review_items').insert({
        id: uuidv4(),
        review_id: reviewId,
        owner_id: ownerId,
        member_user_id: memberReview.member_user_id || null,
        member_name: memberReview.member_name,
        messages_count: memberReview.messages_count || 0,
        score_overall:         memberReview.score_overall,
        score_accuracy:        memberReview.score_accuracy,
        score_professionalism: memberReview.score_professionalism,
        score_clarity:         memberReview.score_clarity,
        score_empathy:         memberReview.score_empathy,
        score_helpfulness:     memberReview.score_helpfulness,
        score_completeness:    memberReview.score_completeness,
        score_grammar:         memberReview.score_grammar,
        score_sales:           memberReview.score_sales,
        score_compliance:      memberReview.score_compliance,
        strengths:             memberReview.strengths || [],
        issues:                memberReview.issues || [],
        suggested_reply:       memberReview.suggested_reply || null,
        coaching_notes:        memberReview.coaching_notes || null,
      })
    }

    // Update review as completed
    await db.from('ai_reviews').update({
      overall_summary: parsed.overall_summary,
      overall_score:   parsed.overall_score,
      status:          'completed',
      reviewed_at:     new Date().toISOString(),
    }).eq('id', reviewId)

    // Update daily usage counter
    const today = new Date().toISOString().split('T')[0]
    const usageKey = `ai_usage_${today}`
    const { data: usage } = await db.from('system_settings').select('value').eq('key', usageKey).maybeSingle()
    const newCount = parseInt(jsonVal(usage?.value) || '0') + 1
    await db.from('system_settings').upsert({ key: usageKey, value: JSON.stringify(String(newCount)) })

    console.log(`[ai-review] ✅ Review completed for contact ${contactId}, version ${reviewVersion}`)
  } catch (err: any) {
    console.error('[ai-review] ❌ Review failed:', err?.message)
    if (reviewId!) {
      await db.from('ai_reviews').update({ status: 'failed' }).eq('id', reviewId!)
    }
  }
}

// Called by the hourly scheduler
export async function runScheduledReviews(): Promise<void> {
  const db = supabaseAdmin()

  const settings = await getAISettings()
  if (!settings) return

  // Check daily limit
  const today = new Date().toISOString().split('T')[0]
  const { data: usageRow } = await db.from('system_settings')
    .select('value').eq('key', `ai_usage_${today}`).maybeSingle()
  const { data: limitRow } = await db.from('system_settings')
    .select('value').eq('key', 'ai_daily_limit').maybeSingle()
  const dailyUsage = parseInt(jsonVal(usageRow?.value) || '0')
  const dailyLimit = parseInt(jsonVal(limitRow?.value) || '500')
  if (dailyUsage >= dailyLimit) {
    console.log(`[ai-review] Daily limit reached (${dailyUsage}/${dailyLimit})`)
    return
  }

  // Get inactivity threshold
  const { data: inactivityRow } = await db.from('system_settings')
    .select('value').eq('key', 'ai_inactivity_hours').maybeSingle()
  const inactivityHours = parseFloat(jsonVal(inactivityRow?.value) || '2')
  const cutoff = new Date(Date.now() - inactivityHours * 60 * 60 * 1000).toISOString()

  // Find conversations ready for review
  const { data: convs } = await db.from('conversation_assignments')
    .select('id, owner_id, contact_id, last_activity')
    .eq('review_status', 'active')
    .lt('last_activity', cutoff)
    .limit(50)  // process max 50 per run to avoid overload

  console.log(`[ai-review] Found ${convs?.length || 0} conversations to review`)

  for (const conv of convs || []) {
    // Mark as reviewing to prevent double-processing
    await db.from('conversation_assignments')
      .update({ review_status: 'reviewing' })
      .eq('id', conv.id)

    // Get review version (how many previous reviews exist)
    const { count } = await db.from('ai_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', conv.owner_id)
      .eq('contact_id', conv.contact_id)
    const reviewVersion = (count || 0) + 1

    // Get message range for this session
    // Find last reviewed_at to know where previous review ended
    const { data: lastReview } = await db.from('ai_reviews')
      .select('message_range_end')
      .eq('owner_id', conv.owner_id)
      .eq('contact_id', conv.contact_id)
      .order('review_version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const rangeStart = lastReview?.message_range_end || '2000-01-01T00:00:00.000Z'
    const rangeEnd   = conv.last_activity

    await reviewConversation(
      conv.owner_id,
      conv.contact_id,
      reviewVersion,
      rangeStart,
      rangeEnd
    )

    // Mark as reviewed
    await db.from('conversation_assignments')
      .update({
        review_status:    'reviewed',
        last_reviewed_at: new Date().toISOString(),
      })
      .eq('id', conv.id)
  }
}
