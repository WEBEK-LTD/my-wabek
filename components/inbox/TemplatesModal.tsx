import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowUturnLeftIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, ExclamationTriangleIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, EmptyState, Field, Input, Modal, Skeleton } from '@/components/ui'
import { useInboxCopy } from './copy'

export interface InboxTemplate {
  name: string
  status: string
  category?: string
  language?: string
  body?: string
  variableCount?: number
  parameterFormat?: 'NAMED' | 'POSITIONAL'
  paramNames?: string[]
  hasButtons?: boolean
}

/** Positional params → array ({{1}}, {{2}} …); named → object ({{name}} …). */
export type TemplateParams = string[] | Record<string, string>

/** Variable keys of a template, in body order. */
function templateVars(t: InboxTemplate): string[] {
  if (t.parameterFormat === 'NAMED' && t.paramNames?.length) return t.paramNames
  return Array.from({ length: t.variableCount || 0 }, (_, i) => String(i + 1))
}

function renderPreview(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k: string) => (values[k] ? values[k] : m))
}

/**
 * Approved Meta templates of the conversation's number. The agent picks one,
 * fills in its variables, checks the preview and sends it (Cloud API numbers;
 * the only way to reach a customer outside the 24-hour window).
 */
export function TemplatesModal({ open, onClose, instanceId, onSend, defaults }: {
  open: boolean
  onClose: () => void
  instanceId?: string | null
  /** Sends the template; resolve on success (the modal closes), reject to stay open. */
  onSend?: (t: InboxTemplate, params: TemplateParams) => Promise<void>
  /** Suggested value for the first variable (e.g. the contact's name). */
  defaults?: { first?: string }
}) {
  const { c } = useInboxCopy()
  const { data, isLoading, isError } = useQuery(['inbox-templates', instanceId],
    () => axios.get('/api/whatsapp/templates', { params: { instance_id: instanceId } }).then(r => r.data),
    { enabled: open && !!instanceId, staleTime: 5 * 60000, retry: false })

  const templates: InboxTemplate[] = (data?.templates || []).filter((t: InboxTemplate) => t.status === 'APPROVED')

  const [selected, setSelected] = useState<InboxTemplate | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  useEffect(() => { if (!open) { setSelected(null); setValues({}) } }, [open])

  const pick = (t: InboxTemplate) => {
    const vars = templateVars(t)
    setValues(vars.length && defaults?.first ? { [vars[0]]: defaults.first } : {})
    setSelected(t)
  }

  const vars = useMemo(() => (selected ? templateVars(selected) : []), [selected])
  const missing = vars.some(k => !values[k]?.trim())

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(c('copied')) } catch {}
  }

  const send = async () => {
    if (!selected || !onSend || sending) return
    if (missing) { toast.error(c('tpl_fill_all')); return }
    const params: TemplateParams = selected.parameterFormat === 'NAMED'
      ? Object.fromEntries(vars.map(k => [k, values[k].trim()]))
      : vars.map(k => values[k].trim())
    setSending(true)
    try {
      await onSend(selected, params)
      onClose()
    } catch { /* the caller shows the error */ }
    finally { setSending(false) }
  }

  const footer = selected ? (
    <>
      <Button variant="secondary" icon={ArrowUturnLeftIcon} onClick={() => setSelected(null)} disabled={sending}>{c('tpl_back')}</Button>
      {onSend && <Button variant="dark" icon={PaperAirplaneIcon} loading={sending} disabled={missing} onClick={send}>{c('tpl_send')}</Button>}
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>{c('close')}</Button>
  )

  return (
    <Modal open={open} onClose={onClose} title={c('tpl_title')} description={c('tpl_d')} icon={DocumentDuplicateIcon} size="lg" footer={footer}>
      {selected ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[13px] font-semibold text-ink" dir="ltr">{selected.name}</span>
            {selected.language && <Badge size="sm" tone="neutral">{selected.language}</Badge>}
            {selected.category && <Badge size="sm" tone="brand">{selected.category}</Badge>}
          </div>
          {vars.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {vars.map((k, i) => (
                <Field key={k} label={selected.parameterFormat === 'NAMED' ? <span dir="ltr">{`{{${k}}}`}</span> : c('tpl_var', { n: i + 1 })} required>
                  <Input dir="auto" value={values[k] || ''} maxLength={1024}
                    onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} />
                </Field>
              ))}
            </div>
          )}
          {selected.body && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">{c('tpl_preview')}</p>
              <p className="whitespace-pre-wrap rounded-2xl border border-line bg-surface-2/60 p-3.5 text-[13px] leading-relaxed text-body" dir="auto">
                {renderPreview(selected.body, values)}
              </p>
            </div>
          )}
          {selected.hasButtons && <p className="text-xs text-muted">{c('tpl_buttons_note')}</p>}
        </div>
      ) : isLoading ? (
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {onSend && <Button size="xs" variant="dark" icon={PaperAirplaneIcon} onClick={() => pick(t)}>{c('tpl_pick')}</Button>}
                {t.body && <Button size="xs" variant="ghost" icon={ClipboardDocumentIcon} onClick={() => copy(t.body || '')}>{c('tpl_copy')}</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
