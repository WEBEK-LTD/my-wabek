// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, BoltIcon, XMarkIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'

interface Flow {
  id: string; name: string; trigger_type: string; trigger_value: string | null; is_active: boolean; trigger_count: number; nodes: unknown[]; created_at: string
}

const triggerLabels: Record<string, string> = {
  keyword: 'Keyword Match', message_received: 'Any Message', opt_in: 'Opt-in', scheduled: 'Scheduled',
}

export default function AutomationPage() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editFlow, setEditFlow] = useState<Flow | null>(null)
  const { register, handleSubmit, reset, watch } = useForm<{ name: string; instance_id: string; trigger_type: string; trigger_value: string; reply_message: string }>()
  const triggerType = watch('trigger_type')

  const { data: fData } = useQuery('flows', () => axios.get('/api/automation').then(r => r.data))
  const { data: iData } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const flows: Flow[] = fData?.flows || []
  const instances = iData?.instances || []

  const createMut = useMutation(
    (body: object) => axios.post('/api/automation', body),
    { onSuccess: () => { qc.invalidateQueries('flows'); reset(); setShowNew(false); toast.success('Flow created') }, onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
  )

  const toggleMut = useMutation(
    ({ id, is_active }: { id: string; is_active: boolean }) => axios.put(`/api/automation/${id}`, { is_active }),
    { onSuccess: () => qc.invalidateQueries('flows') }
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/automation/${id}`),
    { onSuccess: () => { qc.invalidateQueries('flows'); toast.success('Flow deleted') } }
  )

  const onSubmit = (data: { name: string; instance_id: string; trigger_type: string; trigger_value: string; reply_message: string }) => {
    const nodes = data.reply_message ? [{ id: 'node1', type: 'send_message', data: { text: data.reply_message } }] : []
    createMut.mutate({ name: data.name, instance_id: data.instance_id, trigger_type: data.trigger_type, trigger_value: data.trigger_value || null, nodes, is_active: true })
  }

  return (
    <DashboardLayout title="Automation">
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-400 text-sm">{flows.filter(f => f.is_active).length} active flows</p>
        <button onClick={() => setShowNew(true)} className="btn-primary"><PlusIcon className="w-4 h-4" /> New Flow</button>
      </div>

      {flows.length === 0 ? (
        <div className="card text-center py-20">
          <div className="w-16 h-16 bg-[#F8FAFC] rounded-full flex items-center justify-center mx-auto mb-4">
            <BoltIcon className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="font-display font-semibold text-slate-900 mb-2">No automation flows yet</h3>
          <p className="text-slate-400 text-sm mb-6">Set up auto-replies, keyword triggers, and chatbot flows</p>
          <button onClick={() => setShowNew(true)} className="btn-primary mx-auto"><PlusIcon className="w-4 h-4" /> Create Flow</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {flows.map((f) => (
            <div key={f.id} className="card hover:border-wabek-muted transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-slate-900 truncate">{f.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{triggerLabels[f.trigger_type] || f.trigger_type}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => deleteMut.mutate(f.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>

              {f.trigger_value && (
                <div className="bg-[#F8FAFC] rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-500">Trigger: </span>
                  <span className="text-slate-700 font-mono">{f.trigger_value}</span>
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{f.nodes?.length || 0} actions</span>
                <span>•</span>
                <span>{f.trigger_count} triggered</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className={f.is_active ? 'badge-green' : 'badge-gray'}>{f.is_active ? 'Active' : 'Inactive'}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={f.is_active} onChange={() => toggleMut.mutate({ id: f.id, is_active: !f.is_active })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-[#F8FAFC] peer-focus:ring-2 peer-focus:ring-brand-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500" />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New flow modal */}
      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-display font-semibold text-slate-900">New Automation Flow</h3>
              <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="label">Flow name *</label>
                <input {...register('name', { required: true })} placeholder="Welcome Message" className="input" />
              </div>
              <div>
                <label className="label">WhatsApp Instance *</label>
                <select {...register('instance_id', { required: true })} className="input">
                  <option value="">Select…</option>
                  {instances.filter((i: { status: string }) => i.status === 'connected').map((i: { id: string; display_name?: string; phone_number: string }) => (
                    <option key={i.id} value={i.id}>{i.display_name || i.phone_number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Trigger</label>
                <select {...register('trigger_type')} className="input">
                  <option value="keyword">Keyword Match</option>
                  <option value="message_received">Any Message Received</option>
                  <option value="opt_in">Opt-in</option>
                </select>
              </div>
              {triggerType === 'keyword' && (
                <div>
                  <label className="label">Keywords <span className="text-slate-500">(comma-separated)</span></label>
                  <input {...register('trigger_value')} placeholder="hello, hi, start, help" className="input" />
                </div>
              )}
              <div>
                <label className="label">Auto-reply message</label>
                <textarea {...register('reply_message')} rows={4} placeholder={`Hi {{name}}! Thanks for reaching out.\n\nHow can I help you today?`} className="input resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createMut.isLoading} className="btn-primary">{createMut.isLoading ? 'Creating…' : 'Create Flow'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
