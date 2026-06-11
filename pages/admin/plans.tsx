// @ts-nocheck
import { useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, XMarkIcon, ArrowPathIcon, ClipboardIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

const EMPTY = { name:'', description:'', price_monthly:0, price_yearly:0, max_messages_month:1000, max_contacts:500, max_instances:1, max_campaigns:5, max_team_members:1, max_chatbot_flows:2, max_quick_replies:10, max_segments:5, max_links:10, max_sub_accounts:0, max_ai_replies:0, allow_api_access:false, allow_chatbot:true, allow_automation:true, allow_analytics:true, allow_white_label:false, allow_sub_accounts:false, allow_reseller:false, allow_gift_invites:false, invite_credits:0, features:'', is_active:true, sort_order:0 }

const Tog = ({ label, desc, val, onChange }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-200/40 last:border-0">
    <div><p className="text-sm text-slate-900">{label}</p>{desc&&<p className="text-xs text-slate-500">{desc}</p>}</div>
    <button onClick={() => onChange(!val)} className={clsx('relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0', val?'bg-brand-500':'bg-slate-100')}>
      <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white transition-transform m-0.5', val?'translate-x-4':'translate-x-0')} />
    </button>
  </div>
)

const Num = ({ label, desc, val, onChange, min=-1 }) => (
  <div>
    <label className="label text-xs">{label}</label>
    {desc && <p className="text-[10px] text-slate-600 mb-1">{desc}</p>}
    <input type="number" value={val??''} onChange={e => onChange(e.target.value===''?0:parseInt(e.target.value))} min={min} className="input text-sm py-1.5" />
  </div>
)

function CopyBtn({ text }) {
  const [c,setC]=useState(false)
  return <button onClick={()=>{navigator.clipboard.writeText(text);setC(true);setTimeout(()=>setC(false),2000)}} className="p-1 text-slate-400 hover:text-slate-900">{c?<CheckIcon className="w-3.5 h-3.5 text-blue-600"/>:<ClipboardIcon className="w-3.5 h-3.5"/>}</button>
}

export default function AdminPlansPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('plans')
  const [showForm, setShowForm] = useState(false)
  const [editPlan, setEditPlan] = useState(null)
  const [f, setF] = useState(EMPTY)
  const [gf, setGf] = useState({ plan_id:'', duration_days:30, price:0, note:'', quantity:1 })
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  const { data } = useQuery('admin-plans-full', () => axios.get('/api/admin/plans').then(r=>r.data))
  const { data: gd, refetch: rg } = useQuery('admin-gifts', () => axios.get('/api/admin/gifts').then(r=>r.data))
  const plans = data?.plans || []
  const gifts = gd?.gifts || []

  const syncMut = useMutation(()=>axios.post('/api/admin/sync-stripe'),{onSuccess:r=>{qc.invalidateQueries('admin-plans-full');toast.success(`✅ Synced ${r.data.synced||0} plans with Stripe!`)},onError:e=>toast.error(e?.response?.data?.error||'Sync failed')})
  const saveMut = useMutation(b=>editPlan?axios.put(`/api/admin/plans/${editPlan.id}`,b):axios.post('/api/admin/plans',b),{
    onSuccess:()=>{qc.invalidateQueries('admin-plans-full');setShowForm(false);setEditPlan(null);setF(EMPTY);toast.success(editPlan?'Plan updated! ✅':'Plan created! ✅')},
    onError:e=>toast.error(e?.response?.data?.error||'Failed')
  })
  const delMut = useMutation(id=>axios.delete(`/api/admin/plans/${id}`),{onSuccess:()=>{qc.invalidateQueries('admin-plans-full');toast.success('Plan deactivated')}})
  const giftMut = useMutation(b=>axios.post('/api/admin/gifts',b),{
    onSuccess:r=>{rg();const codes=r.data.gifts.map(g=>g.code).join('\n');navigator.clipboard.writeText(codes);toast.success(`🎁 ${r.data.gifts.length} code(s) created & copied!`);setGf({plan_id:'',duration_days:30,price:0,note:'',quantity:1})},
    onError:e=>toast.error(e?.response?.data?.error||'Failed')
  })

  const openEdit = p => { setEditPlan(p); setF({...p,features:(p.features||[]).join(', ')}); setShowForm(true) }
  const doSave = () => saveMut.mutate({...f,features:typeof f.features==='string'?f.features.split(',').map(s=>s.trim()).filter(Boolean):f.features})

  return (
    <AdminLayout title="Plans & Gift Invites">
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {[{id:'plans',label:'📦 Plans'},{id:'gifts',label:'🎁 Gift Invites'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',tab===t.id?'border-brand-500 text-blue-600':'border-transparent text-slate-500 hover:text-slate-700')}>{t.label}</button>
        ))}
      </div>

      {tab==='plans' && (<>
        <div className="flex gap-2 mb-5">
          <button onClick={()=>{setShowForm(v=>!v);setEditPlan(null);setF(EMPTY)}} className="btn-primary text-sm"><PlusIcon className="w-4 h-4"/> New Plan</button>
          <button onClick={()=>syncMut.mutate()} disabled={syncMut.isLoading} className="btn-secondary text-sm">
            {syncMut.isLoading?<><ArrowPathIcon className="w-4 h-4 animate-spin"/> Syncing...</>:<><ArrowPathIcon className="w-4 h-4"/> Sync with Stripe</>}
          </button>
        </div>

        {showForm && (
          <div className="card mb-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-display font-bold text-slate-900 text-lg">{editPlan?'Edit Plan':'New Plan'}</h3>
              <button onClick={()=>{setShowForm(false);setEditPlan(null)}} className="text-slate-400 hover:text-slate-900"><XMarkIcon className="w-5 h-5"/></button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-3 font-semibold">Basic Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label text-xs">Plan Name *</label><input value={f.name} onChange={e=>set('name',e.target.value)} placeholder="Pro" className="input text-sm"/></div>
                  <div><label className="label text-xs">Sort Order <span className="text-slate-600">(0=first)</span></label><input type="number" value={f.sort_order} onChange={e=>set('sort_order',parseInt(e.target.value)||0)} className="input text-sm"/></div>
                  <div className="col-span-2"><label className="label text-xs">Description</label><input value={f.description||''} onChange={e=>set('description',e.target.value)} placeholder="Perfect for growing businesses" className="input text-sm"/></div>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-3 font-semibold">Pricing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label text-xs">Monthly Price ($)</label><input type="number" value={f.price_monthly} onChange={e=>set('price_monthly',parseFloat(e.target.value)||0)} min={0} step={0.01} className="input text-sm"/></div>
                  <div><label className="label text-xs">Yearly Price ($) <span className="text-slate-600">optional</span></label><input type="number" value={f.price_yearly||''} onChange={e=>set('price_yearly',parseFloat(e.target.value)||0)} min={0} step={0.01} className="input text-sm"/></div>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-3 font-semibold">Limits <span className="normal-case text-slate-600 text-xs">(-1 = unlimited)</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Num label="Messages/Month" val={f.max_messages_month} onChange={v=>set('max_messages_month',v)}/>
                  <Num label="Contacts" val={f.max_contacts} onChange={v=>set('max_contacts',v)}/>
                  <Num label="WA Instances" val={f.max_instances} onChange={v=>set('max_instances',v)} min={1}/>
                  <Num label="Campaigns" val={f.max_campaigns} onChange={v=>set('max_campaigns',v)}/>
                  <Num label="Team Members" val={f.max_team_members||1} onChange={v=>set('max_team_members',v)} min={1}/>
                  <Num label="Chatbot Flows" val={f.max_chatbot_flows??2} onChange={v=>set('max_chatbot_flows',v)}/>
                  <Num label="AI Replies/mo (-1=∞)" val={f.max_ai_replies??0} onChange={v=>set('max_ai_replies',v)}/>
                  <Num label="Quick Replies" val={f.max_quick_replies??10} onChange={v=>set('max_quick_replies',v)}/>
                  <Num label="Segments" val={f.max_segments??5} onChange={v=>set('max_segments',v)}/>
                  <Num label="Tracked Links" val={f.max_links??10} onChange={v=>set('max_links',v)}/>
                  <Num label="Sub-Accounts" val={f.max_sub_accounts||0} onChange={v=>set('max_sub_accounts',v)} min={0}/>
                  <Num label="Gift Credits/Month" desc="Invites included per billing cycle" val={f.invite_credits||0} onChange={v=>set('invite_credits',v)} min={0}/>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-3 font-semibold">Features Included</p>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <Tog label="API Access" desc="REST API + API Keys" val={f.allow_api_access} onChange={v=>set('allow_api_access',v)}/>
                  <Tog label="Chatbot Builder" desc="Drag & drop flow builder" val={f.allow_chatbot} onChange={v=>set('allow_chatbot',v)}/>
                  <Tog label="Automation Flows" val={f.allow_automation} onChange={v=>set('allow_automation',v)}/>
                  <Tog label="Analytics Dashboard" val={f.allow_analytics} onChange={v=>set('allow_analytics',v)}/>
                  <Tog label="White Label" desc="Custom brand, logo & domain" val={f.allow_white_label} onChange={v=>set('allow_white_label',v)}/>
                  <Tog label="Sub-Accounts" desc="Create isolated client accounts" val={f.allow_sub_accounts} onChange={v=>set('allow_sub_accounts',v)}/>
                  <Tog label="Reseller System" desc="Sell platform subscriptions" val={f.allow_reseller} onChange={v=>set('allow_reseller',v)}/>
                  <Tog label="Gift Invites" desc="Send gift codes to contacts" val={f.allow_gift_invites} onChange={v=>set('allow_gift_invites',v)}/>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-2 font-semibold">Feature Bullets <span className="normal-case text-slate-600 text-xs">shown on billing page</span></p>
                <textarea value={f.features} onChange={e=>set('features',e.target.value)} rows={3} placeholder="Real-time chat, AI campaigns, Priority support, 24/7 uptime" className="input resize-none text-sm"/>
                <p className="text-xs text-slate-600 mt-1">Comma-separated</p>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <Tog label="Plan Active — visible to users" val={f.is_active} onChange={v=>set('is_active',v)}/>
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-5 border-t border-slate-200">
              <button onClick={()=>{setShowForm(false);setEditPlan(null)}} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={doSave} disabled={saveMut.isLoading||!f.name} className="btn-primary flex-1 justify-center">
                {saveMut.isLoading?<><ArrowPathIcon className="w-4 h-4 animate-spin"/> Saving...</>:editPlan?'Update Plan':'Create Plan'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan=>(
            <div key={plan.id} className={clsx('card',!plan.is_active&&'opacity-60')}>
              <div className="flex items-start justify-between mb-2">
                <div><h3 className="font-display font-bold text-slate-900">{plan.name}</h3><p className="text-xs text-slate-500 mt-0.5">{plan.description}</p></div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={()=>openEdit(plan)} className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-50"><PencilIcon className="w-4 h-4"/></button>
                  <button onClick={()=>{if(confirm('Deactivate this plan?'))delMut.mutate(plan.id)}} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-900/10"><TrashIcon className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-display font-bold text-slate-900">${plan.price_monthly}</span><span className="text-slate-500 text-xs">/mo</span>
                {plan.price_yearly>0&&<span className="text-xs text-blue-600 ml-2">${plan.price_yearly}/yr</span>}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs mb-3">
                {[['💬',plan.max_messages_month===-1?'∞':plan.max_messages_month?.toLocaleString(),'msgs'],
                  ['👥',plan.max_contacts===-1?'∞':plan.max_contacts?.toLocaleString(),'contacts'],
                  ['📱',plan.max_instances,'WA'],['📢',plan.max_campaigns===-1?'∞':plan.max_campaigns,'campaigns'],
                  ['🤖',plan.max_chatbot_flows===-1?'∞':(plan.max_chatbot_flows??'—'),'bots'],
                  ['🧠',plan.max_ai_replies===-1?'∞':(plan.max_ai_replies??0),'AI/mo'],
                  ['👤',plan.max_team_members??1,'agents']
                ].map(([icon,val,label])=>(
                  <div key={label} className="flex items-center gap-1 text-slate-500"><span>{icon}</span><span className="text-slate-900 font-medium">{val}</span><span>{label}</span></div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {plan.allow_api_access&&<span className="text-[10px] bg-[#F8FAFC] text-slate-700 px-1.5 py-0.5 rounded-md">API</span>}
                {plan.allow_white_label&&<span className="text-[10px] bg-[#F8FAFC] text-slate-700 px-1.5 py-0.5 rounded-md">White Label</span>}
                {plan.allow_sub_accounts&&<span className="text-[10px] bg-[#F8FAFC] text-slate-700 px-1.5 py-0.5 rounded-md">Sub-Accounts ({plan.max_sub_accounts})</span>}
                {plan.allow_reseller&&<span className="text-[10px] bg-[#F8FAFC] text-slate-700 px-1.5 py-0.5 rounded-md">Reseller</span>}
                {plan.allow_gift_invites&&<span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-1.5 py-0.5 rounded-md">🎁 {plan.invite_credits} gifts/mo</span>}
              </div>
              <div className="flex justify-between items-center">
                <span className={plan.is_active?'badge-green text-xs':'badge-gray text-xs'}>{plan.is_active?'Active':'Inactive'}</span>
                <span className={plan.stripe_price_id_monthly?'text-[10px] text-blue-600':'text-[10px] text-yellow-500'}>{plan.stripe_price_id_monthly?'✅ Stripe synced':'⚠️ Not synced'}</span>
              </div>
            </div>
          ))}
        </div>
      </>)}

      {tab==='gifts' && (
        <div className="space-y-5">
          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-4">🎁 Generate Gift Codes</h3>
            <p className="text-xs text-slate-500 mb-4">Gift codes activate a specific plan for a set number of days — no payment required. Sell them or give them as promotions.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="label text-xs">Plan *</label>
                <select value={gf.plan_id} onChange={e=>setGf(p=>({...p,plan_id:e.target.value}))} className="input text-sm">
                  <option value="">Select plan</option>
                  {plans.map(p=><option key={p.id} value={p.id}>{p.name} (${p.price_monthly}/mo)</option>)}
                </select>
              </div>
              <div><label className="label text-xs">Duration (days)</label><input type="number" value={gf.duration_days} onChange={e=>setGf(p=>({...p,duration_days:parseInt(e.target.value)||30}))} min={1} className="input text-sm"/></div>
              <div><label className="label text-xs">Sale Price ($) <span className="text-slate-600">0=free</span></label><input type="number" value={gf.price} onChange={e=>setGf(p=>({...p,price:parseFloat(e.target.value)||0}))} min={0} step={0.01} className="input text-sm"/></div>
              <div><label className="label text-xs">Quantity <span className="text-slate-600">max 50</span></label><input type="number" value={gf.quantity} onChange={e=>setGf(p=>({...p,quantity:Math.min(50,parseInt(e.target.value)||1)}))} min={1} max={50} className="input text-sm"/></div>
              <div className="col-span-2"><label className="label text-xs">Internal Note</label><input value={gf.note} onChange={e=>setGf(p=>({...p,note:e.target.value}))} placeholder="e.g. Ramadan 2025 promotion" className="input text-sm"/></div>
            </div>
            <button onClick={()=>giftMut.mutate(gf)} disabled={giftMut.isLoading||!gf.plan_id} className="btn-primary text-sm">
              {giftMut.isLoading?'Generating...':`🎁 Generate ${gf.quantity} Code${gf.quantity>1?'s':''} & Copy`}
            </button>
          </div>

          <div className="card">
            <h3 className="font-display font-semibold text-slate-900 mb-4">All Gift Codes <span className="text-slate-500 font-normal text-sm">({gifts.length})</span></h3>
            {gifts.length===0 ? (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">🎁</p>
                <p className="text-slate-500 text-sm">No gift codes yet — generate some above</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-slate-200">{['Code','Plan','Days','Price','Status','Used By','Created'].map(h=><th key={h} className="table-head">{h}</th>)}</tr></thead>
                  <tbody>
                    {gifts.map(g=>(
                      <tr key={g.id} className="table-row">
                        <td className="table-cell"><div className="flex items-center gap-1"><code className="text-xs font-mono text-blue-600 bg-blue-50/20 px-1.5 py-0.5 rounded">{g.code}</code><CopyBtn text={g.code}/></div></td>
                        <td className="table-cell text-sm text-slate-700">{g.plan?.name}</td>
                        <td className="table-cell text-sm text-slate-400">{g.duration_days}d</td>
                        <td className="table-cell text-sm">{g.price>0?<span className="text-slate-900">${g.price}</span>:<span className="text-blue-600">Free</span>}</td>
                        <td className="table-cell"><span className={g.is_used?'badge-gray text-xs':'badge-green text-xs'}>{g.is_used?'✅ Used':'🎁 Available'}</span></td>
                        <td className="table-cell text-xs">{g.used_by_user?<><p className="text-slate-900">{g.used_by_user.name}</p><p className="text-slate-500">{g.used_by_user.email}</p></>:'—'}</td>
                        <td className="table-cell text-xs text-slate-500">{new Date(g.created_at).toLocaleDateString()}{g.note&&<p className="text-[10px] text-slate-600 mt-0.5">{g.note}</p>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
