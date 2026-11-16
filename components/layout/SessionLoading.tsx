import { Spinner } from '@/components/ui/Spinner'

/**
 * Full-screen placeholder shown by the dashboard/admin shells while the
 * session cookie is being checked (or while a redirect to the login page is
 * in flight), so protected content never flashes and no redirect happens
 * before the session is resolved.
 */
export default function SessionLoading({ label, dir }: { label: string; dir?: 'rtl' | 'ltr' }) {
  return (
    <div dir={dir} className="flex h-screen items-center justify-center bg-canvas text-muted">
      <Spinner className="h-6 w-6 text-brand-teal" label={label} />
    </div>
  )
}
