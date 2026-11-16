import Head from 'next/head'
import { HomeIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui'
import { ErrorScreen } from '@/components/marketing/ErrorScreen'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/public/marketing'

export default function Custom404() {
  const { t, lang, dir } = useT(messages)
  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{t('title_404')}</title>
      </Head>
      <ErrorScreen
        code="404"
        lang={lang}
        dir={dir}
        title={t('mk_404_title')}
        body={t('mk_404_body')}
        actions={
          <>
            <Button href="/dashboard" icon={Squares2X2Icon} size="lg" className="rounded-[14px]">{t('mk_go_dashboard')}</Button>
            <Button href="/" variant="on-deep-ghost" icon={HomeIcon} size="lg" className="rounded-[14px]">{t('mk_go_home')}</Button>
          </>
        }
      />
    </>
  )
}
