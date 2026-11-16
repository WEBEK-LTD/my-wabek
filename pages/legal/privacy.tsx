import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'
import { legalList, legalText, legalToc } from '@/lib/legal-i18n'

export default function PrivacyPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, dir } = useT(messages)
  const L = (k: string) => legalText('privacy', lang, k)
  const LL = (k: string) => legalList('privacy', lang, k)

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      toc={legalToc('privacy', lang)}
      active="/legal/privacy"
      headTitle={`${L('t1')} | ${name}`}
      eyebrow={L('t2')}
      title={L('t1')}
      description={L('t3')}
      updated={L('t4')}
      meta={<><span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-chip-ink" dir="ltr">webek.org</span></>}
    >

      <div className="sec">
        <h2 className="st">{L('t5')}</h2>
        <h3 className="sh">{L('t6')}</h3>
        <p>{L('t7')}</p>
        <ul>
          {LL('l1').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <h3 className="sh">{L('t8')}</h3>
        <p>{L('t9')}</p>
        <ul>
          {LL('l2').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <h3 className="sh">{L('t10')}</h3>
        <ul>
          {LL('l3').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
          <p><strong>{L('t11')}</strong> {L('t12')}</p>
        </div>
        <h3 className="sh">{L('t13')}</h3>
        <p>{L('t14')}</p>
        <ul>
          {LL('l4').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t15')}</h2>
        <ul>
          {LL('l5').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <p><strong>{L('t16')}</strong> {L('t17')}</p>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{L('t18')}</h2>
        <p>{L('t19')}</p>
        <ul>
          <li><strong>Stripe</strong> — {L('t20')}</li>
          <li><strong>Meta / WhatsApp</strong> — {L('t21')}</li>
          <li><strong>Anthropic (Claude)</strong> — {L('t22')}</li>
          <li><strong>{L('t23')}</strong> — {L('t24')}</li>
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t25')}</h2>
        <p>{L('t26')}</p>
        <ul>
          {LL('l6').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t27')}</h2>
        <ul>
          {LL('l7').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <p>{L('t28')} <strong>privacy@waabek.com</strong> {L('t29')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t30')}</h2>
        <ul>
          {LL('l8').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t31')}</h2>
        <p>{L('t32')}</p>
        <ul>
          {LL('l9').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <p className="text-sm text-muted">{L('t33')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t34')}</h2>
        <p>{L('t35')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t36')}</h2>
        <ul>
          <li><strong>{L('t37')}</strong> privacy@waabek.com</li>
          <li><strong>{L('t38')}</strong> webek.org</li>
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <p>{L('t39')}</p>
        </div>
      </div>

      <div className="lfooter">
        <p className="text-xs text-muted">© 2025 webek.org — WABEK. {L('t40')}</p>
      </div>
    </LegalLayout>
  )
}
