import { NextApiRequest, NextApiResponse } from 'next'
import { lookupApiKey } from '@/lib/api-key-auth'
import { verifyWixInstance, getWixInstanceParam, linkWixInstance } from '@/lib/wix-auth'

// Link a Wix store to the WABEK account that owns `api_key`. The store must
// be proven with a SIGNED Wix instance; an existing owner is never replaced.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { api_key } = req.body || {}
  if (!api_key || typeof api_key !== 'string') return res.status(400).json({ error: 'API key required' })

  const keyRow = await lookupApiKey(api_key.trim())
  if (!keyRow) return res.status(401).json({ error: 'Invalid API key. Please check and try again.' })
  const userId = keyRow.userId

  const instanceParam = getWixInstanceParam(req)
  if (instanceParam || req.body?.wix_instance_id) {
    const wix = verifyWixInstance(instanceParam)
    if (!wix) return res.status(400).json({ error: 'A valid Wix session is required. Please open the app from your Wix dashboard.' })
    const result = await linkWixInstance(userId, wix.instanceId)
    if (result === 'taken') return res.status(409).json({ error: 'This Wix store is already linked to another account' })
  }

  return res.status(200).json({ success: true, user_id: userId })
}
