'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type Crew = {
  id: string
  name: string
  avatar: string
  created_at: string
  last_message?: string
  last_message_at?: string
  member_count?: number
}

type WhisperThread = {
  user_id: string
  user_name: string
  user_avatar: string
  event_id: string
  event_title: string
  last_message: string
  last_message_at: string
  expires_at: string
}

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
} as const

export default function ConnectPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<'crews' | 'whispers'>('crews')
  const [crews, setCrews] = useState<Crew[]>([])
  const [whispers, setWhispers] = useState<WhisperThread[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCrewName, setNewCrewName] = useState('')
  const [newCrewAvatar, setNewCrewAvatar] = useState('⚡')
  const [creating, setCreating] = useState(false)
  const [showAvatarDrop, setShowAvatarDrop] = useState(false)

  const crewAvatars = ['⚡', '🔥', '💀', '👽', '😈', '👑', '💎', '🌙', '🖤', '🎧', '🎭', '🍾']

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Fetch crews
      const { data: memberRows } = await supabase
        .from('crew_members')
        .select('crew_id')
        .eq('user_id', user.id)

      if (memberRows && memberRows.length > 0) {
        const crewIds = memberRows.map(m => m.crew_id)
        const { data: crewData } = await supabase
          .from('crews')
          .select('*')
          .in('id', crewIds)
          .order('created_at', { ascending: false })

        if (crewData) {
          const crewsWithInfo = await Promise.all(
            crewData.map(async (crew: any) => {
              const { count } = await supabase
                .from('crew_members')
                .select('*', { count: 'exact', head: true })
                .eq('crew_id', crew.id)

              const { data: lastMsg } = await supabase
                .from('crew_messages')
                .select('content, created_at')
                .eq('crew_id', crew.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

              return {
                ...crew,
                member_count: count ?? 0,
                last_message: lastMsg?.content,
                last_message_at: lastMsg?.created_at,
              }
            }),
          )
          setCrews(crewsWithInfo)
        }
      }

      // Fetch whisper threads
      const { data: whisperData } = await supabase
        .from('whispers')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (whisperData) {
        const threads = new Map<string, WhisperThread>()
        for (const w of whisperData as any[]) {
          const otherId = w.sender_id === user.id ? w.receiver_id : w.sender_id
          const otherName = w.sender_id === user.id ? 'You' : w.sender_name
          const key = `${otherId}-${w.event_id}`
          if (!threads.has(key)) {
            threads.set(key, {
              user_id: otherId,
              user_name: w.sender_id === user.id ? w.receiver_name ?? 'User' : w.sender_name,
              user_avatar: w.sender_avatar ?? '🔥',
              event_id: w.event_id,
              event_title: '',
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
      .from('crews')
      .insert({
        name: newCrewName.trim(),
        created_by: user.id,
        avatar: newCrewAvatar,
      })
      .select()
      .single()

    if (!error && crew) {
      const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Anonymous'
      await supabase.from('crew_members').insert({
        crew_id: crew.id,
        user_id: user.id,
        role: 'owner',
        user_name: userName,
      })
      setCrews(prev => [{ ...crew, member_count: 1 }, ...prev])
      setNewCrewName('')
      setShowCreate(false)
    }
    setCreating(false)
  }

  if (loading) {
    return (
      <>
        <style>{`body{background:#000;margin:0;}`}</style>
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:'28px',height:'28px',border:`2px solid ${COLORS.primary}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </>
    )
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'DM Sans',sans-serif;}

        nav{padding:14px 20px;background:rgba(0,0,0,0.95);position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:14px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
        nav::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${COLORS.accent},${COLORS.primary},${COLORS.highlight},transparent);background-size:300% 100%;animation:navGlow 5s ease-in-out infinite;}
        @keyframes navGlow{0%{background-position:0% 50%;opacity:0.2}50%{background-position:100% 50%;opacity:0.8}100%{background-position:0% 50%;opacity:0.2}}
        .back-btn{background:none;border:none;color:#665;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:4px;transition:color 0.15s;}
        .back-btn:hover{color:#f0f0f0;}
        .nav-logo{cursor:pointer;background:none;border:none;padding:0;line-height:0;display:inline-flex;}
        .logo-img{height:22px;width:auto;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        @media(max-width:680px){.logo-img{height:20px;}}

        .wrap{max-width:600px;margin:0 auto;padding:0 20px 100px;}
        .page-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:42px;letter-spacing:1px;color:#fff;padding:36px 0 6px;text-transform:uppercase;}
        .page-sub{font-size:14px;color:#665;margin-bottom:28px;}

        .tabs{display:flex;gap:0;margin-bottom:28px;border-bottom:0.5px solid rgba(255,255,255,0.06);}
        .tab{flex:1;padding:14px 0;text-align:center;font-size:14px;font-weight:600;color:#554;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;font-family:'DM Sans',sans-serif;}
        .tab:hover{color:#aaa;}
        .tab.active{color:${COLORS.primary};border-bottom-color:${COLORS.primary};}

        .create-btn{width:100%;background:transparent;border:0.5px dashed rgba(255,170,51,0.25);border-radius:14px;padding:18px;font-size:14px;color:${COLORS.primary};cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:500;margin-bottom:16px;}
        .create-btn:hover{background:rgba(255,170,51,0.04);border-color:rgba(255,170,51,0.4);}

        .create-form{background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:20px;}
        .create-row{display:flex;gap:10px;align-items:center;margin-bottom:14px;}
        .crew-avatar-btn{width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,170,51,0.25);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;transition:all 0.15s;flex-shrink:0;position:relative;}
        .crew-avatar-btn:hover{border-color:rgba(255,170,51,0.5);}
        .crew-avatar-dropdown{position:absolute;top:52px;left:0;background:#1a0f00;border:0.5px solid rgba(255,170,51,0.25);border-radius:12px;padding:8px;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,0.8);}
        .crew-av-opt{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;border:1px solid transparent;transition:all 0.1s;}
        .crew-av-opt:hover{background:rgba(255,255,255,0.05);}
        .crew-av-opt.sel{border-color:${COLORS.primary};background:rgba(255,170,51,0.1);}
        .crew-name-input{flex:1;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.12);border-radius:10px;padding:12px 14px;color:#fff;font-size:15px;font-family:'DM Sans',sans-serif;outline:none;}
        .crew-name-input:focus{border-color:rgba(255,170,51,0.4);}
        .crew-name-input::placeholder{color:#444;}
        .create-actions{display:flex;gap:8px;justify-content:flex-end;}
        .create-cancel{background:none;border:0.5px solid rgba(255,255,255,0.1);color:#888;padding:10px 20px;border-radius:100px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;}
        .create-submit{background:${COLORS.primary};color:#000;border:none;padding:10px 24px;border-radius:100px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;}
        .create-submit:disabled{opacity:0.3;cursor:not-allowed;}

        .thread-card{display:flex;align-items:center;gap:14px;padding:16px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.06);border-radius:14px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;}
        .thread-card:hover{border-color:rgba(255,170,51,0.2);background:rgba(255,255,255,0.04);transform:translateY(-1px);}
        .thread-card:active{transform:scale(0.98);}
        .thread-avatar{width:48px;height:48px;border-radius:14px;background:rgba(255,170,51,0.08);border:0.5px solid rgba(255,170,51,0.15);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;}
        .thread-info{flex:1;min-width:0;}
        .thread-name{font-size:15px;font-weight:600;color:#f0f0f0;margin-bottom:2px;}
        .thread-preview{font-size:13px;color:#554;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .thread-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;}
        .thread-time{font-size:11px;color:#443;}
        .thread-count{font-size:11px;color:#665;background:rgba(255,255,255,0.04);padding:2px 8px;border-radius:100px;}
        .thread-expires{font-size:10px;color:#ff6600;}

        .empty{text-align:center;padding:48px 20px;}
        .empty-icon{font-size:36px;opacity:0.2;margin-bottom:12px;}
        .empty-text{font-size:14px;color:#554;margin-bottom:6px;}
        .empty-sub{font-size:12px;color:#332;}
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.push('/account')}>
          <i className="ti ti-arrow-left" style={{fontSize:'15px'}} aria-hidden="true"/>
          Account
        </button>
        <button className="nav-logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
      </nav>

      <div className="wrap">
        <h1 className="page-title">Connect</h1>
        <p className="page-sub">Your crews and conversations</p>

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
                <div className="create-row">
                  <div className="crew-avatar-btn" onClick={() => setShowAvatarDrop(!showAvatarDrop)}>
                    {newCrewAvatar}
                    {showAvatarDrop && (
                      <div className="crew-avatar-dropdown" onClick={e => e.stopPropagation()}>
                        {crewAvatars.map(av => (
                          <div
                            key={av}
                            className={`crew-av-opt ${newCrewAvatar === av ? 'sel' : ''}`}
                            onClick={() => {
                              setNewCrewAvatar(av)
                              setShowAvatarDrop(false)
                            }}
                          >
                            {av}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    className="crew-name-input"
                    placeholder="Crew name (e.g. Friday Night Squad)"
                    value={newCrewName}
                    onChange={e => setNewCrewName(e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div className="create-actions">
                  <button className="create-cancel" onClick={() => { setShowCreate(false); setNewCrewName('') }}>Cancel</button>
                  <button className="create-submit" disabled={!newCrewName.trim() || creating} onClick={handleCreateCrew}>
                    {creating ? 'Creating...' : 'Create crew'}
                  </button>
                </div>
              </div>
            ) : (
              <button className="create-btn" onClick={() => setShowCreate(true)}>
                <i className="ti ti-plus" style={{fontSize:'16px'}} aria-hidden="true"/>
                Create a crew
              </button>
            )}

            {crews.length === 0 && !showCreate ? (
              <div className="empty">
                <div className="empty-icon">⚡</div>
                <div className="empty-text">No crews yet</div>
                <div className="empty-sub">Create one and invite your squad</div>
              </div>
            ) : (
              crews.map(crew => {
                const timeAgo = crew.last_message_at
                  ? (() => {
                      const diff = Date.now() - new Date(crew.last_message_at).getTime()
                      const mins = Math.floor(diff / 60000)
                      if (mins < 1) return 'now'
                      if (mins < 60) return `${mins}m`
                      const hrs = Math.floor(mins / 60)
                      if (hrs < 24) return `${hrs}h`
                      return `${Math.floor(hrs / 24)}d`
                    })()
                  : ''
                return (
                  <div key={crew.id} className="thread-card" onClick={() => router.push(`/connect/crew/${crew.id}`)}>
                    <div className="thread-avatar">{crew.avatar}</div>
                    <div className="thread-info">
                      <div className="thread-name">{crew.name}</div>
                      <div className="thread-preview">{crew.last_message ?? 'No messages yet'}</div>
                    </div>
                    <div className="thread-meta">
                      {timeAgo && <span className="thread-time">{timeAgo}</span>}
                      <span className="thread-count">{crew.member_count} members</span>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {tab === 'whispers' && (
          <>
            {whispers.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🤫</div>
                <div className="empty-text">No whispers yet</div>
                <div className="empty-sub">Tap someone's name in the Lounge to start a whisper</div>
              </div>
            ) : (
              whispers.map((w, i) => {
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(w.last_message_at).getTime()
                  const mins = Math.floor(diff / 60000)
                  if (mins < 1) return 'now'
                  if (mins < 60) return `${mins}m`
                  const hrs = Math.floor(mins / 60)
                  if (hrs < 24) return `${hrs}h`
                  return `${Math.floor(hrs / 24)}d`
                })()
                const expiresIn = (() => {
                  const diff = new Date(w.expires_at).getTime() - Date.now()
                  const hrs = Math.floor(diff / 3600000)
                  if (hrs < 1) return 'expiring soon'
                  return `${hrs}h left`
                })()
                return (
                  <div key={i} className="thread-card" onClick={() => router.push(`/connect/whisper/${w.user_id}?event=${w.event_id}`)}>
                    <div className="thread-avatar" style={{background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)'}}>
                      {w.user_avatar}
                    </div>
                    <div className="thread-info">
                      <div className="thread-name">{w.user_name}</div>
                      <div className="thread-preview">{w.last_message}</div>
                    </div>
                    <div className="thread-meta">
                      <span className="thread-time">{timeAgo}</span>
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