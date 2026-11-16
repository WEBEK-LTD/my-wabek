import { NextApiRequest, NextApiResponse } from 'next'
import { requireCron } from '@/lib/security'
import { reconcileWAWebStatuses } from '@/lib/wa-web'

// POST /api/whatsapp/wa-web-reconcile — cron only (x-cron-secret).
// Marks QR numbers whose session is gone from the Baileys server as
// disconnected, so the dashboard asks for a new scan.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireCron(req, res)) return
  try {
    const result = await reconcileWAWebStatuses()
    return res.status(200).json({ ok: true, ...result })
  } catch (e) {
    console.error('[wa-web-reconcile] error:', (e as Error)?.message)
    return res.status(502).json({ ok: false, error: 'WA Web server unreachable' })
  }
}
