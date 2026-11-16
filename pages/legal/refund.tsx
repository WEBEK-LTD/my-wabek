import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'
import { legalList, legalText, legalToc } from '@/lib/legal-i18n'

export default function RefundPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, dir } = useT(messages)
  const L = (k: string) => legalText('refund', lang, k)
  const LL = (k: string) => legalList('refund', lang, k)

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      toc={legalToc('refund', lang)}
      active="/legal/refund"
      headTitle={`${L('t1')} | ${name}`}
      eyebrow={L('t2')}
      title={L('t1')}
      description={L('t3')}
      updated={L('t4')}
      meta={<><span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-chip-ink" dir="ltr">webek.org</span></>}
    >

      {/* Summary table */}
      <div className="sec">
        <h2 className="st">{L('t5')}</h2>
        <div className="ftable">
          <table>
            <thead><tr>
              <th>{L('t6')}</th>
              <th>{L('t7')}</th>
              <th>{L('t8')}</th>
            </tr></thead>
            <tbody>
              <tr>
                <td><strong>{L('t9')}</strong></td>
                <td><span className="pr pr-red">{L('t10')}</span></td>
                <td className="text-muted">N/A</td>
              </tr>
              <tr>
                <td><strong>{L('t11')}</strong></td>
                <td><span className="pr pr-green">{L('t12')}</span></td>
                <td>{L('t13')}</td>
              </tr>
              <tr>
                <td><strong>{L('t14')}</strong></td>
                <td><span className="pr pr-green">{L('t15')}</span></td>
                <td>{L('t13')}</td>
              </tr>
              <tr>
                <td><strong>{L('t16')}</strong></td>
                <td><span className="pr pr-amber">{L('t17')}</span></td>
                <td>{L('t18')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="sec">
        <h2 className="st">{L('t19')}</h2>
        <ul>
          {LL('l1').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t20')}</h2>
        <p>{L('t21')}</p>
        <ul>
          {LL('l2').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t22')}</h2>
        <p>{L('t23')}</p>
        <ul>
          {LL('l3').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t24')}</h2>
        <p>{L('t25')}</p>
        <ul>
          {LL('l4').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{L('t26')}</h2>
        <p>{L('t27')} <strong>billing@waabek.com</strong> {L('t28')}</p>
        <ul>
          {LL('l5').map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <p>{L('t29')}</p>
        </div>
      </div>

      <div className="lfooter">
        <p className="text-xs text-muted">© 2025 webek.org — WABEK. {L('t30')}</p>
      </div>
    </LegalLayout>
  )
}
