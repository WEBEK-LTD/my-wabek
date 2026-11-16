import React from 'react'
import { cn } from '@/components/ui/utils'

/**
 * Long-form reading styles (articles, legal documents). Uses tokens only, so
 * it works in light and dark mode, and logical properties for RTL.
 */
export const proseClasses = cn(
  'text-[16.5px] leading-[1.95] text-body',
  '[&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:scroll-mt-28 [&_h2]:text-[24px] [&_h2]:font-bold [&_h2]:leading-[1.35] [&_h2]:text-ink sm:[&_h2]:text-[26px]',
  '[&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:scroll-mt-28 [&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:text-ink',
  '[&_h4]:mb-2 [&_h4]:mt-6 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-ink',
  '[&_p]:mb-5',
  '[&_ul]:mb-5 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:ps-6',
  '[&_li]:mb-2 [&_li]:ps-1 [&_li::marker]:text-brand-ink',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_a]:font-medium [&_a]:text-link [&_a]:underline [&_a]:decoration-link/30 [&_a]:underline-offset-4 hover:[&_a]:text-link-hover',
  '[&_blockquote]:my-7 [&_blockquote]:rounded-e-2xl [&_blockquote]:border-s-4 [&_blockquote]:border-brand-teal [&_blockquote]:bg-chip/60 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-ink',
  '[&_code]:rounded-md [&_code]:bg-surface-3 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.88em] [&_code]:text-ink',
  '[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-[#04282C] [&_pre]:p-5 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:text-deep-ink [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit',
  '[&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border-b [&_th]:border-line [&_th]:bg-surface-2 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-start [&_th]:font-semibold [&_th]:text-ink [&_td]:border-b [&_td]:border-line-soft [&_td]:px-3 [&_td]:py-2.5',
  '[&_img]:my-6 [&_img]:rounded-2xl',
  '[&_hr]:my-10 [&_hr]:border-line',
  '[&>*:first-child]:mt-0',
)

export function Prose({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(proseClasses, className)} {...rest}>{children}</div>
}

export interface HeadingRef { id: string; text: string; level: 2 | 3 }

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()

/**
 * Adds stable ids to <h2>/<h3> in trusted, repository-authored HTML (blog
 * posts in lib/blog-posts.ts) and returns them for a table of contents.
 */
export function withHeadingIds(html: string): { html: string; headings: HeadingRef[] } {
  const headings: HeadingRef[] = []
  let n = 0
  const out = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, attrs: string | undefined, inner: string) => {
    const existing = attrs && /\sid="([^"]+)"/.exec(attrs)
    const id = existing ? existing[1] : `section-${++n}`
    headings.push({ id, text: stripTags(inner), level: lvl === '2' ? 2 : 3 })
    const rest = existing ? attrs : `${attrs || ''} id="${id}"`
    return `<h${lvl}${rest}>${inner}</h${lvl}>`
  })
  return { html: out, headings }
}
