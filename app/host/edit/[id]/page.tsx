'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  bg: '#000',
} as const

type LineupAct = { name: string; role: string; time: string }

export default function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [id, setId] = useState<string>('')
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletedTierIds, setDeletedTierIds] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '', category: 'nightlife', description: '', tagline: '',
    date: '', doorsTime: '', showTime: '',
    venueName: '', address: '', city: '', state: '',
    is21Plus: false, dressCode: '',
    tiers: [{ id: '', name: '', price: '', quantity: '' }],
    lineup: [{ name: '', role: '', time: '' }] as LineupAct[],
    instagramHandle: '', tiktokUrl: '', spotifyUrl: '', feedVideoUrl: '',
  })

  useEffect(() => {
    const load = async () => {
      const { id: eventId } = await params
      setId(eventId)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Check admin status — admins can edit any event
      const { data: adminRow } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      const userIsAdmin = !!adminRow

      // Admins load any event; everyone else is restricted to their own
      let query = supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('id', eventId)
      if (!userIsAdmin) {
        query = query.eq('host_id', user.id)
      }
      const { data: event } = await query.single()

      if (!event) { router.push('/host'); return }

      const startsAt = event.starts_at ? new Date(event.starts_at) : null
      const doorsAt = event.doors_at ? new Date(event.doors_at) : null

      // Parse saved lineup (stored as JSON text). Fall back to one blank row.
      let parsedLineup: LineupAct[] = [{ name: '', role: '', time: '' }]
      if (event.lineup) {
        try {
          const arr = typeof event.lineup === 'string' ? JSON.parse(event.lineup) : event.lineup
          if (Array.isArray(arr) && arr.length > 0) {
            parsedLineup = arr.map((a: any) => ({
              name: a.name ?? '', role: a.role ?? '', time: a.time ?? '',
            }))
          }
        } catch {
          // leave default blank row
        }
      }

      // Strip stored https:// prefix off IG handle for display (we re-add @ visually)
      const igDisplay = (event.instagram_handle ?? '')
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/^@/, '')

      setForm({
        title: event.title ?? '',
        category: event.category ?? 'nightlife',
        description: event.description ?? '',
        tagline: event.tagline ?? '',
        date: startsAt ? startsAt.toISOString().slice(0, 10) : '',
        showTime: startsAt ? startsAt.toTimeString().slice(0, 5) : '',
        doorsTime: doorsAt ? doorsAt.toTimeString().slice(0, 5) : '',
        venueName: event.venue_name ?? '',
        address: event.address ?? '',
        city: event.city ?? '',
        state: event.state ?? '',
        is21Plus: event.is_21_plus ?? false,
        dressCode: event.dress_code ?? '',
        tiers: event.ticket_tiers?.length
          ? event.ticket_tiers.map((t: any) => ({
              id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity),
            }))
          : [{ id: '', name: '', price: '', quantity: '' }],
        lineup: parsedLineup,
        instagramHandle: igDisplay,
        tiktokUrl: event.tiktok_url ?? '',
        spotifyUrl: event.spotify_playlist_url ?? '',
        feedVideoUrl: event.feed_video_url ?? '',
      })
      setLoading(false)
    }
    load()
  }, [params, router])

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }))

  const updateTier = (i: number, field: string, value: string) => {
    const tiers = [...form.tiers]
    tiers[i] = { ...tiers[i], [field]: value }
    setForm(f => ({ ...f, tiers }))
  }

  const updateLineup = (i: number, field: keyof LineupAct, value: string) => {
    setForm(f => {
      const lineup = [...f.lineup]
      lineup[i] = { ...lineup[i], [field]: value }
      return { ...f, lineup }
    })
  }

  const removeTier = (i: number) => {
    const tier = form.tiers[i]
    if (tier.id) {
      setDeletedTierIds(prev => [...prev, tier.id])
    }
    setForm(f => ({ ...f, tiers: f.tiers.filter((_, j) => j !== i) }))
  }

  const normalizeIgHandle = (raw: string): string | null => {
    const v = raw.trim()
    if (!v) return null
    let h = v
    h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    h = h.replace(/^@/, '')
    h = h.replace(/\/+$/, '')
    h = h.split(/[/?]/)[0]
    return h || null
  }

  const cleanUrl = (raw: string): string | null => {
    const v = raw.trim()
    if (!v) return null
    if (!/^https?:\/\//i.test(v)) return `https://${v}`
    return v
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()

    const lineupClean = form.lineup
      .filter(a => a.name.trim())
      .map(a => ({ name: a.name.trim(), role: a.role.trim(), time: a.time.trim() }))

    const { error } = await supabase
      .from('events')
      .update({
        title: form.title,
        description: form.description,
        tagline: form.tagline.trim() || null,
        category: form.category,
        venue_name: form.venueName,
        address: form.address,
        city: form.city,
        state: form.state,
        is_21_plus: form.is21Plus,
        dress_code: form.dressCode,
        starts_at: form.date && form.showTime ? `${form.date}T${form.showTime}:00` : undefined,
        doors_at: form.date && form.doorsTime ? `${form.date}T${form.doorsTime}:00` : null,
        lineup: lineupClean.length > 0 ? JSON.stringify(lineupClean) : null,
        instagram_handle: normalizeIgHandle(form.instagramHandle),
        tiktok_url: cleanUrl(form.tiktokUrl),
        spotify_playlist_url: cleanUrl(form.spotifyUrl),
        feed_video_url: cleanUrl(form.feedVideoUrl),
      })
      .eq('id', id)

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    // Delete removed tiers from database
    for (const tierId of deletedTierIds) {
      await supabase.from('ticket_tiers').delete().eq('id', tierId)
    }

    // Update or insert tiers
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
    router.push('/host')
  }

  if (loading) return (
    <div style={{background: COLORS.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#665', fontFamily: 'DM Sans,sans-serif'}}>
      Loading event...
    </div>
  )

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { background:${COLORS.bg}; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:680px; margin:0 auto; padding:0 20px 100px; }
        nav { padding:14px 20px; background:rgba(0,0,0,0.95); position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
        nav::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,${COLORS.accent},${COLORS.primary},#ffc850,transparent); background-size:300% 100%; animation:navPulse 5s ease-in-out infinite; }
        @keyframes navPulse { 0%{background-position:0% 50%;opacity:0.2} 50%{background-position:100% 50%;opacity:0.8} 100%{background-position:0% 50%;opacity:0.2} }
        .logo { font-family:'Nunito',sans-serif; font-size:26px; font-weight:900; letter-spacing:-0.5px; color:${COLORS.primary}; cursor:pointer; line-height:1; text-transform:lowercase; filter:drop-shadow(0 0 10px rgba(255,170,51,0.3)); background:none; border:none; padding:0; }
        .back { font-size:13px; color:#665; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; transition:color 0.15s; display:inline-flex; align-items:center; gap:4px; }
        .back:hover { color:#f0f0f0; }
        .page-title { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:clamp(36px,8vw,56px); letter-spacing:1px; color:#fff; padding:36px 0 6px; text-transform:uppercase; }
        .page-sub { font-size:14px; color:#999; margin-bottom:32px; line-height:1.5; }
        .steps { display:flex; gap:6px; margin-bottom:6px; }
        .step-dot { flex:1; height:3px; border-radius:100px; background:rgba(255,255,255,0.08); transition:background 0.3s; }
        .step-dot.done { background:${COLORS.primary}; }
        .step-dot.active { background:rgba(255,170,51,0.4); animation:stepPulse 2s ease-in-out infinite; }
        @keyframes stepPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
        .step-label { font-size:12px; color:#888; margin-bottom:28px; }
        .section { margin-bottom:28px; }
        .section-title { font-size:10px; color:#888; letter-spacing:1px; text-transform:uppercase; margin-bottom:14px; padding-bottom:8px; border-bottom:0.5px solid rgba(255,255,255,0.1); }
        .field { margin-bottom:14px; }
        .label { font-size:11px; color:#aaa; margin-bottom:5px; display:block; letter-spacing:0.4px; text-transform:uppercase; font-weight:500; }
        .input { width:100%; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.15); border-radius:10px; padding:12px 14px; color:#fff; font-size:15px; font-family:'DM Sans',sans-serif; outline:none; transition:border-color 0.15s; -webkit-appearance:none; }
        .input:focus { border-color:rgba(255,170,51,0.5); background:rgba(255,255,255,0.08); }
        .input::placeholder { color:#555; }
        textarea.input { min-height:100px; resize:vertical; }
        .row-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
        .select { width:100%; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.15); border-radius:10px; padding:12px 14px; color:#fff; font-size:15px; font-family:'DM Sans',sans-serif; outline:none; cursor:pointer; -webkit-appearance:none; }
        .toggle-row { display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.1); border-radius:10px; padding:14px; margin-bottom:12px; cursor:pointer; transition:border-color 0.15s; }
        .toggle-row:active { border-color:rgba(255,170,51,0.3); }
        .toggle-label { font-size:14px; color:#fff; font-weight:500; }
        .toggle-sub { font-size:12px; color:#999; margin-top:2px; }
        .toggle { width:36px; height:20px; border-radius:100px; border:none; cursor:pointer; transition:background 0.2s; flex-shrink:0; }
        .toggle.on { background:${COLORS.primary}; }
        .toggle.off { background:rgba(255,255,255,0.15); }
        .tier-card { background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.1); border-radius:12px; padding:16px; margin-bottom:10px; }
        .tier-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .tier-num { font-size:11px; color:#888; letter-spacing:0.5px; text-transform:uppercase; font-weight:500; }
        .remove-btn { font-size:12px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; transition:color 0.15s; display:inline-flex; align-items:center; gap:4px; }
        .remove-btn:hover { color:#ff8888; }
        .add-btn { width:100%; background:transparent; border:0.5px dashed rgba(255,255,255,0.2); border-radius:10px; padding:12px; font-size:13px; color:#888; cursor:pointer; font-family:'DM Sans',sans-serif; margin-top:4px; transition:all 0.15s; display:inline-flex; align-items:center; justify-content:center; gap:6px; font-weight:500; }
        .add-btn:active { border-color:rgba(255,255,255,0.4); color:#aaa; }
        .social-intro { background:rgba(255,170,51,0.05); border:0.5px solid rgba(255,170,51,0.18); border-radius:12px; padding:16px; margin-bottom:20px; }
        .social-intro-title { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:900; color:${COLORS.primary}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
        .social-intro-text { font-size:13px; color:#999; line-height:1.5; }
        .powers { font-size:11px; color:${COLORS.primary}; opacity:0.8; margin-top:3px; font-style:italic; }
        .input-prefix-wrap { position:relative; display:flex; align-items:center; }
        .input-prefix { position:absolute; left:14px; color:#666; font-size:15px; pointer-events:none; }
        .input.has-prefix { padding-left:30px; }
        .nav-btns { display:flex; gap:10px; margin-top:40px; padding-top:20px; border-top:0.5px solid rgba(255,255,255,0.08); }
        .prev-btn { background:transparent; border:0.5px solid rgba(255,255,255,0.2); color:#aaa; font-size:14px; font-family:'DM Sans',sans-serif; padding:13px 20px; border-radius:100px; cursor:pointer; transition:all 0.15s; display:inline-flex; align-items:center; gap:6px; font-weight:500; }
        .prev-btn:active { color:#fff; }
        .save-btn { flex:1; background:${COLORS.primary}; color:#000; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; box-shadow:0 0 20px rgba(255,170,51,0.3); transition:all 0.15s; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
        .save-btn:disabled { opacity:0.4; cursor:not-allowed; box-shadow:none; }
        .save-btn:active:not(:disabled) { transform:scale(0.98); }
        .next-btn { flex:1; background:${COLORS.primary}; color:#000; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; box-shadow:0 0 20px rgba(255,170,51,0.3); transition:all 0.15s; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
        .next-btn:active { transform:scale(0.98); opacity:0.9; }
        .delete-btn { width:100%; background:transparent; border:0.5px solid rgba(255,80,80,0.2); color:#ff6666; font-size:13px; font-family:'DM Sans',sans-serif; padding:12px; border-radius:10px; cursor:pointer; margin-top:20px; transition:all 0.15s; }
        .delete-btn:hover { background:rgba(255,80,80,0.08); border-color:rgba(255,80,80,0.4); }
      `}</style>

      <nav>
        <button className="back" onClick={() => router.push('/host')}>
          <i className="ti ti-arrow-left" style={{fontSize:'14px'}} aria-hidden="true"/>
          Dashboard
        </button>
        <button className="logo" onClick={() => router.push('/')}><img src="/pulse-word.png" alt="pulse" style={{height:'26px',width:'auto',display:'block'}}/></button>
        <div style={{width: '80px'}} />
      </nav>

      <div className="wrap">
        <h1 className="page-title">Edit event</h1>
        <p className="page-sub">Update your event details below.</p>

        <div className="steps">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`step-dot ${s < step ? 'done' : s === step ? 'active' : ''}`}/>
          ))}
        </div>
        <p className="step-label">Step {step} of 5</p>

        {step === 1 && (
          <div className="section">
            <div className="section-title">Basic info</div>
            <div className="field">
              <label className="label">Event name</label>
              <input className="input" placeholder="Event name" value={form.title} onChange={e => update('title', e.target.value)}/>
            </div>
            <div className="field">
              <label className="label">Tagline (optional)</label>
              <input className="input" placeholder="e.g. 5 rounds. No rules. Pure energy." value={form.tagline} onChange={e => update('tagline', e.target.value)} maxLength={80}/>
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
            <div className="section-title" style={{marginTop: '20px'}}>Date & time</div>
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
            <div className="section-title" style={{marginTop: '24px'}}>Rules & restrictions</div>
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
              <div key={tier.id || i} className="tier-card">
                <div className="tier-header">
                  <span className="tier-num">Tier {i + 1}</span>
                  {form.tiers.length > 1 && (
                    <button className="remove-btn" onClick={() => removeTier(i)}>
                      <i className="ti ti-x" style={{fontSize: '12px'}} aria-hidden="true"/>
                      Remove
                    </button>
                  )}
                </div>
                <div className="field">
                  <label className="label">Tier name</label>
                  <select
                    className="select"
                    value={tier.name}
                    onChange={e => updateTier(i, 'name', e.target.value)}
                  >
                    <option value="">Select tier type...</option>
                    <option value="GA">GA</option>
                    <option value="GA 2">GA 2</option>
                    <option value="GA 3">GA 3</option>
                    <option value="Early Bird">Early Bird</option>
                    <option value="VIP">VIP</option>
                    <option value="VIP Table">VIP Table</option>
                    <option value="Presale">Presale</option>
                    <option value="Door">Door</option>
                  </select>
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
            <button
              className="add-btn"
              onClick={() => setForm(f => ({ ...f, tiers: [...f.tiers, { id: '', name: '', price: '', quantity: '' }] }))}
            >
              <i className="ti ti-plus" style={{fontSize: '14px'}} aria-hidden="true"/>
              Add another tier
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
                    <button
                      className="remove-btn"
                      onClick={() => setForm(f => ({ ...f, lineup: f.lineup.filter((_, j) => j !== i) }))}
                    >
                      <i className="ti ti-x" style={{fontSize: '12px'}} aria-hidden="true"/>
                      Remove
                    </button>
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
            <button
              className="add-btn"
              onClick={() => setForm(f => ({ ...f, lineup: [...f.lineup, { name: '', role: '', time: '' }] }))}
            >
              <i className="ti ti-plus" style={{fontSize: '14px'}} aria-hidden="true"/>
              Add performer
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="section">
            <div className="social-intro">
              <div className="social-intro-title">Make it come alive</div>
              <div className="social-intro-text">
                Add your socials so people can feel the vibe before they buy. Every field is optional — but the more you add, the harder your page hits. All of this shows up on your event page and in the Discover feed.
              </div>
            </div>

            <div className="section-title">The Vibe · Instagram</div>
            <div className="field">
              <label className="label">Instagram handle</label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">@</span>
                <input
                  className="input has-prefix"
                  placeholder="yourhandle"
                  value={form.instagramHandle}
                  onChange={e => update('instagramHandle', e.target.value)}
                />
              </div>
              <div className="powers">Powers the Instagram preview on your page</div>
            </div>

            <div className="section-title" style={{marginTop: '24px'}}>The Energy · TikTok</div>
            <div className="field">
              <label className="label">TikTok profile or video URL</label>
              <input
                className="input"
                placeholder="tiktok.com/@yourhandle"
                value={form.tiktokUrl}
                onChange={e => update('tiktokUrl', e.target.value)}
              />
              <div className="powers">Powers the TikTok energy section</div>
            </div>

            <div className="section-title" style={{marginTop: '24px'}}>The Sound · Spotify</div>
            <div className="field">
              <label className="label">Spotify playlist, artist, or track URL</label>
              <input
                className="input"
                placeholder="open.spotify.com/playlist/..."
                value={form.spotifyUrl}
                onChange={e => update('spotifyUrl', e.target.value)}
              />
              <div className="powers">Plays 30-second previews right on your page</div>
            </div>

            <div className="section-title" style={{marginTop: '24px'}}>Feed video (optional)</div>
            <div className="field">
              <label className="label">Looping video URL for the Discover feed</label>
              <input
                className="input"
                placeholder="Link to a short looping clip (plays muted)"
                value={form.feedVideoUrl}
                onChange={e => update('feedVideoUrl', e.target.value)}
              />
              <div className="powers">If empty, your cover image is used instead</div>
            </div>
          </div>
        )}

        <div className="nav-btns">
          {step > 1 && (
            <button className="prev-btn" onClick={() => setStep(s => s - 1)}>
              <i className="ti ti-arrow-left" style={{fontSize: '14px'}} aria-hidden="true"/>
              Back
            </button>
          )}
          {step < 5 ? (
            <button className="next-btn" onClick={() => setStep(s => s + 1)}>
              Continue
              <i className="ti ti-arrow-right" style={{fontSize: '14px'}} aria-hidden="true"/>
            </button>
          ) : (
            <button className="save-btn" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving...' : (
                <>
                  <i className="ti ti-check" style={{fontSize: '16px'}} aria-hidden="true"/>
                  Save changes
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}