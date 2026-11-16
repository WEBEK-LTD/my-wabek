// Integration cards (WordPress/WooCommerce, WHMCS, Wix, Zapier/Webhooks) and the Zapier/Make guides.
import React from 'react'
import Link from 'next/link'
import {
  ArrowDownTrayIcon, ShoppingCartIcon, ServerStackIcon, Squares2X2Icon, BoltIcon, BookOpenIcon, KeyIcon,
  PaperAirplaneIcon, ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Card, CardHeader, cn } from '@/components/ui'
import { CodeBlock, CopyField, StepList } from '@/components/settings/Shared'
import { ForwardArrowIcon } from '@/components/campaigns/icons'

function Tile({ icon: Icon, className }: { icon: React.ElementType; className?: string }) {
  return (
    <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-card', className)}>
      <Icon className="h-6 w-6" aria-hidden="true" />
    </span>
  )
}

export function IntegrationHub({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  return (
    <div className="space-y-5">
      {/* WordPress / WooCommerce — featured */}
      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="relative bg-deep-hero p-6 text-deep-ink sm:p-7">
            <div aria-hidden="true" className="pointer-events-none absolute -end-12 -top-16 h-48 w-48 rounded-full bg-brand-green/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <Tile icon={ShoppingCartIcon} className="bg-brand-gradient text-[#04282C]" />
                <div>
                  <h2 className="text-lg font-bold text-deep-ink">WordPress وWooCommerce</h2>
                  <p className="text-sm text-deep-muted">إضافة رسمية لإشعارات الطلبات ورموز التحقق</p>
                </div>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-deep-muted">
                <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden="true" />إشعارات الطلبات ورموز التحقق عبر واتساب</li>
                <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden="true" />تكامل مع WooCommerce وتغيّر حالة الطلب</li>
                <li className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden="true" />تتصل بحسابك عبر مفتاح API</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <a href="/downloads/wabek-wordpress-plugin.zip" download className="inline-flex h-11 items-center gap-2 rounded-btn bg-brand-gradient px-4 text-sm font-semibold text-[#04282C] shadow-glow transition hover:brightness-105">
                  <ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />تنزيل الإضافة (.zip)
                </a>
                <Button variant="on-deep-ghost" icon={BookOpenIcon} href="/docs/integrations/wordpress">الدليل</Button>
              </div>
            </div>
          </div>
          <div className="p-6 sm:p-7">
            <p className="mb-4 text-sm font-semibold text-ink">التثبيت في أربع خطوات</p>
            <StepList steps={[
              { title: 'نزّل الإضافة', body: <>احفظ الملف <code dir="ltr" className="font-mono text-[12.5px]">wabek-wordpress-plugin.zip</code> على جهازك دون فك ضغطه.</> },
              { title: 'ارفعها وفعّلها', body: 'في لوحة WordPress افتح «الإضافات ← أضف جديد ← رفع إضافة»، واختر الملف ثم «التثبيت الآن» و«تفعيل».' },
              { title: 'أنشئ مفتاح API', body: <>من صفحة <Link href="/dashboard/api-keys" className="text-link hover:text-link-hover">مفاتيح API</Link> أنشئ مفتاحًا باسم مثل «WordPress - متجري» وانسخه فورًا.</> },
              { title: 'اربط الحساب', body: 'الصق المفتاح في صفحة إعدادات WABEK داخل WordPress، ثم اضغط «اختبار الاتصال».' },
            ]} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* WHMCS */}
        <Card interactive className="flex flex-col">
          <div className="flex items-start gap-3">
            <Tile icon={ServerStackIcon} className="bg-violet-bg text-violet" />
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">WHMCS</h3>
              <p className="text-sm text-muted">إشعارات الفواتير والتذاكر والخدمات، وحملات وروبوت ومحادثات مشتركة</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant="dark" href="/dashboard/whmcs" iconEnd={ForwardArrowIcon}>إعداد WHMCS</Button>
            <a href="/downloads/wabek-whmcs-addon.zip" download className="inline-flex h-9 items-center gap-1.5 rounded-btn border border-line-strong bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-2">
              <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />الإضافة (.zip)
            </a>
          </div>
        </Card>

        {/* Wix */}
        <Card interactive className="flex flex-col">
          <div className="flex items-start gap-3">
            <Tile icon={Squares2X2Icon} className="bg-warning-bg text-warning" />
            <div className="min-w-0">
              <h3 className="font-semibold text-ink">Wix</h3>
              <p className="text-sm text-muted">اربط متجر Wix لإرسال إشعارات الطلبات والرسائل المخصّصة</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant="dark" href="/dashboard/wix" iconEnd={ForwardArrowIcon}>إعداد Wix</Button>
            <Button size="sm" variant="ghost" icon={BookOpenIcon} href="/docs/integrations/wix">الدليل</Button>
          </div>
        </Card>

        {/* Zapier / Webhooks */}
        <Card interactive className="flex flex-col">
          <div className="flex items-start gap-3">
            <Tile icon={BoltIcon} className="bg-chip text-brand-ink" />
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 font-semibold text-ink">Zapier وMake وWebhooks</h3>
              <p className="text-sm text-muted">أرسل رسائل من آلاف التطبيقات، واستقبل أحداث WABEK على رابطك</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <Button size="sm" variant="dark" onClick={() => onOpenTab('webhooks')} iconEnd={ForwardArrowIcon}>Webhooks الصادرة</Button>
            <Button size="sm" variant="secondary" onClick={() => onOpenTab('automation')}>Zapier وMake</Button>
          </div>
        </Card>
      </div>

      <Card variant="muted" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <KeyIcon className="h-6 w-6 shrink-0 text-brand-ink" aria-hidden="true" />
        <p className="flex-1 text-sm text-body">تحتاج كل هذه التكاملات إلى مفتاح API. أنشئ مفتاحًا مستقلًا لكل تكامل لتتمكن من إلغائه منفردًا.</p>
        <Button size="sm" variant="secondary" href="/dashboard/api-keys">مفاتيح API</Button>
      </Card>
    </div>
  )
}

export function AutomationGuides({ appUrl }: { appUrl: string }) {
  const apiKey = 'YOUR_API_KEY'
  const trigger = `${appUrl}/api/webhooks/trigger`
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={PaperAirplaneIcon} title="إرسال رسالة: رابط التشغيل"
          subtitle="استخدم هذا الرابط في Zapier أو Make أو أي أداة أتمتة لإرسال رسائل واتساب"
          action={<Button size="sm" variant="ghost" icon={BookOpenIcon} href="/docs/integrations/zapier-webhooks">الدليل</Button>} />
        <div className="mt-4 space-y-3">
          <CopyField label="POST" value={trigger} />
          <CopyField label="Header" value={`X-API-Key: ${apiKey}`} />
          <CodeBlock label="Body (JSON)" code={`{
  "to": "201234567890",
  "message": "Hello {{name}}!",
  "instance_id": "optional"
}`} />
          <p className="text-xs text-muted">
            استبدل <code dir="ltr" className="font-mono">YOUR_API_KEY</code> بمفتاح من صفحة <Link href="/dashboard/api-keys" className="text-link hover:text-link-hover">مفاتيح API</Link> (يظهر المفتاح كاملًا مرة واحدة عند إنشائه). خارج نافذة الـ 24 ساعة لا يصل النص الحر إلى أرقام Cloud API؛ استخدم <code dir="ltr" className="font-mono">/api/v1/send</code> مع قالب معتمد.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={BoltIcon} title="إعداد Zapier" subtitle={<span className="flex items-center gap-2">اربط WABEK بتطبيقاتك عبر Zapier <Badge size="sm" tone="neutral">Webhooks by Zapier</Badge></span>} />
          <StepList className="mt-5" steps={[
            { title: 'أنشئ Zap', body: 'في Zapier اضغط «Create Zap» واختر التطبيق المشغِّل (مثل Google Forms أو Typeform أو Shopify).' },
            { title: 'أضف إجراء Webhook', body: 'ابحث عن «Webhooks by Zapier» واختر الإجراء «POST».' },
            { title: 'اضبط الطلب', body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`URL: ${trigger}\nMethod: POST\nData Pass-Through: No`}</span> },
            { title: 'أضف الترويسات', body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`X-API-Key: ${apiKey}\nContent-Type: application/json`}</span> },
            { title: 'حدّد جسم الطلب', body: <span className="whitespace-pre-line">{'to: (حقل رقم العميل)\nmessage: (نص رسالتك)'}</span> },
          ]} />
        </Card>
        <Card>
          <CardHeader icon={ArrowsRightLeftIcon} title="إعداد Make (Integromat)" subtitle="استخدم وحدة HTTP في Make لإرسال الرسائل" />
          <StepList className="mt-5" steps={[
            { title: 'أنشئ سيناريو', body: 'في Make أنشئ سيناريو جديدًا وأضف وحدة التشغيل.' },
            { title: 'أضف وحدة HTTP', body: 'اضغط + وابحث عن «HTTP» واختر «Make a request».' },
            { title: 'اضبط الطلب', body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`URL: ${trigger}\nMethod: POST\nBody type: Raw\nContent type: JSON (application/json)`}</span> },
            { title: 'أضف الترويسة', body: <span dir="ltr" className="block whitespace-pre-line text-start font-mono text-[12.5px]">{`Name: X-API-Key\nValue: ${apiKey}`}</span> },
            { title: 'حدّد الجسم', body: <span dir="ltr" className="block text-start font-mono text-[12.5px]">{'{"to": "{{phone}}", "message": "{{message}}"}'}</span> },
          ]} />
        </Card>
      </div>
    </div>
  )
}
