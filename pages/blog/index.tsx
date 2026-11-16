import React, { useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { ArrowLeftIcon, NewspaperIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { EmptyState } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { MarketingPage, PageHero, Section } from '@/components/marketing/MarketingPage'
import { CategoryPill, PostCard, PostCover, PostMeta, postView } from '@/components/marketing/blog'
import { usePublicLang } from '@/components/marketing/usePublicLang'
import { posts } from '@/lib/blog-posts'

export default function BlogIndex() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const { lang, setLang, dir, t } = usePublicLang()
  const [cat, setCat] = useState<string>('all')

  const views = useMemo(() => posts.map((p, i) => postView(p, i, t)), [t])
  const categories = useMemo(() => Array.from(new Set(views.map(v => v.keys.cat))), [views])
  const featured = views[0]
  const filtered = cat === 'all' ? views.slice(1) : views.filter(v => v.keys.cat === cat)

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`${t('blog_title')} | ${name}`}</title>
        <meta name="description" content={t('blog_subtitle')} />
      </Head>
      <MarketingPage
        active="/blog"
        lang={lang}
        dir={dir}
        onLangChange={setLang}
        hero={<PageHero eyebrow={`${name} · ${t('blog_title')}`} title={t('mk_blog_h1')} subtitle={t('blog_subtitle')} className="pb-28 sm:pb-32" />}
      >
        {!featured ? (
          <Section>
            <EmptyState variant="card" icon={NewspaperIcon} title={t('mk_blog_empty')} />
          </Section>
        ) : (
          <>
            {/* Featured */}
            <section aria-label={t('blog_featured')} className="relative mx-auto -mt-20 max-w-[1280px] px-4 sm:px-8">
              <Link
                href={`/blog/${featured.post.slug}`}
                className="group grid overflow-hidden rounded-panel border border-line bg-surface text-ink shadow-hero transition-shadow hover:text-ink hover:shadow-card-hover md:grid-cols-[1.1fr_1fr]"
              >
                <PostCover post={featured.post} alt="" className="aspect-[16/9] md:aspect-auto md:min-h-[340px]" />
                <div className="flex flex-col justify-center gap-4 p-6 sm:p-9">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-gradient px-2.5 py-0.5 text-xs font-semibold text-[#04282C]">{t('blog_featured')}</span>
                    <CategoryPill cat={featured.keys.cat} label={featured.category} />
                  </div>
                  <h2 className="text-2xl font-bold leading-snug text-ink group-hover:text-link sm:text-[28px]">{featured.title}</h2>
                  <p className="text-[15px] leading-[1.85] text-body">{featured.excerpt}</p>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <PostMeta post={featured.post} lang={lang} t={t} />
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-link">
                      {t('blog_read')}
                      <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            </section>

            {/* All posts */}
            <Section align="start" title={t('blog_all')} className="pt-14 sm:pt-16">
              <div role="group" aria-label={t('blog_all')} className="-mt-4 mb-8 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['all', ...categories].map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={cat === c}
                    onClick={() => setCat(c)}
                    className={cn(
                      'h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors',
                      cat === c ? 'bg-[#04282C] text-[#EAF7F5] dark:bg-[#EAF7F5] dark:text-[#04282C]' : 'border border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                    )}
                  >
                    {c === 'all' ? t('blog_all') : t(c)}
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <EmptyState variant="card" icon={NewspaperIcon} title={t('mk_blog_empty')} />
              ) : (
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map(v => (
                    <li key={v.post.slug}><PostCard view={v} lang={lang} t={t} /></li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </MarketingPage>
    </>
  )
}
