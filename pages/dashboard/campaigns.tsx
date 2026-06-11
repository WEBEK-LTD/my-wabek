// @ts-nocheck
import { useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  PlusIcon, PlayIcon, PauseIcon, TrashIcon, XMarkIcon,
  ChartBarIcon, SparklesIcon, EyeIcon, ChevronDownIcon,
  DocumentDuplicateIcon, FaceSmileIcon, ArrowPathIcon,
  CheckCircleIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import clsx from 'clsx'

const EMOJIS = ['😀','😊','👋','💪','🎯','⭐','💡','📢','🛒','📦','✨','🤝','💼','🔥','❤️','✅','⚡','💬','📱','🚀','💰','🙏','🎉','👍','💎','🌟','🎁','🛍️','📝','📊','⚠️','🔔','💯','🏆','🎊']

const BLOCK_TYPES = [
  { type: 'header', icon: '📌', label: 'Header' },
  { type: 'text', icon: '📝', label: 'Text' },
  { type: 'image', icon: '🖼️', label: 'Image URL' },
  { type: 'button', icon: '🔘', label: 'CTA Button' },
  { type: 'divider', icon: '➖', label: 'Divider' },
]

const VARIABLES = ['{{name}}', '{{phone}}', '{{email}}', '{{company}}', '{{amount}}', '{{date}}', '{{link}}']

const TEMPLATES = [
  {
    id: 'promo', name: '🎯 Promotional Offer', category: 'Marketing',
    blocks: [
      { id: '1', type: 'header', content: '🔥 Special Offer for {{name}}!' },
      { id: '2', type: 'text', content: 'Hi {{name}}, we have an exclusive deal just for you.' },
      { id: '3', type: 'text', content: '✅ Get *{{amount}}% OFF* on your next purchase\n✅ Valid until {{date}}\n✅ Limited time only!' },
      { id: '4', type: 'button', content: '🛒 Shop Now → {{link}}' },
      { id: '5', type: 'text', content: '_Reply STOP to unsubscribe_' },
    ]
  },
  {
    id: 'reminder', name: '🔔 Payment Reminder', category: 'Finance',
    blocks: [
      { id: '1', type: 'header', content: '⚠️ Payment Reminder' },
      { id: '2', type: 'text', content: 'Dear {{name}},' },
      { id: '3', type: 'text', content: 'Your payment of *{{amount}}* is due on *{{date}}*.' },
      { id: '4', type: 'button', content: '💳 Pay Now → {{link}}' },
      { id: '5', type: 'text', content: 'Need help? Reply to this message.' },
    ]
  },
  {
    id: 'welcome', name: '👋 Welcome Message', category: 'Onboarding',
    blocks: [
      { id: '1', type: 'header', content: '🎉 Welcome to {{company}}!' },
      { id: '2', type: 'text', content: 'Hi {{name}}, we\'re excited to have you on board! 🚀' },
      { id: '3', type: 'text', content: 'Here\'s what you can do:\n✅ Browse our products\n✅ Get exclusive deals\n✅ 24/7 support' },
      { id: '4', type: 'button', content: '🌟 Get Started → {{link}}' },
    ]
  },
  {
    id: 'feedback', name: '⭐ Feedback Request', category: 'Engagement',
    blocks: [
      { id: '1', type: 'header', content: '⭐ How was your experience?' },
      { id: '2', type: 'text', content: 'Hi {{name}}, thank you for choosing {{company}}!' },
      { id: '3', type: 'text', content: 'We\'d love to hear your feedback. It only takes 30 seconds!' },
      { id: '4', type: 'button', content: '📝 Leave Review → {{link}}' },
    ]
  },
  {
    id: 'restock', name: '📦 Back in Stock', category: 'E-commerce',
    blocks: [
      { id: '1', type: 'header', content: '📦 Good News, {{name}}!' },
      { id: '2', type: 'text', content: 'The item you wanted is *back in stock*! 🎉' },
      { id: '3', type: 'text', content: 'Hurry up — limited quantity available!' },
      { id: '4', type: 'button', content: '🛒 Buy Now → {{link}}' },
    ]
  },
  {
    id: 'appointment', name: '📅 Appointment Reminder', category: 'Services',
    blocks: [
      { id: '1', type: 'header', content: '📅 Appointment Reminder' },
      { id: '2', type: 'text', content: 'Hi {{name}}! Reminder for your appointment.' },
      { id: '3', type: 'text', content: '📍 *Date:* {{date}}\n📍 *Time:* {{time}}\n📍 *Location:* {{location}}' },
      { id: '4', type: 'text', content: 'Reply *CONFIRM* to confirm or *CANCEL* to cancel.' },
    ]
  },
]

function buildMessage(blocks) {
  return blocks.map(b => {
    if (b.type === 'header') return `*${b.content}*`
    if (b.type === 'divider') return '─────────────'
    return b.content
  }).filter(Boolean).join('\n\n')
}

function WhatsAppPreview({ message, contactName = 'John' }) {
  const preview = message
    .replace(/\{\{name\}\}/g, contactName)
    .replace(/\{\{phone\}\}/g, '+1234567890')
    .replace(/\{\{company\}\}/g, 'My Company')
    .replace(/\{\{amount\}\}/g, '99.00')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{link\}\}/g, 'https://example.com')
    .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em style="color:rgba(255,255,255,0.7)">$1</em>')

  return (
    <div className="bg-[#0B141A] rounded-2xl overflow-hidden w-full">
      <div className="bg-[#202C33] px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#6B7280] flex items-center justify-center text-slate-900 text-sm font-bold">{contactName[0]}</div>
        <div><p className="text-slate-900 text-sm font-medium">{contactName}</p><p className="text-[#8696A0] text-xs">online</p></div>
      </div>
      <div className="p-4 min-h-24" style={{ backgroundColor: '#0B141A' }}>
        <div className="flex justify-end">
          <div className="bg-[#005C4B] rounded-lg rounded-br-none px-3 py-2 max-w-xs">
            <p className="text-slate-900 text-xs leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: preview.replace(/\n/g, '<br/>') || '<span style="opacity:0.4">Your message will appear here...</span>' }} />
            <p className="text-slate-900/50 text-[10px] text-right mt-1">{format(new Date(), 'HH:mm')} ✓✓</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function BlockEditor({ blocks, setBlocks }) {
  const [showEmoji, setShowEmoji] = useState(null)

  const addBlock = (type) => {
    const defaults = { header: 'Your Header Here', text: 'Write your message here...', image: 'https://example.com/image.jpg', button: '👉 Click Here → https://example.com', divider: '' }
    setBlocks(prev => [...prev, { id: Date.now().toString(), type, content: defaults[type] || '' }])
  }
  const updateBlock = (id, content) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, content } : b))
  const removeBlock = (id) => setBlocks(prev => prev.filter(b => b.id !== id))
  const moveBlock = (id, dir) => setBlocks(prev => {
    const idx = prev.findIndex(b => b.id === id)
    const arr = [...prev]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    if (swap < 0 || swap >= arr.length) return prev
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    return arr
  })
  const duplicateBlock = (id) => setBlocks(prev => {
    const idx = prev.findIndex(b => b.id === id)
    const block = prev[idx]
    const arr = [...prev]
    arr.splice(idx + 1, 0, { ...block, id: Date.now().toString() })
    return arr
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map(bt => (
          <button key={bt.type} onClick={() => addBlock(bt.type)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F8FAFC] hover:bg-blue-50 text-slate-700 hover:text-white text-xs rounded-lg border border-slate-200 hover:border-brand-700 transition-all">
            <span>{bt.icon}</span>{bt.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 p-2 bg-[#F8FAFC] rounded-lg border border-slate-200">
        <span className="text-xs text-slate-500 self-center mr-1">+ Variable:</span>
        {VARIABLES.map(v => (
          <button key={v} onClick={() => { if (blocks.length > 0) { const last = blocks[blocks.length-1]; updateBlock(last.id, last.content + ' ' + v) } }}
            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-200 hover:bg-blue-50 font-mono transition-colors">
            {v}
          </button>
        ))}
      </div>
      {blocks.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-500 text-sm">Add blocks above to build your message</p>
        </div>
      ) : blocks.map((block, idx) => (
        <div key={block.id} className={clsx('border rounded-xl overflow-hidden',
          block.type === 'header' ? 'border-yellow-800/50' :
          block.type === 'button' ? 'border-blue-200/50' :
          block.type === 'image' ? 'border-blue-800/50' : 'border-slate-200'
        )}>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-200/50 bg-[#F8FAFC]/50">
            <span className="text-xs">{BLOCK_TYPES.find(b => b.type === block.type)?.icon}</span>
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider flex-1">{BLOCK_TYPES.find(b => b.type === block.type)?.label}</span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => moveBlock(block.id, 'up')} disabled={idx === 0} className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"><ChevronUpIcon className="w-3 h-3" /></button>
              <button onClick={() => moveBlock(block.id, 'down')} disabled={idx === blocks.length-1} className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"><ChevronDownIcon className="w-3 h-3" /></button>
              <button onClick={() => duplicateBlock(block.id)} className="p-1 text-slate-500 hover:text-slate-900"><DocumentDuplicateIcon className="w-3 h-3" /></button>
              <button onClick={() => setShowEmoji(showEmoji === block.id ? null : block.id)} className="p-1 text-slate-500 hover:text-yellow-400"><FaceSmileIcon className="w-3 h-3" /></button>
              <button onClick={() => removeBlock(block.id)} className="p-1 text-slate-500 hover:text-red-400"><XMarkIcon className="w-3 h-3" /></button>
            </div>
          </div>
          {showEmoji === block.id && (
            <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-slate-200/50 bg-[#F8FAFC]/80">
              {EMOJIS.map(e => (
                <button key={e} onClick={() => { updateBlock(block.id, block.content + e); setShowEmoji(null) }} className="text-lg hover:scale-125 transition-transform">{e}</button>
              ))}
            </div>
          )}
          {block.type === 'divider' ? (
            <div className="px-3 py-2 text-center text-slate-500 text-sm">──────────────────</div>
          ) : (
            <textarea value={block.content} onChange={e => updateBlock(block.id, e.target.value)}
              rows={block.type === 'header' ? 1 : 3}
              className="w-full bg-transparent text-slate-900 text-sm px-3 py-2 outline-none resize-none"
              placeholder={block.type === 'image' ? 'https://example.com/image.jpg' : 'Write content...'}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function AIGenerator({ onGenerate }) {
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('friendly')
  const [type, setType] = useState('promotional')
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    if (!prompt) { toast.error('Describe your campaign first'); return }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/campaigns/ai-generate', { prompt, tone, type })
      onGenerate(data.blocks)
      toast.success('AI message generated! ✨')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'AI generation failed — check ANTHROPIC_API_KEY')
    } finally { setLoading(false) }
  }

  return (
    <div className="card border-blue-200/50 bg-gradient-to-br from-brand-900/20 to-transparent space-y-3">
      <div className="flex items-center gap-2">
        <SparklesIcon className="w-5 h-5 text-blue-600" />
        <h3 className="font-display font-semibold text-slate-900">AI Message Generator</h3>
        <span className="badge-green text-xs">Claude AI</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="input text-sm py-2">
            <option value="promotional">🎯 Promotional</option>
            <option value="reminder">🔔 Reminder</option>
            <option value="announcement">📢 Announcement</option>
            <option value="welcome">👋 Welcome</option>
            <option value="reengagement">🔄 Re-engagement</option>
            <option value="feedback">⭐ Feedback</option>
          </select>
        </div>
        <div>
          <label className="label text-xs">Tone</label>
          <select value={tone} onChange={e => setTone(e.target.value)} className="input text-sm py-2">
            <option value="friendly">😊 Friendly</option>
            <option value="professional">💼 Professional</option>
            <option value="urgent">⚡ Urgent</option>
            <option value="casual">😎 Casual</option>
            <option value="formal">🎩 Formal</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label text-xs">Describe your campaign</label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder="e.g. 50% discount on all products this weekend, targeting existing customers, create urgency"
          className="input text-sm resize-none" />
      </div>
      <button onClick={generate} disabled={loading || !prompt} className="btn-primary w-full justify-center">
        {loading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Generating...</> : <><SparklesIcon className="w-4 h-4" /> Generate with AI</>}
      </button>
    </div>
  )
}

export default function CampaignsPage() {
  const qc = useQueryClient()
  const [view, setView] = useState('list')
  const [step, setStep] = useState(1)
  const [blocks, setBlocks] = useState([
    { id: '1', type: 'header', content: '👋 Hello {{name}}!' },
    { id: '2', type: 'text', content: 'We have something special for you today.' },
    { id: '3', type: 'button', content: '🔗 Check it out → https://example.com' },
  ])
  const [showTemplates, setShowTemplates] = useState(false)
  const [previewContact, setPreviewContact] = useState('John')
  const [form, setForm] = useState({ name: '', instance_id: '', tags: '', delay_seconds: '3', scheduled_at: '', template_name: '' })

  const { data: cData } = useQuery('campaigns', () => axios.get('/api/campaigns').then(r => r.data), {
    refetchInterval: (data: any) => {
      // Poll every 3s while any campaign is running
      const hasRunning = data?.campaigns?.some((c: any) => c.status === 'running')
      return hasRunning ? 3000 : false
    },
  })
  const { data: segData } = useQuery('segments', () => axios.get('/api/segments').then(r => r.data))
  const segments = segData?.segments || []
  const { data: iData } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const campaigns = cData?.campaigns || []
  const instances = (iData?.instances || []).filter(i => i.status === 'connected')
  const message = buildMessage(blocks)

  const createMut = useMutation(
    (body) => axios.post('/api/campaigns', body),
    {
      onSuccess: () => {
        qc.invalidateQueries('campaigns')
        setView('list'); setStep(1)
        setBlocks([{ id: '1', type: 'header', content: '👋 Hello {{name}}!' }, { id: '2', type: 'text', content: 'Write your message...' }])
        toast.success('Campaign created! 🎉')
      },
      onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
    }
  )

  const actionMut = useMutation(
    ({ id, action }) => axios.post(`/api/campaigns/${id}`, { action }),
    { onSuccess: (_, { action }) => { qc.invalidateQueries('campaigns'); toast.success(`Campaign ${action}ed`) } }
  )

  const deleteMut = useMutation(
    (id) => axios.delete(`/api/campaigns/${id}`),
    { onSuccess: () => { qc.invalidateQueries('campaigns'); toast.success('Deleted') } }
  )

  const handleCreate = () => {
    if (!form.name) { toast.error('Campaign name required'); return }
    if (!form.instance_id) { toast.error('Select WhatsApp instance'); return }
    if (!message.trim()) { toast.error('Message cannot be empty'); return }
    createMut.mutate({
      name: form.name,
      instance_id: form.instance_id,
      message,
      template_name: form.template_name || undefined,
      template_language: 'en',
      contact_filter: form.tags ? { tags: form.tags.split(',').map(t => t.trim()) } : { all: true },
      delay_seconds: parseInt(form.delay_seconds) || 3,
      scheduled_at: form.scheduled_at || undefined,
    })
  }

  if (view === 'list') return (
    <DashboardLayout title="Campaigns">
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-400 text-sm">{campaigns.length} campaigns</p>
        <button onClick={() => { setView('builder'); setStep(1) }} className="btn-primary">
          <SparklesIcon className="w-4 h-4" /> New Campaign
        </button>
      </div>
      {campaigns.length === 0 ? (
        <div className="card text-center py-20">
          <ChartBarIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="font-display font-semibold text-slate-900 mb-2">No campaigns yet</h3>
          <p className="text-slate-400 text-sm mb-6">Create your first WhatsApp campaign with AI</p>
          <button onClick={() => { setView('builder'); setStep(1) }} className="btn-primary mx-auto">
            <SparklesIcon className="w-4 h-4" /> Create with AI
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const rate = c.sent_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0
            const progress = c.total_contacts > 0 ? Math.round((c.sent_count / c.total_contacts) * 100) : 0
            const sc = { draft: 'badge-gray', scheduled: 'badge-yellow', running: 'badge-yellow', completed: 'badge-green', failed: 'badge-red', paused: 'badge-yellow' }
            return (
              <div key={c.id} className="card hover:border-wabek-muted transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display font-semibold text-slate-900 truncate">{c.name}</h3>
                      <span className={sc[c.status] || 'badge-gray'}>{c.status}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                      <span>{c.total_contacts.toLocaleString()} contacts</span>
                      <span>{c.sent_count.toLocaleString()} sent</span>
                      <span className="text-blue-600">{rate}% delivery</span>
                      {c.scheduled_at && <span>📅 {format(new Date(c.scheduled_at), 'MMM d, HH:mm')}</span>}
                    </div>
                    {c.status === 'running' && (
                      <div className="mt-2 h-1.5 bg-[#F8FAFC] rounded-full w-48">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {['draft','scheduled','paused'].includes(c.status) && (
                      <>
                        <a href={`/dashboard/campaigns/${c.id}`} className="btn-secondary text-xs py-1.5 px-3">Details</a>
                        <button onClick={() => actionMut.mutate({ id: c.id, action: 'start' })} className="btn-primary text-xs py-1.5 px-3">
                          <PlayIcon className="w-3.5 h-3.5" /> Start
                        </button>
                      </>
                    )}
                    {c.status === 'running' && (
                      <>
                        <a href={`/dashboard/campaigns/${c.id}`} className="btn-secondary text-xs py-1.5 px-3">Details</a>
                        <button onClick={() => actionMut.mutate({ id: c.id, action: 'pause' })} className="btn-secondary text-xs py-1.5 px-3">
                          <PauseIcon className="w-3.5 h-3.5" /> Pause
                        </button>
                      </>
                    )}
                    {['completed','failed'].includes(c.status) && (
                      <a href={`/dashboard/campaigns/${c.id}`} className="btn-secondary text-xs py-1.5 px-3">Details</a>
                    )}
                    {c.status !== 'running' && (
                      <button onClick={() => { if(confirm('Delete?')) deleteMut.mutate(c.id) }} className="p-2 text-slate-500 hover:text-red-400">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </DashboardLayout>
  )

  return (
    <DashboardLayout title="Campaign Builder">
      {/* Steps */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[{ n: 1, label: '✏️ Design' }, { n: 2, label: '⚙️ Settings' }, { n: 3, label: '🚀 Launch' }].map((s, idx) => (
          <div key={s.n} className="flex items-center gap-2">
            <button onClick={() => setStep(s.n)} className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              step === s.n ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' :
              step > s.n ? 'bg-blue-50 text-blue-600' : 'bg-[#F8FAFC] text-slate-400'
            )}>
              {step > s.n ? <CheckCircleIcon className="w-4 h-4" /> : null}
              {s.label}
            </button>
            {idx < 2 && <div className="w-8 h-px bg-wabek-border hidden sm:block" />}
          </div>
        ))}
        <button onClick={() => setView('list')} className="btn-secondary text-sm ml-auto">
          <XMarkIcon className="w-4 h-4" /> Cancel
        </button>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <AIGenerator onGenerate={setBlocks} />
            <div className="card">
              <button onClick={() => setShowTemplates(!showTemplates)} className="flex items-center justify-between w-full">
                <span className="font-display font-semibold text-slate-900">📋 Templates Library</span>
                <ChevronDownIcon className={clsx('w-4 h-4 text-slate-400 transition-transform', showTemplates && 'rotate-180')} />
              </button>
              {showTemplates && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {TEMPLATES.map(tpl => (
                    <button key={tpl.id} onClick={() => { setBlocks(tpl.blocks.map(b => ({...b, id: Date.now() + Math.random() + ''}))); setShowTemplates(false); toast.success(`Loaded: ${tpl.name}`) }}
                      className="text-left p-3 bg-[#F8FAFC] rounded-lg border border-slate-200 hover:border-brand-700 transition-colors">
                      <p className="text-sm font-medium text-slate-900">{tpl.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{tpl.category}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-3">✏️ Message Editor</h3>
              <BlockEditor blocks={blocks} setBlocks={setBlocks} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="card sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-slate-900 flex items-center gap-2">
                  <EyeIcon className="w-4 h-4 text-blue-600" /> Live Preview
                </h3>
                <input value={previewContact} onChange={e => setPreviewContact(e.target.value)}
                  placeholder="Contact name" className="input py-1 text-xs w-28" />
              </div>
              <WhatsAppPreview message={message} contactName={previewContact} />
              <div className="mt-3 p-2 bg-[#F8FAFC] rounded-lg">
                <p className="text-xs text-slate-500 mb-1">{message.length} characters</p>
                <pre className="text-xs text-slate-400 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">{message || 'Add blocks to see preview...'}</pre>
              </div>
              <button onClick={() => setStep(2)} disabled={!message.trim()} className="btn-primary w-full justify-center mt-3">
                Next: Settings →
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-xl space-y-4">
          <div className="card space-y-4">
            <h3 className="font-display font-semibold text-slate-900">Campaign Settings</h3>
            <div>
              <label className="label">Campaign Name *</label>
              <input value={form.name} onChange={e => setForm(d => ({...d, name: e.target.value}))} placeholder="Summer Sale 2025" className="input" />
            </div>
            <div>
              <label className="label">WhatsApp Instance *</label>
              <select value={form.instance_id} onChange={e => setForm(d => ({...d, instance_id: e.target.value}))} className="input">
                <option value="">Select instance...</option>
                {instances.map(i => <option key={i.id} value={i.id}>{i.display_name || i.phone_number}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Target Audience</label>
              <select value={form.segment_id || ''} onChange={e => setForm(d => ({...d, segment_id: e.target.value, tags: ''}))} className="input mb-2">
                <option value="">All contacts</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contact_count} contacts)</option>)}
              </select>
              <input value={form.tags} onChange={e => setForm(d => ({...d, tags: e.target.value, segment_id: ''}))} placeholder="Or filter by tags (comma-separated)" className="input text-sm" />
            </div>
            <div>
              <label className="label">Approved Template Name</label>
              <input
                value={form.template_name}
                onChange={e => setForm(d => ({...d, template_name: e.target.value}))}
                placeholder="e.g. appointment_reminder"
                className="input font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Required for recipients outside the 24h window (most campaigns). Enter the exact
                name of an <strong>Approved</strong> template from Meta Business Manager whose
                body matches your message above. Leave empty to use the default
                Marketing template (<code className="bg-slate-100 px-1 rounded">marketing_offer</code>) —
                its content will NOT match your custom message.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Delay (seconds)</label>
                <input type="number" value={form.delay_seconds} onChange={e => setForm(d => ({...d, delay_seconds: e.target.value}))} min="1" max="60" className="input" />
              </div>
              <div>
                <label className="label">Schedule (optional)</label>
                <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(d => ({...d, scheduled_at: e.target.value}))} className="input" />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
            <button onClick={() => setStep(3)} disabled={!form.name || !form.instance_id} className="btn-primary flex-1 justify-center">Next: Review →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-display font-semibold text-slate-900 mb-4">📋 Campaign Summary</h3>
              <div className="space-y-0">
                {[
                  { label: 'Name', value: form.name },
                  { label: 'Instance', value: instances.find(i => i.id === form.instance_id)?.display_name || instances.find(i => i.id === form.instance_id)?.phone_number || '—' },
                  { label: 'Target', value: form.tags || 'All contacts' },
                  { label: 'Delay', value: `${form.delay_seconds}s between messages` },
                  { label: 'Schedule', value: form.scheduled_at ? format(new Date(form.scheduled_at), 'MMM d, HH:mm') : 'Send immediately' },
                  { label: 'Blocks', value: `${blocks.length} blocks` },
                  { label: 'Characters', value: `${message.length}` },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2.5 border-b border-slate-200 last:border-0">
                    <span className="text-slate-400 text-sm">{row.label}</span>
                    <span className="text-slate-900 font-medium text-sm">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
              <button onClick={handleCreate} disabled={createMut.isLoading} className="btn-primary flex-1 justify-center text-base py-3">
                {createMut.isLoading ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Creating...</> : '🚀 Launch Campaign'}
              </button>
            </div>
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-900 mb-3">📱 Final Preview</h3>
            <WhatsAppPreview message={message} contactName="John" />
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
