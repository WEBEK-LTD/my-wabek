import React from 'react'
import Head from 'next/head'
import { CheckIcon, CodeBracketIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button } from '@/components/ui'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CtaBand } from '@/components/marketing/Blocks'
import { usePublicLang } from '@/components/marketing/usePublicLang'

const INTEGRATIONS = [
  { mark: 'Wx', grad: 'linear-gradient(135deg,#12B5BE,#0E6C72)', name: 'Wix', bk: 'integ_official', dk: 'integ_wix_desc',
    features: ['order_confirmed', 'shipping_updates', 'abandoned_cart', 'refund_cancel', 'custom_templates', 'auto_account'] },
  { mark: 'WP', grad: 'linear-gradient(135deg,#0E6C72,#04282C)', name: 'WordPress & WooCommerce', bk: 'integ_plugin', dk: 'integ_wp_desc',
    features: ['new_order', 'payment_received', 'order_status', 'shipping_confirm', 'abandoned_cart', 'custom_webhooks'] },
  { mark: 'Zp', grad: 'linear-gradient(135deg,#E08A3C,#9A3412)', name: 'Zapier', bk: 'integ_nocode', dk: 'integ_zapier_desc',
    features: ['send_any_app', 'form_triggers', 'crm_integration', 'sheets_triggers', 'shopify_stripe', 'multi_step'] },
  { mark: 'WH', grad: 'linear-gradient(135deg,#12B5BE,#0B6E74)', name: 'WHMCS', bk: 'integ_module', dk: 'integ_whmcs_desc',
    features: ['invoice_alerts', 'ticket_replies', 'service_activation', 'domain_expiry', 'payment_confirm', 'ticket_updates'] },
  { mark: 'Me', grad: 'linear-gradient(135deg,#B59CF5,#5B3DB5)', name: 'Meta WhatsApp Cloud API', bk: 'integ_official_api', dk: 'integ_meta_desc',
    features: ['no_ban_risk', 'template_support', 'high_volume', 'webhook_status', 'media_support', 'green_tick'] },
  { mark: null, grad: 'linear-gradient(135deg,#1D6B4A,#04282C)', name: 'REST API', bk: 'integ_developer', dk: 'integ_api_desc',
    features: ['send_all_types', 'contact_endpoints', 'campaign_api', 'webhook_receipts', 'api_key_auth', 'full_docs'] },
]

const featureLabels: Record<string, Record<string, string>> = {
  en: { order_confirmed:'Order confirmations',shipping_updates:'Shipping updates',abandoned_cart:'Abandoned cart recovery',refund_cancel:'Refund & cancel alerts',custom_templates:'Custom message templates',auto_account:'Auto account creation',new_order:'New order notifications',payment_received:'Payment received alerts',order_status:'Order status updates',shipping_confirm:'Shipping confirmations',custom_webhooks:'Custom webhook triggers',send_any_app:'Send messages from any app',form_triggers:'Trigger on form submissions',crm_integration:'CRM integration (HubSpot, Salesforce)',sheets_triggers:'Google Sheets triggers',shopify_stripe:'Shopify & Stripe events',multi_step:'Multi-step workflows',invoice_alerts:'Invoice due & overdue alerts',ticket_replies:'Ticket reply notifications',service_activation:'Service activation & suspension',domain_expiry:'Domain expiry reminders',payment_confirm:'Payment confirmation',ticket_updates:'Support ticket updates',no_ban_risk:'No ban risk — fully official',template_support:'Template message support',high_volume:'High-volume sending',webhook_status:'Message status webhooks',media_support:'Media message support',green_tick:'Green checkmark eligible',send_all_types:'Send text, image, video, docs',contact_endpoints:'Contact management endpoints',campaign_api:'Campaign management API',webhook_receipts:'Webhook delivery receipts',api_key_auth:'API key authentication',full_docs:'Full API documentation' },
  ar: { order_confirmed:'تأكيدات الطلبات',shipping_updates:'تحديثات الشحن',abandoned_cart:'استرجاع السلال المتروكة',refund_cancel:'تنبيهات الاسترداد والإلغاء',custom_templates:'قوالب رسائل مخصصة',auto_account:'إنشاء حساب تلقائي',new_order:'إشعارات الطلبات الجديدة',payment_received:'تنبيهات استلام الدفع',order_status:'تحديثات حالة الطلب',shipping_confirm:'تأكيدات الشحن',custom_webhooks:'مشغلات webhook مخصصة',send_any_app:'إرسال رسائل من أي تطبيق',form_triggers:'مشغلات على تقديم النماذج',crm_integration:'تكامل CRM (HubSpot, Salesforce)',sheets_triggers:'مشغلات Google Sheets',shopify_stripe:'أحداث Shopify و Stripe',multi_step:'مسارات عمل متعددة الخطوات',invoice_alerts:'تنبيهات الفواتير المستحقة والمتأخرة',ticket_replies:'إشعارات ردود التذاكر',service_activation:'تفعيل وتعليق الخدمة',domain_expiry:'تذكيرات انتهاء النطاق',payment_confirm:'تأكيد الدفع',ticket_updates:'تحديثات تذاكر الدعم',no_ban_risk:'لا خطر حظر — رسمي بالكامل',template_support:'دعم رسائل القوالب',high_volume:'إرسال بحجم عالٍ',webhook_status:'webhooks حالة الرسائل',media_support:'دعم رسائل الوسائط',green_tick:'مؤهل للعلامة الخضراء',send_all_types:'إرسال نص وصورة وفيديو',contact_endpoints:'نقاط نهاية إدارة جهات الاتصال',campaign_api:'API إدارة الحملات',webhook_receipts:'إيصالات تسليم Webhook',api_key_auth:'مصادقة مفتاح API',full_docs:'توثيق API كامل' },
  fr: { order_confirmed:'Confirmations de commande',shipping_updates:'Mises à jour de livraison',abandoned_cart:'Récupération de panier abandonné',refund_cancel:'Alertes remboursement et annulation',custom_templates:'Modèles personnalisés',auto_account:'Création de compte auto',new_order:'Notifications nouvelles commandes',payment_received:'Alertes paiement reçu',order_status:'Mises à jour statut commande',shipping_confirm:'Confirmations de livraison',custom_webhooks:'Déclencheurs webhook personnalisés',send_any_app:'Envoyer depuis n\'importe quelle app',form_triggers:'Déclencheurs sur soumissions',crm_integration:'Intégration CRM (HubSpot, Salesforce)',sheets_triggers:'Déclencheurs Google Sheets',shopify_stripe:'Événements Shopify et Stripe',multi_step:'Flux de travail multi-étapes',invoice_alerts:'Alertes factures dues et en retard',ticket_replies:'Notifications réponses tickets',service_activation:'Activation et suspension de service',domain_expiry:'Rappels expiration domaine',payment_confirm:'Confirmation de paiement',ticket_updates:'Mises à jour tickets support',no_ban_risk:'Zéro risque — officiel',template_support:'Support modèles de messages',high_volume:'Envoi haut volume',webhook_status:'Webhooks statut messages',media_support:'Support messages médias',green_tick:'Éligible coche verte',send_all_types:'Envoyer texte, image, vidéo',contact_endpoints:'Points de terminaison contacts',campaign_api:'API gestion campagnes',webhook_receipts:'Accusés webhook',api_key_auth:'Authentification clé API',full_docs:'Documentation API complète' },
  tr: { order_confirmed:'Sipariş onayları',shipping_updates:'Kargo güncellemeleri',abandoned_cart:'Terk edilen sepet kurtarma',refund_cancel:'İade ve iptal uyarıları',custom_templates:'Özel mesaj şablonları',auto_account:'Otomatik hesap oluşturma',new_order:'Yeni sipariş bildirimleri',payment_received:'Ödeme alındı uyarıları',order_status:'Sipariş durumu güncellemeleri',shipping_confirm:'Kargo onayları',custom_webhooks:'Özel webhook tetikleyicileri',send_any_app:'Herhangi bir uygulamadan mesaj gönder',form_triggers:'Form gönderimleri tetikleyicisi',crm_integration:'CRM entegrasyonu (HubSpot, Salesforce)',sheets_triggers:'Google Sheets tetikleyicileri',shopify_stripe:'Shopify ve Stripe olayları',multi_step:'Çok adımlı iş akışları',invoice_alerts:'Vadesi gelen fatura uyarıları',ticket_replies:'Bilet yanıt bildirimleri',service_activation:'Hizmet aktivasyonu ve askıya alma',domain_expiry:'Alan adı sona erme hatırlatıcıları',payment_confirm:'Ödeme onayı',ticket_updates:'Destek bileti güncellemeleri',no_ban_risk:'Yasak riski yok — tamamen resmi',template_support:'Şablon mesaj desteği',high_volume:'Yüksek hacimli gönderim',webhook_status:'Mesaj durumu webhook\'ları',media_support:'Medya mesajı desteği',green_tick:'Yeşil onay işareti uygun',send_all_types:'Metin, görüntü, video gönder',contact_endpoints:'Kişi yönetimi uç noktaları',campaign_api:'Kampanya yönetimi API',webhook_receipts:'Webhook teslimat makbuzları',api_key_auth:'API anahtar kimlik doğrulama',full_docs:'Tam API dokümantasyonu' },
}

export default function IntegrationsPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, t } = usePublicLang()
  const labels = featureLabels[lang] || featureLabels.en

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`${t('integ_title')} | ${name}`}</title>
      </Head>
      <MarketingPage
        active="/integrations"
        lang={lang}
        dir={dir}
        onLangChange={setLang}
        hero={
          <PageHero eyebrow={t('integrations')} title={t('integ_title')} subtitle={t('integ_subtitle')}>
            <ul className="mt-2 flex flex-wrap justify-center gap-2.5" aria-hidden="true">
              {INTEGRATIONS.map(i => (
                <li key={i.name} dir="ltr" className="rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-deep-ink">{i.name}</li>
              ))}
            </ul>
          </PageHero>
        }
      >
        <Section className="pt-14 sm:pt-16">
          <ul className="grid gap-5 lg:grid-cols-2">
            {INTEGRATIONS.map(intg => (
              <li
                key={intg.name}
                className="group flex flex-col gap-5 rounded-card border border-line bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-card-hover sm:p-7"
              >
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    dir="ltr"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-card"
                    style={{ background: intg.grad }}
                  >
                    {intg.mark || <CodeBracketIcon className="h-7 w-7" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-ink" dir="ltr">{intg.name}</h2>
                      <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold text-chip-ink">{t(intg.bk)}</span>
                    </div>
                    <p className="mt-2 text-[15px] leading-[1.85] text-body">{t(intg.dk)}</p>
                  </div>
                </div>
                <ul className="grid gap-x-4 gap-y-2.5 border-t border-line-soft pt-5 sm:grid-cols-2">
                  {intg.features.map(fk => (
                    <li key={fk} className="flex items-start gap-2 text-sm text-ink">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" strokeWidth={2.6} aria-hidden="true" />
                      <span>{labels[fk] || fk}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <Button href="/auth/register" variant="secondary" size="sm">{t('integ_cta_start')}</Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <CtaBand
          title={t('integ_cta_title')}
          subtitle={t('integ_cta_subtitle')}
          actions={
            <>
              <Button href="/docs" size="xl" className="rounded-2xl px-8 text-lg font-bold">{t('integ_cta_docs')}</Button>
              <Button href="/auth/register" variant="on-deep-ghost" size="xl" className="rounded-2xl px-7">{t('integ_cta_start')}</Button>
            </>
          }
        />
      </MarketingPage>
    </>
  )
}
