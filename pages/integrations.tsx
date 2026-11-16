// @ts-nocheck
import Head from 'next/head'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import PublicNav from '@/components/PublicNav'
import PublicFooter from '@/components/PublicFooter'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { t, getStoredLang } from '@/lib/i18n'

export default function IntegrationsPage() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const [lang, setLang] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en')
  useEffect(() => {
    setLang(getStoredLang())
    const h = (e: any) => setLang(e.detail)
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  const isRTL = lang === 'ar'
  const dir = isRTL ? 'rtl' : 'ltr'

  const INTEGRATIONS = [
    { logo:'https://upload.wikimedia.org/wikipedia/commons/7/76/Wix.com_website_logo.svg', name:'Wix', bk:'integ_official', dk:'integ_wix_desc',
      features:['order_confirmed','shipping_updates','abandoned_cart','refund_cancel','custom_templates','auto_account'] },
    { logo:'https://upload.wikimedia.org/wikipedia/commons/9/98/WordPress_blue_logo.svg', name:'WordPress & WooCommerce', bk:'integ_plugin', dk:'integ_wp_desc',
      features:['new_order','payment_received','order_status','shipping_confirm','abandoned_cart','custom_webhooks'] },
    { logo:'https://upload.wikimedia.org/wikipedia/commons/f/fd/Zapier_logo.svg', name:'Zapier', bk:'integ_nocode', dk:'integ_zapier_desc',
      features:['send_any_app','form_triggers','crm_integration','sheets_triggers','shopify_stripe','multi_step'] },
    { logo:'https://upload.wikimedia.org/wikipedia/commons/a/ae/WHMCS_Logo.svg', name:'WHMCS', bk:'integ_module', dk:'integ_whmcs_desc',
      features:['invoice_alerts','ticket_replies','service_activation','domain_expiry','payment_confirm','ticket_updates'] },
    { logo:'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg', name:'Meta WhatsApp Cloud API', bk:'integ_official_api', dk:'integ_meta_desc',
      features:['no_ban_risk','template_support','high_volume','webhook_status','media_support','green_tick'] },
    { logo:null, name:'REST API', bk:'integ_developer', dk:'integ_api_desc',
      features:['send_all_types','contact_endpoints','campaign_api','webhook_receipts','api_key_auth','full_docs'] },
  ]

  const featureLabels: Record<string,Record<string,string>> = {
    en: { order_confirmed:'Order confirmations',shipping_updates:'Shipping updates',abandoned_cart:'Abandoned cart recovery',refund_cancel:'Refund & cancel alerts',custom_templates:'Custom message templates',auto_account:'Auto account creation',new_order:'New order notifications',payment_received:'Payment received alerts',order_status:'Order status updates',shipping_confirm:'Shipping confirmations',custom_webhooks:'Custom webhook triggers',send_any_app:'Send messages from any app',form_triggers:'Trigger on form submissions',crm_integration:'CRM integration (HubSpot, Salesforce)',sheets_triggers:'Google Sheets triggers',shopify_stripe:'Shopify & Stripe events',multi_step:'Multi-step workflows',invoice_alerts:'Invoice due & overdue alerts',ticket_replies:'Ticket reply notifications',service_activation:'Service activation & suspension',domain_expiry:'Domain expiry reminders',payment_confirm:'Payment confirmation',ticket_updates:'Support ticket updates',no_ban_risk:'No ban risk — fully official',template_support:'Template message support',high_volume:'High-volume sending',webhook_status:'Message status webhooks',media_support:'Media message support',green_tick:'Green checkmark eligible',send_all_types:'Send text, image, video, docs',contact_endpoints:'Contact management endpoints',campaign_api:'Campaign management API',webhook_receipts:'Webhook delivery receipts',api_key_auth:'API key authentication',full_docs:'Full API documentation' },
    ar: { order_confirmed:'تأكيدات الطلبات',shipping_updates:'تحديثات الشحن',abandoned_cart:'استرداد العربة المهجورة',refund_cancel:'تنبيهات الاسترداد والإلغاء',custom_templates:'قوالب رسائل مخصصة',auto_account:'إنشاء حساب تلقائي',new_order:'إشعارات الطلبات الجديدة',payment_received:'تنبيهات استلام الدفع',order_status:'تحديثات حالة الطلب',shipping_confirm:'تأكيدات الشحن',custom_webhooks:'مشغلات webhook مخصصة',send_any_app:'إرسال رسائل من أي تطبيق',form_triggers:'مشغلات على تقديم النماذج',crm_integration:'تكامل CRM (HubSpot, Salesforce)',sheets_triggers:'مشغلات Google Sheets',shopify_stripe:'أحداث Shopify و Stripe',multi_step:'سير عمل متعددة الخطوات',invoice_alerts:'تنبيهات الفواتير المستحقة والمتأخرة',ticket_replies:'إشعارات ردود التذاكر',service_activation:'تفعيل وتعليق الخدمة',domain_expiry:'تذكيرات انتهاء النطاق',payment_confirm:'تأكيد الدفع',ticket_updates:'تحديثات تذاكر الدعم',no_ban_risk:'لا خطر حظر — رسمي بالكامل',template_support:'دعم رسائل القوالب',high_volume:'إرسال بحجم عالٍ',webhook_status:'webhooks حالة الرسائل',media_support:'دعم الرسائل الإعلامية',green_tick:'مؤهل للعلامة الخضراء',send_all_types:'إرسال نص وصورة وفيديو',contact_endpoints:'نقاط نهاية إدارة جهات الاتصال',campaign_api:'API إدارة الحملات',webhook_receipts:'إيصالات تسليم Webhook',api_key_auth:'مصادقة مفتاح API',full_docs:'توثيق API كامل' },
    fr: { order_confirmed:'Confirmations de commande',shipping_updates:'Mises à jour de livraison',abandoned_cart:'Récupération de panier abandonné',refund_cancel:'Alertes remboursement et annulation',custom_templates:'Modèles personnalisés',auto_account:'Création de compte auto',new_order:'Notifications nouvelles commandes',payment_received:'Alertes paiement reçu',order_status:'Mises à jour statut commande',shipping_confirm:'Confirmations de livraison',custom_webhooks:'Déclencheurs webhook personnalisés',send_any_app:'Envoyer depuis n\'importe quelle app',form_triggers:'Déclencheurs sur soumissions',crm_integration:'Intégration CRM (HubSpot, Salesforce)',sheets_triggers:'Déclencheurs Google Sheets',shopify_stripe:'Événements Shopify et Stripe',multi_step:'Flux de travail multi-étapes',invoice_alerts:'Alertes factures dues et en retard',ticket_replies:'Notifications réponses tickets',service_activation:'Activation et suspension de service',domain_expiry:'Rappels expiration domaine',payment_confirm:'Confirmation de paiement',ticket_updates:'Mises à jour tickets support',no_ban_risk:'Zéro risque — officiel',template_support:'Support modèles de messages',high_volume:'Envoi haut volume',webhook_status:'Webhooks statut messages',media_support:'Support messages médias',green_tick:'Éligible coche verte',send_all_types:'Envoyer texte, image, vidéo',contact_endpoints:'Points de terminaison contacts',campaign_api:'API gestion campagnes',webhook_receipts:'Accusés webhook',api_key_auth:'Authentification clé API',full_docs:'Documentation API complète' },
    tr: { order_confirmed:'Sipariş onayları',shipping_updates:'Kargo güncellemeleri',abandoned_cart:'Terk edilen sepet kurtarma',refund_cancel:'İade ve iptal uyarıları',custom_templates:'Özel mesaj şablonları',auto_account:'Otomatik hesap oluşturma',new_order:'Yeni sipariş bildirimleri',payment_received:'Ödeme alındı uyarıları',order_status:'Sipariş durumu güncellemeleri',shipping_confirm:'Kargo onayları',custom_webhooks:'Özel webhook tetikleyicileri',send_any_app:'Herhangi bir uygulamadan mesaj gönder',form_triggers:'Form gönderimleri tetikleyicisi',crm_integration:'CRM entegrasyonu (HubSpot, Salesforce)',sheets_triggers:'Google Sheets tetikleyicileri',shopify_stripe:'Shopify ve Stripe olayları',multi_step:'Çok adımlı iş akışları',invoice_alerts:'Vadesi gelen fatura uyarıları',ticket_replies:'Bilet yanıt bildirimleri',service_activation:'Hizmet aktivasyonu ve askıya alma',domain_expiry:'Alan adı sona erme hatırlatıcıları',payment_confirm:'Ödeme onayı',ticket_updates:'Destek bileti güncellemeleri',no_ban_risk:'Yasak riski yok — tamamen resmi',template_support:'Şablon mesaj desteği',high_volume:'Yüksek hacimli gönderim',webhook_status:'Mesaj durumu webhook\'ları',media_support:'Medya mesajı desteği',green_tick:'Yeşil onay işareti uygun',send_all_types:'Metin, görüntü, video gönder',contact_endpoints:'Kişi yönetimi uç noktaları',campaign_api:'Kampanya yönetimi API',webhook_receipts:'Webhook teslimat makbuzları',api_key_auth:'API anahtar kimlik doğrulama',full_docs:'Tam API dokümantasyonu' },
  }

  return (
    <>
      <Head>
      <link rel="icon" href="/brand/favicon-32.png" /><title>{t(lang,'integ_title')} | {name}</title></Head>
      <style>{`*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#111b21}.badge{display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:700;background:#dcfce7;color:#166534}.check{color:#25D366;font-weight:700;margin-inline-end:8px}.card{background:#fff;border:1px solid #e9edef;border-radius:16px;padding:32px;display:flex;gap:32px;align-items:flex-start;transition:all .2s}.card:hover{border-color:#25D366;box-shadow:0 4px 20px rgba(37,211,102,.08)}@media(max-width:600px){.card{flex-direction:column;gap:16px}}`}</style>

      <PublicNav active="/integrations" onLangChange={setLang} />

      <section style={{background:'linear-gradient(160deg,#f0fdf4,#fff)',padding:'80px 20px 56px',textAlign:'center',direction:dir}}>
        <div style={{maxWidth:700,margin:'0 auto'}}>
          <h1 style={{fontSize:'clamp(28px,5vw,48px)',fontWeight:800,marginBottom:18,lineHeight:1.1}}>{t(lang,'integ_title')}</h1>
          <p style={{fontSize:17,color:'#54656f',lineHeight:1.7}}>{t(lang,'integ_subtitle')}</p>
        </div>
      </section>

      <section style={{padding:'48px 20px 80px',direction:dir}}>
        <div style={{maxWidth:1000,margin:'0 auto',display:'flex',flexDirection:'column',gap:24}}>
          {INTEGRATIONS.map((intg) => {
            const labels = featureLabels[lang] || featureLabels['en']
            return (
              <div key={intg.name} className="card">
                <div style={{flexShrink:0,width:72,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {intg.logo
                    ? <img src={intg.logo} alt={intg.name} style={{width:64,height:64,objectFit:'contain'}} onError={e=>{(e.target as any).style.display='none'}}/>
                    : <div style={{width:64,height:64,background:'#111',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',color:'#0F172A',fontSize:12,fontWeight:700}}>API</div>
                  }
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'}}>
                    <h2 style={{fontSize:20,fontWeight:700}}>{intg.name}</h2>
                    <span className="badge">{t(lang,intg.bk)}</span>
                  </div>
                  <p style={{fontSize:15,color:'#54656f',lineHeight:1.75,marginBottom:18}}>{t(lang,intg.dk)}</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'6px 0'}}>
                    {intg.features.map(fk => (
                      <div key={fk} style={{fontSize:13,color:'#374151'}}><span className="check">✓</span>{labels[fk] || fk}</div>
                    ))}
                  </div>
                </div>
                <div style={{flexShrink:0}}>
                  <Link href="/auth/register" style={{background:'#25D366',color:'#0F172A',padding:'11px 22px',borderRadius:8,fontSize:13,fontWeight:700,textDecoration:'none',display:'inline-block',whiteSpace:'nowrap'}}>{t(lang,'integ_cta_start')}</Link>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section style={{background:'#25D366',padding:'64px 20px',textAlign:'center',direction:dir}}>
        <h2 style={{fontSize:'clamp(24px,4vw,36px)',fontWeight:800,color:'#0F172A',marginBottom:14}}>{t(lang,'integ_cta_title')}</h2>
        <p style={{fontSize:17,color:'rgba(255,255,255,.85)',marginBottom:32}}>{t(lang,'integ_cta_subtitle')}</p>
        <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
          <Link href="/dashboard/docs" style={{background:'#fff',color:'#25D366',padding:'12px 28px',borderRadius:9,fontSize:15,fontWeight:700,textDecoration:'none'}}>{t(lang,'integ_cta_docs')}</Link>
          <Link href="/auth/register" style={{background:'transparent',color:'#0F172A',padding:'12px 28px',borderRadius:9,fontSize:15,fontWeight:700,textDecoration:'none',border:'2px solid rgba(255,255,255,.6)'}}>{t(lang,'integ_cta_start')}</Link>
        </div>
      </section>

      <PublicFooter lang={lang} />
    </>
  )
}
