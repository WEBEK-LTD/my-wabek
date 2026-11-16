import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import { otpExpiryMinutes } from '@/lib/otp'

/** GET /api/settings/otp-config — the OTP settings the server actually uses (shown on the OTP page). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const user = await requireAuth(req, res)
  if (!user) return
  res.setHeader('Cache-Control', 'private, max-age=300')
  return res.status(200).json({ expiry_minutes: otpExpiryMinutes(), code_length: 6 })
}
