import { useQuery } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { DocumentDuplicateIcon, ClipboardDocumentIcon, MegaphoneIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { Badge, Button, EmptyState, Modal, Skeleton } from '@/components/ui'
import { useInboxCopy } from './copy'

interface Template { name: string; status: string; category?: string; language?: string; body?: string; variableCount?: number }

/**
 * Approved Meta templates of the conversation's number. Read-only: there is no
 * inbox endpoint that sends a template, so the action points to campaigns.
 */
export function TemplatesModal({ open, onClose, instanceId }: { open: boolean; onClose: () => void; instanceId?: string | null }) {
  const { c } = useInboxCopy()
  const { data, isLoading, isError } = useQuery(['inbox-templates', instanceId],
    () => axios.get('/api/whatsapp/templates', { params: { instance_id: instanceId } }).then(r => r.data),
    { enabled: open && !!instanceId, staleTime: 5 * 60000, retry: false })

  const templates: Template[] = (data?.templates || []).filter((t: Template) => t.status === 'APPROVED')

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(c('copied')) } catch {}
  }

  return (
    <Modal open={open} onClose={onClose} title={c('tpl_title')} description={c('tpl_d')} icon={DocumentDuplicateIcon} size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{c('close')}</Button><Button variant="dark" icon={MegaphoneIcon} href="/dashboard/campaigns">{c('tpl_send_campaign')}</Button></>}>
      {isLoading ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
      ) : isError ? (
        <EmptyState size="sm" icon={ExclamationTriangleIcon} title={c('tpl_error')} />
      ) : templates.length === 0 ? (
        <EmptyState size="sm" icon={DocumentDuplicateIcon} title={c('tpl_empty')} description={data?.note ? c('tpl_wa_web') : data?.error || undefined} />
      ) : (
        <ul className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto">
          {templates.map(t => (
            <li key={`${t.name}-${t.language}`} className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[13px] font-semibold text-ink" dir="ltr">{t.name}</span>
                {t.language && <Badge size="sm" tone="neutral">{t.language}</Badge>}
                {t.category && <Badge size="sm" tone="brand">{t.category}</Badge>}
                {!!t.variableCount && <Badge size="sm" tone="violet">{c('tpl_vars', { n: t.variableCount })}</Badge>}
              </div>
              {t.body && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-body" dir="auto">{t.body}</p>}
              {t.body && (
                <Button size="xs" variant="ghost" icon={ClipboardDocumentIcon} className="mt-2" onClick={() => copy(t.body || '')}>{c('tpl_copy')}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
