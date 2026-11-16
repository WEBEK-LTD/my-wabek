import { NextApiRequest, NextApiResponse } from 'next'
import { requireMemberAccess } from '@/lib/auth'
import { verifyWixInstance, getWixInstanceParam, linkWixInstance, wixAppConfigured } from '@/lib/wix-auth'

// Link the logged-in WABEK account to a Wix store. Proof of the store is a
// SIGNED Wix instance (`instance` in the body or x-wix-instance header);
// a bare wix_instance_id is not accepted.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireMemberAccess(req, res, 'integrations')
  if (!user) return

  if (!wixAppConfigured(res)) return
  const wix = verifyWixInstance(getWixInstanceParam(req))
  if (!wix) return res.status(400).json({ error: 'A valid Wix session is required. Please open the app from your Wix dashboard.' })

  const result = await linkWixInstance(user.userId, wix.instanceId)
  if (result === 'taken') return res.status(409).json({ error: 'This Wix store is already linked to another account' })

  return res.status(200).json({ success: true })
}
