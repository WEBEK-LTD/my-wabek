// @ts-nocheck
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/lib/store'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { ArrowRightIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function RegisterPage() {
  const router = useRouter()
  const { brandName, brandColor, brandLogo } = useWhiteLabel()
  const { code: inviteCodeParam } = router.query
  const [inviteCode, setInviteCode] = useState((inviteCodeParam as string) || '')
  const [inviteInfo, setInviteInfo] = useState(null)
  
  useEffect(() => {
    if (inviteCodeParam) {
      axios.get(`/api/reseller/validate-code?code=${inviteCodeParam}`)
        .then(r => setInviteInfo(r.data.invite))
        .catch(() => {})
    }
  }, [inviteCodeParam])
  const { setUser, setToken } = useAuthStore()
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [pendingUserId, setPendingUserId] = useState('')
  const [otp, setOtp] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/register', form)
      if (data.requiresVerification) {
        setPendingUserId(data.userId)
        setStep('otp')
        toast.success('Verification code sent to your WhatsApp! 📱')
      } else {
        setUser(data.user)
        setToken(data.token)
        router.push('/dashboard')
        toast.success('Welcome to WABEK! 🎉')
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter 6-digit code'); return }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/auth/verify-otp', {
        userId: pendingUserId,
        otp,
        purpose: 'registration',
        trustDevice,
        deviceFingerprint: navigator.userAgent.slice(0, 32),
      })
      setUser(data.user)
      setToken(data.token)
      router.push('/dashboard')
      toast.success('Account verified! Welcome 🎉')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Invalid code')
    } finally { setLoading(false) }
  }

  const resendOtp = async () => {
    try {
      await axios.post('/api/auth/register', form)
      toast.success('New code sent!')
    } catch {}
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
          <h1 className="font-display text-3xl font-bold text-slate-900">Join WABEK</h1>
          <p className="text-slate-400 mt-2">WhatsApp automation platform</p>
        </div>

        <div className="card">
          {step === 'form' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                {/* OAuth */}
          <div className="space-y-2 mb-4">
            <a href="/api/auth/oauth/google"
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-white hover:bg-[#F8FAFC] text-slate-800 rounded-xl font-medium text-sm transition-colors border border-gray-200">
              <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign up with Google
            </a>
            <a href="/api/auth/oauth/facebook"
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 text-slate-900 rounded-xl font-medium text-sm transition-colors" style={{ backgroundColor: "#1877F2" }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Sign up with Facebook
            </a>
            <a href="/api/auth/oauth/github"
              className="flex items-center justify-center gap-3 w-full py-2.5 px-4 bg-[#F8FAFC] hover:bg-slate-100 text-slate-900 rounded-xl font-medium text-sm transition-colors border border-gray-700">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              Sign up with GitHub
            </a>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-wabek-border" />
            <span className="text-xs text-slate-500">or sign up with email</span>
            <div className="flex-1 h-px bg-wabek-border" />
          </div>

          <label className="label">Full Name</label>
                <input value={form.name} onChange={e => setForm(d => ({...d, name: e.target.value}))}
                  placeholder="John Doe" className="input" required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(d => ({...d, email: e.target.value}))}
                  placeholder="john@example.com" className="input" required />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" value={form.password} onChange={e => setForm(d => ({...d, password: e.target.value}))}
                  placeholder="Min 8 characters" className="input" required minLength={8} />
              </div>
              <div>
                <label className="label">WhatsApp Number <span className="text-slate-500 font-normal">(for OTP verification)</span></label>
                <input type="tel" value={form.phone} onChange={e => setForm(d => ({...d, phone: e.target.value}))}
                  placeholder="+201234567890" className="input" />
                <p className="text-xs text-slate-500 mt-1">Include country code. Required if OTP verification is enabled.</p>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
                {loading ? 'Creating account...' : <><ArrowRightIcon className="w-4 h-4" /> Create Account</>}
              </button>
              <p className="text-center text-sm text-slate-400">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-blue-600 hover:text-blue-500">Sign in</Link>
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <ShieldCheckIcon className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h2 className="font-display font-bold text-xl text-slate-900">Verify Your Account</h2>
                <p className="text-slate-400 text-sm mt-1">Enter the 6-digit code sent to your WhatsApp</p>
                <p className="text-blue-600 text-sm font-medium mt-1">{form.phone}</p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" className="input text-center text-2xl tracking-[0.5em] font-bold"
                    maxLength={6} required />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={trustDevice} onChange={e => setTrustDevice(e.target.checked)} className="rounded" />
                  <span className="text-sm text-slate-300">Trust this device for 30 days</span>
                </label>
                <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full justify-center py-3">
                  {loading ? 'Verifying...' : '✅ Verify Account'}
                </button>
                <button type="button" onClick={resendOtp} className="text-sm text-blue-600 hover:text-blue-500 w-full text-center">
                  Didn't receive code? Resend
                </button>
                <button type="button" onClick={() => setStep('form')} className="text-sm text-slate-500 hover:text-slate-400 w-full text-center">
                  ← Go back
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
