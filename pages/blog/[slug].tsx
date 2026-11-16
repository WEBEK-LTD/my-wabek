import React, { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ArrowRightIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useWhiteLabel } from '@/hooks/useWhiteLabel'
import { Button, EmptyState, Skeleton } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { MarketingPage, Section } from '@/components/marketing/MarketingPage'
import { CategoryPill, PostCard, PostCover, PostMeta, postView } from '@/components/marketing/blog'
import { Prose, withHeadingIds } from '@/components/marketing/Prose'
import { usePublicLang } from '@/components/marketing/usePublicLang'
import { posts } from '@/lib/blog-posts'
import { getPostContent } from '@/lib/blog-translations'

export default function BlogPost() {
  const { brandName } = useWhiteLabel()
  const name = brandName || 'WABEK'
  const router = useRouter()
  const { slug } = router.query
  const { lang, setLang, dir, t } = usePublicLang()
  const [current, setCurrent] = useState('')

  const postIndex = posts.findIndex(p => p.slug === slug)
  const post = posts[postIndex]
  const view = post ? postView(post, postIndex, t) : null

  // Article HTML is repository-authored (lib/blog-posts.ts, lib/blog-translations.ts), never user input.
  const translatedContent = post ? getPostContent(post.slug, lang) : null
  const { html, headings } = useMemo(
    () => withHeadingIds(post ? translatedContent || post.content : ''),
    [post, translatedContent],
  )
  const contentDir = translatedContent ? dir : 'ltr'
  const toc = headings.filter(h => h.level === 2)

  // Related: same category first, then the most recent others.
  const related = useMemo(() => {
    if (!view) return []
    const all = posts.map((p, i) => postView(p, i, t)).filter(v => v.post.slug !== view.post.slug)
    return [...all.filter(v => v.keys.cat === view.keys.cat), ...all.filter(v => v.keys.cat !== view.keys.cat)].slice(0, 3)
  }, [view?.post.slug, view?.keys.cat, t]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toc.length || typeof IntersectionObserver === 'undefined') return
    const els = toc.map(h => document.getElementById(h.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setCurrent(visible[0].target.id)
      },
      { rootMargin: '-96px 0px -65% 0px' },
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [html]) // eslint-disable-line react-hooks/exhaustive-deps

  const back = (
    <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
      <ArrowRightIcon className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />
      {t('blog_back')}
    </Link>
  )

  if (!router.isReady) {
    return (
      <MarketingPage active="/blog" lang={lang} dir={dir} onLangChange={setLang}>
        <div className="mx-auto max-w-3xl px-4 py-16" aria-busy="true">
          <Skeleton className="mb-4 h-5 w-32" />
          <Skeleton className="mb-6 h-10 w-full" />
          <Skeleton className="mb-8 aspect-[16/9] w-full" />
          <Skeleton lines={6} />
        </div>
      </MarketingPage>
    )
  }

  if (!post || !view) {
    return (
      <>
        <Head>
          <link rel="icon" href="/brand/favicon-32.png" />
          <title>{`${t('mk_article_not_found')} | ${name}`}</title>
        </Head>
        <MarketingPage active="/blog" lang={lang} dir={dir} onLangChange={setLang}>
          <Section narrow>
            <EmptyState
              variant="card"
              icon={DocumentMagnifyingGlassIcon}
              title={t('mk_article_not_found')}
              description={t('mk_article_not_found_body')}
              action={<Button href="/blog" variant="secondary">{t('blog_back')}</Button>}
            />
          </Section>
        </MarketingPage>
      </>
    )
  }

  return (
    <>
      <Head>
        <link rel="icon" href="/brand/favicon-32.png" />
        <title>{`${view.title} | ${name}`}</title>
        <meta name="description" content={view.excerpt} />
        <meta property="og:title" content={view.title} />
        <meta property="og:description" content={view.excerpt} />
      </Head>
      <MarketingPage active="/blog" lang={lang} dir={dir} onLangChange={setLang}>
        <article>
          {/* Header */}
          <header className="mx-auto max-w-[1180px] px-4 pt-8 sm:px-8 sm:pt-12">
            <div className="mx-auto max-w-3xl">
              {back}
              <div className="mt-6 flex flex-col gap-4">
                <CategoryPill cat={view.keys.cat} label={view.category} />
                <h1 className="text-[30px] font-bold leading-[1.3] text-ink sm:text-[42px] sm:leading-[1.25]">{view.title}</h1>
                <p className="text-lg leading-[1.85] text-body">{view.excerpt}</p>
                <div className="flex items-center gap-3 border-y border-line py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-[#04282C]" aria-hidden="true">{name.slice(0, 1)}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{name}</span>
                    <PostMeta post={post} lang={lang} t={t} />
                  </div>
                </div>
              </div>
            </div>
            <PostCover post={post} alt={view.title} className="mx-auto mt-8 aspect-[21/9] max-w-5xl rounded-panel shadow-hero" />
          </header>

          {/* Body + TOC */}
          <div className={cn('mx-auto grid max-w-[1180px] gap-10 px-4 py-12 sm:px-8 sm:py-16', toc.length > 1 && 'lg:grid-cols-[minmax(0,1fr)_240px]')}>
            <div className={cn('min-w-0', toc.length <= 1 && 'mx-auto w-full max-w-3xl')}>
              {toc.length > 1 && (
                <details className="group mb-8 rounded-card border border-line bg-surface lg:hidden">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink">{t('mk_toc')}</summary>
                  <ol className="border-t border-line-soft p-2">
                    {toc.map(h => (
                      <li key={h.id}><a href={`#${h.id}`} className="block rounded-lg px-3 py-1.5 text-[13px] text-muted hover:bg-surface-3 hover:text-ink" dir={contentDir}>{h.text}</a></li>
                    ))}
                  </ol>
                </details>
              )}
              <Prose dir={contentDir} className="mx-auto max-w-[720px]" dangerouslySetInnerHTML={{ __html: html }} />

              <div className="relative mx-auto mt-14 max-w-[720px] overflow-hidden rounded-panel bg-[#04282C] p-8 text-center text-deep-ink">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,#0E6C72,rgba(14,108,114,0)_60%)]" />
                <div className="relative flex flex-col items-center gap-3">
                  <h2 className="text-2xl font-bold text-deep-ink">{t('about_cta_title')}</h2>
                  <p className="text-[15px] text-deep-muted">{name} — {t('hero_note')}</p>
                  <Button href="/auth/register" size="lg" className="mt-2 rounded-[14px] px-8">{t('get_started')}</Button>
                </div>
              </div>
            </div>

            {toc.length > 1 && (
              <aside className="hidden lg:block">
                <nav aria-label={t('mk_toc')} className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
                  <p className="mb-3 px-3 text-xs font-semibold text-muted">{t('mk_toc')}</p>
                  <ol className="flex flex-col gap-0.5" dir={contentDir}>
                    {toc.map(h => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          aria-current={current === h.id ? 'true' : undefined}
                          className={cn(
                            'block rounded-lg border-s-2 px-3 py-1.5 text-[13px] leading-snug transition-colors',
                            current === h.id ? 'border-brand-teal bg-chip/60 font-medium text-ink' : 'border-transparent text-muted hover:bg-surface-3 hover:text-ink',
                          )}
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              </aside>
            )}
          </div>
        </article>

        {related.length > 0 && (
          <div className="border-t border-line bg-surface-2">
            <Section align="start" title={t('mk_related')} action={<Link href="/blog" className="text-sm font-semibold">{t('blog_all')}</Link>}>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map(v => <li key={v.post.slug}><PostCard view={v} lang={lang} t={t} /></li>)}
              </ul>
            </Section>
          </div>
        )}
      </MarketingPage>
    </>
  )
}
