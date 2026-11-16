import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Button, cn } from '@/components/ui'

export interface LoadErrorProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
  size?: 'sm' | 'md'
}

/** Error state for data views: what failed, and a retry action. */
export function LoadError({ title = 'تعذّر تحميل البيانات', description = 'تحقّق من اتصالك ثم أعد المحاولة.', onRetry, className, size = 'md' }: LoadErrorProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 text-center', size === 'sm' ? 'px-4 py-8' : 'px-6 py-14', className)}>
      <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-danger-bg text-danger">
        <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="max-w-md text-sm text-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={onRetry} className="mt-2">
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}

export default LoadError
