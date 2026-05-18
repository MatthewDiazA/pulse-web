'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSignup = async () => {
    if (!name || !email || !password) { setError('Please fill in all fields'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: name },
        emailRedirectTo: 'https://pulse-one-hazel.vercel.app/auth/callback'
      }
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  if (success) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
          * { margin:0; padding:0; box-sizing:border-box; }
          html,body { background:#0a0a0b; min-height:100vh; }
          .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
          .glow { position:fixed; width:600px; height:600px; border-radius:50%; background:radial-gradient(circle, rgba(237,20,101,0.06) 0%, transparent 70%); top:50%; left:50%; transform:translate(-50%,-50%); pointer-events:none; }
          .card { background:rgba(16,16,20,0.9); border:0.5px solid rgba(237,20,101,0.2); border-radius:24px; padding:48px 40px; width:100%; max-width:400px; text-align:center; position:relative; overflow:hidden; backdrop-filter:blur(20px); }
          .card-glow { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 0%, rgba(237,20,101,0.06) 0%, transparent 60%); pointer-events:none; }
          .top-bar { height:3px; background:linear-gradient(90deg,#ED1465,#ff4fd8,#6399dc,#ED1465); background-size:300% 100%; border-radius:2px; margin-bottom:40px; animation:barPulse 3s ease-in-out infinite; }
          @keyframes barPulse { 0%{background-position:0% 50%;opacity:0.7} 50%{background-position:100% 50%;opacity:1} 100%{background-position:0% 50%;opacity:0.7} }
          .logo { font-family:'Nunito',sans-serif; font-size:28px; font-weight:900; color:#ED1465; margin-bottom:32px; letter-spacing:-0.5px; filter:drop-shadow(0 0 12px rgba(237,20,101,0.4)); cursor:pointer; text-transform:lowercase; }
          .icon-wrap { width:80px; height:80px; border-radius:50%; background:rgba(237,20,101,0.08); border:1px solid rgba(237,20,101,0.2); display:flex; align-items:center; justify-content:center; margin:0 auto 24px; animation:pulseGlow 2s ease-in-out infinite; }
          @keyframes pulseGlow { 0%,100%{box-shadow:0 0 20px rgba(237,20,101,0.1)} 50%{box-shadow:0 0 40px rgba(237,20,101,0.25)} }
          .heading { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:36px; color:#f0f0f0; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px; }
          .sub { font-size:14px; color:#555; line-height:1.7; margin-bottom:8px; font-family:'DM Sans',sans-serif; }
          .email-highlight { color:#ED1465; font-weight:500; }
          .hint { font-size:12px; color:#333; margin-top:24px; font-family:'DM Sans',sans-serif; }
          .back-btn { margin-top:20px; display:inline-block; font-size:13px; color:#555; font-family:'DM Sans',sans-serif; cursor:pointer; transition:color 0.15s; }
          .back-btn:hover { color:#f0f0f0; }
        `}</style>
        <div className="page">
          <div className="glow"/>
          <div className="card">
            <div className="card-glow"/>
            <div className="top-bar"/>
            <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
            <div className="icon-wrap">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ED1465" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M2 7l10 7 10-7"/>
              </svg>
            </div>
            <h1 className="heading">Check your inbox</h1>
            <p className="sub">We sent a confirmation link to<br/><span className="email-highlight">{email}</span></p>
            <p className="sub" style={{marginTop:'8px'}}>Click the link to activate your account and get on the list.</p>
            <p className="hint">Didn't get it? Check your spam folder.</p>
            <div className="back-btn" onClick={() => window.location.href='/'}>← Back to events</div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        html,body { background:#0a0a0b; min-height:100vh; }
        .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; position:relative; overflow:hidden; }
        .glow { position:fixed; width:600px; height:600px; border-radius:50%; background:radial-gradient(circle, rgba(237,20,101,0.05) 0%, transparent 70%); top:50%; left:50%; transform:translate(-50%,-50%); pointer-events:none; }
        .card { background:rgba(16,16,20,0.9); border:0.5px solid rgba(255,255,255,0.1); border-radius:24px; padding:40px; width:100%; max-width:400px; position:relative; overflow:hidden; backdrop-filter:blur(20px); }
        .card-glow { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 0%, rgba(237,20,101,0.04) 0%, transparent 60%); pointer-events:none; }
        .top-bar { height:3px; background:linear-gradient(90deg,#ED1465,#ff4fd8,#6399dc,#ED1465); background-size:300% 100%; border-radius:2px; margin-bottom:32px; animation:barPulse 3s ease-in-out infinite; }
        @keyframes barPulse { 0%{background-position:0% 50%;opacity:0.7} 50%{background-position:100% 50%;opacity:1} 100%{background-position:0% 50%;opacity:0.7} }
        .logo { font-family:'Nunito',sans-serif; font-size:28px; font-weight:900; color:#ED1465; margin-bottom:28px; letter-spacing:-0.5px; filter:drop-shadow(0 0 8px rgba(237,20,101,0.3)); cursor:pointer; display:inline-block; text-transform:lowercase; }
        .heading { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:36px; color:#f0f0f0; margin-bottom:4px; text-transform:uppercase; letter-spacing:1px; }
        .sub { font-size:14px; color:#555; margin-bottom:28px; font-family:'DM Sans',sans-serif; }
        .divider { display:flex; align-items:center; gap:10px; margin-bottom:20px; }
        .divider-line { flex:1; height:0.5px; background:rgba(255,255,255,0.08); }
        .divider-text { font-size:11px; color:#333; letter-spacing:1px; text-transform:uppercase; font-family:'DM Sans',sans-serif; white-space:nowrap; }
        .field { margin-bottom:14px; }
        .label { font-size:11px; color:#555; margin-bottom:5px; display:block; letter-spacing:0.5px; text-transform:uppercase; font-family:'DM Sans',sans-serif; }
        .input { width:100%; background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.1); border-radius:10px; padding:12px 14px; color:#f0f0f0; font-size:15px; font-family:'DM Sans',sans-serif; outline:none; transition:border-color 0.15s; -webkit-appearance:none; }
        .input:focus { border-color:rgba(237,20,101,0.4); background:rgba(255,255,255,0.06); }
        .input::placeholder { color:#333; }
        .submit-btn { width:100%; background:#ED1465; color:#fff; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; margin-top:8px; transition:all 0.15s; letter-spacing:0.3px; box-shadow:0 0 20px rgba(237,20,101,0.25); }
        .submit-btn:active { transform:scale(0.98); opacity:0.9; }
        .submit-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .error { font-size:13px; color:#e24b4a; margin-bottom:12px; padding:10px 14px; background:rgba(226,75,74,0.08); border-radius:8px; border:0.5px solid rgba(226,75,74,0.2); font-family:'DM Sans',sans-serif; }
        .footer { font-size:13px; color:#555; text-align:center; margin-top:20px; font-family:'DM Sans',sans-serif; }
        .footer a { color:#ED1465; text-decoration:none; font-weight:500; }
        .back { font-size:13px; color:#333; text-decoration:none; display:block; text-align:center; margin-top:14px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:color 0.15s; }
        .back:hover { color:#888; }
      `}</style>

      <div className="page">
        <div className="glow"/>
        <div className="card">
          <div className="card-glow"/>
          <div className="top-bar"/>
          <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
          <h1 className="heading">Join the list</h1>
          <p className="sub">Create your account to buy & host events</p>

          <div className="divider">
            <div className="divider-line"/>
            <div className="divider-text">sign up with email</div>
            <div className="divider-line"/>
          </div>

          <div className="field">
            <label className="label">Full name</label>
            <input className="input" type="text" placeholder="Your name"
              value={name} onChange={e => setName(e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="At least 8 characters"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignup()}/>
          </div>

          {error && <div className="error">{error}</div>}

          <button className="submit-btn" disabled={loading} onClick={handleSignup}>
            {loading ? 'Creating account...' : "Let's go →"}
          </button>

          <p className="footer">Already have an account? <a href="/login">Sign in</a></p>
          <div className="back" onClick={() => window.location.href='/'}>← Back to events</div>
        </div>
      </div>
    </>
  )
}