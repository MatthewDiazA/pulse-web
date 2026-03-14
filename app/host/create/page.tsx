'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function CreateEvent() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title: '', category: 'nightlife', description: '',
    date: '', doorsTime: '', showTime: '',
    venueName: '', address: '', city: '', state: '',
    is21Plus: false, dressCode: '',
    tiers: [{ name: 'General Admission', price: '', quantity: '' }],
    lineup: [{ name: '', role: '', time: '' }],
  })

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const updateTier = (i: number, field: string, value: string) => {
    const tiers = [...form.tiers]
    tiers[i] = { ...tiers[i], [field]: value }
    setForm(f => ({ ...f, tiers }))
  }

  const updateLineup = (i: number, field: string, value: string) => {
    const lineup = [...form.lineup]
    lineup[i] = { ...lineup[i], [field]: value }
    setForm(f => ({ ...f, lineup }))
  }

  const handlePublish = async () => {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now()

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        host_id: user.id,
        title: form.title,
        slug,
        description: form.description,
        category: form.category,
        status: 'published',
        venue_name: form.venueName,
        address: form.address,
        city: form.city,
        state: form.state,
        is_21_plus: form.is21Plus,
        dress_code: form.dressCode,
        starts_at: form.date && form.showTime ? `${form.date}T${form.showTime}:00` : new Date().toISOString(),
        doors_at: form.date && form.doorsTime ? `${form.date}T${form.doorsTime}:00` : null,
      })
      .select()
      .single()

    if (error) {
      alert('Error creating event: ' + error.message)
      setLoading(false)
      return
    }

    if (event && form.tiers.length > 0) {
      const tierRows = form.tiers
        .filter(t => t.name && t.price && t.quantity)
        .map((t, i) => ({
          event_id: event.id,
          name: t.name,
          price: parseFloat(t.price),
          quantity: parseInt(t.quantity),
          sort_order: i,
        }))

      if (tierRows.length > 0) {
        await supabase.from('ticket_tiers').insert(tierRows)
      }
    }

    setLoading(false)
    window.location.href = '/host'
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:720px; margin:0 auto; padding:0 40px 80px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 40px; background:#0a0a0b; position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Bebas Neue',sans-serif; font-size:24px; letter-spacing:4px; color:#e8ff47; cursor:pointer; }
        .back { font-size:13px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .page-title { font-family:'Bebas Neue',sans-serif; font-size:48px; letter-spacing:1px; color:#f0f0f0; padding:40px 0 8px; }
        .page-sub { font-size:14px; color:#888; margin-bottom:40px; }
        .steps { display:flex; gap:8px; margin-bottom:8px; }
        .step-dot { flex:1; height:3px; border-radius:100px; background:rgba(255,255,255,0.1); transition:background 0.2s; }
        .step-dot.done { background:#e8ff47; }
        .step-dot.active { background:rgba(232,255,71,0.4); }
        .step-label { font-size:13px; color:#888; margin-bottom:24px; }
        .section { margin-bottom:32px; }
        .section-title { font-size:11px; color:#888; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:16px; padding-bottom:8px; border-bottom:0.5px solid rgba(255,255,255,0.08); }
        .field { margin-bottom:16px; }
        .label { font-size:12px; color:#888; margin-bottom:6px; display:block; }
        .input { width:100%; background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.14); border-radius:8px; padding:11px 14px; color:#f0f0f0; font-size:14px; font-family:'DM Sans',sans-serif; outline:none; }
        .input:focus { border-color:rgba(255,255,255,0.28); }
        textarea.input { min-height:100px; resize:vertical; }
        .row-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
        .select { width:100%; background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:8px; padding:11px 14px; color:#f0f0f0; font-size:14px; font-family:'DM Sans',sans-serif; outline:none; cursor:pointer; }
        .toggle-row { display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.08); border-radius:8px; padding:14px; margin-bottom:12px; cursor:pointer; }
        .toggle-label { font-size:14px; color:#f0f0f0; }
        .toggle-sub { font-size:12px; color:#888; margin-top:2px; }
        .toggle { width:36px; height:20px; border-radius:100px; border:none; cursor:pointer; transition:background 0.2s; }
        .toggle.on { background:#e8ff47; }
        .toggle.off { background:rgba(255,255,255,0.14); }
        .tier-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:10px; padding:16px; margin-bottom:10px; }
        .tier-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .tier-num { font-size:12px; color:#888; }
        .remove-btn { font-size:12px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .remove-btn:hover { color:#e24b4a; }
        .add-btn { width:100%; background:transparent; border:0.5px dashed rgba(255,255,255,0.2); border-radius:8px; padding:12px; font-size:13px; color:#888; cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:4px; transition:all 0.15s; }
        .add-btn:hover { border-color:rgba(255,255,255,0.4); color:#f0f0f0; }
        .lineup-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:10px; padding:16px; margin-bottom:10px; }
        .upload-area { border:0.5px dashed rgba(255,255,255,0.2); border-radius:10px; padding:32px; text-align:center; cursor:pointer; transition:all 0.15s; margin-bottom:16px; }
        .upload-area:hover { border-color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.02); }
        .upload-text { font-size:14px; color:#888; }
        .upload-sub { font-size:12px; color:#555; margin-top:4px; }
        .nav-btns { display:flex; gap:12px; margin-top:40px; padding-top:24px; border-top:0.5px solid rgba(255,255,255,0.08); }
        .prev-btn { background:transparent; border:0.5px solid rgba(255,255,255,0.14); color:#888; font-size:14px; font-family:'DM Sans',sans-serif; padding:12px 24px; border-radius:8px; cursor:pointer; }
        .prev-btn:hover { color:#f0f0f0; }
        .next-btn { flex:1; background:#e8ff47; color:#0a0a0b; border:none; border-radius:8px; padding:12px; font-size:14px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; }
        .publish-btn { flex:1; background:#e8ff47; color:#0a0a0b; border:none; border-radius:8px; padding:12px; font-size:14px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; }
        .publish-btn:disabled { opacity:0.5; cursor:not-allowed; }
      `}</style>

      <nav>
        <button className="back" onClick={() => window.location.href='/host'}>← Dashboard</button>
        <div className="logo" onClick={() => window.location.href='/'}>PULSE</div>
        <div style={{width:'80px'}}/>
      </nav>

      <div className="wrap">
        <h1 className="page-title">Create event</h1>
        <p className="page-sub">Fill in the details below to publish your event on PULSE.</p>

        <div className="steps">
          {[1,2,3,4].map(s => (
            <div key={s} className={`step-dot ${s < step ? 'done' : s === step ? 'active' : ''}`}/>
          ))}
        </div>
        <p className="step-label">Step {step} of 4</p>

        {step === 1 && (
          <>
            <div className="section">
              <div className="section-title">Basic info</div>
              <div className="field">
                <label className="label">Event name</label>
                <input className="input" placeholder="e.g. Club Noir — Grand Opening" value={form.title} onChange={e => update('title', e.target.value)}/>
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
            </div>
            <div className="section">
              <div className="section-title">Date & time</div>
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
            <div className="section">
              <div className="section-title">Cover image</div>
              <div className="upload-area">
                <div style={{fontSize:'32px', marginBottom:'8px'}}>🖼</div>
                <div className="upload-text">Click to upload cover image</div>
                <div className="upload-sub">JPG or PNG · Max 10MB · Recommended 1600×900</div>
              </div>
            </div>
          </>
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
                    <label className="label">Quantity available</label>
                    <input className="input" type="number" placeholder="e.g. 200" value={tier.quantity} onChange={e => updateTier(i, 'quantity', e.target.value)}/>
                  </div>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={() => setForm(f => ({ ...f, tiers: [...f.tiers, { name:'', price:'', quantity:'' }] }))}>
              + Add another tier
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="section">
            <div className="section-title">Lineup (optional)</div>
            {form.lineup.map((act, i) => (
              <div key={i} className="lineup-card">
                <div className="tier-header">
                  <span className="tier-num">Performer {i + 1}</span>
                  {form.lineup.length > 1 && (
                    <button className="remove-btn" onClick={() => setForm(f => ({ ...f, lineup: f.lineup.filter((_,j) => j !== i) }))}>Remove</button>
                  )}
                </div>
                <div className="field">
                  <label className="label">Name</label>
                  <input className="input" placeholder="e.g. DJ Sasha Vee" value={act.name} onChange={e => updateLineup(i, 'name', e.target.value)}/>
                </div>
                <div className="row-2">
                  <div className="field">
                    <label className="label">Role</label>
                    <input className="input" placeholder="e.g. Headliner · Techno" value={act.role} onChange={e => updateLineup(i, 'role', e.target.value)}/>
                  </div>
                  <div className="field">
                    <label className="label">Set time</label>
                    <input className="input" placeholder="e.g. 12AM – 3AM" value={act.time} onChange={e => updateLineup(i, 'time', e.target.value)}/>
                  </div>
                </div>
                <div className="upload-area" style={{padding:'16px', marginBottom:'0', marginTop:'8px'}}>
                  <div className="upload-text" style={{fontSize:'13px'}}>📷 Upload performer photo</div>
                </div>
              </div>
            ))}
            <button className="add-btn" onClick={() => setForm(f => ({ ...f, lineup: [...f.lineup, { name:'', role:'', time:'' }] }))}>
              + Add performer
            </button>
          </div>
        )}

        <div className="nav-btns">
          {step > 1 && <button className="prev-btn" onClick={() => setStep(s => s - 1)}>← Back</button>}
          {step < 4
            ? <button className="next-btn" onClick={() => setStep(s => s + 1)}>Continue →</button>
            : <button className="publish-btn" disabled={loading} onClick={handlePublish}>
                {loading ? 'Publishing...' : 'Publish event 🎉'}
              </button>
          }
        </div>
      </div>
    </>
  )
}