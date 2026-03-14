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
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <style>{`
          * { margin:0; padding:0; box-sizing:border-box; }
          body { background:#0a0a0b; font-family:'DM Sans',sans-serif; }
          .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
          .card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:14px; padding:40px; width:100%; max-width:400px; text-align:center; }
          .logo { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:4px; color:#e8ff47; margin-bottom:24px; }
          .heading { font-family:'Bebas Neue',sans-serif; font-size:32px; color:#f0f0f0; margin-bottom:8px; }
          .sub { font-size:14px; color:#888; line-height:1.6; }
          .email { color:#e8ff47; }
        `}</style>
        <div className="page">
          <div className="card">
            <div className="logo">PULSE</div>
            <div style={{fontSize:'48px', marginBottom:'16px'}}>📧</div>
            <h1 className="heading">Check your email</h1>
            <p className="sub">We sent a confirmation link to <span className="email">{email}</span>. Click it to activate your account.</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; }
        .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
        .card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:14px; padding:40px; width:100%; max-width:400px; }
        .logo { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:4px; color:#e8ff47; margin-bottom:24px; cursor:pointer; }
        .heading { font-family:'Bebas Neue',sans-serif; font-size:32px; color:#f0f0f0; margin-bottom:4px; letter-spacing:0.5px; }
        .sub { font-size:14px; color:#888; margin-bottom:28px; }
        .field { margin-bottom:16px; }
        .label { font-size:12px; color:#888; margin-bottom:6px; display:block; }
        .input { width:100%; background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.14); border-radius:8px; padding:11px 14px; color:#f0f0f0; font-size:14px; font-family:'DM Sans',sans-serif; outline:none; }
        .input:focus { border-color:rgba(255,255,255,0.28); }
        .submit-btn { width:100%; background:#e8ff47; color:#0a0a0b; border:none; border-radius:8px; padding:12px; font-size:14px; font-weight:500; font-family:'DM Sans',sans-serif; cursor:pointer; margin-top:4px; }
        .submit-btn:hover { opacity:0.88; }
        .submit-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .error { font-size:13px; color:#e24b4a; margin-bottom:12px; padding:10px 14px; background:rgba(226,75,74,0.1); border-radius:6px; border:0.5px solid rgba(226,75,74,0.3); }
        .footer { font-size:13px; color:#888; text-align:center; margin-top:20px; }
        .footer a { color:#e8ff47; text-decoration:none; }
        .back { font-size:13px; color:#888; text-decoration:none; display:block; text-align:center; margin-top:16px; cursor:pointer; }
        .back:hover { color:#f0f0f0; }
      `}</style>

      <div className="page">
        <div className="card">
          <div className="logo" onClick={() => window.location.href='/'}>PULSE</div>
          <h1 className="heading">Create account</h1>
          <p className="sub">Join PULSE to buy & host events</p>

          <div className="field">
            <label className="label">Full name</label>
            <input className="input" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)}/>
          </div>

          {error && <div className="error">{error}</div>}

          <button className="submit-btn" disabled={loading} onClick={handleSignup}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="footer">
            Already have an account? <a href="/login">Sign in</a>
          </p>
          <p className="back" onClick={() => window.location.href='/'}>← Back to events</p>
        </div>
      </div>
    </>
  )
}