import { NextApiRequest, NextApiResponse } from 'next'
import { verifyWixInstance, getLinkedUserId } from '@/lib/wix-auth'

// Only answers for a SIGNED Wix instance (no probing of arbitrary instance ids).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const wix = verifyWixInstance(req.headers['x-wix-instance'] || req.query.instance)
  if (!wix) return res.status(200).json({ connected: false })
  return res.status(200).json({ connected: !!(await getLinkedUserId(wix.instanceId)) })
}
