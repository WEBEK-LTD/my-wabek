import { NextApiRequest, NextApiResponse } from 'next'
import { verifyWixInstance, getWixInstanceParam, getLinkedUserId } from '@/lib/wix-auth'
import { createMetaOAuthState } from '@/lib/meta-oauth'
import { checkInstanceCreateAllowed } from '@/lib/wa-smart-send'

// Meta Embedded Signup started from the Wix app page. Requires a VERIFIED
// Wix instance (the Wix iframe has no WABEK cookie); the account comes from
// the instance → user link. The signed instance is kept in the one-time
// state so the callback can return the user to /wix-setup.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const instanceParam = getWixInstanceParam(req) || (typeof req.query.wix_instance === 'string' ? req.query.wix_instance : null)
  const wix = verifyWixInstance(instanceParam)
  if (!wix || !instanceParam) return res.status(401).json({ error: 'Invalid or expired Wix session. Please reopen the app from your Wix dashboard.' })
  const userId = await getLinkedUserId(wix.instanceId)
  if (!userId) return res.status(401).json({ error: 'Store not connected' })

  const appId    = process.env.META_APP_ID
  const configId = process.env.META_CONFIG_ID || ''
  if (!appId) return res.status(500).json({ error: 'META_APP_ID not configured' })

  const limit = await checkInstanceCreateAllowed(userId)
  if (!limit.allowed) return res.status(403).json({ error: limit.error, code: 'PLAN_LIMIT' })

  const oauthState = await createMetaOAuthState({ userId, source: 'wix', wixInstance: instanceParam })
  return res.status(200).json({ appId, configId, oauthState })
}
