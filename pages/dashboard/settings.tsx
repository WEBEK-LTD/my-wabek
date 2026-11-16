// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/lib/store'
import { useTheme } from '@/hooks/useTheme'
import {
  UserCircleIcon, ShieldCheckIcon, DevicePhoneMobileIcon, BellIcon, LanguageIcon, TrashIcon,
  KeyIcon, LockOpenIcon, LockClosedIcon, ComputerDesktopIcon, SunIcon, MoonIcon, CheckIcon,
  ExclamationTriangleIcon, ArrowLeftIcon, ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import {
  Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, PageHeader, Select,
  Skeleton, TabPanel, Tabs, Tooltip, cn,
} from '@/components/ui'
import { ErrorState, InfoRow, Notice, SectionTitle, apiError } from '@/components/settings/Shared'
import { fmtDate, fmtDateTime } from '@/components/settings/format'

const TABS = [
  { id: 'profile', label: 'الملف الشخصي', icon: UserCircleIcon },
  { id: 'security', label: 'الأمان', icon: ShieldCheckIcon },
  { id: 'devices', label: 'الأجهزة الموثوقة', icon: DevicePhoneMobileIcon },
  { id: 'preferences', label: 'اللغة والمظهر', icon: LanguageIcon },
  { id: 'notifications', label: 'الإشعارات', icon: BellIcon },
]
const TAB_IDS = TABS.map(t => t.id)
// Old tab id kept so /dashboard/settings?tab=password still works.
const TAB_ALIASES = { password: 'security' }

const LANG_OPTIONS = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'es', label: 'Español' },
]
const TZ_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Riyadh', label: 'الرياض (GMT+3)' },
  { value: 'Asia/Dubai', label: 'دبي (GMT+4)' },
  { value: 'Asia/Istanbul', label: 'إسطنبول (GMT+3)' },
  { value: 'Africa/Cairo', label: 'القاهرة (GMT+2)' },
  { value: 'Europe/London', label: 'لندن (GMT+0)' },
  { value: 'America/New_York', label: 'نيويورك (GMT-5)' },
]

const OTP_MODES = [
  { value: 'disabled', label: 'متوقف', desc: 'لا يُطلب رمز تحقق عند تسجيل الدخول', icon: LockOpenIcon },
  { value: 'new_device', label: 'الأجهزة الجديدة فقط', desc: 'يُطلب الرمز عند الدخول من جهاز لم يُستخدم من قبل', icon: DevicePhoneMobileIcon },
  { value: 'always', label: 'دائمًا', desc: 'يُطلب رمز تحقق عبر واتساب مع كل تسجيل دخول', icon: LockClosedIcon },
]
const OTP_LABEL = { disabled: 'متوقف', new_device: 'الأجهزة الجديدة', always: 'دائمًا' }

export default function SettingsPage() {
  const router = useRouter()
  const { user, setUser, fetchMe } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [tab, setTab] = useState('profile')
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '', language: user?.language || 'en', timezone: user?.timezone || 'UTC' })

  // Deep link: ?tab=security
  useEffect(() => {
    const q = router.query.tab as string
    const id = TAB_ALIASES[q] || q
    if (id && TAB_IDS.includes(id)) setTab(id)
  }, [router.query.tab])
  const changeTab = (id: string) => {
    setTab(id)
    router.replace({ pathname: router.pathname, query: { ...router.query, tab: id } }, undefined, { shallow: true })
  }

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
  const [toRemove, setToRemove] = useState(null)
  const OTP_STRENGTH = { disabled: 0, new_device: 1, always: 2 }
  const weakening2fa = (OTP_STRENGTH[otp.otp_mode] ?? 0) < (OTP_STRENGTH[user?.otp_mode || 'disabled'] ?? 0)
  const otpDirty = otp.otp_mode !== (user?.otp_mode || 'disabled')

  const { data: devicesData, refetch: refetchDevices, isLoading: devicesLoading, isError: devicesError, error: devicesErr } = useQuery('trusted-devices', () =>
    axios.get('/api/settings/devices').then(r => r.data), { enabled: tab === 'devices' }
  )

  const profileMut = useMutation(
    (body) => axios.put('/api/settings/profile', body),
    {
      onSuccess: async (res) => {
        if (res?.status === 202 || res?.data?.requiresPhoneVerification) {
          setPhoneOtpPending(true)
          setPhoneOtp('')
          toast.success('أرسلنا رمز تحقق إلى الرقم الجديد عبر واتساب')
          return
        }
        setPhoneOtpPending(false)
        setPhoneOtp('')
        await fetchMe()  // reload full user from DB including phone/otp_mode/last_login etc.
        toast.success('تم حفظ التغييرات')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'تعذّر الحفظ')
    }
  )

  const passwordMut = useMutation(
    (body) => axios.put('/api/settings/password', body),
    { onSuccess: () => { toast.success('تم تغيير كلمة المرور'); setPasswords({ current: '', newPass: '', confirm: '' }) },
      onError: (e) => toast.error(e?.response?.data?.error || 'تعذّر تغيير كلمة المرور') }
  )

  const securityMut = useMutation(
    (body) => axios.put('/api/settings/security', body),
    {
      onSuccess: async (_, body) => {
        // Update store immediately so UI reflects the new mode
        setUser({ ...user, otp_mode: body.otp_mode })
        setCurrentPassword('')
        toast.success('تم حفظ إعدادات الأمان')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'تعذّر الحفظ')
    }
  )

  // Revokes every session of this person (token_version bump) and clears the cookie here.
  const [logoutAllOpen, setLogoutAllOpen] = useState(false)
  const logoutAllMut = useMutation(
    () => axios.post('/api/auth/logout-all'),
    {
      onSuccess: () => {
        toast.success('تم تسجيل الخروج من جميع الأجهزة')
        useAuthStore.setState({ user: null, token: null })
        window.location.href = '/auth/login'
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'تعذّر تسجيل الخروج من جميع الأجهزة'),
    }
  )

  const removeDeviceMut = useMutation(
    (id) => axios.delete(`/api/settings/devices/${id}`),
    { onSuccess: () => { refetchDevices(); setToRemove(null); toast.success('تمت إزالة الجهاز') },
      onError: (e) => toast.error(apiError(e, 'تعذّرت إزالة الجهاز')) }
  )

  const submitPassword = () => {
    if (passwords.newPass !== passwords.confirm) { toast.error('كلمتا المرور غير متطابقتين'); return }
    if (passwords.newPass.length < 8) { toast.error('يجب ألا تقل كلمة المرور عن 8 أحرف'); return }
    passwordMut.mutate({ currentPassword: passwords.current, newPassword: passwords.newPass })
  }

  const phoneChanged = (profile.phone || '') !== (user?.phone || '')
  const activeDevices = (devicesData?.devices || []).filter(d => new Date(d.expires_at) > new Date())
  const passStrength = Math.min(4, [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(passwords.newPass)).length)

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6">
        <PageHeader eyebrow="الإعدادات" title="إعدادات الحساب" description="بياناتك الشخصية، وأمان تسجيل الدخول، وتفضيلات اللغة والمظهر." />

        {/* Account summary */}
        <Card padding="none" className="overflow-hidden">
          <div aria-hidden="true" className="absolute inset-y-0 start-0 w-1.5 bg-brand-gradient" />
          <div aria-hidden="true" className="pointer-events-none absolute -end-20 -top-24 h-56 w-56 rounded-full bg-brand-teal/10 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <Avatar name={user?.name || user?.email || '?'} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-ink">{user?.name || '—'}</p>
              <p className="truncate text-sm text-muted"><span dir="ltr">{user?.email}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user?.is_verified ? <Badge tone="success" dot>حساب موثّق</Badge> : <Badge tone="warning" dot>غير موثّق</Badge>}
              <Badge tone={(user?.otp_mode || 'disabled') === 'disabled' ? 'neutral' : 'brand'} icon={ShieldCheckIcon}>
                التحقق الثنائي: {OTP_LABEL[user?.otp_mode || 'disabled']}
              </Badge>
            </div>
          </div>
        </Card>

        <Tabs idPrefix="settings" aria-label="أقسام الإعدادات" value={tab} onChange={changeTab} tabs={TABS} />

        {/* ── Profile ─────────────────────────────── */}
        <TabPanel idPrefix="settings" id="profile" active={tab}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,640px)_1fr]">
            <Card>
              <h2 className="text-[17px] font-semibold text-ink">المعلومات الشخصية</h2>
              <form className="mt-5 space-y-4" onSubmit={e => {
                e.preventDefault()
                profileMut.mutate(phoneOtpPending ? { ...profile, phone_otp: phoneOtp } : profile)
              }}>
                <Field label="الاسم الكامل" required>
                  <Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} autoComplete="name" />
                </Field>
                <Field label="البريد الإلكتروني" hint="لا يمكن تغيير البريد الإلكتروني من هنا.">
                  <Input value={user?.email || ''} disabled dir="ltr" />
                </Field>
                <Field label="رقم واتساب" hint="يُستخدم لرموز التحقق. أدخله مع رمز الدولة. تغييره يتطلب تأكيدًا برمز يُرسل إلى الرقم الجديد.">
                  <Input value={profile.phone} onChange={e => { setProfile(p => ({ ...p, phone: e.target.value })); setPhoneOtpPending(false) }}
                    placeholder="+201234567890" dir="ltr" inputMode="tel" autoComplete="tel" />
                </Field>
                {phoneOtpPending && (
                  <div className="rounded-card border border-brand-teal/30 bg-chip/40 p-4">
                    <Field label="رمز التحقق" hint="أدخل الرمز الذي أرسلناه عبر واتساب لتأكيد تغيير الرقم." required>
                      <Input value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        inputMode="numeric" autoComplete="one-time-code" placeholder="123456" dir="ltr" className="tracking-[0.3em] tabular" autoFocus />
                    </Field>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button type="submit" loading={profileMut.isLoading} disabled={phoneOtpPending && !phoneOtp}>
                    {phoneOtpPending ? 'تأكيد وحفظ' : phoneChanged ? 'إرسال رمز التحقق' : 'حفظ التغييرات'}
                  </Button>
                  {phoneOtpPending && (
                    <Button variant="ghost" onClick={() => { setPhoneOtpPending(false); setPhoneOtp(''); setProfile(p => ({ ...p, phone: user?.phone || '' })) }}>إلغاء تغيير الرقم</Button>
                  )}
                </div>
              </form>
            </Card>
            <Card variant="muted" className="h-fit">
              <h3 className="font-semibold text-ink">لماذا نطلب رقم واتساب؟</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">نرسل إليه رموز التحقق عند تسجيل الدخول إذا فعّلت التحقق الثنائي، وعند تأكيد تغيير الرقم. لن نستخدمه في الرسائل التسويقية.</p>
            </Card>
          </div>
        </TabPanel>

        {/* ── Security ────────────────────────────── */}
        <TabPanel idPrefix="settings" id="security" active={tab}>
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <SectionTitle icon={ShieldCheckIcon} title="التحقق الثنائي" subtitle="احمِ حسابك برمز تحقق يصل عبر واتساب" />
              {!user?.phone && (
                <Notice tone="warning" className="mb-4" action={<Button size="xs" variant="secondary" onClick={() => changeTab('profile')}>إضافة الرقم</Button>}>
                  أضف رقم واتساب في الملف الشخصي أولًا لتفعيل رموز التحقق.
                </Notice>
              )}
              <div role="radiogroup" aria-label="وضع التحقق الثنائي" className="space-y-2">
                {OTP_MODES.map(mode => {
                  const selected = otp.otp_mode === mode.value
                  const disabled = !user?.phone && mode.value !== 'disabled'
                  return (
                    <button key={mode.value} type="button" role="radio" aria-checked={selected} disabled={disabled}
                      onClick={() => setOtp({ otp_mode: mode.value })}
                      className={cn('flex w-full items-center gap-3 rounded-card border p-3.5 text-start transition',
                        selected ? 'border-brand-teal bg-chip/50 shadow-ring' : 'border-line hover:border-line-strong hover:bg-surface-2',
                        disabled && 'cursor-not-allowed opacity-50')}>
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-brand-gradient text-[#04282C]' : 'bg-surface-3 text-muted')}>
                        <mode.icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{mode.label}</span>
                        <span className="block text-xs text-muted">{mode.desc}</span>
                      </span>
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', selected ? 'border-brand-teal bg-brand-teal text-white' : 'border-line-strong')} aria-hidden="true">
                        {selected && <CheckIcon className="h-3 w-3" />}
                      </span>
                    </button>
                  )
                })}
              </div>

              {weakening2fa && (
                <div className="mt-4 rounded-card border border-warning/25 bg-warning-bg/60 p-4">
                  <Field label="كلمة المرور الحالية" hint="مطلوبة لتخفيف التحقق الثنائي أو إيقافه." required>
                    <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                  </Field>
                </div>
              )}
              <Button className="mt-4" fullWidth loading={securityMut.isLoading}
                disabled={!otpDirty || (weakening2fa && !currentPassword)}
                onClick={() => securityMut.mutate(weakening2fa ? { ...otp, current_password: currentPassword } : otp)}>
                حفظ إعدادات الأمان
              </Button>
            </Card>

            <div className="space-y-5">
              <Card>
                <SectionTitle icon={KeyIcon} title="تغيير كلمة المرور" />
                <form className="space-y-4" onSubmit={e => { e.preventDefault(); submitPassword() }}>
                  <Field label="كلمة المرور الحالية" required>
                    <Input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} autoComplete="current-password" />
                  </Field>
                  <Field label="كلمة المرور الجديدة" hint="8 أحرف على الأقل" required>
                    <Input type="password" value={passwords.newPass} onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))} autoComplete="new-password" />
                  </Field>
                  {passwords.newPass && (
                    <div className="flex items-center gap-2" aria-label={`قوة كلمة المرور ${passStrength} من 4`}>
                      {[0, 1, 2, 3].map(i => (
                        <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < passStrength ? (passStrength >= 3 ? 'bg-success' : passStrength === 2 ? 'bg-warning' : 'bg-danger') : 'bg-track')} />
                      ))}
                      <span className="w-14 text-end text-xs text-muted">{['ضعيفة', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية'][passStrength]}</span>
                    </div>
                  )}
                  <Field label="تأكيد كلمة المرور الجديدة" required error={passwords.confirm && passwords.confirm !== passwords.newPass ? 'كلمتا المرور غير متطابقتين' : undefined}>
                    <Input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
                  </Field>
                  <Button type="submit" variant="dark" loading={passwordMut.isLoading} disabled={!passwords.current || !passwords.newPass}>تغيير كلمة المرور</Button>
                </form>
              </Card>

              <Card>
                <h3 className="mb-1 font-semibold text-ink">نشاط الحساب</h3>
                <InfoRow label="آخر تسجيل دخول">{user?.last_login_at ? fmtDateTime(user.last_login_at) : 'لا يوجد'}</InfoRow>
                <InfoRow label="عنوان IP"><span dir="ltr">{user?.last_login_ip || '—'}</span></InfoRow>
                <InfoRow label="آخر جهاز">{user?.last_login_device || '—'}</InfoRow>
                <InfoRow label="حالة الحساب">{user?.is_verified ? 'موثّق' : 'غير موثّق'}</InfoRow>
                <InfoRow label="التحقق الثنائي">{OTP_LABEL[otp.otp_mode] || otp.otp_mode}</InfoRow>
              </Card>

              <Card>
                <SectionTitle icon={ArrowRightOnRectangleIcon} title="الجلسات النشطة" />
                <p className="mb-4 text-sm text-muted">
                  إذا فقدت جهازًا أو اشتبهت في دخول غير مصرّح به، فأنهِ جميع الجلسات المفتوحة على كل المتصفحات والأجهزة، بما فيها هذا الجهاز. ستحتاج إلى تسجيل الدخول من جديد.
                </p>
                <Button variant="danger" icon={ArrowRightOnRectangleIcon} onClick={() => setLogoutAllOpen(true)}>
                  تسجيل الخروج من جميع الأجهزة
                </Button>
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* ── Devices ─────────────────────────────── */}
        <TabPanel idPrefix="settings" id="devices" active={tab}>
          <Card padding="none">
            <CardHeader icon={DevicePhoneMobileIcon} title="الأجهزة الموثوقة" subtitle="أجهزة لا يُطلب منها رمز تحقق عند تسجيل الدخول" divider />
            {devicesLoading ? (
              <div className="space-y-3 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : devicesError ? (
              <ErrorState className="m-5" message={apiError(devicesErr)} onRetry={() => refetchDevices()} />
            ) : activeDevices.length === 0 ? (
              <EmptyState size="sm" icon={ComputerDesktopIcon} title="لا توجد أجهزة موثوقة"
                description="عند تسجيل الدخول بالتحقق الثنائي واختيار «الوثوق بهذا الجهاز» سيظهر الجهاز هنا." />
            ) : (
              <ul className="divide-y divide-line-soft">
                {activeDevices.map(d => (
                  <li key={d.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-muted">
                      <ComputerDesktopIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{d.device_name || 'جهاز غير معروف'}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                        {d.ip_address && <span dir="ltr">{d.ip_address}</span>}
                        {d.last_used_at && <span>آخر استخدام {fmtDate(d.last_used_at)}</span>}
                        <span>ينتهي {fmtDate(d.expires_at)}</span>
                      </p>
                    </div>
                    <Tooltip content="إزالة الجهاز">
                      <Button size="icon-sm" variant="ghost" icon={TrashIcon} aria-label={`إزالة ${d.device_name || 'الجهاز'}`} className="text-muted hover:text-danger" onClick={() => setToRemove(d)} />
                    </Tooltip>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        {/* ── Preferences ─────────────────────────── */}
        <TabPanel idPrefix="settings" id="preferences" active={tab}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionTitle icon={LanguageIcon} title="اللغة والمنطقة الزمنية" subtitle="تُحفظ في حسابك وتُطبّق على كل أجهزتك" />
              <form className="space-y-4" onSubmit={e => { e.preventDefault(); profileMut.mutate({ language: profile.language, timezone: profile.timezone }) }}>
                <Field label="لغة الواجهة">
                  <Select value={profile.language || 'en'} onChange={e => setProfile(p => ({ ...p, language: e.target.value }))} options={LANG_OPTIONS} />
                </Field>
                <Field label="المنطقة الزمنية" hint="تُستخدم في جدولة الحملات وعرض الأوقات.">
                  <Select value={profile.timezone || 'UTC'} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))} options={TZ_OPTIONS} />
                </Field>
                <Button type="submit" loading={profileMut.isLoading}>حفظ التفضيلات</Button>
              </form>
            </Card>
            <Card>
              <SectionTitle icon={theme === 'dark' ? MoonIcon : SunIcon} title="المظهر" subtitle="يُحفظ على هذا الجهاز" />
              <div role="radiogroup" aria-label="المظهر" className="grid grid-cols-2 gap-3">
                {[{ id: 'light', label: 'فاتح', icon: SunIcon }, { id: 'dark', label: 'داكن', icon: MoonIcon }].map(o => {
                  const selected = theme === o.id
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={selected} onClick={() => setTheme(o.id)}
                      className={cn('overflow-hidden rounded-card border text-start transition', selected ? 'border-brand-teal shadow-ring' : 'border-line hover:border-line-strong')}>
                      <span aria-hidden="true" className={cn('block h-20 p-3', o.id === 'dark' ? 'bg-[#031B1E]' : 'bg-[#F3F7F6]')}>
                        <span className={cn('block h-3 w-16 rounded-full', o.id === 'dark' ? 'bg-[#0D3C41]' : 'bg-[#DDE8E6]')} />
                        <span className={cn('mt-2 block h-9 rounded-lg', o.id === 'dark' ? 'bg-[#062A2E]' : 'bg-white')} />
                      </span>
                      <span className="flex items-center justify-between gap-2 bg-surface px-3 py-2.5 text-sm font-medium text-ink">
                        <span className="flex items-center gap-2"><o.icon className="h-4 w-4" aria-hidden="true" />{o.label}</span>
                        {selected && <CheckIcon className="h-4 w-4 text-brand-ink" aria-hidden="true" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
        </TabPanel>

        {/* ── Notifications ───────────────────────── */}
        <TabPanel idPrefix="settings" id="notifications" active={tab}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <SectionTitle icon={BellIcon} title="مركز الإشعارات" subtitle="تنبيهات الحملات والرسائل والنظام" />
              <p className="text-sm leading-relaxed text-muted">تصلك الإشعارات داخل لوحة التحكم عبر الجرس في الشريط العلوي. راجعها كلها، أو علّمها كمقروءة، من مركز الإشعارات.</p>
              <Button className="mt-4" variant="secondary" iconEnd={ArrowLeftIcon} href="/dashboard/notifications">فتح مركز الإشعارات</Button>
            </Card>
            <Card>
              <SectionTitle icon={ExclamationTriangleIcon} title="تنبيهات الأمان" subtitle="عبر واتساب" />
              <p className="text-sm leading-relaxed text-muted">
                تصل رموز التحقق وتأكيد تغيير الرقم إلى رقم واتساب في ملفك الشخصي
                {user?.phone ? <> (<span dir="ltr">{user.phone}</span>)</> : ''}.
              </p>
              <Button className="mt-4" variant="ghost" onClick={() => changeTab('security')}>إعدادات الأمان</Button>
            </Card>
          </div>
        </TabPanel>
      </div>

      <ConfirmDialog
        destructive
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => { if (toRemove) removeDeviceMut.mutate(toRemove.id) }}
        loading={removeDeviceMut.isLoading}
        title="إزالة هذا الجهاز؟"
        description="سيُطلب رمز تحقق عند تسجيل الدخول التالي من هذا الجهاز."
        confirmLabel="إزالة"
      />

      <ConfirmDialog
        destructive
        open={logoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
        onConfirm={() => logoutAllMut.mutate()}
        loading={logoutAllMut.isLoading}
        title="تسجيل الخروج من جميع الأجهزة؟"
        description="ستُنهى كل الجلسات المفتوحة لحسابك فورًا، بما فيها الجلسة الحالية."
        confirmLabel="تسجيل الخروج"
      />
    </DashboardLayout>
  )
}
