import { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/auth'
import dns from 'dns'
import { promisify } from 'util'

const resolveCname = promisify(dns.resolveCname)
const resolve4 = promisify(dns.resolve4)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const user = await requireAuth(req, res)
  if (!user) return

  const { domain } = req.query
  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: 'domain required' })
  }

  const clean = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0]

  try {
    // Try CNAME lookup
    const cnames = await resolveCname(clean)
    const pointsToUs = cnames.some(c =>
      c.includes('waabek.com') ||
      c.includes('netlify') ||
      c.includes('waabek')
    )
    if (pointsToUs) {
      return res.status(200).json({ status: 'ok', cname: cnames[0] })
    }
    // CNAME exists but points elsewhere
    return res.status(200).json({ status: 'pending', cname: cnames[0] })
  } catch {
    // No CNAME — try A record
    try {
      await resolve4(clean)
      return res.status(200).json({ status: 'pending' })
    } catch {
      return res.status(200).json({ status: 'error' })
    }
  }
}
