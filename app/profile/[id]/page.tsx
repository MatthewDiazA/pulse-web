'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
} as const

type TicketEvent = {
  id: string
  title: string
  starts_at: string | null
  venue_name: string | null
  city: string | null
  cover_image_url: string | null
  category: string
}

export default function PublicProfile() {
  const router = useRouter()
  const params = useParams()
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null)
  const [events, setEvents] = useState<TicketEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const userId = params.id as string

      // Get user's tickets with event details
      const { data: tickets } = await supabase
        .from('tickets')
        .select('event_id, event:events(id, title, starts_at, venue_name, city, cover_image_url, category)')
        .eq('user_id', userId)

      // Get user's comments to find their name
      const { data: comments } = await supabase
        .from('comments')
        .select('user_name, user_avatar')
        .eq('user_id', userId)
        .limit(1)

      const userName = comments?.[0]?.user_name ?? 'User'

      setProfile({ name: userName, email: '' })

      // Deduplicate events
      const seen = new Set<string>()
      const uniqueEvents: TicketEvent[] = []
      for (const t of tickets ?? []) {
        const ev = t.event as unknown as TicketEvent
        if (ev && !seen.has(ev.id)) {
          seen.add(ev.id)
          uniqueEvents.push(ev)
        }
      }
      setEvents(uniqueEvents)
      setLoading(false)
    }
    fetchProfile()
  }, [params.id])

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
        .wrap{max-width:800px;margin:0 auto;padding:40px 20px 100px;}
        .profile-header{text-align:center;padding:40px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);margin-bottom:40px;}
        .profile-avatar{width:80px;height:80px;border-radius:50%;background:rgba(255,170,51,0.12);border:2px solid rgba(255,170,51,0.3);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:${COLORS.primary};margin:0 auto 16px;font-family:'Barlow Condensed',sans-serif;}
        .profile-name{font-family:'Barlow Condensed',sans-serif;font-size:42px;font-weight:900;text-transform:uppercase;color:#fff;margin-bottom:6px;}
        .profile-stat{font-size:14px;color:#665;}
        .section-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#fff;margin-bottom:20px;}
        .events-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
        @media(min-width:600px){.events-grid{grid-template-columns:repeat(3,1fr);gap:16px;}}
        .event-card{border-radius:14px;cursor:pointer;position:relative;overflow:hidden;aspect-ratio:2/3;background:#0d0800;transition:all 0.2s;}
        .event-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,0.6);}
        .event-card:active{transform:scale(0.96);}
        .card-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
        .card-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.2) 55%,transparent 100%);}
        .card-placeholder{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,rgba(255,170,51,0.08) 0%,#0d0800 70%);}
        .card-content{position:absolute;bottom:0;left:0;right:0;padding:14px;}
        .card-date{font-size:10px;color:rgba(255,255,255,0.45);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:4px;}
        .card-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:#fff;text-transform:uppercase;line-height:1;margin-bottom:4px;}
        .card-venue{font-size:11px;color:rgba(255,255,255,0.4);}
        .card-badge{position:absolute;top:10px;left:10px;font-size:9px;font-weight:600;padding:3px 8px;border-radius:100px;letter-spacing:0.6px;text-transform:uppercase;background:rgba(255,170,51,0.12);color:${COLORS.primary};border:0.5px solid rgba(255,170,51,0.25);}
        .empty{text-align:center;padding:48px 20px;color:#554;font-size:14px;}
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.back()}>
          <i className="ti ti-arrow-left" style={{fontSize:'15px'}} aria-hidden="true"/>
          Back
        </button>
        <button className="nav-logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
      </nav>

      <div className="wrap">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile?.name?.slice(0, 2).toUpperCase()}
          </div>
          <h1 className="profile-name">{profile?.name}</h1>
          <div className="profile-stat">
            Going to {events.length} event{events.length !== 1 ? 's' : ''}
          </div>
        </div>

        <h2 className="section-title">Events</h2>

        {events.length === 0 ? (
          <div className="empty">No events yet</div>
        ) : (
          <div className="events-grid">
            {events.map(ev => {
              const date = ev.starts_at
                ? new Date(ev.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase()
                : 'TBD'
              return (
                <div key={ev.id} className="event-card" onClick={() => router.push(`/events/${ev.id}`)}>
                  {ev.cover_image_url ? (
                    <img src={ev.cover_image_url} className="card-img" alt="" loading="lazy"/>
                  ) : (
                    <div className="card-placeholder"/>
                  )}
                  <div className="card-overlay"/>
                  <span className="card-badge">{ev.category}</span>
                  <div className="card-content">
                    <div className="card-date">{date}</div>
                    <div className="card-title">{ev.title}</div>
                    <div className="card-venue">{ev.venue_name ?? ev.city ?? 'TBD'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}