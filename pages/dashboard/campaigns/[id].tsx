// @ts-nocheck
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import DashboardLayout from '@/components/layout/DashboardLayout'
import axios from 'axios'
import Head from 'next/head'

const STATUS_ICON: Record<string, { icon: string; color: string; label: string }> = {
  sent:      { icon: '✓',  color: '#6b7280', label: 'Sent' },
  delivered: { icon: '✓✓', color: '#6b7280', label: 'Delivered' },
  read:      { icon: '✓✓', color: '#3b82f6', label: 'Read' },
  failed:    { icon: '✕',  color: '#ef4444', label: 'Failed' },
  pending:   { icon: '🕐', color: '#f59e0b', label: 'Pending' },
}

export default function CampaignDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [campaign, setCampaign] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  useEffect(() => {
    if (campaign?.status !== 'running') return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [campaign?.status, id])

  async function load() {
    try {
      const [cRes, mRes] = await Promise.all([
        axios.get(`/api/campaigns?id=${id}`),
        axios.get(`/api/campaigns/${id}/messages`),
      ])
      const camp = (cRes.data.campaigns || []).find((c: any) => c.id === id) || cRes.data.campaign
      setCampaign(camp)
      setMessages(mRes.data.messages || [])
    } catch {}
    setLoading(false)
  }

  const stats = {
    total:     messages.length,
    sent:      messages.filter(m => ['sent','delivered','read'].includes(m.status)).length,
    delivered: messages.filter(m => m.status === 'delivered').length,
    read:      messages.filter(m => m.status === 'read').length,
    failed:    messages.filter(m => m.status === 'failed').length,
    pending:   messages.filter(m => ['pending','waiting'].includes(m.status)).length,
  }

  const filtered = messages.filter(m =>
    filter === 'all' ? true :
    filter === 'read' ? m.status === 'read' :
    filter === 'delivered' ? m.status === 'delivered' :
    filter === 'failed' ? m.status === 'failed' :
    filter === 'sent' ? ['sent','delivered','read'].includes(m.status) :
    true
  )

  if (loading) return <DashboardLayout><div className="skeleton h-64 rounded-xl" /></DashboardLayout>

  return (
    <>
      <Head><title>{campaign?.name || 'Campaign'} — Details</title></Head>
      <DashboardLayout>
        <div className="space-y-5 max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button onClick={() => router.push('/dashboard/campaigns')} className="text-xs text-slate-500 hover:text-slate-900 mb-2 flex items-center gap-1">← Back</button>
              <h1 className="text-xl font-bold text-slate-900">{campaign?.name}</h1>
              <p className="text-sm text-slate-400 mt-1">
                {campaign?.template_name && <span className="mr-3">📋 {campaign.template_name}</span>}
                {campaign?.created_at && <span>{new Date(campaign.created_at).toLocaleDateString()}</span>}
              </p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              campaign?.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
              campaign?.status === 'running' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
              campaign?.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
              'bg-[#F8FAFC]0/10 text-slate-400 border border-gray-500/20'}`}>
              {campaign?.status === 'running' && <span className="mr-1 animate-pulse">●</span>}
              {campaign?.status}
            </span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { key: 'total', label: 'Total', color: '#6b7280' },
              { key: 'sent', label: 'Sent', color: '#25D366' },
              { key: 'delivered', label: 'Delivered', color: '#9ca3af' },
              { key: 'read', label: 'Read', color: '#3b82f6' },
              { key: 'failed', label: 'Failed', color: '#ef4444' },
              { key: 'pending', label: 'Pending', color: '#f59e0b' },
            ].map(s => (
              <button key={s.key} onClick={() => setFilter(s.key)}
                className={`card p-3 text-center transition-all ${filter === s.key ? 'ring-1 ring-brand-500' : ''}`}>
                <p className="text-xl font-bold" style={{ color: s.color }}>{(stats as any)[s.key]}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </button>
            ))}
          </div>

          {stats.total > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{stats.sent} / {stats.total} sent</span>
                <span>{Math.round(stats.sent / stats.total * 100)}%</span>
              </div>
              <div className="h-1.5 bg-[#F8FAFC] rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{ width: `${stats.sent / stats.total * 100}%` }} />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-sm">Recipients ({filtered.length})</h2>
              <div className="flex gap-1 flex-wrap">
                {['all','sent','delivered','read','failed'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-2.5 py-1 rounded-lg capitalize ${filter === f ? 'bg-brand-500 text-slate-900' : 'text-slate-500 hover:text-slate-900 border border-slate-200'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                    <th className="px-4 py-2.5 text-left">Contact</th>
                    <th className="px-4 py-2.5 text-left">Phone</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-left">Message ID</th>
                    <th className="px-4 py-2.5 text-left">Time</th>
                    <th className="px-4 py-2.5 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">No messages yet</td></tr>
                  ) : filtered.map((msg: any) => {
                    const st = STATUS_ICON[msg.status] || STATUS_ICON.pending
                    const errMsg = msg.meta?.error || msg.meta?.error_msg || ''
                    return (
                      <tr key={msg.id} className="border-b border-slate-200/40 hover:bg-white/40">
                        <td className="px-4 py-3 text-slate-900 font-medium">{msg.contacts?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{msg.contacts?.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1">
                            <span style={{ color: st.color, fontWeight: 700, fontSize: 13 }}>{st.icon}</span>
                            <span className="text-xs" style={{ color: st.color }}>{st.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                          {msg.wa_message_id ? '...' + msg.wa_message_id.slice(-10) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                        </td>
                        <td className="px-4 py-3 text-red-400 text-xs max-w-[160px] truncate" title={errMsg}>
                          {errMsg || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  )
}
