import React, { forwardRef, useEffect, useRef, useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon, CheckCircleIcon } from '@heroicons/react/20/solid'
import { Input, Spinner } from '@/components/ui'
import type { InputProps } from '@/components/ui'
import { cn } from '@/components/ui/utils'
import { useAuthCopy } from './copy'
import type { AuthErrorView } from './session'

/* ── OAuth ─────────────────────────────────────────────────── */

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
)
const GitHubMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
)
const FacebookMark = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
)

const PROVIDERS = {
  google: { mark: GoogleMark, label: 'continue_google', name: 'Google' },
  github: { mark: GitHubMark, label: 'continue_github', name: 'GitHub' },
  facebook: { mark: FacebookMark, label: 'continue_facebook', name: 'Facebook' },
} as const

/** OAuth buttons — plain links to /api/auth/oauth/<provider> (server-side redirect). */
export function OAuthButtons({ providers }: { providers: (keyof typeof PROVIDERS)[] }) {
  const { c } = useAuthCopy()
  const [pending, setPending] = useState<string | null>(null)
  const compact = providers.length > 1
  return (
    <div className={cn('grid gap-2.5', providers.length === 2 && 'grid-cols-2', providers.length === 3 && 'grid-cols-3')}>
      {providers.map(p => {
        const { mark: Mark, label, name } = PROVIDERS[p]
        return (
          <a
            key={p}
            href={`/api/auth/oauth/${p}`}
            onClick={() => setPending(p)}
            aria-busy={pending === p || undefined}
            aria-label={compact ? c(label) : undefined}
            title={compact ? c(label) : undefined}
            className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-btn border border-line bg-surface px-3 text-sm font-medium text-ink shadow-[0_1px_2px_rgb(var(--shadow)/0.04)] transition hover:border-line-strong hover:bg-surface-2 hover:text-ink"
          >
            {pending === p ? <Spinner className="h-4 w-4" /> : <Mark />}
            <span className="truncate">{compact ? name : c(label)}</span>
          </a>
        )
      })}
    </div>
  )
}

export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      <span className="text-xs text-muted">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

/* ── Password field with visibility toggle ─────────────────── */

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'endAdornment'>>(function PasswordInput(props, ref) {
  const { c } = useAuthCopy()
  const [show, setShow] = useState(false)
  return (
    <Input
      ref={ref}
      {...props}
      type={show ? 'text' : 'password'}
      className={cn('text-start', props.className)}
      endAdornment={
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? c('hide_password') : c('show_password')}
          aria-pressed={show}
          className="-me-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-ink"
        >
          {show ? <EyeSlashIcon className="h-[18px] w-[18px]" aria-hidden="true" /> : <EyeIcon className="h-[18px] w-[18px]" aria-hidden="true" />}
        </button>
      }
    />
  )
})

/* ── Password strength ─────────────────────────────────────── */

export function passwordScore(pw: string): number {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (pw.length < 8) s = Math.min(s, 1)
  return Math.min(4, Math.max(1, s))
}

export function PasswordStrength({ password }: { password: string }) {
  const { c } = useAuthCopy()
  if (!password) return null
  const score = passwordScore(password)
  const levels = ['strength_weak', 'strength_weak', 'strength_fair', 'strength_good', 'strength_strong'] as const
  const tones = ['bg-danger-solid', 'bg-danger-solid', 'bg-[#F5A524]', 'bg-brand-teal', 'bg-brand-green']
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map(i => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i <= score ? tones[score] : 'bg-track')} />
        ))}
      </div>
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted">
        <span>{c('strength', { level: c(levels[score]) })}</span>
        {score < 3 && <span>{c('strength_tip')}</span>}
      </p>
    </div>
  )
}

/* ── 6-digit code input ────────────────────────────────────── */

export function OtpCodeInput({ value, onChange, invalid, autoFocus, disabled, onComplete, describedBy }: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  autoFocus?: boolean
  disabled?: boolean
  onComplete?: (v: string) => void
  describedBy?: string
}) {
  const { c } = useAuthCopy()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  useEffect(() => { if (autoFocus) refs.current[0]?.focus() }, [autoFocus])

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(5, i))]
    el?.focus(); el?.select()
  }
  const commit = (next: string) => {
    const v = next.replace(/\D/g, '').slice(0, 6)
    onChange(v)
    if (v.length === 6) onComplete?.(v)
    return v
  }

  return (
    <div role="group" aria-label={c('otp_label')} dir="ltr" className="flex justify-between gap-2 sm:gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={c('otp_digit', { n: i + 1 })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onFocus={e => {
            // Keep the code contiguous: jump to the first empty box.
            if (i > value.length) focusAt(value.length)
            else e.currentTarget.select()
          }}
          onChange={e => {
            let v = e.target.value.replace(/\D/g, '')
            if (!v) return
            if (v.length === 2 && d) v = v.replace(d, '') || v[1]
            if (v.length > 1) { // paste / autofill
              const next = commit(value.slice(0, i) + v)
              focusAt(next.length)
              return
            }
            const next = commit(value.slice(0, i) + v + value.slice(i + 1))
            focusAt(Math.min(i + 1, next.length))
          }}
          onPaste={e => {
            const v = e.clipboardData.getData('text').replace(/\D/g, '')
            if (!v) return
            e.preventDefault()
            const next = commit(value.slice(0, i) + v)
            focusAt(next.length)
          }}
          onKeyDown={e => {
            if (e.key === 'Backspace') {
              e.preventDefault()
              if (d) { onChange(value.slice(0, i) + value.slice(i + 1)); focusAt(i) }
              else if (i > 0) { onChange(value.slice(0, i - 1) + value.slice(i)); focusAt(i - 1) }
            } else if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt(i - 1) }
            else if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(Math.min(i + 1, value.length)) }
          }}
          className={cn(
            'tabular h-14 w-full min-w-0 rounded-field border bg-surface text-center text-[22px] font-semibold text-ink outline-none transition-[border-color,box-shadow] sm:h-[60px]',
            'focus:border-brand-teal focus:shadow-ring disabled:opacity-60',
            invalid ? 'border-danger' : d ? 'border-brand-teal/60' : 'border-line-strong',
          )}
        />
      ))}
    </div>
  )
}

/* ── Inline alert ──────────────────────────────────────────── */

const ALERT_TONES = {
  danger: { cls: 'border-danger/25 bg-danger-bg text-danger', icon: XCircleIcon },
  warning: { cls: 'border-warning/25 bg-warning-bg text-warning', icon: ExclamationTriangleIcon },
  info: { cls: 'border-brand-teal/25 bg-chip text-chip-ink', icon: InformationCircleIcon },
  success: { cls: 'border-success/25 bg-success-bg text-success', icon: CheckCircleIcon },
}

export function AuthAlert({ tone = 'danger', title, children, className }: { tone?: keyof typeof ALERT_TONES; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const { cls, icon: Icon } = ALERT_TONES[tone]
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm', cls, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}

/** Renders a described server error (see describeAuthError). */
export function AuthErrorAlert({ error, className }: { error: AuthErrorView | null; className?: string }) {
  const { c } = useAuthCopy()
  if (!error) return null
  return (
    <AuthAlert tone={error.tone} title={error.title ? c(error.title) : undefined} className={className}>
      {error.raw || c(error.body, error.vars)}
    </AuthAlert>
  )
}

/* ── Full-screen status (magic link / OAuth hand-off) ──────── */

export function AuthStatusScreen({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-deep-landing px-6 text-center" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" width={64} height={64} className="h-16 w-16 animate-pulse object-contain" style={{ filter: 'drop-shadow(0 16px 40px rgba(139,224,122,0.35))' }} />
      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-semibold text-deep-ink">{title}</p>
        {subtitle && <p className="text-sm text-deep-muted">{subtitle}</p>}
      </div>
      <span className="h-1 w-40 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
        <span className="block h-full w-1/2 animate-[authbar_1.2s_ease-in-out_infinite] rounded-full bg-brand-gradient-x" />
      </span>
      <style>{`@keyframes authbar{0%{transform:translateX(-110%)}100%{transform:translateX(220%)}}`}</style>
    </div>
  )
}

/** Countdown for "send a new code" (seconds). */
export function useCooldown(initial = 0) {
  const [left, setLeft] = useState(initial)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return [left, setLeft] as const
}
