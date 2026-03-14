'use client'
import { useEffect, useState } from 'react'
import { createClient } from './lib/supabase/client'

function AuthButton() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  if (user) {
    return (
      <button
        style={{background:'#e8ff47', color:'#0a0a0b', fontSize:'13px', fontWeight:'500', padding:'8px 18px', borderRadius:'6px', border:'none', cursor:'pointer', fontFamily:'DM Sans,sans-serif'}}
        onClick={async () => {
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.reload()
        }}
      >
        Sign out
      </button>
    )
  }

  return <a href="/login" className="nav-cta">Sign in</a>
}

export default function Home() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; }
        .wrap { max-width:1100px; margin:0 auto; padding:0 40px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 0; background:rgba(10,10,11,0.95); position:sticky; top:0; z-index:100; }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:4px; color:#e8ff47; cursor:pointer; }
        .nav-links { display:flex; gap:28px; align-items:center; }
        .nav-links a { font-size:13px; color:#888; text-decoration:none; }
        .nav-links a:hover { color:#f0f0f0; }
        .nav-cta { background:#e8ff47; color:#0a0a0b; font-size:13px; font-weight:500; padding:8px 18px; border-radius:6px; text-decoration:none; }
        .hero { padding:52px 0 40px; border-bottom:0.5px solid rgba(255,255,255,0.08); }
        .hero h1 { font-family:'Bebas Neue',sans-serif; font-size:88px; line-height:0.95; color:#f0f0f0; letter-spacing:1px; }
        .hero h1 span { color:#e8ff47; }
        .hero-sub { margin-top:12px; font-size:15px; color:#888; font-weight:300; }
        .filters { padding:24px 0; display:flex; gap:10px; flex-wrap:wrap; align-items:center; border-bottom:0.5px solid rgba(255,255,255,0.08); }
        .pill { background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.14); border-radius:100px; padding:7px 16px; font-size:13px; color:#888; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .pill:hover { color:#f0f0f0; border-color:rgba(255,255,255,0.28); }
        .pill.active { background:#e8ff47; color:#0a0a0b; border-color:#e8ff47; font-weight:500; }
        .grid { padding:32px 0; display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1px; background:rgba(255,255,255,0.08); border:0.5px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; }
        .card { background:#0a0a0b; cursor:pointer; transition:background 0.15s; position:relative; overflow:hidden; }
        .card:hover { background:#1c1c21; }
        .card-img { height:190px; overflow:hidden; position:relative; }
        .card-img svg { width:100%; height:100%; }
        .card-tag { position:absolute; top:12px; left:12px; font-size:11px; font-weight:500; padding:4px 10px; border-radius:100px; letter-spacing:0.5px; text-transform:uppercase; }
        .tag-nightlife { background:rgba(232,255,71,0.18); color:#e8ff47; border:0.5px solid rgba(232,255,71,0.3); }
        .tag-concert { background:rgba(255,79,216,0.18); color:#ff4fd8; border:0.5px solid rgba(255,79,216,0.3); }
        .tag-festival { background:rgba(99,153,220,0.18); color:#6399dc; border:0.5px solid rgba(99,153,220,0.3); }
        .sold-badge { position:absolute; top:12px; right:12px; background:rgba(226,75,74,0.9); color:#fff; font-size:10px; font-weight:500; padding:3px 9px; border-radius:100px; }
        .card-body { padding:18px 20px 20px; }
        .card-date { font-size:11px; color:#888; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:6px; }
        .card-title { font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:0.5px; line-height:1.15; color:#f0f0f0; margin-bottom:8px; }
        .card-venue { font-size:13px; color:#888; margin-bottom:14px; }
        .card-footer { display:flex; align-items:center; justify-content:space-between; border-top:0.5px solid rgba(255,255,255,0.08); padding-top:14px; }
        .price { font-family:'Bebas Neue',sans-serif; font-size:20px; color:#e8ff47; }
        .price-free { color:#ff4fd8; }
        .price-sold { color:#888; text-decoration:line-through; }
        .ticket-btn { background:#e8ff47; color:#0a0a0b; font-size:12px; font-weight:500; padding:7px 16px; border-radius:6px; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .ticket-btn.sold { background:#222; color:#888; cursor:not-allowed; }
        .featured { grid-column:span 2; }
        .featured .card-img { height:260px; }
        .featured .card-title { font-size:32px; }
        @media(max-width:680px){ .featured { grid-column:span 1; } .hero h1 { font-size:52px; } .nav-links { display:none; } }
        .bottom { display:flex; align-items:center; justify-content:space-between; padding:28px 0; }
        .showing { font-size:13px; color:#888; }
        .load-more { background:transparent; border:0.5px solid rgba(255,255,255,0.14); color:#888; font-size:13px; font-family:'DM Sans',sans-serif; padding:9px 24px; border-radius:8px; cursor:pointer; }
        .load-more:hover { color:#f0f0f0; border-color:rgba(255,255,255,0.28); }
      `}</style>

      <nav>
        <div className="wrap nav-inner">
          <div className="logo" onClick={() => window.location.href='/'}>PULSE</div>
          <div className="nav-links">
            <a href="#">Discover</a>
            <a href="#">Near me</a>
            <a href="#">Artists</a>
            <a href="/host">Host an event</a>
            <AuthButton/>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="hero">
          <h1>YOUR CITY.<br/><span>YOUR NIGHT.</span></h1>
          <p className="hero-sub">Find tickets to the best parties, concerts & shows near you.</p>
        </div>

        <div className="filters">
          <div className="pill active">All events</div>
          <div className="pill">Nightlife</div>
          <div className="pill">Concerts</div>
          <div className="pill">Festivals</div>
          <div className="pill">Tonight</div>
          <div className="pill">This weekend</div>
        </div>

        <div className="grid">

          <div className="card featured">
            <div className="card-img">
              <svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="600" height="260" fill="#0d0a1a"/>
                <circle cx="300" cy="130" r="80" fill="none" stroke="#e8ff47" strokeWidth="0.5" opacity="0.3"/>
                <circle cx="300" cy="130" r="130" fill="none" stroke="#e8ff47" strokeWidth="0.5" opacity="0.15"/>
                <text x="300" y="150" textAnchor="middle" fontFamily="serif" fontSize="64" fill="#e8ff47" opacity="0.9">✦</text>
              </svg>
              <div className="card-tag tag-nightlife">Nightlife</div>
            </div>
            <div className="card-body">
              <div className="card-date">FRI 21 MAR · DOORS 10PM</div>
              <div className="card-title">CLUB NOIR — GRAND OPENING NIGHT</div>
              <div className="card-venue">📍 The Warehouse, Houston TX</div>
              <div className="card-footer">
                <div className="price">$35 – $120</div>
                <button className="ticket-btn" onClick={() => window.location.href='/events/123'}>Get tickets</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-img">
              <svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="300" height="190" fill="#0e1520"/>
                <rect x="130" y="40" width="40" height="110" rx="4" fill="#ff4fd8" opacity="0.15"/>
                <rect x="140" y="30" width="20" height="10" rx="2" fill="#ff4fd8" opacity="0.4"/>
                <ellipse cx="150" cy="165" rx="60" ry="6" fill="rgba(255,79,216,0.15)"/>
              </svg>
              <div className="card-tag tag-concert">Concert</div>
            </div>
            <div className="card-body">
              <div className="card-date">SAT 22 MAR · 8PM</div>
              <div className="card-title">ALEX G — LIVE TOUR 2026</div>
              <div className="card-venue">📍 White Oak Music Hall</div>
              <div className="card-footer">
                <div className="price">$45</div>
                <button className="ticket-btn">Get tickets</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-img">
              <svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="300" height="190" fill="#100810"/>
                <circle cx="150" cy="95" r="50" fill="none" stroke="#ff4fd8" strokeWidth="0.5" opacity="0.4"/>
                <circle cx="150" cy="95" r="30" fill="none" stroke="#e8ff47" strokeWidth="0.5" opacity="0.3"/>
                <circle cx="150" cy="95" r="8" fill="#ff4fd8" opacity="0.6"/>
              </svg>
              <div className="card-tag tag-nightlife">Nightlife</div>
            </div>
            <div className="card-body">
              <div className="card-date">SAT 22 MAR · 11PM</div>
              <div className="card-title">SATURDAY RITUAL</div>
              <div className="card-venue">📍 Barbarella, Houston TX</div>
              <div className="card-footer">
                <div className="price">$20</div>
                <button className="ticket-btn">Get tickets</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-img">
              <svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="300" height="190" fill="#0f100a"/>
                <rect x="76" y="55" width="16" height="115" fill="#6399dc" opacity="0.7"/>
                <rect x="132" y="45" width="16" height="125" fill="#e8ff47" opacity="0.7"/>
                <rect x="188" y="85" width="16" height="85" fill="#6399dc" opacity="0.4"/>
                <rect x="216" y="50" width="16" height="120" fill="#6399dc" opacity="0.65"/>
              </svg>
              <div className="card-tag tag-festival">Festival</div>
            </div>
            <div className="card-body">
              <div className="card-date">APR 5–6 · DAY FESTIVAL</div>
              <div className="card-title">SPRING HEAT 2026</div>
              <div className="card-venue">📍 Discovery Green, Houston TX</div>
              <div className="card-footer">
                <div className="price">$89 – $220</div>
                <button className="ticket-btn">Get tickets</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-img">
              <svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="300" height="190" fill="#0d0d0d"/>
                <polygon points="0,190 150,30 300,190" fill="none" stroke="#e8ff47" strokeWidth="0.5" opacity="0.2"/>
                <circle cx="150" cy="30" r="4" fill="#e8ff47" opacity="0.6"/>
              </svg>
              <div className="card-tag tag-concert">Concert</div>
              <div className="sold-badge">Sold out</div>
            </div>
            <div className="card-body">
              <div className="card-date">FRI 28 MAR · 7PM</div>
              <div className="card-title">INDIE NIGHT — OPEN STAGE</div>
              <div className="card-venue">📍 Rudyard's Pub</div>
              <div className="card-footer">
                <div className="price price-sold">$18</div>
                <button className="ticket-btn sold" disabled>Sold out</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-img">
              <svg viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="300" height="190" fill="#08080f"/>
                <rect x="0" y="130" width="300" height="60" fill="#0d0d18"/>
                <rect x="70" y="85" width="40" height="50" fill="#14141f"/>
                <rect x="175" y="75" width="50" height="60" fill="#14141f"/>
                <circle cx="150" cy="50" r="20" fill="none" stroke="#e8ff47" strokeWidth="0.5" opacity="0.5"/>
                <circle cx="150" cy="50" r="3" fill="#e8ff47" opacity="0.8"/>
              </svg>
              <div className="card-tag tag-nightlife">Nightlife</div>
            </div>
            <div className="card-body">
              <div className="card-date">SUN 6 APR · 6PM</div>
              <div className="card-title">ROOFTOP SESSIONS</div>
              <div className="card-venue">📍 Hotel ZaZa, Houston TX</div>
              <div className="card-footer">
                <div className="price price-free">Free entry</div>
                <button className="ticket-btn">RSVP now</button>
              </div>
            </div>
          </div>

        </div>

        <div className="bottom">
          <span className="showing">Showing 6 events</span>
          <button className="load-more">Load more events</button>
        </div>
      </div>
    </>
  )
}