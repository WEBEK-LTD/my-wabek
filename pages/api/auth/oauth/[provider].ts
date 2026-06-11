import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { provider } = req.query
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waabek.com'

  const validProviders = ['google', 'github', 'facebook']
  if (!validProviders.includes(provider as string)) {
    return res.status(400).json({ error: 'Invalid provider' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as 'google' | 'github' | 'facebook',
      options: {
        // Redirect to frontend page that handles #access_token fragment
        redirectTo: `${appUrl}/auth/oauth-callback`,
        skipBrowserRedirect: true,
      },
    })

    if (error || !data?.url) {
      return res.redirect(`${appUrl}/auth/login?error=oauth_init_failed`)
    }

    return res.redirect(data.url)
  } catch (e) {
    return res.redirect(`${appUrl}/auth/login?error=server_error`)
  }
}
