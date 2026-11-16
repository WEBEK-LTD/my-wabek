import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import axios from 'axios'
import {
  ArrowPathIcon, BellAlertIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, CheckIcon, CircleStackIcon,
  ClockIcon, ComputerDesktopIcon, CpuChipIcon, DevicePhoneMobileIcon, EnvelopeIcon, ExclamationTriangleIcon,
  LinkIcon, PaperAirplaneIcon, ServerStackIcon, ShieldCheckIcon, Squares2X2Icon, WrenchScrewdriverIcon, XCircleIcon,
} from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Skeleton, Tabs, Textarea, Tooltip } from '@/components/ui'
import type { Tone } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { MarketingPage, PageHero } from '@/components/marketing/MarketingPage'
import { usePublicLang } from '@/components/marketing/usePublicLang'

// Country codes for phone subscription
const COUNTRIES = [
  { code: '+966', name: 'Saudi Arabia' },
  { code: '+971', name: 'UAE' },
  { code: '+965', name: 'Kuwait' },
  { code: '+974', name: 'Qatar' },
  { code: '+973', name: 'Bahrain' },
  { code: '+968', name: 'Oman' },
  { code: '+20', name: 'Egypt' },
  { code: '+90', name: 'Turkey' },
  { code: '+1', name: 'USA' },
  { code: '+44', name: 'UK' },
  { code: '+33', name: 'France' },
  { code: '+49', name: 'Germany' },
]

type L = Record<string, string>

const SERVICES: { key: string; icon: React.ElementType; name: L }[] = [
  { key: 'api', icon: ServerStackIcon, name: { en: 'API and Core Platform', ar: 'واجهة API والمنصة الأساسية', fr: 'API et plateforme principale', tr: 'API ve Çekirdek Platform' } },
  { key: 'whatsapp', icon: ChatBubbleLeftRightIcon, name: { en: 'WhatsApp Message Delivery', ar: 'تسليم رسائل واتساب', fr: 'Livraison des messages WhatsApp', tr: 'WhatsApp Mesaj Teslimi' } },
  { key: 'dashboard', icon: Squares2X2Icon, name: { en: 'Dashboard and Web App', ar: 'لوحة التحكم وتطبيق الويب', fr: 'Tableau de bord et application web', tr: 'Panel ve Web Uygulaması' } },
  { key: 'campaigns', icon: PaperAirplaneIcon, name: { en: 'Bulk Campaigns', ar: 'الحملات الجماعية', fr: 'Campagnes en masse', tr: 'Toplu Kampanyalar' } },
  { key: 'chatbot', icon: CpuChipIcon, name: { en: 'Chatbot Engine', ar: 'محرك روبوت المحادثة', fr: 'Moteur de chatbot', tr: 'Sohbet Botu Motoru' } },
  { key: 'auth', icon: ShieldCheckIcon, name: { en: 'Authentication and OTP', ar: 'المصادقة ورموز التحقق OTP', fr: 'Authentification et OTP', tr: 'Kimlik Doğrulama ve OTP' } },
  { key: 'webhooks', icon: LinkIcon, name: { en: 'Webhooks and Integrations', ar: 'Webhooks والتكاملات', fr: 'Webhooks et intégrations', tr: "Webhook'lar ve Entegrasyonlar" } },
  { key: 'storage', icon: CircleStackIcon, name: { en: 'File Storage and Media', ar: 'تخزين الملفات والوسائط', fr: 'Stockage de fichiers et médias', tr: 'Dosya Depolama ve Medya' } },
]

const STATUS_META: Record<string, { tone: Tone; dot: string; label: L }> = {
  operational: { tone: 'success', dot: 'bg-[#22A06B]', label: { en: 'Operational', ar: 'يعمل', fr: 'Opérationnel', tr: 'Çalışıyor' } },
  degraded: { tone: 'warning', dot: 'bg-[#E08A3C]', label: { en: 'Degraded', ar: 'أداء منخفض', fr: 'Dégradé', tr: 'Düşük performans' } },
  outage: { tone: 'danger', dot: 'bg-danger-solid', label: { en: 'Outage', ar: 'متوقف', fr: 'Panne', tr: 'Kesinti' } },
  maintenance: { tone: 'violet', dot: 'bg-violet', label: { en: 'Maintenance', ar: 'صيانة', fr: 'Maintenance', tr: 'Bakım' } },
}

const INCIDENT_STATUS: Record<string, { tone: Tone; label: L }> = {
  resolved: { tone: 'success', label: { en: 'Resolved', ar: 'تم الحل', fr: 'Résolu', tr: 'Çözüldü' } },
  investigating: { tone: 'danger', label: { en: 'Investigating', ar: 'قيد التحقيق', fr: 'Enquête en cours', tr: 'İnceleniyor' } },
  identified: { tone: 'warning', label: { en: 'Identified', ar: 'تم تحديد السبب', fr: 'Identifié', tr: 'Tespit edildi' } },
  monitoring: { tone: 'violet', label: { en: 'Monitoring', ar: 'قيد المراقبة', fr: 'Surveillance', tr: 'İzleniyor' } },
}

const S: Record<string, L> = {
  title: { en: 'System Status', ar: 'حالة الخدمة', fr: 'État du système', tr: 'Sistem Durumu' },
  all_ok: { en: 'All systems operational', ar: 'جميع الأنظمة تعمل', fr: 'Tous les systèmes sont opérationnels', tr: 'Tüm sistemler çalışıyor' },
  some: { en: 'Some systems affected', ar: 'بعض الأنظمة متأثرة', fr: 'Certains systèmes sont affectés', tr: 'Bazı sistemler etkilendi' },
  disruption: { en: 'Service disruption detected', ar: 'رُصد انقطاع في الخدمة', fr: 'Perturbation du service détectée', tr: 'Hizmet kesintisi tespit edildi' },
  updated: { en: 'Last updated', ar: 'آخر تحديث', fr: 'Dernière mise à jour', tr: 'Son güncelleme' },
  refresh: { en: 'Refresh', ar: 'تحديث', fr: 'Actualiser', tr: 'Yenile' },
  current: { en: 'Current Status', ar: 'الحالة الحالية', fr: 'État actuel', tr: 'Mevcut Durum' },
  all_operational: { en: 'All operational', ar: 'الكل يعمل', fr: 'Tout est opérationnel', tr: 'Hepsi çalışıyor' },
  incidents_detected: { en: 'Incidents detected', ar: 'رُصدت أعطال', fr: 'Incidents détectés', tr: 'Olay tespit edildi' },
  history: { en: 'Last 90 days', ar: 'آخر 90 يومًا', fr: '90 derniers jours', tr: 'Son 90 gün' },
  history_legend: { en: 'Days with a reported incident', ar: 'أيام شهدت عطلًا مُبلَّغًا عنه', fr: 'Jours avec un incident signalé', tr: 'Olay bildirilen günler' },
  no_incident_day: { en: 'No incidents reported', ar: 'لم يُبلَّغ عن أعطال', fr: 'Aucun incident signalé', tr: 'Bildirilen olay yok' },
  past: { en: 'Past Incidents', ar: 'الأعطال السابقة', fr: 'Incidents passés', tr: 'Geçmiş Olaylar' },
  no_incidents: { en: 'No incidents reported in the last 90 days', ar: 'لم يُبلَّغ عن أي أعطال خلال آخر 90 يومًا', fr: 'Aucun incident signalé au cours des 90 derniers jours', tr: 'Son 90 günde bildirilen olay yok' },
  load_error: { en: "We couldn't load the live status right now.", ar: 'تعذّر تحميل الحالة المباشرة حاليًا.', fr: "Impossible de charger l'état en direct pour le moment.", tr: 'Canlı durum şu anda yüklenemedi.' },
  retry: { en: 'Try again', ar: 'إعادة المحاولة', fr: 'Réessayer', tr: 'Tekrar dene' },
  sub_title: { en: 'Get incident notifications', ar: 'تلقَّ إشعارات الأعطال', fr: 'Recevoir les notifications d’incident', tr: 'Olay bildirimleri alın' },
  sub_desc: { en: 'Choose how you want to be notified when an incident starts or resolves.', ar: 'اختر طريقة إشعارك عند بدء أي عطل أو حلّه.', fr: 'Choisissez comment être prévenu au début ou à la résolution d’un incident.', tr: 'Bir olay başladığında veya çözüldüğünde nasıl bilgilendirileceğinizi seçin.' },
  email: { en: 'Email', ar: 'البريد الإلكتروني', fr: 'E-mail', tr: 'E-posta' },
  phone: { en: 'Phone', ar: 'الهاتف', fr: 'Téléphone', tr: 'Telefon' },
  country: { en: 'Country code', ar: 'رمز الدولة', fr: 'Indicatif', tr: 'Ülke kodu' },
  subscribe: { en: 'Subscribe', ar: 'اشترك', fr: "S'abonner", tr: 'Abone ol' },
  subscribed: { en: 'Subscribed successfully!', ar: 'تم الاشتراك بنجاح.', fr: 'Abonnement réussi !', tr: 'Abonelik başarılı!' },
  invalid: { en: 'Please enter a valid value', ar: 'يُرجى إدخال قيمة صحيحة', fr: 'Veuillez saisir une valeur valide', tr: 'Lütfen geçerli bir değer girin' },
  sub_failed: { en: 'Failed to subscribe', ar: 'تعذّر الاشتراك', fr: "Échec de l'abonnement", tr: 'Abonelik başarısız' },
  contact_title: { en: 'Send Us a Message', ar: 'راسلنا', fr: 'Envoyez-nous un message', tr: 'Bize Mesaj Gönderin' },
  contact_desc: { en: 'We respond to all messages within 24 hours on business days.', ar: 'نرد على جميع الرسائل خلال 24 ساعة في أيام العمل.', fr: 'Nous répondons à tous les messages sous 24 heures les jours ouvrés.', tr: 'Tüm mesajlara iş günlerinde 24 saat içinde yanıt veriyoruz.' },
  name: { en: 'Your Name', ar: 'الاسم', fr: 'Votre nom', tr: 'Adınız' },
  email_addr: { en: 'Email Address', ar: 'البريد الإلكتروني', fr: 'Adresse e-mail', tr: 'E-posta adresi' },
  subject: { en: 'Subject', ar: 'الموضوع', fr: 'Objet', tr: 'Konu' },
  message: { en: 'Your message', ar: 'رسالتك', fr: 'Votre message', tr: 'Mesajınız' },
  send: { en: 'Send Message', ar: 'أرسل الرسالة', fr: 'Envoyer le message', tr: 'Mesajı Gönder' },
  sending: { en: 'Sending...', ar: 'جارٍ الإرسال…', fr: 'Envoi…', tr: 'Gönderiliyor…' },
  required: { en: 'All fields required', ar: 'جميع الحقول مطلوبة', fr: 'Tous les champs sont obligatoires', tr: 'Tüm alanlar zorunludur' },
  send_failed: { en: 'Failed to send', ar: 'تعذّر الإرسال', fr: "Échec de l'envoi", tr: 'Gönderilemedi' },
  sent: { en: "Message sent! We'll get back to you soon.", ar: 'أُرسلت رسالتك، وسنعود إليك قريبًا.', fr: 'Message envoyé ! Nous revenons vers vous rapidement.', tr: 'Mesaj gönderildi! Yakında size dönüş yapacağız.' },
}

const DAY = 86400000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)

export default function StatusPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, pick } = usePublicLang()
  const T = (k: string) => pick(S[k])
  const locale = lang === 'ar' ? 'ar-EG' : lang

  const [svcStatus, setSvcStatus] = useState<Record<string, string>>({})
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  // Subscribe state
  const [subType, setSubType] = useState<'email' | 'phone'>('email')
  const [subEmail, setSubEmail] = useState('')
  const [subPhone, setSubPhone] = useState('')
  const [subCountry, setSubCountry] = useState('+966')
  const [subLoading, setSubLoading] = useState(false)
  const [subDone, setSubDone] = useState(false)
  const [subError, setSubError] = useState('')

  // Contact form
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formDone, setFormDone] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    setLoadError(false)
    Promise.all([
      axios.get('/api/admin/service-status'),
      axios.get('/api/status/incidents'),
    ]).then(([s, i]) => {
      setSvcStatus(s.data.services || {})
      setIncidents(i.data.incidents || [])
      setCheckedAt(new Date())
    }).catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    const value = subType === 'email' ? subEmail.trim() : `${subCountry}${subPhone.trim()}`
    if (subType === 'email' ? !subEmail.trim() : !subPhone.trim()) { setSubError(T('invalid')); return }
    setSubLoading(true); setSubError('')
    try {
      await axios.post('/api/status/subscribe', {
        type: subType,
        value,
        country_code: subType === 'phone' ? subCountry : null,
      })
      setSubDone(true)
    } catch (err: any) {
      setSubError(err?.response?.data?.error || T('sub_failed'))
    }
    setSubLoading(false)
  }

  async function sendContact(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.subject || !form.message) { setFormError(T('required')); return }
    setFormLoading(true); setFormError('')
    try {
      await axios.post('/api/status/contact', form)
      setFormDone(true)
    } catch (err: any) {
      setFormError(err?.response?.data?.error || T('send_failed'))
    }
    setFormLoading(false)
  }

  const getStatus = (key: string) => (STATUS_META[svcStatus[key]] ? svcStatus[key] : 'operational')
  const allOk = SERVICES.every(s => getStatus(s.key) === 'operational')
  const hasOutage = SERVICES.some(s => getStatus(s.key) === 'outage')
  const overall = hasOutage ? 'outage' : !allOk ? 'degraded' : 'operational'
  const overallText = hasOutage ? T('disruption') : !allOk ? T('some') : T('all_ok')
  const OverallIcon = hasOutage ? XCircleIcon : !allOk ? ExclamationTriangleIcon : CheckCircleIcon

  // 90-day strip from the reported incidents (no invented uptime figure).
  const days = useMemo(() => {
    const byDay = new Map<string, any[]>()
    for (const inc of incidents) {
      if (!inc?.incident_date) continue
      const k = dayKey(new Date(inc.incident_date))
      byDay.set(k, [...(byDay.get(k) || []), inc])
    }
    const today = new Date()
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date(today.getTime() - (89 - i) * DAY)
      return { date: d, incidents: byDay.get(dayKey(d)) || [] }
    })
  }, [incidents])

  const ringColor = overall === 'outage' ? 'bg-danger-solid' : overall === 'degraded' ? 'bg-[#E08A3C]' : 'bg-brand-green'

  return (<>
    <Head>
      <link rel="icon" href="/brand/favicon-32.png" />
      <title>{`${T('title')} | ${name}`}</title>
    </Head>
    <MarketingPage
      active="/status"
      lang={lang}
      dir={dir}
      onLangChange={setLang}
      hero={
        <PageHero title={T('title')} className="pb-28 sm:pb-32">
          <div className="flex flex-col items-center gap-3" aria-live="polite">
            {loading ? (
              <Skeleton className="h-10 w-72 opacity-30" />
            ) : loadError ? (
              <p className="text-lg font-semibold text-deep-muted">{T('load_error')}</p>
            ) : (
              <p className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] py-2 pe-5 ps-2 text-lg font-semibold text-deep-ink">
                <span className="relative flex h-8 w-8 items-center justify-center">
                  <span aria-hidden="true" className={cn('absolute inset-0 animate-ping rounded-full opacity-40', ringColor)} />
                  <span className={cn('relative flex h-8 w-8 items-center justify-center rounded-full text-[#04282C]', ringColor)}>
                    <OverallIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </span>
                {overallText}
              </p>
            )}
            {checkedAt && (
              <p className="text-xs text-deep-muted">
                {T('updated')}: <time dateTime={checkedAt.toISOString()}>{checkedAt.toLocaleString(locale)}</time>
              </p>
            )}
          </div>
        </PageHero>
      }
    >
      <div className="relative mx-auto -mt-20 flex max-w-[860px] flex-col gap-6 px-4 pb-20 sm:px-8">
        {/* Services */}
        <Card padding="none">
          <CardHeader
            title={T('current')}
            icon={ComputerDesktopIcon}
            divider
            className="px-5 py-4 sm:px-6"
            action={!loading && !loadError && (
              <Badge tone={allOk ? 'success' : 'warning'} dot>{allOk ? T('all_operational') : T('incidents_detected')}</Badge>
            )}
          />
          {loading ? (
            <ul className="divide-y divide-line-soft" aria-busy="true">
              {SERVICES.map(s => (
                <li key={s.key} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-20" />
                </li>
              ))}
            </ul>
          ) : loadError ? (
            <EmptyState
              size="sm"
              icon={ExclamationTriangleIcon}
              title={T('load_error')}
              action={<Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={load}>{T('retry')}</Button>}
            />
          ) : (
            <ul className="divide-y divide-line-soft">
              {SERVICES.map(svc => {
                const meta = STATUS_META[getStatus(svc.key)]
                const Icon = svc.icon
                return (
                  <li key={svc.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-2 sm:px-6">
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-chip text-chip-ink" aria-hidden="true"><Icon className="h-[18px] w-[18px]" /></span>
                      <span className="text-sm font-medium text-ink">{pick(svc.name)}</span>
                    </span>
                    <Badge tone={meta.tone} dot>{pick(meta.label)}</Badge>
                  </li>
                )
              })}
            </ul>
          )}

          {/* 90-day incident strip */}
          {!loading && !loadError && (
            <div className="border-t border-line-soft px-5 py-5 sm:px-6">
              <div className="mb-3 flex items-center justify-between text-xs text-muted">
                <span>{T('history')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#E08A3C]" aria-hidden="true" />{T('history_legend')}</span>
              </div>
              <div dir="ltr" className="flex h-8 gap-[2px]">
                {days.map(d => {
                  const label = `${d.date.toLocaleDateString(locale)} · ${d.incidents.length ? d.incidents.map(i => i.title).join('، ') : T('no_incident_day')}`
                  return (
                    <Tooltip key={dayKey(d.date)} content={label}>
                      <span
                        tabIndex={d.incidents.length ? 0 : -1}
                        aria-label={label}
                        className={cn('min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-70', d.incidents.length ? 'bg-[#E08A3C]' : 'bg-brand-teal/70')}
                      />
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Past incidents */}
        <Card padding="none" className={cn(loadError && 'hidden')}>
          <CardHeader title={T('past')} icon={ClockIcon} divider className="px-5 py-4 sm:px-6" />
          {loading ? (
            <div className="p-6"><Skeleton lines={3} /></div>
          ) : loadError ? null : incidents.length === 0 ? (
            <EmptyState size="sm" icon={CheckCircleIcon} title={T('no_incidents')} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {incidents.map(inc => {
                const ist = INCIDENT_STATUS[inc.status] || INCIDENT_STATUS.resolved
                return (
                  <li key={inc.id} className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{inc.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1"><CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />{new Date(inc.incident_date).toLocaleDateString(locale)}</span>
                        {inc.duration && <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />{inc.duration}</span>}
                      </p>
                    </div>
                    <Badge tone={ist.tone} className="shrink-0">{pick(ist.label)}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Subscribe */}
        <Card variant="deep" padding="lg" className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute -end-20 -top-20 h-64 w-64 rounded-full bg-brand-green/10 blur-3xl" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-green" aria-hidden="true"><BellAlertIcon className="h-5 w-5" /></span>
              <div>
                <h2 className="text-lg font-semibold text-deep-ink">{T('sub_title')}</h2>
                <p className="mt-1 text-sm text-deep-muted">{T('sub_desc')}</p>
              </div>
            </div>
            {subDone ? (
              <p role="status" className="inline-flex items-center gap-2 font-semibold text-brand-green">
                <CheckIcon className="h-5 w-5" aria-hidden="true" />{T('subscribed')}
              </p>
            ) : (
              <form onSubmit={subscribe} noValidate className="flex flex-col gap-3">
                <div className="w-fit rounded-btn bg-surface p-0.5">
                  <Tabs
                    variant="segmented"
                    size="sm"
                    idPrefix="status-sub"
                    aria-label={T('sub_title')}
                    value={subType}
                    onChange={v => { setSubType(v as 'email' | 'phone'); setSubError('') }}
                    tabs={[{ id: 'email', label: T('email'), icon: EnvelopeIcon }, { id: 'phone', label: T('phone'), icon: DevicePhoneMobileIcon }]}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {subType === 'email' ? (
                    <Field label={T('email')} srOnlyLabel className="flex-1">
                      <Input type="email" dir="ltr" value={subEmail} onChange={e => setSubEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" />
                    </Field>
                  ) : (
                    <div className="flex flex-1 gap-2" dir="ltr">
                      <Field label={T('country')} srOnlyLabel className="w-36 shrink-0">
                        <Select value={subCountry} onChange={e => setSubCountry(e.target.value)} options={COUNTRIES.map(c => ({ value: c.code, label: `${c.code} ${c.name}` }))} />
                      </Field>
                      <Field label={T('phone')} srOnlyLabel className="flex-1">
                        <Input type="tel" inputMode="tel" value={subPhone} onChange={e => setSubPhone(e.target.value)} placeholder="501234567" autoComplete="tel-national" />
                      </Field>
                    </div>
                  )}
                  <Button type="submit" loading={subLoading} className="shrink-0">{T('subscribe')}</Button>
                </div>
                {subError && <p role="alert" className="text-sm text-[#FDA4AF]">{subError}</p>}
              </form>
            )}
          </div>
        </Card>

        {/* Contact Form */}
        <Card padding="lg">
          <CardHeader title={T('contact_title')} subtitle={T('contact_desc')} icon={EnvelopeIcon} />
          {formDone ? (
            <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success"><CheckCircleIcon className="h-8 w-8" aria-hidden="true" /></span>
              <p className="font-semibold text-ink">{T('sent')}</p>
            </div>
          ) : (
            <form onSubmit={sendContact} noValidate className="mt-5 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={T('name')} required><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="name" /></Field>
                <Field label={T('email_addr')} required><Input type="email" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoComplete="email" /></Field>
              </div>
              <Field label={T('subject')} required><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></Field>
              <Field label={T('message')} required><Textarea rows={4} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} /></Field>
              {formError && <p role="alert" className="rounded-btn bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{formError}</p>}
              <Button type="submit" size="lg" loading={formLoading} icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100">
                {formLoading ? T('sending') : T('send')}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </MarketingPage>
  </>)
}
