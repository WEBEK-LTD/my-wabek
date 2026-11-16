import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'
import { legalList, legalText, legalToc } from '@/lib/legal-i18n'

export default function TermsPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, dir } = useT(messages)
  const L = (k: string) => legalText('terms', lang, k)
  const LL = (k: string) => legalList('terms', lang, k)

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      toc={legalToc('terms', lang)}
      active="/legal/terms"
      headTitle={`${L('t1')} | ${name}`}
      eyebrow={L('t2')}
      title={L('t1')}
      description={L('t3')}
      updated={L('t4')}
      meta={<><span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-chip-ink" dir="ltr">webek.org</span></>}
    >

      <div className="icard">
        <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <p>{L('t5')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t6')}</h2>
        <p>{L('t7')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t8')}</h2>
        <p>{L('t9')}</p>
        <ul>
          {LL('l1').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t10')}</h2>
        <p>{L('t11')}</p>
        <ul>
          {LL('l2').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="wcard">
          <div className="wcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <p>{L('t12')}</p>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{L('t13')}</h2>
        <ul>
          {LL('l3').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t14')}</h2>
        <p>{L('t15')}</p>
        <ul>
          <li><a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener">WhatsApp Business Policy</a></li>
          <li><a href="https://www.whatsapp.com/legal/commerce-policy" target="_blank" rel="noopener">WhatsApp Commerce Policy</a></li>
          <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener">Meta Platform Terms</a></li>
        </ul>
        <p>{L('t16')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t17')}</h2>
        <p>{L('t18')}</p>
        <ul>
          {LL('l4').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t19')}</h2>
        <ul>
          {LL('l5').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t20')}</h2>
        <ul>
          {LL('l6').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t21')}</h2>
        <ul>
          {LL('l7').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t22')}</h2>
        <p>{L('t23')}</p>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <p>webek.org — {L('t24')}</p>
        </div>
      </div>

      <div className="lfooter">
        <p className="text-xs text-muted">© 2025 webek.org — WABEK. {L('t25')}</p>
      </div>
    </LegalLayout>
  )
}
