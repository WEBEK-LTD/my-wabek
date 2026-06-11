// @ts-nocheck
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function MagicLogin() {
  const router = useRouter()

  useEffect(() => {
    if (!router.isReady) return
    const token = router.query.token as string
    const redirect = (router.query.redirect as string) || '/dashboard'
    if (!token) { router.replace('/auth/login'); return }

    fetch('/api/auth/magic-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.token) {
          // Save in both keys — wabek_token (direct) + wabek-auth (zustand persist)
          localStorage.setItem('wabek_token', d.token)
          
          // Also update zustand persist store directly
          try {
            const existing = JSON.parse(localStorage.getItem('wabek-auth') || '{}')
            existing.state = existing.state || {}
            existing.state.token = d.token
            existing.state.user = d.user || existing.state.user
            localStorage.setItem('wabek-auth', JSON.stringify(existing))
          } catch {}

          // Full page navigation to force store rehydration
          setTimeout(() => {
            window.location.href = redirect
          }, 100)
        } else {
          router.replace('/auth/login?error=invalid_link')
        }
      })
      .catch(() => router.replace('/auth/login'))
  }, [router.isReady, router.query.token])

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0f1117',color:'#f1f5f9',fontFamily:'system-ui'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:40,height:40,border:'3px solid #1e2433',borderTopColor:'#25D366',borderRadius:'50%',animation:'spin .8s linear infinite',margin:'0 auto 16px'}}/>
        <p style={{color:'#94a3b8',fontSize:14}}>Signing you in...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )
}
