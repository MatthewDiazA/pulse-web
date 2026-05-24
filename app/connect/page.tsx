'use client'
import { useEffect, useState } from 'react'
import { useNavLogo } from '../lib/animations'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import TouchBlot from '../components/TouchBlot'

type Crew = {
  id: string
  name: string
  created_at: string
  last_message?: string
  last_message_at?: string
  member_count?: number
}

type WhisperThread = {
  user_id: string
  user_name: string
  event_id: string
  last_message: string
  last_message_at: string
  expires_at: string
}

const COLORS = { primary: '#ffaa33', accent: '#ff6600', highlight: '#ffc850', bg: '#000' } as const

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function ConnectPage() {
  const router = useRouter()
  const logoRef = useNavLogo<HTMLButtonElement>()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<'crews' | 'whispers'>('crews')
  const [crews, setCrews] = useState<Crew[]>([])
  const [whispers, setWhispers] = useState<WhisperThread[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCrewName, setNewCrewName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: memberRows } = await supabase
        .from('crew_members').select('crew_id').eq('user_id', user.id)

      if (memberRows && memberRows.length > 0) {
        const crewIds = memberRows.map(m => m.crew_id)
        const { data: crewData } = await supabase
          .from('crews').select('*').in('id', crewIds).order('created_at', { ascending: false })

        if (crewData) {
          const crewsWithInfo = await Promise.all(
            crewData.map(async (crew: any) => {
              const { count } = await supabase
                .from('crew_members').select('*', { count: 'exact', head: true }).eq('crew_id', crew.id)
              const { data: lastMsg } = await supabase
                .from('crew_messages').select('content, created_at').eq('crew_id', crew.id)
                .order('created_at', { ascending: false }).limit(1).single()
              return { ...crew, member_count: count ?? 0, last_message: lastMsg?.content, last_message_at: lastMsg?.created_at }
            })
          )
          setCrews(crewsWithInfo)
        }
      }

      const { data: whisperData } = await supabase
        .from('whispers').select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (whisperData) {
        const threads = new Map<string, WhisperThread>()
        for (const w of whisperData as any[]) {
          const otherId = w.sender_id === user.id ? w.receiver_id : w.sender_id
          const key = `${otherId}-${w.event_id}`
          if (!threads.has(key)) {
            threads.set(key, {
              user_id: otherId,
              user_name: w.sender_id === user.id ? w.receiver_name ?? 'User' : w.sender_name,
              event_id: w.event_id,
              last_message: w.content,
              last_message_at: w.created_at,
              expires_at: w.expires_at,
            })
          }
        }
        setWhispers(Array.from(threads.values()))
      }

      setLoading(false)
    }
    load()
  }, [router])

  const handleCreateCrew = async () => {
    if (!newCrewName.trim() || creating) return
    setCreating(true)
    const supabase = createClient()
    const { data: crew, error } = await supabase
      .from('crews').insert({ name: newCrewName.trim(), created_by: user.id }).select().single()
    if (!error && crew) {
      const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Anonymous'
      await supabase.from('crew_members').insert({ crew_id: crew.id, user_id: user.id, role: 'owner', user_name: userName })
      setCrews(prev => [{ ...crew, member_count: 1 }, ...prev])
      setNewCrewName('')
      setShowCreate(false)
    }
    setCreating(false)
  }

  if (loading) return (
    <>
      <style>{`body{background:#000;margin:0;}`}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:'28px',height:'28px',border:`2px solid ${COLORS.primary}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  )

  return (
    <>
      <TouchBlot intensity={0.5} />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'Syne',sans-serif;}

        /* Acid background */
        .acid{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
        .acid::before{content:'';position:absolute;width:60vmax;height:60vmax;border-radius:50%;background:radial-gradient(circle,rgba(255,102,0,0.10) 0%,rgba(232,0,29,0.05) 45%,transparent 70%);bottom:-10vmax;left:-15vmax;animation:acidA 20s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(50px);}
        .acid::after{content:'';position:absolute;width:50vmax;height:50vmax;border-radius:50%;background:radial-gradient(circle,rgba(192,26,111,0.08) 0%,transparent 65%);top:20%;right:-10vmax;animation:acidB 24s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(55px);}
        @keyframes acidA{0%{transform:translate(0,0)}100%{transform:translate(8vw,-6vh)}}
        @keyframes acidB{0%{transform:translate(0,0)}100%{transform:translate(-6vw,8vh)}}

        nav{padding:14px 24px;background:rgba(0,0,0,0.8);position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:0.5px solid rgba(255,255,255,0.05);}
        .logo{background:none;border:none;padding:0;cursor:pointer;line-height:0;display:inline-flex;}
        .logo-img{height:22px;width:auto;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        @media(max-width:680px){.logo-img{height:20px;}}
        .nav-back{background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;font-family:'Syne',sans-serif;display:inline-flex;align-items:center;gap:5px;transition:color 0.15s;}
        .nav-back:hover{color:#f0f0f0;}

        .wrap{max-width:560px;margin:0 auto;padding:40px 24px 100px;position:relative;z-index:1;}

        /* Section label — font E */
        .section-label{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:3px;text-transform:uppercase;margin-bottom:24px;}

        /* Tabs */
        .tabs{display:flex;gap:0;margin-bottom:32px;border-bottom:0.5px solid rgba(255,255,255,0.06);}
        .tab{flex:1;padding:12px 0;text-align:center;font-size:13px;font-weight:600;color:rgba(255,255,255,0.3);cursor:pointer;transition:all 0.2s;border-bottom:1.5px solid transparent;font-family:'Syne',sans-serif;letter-spacing:0.5px;}
        .tab.active{color:#fff;border-bottom-color:${COLORS.primary};}
        .tab:hover:not(.active){color:rgba(255,255,255,0.6);}

        /* Thread cards */
        .thread-card{display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:all 0.2s;}
        .thread-card:hover{border-color:rgba(255,170,51,0.18);background:rgba(255,255,255,0.04);}
        .thread-card:active{transform:scale(0.99);}

        /* Avatar — initials based, no emoji */
        .av{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;font-family:'Syne',sans-serif;flex-shrink:0;letter-spacing:0.5px;}
        .av-crew{background:rgba(255,170,51,0.1);color:${COLORS.primary};border:0.5px solid rgba(255,170,51,0.2);}
        .av-whisper{background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);border:0.5px solid rgba(255,255,255,0.08);}

        .thread-info{flex:1;min-width:0;}
        .thread-name{font-size:14px;font-weight:600;color:#f0f0f0;margin-bottom:3px;}
        .thread-preview{font-size:12px;color:rgba(255,255,255,0.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .thread-meta{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;}
        .thread-time{font-size:11px;color:rgba(255,255,255,0.25);}
        .thread-badge{font-size:10px;color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.04);padding:2px 8px;border-radius:100px;white-space:nowrap;}
        .thread-expires{font-size:10px;color:rgba(255,102,0,0.8);}

        /* Create crew */
        .create-trigger{width:100%;background:transparent;border:0.5px dashed rgba(255,255,255,0.12);border-radius:12px;padding:16px;font-size:13px;color:rgba(255,255,255,0.4);cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:500;margin-bottom:16px;letter-spacing:0.3px;}
        .create-trigger:hover{border-color:rgba(255,170,51,0.3);color:${COLORS.primary};}
        .create-form{background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;margin-bottom:16px;}
        .crew-input{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px 14px;color:#fff;font-size:14px;font-family:'Syne',sans-serif;outline:none;margin-bottom:14px;}
        .crew-input:focus{border-color:rgba(255,170,51,0.35);}
        .crew-input::placeholder{color:rgba(255,255,255,0.2);}
        .form-actions{display:flex;gap:8px;justify-content:flex-end;}
        .btn-cancel{background:none;border:0.5px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);padding:9px 18px;border-radius:8px;font-size:13px;cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.15s;}
        .btn-cancel:hover{color:#fff;}
        .btn-create{background:${COLORS.primary};color:#000;border:none;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;transition:background 0.15s;}
        .btn-create:hover{background:#ffc040;}
        .btn-create:disabled{opacity:0.3;cursor:not-allowed;}

        /* Empty */
        .empty{text-align:center;padding:60px 20px;}
        .empty-icon{width:48px;height:48px;border-radius:14px;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:20px;color:rgba(255,255,255,0.2);}
        .empty-title{font-size:14px;color:rgba(255,255,255,0.4);font-weight:500;margin-bottom:4px;}
        .empty-sub{font-size:12px;color:rgba(255,255,255,0.2);}

        @media(prefers-reduced-motion:reduce){.acid::before,.acid::after{animation:none!important;}}
      `}</style>

      <div className="acid" aria-hidden="true"/>

      <nav>
        <button className="nav-back" onClick={() => router.push('/account')}>
          <i className="ti ti-arrow-left" style={{fontSize:'14px'}} aria-hidden="true"/>
          Account
        </button>
        <button ref={logoRef} className="logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        <div style={{width:'60px'}}/>
      </nav>

      <div className="wrap">
        <div className="tabs">
          <div className={`tab ${tab === 'crews' ? 'active' : ''}`} onClick={() => setTab('crews')}>
            Crews
          </div>
          <div className={`tab ${tab === 'whispers' ? 'active' : ''}`} onClick={() => setTab('whispers')}>
            Whispers
          </div>
        </div>

        {tab === 'crews' && (
          <>
            {showCreate ? (
              <div className="create-form">
                <input
                  className="crew-input"
                  placeholder="Name your crew"
                  value={newCrewName}
                  onChange={e => setNewCrewName(e.target.value)}
                  maxLength={40}
                  autoFocus
                />
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => { setShowCreate(false); setNewCrewName('') }}>Cancel</button>
                  <button className="btn-create" disabled={!newCrewName.trim() || creating} onClick={handleCreateCrew}>
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="create-trigger" onClick={() => setShowCreate(true)}>
                <i className="ti ti-plus" style={{fontSize:'15px'}} aria-hidden="true"/>
                New crew
              </button>
            )}

            {crews.length === 0 && !showCreate ? (
              <div className="empty">
                <div className="empty-icon"><i className="ti ti-users" aria-hidden="true"/></div>
                <div className="empty-title">No crews yet</div>
                <div className="empty-sub">Create one and invite your people</div>
              </div>
            ) : (
              crews.map(crew => (
                <div key={crew.id} className="thread-card" onClick={() => router.push(`/connect/crew/${crew.id}`)}>
                  <div className="av av-crew">{initials(crew.name)}</div>
                  <div className="thread-info">
                    <div className="thread-name">{crew.name}</div>
                    <div className="thread-preview">{crew.last_message ?? 'No messages yet'}</div>
                  </div>
                  <div className="thread-meta">
                    {crew.last_message_at && <span className="thread-time">{timeAgo(crew.last_message_at)}</span>}
                    <span className="thread-badge">{crew.member_count} members</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'whispers' && (
          <>
            {whispers.length === 0 ? (
              <div className="empty">
                <div className="empty-icon"><i className="ti ti-message-circle" aria-hidden="true"/></div>
                <div className="empty-title">No whispers yet</div>
                <div className="empty-sub">Tap someone's name in the Lounge to start one</div>
              </div>
            ) : (
              whispers.map((w, i) => {
                const expiresIn = (() => {
                  const diff = new Date(w.expires_at).getTime() - Date.now()
                  const hrs = Math.floor(diff / 3600000)
                  if (hrs < 1) return 'expiring soon'
                  return `${hrs}h left`
                })()
                return (
                  <div key={i} className="thread-card" onClick={() => router.push(`/connect/whisper/${w.user_id}?event=${w.event_id}`)}>
                    <div className="av av-whisper">{initials(w.user_name)}</div>
                    <div className="thread-info">
                      <div className="thread-name">{w.user_name}</div>
                      <div className="thread-preview">{w.last_message}</div>
                    </div>
                    <div className="thread-meta">
                      <span className="thread-time">{timeAgo(w.last_message_at)}</span>
                      <span className="thread-expires">{expiresIn}</span>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </>
  )
}