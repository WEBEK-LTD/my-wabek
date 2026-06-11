// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, UserGroupIcon, ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline'

const CONDITION_FIELDS = [
  { value: 'tags', label: 'Has Tag' },
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'opted_out', label: 'Opted Out' },
  { value: 'is_blocked', label: 'Is Blocked' },
]

const OPERATORS = {
  tags: [{ value: 'contains', label: 'contains' }],
  name: [{ value: 'contains', label: 'contains' }],
  phone: [{ value: 'starts_with', label: 'starts with' }],
  opted_out: [{ value: 'equals', label: 'is' }],
  is_blocked: [{ value: 'equals', label: 'is' }],
}

const VALUE_OPTIONS = {
  opted_out: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
  is_blocked: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }],
}

export default function SegmentsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', operator: 'AND', conditions: [{ field: 'tags', operator: 'contains', value: '' }] })
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  const { data } = useQuery('segments', () => axios.get('/api/segments').then(r => r.data))
  const segments = data?.segments || []

  const createMut = useMutation(
    (body) => axios.post('/api/segments', body),
    {
      onSuccess: () => { qc.invalidateQueries('segments'); setShowForm(false); setForm({ name: '', description: '', operator: 'AND', conditions: [{ field: 'tags', operator: 'contains', value: '' }] }); toast.success('Segment created!') },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/segments/${id}`),
    { onSuccess: () => { qc.invalidateQueries('segments'); toast.success('Deleted') } }
  )

  const addCondition = () => setForm(f => ({ ...f, conditions: [...f.conditions, { field: 'tags', operator: 'contains', value: '' }] }))
  const updateCondition = (idx, key, val) => setForm(f => ({ ...f, conditions: f.conditions.map((c, i) => i === idx ? { ...c, [key]: val } : c) }))
  const removeCondition = (idx) => setForm(f => ({ ...f, conditions: f.conditions.filter((_, i) => i !== idx) }))

  const previewSegment = async () => {
    setPreviewing(true)
    try {
      const { data } = await axios.post('/api/segments/preview', { conditions: form.conditions, operator: form.operator })
      setPreview(data)
    } catch { toast.error('Preview failed') }
    finally { setPreviewing(false) }
  }

  return (
    <DashboardLayout title="Contact Segments">
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-400 text-sm">{segments.length} segments</p>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> New Segment
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-display font-semibold text-slate-900">Create Segment</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Segment Name</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="VIP Customers" className="input" />
            </div>
            <div>
              <label className="label">Match</label>
              <select value={form.operator} onChange={e => setForm(f => ({...f, operator: e.target.value}))} className="input">
                <option value="AND">ALL conditions (AND)</option>
                <option value="OR">ANY condition (OR)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="label">Conditions</label>
            {form.conditions.map((cond, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select value={cond.field} onChange={e => updateCondition(idx, 'field', e.target.value)} className="input text-sm py-2 flex-1">
                  {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select value={cond.operator} onChange={e => updateCondition(idx, 'operator', e.target.value)} className="input text-sm py-2 w-28">
                  {(OPERATORS[cond.field] || [{ value: 'equals', label: 'equals' }]).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {VALUE_OPTIONS[cond.field] ? (
                  <select value={cond.value} onChange={e => updateCondition(idx, 'value', e.target.value)} className="input text-sm py-2 w-24">
                    {VALUE_OPTIONS[cond.field].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input value={cond.value} onChange={e => updateCondition(idx, 'value', e.target.value)} placeholder="value" className="input text-sm py-2 flex-1" />
                )}
                <button onClick={() => removeCondition(idx)} className="p-2 text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={addCondition} className="btn-secondary text-sm"><PlusIcon className="w-4 h-4" /> Add Condition</button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200">
              <p className="text-sm font-medium text-slate-900 mb-2">Preview: {preview.count} contacts match</p>
              <div className="space-y-1">
                {preview.contacts.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-brand-500" />
                    <span>{c.name || 'Unknown'}</span>
                    <span className="text-slate-600">{c.phone}</span>
                    {c.tags?.map(t => <span key={t} className="px-1.5 py-0.5 bg-[#F8FAFC] rounded text-[10px]">{t}</span>)}
                  </div>
                ))}
                {preview.count > 5 && <p className="text-xs text-slate-500">+ {preview.count - 5} more contacts</p>}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={previewSegment} disabled={previewing} className="btn-secondary">
              {previewing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <EyeIcon className="w-4 h-4" />}
              Preview
            </button>
            <button onClick={() => createMut.mutate(form)} disabled={createMut.isLoading || !form.name} className="btn-primary">
              {createMut.isLoading ? 'Creating...' : 'Create Segment'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {segments.length === 0 && !showForm ? (
        <div className="card text-center py-16">
          <UserGroupIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-slate-900 mb-2">No segments yet</h3>
          <p className="text-slate-400 text-sm mb-4">Group your contacts by behavior, tags, or properties</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto"><PlusIcon className="w-4 h-4" /> Create Segment</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map(seg => (
            <div key={seg.id} className="card hover:border-wabek-muted transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-900">{seg.name}</h3>
                <button onClick={() => { if(confirm('Delete?')) deleteMut.mutate(seg.id) }} className="p-1 text-slate-500 hover:text-red-400">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="text-2xl font-display font-bold text-blue-600 mb-1">{seg.contact_count.toLocaleString()}</div>
              <p className="text-xs text-slate-500 mb-2">contacts</p>
              <div className="space-y-1">
                {(seg.conditions || []).map((c, i) => (
                  <div key={i} className="text-xs text-slate-400 bg-[#F8FAFC] px-2 py-1 rounded">
                    {c.field} {c.operator} <span className="text-slate-900">"{c.value}"</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
