import Head from 'next/head'
import { ArrowPathIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui'
import { ErrorScreen } from '@/components/marketing/ErrorScreen'
import { usePublicLang } from '@/components/marketing/usePublicLang'

export default function Custom500() {
  const { lang, dir, t } = usePublicLang()
  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`500 – ${t('mk_500_title')} | WABEK`}</title>
      </Head>
      <ErrorScreen
        code="500"
        lang={lang}
        dir={dir}
        title={t('mk_500_title')}
        body={t('mk_500_body')}
        actions={
          <>
            <Button onClick={() => window.location.reload()} icon={ArrowPathIcon} size="lg" className="rounded-[14px]">{t('mk_try_again')}</Button>
            <Button href="/dashboard" variant="on-deep-ghost" icon={Squares2X2Icon} size="lg" className="rounded-[14px]">{t('mk_go_dashboard')}</Button>
          </>
        }
      />
    </>
  )
}
