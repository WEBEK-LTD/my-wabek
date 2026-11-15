import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res)
  if (!user) return
  const db = supabaseAdmin()
  const isOwner = !user.actualUserId
  const ownerId = user.userId

  // ── GET: fetch reviews ───────────────────────────────────
  if (req.method === 'GET') {
    const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20))
    const limit = String(limitNum)
    const offset = (pageNum - 1) * limitNum
    // Aggregates are computed over the most recent items only
    const STATS_SAMPLE = 1000

    if (isOwner) {
      // Owner sees all reviews
      const { data: reviews, count } = await db.from('ai_reviews')
        .select(`
          id, conversation_key, review_version, overall_summary, overall_score,
          status, created_at, reviewed_at, message_count, message_range_start, message_range_end,
          contacts(id, name, phone),
          ai_review_items(
            id, member_user_id, member_name, messages_count,
            score_overall, score_accuracy, score_professionalism, score_clarity,
            score_empathy, score_helpfulness, score_completeness, score_grammar,
            score_sales, score_compliance,
            strengths, issues, suggested_reply, coaching_notes,
            manual_comment, manual_comment_at, created_at
          )
        `, { count: 'exact' })
        .eq('owner_id', ownerId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1)

      // Stats for owner dashboard
      const { data: stats } = await db.from('ai_review_items')
        .select('member_user_id, member_name, score_overall, issues, strengths')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(STATS_SAMPLE)

      const memberStats: Record<string, any> = {}
      for (const item of stats || []) {
        const mid = item.member_user_id || 'unknown'
        if (!memberStats[mid]) memberStats[mid] = {
          member_user_id: mid,
          member_name: item.member_name,
          scores: [], issues: [], strengths: [],
        }
        if (item.score_overall) memberStats[mid].scores.push(item.score_overall)
        if (item.issues) memberStats[mid].issues.push(...item.issues)
        if (item.strengths) memberStats[mid].strengths.push(...item.strengths)
      }

      const memberSummary = Object.values(memberStats).map((m: any) => ({
        member_user_id: m.member_user_id,
        member_name: m.member_name,
        avg_score: m.scores.length > 0
          ? Math.round((m.scores.reduce((a: number, b: number) => a + b, 0) / m.scores.length) * 10) / 10
          : null,
        review_count: m.scores.length,
        top_issues: getTopN(m.issues, 5),
        top_strengths: getTopN(m.strengths, 5),
      })).sort((a: any, b: any) => (b.avg_score || 0) - (a.avg_score || 0))

      return res.status(200).json({ reviews, total: count, member_summary: memberSummary })
    } else {
      // Member sees only their own review items
      const memberId = user.actualUserId!
      const { data: items, count } = await db.from('ai_review_items')
        .select(`
          id, member_name, messages_count,
          score_overall, score_accuracy, score_professionalism, score_clarity,
          score_empathy, score_helpfulness, score_completeness, score_grammar,
          score_sales, score_compliance,
          strengths, issues, suggested_reply, coaching_notes,
          manual_comment, manual_comment_at, created_at,
          ai_reviews(id, overall_summary, message_count, message_range_start, message_range_end, reviewed_at,
            contacts(name, phone))
        `, { count: 'exact' })
        .eq('owner_id', ownerId)
        .eq('member_user_id', memberId)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit as string) - 1)

      // Member stats
      const { data: allItems } = await db.from('ai_review_items')
        .select('score_overall, score_professionalism, score_clarity, score_empathy, issues, strengths, created_at')
        .eq('owner_id', ownerId)
        .eq('member_user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(STATS_SAMPLE)
      allItems?.reverse() // chronological for the trend

      const scores = (allItems || []).map(i => i.score_overall).filter(Boolean)
      const avgScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null

      // Trend: last 10 scores
      const trend = (allItems || []).slice(-10).map(i => ({
        date: i.created_at,
        score: i.score_overall,
      }))

      return res.status(200).json({
        items,
        total: count,
        stats: {
          avg_score: avgScore,
          review_count: scores.length,
          top_issues: getTopN((allItems || []).flatMap(i => i.issues || []), 5),
          top_strengths: getTopN((allItems || []).flatMap(i => i.strengths || []), 5),
          trend,
        },
      })
    }
  }

  // ── PUT: add manual comment ──────────────────────────────
  if (req.method === 'PUT') {
    if (!isOwner) return res.status(403).json({ error: 'Owner only' })
    const { item_id, manual_comment } = req.body || {}
    if (!item_id) return res.status(400).json({ error: 'item_id required' })
    const comment = manual_comment ? String(manual_comment).slice(0, 5000) : null

    const { data, error } = await db.from('ai_review_items')
      .update({ manual_comment: comment, manual_comment_at: new Date().toISOString() })
      .eq('id', String(item_id))
      .eq('owner_id', ownerId)
      .select().single()

    if (error) {
      console.error('[ai/reviews] update error:', error.message)
      return res.status(500).json({ error: 'Failed to save comment' })
    }
    return res.status(200).json({ item: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

function getTopN(arr: string[], n: number): { text: string; count: number }[] {
  const freq: Record<string, number> = {}
  for (const item of arr) {
    const key = item.trim().toLowerCase()
    freq[key] = (freq[key] || 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([text, count]) => ({ text, count }))
}
