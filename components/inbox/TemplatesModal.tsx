import { useEffect, useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowUturnLeftIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, ExclamationTriangleIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, EmptyState, Field, Input, Modal, Skeleton } from '@/components/ui'
import { useT } from '@/lib/i18n-local'
import messages from '@/locales/dashboard/inbox'

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
function templateVars(tpl: InboxTemplate): string[] {
  if (tpl.parameterFormat === 'NAMED' && tpl.paramNames?.length) return tpl.paramNames
  return Array.from({ length: tpl.variableCount || 0 }, (_, i) => String(i + 1))
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
  onSend?: (tpl: InboxTemplate, params: TemplateParams) => Promise<void>
  /** Suggested value for the first variable (e.g. the contact's name). */
  defaults?: { first?: string }
}) {
  const { t } = useT(messages)
  const { data, isLoading, isError } = useQuery(['inbox-templates', instanceId],
    () => axios.get('/api/whatsapp/templates', { params: { instance_id: instanceId } }).then(r => r.data),
    { enabled: open && !!instanceId, staleTime: 5 * 60000, retry: false })

  const templates: InboxTemplate[] = (data?.templates || []).filter((tpl: InboxTemplate) => tpl.status === 'APPROVED')

  const [selected, setSelected] = useState<InboxTemplate | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

  useEffect(() => { if (!open) { setSelected(null); setValues({}) } }, [open])

  const pick = (tpl: InboxTemplate) => {
    const vars = templateVars(tpl)
    setValues(vars.length && defaults?.first ? { [vars[0]]: defaults.first } : {})
    setSelected(tpl)
  }

  const vars = useMemo(() => (selected ? templateVars(selected) : []), [selected])
  const missing = vars.some(k => !values[k]?.trim())

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(t('copied')) } catch {}
  }

  const send = async () => {
    if (!selected || !onSend || sending) return
    if (missing) { toast.error(t('tpl_fill_all')); return }
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
      <Button variant="secondary" icon={ArrowUturnLeftIcon} onClick={() => setSelected(null)} disabled={sending}>{t('tpl_back')}</Button>
      {onSend && <Button variant="dark" icon={PaperAirplaneIcon} loading={sending} disabled={missing} onClick={send}>{t('tpl_send')}</Button>}
    </>
  ) : (
    <Button variant="secondary" onClick={onClose}>{t('close')}</Button>
  )

  return (
    <Modal open={open} onClose={onClose} title={t('tpl_title')} description={t('tpl_d')} icon={DocumentDuplicateIcon} size="lg" footer={footer}>
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
                <Field key={k} label={selected.parameterFormat === 'NAMED' ? <span dir="ltr">{`{{${k}}}`}</span> : t('tpl_var', { n: i + 1 })} required>
                  <Input dir="auto" value={values[k] || ''} maxLength={1024}
                    onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} />
                </Field>
              ))}
            </div>
          )}
          {selected.body && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">{t('tpl_preview')}</p>
              <p className="whitespace-pre-wrap rounded-2xl border border-line bg-surface-2/60 p-3.5 text-[13px] leading-relaxed text-body" dir="auto">
                {renderPreview(selected.body, values)}
              </p>
            </div>
          )}
          {selected.hasButtons && <p className="text-xs text-muted">{t('tpl_buttons_note')}</p>}
        </div>
      ) : isLoading ? (
        <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
      ) : isError ? (
        <EmptyState size="sm" icon={ExclamationTriangleIcon} title={t('tpl_error')} />
      ) : templates.length === 0 ? (
        <EmptyState size="sm" icon={DocumentDuplicateIcon} title={t('tpl_empty')} description={data?.note ? t('tpl_wa_web') : data?.error || undefined} />
      ) : (
        <ul className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto">
          {templates.map(tpl => (
            <li key={`${tpl.name}-${tpl.language}`} className="rounded-2xl border border-line bg-surface-2/60 p-3.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[13px] font-semibold text-ink" dir="ltr">{tpl.name}</span>
                {tpl.language && <Badge size="sm" tone="neutral">{tpl.language}</Badge>}
                {tpl.category && <Badge size="sm" tone="brand">{tpl.category}</Badge>}
                {!!tpl.variableCount && <Badge size="sm" tone="violet">{t('tpl_vars', { n: tpl.variableCount })}</Badge>}
              </div>
              {tpl.body && <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-body" dir="auto">{tpl.body}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {onSend && <Button size="xs" variant="dark" icon={PaperAirplaneIcon} onClick={() => pick(tpl)}>{t('tpl_pick')}</Button>}
                {tpl.body && <Button size="xs" variant="ghost" icon={ClipboardDocumentIcon} onClick={() => copy(tpl.body || '')}>{t('tpl_copy')}</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
