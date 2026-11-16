// @ts-nocheck
import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/lib/store'
import { ShieldCheckIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const TABS = [
  { id: 'profile', label: '👤 Profile' },
  { id: 'password', label: '🔑 Password' },
  { id: 'security', label: '🔒 Security & OTP' },
  { id: 'devices', label: '📱 Trusted Devices' },
]

export default function SettingsPage() {
  const { user, setUser, fetchMe } = useAuthStore()
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '', language: user?.language || 'en', timezone: user?.timezone || 'UTC' })
  
  // Fetch fresh user data on mount to get accurate last_login, is_verified, otp_mode etc.
  useEffect(() => { fetchMe() }, [])

  // Sync profile state when user loads/changes
  useEffect(() => {
    if (user) {
      setProfile({ name: user.name || '', phone: user.phone || '', language: user.language || 'en', timezone: user.timezone || 'UTC' })
      setOtp({ otp_mode: user.otp_mode || 'disabled' })
    }
  }, [user?.id, user?.phone, user?.otp_mode])
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' })
  const [otp, setOtp] = useState({ otp_mode: user?.otp_mode || 'disabled' })
  // Phone change is confirmed with a code sent to the new number (API → 202).
  const [phoneOtpPending, setPhoneOtpPending] = useState(false)
  const [phoneOtp, setPhoneOtp] = useState('')
  // Weakening 2FA requires the current password.
  const [currentPassword, setCurrentPassword] = useState('')
  const OTP_STRENGTH = { disabled: 0, new_device: 1, always: 2 }
  const weakening2fa = (OTP_STRENGTH[otp.otp_mode] ?? 0) < (OTP_STRENGTH[user?.otp_mode || 'disabled'] ?? 0)

  const { data: devicesData, refetch: refetchDevices } = useQuery('trusted-devices', () =>
    axios.get('/api/settings/devices').then(r => r.data), { enabled: tab === 'devices' }
  )

  const profileMut = useMutation(
    (body) => axios.put('/api/settings/profile', body),
    { 
      onSuccess: async (res) => { 
        if (res?.status === 202 || res?.data?.requiresPhoneVerification) {
          setPhoneOtpPending(true)
          setPhoneOtp('')
          toast.success('We sent a verification code to the new number by WhatsApp')
          return
        }
        setPhoneOtpPending(false)
        setPhoneOtp('')
        await fetchMe()  // reload full user from DB including phone/otp_mode/last_login etc.
        toast.success('Profile updated ✅') 
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed') 
    }
  )

  const passwordMut = useMutation(
    (body) => axios.put('/api/settings/password', body),
    { onSuccess: () => { toast.success('Password changed ✅'); setPasswords({ current: '', newPass: '', confirm: '' }) },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed') }
  )

  const securityMut = useMutation(
    (body) => axios.put('/api/settings/security', body),
    { 
      onSuccess: async (_, body) => {
        // Update store immediately so UI reflects the new mode
        setUser({ ...user, otp_mode: body.otp_mode })
        setCurrentPassword('')
        toast.success('Security settings updated ✅')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed') 
    }
  )

  const removeDeviceMut = useMutation(
    (id) => axios.delete(`/api/settings/devices/${id}`),
    { onSuccess: () => { refetchDevices(); toast.success('Device removed') } }
  )

  const OTP_MODES = [
    { value: 'disabled', label: '🔓 Disabled', desc: 'No OTP required for login' },
    { value: 'always', label: '🔐 Always', desc: 'OTP required on every login' },
    { value: 'new_device', label: '📱 New Device Only', desc: 'OTP only when logging in from a new device' },
  ]

  return (
    <DashboardLayout title="Settings">
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-brand-500 text-white' : 'bg-[#F8FAFC] text-slate-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-lg space-y-4">

        {tab === 'profile' && (
          <div className="card space-y-4">
            <h3 className="font-display font-semibold text-slate-900">Profile Information</h3>
            <div>
              <label className="label">Full Name</label>
              <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={user?.email} disabled className="input opacity-50 cursor-not-allowed" />
            </div>
            <div>
              <label className="label">WhatsApp Number <span className="text-slate-500 font-normal">(for OTP)</span></label>
              <input value={profile.phone} onChange={e => { setProfile(p => ({ ...p, phone: e.target.value })); setPhoneOtpPending(false) }}
                placeholder="+201234567890" className="input" />
              <p className="text-xs text-slate-500 mt-1">Used for OTP verification. Include country code.</p>
            </div>
            {phoneOtpPending && (
              <div>
                <label className="label">Verification code</label>
                <input value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className="input" />
                <p className="text-xs text-slate-500 mt-1">Enter the code we sent by WhatsApp to confirm the phone number change.</p>
              </div>
            )}
            <div>
              <label className="label">Language / اللغة / Dil</label>
              <select value={profile.language || 'en'} onChange={e => setProfile(p => ({ ...p, language: e.target.value }))} className="input">
                <option value="en">🇺🇸 English</option>
                <option value="ar">🇸🇦 العربية</option>
                <option value="tr">🇹🇷 Türkçe</option>
                <option value="fr">🇫🇷 Français</option>
                <option value="es">🇪🇸 Español</option>
              </select>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select value={profile.timezone || 'UTC'} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))} className="input">
                <option value="UTC">UTC</option>
                <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
                <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                <option value="Asia/Istanbul">Asia/Istanbul (GMT+3)</option>
                <option value="Africa/Cairo">Africa/Cairo (GMT+2)</option>
                <option value="Europe/London">Europe/London (GMT+0)</option>
                <option value="America/New_York">America/New_York (GMT-5)</option>
              </select>
            </div>
            <button onClick={() => profileMut.mutate(phoneOtpPending ? { ...profile, phone_otp: phoneOtp } : profile)}
              disabled={profileMut.isLoading || (phoneOtpPending && !phoneOtp)} className="btn-primary">
              {profileMut.isLoading ? 'Saving...' : phoneOtpPending ? 'Verify & Save' : 'Save Profile'}
            </button>
          </div>
        )}

        {tab === 'password' && (
          <div className="card space-y-4">
            <h3 className="font-display font-semibold text-slate-900">Change Password</h3>
            <div>
              <label className="label">Current Password</label>
              <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" value={passwords.newPass} onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                placeholder="Min 8 characters" className="input" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} className="input" />
            </div>
            <button onClick={() => {
              if (passwords.newPass !== passwords.confirm) { toast.error('Passwords do not match'); return }
              if (passwords.newPass.length < 8) { toast.error('Password must be at least 8 characters'); return }
              passwordMut.mutate({ currentPassword: passwords.current, newPassword: passwords.newPass })
            }} disabled={passwordMut.isLoading} className="btn-primary">
              {passwordMut.isLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        )}

        {tab === 'security' && (
          <>
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
                <h3 className="font-display font-semibold text-slate-900">Two-Factor Authentication</h3>
              </div>
              <p className="text-sm text-slate-400 mb-4">Protect your account with WhatsApp OTP verification.</p>

              {!user?.phone && (
                <div className="p-3 bg-yellow-900/20 border border-yellow-800/50 rounded-lg text-sm text-yellow-400 mb-4">
                  ⚠️ Add your WhatsApp number in Profile settings first to enable OTP.
                </div>
              )}

              <div className="space-y-2">
                {OTP_MODES.map(mode => (
                  <button key={mode.value} onClick={() => setOtp({ otp_mode: mode.value })}
                    disabled={!user?.phone && mode.value !== 'disabled'}
                    className={clsx('w-full text-left p-3 rounded-lg border transition-all',
                      otp.otp_mode === mode.value ? 'border-brand-500 bg-blue-50/20' : 'border-slate-200 hover:border-wabek-muted',
                      !user?.phone && mode.value !== 'disabled' && 'opacity-50 cursor-not-allowed'
                    )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{mode.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{mode.desc}</p>
                      </div>
                      {otp.otp_mode === mode.value && (
                        <div className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {weakening2fa && (
                <div className="mt-4">
                  <label className="label">Current password</label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                    autoComplete="current-password" className="input" />
                  <p className="text-xs text-slate-500 mt-1">Required to lower or disable two-factor authentication.</p>
                </div>
              )}
              <button onClick={() => securityMut.mutate(weakening2fa ? { ...otp, current_password: currentPassword } : otp)}
                disabled={securityMut.isLoading || (weakening2fa && !currentPassword)}
                className="btn-primary mt-4 w-full justify-center">
                {securityMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</> : '💾 Save Security Settings'}
              </button>
            </div>

            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-3">📊 Account Security</h3>
              {[
                { label: 'Last Login', value: user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never' },
                { label: 'Last Login IP', value: user?.last_login_ip || '—' },
                { label: 'Last Device', value: user?.last_login_device || '—' },
                { label: 'Account Status', value: user?.is_verified ? '✅ Verified' : '⚠️ Unverified' },
                { label: '2FA Status', value: otp.otp_mode === 'disabled' ? '❌ Disabled' : otp.otp_mode === 'always' ? '✅ Always On' : '📱 New Device' },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-slate-200/50 last:border-0">
                  <span className="text-slate-400 text-sm">{r.label}</span>
                  <span className="text-slate-900 text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'devices' && (
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-1">📱 Trusted Devices</h3>
            <p className="text-sm text-slate-400 mb-4">Devices that don't require OTP verification</p>
            {(() => {
              const activeDevices = (devicesData?.devices || []).filter(d => new Date(d.expires_at) > new Date())
              if (!activeDevices.length) return <p className="text-slate-500 text-sm text-center py-8">No trusted devices yet</p>
              return activeDevices.map(d => {
                const expiresDate = new Date(d.expires_at)
                const formattedExpiry = expiresDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                const lastUsed = d.last_used_at ? new Date(d.last_used_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
                return (
                  <div key={d.id} className="flex items-center justify-between py-3 border-b border-slate-200/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{d.device_name || 'Unknown Device'}</p>
                      <p className="text-xs text-slate-500">
                        {d.ip_address && <span>{d.ip_address} • </span>}
                        {lastUsed && <span>Last used {lastUsed} • </span>}
                        Expires {formattedExpiry}
                      </p>
                    </div>
                    <button onClick={() => removeDeviceMut.mutate(d.id)} className="p-1.5 text-slate-500 hover:text-red-400">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
