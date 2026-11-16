import React, { useState } from 'react'
import Head from 'next/head'
import axios from 'axios'
import { BookOpenIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, EnvelopeIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button, Field, Input, Textarea } from '@/components/ui'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { FaqList, IconTile } from '@/components/marketing/Blocks'
import { usePublicLang } from '@/components/marketing/usePublicLang'

const CHANNELS = [
  { icon: BookOpenIcon, tone: 'brand' as const, tk: 'support_docs_title', dk: 'support_docs_desc', cta: 'support_docs_cta', href: '/docs' },
  { icon: ChatBubbleLeftRightIcon, tone: 'success' as const, tk: 'support_chat_title', dk: 'support_chat_desc', cta: 'support_chat_cta', href: '#contact' },
  { icon: EnvelopeIcon, tone: 'violet' as const, tk: 'support_email_title', dk: 'support_email_desc', cta: 'support_email_cta', href: '#contact' },
]

const FAQS = [1, 2, 3, 4, 5, 6]

export default function SupportPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, t } = usePublicLang()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formDone, setFormDone] = useState(false)
  const [formError, setFormError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.subject || !form.message) { setFormError(t('mk_required')); return }
    setFormLoading(true); setFormError('')
    try {
      await axios.post('/api/status/contact', form)
      setFormDone(true)
    } catch (err: any) {
      setFormError(err?.response?.data?.error || t('mk_send_failed'))
    }
    setFormLoading(false)
  }

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`${t('support_title')} | ${name}`}</title>
      </Head>
      <MarketingPage
        active="/support"
        lang={lang}
        dir={dir}
        onLangChange={setLang}
        hero={<PageHero eyebrow={t('support')} title={t('support_title')} subtitle={t('support_subtitle')} className="pb-28 sm:pb-32" />}
      >
        {/* Channels */}
        <section className="relative mx-auto -mt-20 max-w-[1280px] px-4 sm:px-8">
          <ul className="grid gap-4 md:grid-cols-3">
            {CHANNELS.map(c => (
              <li key={c.tk} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:p-7">
                <IconTile icon={c.icon} tone={c.tone} size="lg" />
                <h2 className="text-lg font-semibold text-ink">{t(c.tk)}</h2>
                <p className="flex-1 text-[15px] leading-[1.85] text-body">{t(c.dk)}</p>
                <Button href={c.href} variant="secondary" size="sm" className="w-fit">{t(c.cta)}</Button>
              </li>
            ))}
          </ul>
        </section>

        <Section title={t('support_faq_title')} narrow>
          <FaqList items={FAQS.map(n => ({ q: t(`support_faq${n}_q`), a: t(`support_faq${n}_a`) }))} />
        </Section>

        {/* Contact form */}
        <Section id="contact" title={t('support_form_title')} subtitle={t('support_form_subtitle')} narrow className="scroll-mt-24 pt-4">
          <div className="mx-auto max-w-2xl rounded-panel border border-line bg-surface p-6 shadow-card sm:p-8">
            {formDone ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
                  <CheckCircleIcon className="h-9 w-9" aria-hidden="true" />
                </span>
                <p className="text-lg font-semibold text-ink">{t('mk_support_sent_title')}</p>
                <p className="text-sm text-body">{t('mk_support_sent_body')}</p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('support_name')} required>
                    <Input value={form.name} onChange={set('name')} placeholder={t('support_name_ph')} autoComplete="name" />
                  </Field>
                  <Field label={t('support_email')} required>
                    <Input type="email" dir="ltr" value={form.email} onChange={set('email')} placeholder={t('support_email_ph')} autoComplete="email" />
                  </Field>
                </div>
                <Field label={t('support_subject')} required>
                  <Input value={form.subject} onChange={set('subject')} placeholder={t('support_subject_ph')} />
                </Field>
                <Field label={t('support_message')} required>
                  <Textarea rows={5} value={form.message} onChange={set('message')} placeholder={t('support_message_ph')} />
                </Field>
                {formError && <p role="alert" className="rounded-btn bg-danger-bg px-3.5 py-2.5 text-sm text-danger">{formError}</p>}
                <Button type="submit" size="lg" loading={formLoading} icon={PaperAirplaneIcon} className="rtl:[&_svg]:-scale-x-100">
                  {formLoading ? t('mk_sending') : t('support_send')}
                </Button>
              </form>
            )}
          </div>
        </Section>
      </MarketingPage>
    </>
  )
}
