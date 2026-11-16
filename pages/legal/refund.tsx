// @ts-nocheck
import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'

export default function RefundPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  useEffect(() => {
    const h = (e:any) => { setLang(e.detail); localStorage.setItem('lang', e.detail) }
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  const dir = lang==='ar'?'rtl':'ltr'
  const isAr = lang==='ar', isFr = lang==='fr', isTr = lang==='tr'
  const T = (en:string,ar:string,fr:string,tr:string) => isAr?ar:isFr?fr:isTr?tr:en

  return (<>
    <Head>
      <link rel="icon" href="/brand/favicon-32.png" /><title>{T('Refund Policy','سياسة الاسترداد','Politique de remboursement','İade Politikası')} | {name}</title></Head>
    <div className="lpage">
      <PublicNav active="/legal/refund" onLangChange={setLang} />
      <style>{`
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111b21;background:#fff}
        .lw{max-width:820px;margin:0 auto;padding:40px 24px 80px;direction:${dir}}
        .hero{background:linear-gradient(135deg,#f0fdf4 0%,#fff 60%);border:1px solid #e9edef;border-radius:16px;padding:36px 32px 28px;margin-bottom:32px;position:relative;overflow:hidden}
        .hero::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,#25D36612 0%,transparent 70%);pointer-events:none}
        .hero-ey{font-size:11px;font-weight:700;color:#25D366;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .hero-ey span{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:100px;padding:2px 10px}
        .hero h1{font-size:clamp(22px,4vw,34px);font-weight:800;color:#111b21;line-height:1.15;margin-bottom:10px}
        .hero-desc{font-size:14px;color:#54656f;line-height:1.75;max-width:560px;margin-bottom:20px}
        .hero-meta{display:flex;gap:8px;flex-wrap:wrap}
        .hbadge{background:#f9fafb;border:1px solid #e9edef;border-radius:100px;padding:3px 12px;font-size:12px;color:#54656f}
        .hbadge.green{background:#f0fdf4;border-color:#bbf7d0;color:#166534}
        .lnav{display:flex;gap:6px;flex-wrap:wrap;margin-top:18px}
        .lnav a{font-size:12px;font-weight:600;padding:5px 14px;border:1px solid #e9edef;border-radius:100px;color:#54656f;text-decoration:none;background:#fff}
        .lnav a.on{border-color:#25D366;color:#25D366;background:#f0fdf4}
        .sec{margin-bottom:36px}
        .st{font-size:16px;font-weight:700;color:#111b21;margin-bottom:14px;padding-bottom:10px;border-bottom:1.5px solid #f0f2f5;display:flex;align-items:center;gap:10px}
        .st::before{content:'';display:inline-block;width:3px;height:16px;background:#25D366;border-radius:2px;flex-shrink:0}
        .sec p{font-size:14px;color:#54656f;line-height:1.85;margin-bottom:12px}
        .sec ul{padding-${isAr?'right':'left'}:20px;margin-bottom:14px}
        .sec li{font-size:14px;color:#54656f;line-height:1.85;margin-bottom:5px}
        .sec strong{color:#111b21;font-weight:600}
        .icard{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;margin:14px 0;display:flex;gap:12px;align-items:flex-start}
        .icard-i{width:30px;height:30px;background:#25D366;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .icard p{margin:0;font-size:13px;color:#374151;line-height:1.7}
        .ftable{border:1px solid #e9edef;border-radius:12px;overflow:hidden;margin:20px 0}
        .ftable table{width:100%;border-collapse:collapse;font-size:13px}
        .ftable th{background:#f9fafb;color:#374151;padding:11px 16px;text-align:${isAr?'right':'left'};font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #e9edef}
        .ftable td{padding:12px 16px;color:#54656f;border-bottom:1px solid #f9fafb}
        .ftable tr:last-child td{border-bottom:none}
        .ftable tr:hover td{background:#f9fafb}
        .ftable strong{color:#111b21}
        .pr{display:inline-block;padding:2px 10px;border-radius:100px;font-size:11px;font-weight:700}
        .pr-red{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
        .pr-green{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
        .pr-amber{background:#fffbeb;color:#92400e;border:1px solid #fde68a}
        .lfooter{background:#f9fafb;border:1px solid #e9edef;border-radius:12px;padding:20px;text-align:center;margin-top:40px}
        @media(max-width:600px){.lw{padding:28px 16px 60px}.ftable{overflow-x:auto}}
      `}</style>
      <div className="lw">
        <div className="hero">
          <div className="hero-ey"><span>{T('Legal Document','وثيقة قانونية','Document légal','Yasal Belge')}</span><span>webek.org</span></div>
          <h1>{T('Refund Policy','سياسة الاسترداد','Politique de remboursement','İade Politikası')}</h1>
          <p className="hero-desc">{T('We want you to be fully satisfied. Here is our clear refund policy.','نريدك أن تكون راضياً تماماً. إليك سياستنا الواضحة للاسترداد.','Nous voulons que vous soyez entièrement satisfait. Voici notre politique claire de remboursement.','Tamamen memnun olmanızı istiyoruz. İşte açık iade politikamız.')}</p>
          <div className="hero-meta">
            <span className="hbadge">{T('Last updated: January 1, 2025','آخر تحديث: ١ يناير ٢٠٢٥','Mise à jour : 1 janv. 2025','Son güncelleme: 1 Ocak 2025')}</span>
            <span className="hbadge green">webek.org</span>
          </div>
          <div className="lnav">
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/legal/refund" className="on">Refund</a>
            <a href="/legal/license">License</a>
          </div>
        </div>

        {/* Summary table */}
        <div className="sec">
          <div className="st">{T('Refund Summary','ملخص سياسة الاسترداد','Résumé des remboursements','İade Özeti')}</div>
          <div className="ftable">
            <table>
              <thead><tr>
                <th>{T('Subscription Type','نوع الاشتراك','Type d\'abonnement','Abonelik Türü')}</th>
                <th>{T('Refund Policy','سياسة الاسترداد','Politique','İade Politikası')}</th>
                <th>{T('Window','المهلة','Délai','Süre')}</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td><strong>{T('Monthly','شهري','Mensuel','Aylık')}</strong></td>
                  <td><span className="pr pr-red">{T('Non-refundable','غير قابل للاسترداد','Non remboursable','İade edilemez')}</span></td>
                  <td style={{color:'#8696a0'}}>N/A</td>
                </tr>
                <tr>
                  <td><strong>{T('Annual','سنوي','Annuel','Yıllık')}</strong></td>
                  <td><span className="pr pr-green">{T('Pro-rated refund','استرداد نسبي','Remboursement au prorata','Orantılı iade')}</span></td>
                  <td>{T('14 days','14 يوماً','14 jours','14 gün')}</td>
                </tr>
                <tr>
                  <td><strong>{T('Free trial','تجربة مجانية','Essai gratuit','Ücretsiz deneme')}</strong></td>
                  <td><span className="pr pr-green">{T('No charge','لا توجد رسوم','Aucun frais','Ücret yok')}</span></td>
                  <td>{T('14 days','14 يوماً','14 jours','14 gün')}</td>
                </tr>
                <tr>
                  <td><strong>{T('SLA breach','تجاوز SLA','Dépassement SLA','SLA aşımı')}</strong></td>
                  <td><span className="pr pr-amber">{T('Service credit 10x','رصيد خدمة 10x','Crédit service 10x','Hizmet kredisi 10x')}</span></td>
                  <td>{T('Automatic','تلقائي','Automatique','Otomatik')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="sec">
          <div className="st">{T('1. Free Trial Period','١. الفترة التجريبية المجانية','1. Période d\'essai gratuit','1. Ücretsiz Deneme Dönemi')}</div>
          <ul>
            {(isAr?['لا يتم خصم أي مبلغ خلال فترة التجربة (14 يوماً)','وصول كامل لجميع ميزات الخطة المختارة','إلغاء مجاني في أي وقت خلال فترة التجربة','تحويل تلقائي إلى الخطة المدفوعة إذا لم يُلغ الاشتراك']
              :isFr?['Aucun frais pendant la période d\'essai (14 jours)','Accès complet à toutes les fonctionnalités','Annulation gratuite à tout moment pendant l\'essai','Conversion automatique au plan payant si non annulé']
              :isTr?['Deneme süresi boyunca (14 gün) ücret alınmaz','Seçilen planın tüm özelliklerine tam erişim','Deneme süresince ücretsiz iptal','İptal edilmezse otomatik olarak ücretli plana geçiş']
              :['No charge during the 14-day trial period','Full access to all features of the selected plan','Free cancellation at any time during the trial','Automatic conversion to paid plan if not cancelled']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('2. Monthly Subscription Refunds','٢. استرداد الاشتراكات الشهرية','2. Remboursements mensuels','2. Aylık Abonelik İadeleri')}</div>
          <p>{T('Monthly subscriptions are non-refundable after the billing date. Exceptions:','الاشتراكات الشهرية غير قابلة للاسترداد بعد تاريخ الفوترة. استثناءات:','Les abonnements mensuels ne sont pas remboursables après la date de facturation. Exceptions :','Aylık abonelikler fatura tarihinden sonra iade edilemez. İstisnalar:')}</p>
          <ul>
            {(isAr?['خطأ فني من جانبنا أثر على وصولك للخدمة أكثر من 72 ساعة','رسوم مكررة بسبب خطأ في النظام','حساب اشترك به بشكل غير مقصود وأُبلغ عنه خلال 48 ساعة']
              :isFr?['Erreur technique de notre côté ayant affecté votre accès plus de 72 heures','Frais en double dûs à une erreur système','Compte souscrit accidentellement signalé dans les 48 heures']
              :isTr?['Hizmete erişiminizi 72 saatten fazla etkileyen teknik hata','Sistem hatası nedeniyle mükerrer ücretlendirme','48 saat içinde bildirilen yanlışlıkla abone olunan hesap']
              :['A technical error on our side that affected your access for more than 72 hours','Duplicate charges due to a system error','Account subscribed accidentally and reported within 48 hours']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('3. Annual Subscription Refunds','٣. استرداد الاشتراكات السنوية','3. Remboursements annuels','3. Yıllık Abonelik İadeleri')}</div>
          <p>{T('Pro-rated refund available within 14 days of payment if:','استرداد نسبي متاح خلال 14 يوماً من الدفع إذا:','Remboursement au prorata disponible dans les 14 jours si :','Ödeme tarihinden itibaren 14 gün içinde orantılı iade şu durumda:')}</p>
          <ul>
            {(isAr?['طلب الاسترداد خلال 14 يوماً من الدفع','أقل من 100 رسالة مرسلة (استخدام غير جوهري)','لا توجد انتهاكات لشروط الخدمة','صيغة الاسترداد: (الأشهر المتبقية / 12) × المبلغ المدفوع']
              :isFr?['Demande dans les 14 jours suivant le paiement','Moins de 100 messages envoyés (utilisation non substantielle)','Aucune violation des conditions','Calcul : (mois restants / 12) × montant payé']
              :isTr?['Ödeme tarihinden itibaren 14 gün içinde talep','100\'den az mesaj gönderilmiş (önemli kullanım yok)','Hizmet şartları ihlali yok','Hesaplama: (kalan aylar / 12) × ödenen tutar']
              :['Request within 14 days of payment date','Less than 100 messages sent (non-substantial use)','No violation of Terms of Service','Calculation: (remaining months / 12) × amount paid']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('4. Service Credits (SLA)','٤. رصيد الخدمة (SLA)','4. Crédits de service (SLA)','4. Hizmet Kredisi (SLA)')}</div>
          <p>{T('If downtime exceeds our SLA (99.9% monthly = less than 44 min of interruption):','إذا تجاوز التوقف حد SLA (99.9% شهرياً = أقل من 44 دقيقة):','Si le temps d\'arrêt dépasse notre SLA (99,9 % mensuel = moins de 44 min) :','Kesinti SLA sınırını aşarsa (aylık %99,9 = 44 dakikadan az):')}</p>
          <ul>
            {(isAr?['رصيد خدمة 10x مدة التجاوز كنسبة من رسومك الشهرية','يُطبق تلقائياً على فاتورتك التالية','لا يُحول إلى نقد','إشعار بالرصيد خلال 24 ساعة من إغلاق الحادث']
              :isFr?['Crédit 10x la durée du dépassement en % de vos frais mensuels','Appliqué automatiquement sur la prochaine facture','Non convertible en espèces','Notification dans les 24 heures suivant la clôture de l\'incident']
              :isTr?['Aylık ücretin yüzdesi olarak fazlalık süresinin 10 katı kredi','Bir sonraki faturaya otomatik uygulanır','Nakde çevrilemez','Olay kapandıktan sonra 24 saat içinde bildirim']
              :['Service credit of 10x the excess duration as a % of your monthly fee','Applied automatically to your next invoice','Not convertible to cash','Credit notification within 24 hours of incident closure']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
        </div>

        <div className="sec">
          <div className="st">{T('5. How to Request a Refund','٥. كيفية طلب الاسترداد','5. Comment demander un remboursement','5. İade Nasıl Talep Edilir')}</div>
          <p>{T('Email','أرسل بريداً إلى','Envoyez un e-mail à','E-posta gönderin:')} <strong>billing@waabek.com</strong> {T('with:','مع:','avec :','ile:')}</p>
          <ul>
            {(isAr?['عنوان البريد الإلكتروني للحساب','نوع الاشتراك وتاريخ الدفع','رقم معرف المعاملة من Stripe','سبب طلب الاسترداد']
              :isFr?['Adresse e-mail du compte','Type d\'abonnement et date de paiement','Identifiant de transaction Stripe','Raison de la demande']
              :isTr?['Hesap e-posta adresi','Abonelik türü ve ödeme tarihi','Stripe işlem kimliği','İade talebinin nedeni']
              :['Account email address','Subscription type and payment date','Stripe transaction ID','Reason for the refund request']
            ).map((item,i)=><li key={i}>{item}</li>)}
          </ul>
          <div className="icard">
            <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
            <p>{T('We respond to all refund requests within 3 business days. If approved, the refund is processed within 5-10 business days.','نرد على جميع طلبات الاسترداد خلال 3 أيام عمل. عند الموافقة، يُعالج الاسترداد خلال 5-10 أيام عمل.','Nous répondons dans les 3 jours ouvrables. Si approuvé, le remboursement est traité dans les 5 à 10 jours ouvrables.','Tüm taleplere 3 iş günü içinde yanıt veriyoruz. Onaylanırsa 5-10 iş günü içinde işlenir.')}</p>
          </div>
        </div>

        <div className="lfooter">
          <p style={{fontSize:12,color:'#8696a0'}}>© 2025 webek.org — WABEK. {T('All rights reserved.','جميع الحقوق محفوظة.','Tous droits réservés.','Tüm haklar saklıdır.')}</p>
        </div>
      </div>
      <PublicFooter lang={lang} onLangChange={setLang} />
    </div>
  </>)
}
