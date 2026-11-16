import { useRef, useState } from 'react'
import Papa from 'papaparse'
import axios from 'axios'
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, CheckCircleIcon, DocumentTextIcon, ExclamationTriangleIcon, TableCellsIcon,
} from '@heroicons/react/24/outline'
import { Badge, Button, Field, Modal, Select, Table, TBody, TD, TH, THead, TR, cn, formatNumber } from '@/components/ui'
import { apiError, downloadCSV } from '@/components/analytics/format'

/** Columns the import endpoint (PUT /api/contacts) reads. */
type Target = 'phone' | 'name' | 'email' | 'tags'
const TARGETS: Array<{ key: Target; label: string; required?: boolean; hint?: string }> = [
  { key: 'phone', label: 'رقم الهاتف', required: true, hint: 'تُحذف الرموز والمسافات تلقائيًا' },
  { key: 'name', label: 'الاسم' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'tags', label: 'الوسوم', hint: 'افصل بين الوسوم بفاصلة منقوطة ;' },
]

const GUESS: Record<Target, RegExp> = {
  phone: /^(phone|mobile|number|whatsapp|tel|msisdn|cell|رقم|الهاتف|هاتف|جوال|الجوال|موبايل)/i,
  name: /^(name|full ?name|contact|الاسم|اسم)/i,
  email: /^(e-?mail|البريد|بريد)/i,
  tags: /^(tags?|labels?|الوسوم|وسوم|وسم)/i,
}

const MAX_BYTES = 5 * 1024 * 1024
const MAX_ROWS = 20000

type Step = 'upload' | 'map' | 'result'
interface Parsed { fileName: string; headers: string[]; rows: Record<string, string>[] }

export interface ImportWizardProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold',
        done ? 'bg-brand-gradient text-[#04282C]' : active ? 'bg-ink text-canvas' : 'bg-surface-3 text-muted')}>{n}</span>
      <span className={cn('text-[13px]', active || done ? 'font-medium text-ink' : 'text-muted')}>{label}</span>
    </li>
  )
}

/**
 * CSV import: upload → map columns (with a preview) → result summary.
 * The mapped rows are re-serialised as phone,name,email,tags and sent to the
 * existing PUT /api/contacts endpoint, which parses them with papaparse and
 * upserts by phone.
 */
export function ImportWizard({ open, onClose, onImported }: ImportWizardProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('upload')
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [mapping, setMapping] = useState<Record<Target, string>>({ phone: '', name: '', email: '', tags: '' })
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; total: number; skipped: number } | null>(null)

  const reset = () => {
    setStep('upload'); setParsed(null); setError(''); setResult(null); setImporting(false)
    setMapping({ phone: '', name: '', email: '', tags: '' })
    if (fileRef.current) fileRef.current.value = ''
  }
  const close = () => { if (importing) return; onClose(); setTimeout(reset, 250) }

  const readFile = (file: File) => {
    setError('')
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') { setError('اختر ملفًا بصيغة CSV.'); return }
    if (file.size > MAX_BYTES) { setError('حجم الملف أكبر من 5 ميغابايت. قسّمه إلى ملفات أصغر.'); return }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields || []).filter(Boolean)
        if (!headers.length || !res.data.length) { setError('الملف فارغ أو لا يحتوي على صف عناوين.'); return }
        const guess = { phone: '', name: '', email: '', tags: '' } as Record<Target, string>
        for (const t of TARGETS) guess[t.key] = headers.find(h => GUESS[t.key].test(h)) || ''
        setMapping(guess)
        setParsed({ fileName: file.name, headers, rows: res.data })
        setStep('map')
      },
      error: () => setError('تعذّرت قراءة الملف. تأكّد أنه ملف CSV صالح.'),
    })
  }

  const mapped = (parsed?.rows || []).map(r => ({
    phone: mapping.phone ? String(r[mapping.phone] ?? '').trim() : '',
    name: mapping.name ? String(r[mapping.name] ?? '').trim() : '',
    email: mapping.email ? String(r[mapping.email] ?? '').trim() : '',
    tags: mapping.tags ? String(r[mapping.tags] ?? '').trim() : '',
  }))
  const valid = mapped.filter(r => r.phone.replace(/\D/g, '').length >= 5)
  const skipped = mapped.length - valid.length
  const overLimit = valid.length > MAX_ROWS

  const runImport = async () => {
    if (!valid.length) return
    const csv = Papa.unparse({ fields: ['phone', 'name', 'email', 'tags'], data: valid.slice(0, MAX_ROWS).map(r => [r.phone, r.name, r.email, r.tags]) })
    if (csv.length > MAX_BYTES) { setError('البيانات بعد المطابقة أكبر من الحد المسموح (5 ميغابايت).'); return }
    setImporting(true); setError('')
    try {
      const { data } = await axios.put('/api/contacts', { csv_data: csv })
      setResult({ imported: data.imported ?? 0, total: data.total ?? valid.length, skipped })
      setStep('result')
      onImported()
    } catch (e) {
      setError(apiError(e, 'فشل الاستيراد'))
    } finally {
      setImporting(false)
    }
  }

  const template = () => downloadCSV('wabek-contacts-template.csv', [['phone', 'name', 'email', 'tags'], ['+905551234567', 'Ahmed Ali', 'ahmed@example.com', 'vip;customer']])

  const footer = step === 'upload' ? (
    <>
      <Button variant="ghost" icon={ArrowDownTrayIcon} onClick={template} className="me-auto">تنزيل نموذج</Button>
      <Button variant="secondary" onClick={close}>إلغاء</Button>
    </>
  ) : step === 'map' ? (
    <>
      <Button variant="ghost" onClick={reset} className="me-auto" disabled={importing}>ملف آخر</Button>
      <Button variant="secondary" onClick={close} disabled={importing}>إلغاء</Button>
      <Button icon={ArrowUpTrayIcon} loading={importing} disabled={!mapping.phone || !valid.length} onClick={runImport}>
        استيراد {formatNumber(Math.min(valid.length, MAX_ROWS))} جهة اتصال
      </Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={reset}>استيراد ملف آخر</Button>
      <Button onClick={close}>تم</Button>
    </>
  )

  return (
    <Modal open={open} onClose={close} size="xl" icon={TableCellsIcon} title="استيراد جهات اتصال من CSV"
      description="ارفع ملفك، طابق الأعمدة، ثم استورد. تُحدَّث جهات الاتصال الموجودة بنفس الرقم بدل تكرارها."
      footer={footer}>
      <ol className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="مراحل الاستيراد">
        <StepPill n={1} label="رفع الملف" active={step === 'upload'} done={step !== 'upload'} />
        <StepPill n={2} label="مطابقة الأعمدة" active={step === 'map'} done={step === 'result'} />
        <StepPill n={3} label="النتيجة" active={step === 'result'} done={false} />
      </ol>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-card bg-danger-bg p-3 text-sm text-danger">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />{error}
        </div>
      )}

      {step === 'upload' && (
        <div>
          <label
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) readFile(f) }}
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-3 rounded-panel border-2 border-dashed px-6 py-12 text-center transition',
              dragging ? 'border-brand-teal bg-chip/60' : 'border-line-strong bg-surface-2 hover:border-brand-teal/60')}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-[#04282C] shadow-glow">
              <ArrowUpTrayIcon className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold text-ink">اسحب ملف CSV هنا أو انقر للاختيار</span>
            <span className="text-sm text-muted">حتى 5 ميغابايت و{formatNumber(MAX_ROWS)} صف. يجب أن يحتوي الصف الأول على أسماء الأعمدة.</span>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f) }} />
          </label>
        </div>
      )}

      {step === 'map' && parsed && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <DocumentTextIcon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
            <span className="font-medium text-ink" dir="auto">{parsed.fileName}</span>
            <Badge tone="neutral">{formatNumber(parsed.rows.length)} صف</Badge>
            <Badge tone="neutral">{formatNumber(parsed.headers.length)} عمود</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TARGETS.map(t => (
              <Field key={t.key} label={t.label} required={t.required} hint={t.hint}>
                <Select value={mapping[t.key]} onChange={e => setMapping(m => ({ ...m, [t.key]: e.target.value }))}
                  options={[{ value: '', label: t.required ? 'اختر عمودًا' : 'تجاهل' }, ...parsed.headers.map(h => ({ value: h, label: h }))]} />
              </Field>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="success" icon={CheckCircleIcon}>{formatNumber(valid.length)} صف جاهز</Badge>
            {skipped > 0 && <Badge tone="warning" icon={ExclamationTriangleIcon}>{formatNumber(skipped)} صف بلا رقم صالح سيُتجاهل</Badge>}
            {overLimit && <Badge tone="danger">يُستورد أول {formatNumber(MAX_ROWS)} صف فقط</Badge>}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">معاينة أول 5 صفوف</p>
            <div className="overflow-hidden rounded-card border border-line">
              <Table minWidth={560} dense caption="معاينة الاستيراد">
                <THead><TR>{TARGETS.map(t => <TH key={t.key}>{t.label}</TH>)}</TR></THead>
                <TBody>
                  {mapped.slice(0, 5).map((r, i) => {
                    const bad = r.phone.replace(/\D/g, '').length < 5
                    return (
                      <TR key={i} className={bad ? 'bg-warning-bg/50' : undefined}>
                        <TD dir="ltr" className={cn('text-start font-mono text-xs', bad && 'text-warning')}>{r.phone || '—'}</TD>
                        <TD className="text-[13px]">{r.name || <span className="text-muted">—</span>}</TD>
                        <TD dir="ltr" className="text-start text-xs">{r.email || <span className="text-muted">—</span>}</TD>
                        <TD>
                          <div className="flex flex-wrap gap-1">
                            {r.tags ? r.tags.split(';').map(s => s.trim()).filter(Boolean).map(tg => <Badge key={tg} tone="brand" size="sm">{tg}</Badge>) : <span className="text-muted">—</span>}
                          </div>
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-[#04282C] shadow-glow">
            <CheckCircleIcon className="h-8 w-8" aria-hidden="true" />
          </span>
          <h3 className="text-xl font-bold text-ink">اكتمل الاستيراد</h3>
          <dl className="grid w-full max-w-md grid-cols-3 gap-3">
            {[
              { label: 'استُورد أو حُدّث', value: result.imported, tone: 'text-success' },
              { label: 'أُرسل للاستيراد', value: result.total, tone: 'text-ink' },
              { label: 'تُجوهل', value: result.skipped, tone: result.skipped ? 'text-warning' : 'text-muted' },
            ].map(s => (
              <div key={s.label} className="rounded-card border border-line bg-surface-2 p-3">
                <dd className={cn('tabular text-2xl font-bold', s.tone)}>{formatNumber(s.value)}</dd>
                <dt className="mt-0.5 text-xs text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Modal>
  )
}

export default ImportWizard
