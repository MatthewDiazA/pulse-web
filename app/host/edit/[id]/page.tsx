'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'
export default function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '', category: 'nightlife', description: '',
    date: '', doorsTime: '', showTime: '',
    venueName: '', address: '', city: '', state: '',
    is21Plus: false, dressCode: '',
    tiers: [{ id: '', name: '', price: '', quantity: '' }],
  })

  useEffect(() => {
    const fetchEvent = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: event } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('id', id)
        .eq('host_id', user.id)
        .single()

      if (!event) { window.location.href = '/host'; return }

      const starts = event.starts_at ? new Date(event.starts_at) : null
      const doors = event.doors_at ? new Date(event.doors_at) : null

      setForm({
        title: event.title ?? '',
        category: event.category ?? 'nightlife',
        description: event.description ?? '',
        date: starts ? starts.toISOString().split('T')[0] : '',
        showTime: starts ? starts.toTimeString().slice(0,5) : '',
        doorsTime: doors ? doors.toTimeString().slice(0,5) : '',
        venueName: event.venue_name ?? '',
        address: event.address ?? '',
        city: event.city ?? '',
        state: event.state ?? '',
        is21Plus: event.is_21_plus ?? false,
        dressCode: event.dress_code ?? '',
        tiers: event.ticket_tiers?.map((t: any) => ({
          id: t.id,
          name: t.name,
          price: String(t.price),
          quantity: String(t.quantity),
        })) ?? [{ id: '', name: '', price: '', quantity: '' }],
      })
      setLoading(false)
    }
    fetchEvent()
  }, [id])

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const updateTier = (i: number, field: string, value: string) => {
    const tiers = [...form.tiers]
    tiers[i] = { ...tiers[i], [field]: value }
    setForm(f => ({ ...f, tiers }))
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    await supabase.from('events').update({
      title: form.title,
      category: form.category,
      description: form.description,
      venue_name: form.venueName,
      address: form.address,
      city: form.city,
      state: form.state,
      is_21_plus: form.is21Plus,
      dress_code: form.dressCode,
      starts_at: form.date && form.showTime ? `${form.date}T${form.showTime}:00` : undefined,
      doors_at: form.date && form.doorsTime ? `${form.date}T${form.doorsTime}:00` : undefined,
    }).eq('id', id)

    for (const tier of form.tiers) {
      if (tier.id) {
        await supabase.from('ticket_tiers').update({
          name: tier.name,
          price: parseFloat(tier.price),
          quantity: parseInt(tier.quantity),
        }).eq('id', tier.id)
      } else if (tier.name && tier.price && tier.quantity) {
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
    <div style={{background:'#0a0a0b', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#888', fontFamily:'DM Sans,sans-serif'}}>
      Loading...
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:720px; margin:0 auto; padding:0 40px 80px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 40px; background:#0a0a0b; position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Anton',sans-serif; font-size:42px; letter-spacing:1px; color:#e8ff47; cursor:pointer; line-height:1; text-transform:lowercase; }
        .back { font-size:13px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .page-title { font-family:'Barlow Condensed',sans-serif; font-size:48px; letter-spacing:1px; color:#f0f0f0; padding:40px 0 8px; font-weight:900; }
        .page-sub { font-size:14px; color:#888; margin-bottom:40px; }
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
        .toggle { width:36px; height:20px; border-radius:100px; border:none; cursor:pointer; transition:background 0.2s; }
        .toggle.on { background:#e8ff47; }
        .toggle.off { background:rgba(255,255,255,0.14); }
        .tier-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:10px; padding:16px; margin-bottom:10px; }
        .tier-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .tier-num { font-size:12px; color:#888; }
        .remove-btn { font-size:12px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .remove-btn:hover { color:#e24b4a; }
        .add-btn { width:100%; background:transparent; border:0.5px dashed rgba(255,255,255,0.2); border-radius:8px; padding:12px; font-size:13px; color:#888; cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:4px; }
        .add-btn:hover { border-color:rgba(255,255,255,0.4); color:#f0f0f0; }
        .save-btn { width:100%; background:#e8ff47; color:#0a0a0b; border:none; border-radius:8px; padding:14px; font-size:14px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; margin-top:40px; }
        .save-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .delete-btn { width:100%; background:transparent; border:0.5px solid rgba(226,75,74,0.3); color:#e24b4a; border-radius:8px; padding:12px; font-size:14px; font-family:'DM Sans',sans-serif; cursor:pointer; margin-top:12px; }
      `}</style>

      <nav>
        <button className="back" onClick={() => window.location.href='/host'}>← Dashboard</button>
        <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
        <div style={{width:'80px'}}/>
      </nav>

      <div className="wrap">
        <h1 className="page-title">Edit event</h1>
        <p className="page-sub">Update your event details below.</p>

        <div className="section">
          <div className="section-title">Basic info</div>
          <div className="field">
            <label className="label">Event name</label>
            <input className="input" value={form.title} onChange={e => update('title', e.target.value)}/>
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
            <textarea className="input" value={form.description} onChange={e => update('description', e.target.value)}/>
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
          <div className="section-title">Venue</div>
          <div className="field">
            <label className="label">Venue name</label>
            <input className="input" value={form.venueName} onChange={e => update('venueName', e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e => update('address', e.target.value)}/>
          </div>
          <div className="row-2">
            <div className="field">
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e => update('city', e.target.value)}/>
            </div>
            <div className="field">
              <label className="label">State</label>
              <input className="input" value={form.state} onChange={e => update('state', e.target.value)}/>
            </div>
          </div>
          <div className="toggle-row" onClick={() => update('is21Plus', !form.is21Plus)}>
            <div>
              <div style={{fontSize:'14px', color:'#f0f0f0'}}>21+ only</div>
              <div style={{fontSize:'12px', color:'#888', marginTop:'2px'}}>Guests must show valid ID</div>
            </div>
            <div className={`toggle ${form.is21Plus ? 'on' : 'off'}`}/>
          </div>
          <div className="field">
            <label className="label">Dress code</label>
            <input className="input" value={form.dressCode} onChange={e => update('dressCode', e.target.value)}/>
          </div>
        </div>

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
                <input className="input" value={tier.name} onChange={e => updateTier(i, 'name', e.target.value)}/>
              </div>
              <div className="row-2">
                <div className="field">
                  <label className="label">Price ($)</label>
                  <input className="input" type="number" value={tier.price} onChange={e => updateTier(i, 'price', e.target.value)}/>
                </div>
                <div className="field">
                  <label className="label">Quantity</label>
                  <input className="input" type="number" value={tier.quantity} onChange={e => updateTier(i, 'quantity', e.target.value)}/>
                </div>
              </div>
            </div>
          ))}
          <button className="add-btn" onClick={() => setForm(f => ({ ...f, tiers: [...f.tiers, { id:'', name:'', price:'', quantity:'' }] }))}>
            + Add another tier
          </button>
        </div>

        <button className="save-btn" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button className="delete-btn" onClick={async () => {
          if (!confirm('Are you sure you want to delete this event?')) return
          const supabase = createClient()
          await supabase.from('events').delete().eq('id', id)
          window.location.href = '/host'
        }}>
          Delete event
        </button>
      </div>
    </>
  )
}