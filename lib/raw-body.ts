// Raw request body + bounded-time helpers for webhook routes (bodyParser:false).
import { NextApiRequest } from 'next'

/** Read the raw request body with a size cap (for bodyParser:false routes). */
export function readRawBody(req: NextApiRequest, maxBytes = 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('Body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Resolve after `ms` with `fallback` if `p` has not settled — bounds webhook processing time. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let t: NodeJS.Timeout
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>(resolve => { t = setTimeout(() => resolve(fallback), ms) }),
  ])
}
