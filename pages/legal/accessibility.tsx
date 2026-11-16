import React from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'
import { legalList, legalText } from '@/lib/legal-i18n'

// The statement exists in English and Arabic; French and Turkish visitors read the English text.
export default function AccessibilityPage() {
  const { brandName: wlName } = useWhiteLabel()
  const brandName = wlName || 'WABEK'
  const { t, lang, dir } = useT(messages)
  const docLang = lang === 'ar' ? 'ar' : 'en'
  const docDir = docLang === 'ar' ? 'rtl' : 'ltr'
  const L = (k: string) => legalText('accessibility', docLang, k).replace(/\{brand\}/g, brandName)
  const list = (k: string) => (
    <ul>
      {legalList('accessibility', docLang, k).map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      active="/legal/accessibility"
      headTitle={L('head_title')}
      eyebrow={t('mk_legal_doc')}
      title={<span dir={docDir} lang={docLang}>{L('title')}</span>}
      updated={<span dir={docDir} lang={docLang}>{L('updated')}</span>}
      docDir={docDir}
    >
      <div lang={docLang}>
        <section>
          <h2>{L('s1_h')}</h2>
          <p>{L('s1_p')}</p>
        </section>
        <section>
          <h2>{L('s2_h')}</h2>
          <p>{L('s2_p1_a')}<strong>{L('s2_p1_b')}</strong>{L('s2_p1_c')}</p>
          <p>{L('s2_p2')}</p>
          {list('s2')}
        </section>
        <section>
          <h2>{L('s3_h')}</h2>
          <p>{L('s3_p')}</p>
          {list('s3')}
        </section>
        <section>
          <h2>{L('s4_h')}</h2>
          <p>{L('s4_p')}</p>
          {list('s4')}
        </section>
        <section>
          <h2>{L('s5_h')}</h2>
          <p>{L('s5_p')}</p>
          {list('s5')}
        </section>
        <section>
          <h2>{L('s6_h')}</h2>
          <p>{L('s6_p1')}</p>
          <ul>
            <li><strong>{L('s6_email_l')}</strong> <span dir="ltr">accessibility@waabek.com</span></li>
            <li><strong>{L('s6_time_l')}</strong> {L('s6_time')}</li>
          </ul>
          <p>{L('s6_p2')}</p>
        </section>
        <section>
          <h2>{L('s7_h')}</h2>
          <p>{L('s7_p')}</p>
        </section>
      </div>
    </LegalLayout>
  )
}
