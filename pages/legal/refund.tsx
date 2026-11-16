// @ts-nocheck
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { LegalLayout } from '@/components/marketing/LegalLayout'
import { usePublicLang } from '@/components/marketing/usePublicLang'

export default function RefundPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir } = usePublicLang()
  const isAr = lang==='ar', isFr = lang==='fr', isTr = lang==='tr'
  const T = (en:string,ar:string,fr:string,tr:string) => isAr?ar:isFr?fr:isTr?tr:en

  return (
    <LegalLayout
      lang={lang}
      dir={dir}
      onLangChange={setLang}
      active="/legal/refund"
      headTitle={`${T('Refund Policy','سياسة الاسترداد','Politique de remboursement','İade Politikası')} | ${name}`}
      eyebrow={T('Legal Document','وثيقة قانونية','Document légal','Yasal Belge')}
      title={T('Refund Policy','سياسة الاسترداد','Politique de remboursement','İade Politikası')}
      description={T('We want you to be fully satisfied. Here is our clear refund policy.','نريدك أن تكون راضياً تماماً. إليك سياستنا الواضحة للاسترداد.','Nous voulons que vous soyez entièrement satisfait. Voici notre politique claire de remboursement.','Tamamen memnun olmanızı istiyoruz. İşte açık iade politikamız.')}
      updated={T('Last updated: January 1, 2025','آخر تحديث: ١ يناير ٢٠٢٥','Mise à jour : 1 janv. 2025','Son güncelleme: 1 Ocak 2025')}
      meta={<><span className="rounded-full bg-chip px-3 py-1 text-xs font-medium text-chip-ink" dir="ltr">webek.org</span></>}
    >

      {/* Summary table */}
      <div className="sec">
        <h2 className="st">{T('Refund Summary','ملخص سياسة الاسترداد','Résumé des remboursements','İade Özeti')}</h2>
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
                <td className="text-muted">N/A</td>
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
        <h2 className="st">{T('1. Free Trial Period','١. الفترة التجريبية المجانية','1. Période d\'essai gratuit','1. Ücretsiz Deneme Dönemi')}</h2>
        <ul>
          {(isAr?['لا يتم خصم أي مبلغ خلال فترة التجربة (14 يوماً)','وصول كامل لجميع ميزات الخطة المختارة','إلغاء مجاني في أي وقت خلال فترة التجربة','تحويل تلقائي إلى الخطة المدفوعة إذا لم يُلغ الاشتراك']
            :isFr?['Aucun frais pendant la période d\'essai (14 jours)','Accès complet à toutes les fonctionnalités','Annulation gratuite à tout moment pendant l\'essai','Conversion automatique au plan payant si non annulé']
            :isTr?['Deneme süresi boyunca (14 gün) ücret alınmaz','Seçilen planın tüm özelliklerine tam erişim','Deneme süresince ücretsiz iptal','İptal edilmezse otomatik olarak ücretli plana geçiş']
            :['No charge during the 14-day trial period','Full access to all features of the selected plan','Free cancellation at any time during the trial','Automatic conversion to paid plan if not cancelled']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
      </div>

      <div className="sec">
        <h2 className="st">{T('2. Monthly Subscription Refunds','٢. استرداد الاشتراكات الشهرية','2. Remboursements mensuels','2. Aylık Abonelik İadeleri')}</h2>
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
        <h2 className="st">{T('3. Annual Subscription Refunds','٣. استرداد الاشتراكات السنوية','3. Remboursements annuels','3. Yıllık Abonelik İadeleri')}</h2>
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
        <h2 className="st">{T('4. Service Credits (SLA)','٤. رصيد الخدمة (SLA)','4. Crédits de service (SLA)','4. Hizmet Kredisi (SLA)')}</h2>
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
        <h2 className="st">{T('5. How to Request a Refund','٥. كيفية طلب الاسترداد','5. Comment demander un remboursement','5. İade Nasıl Talep Edilir')}</h2>
        <p>{T('Email','أرسل بريداً إلى','Envoyez un e-mail à','E-posta gönderin:')} <strong>billing@waabek.com</strong> {T('with:','مع:','avec :','ile:')}</p>
        <ul>
          {(isAr?['عنوان البريد الإلكتروني للحساب','نوع الاشتراك وتاريخ الدفع','رقم معرف المعاملة من Stripe','سبب طلب الاسترداد']
            :isFr?['Adresse e-mail du compte','Type d\'abonnement et date de paiement','Identifiant de transaction Stripe','Raison de la demande']
            :isTr?['Hesap e-posta adresi','Abonelik türü ve ödeme tarihi','Stripe işlem kimliği','İade talebinin nedeni']
            :['Account email address','Subscription type and payment date','Stripe transaction ID','Reason for the refund request']
          ).map((item,i)=><li key={i}>{item}</li>)}
        </ul>
        <div className="icard">
          <div className="icard-i"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <p>{T('We respond to all refund requests within 3 business days. If approved, the refund is processed within 5-10 business days.','نرد على جميع طلبات الاسترداد خلال 3 أيام عمل. عند الموافقة، يُعالج الاسترداد خلال 5-10 أيام عمل.','Nous répondons dans les 3 jours ouvrables. Si approuvé, le remboursement est traité dans les 5 à 10 jours ouvrables.','Tüm taleplere 3 iş günü içinde yanıt veriyoruz. Onaylanırsa 5-10 iş günü içinde işlenir.')}</p>
        </div>
      </div>

      <div className="lfooter">
        <p className="text-xs text-muted">© 2025 webek.org — WABEK. {T('All rights reserved.','جميع الحقوق محفوظة.','Tous droits réservés.','Tüm haklar saklıdır.')}</p>
      </div>
    </LegalLayout>
  )
}
