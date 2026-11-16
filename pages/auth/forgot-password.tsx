// @ts-nocheck
import { useState } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import Head from 'next/head'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { EnvelopeIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function ForgotPasswordPage() {
  const { brandName, brandLogo } = useWhiteLabel()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await axios.post('/api/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      // Always show success to prevent email enumeration
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
      <link rel="icon" href="/brand/favicon-32.png" /><title>Forgot Password | WABEK</title></Head>
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center glow-green">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
            </div>
            {brandLogo ? <img src={brandLogo} alt={brandName} className="h-8 object-contain" /> : <span className="font-display font-bold text-2xl text-slate-900">{brandName}</span>}
          </div>

          <div className="card">
            {!sent ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <EnvelopeIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-xl text-slate-900">Forgot password?</h1>
                    <p className="text-sm text-slate-400">We'll send you a reset link</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">Email address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading || !email} className="btn-primary w-full justify-center py-3">
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="font-display font-bold text-xl text-slate-900 mb-2">Check your email</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  If <strong className="text-slate-900">{email}</strong> is registered, you'll receive a password reset link shortly.
                </p>
                <p className="text-slate-500 text-xs mt-4">Didn't receive it? Check spam or try again.</p>
                <button onClick={() => setSent(false)} className="btn-secondary mt-4 mx-auto">Try again</button>
              </div>
            )}
          </div>

          <Link href="/auth/login" className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </div>
    </>
  )
}
