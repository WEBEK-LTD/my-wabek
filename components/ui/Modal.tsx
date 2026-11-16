import React, { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from './utils'
import { Button } from './Button'
import { useTranslation } from '@/hooks/useTranslation'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  /** Icon tile before the title. */
  icon?: React.ElementType
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  /** Footer actions (right-aligned at the end side). */
  footer?: React.ReactNode
  /** Hide the close (X) button. */
  hideClose?: boolean
  /** Element to focus first (headlessui initialFocus). */
  initialFocus?: React.MutableRefObject<HTMLElement | null>
  /** Panel renders as a bottom sheet on small screens (default true). */
  sheetOnMobile?: boolean
  className?: string
  children?: React.ReactNode
}

const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl', full: 'sm:max-w-[min(1200px,calc(100vw-48px))]' }

/**
 * Modal / Dialog — headlessui Dialog with focus trap, Esc to close and scrim.
 *
 *   <Modal open={open} onClose={() => setOpen(false)} title="حملة جديدة"
 *     footer={<><Button variant="secondary" onClick={…}>إلغاء</Button><Button>إنشاء</Button></>}>
 *     …form…
 *   </Modal>
 */
export function Modal({ open, onClose, title, description, icon: Icon, size = 'md', footer, hideClose, initialFocus, sheetOnMobile = true, className, children }: ModalProps) {
  const { t, dir } = useTranslation()
  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-modal" onClose={onClose} initialFocus={initialFocus} dir={dir}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-overlay/55 backdrop-blur-[3px]" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className={cn('flex min-h-full justify-center p-0 sm:items-center sm:p-6', sheetOnMobile ? 'items-end' : 'items-center p-4')}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200" enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-[0.97]" enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150" leaveFrom="opacity-100 translate-y-0 sm:scale-100" leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-[0.97]"
            >
              <Dialog.Panel
                className={cn(
                  'relative flex w-full flex-col border border-line bg-surface text-ink shadow-dropdown',
                  sheetOnMobile ? 'max-h-[92vh] rounded-t-[22px] sm:rounded-panel' : 'rounded-panel',
                  'sm:max-h-[calc(100vh-48px)]',
                  widths[size],
                  className,
                )}
              >
                {(title || !hideClose) && (
                  <div className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
                    {Icon && (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip text-brand-ink">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      {title && <Dialog.Title className="text-lg font-semibold leading-snug text-ink">{title}</Dialog.Title>}
                      {description && <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>}
                    </div>
                    {!hideClose && (
                      <button
                        type="button"
                        onClick={onClose}
                        className="-me-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-ink"
                        aria-label={t('ui_close')}
                      >
                        <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
                {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div> : <div className="h-3" />}
                {footer && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft px-5 py-4 sm:px-6">{footer}</div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: React.ReactNode
  cancelLabel?: React.ReactNode
  /** Red confirm button + warning icon. */
  destructive?: boolean
  loading?: boolean
}

/**
 * ConfirmDialog — small yes/no modal.
 *
 *   <ConfirmDialog destructive open={!!toDelete} onClose={…} onConfirm={remove}
 *     title="حذف جهة الاتصال؟" description="لا يمكن التراجع عن هذا الإجراء." confirmLabel="حذف" />
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, cancelLabel, destructive, loading }: ConfirmDialogProps) {
  const { lang } = useTranslation()
  const ar = lang === 'ar'
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      icon={destructive ? ExclamationTriangleIcon : undefined}
      sheetOnMobile={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel ?? (ar ? 'إلغاء' : 'Cancel')}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={() => onConfirm()} loading={loading}>{confirmLabel ?? (ar ? 'تأكيد' : 'Confirm')}</Button>
        </>
      }
    />
  )
}

export default Modal
