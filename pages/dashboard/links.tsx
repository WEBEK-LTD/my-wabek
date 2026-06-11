// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, ClipboardIcon, LinkIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'

export default function LinksPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ original_url: '', title: '' })

  const { data } = useQuery('tracked-links', () => axios.get('/api/links').then(r => r.data))
  const links = data?.links || []
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://waabek.com'

  const createMut = useMutation(
    (body) => axios.post('/api/links', body),
    {
      onSuccess: (r) => {
        qc.invalidateQueries('tracked-links')
        setShowForm(false)
        setForm({ original_url: '', title: '' })
        navigator.clipboard.writeText(r.data.short_url)
        toast.success(`Link created! Short URL copied: ${r.data.short_url}`)
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied!') }

  return (
    <DashboardLayout title="Link Tracker">
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-400 text-sm">{links.length} tracked links</p>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary">
          <PlusIcon className="w-4 h-4" /> Create Short Link
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 space-y-3">
          <h3 className="font-display font-semibold text-slate-900">Create Tracked Link</h3>
          <div>
            <label className="label">Original URL</label>
            <input value={form.original_url} onChange={e => setForm(f => ({...f, original_url: e.target.value}))}
              placeholder="https://example.com/your-page" className="input" type="url" />
          </div>
          <div>
            <label className="label">Title (optional)</label>
            <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
              placeholder="Summer Sale Landing Page" className="input" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMut.mutate(form)} disabled={createMut.isLoading || !form.original_url} className="btn-primary">
              {createMut.isLoading ? 'Creating...' : '🔗 Create & Copy Link'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {links.length === 0 && !showForm ? (
        <div className="card text-center py-16">
          <LinkIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-display font-semibold text-slate-900 mb-2">No tracked links yet</h3>
          <p className="text-slate-400 text-sm mb-4">Create short links and track who clicks them from your WhatsApp campaigns</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mx-auto"><PlusIcon className="w-4 h-4" /> Create First Link</button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const shortUrl = `${appUrl}/l/${link.short_code}`
            return (
              <div key={link.id} className="card hover:border-wabek-muted transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50/30 border border-blue-200/50 flex items-center justify-center flex-shrink-0">
                    <LinkIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-slate-900">{link.title || 'Untitled Link'}</p>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs text-blue-600 bg-blue-50/20 px-2 py-0.5 rounded truncate">{shortUrl}</code>
                      <button onClick={() => copy(shortUrl)} className="p-1 text-slate-400 hover:text-slate-900 flex-shrink-0">
                        <ClipboardIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{link.original_url}</p>
                    <p className="text-xs text-slate-600 mt-1">{format(new Date(link.created_at), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-display font-bold text-slate-900">{link.click_count || 0}</div>
                    <div className="text-xs text-slate-500">clicks</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )
}
