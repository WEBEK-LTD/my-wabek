import React, { useState } from 'react'
import Link from 'next/link'
import { ClockIcon } from '@heroicons/react/24/outline'
import type { BlogPost } from '@/lib/blog-posts'
import { cn } from '@/components/ui/utils'
import { localeFor, translate, useT } from '@/lib/i18n-local'
import messages from '@/locales/public/blog'

type BlogKey = keyof typeof messages.en
/** Translator for the blog dictionary that accepts the dynamic post keys. */
export function blogT(lang: string) {
  return (k: string) => (k in messages.en ? translate(messages, lang, k as BlogKey) : k)
}

/** Translation keys per post, by position in lib/blog-posts.ts. */
export const POST_KEYS = [
  { tk: 'post1_title', ek: 'post1_excerpt', cat: 'blog_cat_guides' },
  { tk: 'post2_title', ek: 'post2_excerpt', cat: 'blog_cat_automation' },
  { tk: 'post3_title', ek: 'post3_excerpt', cat: 'blog_cat_ai' },
  { tk: 'post4_title', ek: 'post4_excerpt', cat: 'blog_cat_marketing' },
  { tk: 'post5_title', ek: 'post5_excerpt', cat: 'blog_cat_guides' },
  { tk: 'post6_title', ek: 'post6_excerpt', cat: 'blog_cat_reseller' },
  { tk: 'post7_title', ek: 'post7_excerpt', cat: 'blog_cat_integrations' },
]
export const FALLBACK_KEYS = { tk: '', ek: '', cat: 'blog_cat_guides' }

export const CAT_TONE: Record<string, string> = {
  blog_cat_guides: 'bg-chip text-chip-ink',
  blog_cat_automation: 'bg-success-bg text-success',
  blog_cat_ai: 'bg-violet-bg text-violet',
  blog_cat_marketing: 'bg-warning-bg text-warning',
  blog_cat_reseller: 'bg-violet-bg text-violet',
  blog_cat_integrations: 'bg-chip text-chip-ink',
}

export interface PostView {
  post: BlogPost
  keys: { tk: string; ek: string; cat: string }
  title: string
  excerpt: string
  category: string
}

/** Resolve the translated title/excerpt/category for a post. */
export function postView(post: BlogPost, index: number, t: (k: string) => string): PostView {
  const keys = POST_KEYS[index] || FALLBACK_KEYS
  const tr = (k: string, fallback: string) => {
    if (!k) return fallback
    const v = t(k)
    return v && v !== k ? v : fallback
  }
  return { post, keys, title: tr(keys.tk, post.title), excerpt: tr(keys.ek, post.excerpt), category: t(keys.cat) }
}

/** "April 27, 2026" → localised date (falls back to the stored string). */
export function formatPostDate(raw: string, lang: string) {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  try {
    return new Intl.DateTimeFormat(localeFor(lang), { year: 'numeric', month: 'long', day: 'numeric' }).format(d)
  } catch {
    return raw
  }
}

export function CategoryPill({ cat, label, className }: { cat: string; label: string; className?: string }) {
  return <span className={cn('inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold', CAT_TONE[cat] || 'bg-chip text-chip-ink', className)}>{label}</span>
}

export function PostMeta({ post, className }: { post: BlogPost; className?: string }) {
  const { t, lang, fmtNumber } = useT(messages)
  return (
    <span className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted', className)}>
      <time dateTime={new Date(post.date).toString() !== 'Invalid Date' ? new Date(post.date).toISOString().slice(0, 10) : undefined}>{formatPostDate(post.date, lang)}</time>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1"><ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />{fmtNumber(post.readTime)} {t('blog_min_read')}</span>
    </span>
  )
}

/** Cover image, or a branded gradient tile when a post has none. */
export function PostCover({ post, alt, className }: { post: BlogPost; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('relative overflow-hidden bg-deep-panel', className)}>
      {post.image && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt={alt} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      ) : (
        <div aria-hidden="true" className="h-full w-full bg-[radial-gradient(80%_100%_at_100%_0%,#12B5BE,rgba(18,181,190,0)_60%),radial-gradient(60%_80%_at_0%_100%,#8BE07A55,transparent_60%)]" />
      )}
    </div>
  )
}

export function PostCard({ view, headingLevel: H = 'h3' }: { view: PostView; headingLevel?: 'h2' | 'h3' }) {
  return (
    <Link
      href={`/blog/${view.post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface text-ink shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:text-ink hover:shadow-card-hover"
    >
      <PostCover post={view.post} alt="" className="aspect-[16/9]" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <CategoryPill cat={view.keys.cat} label={view.category} />
        <H className="text-base font-semibold leading-snug text-ink group-hover:text-link">{view.title}</H>
        <p className="line-clamp-2 text-sm leading-relaxed text-body">{view.excerpt}</p>
        <PostMeta post={view.post} className="mt-auto pt-1" />
      </div>
    </Link>
  )
}
