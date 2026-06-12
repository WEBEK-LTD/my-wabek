// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon, PlayIcon, PauseIcon, XMarkIcon, PencilIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const NODE_TYPES = {
  start:     { label: 'Start',         icon: '🟢', color: 'border-blue-400 bg-blue-50',   desc: 'Flow entry point' },
  message:   { label: 'Send Message',  icon: '💬', color: 'border-blue-400 bg-blue-50',     desc: 'Send a text message' },
  question:  { label: 'Ask Question',  icon: '❓', color: 'border-yellow-400 bg-yellow-50', desc: 'Ask and save response' },
  buttons:   { label: 'Quick Replies', icon: '🔘', color: 'border-purple-400 bg-purple-50', desc: 'Show option buttons' },
  condition: { label: 'Condition',     icon: '🔀', color: 'border-orange-400 bg-orange-50', desc: 'Branch by value' },
  delay:     { label: 'Delay',         icon: '⏱️', color: 'border-slate-300 bg-slate-50',     desc: 'Wait before next' },
  tag:       { label: 'Add Tag',       icon: '🏷️', color: 'border-pink-400 bg-pink-50',     desc: 'Tag the contact' },
  assign:    { label: 'Assign',        icon: '👤', color: 'border-cyan-400 bg-cyan-50',     desc: 'Assign to agent' },
  end:       { label: 'End Flow',      icon: '🔴', color: 'border-red-400 bg-red-50',       desc: 'End conversation' },
}

const DEFAULT_DATA = {
  start: {}, message: { text: 'Hello {{name}}! How can I help?' },
  question: { question: 'What is your name?', variable: 'name' },
  buttons: { text: 'Please choose:', buttons: [{ id: '1', text: 'Option 1' }, { id: '2', text: 'Option 2' }] },
  condition: { variable: 'answer', operator: 'equals', value: '' },
  delay: { seconds: 2 }, tag: { tags: ['lead'] }, assign: { assigned_to: '' },
  end: { message: 'Thank you! Goodbye.' },
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function NodeEditor({ node, teamMembers, onSave, onClose }) {
  const [data, setData] = useState({ ...node.data })
  const upd = (k, v) => setData(d => ({ ...d, [k]: v }))
  return (
    <div className="fixed inset-0 bg-slate-50/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-display font-bold text-slate-900">{NODE_TYPES[node.type]?.icon} Edit {NODE_TYPES[node.type]?.label}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {node.type === 'message' && <>
            <label className="label">Message</label>
            <textarea value={data.text || ''} onChange={e => upd('text', e.target.value)} rows={4} className="input resize-none" placeholder="Use {{name}}, {{phone}}" />
            <p className="text-xs text-slate-500">Variables: {'{{name}}'} {'{{phone}}'} {'{{answer}}'}</p>
          </>}
          {node.type === 'question' && <>
            <div><label className="label">Question</label>
              <textarea value={data.question || ''} onChange={e => upd('question', e.target.value)} rows={3} className="input resize-none" /></div>
            <div><label className="label">Save to variable</label>
              <input value={data.variable || ''} onChange={e => upd('variable', e.target.value)} className="input font-mono text-slate-800" placeholder="name" /></div>
          </>}
          {node.type === 'buttons' && <>
            <div><label className="label">Message</label>
              <textarea value={data.text || ''} onChange={e => upd('text', e.target.value)} rows={2} className="input resize-none" /></div>
            <label className="label">Buttons</label>
            {(data.buttons || []).map((btn, i) => (
              <div key={i} className="flex gap-2">
                <input value={btn.text} onChange={e => { const b = [...data.buttons]; b[i] = { ...b[i], text: e.target.value }; upd('buttons', b) }} className="input flex-1 text-sm" placeholder={`Option ${i + 1}`} />
                <button onClick={() => upd('buttons', data.buttons.filter((_, j) => j !== i))} className="p-2 text-red-400"><XMarkIcon className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => upd('buttons', [...(data.buttons || []), { id: uid(), text: '' }])} className="btn-secondary text-sm w-full justify-center"><PlusIcon className="w-4 h-4" /> Add Button</button>
          </>}
          {node.type === 'condition' && <>
            <div><label className="label">Variable</label><input value={data.variable || ''} onChange={e => upd('variable', e.target.value)} className="input font-mono text-slate-800" /></div>
            <div><label className="label">Operator</label>
              <select value={data.operator || 'equals'} onChange={e => upd('operator', e.target.value)} className="input">
                <option value="equals">equals</option><option value="contains">contains</option>
                <option value="starts_with">starts with</option><option value="not_empty">is not empty</option>
              </select></div>
            {data.operator !== 'not_empty' && <div><label className="label">Value</label><input value={data.value || ''} onChange={e => upd('value', e.target.value)} className="input" /></div>}
          </>}
          {node.type === 'delay' && <div><label className="label">Seconds</label><input type="number" value={data.seconds || 2} onChange={e => upd('seconds', parseInt(e.target.value))} min={1} max={60} className="input" /></div>}
          {node.type === 'tag' && <div><label className="label">Tags (comma separated)</label><input value={(data.tags || []).join(', ')} onChange={e => upd('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} className="input" placeholder="vip, lead" /></div>}
          {node.type === 'assign' && <div><label className="label">Assign to</label>
            <select value={data.assigned_to || ''} onChange={e => upd('assigned_to', e.target.value)} className="input">
              <option value="">Unassigned</option>
              {(teamMembers || []).map(m => <option key={m.id} value={m.user_id}>{m.name}</option>)}
            </select></div>}
          {node.type === 'end' && <div><label className="label">Final message (optional)</label><textarea value={data.message || ''} onChange={e => upd('message', e.target.value)} rows={3} className="input resize-none" placeholder="Thank you!" /></div>}
        </div>
        <div className="flex gap-3 p-4 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={() => onSave(data)} className="btn-primary flex-1 justify-center">Save</button>
        </div>
      </div>
    </div>
  )
}

function FlowNode({ node, selected, onSelect, onEdit, onDelete, onStartConnect, connecting, onCompleteConnect, edges, onPositionChange }) {
  const cfg = NODE_TYPES[node.type] || NODE_TYPES.message
  const ref = useRef(null)
  const drag = useRef(null)

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return
    if (connecting) { onCompleteConnect(node.id); return }
    e.preventDefault()
    onSelect(node)
    const rect = ref.current.getBoundingClientRect()
    const canvas = ref.current.closest('.flow-canvas')
    const cr = canvas.getBoundingClientRect()
    drag.current = { offX: e.clientX - rect.left, offY: e.clientY - rect.top, canvasRect: cr }
    const move = (ev) => {
      if (!drag.current) return
      const x = Math.max(0, ev.clientX - drag.current.canvasRect.left - drag.current.offX + canvas.scrollLeft)
      const y = Math.max(0, ev.clientY - drag.current.canvasRect.top - drag.current.offY + canvas.scrollTop)
      ref.current.style.left = x + 'px'
      ref.current.style.top = y + 'px'
      onPositionChange(node.id, x, y)
    }
    const up = () => { drag.current = null; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const outEdges = edges.filter(e => e.source === node.id)

  return (
    <div ref={ref} onMouseDown={handleMouseDown}
      style={{ position: 'absolute', left: node.position?.x || 50, top: node.position?.y || 50, userSelect: 'none', zIndex: selected ? 10 : 1, width: 200 }}
      className={clsx('group', connecting && 'cursor-crosshair')}>
      <div className={clsx('border-2 rounded-xl p-3 shadow-lg cursor-grab active:cursor-grabbing', cfg.color, selected && 'ring-2 ring-white/30 ring-offset-1 ring-offset-black')}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5"><span>{cfg.icon}</span><span className="text-xs font-bold text-slate-900">{cfg.label}</span></div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
            <button onClick={e => { e.stopPropagation(); onEdit(node) }} className="p-0.5 text-slate-400 hover:text-slate-900"><PencilIcon className="w-3 h-3" /></button>
            {node.type !== 'start' && <button onClick={e => { e.stopPropagation(); onDelete(node.id) }} className="p-0.5 text-slate-400 hover:text-red-400"><TrashIcon className="w-3 h-3" /></button>}
          </div>
        </div>
        <p className="text-[11px] text-slate-400 truncate">{node.data.text || node.data.question || node.data.message || cfg.desc}</p>
        {node.type === 'buttons' && <div className="flex flex-wrap gap-1 mt-1">{(node.data.buttons || []).map(b => <span key={b.id} className="text-[9px] px-1.5 py-0.5 bg-purple-900/60 text-purple-300 rounded-full">{b.text}</span>)}</div>}
        {node.type === 'delay' && <p className="text-[11px] text-slate-500 mt-1">⏱ {node.data.seconds}s</p>}
        {node.type === 'condition' && <p className="text-[11px] text-slate-500 mt-1">if {node.data.variable} {node.data.operator}</p>}

        {node.type !== 'end' && (
          <div className="mt-2 flex flex-wrap gap-1">
            {node.type === 'condition' ? (
              <>
                {!outEdges.find(e => e.label === 'true') && <button onClick={e => { e.stopPropagation(); onStartConnect(node.id, 'true') }} className="text-[9px] px-2 py-0.5 bg-blue-600 text-white rounded-full">+ true</button>}
                {!outEdges.find(e => e.label === 'false') && <button onClick={e => { e.stopPropagation(); onStartConnect(node.id, 'false') }} className="text-[9px] px-2 py-0.5 bg-red-500 text-white rounded-full">+ false</button>}
              </>
            ) : node.type === 'buttons' ? (
              (node.data.buttons || []).filter(b => !outEdges.find(e => e.label === b.text)).map(b => (
                <button key={b.id} onClick={e => { e.stopPropagation(); onStartConnect(node.id, b.text) }} className="text-[9px] px-1.5 py-0.5 bg-purple-500 text-white rounded-full truncate max-w-24">+ {b.text}</button>
              ))
            ) : (
              !outEdges.length && <button onClick={e => { e.stopPropagation(); onStartConnect(node.id, null) }} className="text-[9px] px-2 py-0.5 bg-[#F8FAFC] text-slate-700 rounded-full hover:bg-brand-700 hover:text-white">+ connect</button>
            )}
          </div>
        )}
      </div>
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white" style={{ background: outEdges.length || node.type === 'end' ? '#16A34A' : '#CBD5E1' }} />
    </div>
  )
}

export default function ChatbotPage() {
  const qc = useQueryClient()
  const [view, setView] = useState('list')
  const [editingFlow, setEditingFlow] = useState(null)
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [editingNode, setEditingNode] = useState(null)
  const [connecting, setConnecting] = useState(null)
  const [flowName, setFlowName] = useState('')
  const [flowTrigger, setFlowTrigger] = useState('keyword')
  const [flowKeywords, setFlowKeywords] = useState('')
  const [flowInstance, setFlowInstance] = useState('')
  const [saving, setSaving] = useState(false)
  const [testFlow, setTestFlow] = useState(null)
  const [testMessages, setTestMessages] = useState([])
  const [testInput, setTestInput] = useState('')
  const [testLoading, setTestLoading] = useState(false)

  const runTest = async () => {
    if (!testInput.trim() || !testFlow) return
    const userMsg = testInput
    setTestInput('')
    setTestMessages(m => [...m, { role: 'user', text: userMsg }])
    setTestLoading(true)
    try {
      const useLive = editingFlow?.id === testFlow.id
      const { data } = await axios.post('/api/chatbot/test', {
        flow_id: testFlow.id,
        message: userMsg,
        nodes: useLive ? nodes : testFlow.nodes,
        edges: useLive ? edges : testFlow.edges,
        trigger_keywords: useLive ? (testFlow.trigger_keywords) : testFlow.trigger_keywords,
      })
      setTestMessages(m => [...m, { role: 'bot', text: data.response || '(no response)', nodes: data.triggered_nodes }])
    } catch {
      setTestMessages(m => [...m, { role: 'bot', text: '❌ Error testing flow', error: true }])
    }
    setTestLoading(false)
  }

  const { data: flowsData } = useQuery('chatbot-flows', () => axios.get('/api/chatbot').then(r => r.data))
  const { data: instData } = useQuery('instances', () => axios.get('/api/whatsapp/instances').then(r => r.data))
  const { data: teamData } = useQuery('team', () => axios.get('/api/team').then(r => r.data))

  const flows = flowsData?.flows || []
  const instances = (instData?.instances || []).filter(i => i.status === 'connected')
  const teamMembers = teamData?.members || []

  const toggleMut = useMutation(({ id, is_active }) => axios.put(`/api/chatbot/${id}`, { is_active }), { onSuccess: () => qc.invalidateQueries('chatbot-flows') })
  const deleteMut = useMutation(id => axios.delete(`/api/chatbot/${id}`), { onSuccess: () => { qc.invalidateQueries('chatbot-flows'); toast.success('Deleted') } })

  const addNode = (type) => {
    const maxY = nodes.reduce((m, n) => Math.max(m, (n.position?.y || 0) + 130), 60)
    const n = { id: uid(), type, data: { ...DEFAULT_DATA[type] }, position: { x: 60 + (nodes.length % 4) * 230, y: maxY + 10 } }
    setNodes(p => [...p, n]); setSelectedNode(n)
  }

  const deleteNode = (id) => {
    setNodes(p => p.filter(n => n.id !== id))
    setEdges(p => p.filter(e => e.source !== id && e.target !== id))
    if (selectedNode?.id === id) setSelectedNode(null)
  }

  const handlePositionChange = (id, x, y) => {
    setNodes(p => p.map(n => n.id === id ? { ...n, position: { x, y } } : n))
  }

  const startConnect = (fromId, label) => {
    setConnecting({ fromId, label })
    toast('Click target node', { icon: '🔗', duration: 2000, id: 'conn' })
  }

  const completeConnect = (toId) => {
    if (!connecting || connecting.fromId === toId) { setConnecting(null); return }
    setEdges(p => [
      ...p.filter(e => !(e.source === connecting.fromId && e.label === connecting.label)),
      { id: uid(), source: connecting.fromId, target: toId, label: connecting.label }
    ])
    setConnecting(null)
    toast.dismiss('conn')
    toast.success('Connected!', { duration: 1000 })
  }

  const saveFlow = async () => {
    if (!flowName.trim()) { toast.error('Flow name required'); return }
    setSaving(true)
    try {
      const payload = { name: flowName, trigger_type: flowTrigger, trigger_keywords: flowKeywords.split(',').map(k => k.trim()).filter(Boolean), instance_id: flowInstance || null, nodes, edges }
      if (editingFlow?.id) { await axios.put(`/api/chatbot/${editingFlow.id}`, payload) } else { await axios.post('/api/chatbot', payload) }
      toast.success('Saved!'); qc.invalidateQueries('chatbot-flows'); setView('list')
    } catch (e) { toast.error(e?.response?.data?.error || 'Save failed') }
    finally { setSaving(false) }
  }

  const openBuilder = (flow = null) => {
    if (flow) {
      setEditingFlow(flow); setNodes(flow.nodes || []); setEdges(flow.edges || [])
      setFlowName(flow.name); setFlowTrigger(flow.trigger_type)
      setFlowKeywords((flow.trigger_keywords || []).join(', ')); setFlowInstance(flow.instance_id || '')
    } else {
      setEditingFlow(null); setFlowName(''); setFlowTrigger('keyword'); setFlowKeywords(''); setFlowInstance('')
      setNodes([{ id: 'start-1', type: 'start', data: {}, position: { x: 300, y: 60 } }]); setEdges([])
    }
    setSelectedNode(null); setView('builder')
  }

  if (view === 'list') return (
    <DashboardLayout title="Chatbot Builder">
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-400 text-sm">{flows.length} flows</p>
        <button onClick={() => openBuilder()} className="btn-primary"><PlusIcon className="w-4 h-4" /> New Flow</button>
      </div>
      {flows.length === 0 ? (
        <div className="card text-center py-20">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="font-display font-bold text-xl text-slate-900 mb-2">No chatbot flows yet</h3>
          <p className="text-slate-400 text-sm mb-6">Build automated conversations that respond 24/7</p>
          <button onClick={() => openBuilder()} className="btn-primary mx-auto"><PlusIcon className="w-4 h-4" /> Create First Flow</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(flow => (
            <div key={flow.id} className={clsx('card hover:border-wabek-muted transition-colors', flow.is_active && 'border-blue-200/50')}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display font-semibold text-slate-900 mb-1">{flow.name}</h3>
                  <div className="flex gap-2 flex-wrap">
                    <span className={flow.is_active ? 'badge-green' : 'badge-gray'}>{flow.is_active ? '🟢 Active' : '⏸ Inactive'}</span>
                    <span className="badge-gray text-xs">{flow.trigger_type}</span>
                  </div>
                </div>
                <button onClick={() => toggleMut.mutate({ id: flow.id, is_active: !flow.is_active })}
                  className={clsx('p-2 rounded-lg', flow.is_active ? 'text-blue-600 hover:bg-blue-50/20' : 'text-slate-500 hover:bg-[#F8FAFC]')}>
                  {flow.is_active ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 mb-3">
                <span>🔲 {(flow.nodes || []).length} nodes</span>
                <span>🔗 {(flow.edges || []).length} edges</span>
                <span>⚡ {flow.trigger_count || 0} triggers</span>
              </div>
              {flow.trigger_keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {flow.trigger_keywords.slice(0, 4).map(kw => <span key={kw} className="text-xs px-2 py-0.5 bg-[#F8FAFC] text-slate-700 rounded-full">{kw}</span>)}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => openBuilder(flow)} className="btn-secondary text-xs py-1.5 flex-1 justify-center"><PencilIcon className="w-3 h-3" /> Edit</button>
                <button onClick={() => { setTestFlow(flow); setTestMessages([]) }} className="btn-secondary text-xs py-1.5 px-2" title="Test flow">🧪</button>
                <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(flow.id) }} className="p-1.5 text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )

  return (
    <DashboardLayout title={editingFlow ? `Edit: ${flowName}` : 'New Flow'}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={() => setView('list')} className="btn-secondary text-sm py-1.5">← Back</button>
        <input value={flowName} onChange={e => setFlowName(e.target.value)} placeholder="Flow name..." className="input text-sm py-1.5 w-44" />
        <select value={flowTrigger} onChange={e => setFlowTrigger(e.target.value)} className="input text-sm py-1.5 w-36">
          <option value="keyword">🔑 Keyword</option>
          <option value="any_message">💬 Any Message</option>
          <option value="first_message">👋 First Message</option>
        </select>
        {flowTrigger === 'keyword' && <input value={flowKeywords} onChange={e => setFlowKeywords(e.target.value)} placeholder="Keywords, comma separated" className="input text-sm py-1.5 w-48" />}
        <select value={flowInstance} onChange={e => setFlowInstance(e.target.value)} className="input text-sm py-1.5 w-36">
          <option value="">All instances</option>
          {instances.map(i => <option key={i.id} value={i.id}>{i.display_name || i.phone_number}</option>)}
        </select>
        <button onClick={saveFlow} disabled={saving} className="btn-primary ml-auto text-sm py-1.5">
          {saving ? <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Saving...</> : '💾 Save'}
        </button>
      </div>

      <div className="flex gap-3" style={{ height: 'calc(100vh - 210px)' }}>
        {/* Palette */}
        <div className="w-40 flex-shrink-0 overflow-y-auto space-y-1.5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Add Nodes</p>
          {Object.entries(NODE_TYPES).filter(([t]) => t !== 'start').map(([type, cfg]) => (
            <button key={type} onClick={() => addNode(type)}
              className={clsx('w-full text-left px-2.5 py-2 rounded-lg border text-xs font-medium hover:scale-105 active:scale-95 transition-transform', cfg.color)}>
              <span className="mr-1">{cfg.icon}</span>{cfg.label}
              <p className="text-slate-500 font-normal text-[10px] mt-0.5 truncate">{cfg.desc}</p>
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 relative border border-slate-200 rounded-xl overflow-hidden"
          style={{ background: '#F8FAFC', backgroundImage: 'radial-gradient(circle,#CBD5E1 1px,transparent 1px)', backgroundSize: '24px 24px' }}>
          {connecting && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-yellow-400 text-black text-xs px-3 py-1.5 rounded-full font-bold shadow-lg">
              🔗 Click target node — <button onClick={() => setConnecting(null)} className="underline">cancel</button>
            </div>
          )}

          <div className="flow-canvas absolute inset-0 overflow-auto" onClick={e => { if (e.target.classList.contains('flow-canvas')) { setSelectedNode(null); setConnecting(null) } }}>
            <div style={{ minWidth: 1400, minHeight: 900, position: 'relative' }}>
              {/* Edges SVG */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <defs>
                  <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="#4B5563" />
                  </marker>
                </defs>
                {edges.map(edge => {
                  const s = nodes.find(n => n.id === edge.source)
                  const t = nodes.find(n => n.id === edge.target)
                  if (!s || !t) return null
                  const sx = (s.position?.x || 0) + 100, sy = (s.position?.y || 0) + 100
                  const tx = (t.position?.x || 0) + 100, ty = (t.position?.y || 0) + 10
                  const cy = Math.abs(ty - sy) * 0.45
                  const color = edge.label === 'true' ? '#00D46A' : edge.label === 'false' ? '#EF4444' : '#4B5563'
                  return (
                    <g key={edge.id}>
                      <path d={`M${sx},${sy} C${sx},${sy + cy} ${tx},${ty - cy} ${tx},${ty}`} fill="none" stroke={color} strokeWidth="2" markerEnd="url(#arr)" />
                      {edge.label && <text x={(sx + tx) / 2} y={(sy + ty) / 2} fill={color} fontSize="10" textAnchor="middle" fontWeight="bold" dy="-4">{edge.label}</text>}
                    </g>
                  )
                })}
              </svg>

              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-slate-600 text-sm">Add nodes from the left panel • Drag to move • Click + to connect</p>
                </div>
              )}

              {nodes.map(node => (
                <FlowNode key={node.id} node={node}
                  selected={selectedNode?.id === node.id}
                  onSelect={setSelectedNode} onEdit={setEditingNode} onDelete={deleteNode}
                  onStartConnect={startConnect} connecting={!!connecting}
                  onCompleteConnect={completeConnect} edges={edges}
                  onPositionChange={handlePositionChange}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Details panel */}
        {selectedNode && (
          <div className="w-44 flex-shrink-0 card overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-900">{NODE_TYPES[selectedNode.type]?.icon} {NODE_TYPES[selectedNode.type]?.label}</p>
              <button onClick={() => setSelectedNode(null)} className="text-slate-500"><XMarkIcon className="w-3 h-3" /></button>
            </div>
            <div className="text-xs text-slate-500 space-y-1 mb-3">
              {Object.entries(selectedNode.data || {}).slice(0, 4).map(([k, v]) => (
                <div key={k}><span className="text-slate-600">{k}:</span> <span className="text-slate-700 break-words">{String(v).slice(0, 30)}</span></div>
              ))}
            </div>
            <button onClick={() => setEditingNode(selectedNode)} className="btn-secondary w-full text-xs justify-center mb-2"><PencilIcon className="w-3 h-3" /> Edit</button>
            <div className="space-y-1">
              {edges.filter(e => e.source === selectedNode.id).map(e => {
                const t = nodes.find(n => n.id === e.target)
                return t ? <div key={e.id} className="text-[10px] text-slate-500">→ {e.label && `[${e.label}] `}{NODE_TYPES[t.type]?.icon} {NODE_TYPES[t.type]?.label}</div> : null
              })}
            </div>
          </div>
        )}
      </div>

      {editingNode && (
        <NodeEditor node={editingNode} teamMembers={teamMembers} onClose={() => setEditingNode(null)}
          onSave={d => { setNodes(p => p.map(n => n.id === editingNode.id ? { ...n, data: d } : n)); setSelectedNode(p => p?.id === editingNode.id ? { ...p, data: d } : p); setEditingNode(null); toast.success('Updated') }} />
      )}
      {/* Test Modal */}
      {testFlow && (
        <div className="fixed inset-0 z-50 bg-slate-50/40 flex items-end sm:items-center justify-center p-4" onClick={() => setTestFlow(null)}>
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md h-[500px] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h3 className="font-display font-semibold text-slate-900 text-sm">🧪 Test: {testFlow.name}</h3>
                <p className="text-xs text-slate-500">Simulate messages to this chatbot</p>
              </div>
              <button onClick={() => { setTestFlow(null); setTestMessages([]) }} className="text-slate-500 hover:text-slate-900 p-1">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {testMessages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-600 text-sm">Send a message to test the chatbot flow</p>
                  <p className="text-slate-700 text-xs mt-1">Type what a customer might send</p>
                </div>
              )}
              {testMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-brand-500 text-black rounded-br-sm'
                      : msg.error ? 'bg-red-900/30 text-red-400 rounded-bl-sm' : 'bg-[#F8FAFC] text-slate-700 rounded-bl-sm'
                  }`}>
                    {msg.text}
                    {msg.nodes?.length > 0 && (
                      <p className="text-xs opacity-60 mt-1">Triggered: {msg.nodes.join(', ')}</p>
                    )}
                  </div>
                </div>
              ))}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#F8FAFC] rounded-2xl rounded-bl-sm px-4 py-2">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-[#F8FAFC]0 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-200 flex gap-2">
              <input value={testInput} onChange={e => setTestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runTest()}
                placeholder="Type a test message..." className="input flex-1 text-sm" />
              <button onClick={runTest} disabled={!testInput.trim() || testLoading} className="btn-primary text-sm px-4">Send</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
