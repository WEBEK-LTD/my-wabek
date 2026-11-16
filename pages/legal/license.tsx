import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'
import { legalList, legalText, legalToc } from '@/lib/legal-i18n'

export default function LicensePage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, dir } = useT(messages)
  const L = (k: string) => legalText('license', lang, k)
  const LL = (k: string) => legalList('license', lang, k)

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      toc={legalToc('license', lang)}
      active="/legal/license"
      headTitle={`${L('t1')} | ${name}`}
      eyebrow={L('t2')}
      title={L('t1')}
      description={L('t3')}
      updated={L('t4')}
      meta={<><span className="rounded-full bg-violet-bg px-3 py-1 text-xs font-medium text-violet" dir="ltr">Proprietary</span><span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-chip-ink" dir="ltr">webek.org</span></>}
    >

      {/* Owner box */}
      <div className="owner-box">
        <div className="owner-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <p className="mb-1.5 text-sm font-bold">
          {L('t5')}
        </p>
        <p className="owner-name mb-2 text-[32px] font-bold leading-none" dir="ltr">webek.org</p>
        <p className="text-[13px]">
          {L('t6')}
        </p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t7')}</h2>
        <p>{L('t8')}</p>
        <ul>
          {LL('l1').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t9')}</h2>
        <p>{L('t10')}</p>
        <ul>
          {LL('l2').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="wcard">
          <div className="wcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <p>{L('t11')}</p>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{L('t12')}</h2>
        <p>{L('t13')}</p>
        <ul>
          {LL('l3').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t14')}</h2>
        <p>{L('t15')}</p>
      </div>

      <div className="sec">
        <h2 className="st">{L('t16')}</h2>
        <p>{L('t17')} <strong>resellers@waabek.com</strong></p>
        <div className="pcard">
          <div className="pcard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
          <p>{L('t18')}</p>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{L('t19')}</h2>
        <p>{L('t20')}</p>
        <ul>
          {LL('l4').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="lfooter">
        <p className="text-sm font-bold text-ink">WABEK — webek.org</p>
        <p className="text-xs text-violet">
          {L('t21')}
        </p>
        <p className="text-xs text-muted">
          {L('t22')}
        </p>
      </div>
    </LegalLayout>
  )
}
