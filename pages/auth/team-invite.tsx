// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/lib/store'

export default function TeamInvitePage() {
  const router = useRouter()
  const { token } = router.query
  const { user: me, setUser, setToken } = useAuthStore()
  const [step, setStep] = useState('loading') // loading | info | register | done
  const [invite, setInvite] = useState(null)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    axios.get(`/api/team/invite?token=${token}`)
      .then(r => { setInvite(r.data.invite); setStep('info') })
      .catch(() => setStep('invalid'))
  }, [token])

  // Already logged in as the invited account → accept without a password.
  const loggedInAsInvitee = !!(me?.email && invite?.email && me.email.toLowerCase() === String(invite.email).toLowerCase())

  const accept = async () => {
    if (!loggedInAsInvitee) {
      if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
      if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/team/invite/accept', loggedInAsInvitee ? { token } : { token, password: form.password })
      setUser(data.user)
      if (data.token) {
        setToken(data.token)
        localStorage.setItem('wabek_token', data.token)
      }
      toast.success('Welcome to the team! 🎉')
      router.push('/dashboard')
    } catch (e) {
      if (e?.response?.status === 409 && e?.response?.data?.requiresLogin) {
        // The email already has an account: log in as it, then come back here.
        toast.error(e.response.data.error, { duration: 6000 })
        router.push(`/auth/login?redirect=${encodeURIComponent(router.asPath)}`)
        return
      }
      toast.error(e?.response?.data?.error || 'Failed to accept invite')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-500 rounded-2xl mb-4 glow-green">
            <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Team Invitation</h1>
        </div>

        <div className="card">
          {step === 'loading' && <div className="text-center py-8"><div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" /></div>}

          {step === 'invalid' && (
            <div className="text-center py-8">
              <p className="text-red-400 text-lg mb-2">Invalid or expired invitation</p>
              <p className="text-slate-400 text-sm">Please ask for a new invite link</p>
            </div>
          )}

          {step === 'info' && invite && (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-slate-200">
                <p className="text-slate-400 text-sm mb-1">You've been invited to join</p>
                <p className="text-slate-900 font-bold text-xl">{invite.owner_name || 'WABEK'}</p>
                <p className="text-slate-500 text-sm mt-1">as {invite.role}</p>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3 border border-slate-200">
                <p className="text-sm text-slate-400">Joining as:</p>
                <p className="text-slate-900 font-medium">{invite.name}</p>
                <p className="text-slate-500 text-sm">{invite.email}</p>
              </div>
              {!loggedInAsInvitee && (<>
              <div>
                <label className="label">Set your password</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  placeholder="Min 8 characters" className="input" />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input type="password" value={form.confirm} onChange={e => setForm(f => ({...f, confirm: e.target.value}))}
                  placeholder="Repeat password" className="input" />
              </div>
              </>)}
              <button onClick={accept} disabled={loading || (!loggedInAsInvitee && !form.password)}
                className="btn-primary w-full justify-center py-3">
                {loading ? 'Joining...' : '✅ Accept Invitation & Join'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
