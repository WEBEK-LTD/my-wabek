import { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '@/lib/auth'
import { sendNotification, TEMPLATE_MAP } from '@/lib/wa-notifications'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const admin = await requireAdmin(req, res)
  if (!admin) return

  const { templateKey, phone } = req.body
  if (!templateKey || !phone) return res.status(400).json({ error: 'templateKey and phone required' })

  const tmpl = (TEMPLATE_MAP as any)[templateKey]
  if (!tmpl) return res.status(400).json({ error: 'Unknown template key' })

  const params: Record<string,string> = {}
  for (const name of tmpl.paramNames) {
    params[name] = name === 'otp_code' ? '123456'
      : name === 'customer_name' ? 'Test Customer'
      : name === 'invoice_id' ? 'INV-001'
      : name === 'amount' ? '$99.00'
      : name === 'due_date' ? new Date(Date.now()+7*86400000).toLocaleDateString()
      : name === 'reset_link' ? 'https://waabek.com/auth/reset'
      : name === 'message' ? 'This is a test notification from WABEK admin.'
      : name === 'offer_details' ? 'Get 20% off your next purchase, valid until end of month!'
      : 'Test Value'
  }

  const r = await sendNotification({ userId: admin.userId, phone, templateKey: templateKey as any, params, fallbackText: `Test: ${tmpl.name}` })
  if (r.error) return res.status(400).json({ error: r.error })
  return res.status(200).json({ success: true, method: r.method, messageId: r.messageId })
}
