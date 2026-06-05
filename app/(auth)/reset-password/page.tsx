'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  const [debug, setDebug] = useState('')
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return   // guard: verifyOtp consumes the token, never run twice
    ranRef.current = true

    const supabase = createClient()
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')
    const code = params.get('code')

    const fail = (raw?: string) => {
      setError('This reset link has expired or already been used. Please request a new one.')
      if (raw) setDebug(raw)
    }

    async function verify() {
      // Method 1 — token_hash (device-independent, no PKCE cookie needed). Preferred.
      if (token_hash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: (type as any) || 'recovery' })
        if (!error) setReady(true)
        else fail(error.message)
        return
      }

      // Method 2 — PKCE code exchange (works only in the same browser the reset was requested from)
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (data?.session && !error) setReady(true)
        else fail(error?.message || 'code exchange returned no session')
        return
      }

      // Method 3 — implicit hash flow / already-established session
      const { data } = await supabase.auth.getSession()
      if (data.session) { setReady(true); return }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')) {
          setReady(true)
          subscription.unsubscribe()
        }
      })
      setTimeout(async () => {
        const { data } = await supabase.auth.getSession()
        if (!data.session) fail('no token_hash, code, or session found in URL')
      }, 2000)
    }

    verify()
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
        label{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:8px;}
        input[type=password]{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.12);border-radius:10px;padding:13px 14px;font-size:14px;color:#fff;font-family:'Syne',sans-serif;outline:none;margin-bottom:18px;}
        input[type=password]:focus{border-color:rgba(255,170,51,0.4);}
        .submit-btn{width:100%;background:#ffaa33;color:#000;font-size:15px;font-weight:700;padding:14px;border-radius:100px;border:none;cursor:pointer;font-family:'Syne',sans-serif;margin-top:4px;transition:opacity 0.15s;}
        .submit-btn:disabled{opacity:0.5;cursor:not-allowed;}
        .error{font-size:13px;color:#f87171;margin-bottom:16px;line-height:1.5;}
        .success{font-size:15px;color:#4ade80;text-align:center;margin-top:8px;line-height:1.6;}
        .loading-state{font-size:13px;color:rgba(255,255,255,0.3);text-align:center;padding:20px 0;}
        .request-link{margin-top:18px;text-align:center;font-size:13px;color:rgba(255,255,255,0.3);}
        .request-link a{color:#ffaa33;text-decoration:none;font-weight:700;}
      `}</style>

      <div className="acid"/>
      <div className="page">
        <button className="logo-btn" onClick={() => router.push('/')}>
          <img src="/pulse-word-tight.png" alt="Pulse" className="logo-img"/>
        </button>

        <div className="card">
          <div className="title">New password</div>
          <div className="sub">Choose something you'll remember.</div>

          {error ? (
            <>
              <div className="error">{error}</div>
              {debug && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '14px', fontFamily: 'monospace' }}>debug: {debug}</div>}
              <div className="request-link">
                <a href="/forgot-password">Request a new reset link</a>
              </div>
            </>
          ) : !ready ? (
            <div className="loading-state">Verifying your reset link…</div>
          ) : done ? (
            <div className="success">Password updated. Taking you to your account…</div>
          ) : (
            <>
              <label>New password</label>
              <input type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)}/>
              <label>Confirm password</label>
              <input type="password" placeholder="Same as above" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReset()}/>
              <button className="submit-btn" onClick={handleReset} disabled={loading || !password || !confirm}>
                {loading ? 'Updating…' : 'Set new password'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}