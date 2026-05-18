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
    if (!user) { window.location.href = '/login'; return }


    const slug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now()


    const { data: event, error } = await supabase
      .from('events')
      .insert({
        host_id: user.id, title: form.title, slug,
        description: form.description, category: form.category,
        status: 'published', venue_name: form.venueName,
        address: form.address, city: form.city, state: form.state,
        is_21_plus: form.is21Plus, dress_code: form.dressCode,
        starts_at: form.date && form.showTime ? `${form.date}T${form.showTime}:00` : new Date().toISOString(),
        doors_at: form.date && form.doorsTime ? `${form.date}T${form.doorsTime}:00` : null,
      })
      .select().single()


    if (error) { alert('Error: ' + error.message); setLoading(false); return }


    if (event && form.tiers.length > 0) {
      const tierRows = form.tiers
        .filter(t => t.name && t.price && t.quantity)
        .map((t, i) => ({
          event_id: event.id, name: t.name,
          price: parseFloat(t.price), quantity: parseInt(t.quantity), sort_order: i,
        }))
      if (tierRows.length > 0) await supabase.from('ticket_tiers').insert(tierRows)
    }


    setLoading(false)
    window.location.href = '/host'
  }


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
        .step-label { font-size:12px; color:#444; margin-bottom:28px; font-family:'DM Sans',sans-serif; letter-spacing:0.3px; }
        .section { margin-bottom:28px; }
        .section-title { font-size:10px; color:#444; letter-spacing:1px; text-transform:uppercase; margin-bottom:14px; padding-bottom:8px; border-bottom:0.5px solid rgba(255,255,255,0.06); font-family:'DM Sans',sans-serif; }
        .field { margin-bottom:14px; }
        .label { font-size:11px; color:#555; margin-bottom:5px; display:block; letter-spacing:0.4px; text-transform:uppercase; font-family:'DM Sans',sans-serif; }
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
        .upload-area { border:0.5px dashed rgba(255,255,255,0.12); border-radius:12px; padding:28px; text-align:center; cursor:pointer; transition:all 0.15s; margin-bottom:16px; }
        .upload-area:active { border-color:rgba(237,20,101,0.3); background:rgba(237,20,101,0.02); }
        .upload-icon { width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; margin:0 auto 12px; }
        .upload-text { font-size:14px; color:#555; }
        .upload-sub { font-size:12px; color:#333; margin-top:4px; }
        .nav-btns { display:flex; gap:10px; margin-top:40px; padding-top:20px; border-top:0.5px solid rgba(255,255,255,0.06); }
        .prev-btn { background:transparent; border:0.5px solid rgba(255,255,255,0.1); color:#555; font-size:14px; font-family:'DM Sans',sans-serif; padding:13px 20px; border-radius:100px; cursor:pointer; transition:all 0.15s; }
        .prev-btn:active { color:#f0f0f0; }
        .next-btn { flex:1; background:#ED1465; color:#fff; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; box-shadow:0 0 16px rgba(237,20,101,0.25); transition:all 0.15s; }
        .next-btn:active { transform:scale(0.98); opacity:0.9; }
        .publish-btn { flex:1; background:#ED1465; color:#fff; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; box-shadow:0 0 16px rgba(237,20,101,0.3); transition:all 0.15s; }
        .publish-btn:disabled { opacity:0.4; cursor:not-allowed; box-shadow:none; }
        .publish-btn:active { transform:scale(0.98); }
      `}</style>


      <nav>
        <button className="back" onClick={() => window.location.href='/host'}>← Dashboard</button>
        <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
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
                <div className="upload-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                </div>
                <div className="upload-text">Tap to upload cover image</div>
                <div className="upload-sub">JPG or PNG · Max 10MB · 1600x900 recommended</div>
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
                    <label className="label">Quantity</label>
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
              <div key={i} className="tier-card">
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
                    <input className="input" placeholder="e.g. Headliner" value={act.role} onChange={e => updateLineup(i, 'role', e.target.value)}/>
                  </div>
                  <div className="field">
                    <label className="label">Set time</label>
                    <input className="input" placeholder="e.g. 12AM - 3AM" value={act.time} onChange={e => updateLineup(i, 'time', e.target.value)}/>
                  </div>
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
                {loading ? 'Publishing...' : '✦ Publish event'}
              </button>
          }
        </div>
      </div>
    </>
  )
}



