// @ts-nocheck
import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import axios from 'axios'
import toast from 'react-hot-toast'
import { LockClosedIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = router.query
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await axios.post('/api/auth/reset-password', { token, password })
      setDone(true)
      toast.success('Password reset successfully!')
      setTimeout(() => router.push('/auth/login'), 2000)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Reset link expired or invalid')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
      <link rel="icon" href="/brand/favicon-32.png" /><title>Reset Password | WABEK</title></Head>
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4">
        <div className="max-w-md mx-auto w-full">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center glow-green">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
            </div>
            <span className="font-display font-bold text-2xl text-slate-900">WABEK</span>
          </div>

          <div className="card">
            {!done ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <LockClosedIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="font-display font-bold text-xl text-slate-900">Set new password</h1>
                    <p className="text-sm text-slate-400">Must be at least 8 characters</p>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="label">New password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="input pr-10"
                        required
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900">
                        {showPw ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Confirm password</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat password"
                      className="input"
                      required
                    />
                    {confirm && password !== confirm && (
                      <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <button type="submit" disabled={loading || !token || password !== confirm || password.length < 8} className="btn-primary w-full justify-center py-3">
                    {loading ? 'Resetting…' : 'Reset Password'}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="font-display font-bold text-xl text-slate-900 mb-2">Password Reset!</h2>
                <p className="text-slate-400 text-sm">Redirecting to login…</p>
              </div>
            )}
          </div>

          <Link href="/auth/login" className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-400 hover:text-slate-900 transition-colors">
            ← Back to login
          </Link>
        </div>
      </div>
    </>
  )
}
