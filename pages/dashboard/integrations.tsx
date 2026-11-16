import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PuzzlePieceIcon, BoltIcon, ArrowsRightLeftIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import { Button, PageHeader, TabPanel, Tabs } from '@/components/ui'
import { IntegrationHub, AutomationGuides } from '@/components/integrations/Hub'
import { WebhooksPanel } from '@/components/integrations/WebhooksPanel'
import { SignatureSnippets, OUTGOING_WEBHOOKS_DOC } from '@/components/integrations/SignatureSnippets'

const TABS = ['hub', 'webhooks', 'automation']

export default function IntegrationsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('hub')
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  // ?tab=webhooks deep links
  useEffect(() => {
    const t = String(router.query.tab || '')
    if (TABS.includes(t)) setActiveTab(t)
  }, [router.query.tab])

  const openTab = (t: string) => {
    setActiveTab(t)
    router.replace({ pathname: router.pathname, query: t === 'hub' ? {} : { tab: t } }, undefined, { shallow: true })
  }

  return (
    <DashboardLayout title="Integrations & Webhooks">
      <div className="space-y-6">
        <PageHeader
          eyebrow="التكاملات"
          title="التكاملات و Webhooks"
          description="اربط WABEK بمتجرك ونظام الفوترة وأدوات الأتمتة، واستقبل أحداث حسابك لحظيًا على خوادمك."
          actions={<Button variant="secondary" icon={BookOpenIcon} href={OUTGOING_WEBHOOKS_DOC}>مرجع Webhooks</Button>}
        >
          <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
            <Tabs idPrefix="integ" value={activeTab} onChange={openTab} aria-label="أقسام التكاملات"
              tabs={[
                { id: 'hub', label: 'التطبيقات والإضافات', icon: PuzzlePieceIcon },
                { id: 'webhooks', label: 'Webhooks الصادرة', icon: BoltIcon },
                { id: 'automation', label: 'Zapier وMake', icon: ArrowsRightLeftIcon },
              ]} />
          </div>
        </PageHeader>

        <TabPanel idPrefix="integ" id="hub" active={activeTab}>
          <IntegrationHub onOpenTab={openTab} />
        </TabPanel>

        {/* Kept mounted (hidden) so a just-created secret is not lost when switching tabs */}
        <div role="tabpanel" id="integ-panel-webhooks" aria-labelledby="integ-tab-webhooks" hidden={activeTab !== 'webhooks'}>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <WebhooksPanel />
            <SignatureSnippets />
          </div>
        </div>

        <TabPanel idPrefix="integ" id="automation" active={activeTab}>
          <AutomationGuides appUrl={appUrl} />
        </TabPanel>
      </div>
    </DashboardLayout>
  )
}
