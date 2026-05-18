'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase/client'

export default function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', category: 'nightlife', description: '',
    date: '', doorsTime: '', showTime: '',
    venueName: '', address: '', city: '', state: '',
    is21Plus: false, dressCode: '',
    tiers: [{ id: '', name: 'General Admission', price: '', quantity: '' }],
    lineup: [{ name: '', role: '', time: '' }],
  })

  useEffect(() => {
    const load = async () => {
      const { id: eventId } = await params
      setId(eventId)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: event } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('id', eventId)
        .eq('host_id', user.id)
        .single()

      if (!event) { window.location.href = '/host'; return }

      const startsAt = event.starts_at ? new Date(event.starts_at) : null
      const doorsAt = event.doors_at ? new Date(event.doors_at) : null

      setForm({
        title: event.title ?? '',
        category: event.category ?? 'nightlife',
        description: event.description ?? '',
        date: startsAt ? startsAt.toISOString().slice(0,10) : '',
        showTime: startsAt ? startsAt.toTimeString().slice(0,5) : '',
        doorsTime: doorsAt ? doorsAt.toTimeString().slice(0,5) : '',
        venueName: event.venue_name ?? '',
        address: event.address ?? '',
        city: event.city ?? '',
        state: event.state ?? '',
        is21Plus: event.is_21_plus ?? false,
        dressCode: event.dress_code ?? '',
        tiers: event.ticket_tiers?.length
          ? event.ticket_tiers.map((t: any) => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity) }))
          : [{ id: '', name: 'General Admission', price: '', quantity: '' }],
        lineup: [{ name: '', role: '', time: '' }],
      })
      setLoading(false)
    }
    load()
  }, [])

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const updateTier = (i: number, field: string, value: string) => {
    const tiers = [...form.tiers]
    tiers[i] = { ...tiers[i], [field]: value }
    setForm(f => ({ ...f, tiers }))
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('events')
      .update({
        title: form.title,
        description: form.description,
        category: form.category,
        venue_name: form.venueName,
        address: form.address,
        city: form.city,
        state: form.state,
        is_21_plus: form.is21Plus,
        dress_code: form.dressCode,
        starts_at: form.date && form.showTime ? `${form.date}T${form.showTime}:00` : undefined,
        doors_at: form.date && form.doorsTime ? `${form.date}T${form.doorsTime}:00` : null,
      })
      .eq('id', id)

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    for (const tier of form.tiers) {
      if (!tier.name || !tier.price || !tier.quantity) continue
      if (tier.id) {
        await supabase.from('ticket_tiers').update({
          name: tier.name,
          price: parseFloat(tier.price),
          quantity: parseInt(tier.quantity),
        }).eq('id', tier.id)
      } else {
        await supabase.from('ticket_tiers').insert({
          event_id: id,
          name: tier.name,
          price: parseFloat(tier.price),
          quantity: parseInt(tier.quantity),
        })
      }
    }

    setSaving(false)
    window.location.href = '/host'
  }

  if (loading) return (
    <div style={{background:'#0a0a0b', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#555', fontFamily:'DM Sans,sans-serif'}}>
      Loading event...
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:680px; margin:0 auto; padding:0 20px 100px; }
        nav { padding:14px 20px; background:rgba(10,10,11,0.95); position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); position:relative; }
        nav::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#ED1465,#ff4fd8,#6399dc,transparent); background-size:300% 100%; animation:navPulse 4s ease-in-out infinite; }
        @keyframes navPulse { 0%{background-position:0% 50%;opacity:0.3} 50%{background-position:100% 50%;opacity:0.7} 100%{background-position:0% 50%;opacity:0.3} }
        .logo { font-family:'Nunito',sans-serif; font-size:26px; font-weight:900; letter-spacing:-0.5px; color:#ED1465; cursor:pointer; line-height:1; text-transform:lowercase; filter:drop-shadow(0 0 8px rgba(237,20,101,0.3)); }
        .back { font-size:13px; color:#555; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; transition:color 0.15s; }
        .back:hover { color:#f0f0f0; }
        .page-title { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:clamp(36px,8vw,56px); letter-spacing:1px; color:#f0f0f0; padding:36px 0 6px; text-transform:uppercase; }
        .page-sub { font-size:14px; color:#555; margin-bottom:32px; line-height:1.5; }
        .steps { display:flex; gap:6px; margin-bottom:6px; }
        .step-dot { flex:1; height:3px; border-radius:100px; background:rgba(255,255,255,0.08); transition:background 0.3s; }
        .step-dot.done { background:#ED1465; }
        .step-dot.active { background:rgba(237,20,101,0.4); animation:stepPulse 2s ease-in-out infinite; }
        @keyframes stepPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        .step-label { font-size:12px; color:#444; margin-bottom:28px; }
        .section { margin-bottom:28px; }
        .section-title { font-size:10px; color:#444; letter-spacing:1px; text-transform:uppercase; margin-bottom:14px; padding-bottom:8px; border-bottom:0.5px solid rgba(255,255,255,0.06); }
        .field { margin-bottom:14px; }
        .label { font-size:11px; color:#555; margin-bottom:5px; display:block; letter-spacing:0.4px; text-transform:uppercase; }
        .input { width:100%; background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.1); border-radius:10px; padding:12px 14px; color:#f0f0f0; font-size:15px; font-family:'DM Sans',sans-serif; outline:none; transition:border-color 0.15s; -webkit-appearance:none; }
        .input:focus { border-color:rgba(237,20,101,0.35); background:rgba(255,255,255,0.06); }
        .input::placeholder { color:#333; }
        textarea.input { min-height:100px; resize:vertical; }
        .row-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
        .select { width:100%; background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.1); border-radius:10px; padding:12px 14px; color:#f0f0f0; font-size:15px; font-family:'DM Sans',sans-serif; outline:none; cursor:pointer; -webkit-appearance:none; }
        .toggle-row { display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.03); border:0.5px solid rgba(255,255,255,0.08); border-radius:10px; padding:14px; margin-bottom:12px; cursor:pointer; transition:border-color 0.15s; }
        .toggle-row:active { border-color:rgba(237,20,101,0.3); }
        .toggle-label { font-size:14px; color:#f0f0f0; }
        .toggle-sub { font-size:12px; color:#555; margin-top:2px; }
        .toggle { width:36px; height:20px; border-radius:100px; border:none; cursor:pointer; transition:background 0.2s; flex-shrink:0; }
        .toggle.on { background:#ED1465; }
        .toggle.off { background:rgba(255,255,255,0.1); }
        .tier-card { background:rgba(255,255,255,0.03); border:0.5px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; margin-bottom:10px; }
        .tier-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .tier-num { font-size:11px; color:#444; letter-spacing:0.5px; text-transform:uppercase; }
        .remove-btn { font-size:12px; color:#444; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; transition:color 0.15s; }
        .remove-btn:hover { color:#e24b4a; }
        .add-btn { width:100%; background:transparent; border:0.5px dashed rgba(255,255,255,0.12); border-radius:10px; padding:12px; font-size:13px; color:#444; cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:4px; transition:all 0.15s; }
        .add-btn:active { border-color:rgba(255,255,255,0.3); color:#888; }
        .nav-btns { display:flex; gap:10px; margin-top:40px; padding-top:20px; border-top:0.5px solid rgba(255,255,255,0.06); }
        .prev-btn { background:transparent; border:0.5px solid rgba(255,255,255,0.1); color:#555; font-size:14px; font-family:'DM Sans',sans-serif; padding:13px 20px; border-radius:100px; cursor:pointer; transition:all 0.15s; }
        .save-btn { flex:1; background:#ED1465; color:#fff; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; box-shadow:0 0 16px rgba(237,20,101,0.3); transition:all 0.15s; }
        .save-btn:disabled { opacity:0.4; cursor:not-allowed; box-shadow:none; }
        .save-btn:active { transform:scale(0.98); }
        .next-btn { flex:1; background:#ED1465; color:#fff; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; box-shadow:0 0 16px rgba(237,20,101,0.25); transition:all 0.15s; }
        .next-btn:active { transform:scale(0.98); opacity:0.9; }
      `}</style>

      <nav>
        <button className="back" onClick={() => window.location.href='/host'}>← Dashboard</button>
        <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
        <div style={{width:'80px'}}/>
      </nav>

      <div className="wrap">
        <h1 className="page-title">Edit event</h1>
        <p className="page-sub">Update your event details below.</p>

        <div className="steps">
          {[1,2,3].map(s => (
            <div key={s} className={`step-dot ${s < step ? 'done' : s === step ? 'active' : ''}`}/>
          ))}
        </div>
        <p className="step-label">Step {step} of 3</p>

        {step === 1 && (
          <div className="section">
            <div className="section-title">Basic info</div>
            <div className="field">
              <label className="label">Event name</label>
              <input className="input" placeholder="Event name" value={form.title} onChange={e => update('title', e.target.value)}/>
            </div>
            <div className="field">
              <label className="label">Category</label>
              <select className="select" value={form.category} onChange={e => update('category', e.target.value)}>
                <option value="nightlife">Nightlife</option>
                <option value="concert">Concert</option>
                <option value="festival">Festival</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Description</label>
              <textarea className="input" placeholder="Tell people what to expect..." value={form.description} onChange={e => update('description', e.target.value)}/>
            </div>
            <div className="section-title" style={{marginTop:'20px'}}>Date & time</div>
            <div className="row-3">
              <div className="field">
                <label className="label">Date</label>
                <input className="input" type="date" value={form.date} onChange={e => update('date', e.target.value)}/>
              </div>
              <div className="field">
                <label className="label">Doors open</label>
                <input className="input" type="time" value={form.doorsTime} onChange={e => update('doorsTime', e.target.value)}/>
              </div>
              <div className="field">
                <label className="label">Show starts</label>
                <input className="input" type="time" value={form.showTime} onChange={e => update('showTime', e.target.value)}/>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="section">
            <div className="section-title">Venue details</div>
            <div className="field">
              <label className="label">Venue name</label>
              <input className="input" placeholder="e.g. The Warehouse" value={form.venueName} onChange={e => update('venueName', e.target.value)}/>
            </div>
            <div className="field">
              <label className="label">Address</label>
              <input className="input" placeholder="Street address" value={form.address} onChange={e => update('address', e.target.value)}/>
            </div>
            <div className="row-2">
              <div className="field">
                <label className="label">City</label>
                <input className="input" placeholder="Houston" value={form.city} onChange={e => update('city', e.target.value)}/>
              </div>
              <div className="field">
                <label className="label">State</label>
                <input className="input" placeholder="TX" value={form.state} onChange={e => update('state', e.target.value)}/>
              </div>
            </div>
            <div className="section-title" style={{marginTop:'24px'}}>Rules & restrictions</div>
            <div className="toggle-row" onClick={() => update('is21Plus', !form.is21Plus)}>
              <div>
                <div className="toggle-label">21+ only</div>
                <div className="toggle-sub">Guests must show valid ID at the door</div>
              </div>
              <div className={`toggle ${form.is21Plus ? 'on' : 'off'}`}/>
            </div>
            <div className="field">
              <label className="label">Dress code (optional)</label>
              <input className="input" placeholder="e.g. Upscale / No sneakers" value={form.dressCode} onChange={e => update('dressCode', e.target.value)}/>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="section">
            <div className="section-title">Ticket tiers</div>
            {form.tiers.map((tier, i) => (
              <div key={i} className="tier-card">
                <div className="tier-header">
                  <span className="tier-num">Tier {i + 1}</span>
                  {form.tiers.length > 1 && (
                    <button className="remove-btn" onClick={() => setForm(f => ({ ...f, tiers: f.tiers.filter((_,j) => j !== i) }))}>Remove</button>
                  )}
                </div>
                <div className="field">
                  <label className="label">Tier name</label>
                  <input className="input" placeholder="e.g. General Admission, VIP" value={tier.name} onChange={e => updateTier(i, 'name', e.target.value)}/>
                </div>
                <div className="row-2">
                  <div className="field">
                    <label className="label">Price ($)</label>
                    <input className="input" type="number" placeholder="0 for free" value={tier.price} onChange={e => updateTier(i, 'price', e.target.value)}/>
                  </div>
                  <div className="field">
                    <label className="label">Quantity</label>
                    <input className="input" type="number" placeholder="e.g. 200" value={tier.quantity} onChange={e => updateTier(i, 'quantity', e.target.value)}/>
                  </div>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={() => setForm(f => ({ ...f, tiers: [...f.tiers, { id:'', name:'', price:'', quantity:'' }] }))}>
              + Add another tier
            </button>
          </div>
        )}

        <div className="nav-btns">
          {step > 1 && <button className="prev-btn" onClick={() => setStep(s => s - 1)}>← Back</button>}
          {step < 3
            ? <button className="next-btn" onClick={() => setStep(s => s + 1)}>Continue →</button>
            : <button className="save-btn" disabled={saving} onClick={handleSave}>
                {saving ? 'Saving...' : '✦ Save changes'}
              </button>
          }
        </div>
      </div>
    </>
  )
}