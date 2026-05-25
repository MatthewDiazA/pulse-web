'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase puts the session in the URL hash — just check we have a session
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      else setError('Invalid or expired reset link. Please request a new one.')
    })
  }, [])

  const handleReset = async () => {
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
    setTimeout(() => router.push('/account'), 2000)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&family=Syne:wght@400;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#000;font-family:'Syne',sans-serif;color:#f0f0f0;min-height:100vh;}
        .acid{position:fixed;inset:0;z-index:0;pointer-events:none;}
        .acid::before{content:'';position:absolute;width:70vmax;height:70vmax;border-radius:50%;background:radial-gradient(circle,rgba(255,102,0,0.12),transparent 70%);top:-20vmax;right:-10vmax;mix-blend-mode:screen;filter:blur(50px);}
        .acid::after{content:'';position:absolute;width:55vmax;height:55vmax;border-radius:50%;background:radial-gradient(circle,rgba(192,26,111,0.1),transparent 65%);bottom:-10vmax;left:-10vmax;mix-blend-mode:screen;filter:blur(55px);}
        .page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;position:relative;z-index:1;}
        .logo-btn{background:none;border:none;cursor:pointer;margin-bottom:48px;}
        .logo-img{height:28px;filter:drop-shadow(0 0 12px rgba(255,170,51,0.4));}
        .card{width:100%;max-width:400px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 32px;}
        .title{font-family:'Barlow Condensed',sans-serif;font-size:40px;font-weight:900;text-transform:uppercase;color:#fff;margin-bottom:6px;}
        .sub{font-size:13px;color:rgba(255,255,255,0.35);margin-bottom:28px;}
        label{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:7px;}
        input{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:10px;padding:13px 14px;color:#fff;font-size:14px;font-family:'Syne',sans-serif;outline:none;margin-bottom:16px;transition:border-color 0.2s;}
        input:focus{border-color:rgba(255,170,51,0.4);}
        .btn{width:100%;background:#ffaa33;color:#000;border:none;border-radius:100px;padding:14px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;margin-top:4px;}
        .btn:disabled{opacity:0.45;cursor:not-allowed;}
        .error{background:rgba(255,80,80,0.08);border:0.5px solid rgba(255,80,80,0.2);border-radius:8px;padding:10px 14px;font-size:13px;color:#ff8888;margin-bottom:16px;}
        .success{background:rgba(74,222,128,0.08);border:0.5px solid rgba(74,222,128,0.2);border-radius:8px;padding:10px 14px;font-size:13px;color:#4ade80;margin-bottom:16px;}
      `}</style>

      <div className="acid" aria-hidden="true"/>
      <div className="page">
        <button className="logo-btn" onClick={() => router.push('/')}>
          <img src="/pulse-word-tight.png" alt="Pulse" className="logo-img"/>
        </button>
        <div className="card">
          <div className="title">New password</div>
          <div className="sub">Choose a strong password for your account</div>

          {error && <div className="error">{error}</div>}
          {done && <div className="success">Password updated. Redirecting you...</div>}

          {ready && !done && (
            <>
              <label>New password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/>
              <label>Confirm password</label>
              <input type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReset()}/>
              <button className="btn" onClick={handleReset} disabled={loading}>{loading ? 'Saving...' : 'Set new password →'}</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}