import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { access_token } = req.body
  if (!access_token) return res.status(400).json({ error: 'access_token required' })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Use service role key to get user by their JWT
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        apikey: serviceKey,
      },
    })

    if (!userRes.ok) {
      const errText = await userRes.text()
      console.error('Supabase user fetch failed:', userRes.status, errText)
      return res.status(401).json({ error: 'Invalid token', details: errText })
    }

    const oauthUser = await userRes.json()

    if (!oauthUser?.email) {
      console.error('No email in oauth user:', JSON.stringify(oauthUser))
      return res.status(401).json({ error: 'No email from provider' })
    }

    const email = oauthUser.email
    const name = oauthUser.user_metadata?.full_name
      || oauthUser.user_metadata?.name
      || oauthUser.user_metadata?.user_name
      || email.split('@')[0]
    const avatar = oauthUser.user_metadata?.avatar_url
      || oauthUser.user_metadata?.picture
      || ''

    const db = supabaseAdmin()
    const { data: existingUser } = await db.from('users')
      .select('id, name, email, role, is_active')
      .eq('email', email)
      .single()

    let userId: string
    let userRole = 'user'

    if (existingUser) {
      if (!existingUser.is_active) {
        return res.status(403).json({ error: 'Account suspended' })
      }
      userId = existingUser.id
      userRole = existingUser.role
      await db.from('users').update({
        name,
        ...(avatar ? { avatar_url: avatar } : {}),
      }).eq('id', userId)
    } else {
      userId = uuidv4()
      const { error: insertError } = await db.from('users').insert({
        id: userId,
        email,
        name,
        password_hash: '',
        role: 'user',
        is_active: true,
        ...(avatar ? { avatar_url: avatar } : {}),
        created_at: new Date().toISOString(),
      })
      if (insertError) {
        console.error('User insert error:', insertError)
        return res.status(500).json({ error: 'Failed to create user', details: insertError.message })
      }
    }

    const token = await signToken({ userId, email, role: userRole as 'user' | 'admin' })

    return res.status(200).json({
      token,
      user: { id: userId, email, name, role: userRole, avatar_url: avatar },
    })
  } catch (e) {
    console.error('OAuth exchange error:', e)
    return res.status(500).json({ error: 'Server error', details: String(e) })
  }
}
