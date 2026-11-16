import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { PuzzlePieceIcon, BoltIcon, ArrowsRightLeftIcon, BookOpenIcon } from '@heroicons/react/24/outline'
import { Button, PageHeader, TabPanel, Tabs } from '@/components/ui'
import { IntegrationHub, AutomationGuides } from '@/components/integrations/Hub'
import { WebhooksPanel } from '@/components/integrations/WebhooksPanel'
import { SignatureSnippets, OUTGOING_WEBHOOKS_DOC } from '@/components/integrations/SignatureSnippets'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/integrations'

const TABS = ['hub', 'webhooks', 'automation']

export default function IntegrationsPage() {
  const { t } = useT(messages)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('hub')
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  // ?tab=webhooks deep links
  useEffect(() => {
    const tab = String(router.query.tab || '')
    if (TABS.includes(tab)) setActiveTab(tab)
  }, [router.query.tab])

  const openTab = (tab: string) => {
    setActiveTab(tab)
    router.replace({ pathname: router.pathname, query: tab === 'hub' ? {} : { tab } }, undefined, { shallow: true })
  }

  return (
    <DashboardLayout title={t('page_title')}>
      <div className="space-y-6">
        <PageHeader
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
          actions={<Button variant="secondary" icon={BookOpenIcon} href={OUTGOING_WEBHOOKS_DOC}>{t('webhooks_ref')}</Button>}
        >
          <div className="-mx-1 overflow-x-auto px-1 scrollbar-none">
            <Tabs idPrefix="integ" value={activeTab} onChange={openTab} aria-label={t('tabs_aria')}
              tabs={[
                { id: 'hub', label: t('tab_hub'), icon: PuzzlePieceIcon },
                { id: 'webhooks', label: t('tab_webhooks'), icon: BoltIcon },
                { id: 'automation', label: t('tab_automation'), icon: ArrowsRightLeftIcon },
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
