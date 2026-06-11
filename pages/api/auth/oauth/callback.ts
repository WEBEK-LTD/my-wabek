import { NextApiRequest, NextApiResponse } from 'next'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'
  const { code, error, error_description } = req.query

  if (error) {
    console.error('OAuth error:', error, error_description)
    return res.redirect(`${appUrl}/auth/login?error=oauth_cancelled`)
  }

  if (!code) {
    return res.redirect(`${appUrl}/auth/login?error=no_code`)
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL!
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createClient(supabaseUrl, anonKey)
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code as string)

    if (exchangeError || !data?.user) {
      console.error('Code exchange error:', exchangeError)
      return res.redirect(`${appUrl}/auth/login?error=oauth_failed`)
    }

    const oauthUser = data.user
    const email = oauthUser.email!
    const name = oauthUser.user_metadata?.full_name
      || oauthUser.user_metadata?.name
      || oauthUser.user_metadata?.user_name
      || email.split('@')[0]
    const avatar = oauthUser.user_metadata?.avatar_url || oauthUser.user_metadata?.picture || ''

    const db = supabaseAdmin()
    const { data: existingUser } = await db.from('users').select('id, role, is_active').eq('email', email).single()

    let userId: string
    let userRole = 'user'

    if (existingUser) {
      if (!existingUser.is_active) return res.redirect(`${appUrl}/auth/login?error=account_suspended`)
      userId = existingUser.id
      userRole = existingUser.role
      await db.from('users').update({ name, ...(avatar ? { avatar_url: avatar } : {}) }).eq('id', userId)
    } else {
      userId = uuidv4()
      await db.from('users').insert({
        id: userId, email, name, password_hash: '', role: 'user',
        is_active: true, api_key: 'wk_live_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), ...(avatar ? { avatar_url: avatar } : {}),
        created_at: new Date().toISOString(),
      })
    }

    const token = await signToken({ userId, email, role: userRole as 'user' | 'admin' })

    res.setHeader('Set-Cookie', [
      `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    ])

    // Redirect to a page that sets localStorage token then goes to dashboard
    return res.redirect(`${appUrl}/auth/oauth-success?token=${encodeURIComponent(token)}`)
  } catch (e) {
    console.error('OAuth callback error:', e)
    return res.redirect(`${appUrl}/auth/login?error=server_error`)
  }
}
