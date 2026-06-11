// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, MagnifyingGlassIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, TrashIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'

interface Contact {
  id: string; phone: string; name: string | null; email: string | null; tags: string[]; is_blocked: boolean; opted_out: boolean; created_at: string
}

export default function ContactsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, reset } = useForm<{ phone: string; name: string; email: string; tags: string }>()

  const { data, isLoading } = useQuery(
    ['contacts', search],
    () => axios.get(`/api/contacts?search=${encodeURIComponent(search)}&limit=100`).then(r => r.data),
    { keepPreviousData: true }
  )
  const contacts: Contact[] = data?.contacts || []

  const createMut = useMutation(
    (body: object) => axios.post('/api/contacts', body),
    { onSuccess: () => { qc.invalidateQueries('contacts'); reset(); setShowAdd(false); toast.success('Contact added') }, onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
  )

  const deleteMut = useMutation(
    (id: string) => axios.delete(`/api/contacts/${id}`),
    { onSuccess: () => { qc.invalidateQueries('contacts'); toast.success('Deleted') } }
  )

  const importMut = useMutation(
    (csv: string) => axios.put('/api/contacts', { csv_data: csv }),
    { onSuccess: (res) => { qc.invalidateQueries('contacts'); toast.success(`Imported ${res.data.imported} contacts`) } }
  )

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => importMut.mutate(ev.target?.result as string)
    reader.readAsText(file)
  }

  const exportCSV = () => {
    const rows = [['phone', 'name', 'email', 'tags'], ...contacts.map(c => [c.phone, c.name || '', c.email || '', c.tags.join(';')])]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'wabek-contacts.csv'; a.click()
  }

  const toggleSelect = (id: string) => {
    const s = new Set(selectedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelectedIds(s)
  }

  const onSubmit = (data: { phone: string; name: string; email: string; tags: string }) => {
    createMut.mutate({ phone: data.phone, name: data.name || undefined, email: data.email || undefined, tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [] })
  }

  return (
    <DashboardLayout title="Contacts">
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…" className="input pl-9" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">
            <ArrowUpTrayIcon className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={exportCSV} className="btn-secondary text-sm">
            <ArrowDownTrayIcon className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            <PlusIcon className="w-4 h-4" /> Add Contact
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileImport} />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-blue-50/30 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-600 font-medium">{selectedIds.size} selected</span>
          <button className="btn-danger text-xs py-1.5" onClick={() => { /* bulk delete */ }}>Delete Selected</button>
          <button className="text-xs text-slate-400 hover:text-slate-900" onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-[#F8FAFC]/50">
              <tr>
                <th className="table-head w-10"><input type="checkbox" className="rounded border-slate-200 bg-[#F8FAFC]" onChange={e => setSelectedIds(e.target.checked ? new Set(contacts.map(c => c.id)) : new Set())} /></th>
                <th className="table-head">Contact</th>
                <th className="table-head">Phone</th>
                <th className="table-head">Tags</th>
                <th className="table-head">Status</th>
                <th className="table-head">Added</th>
                <th className="table-head w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-200">
                  {Array.from({ length: 7 }).map((_, j) => <td key={j} className="table-cell"><div className="h-4 skeleton rounded w-24" /></td>)}
                </tr>
              )) : contacts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-slate-500">No contacts found</td></tr>
              ) : contacts.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="table-cell"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-slate-200 bg-[#F8FAFC]" /></td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#F8FAFC] flex items-center justify-center text-xs font-bold text-slate-300">
                        {(c.name || c.phone)[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{c.name || <span className="text-slate-500 italic">No name</span>}</span>
                    </div>
                  </td>
                  <td className="table-cell font-mono text-sm">{c.phone}</td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map(t => <span key={t} className="badge-gray">{t}</span>)}
                    </div>
                  </td>
                  <td className="table-cell">
                    {c.is_blocked ? <span className="badge-red">Blocked</span> : c.opted_out ? <span className="badge-yellow">Opted out</span> : <span className="badge-green">Active</span>}
                  </td>
                  <td className="table-cell text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="table-cell">
                    <button onClick={() => deleteMut.mutate(c.id)} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.total > 100 && (
          <div className="px-4 py-3 border-t border-slate-200 text-sm text-slate-400">
            Showing 100 of {data.total} contacts
          </div>
        )}
      </div>

      {/* Add contact modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-display font-semibold text-slate-900">Add Contact</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div><label className="label">Phone number *</label><input {...register('phone', { required: true })} placeholder="+1234567890" className="input" /></div>
              <div><label className="label">Name</label><input {...register('name')} placeholder="John Smith" className="input" /></div>
              <div><label className="label">Email</label><input {...register('email')} type="email" placeholder="john@example.com" className="input" /></div>
              <div><label className="label">Tags <span className="text-slate-500">(comma-separated)</span></label><input {...register('tags')} placeholder="vip, customer, lead" className="input" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createMut.isLoading} className="btn-primary">{createMut.isLoading ? 'Adding…' : 'Add Contact'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
