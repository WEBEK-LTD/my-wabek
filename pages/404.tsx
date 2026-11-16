import Head from 'next/head'
import { HomeIcon, Squares2X2Icon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui'
import { ErrorScreen } from '@/components/marketing/ErrorScreen'
import { usePublicLang } from '@/components/marketing/usePublicLang'

export default function Custom404() {
  const { lang, dir, t } = usePublicLang()
  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`404 | ${t('mk_404_title')}`}</title>
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
