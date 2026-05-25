'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type Mode = 'signin' | 'signup' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supabase = createClient()

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setSuccess('Check your email for a reset link.')
        setLoading(false)
        return
      }

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        setSuccess('Check your email to confirm your account.')
        setLoading(false)
        return
      }

      // Sign in
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/account')
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    }
    setLoading(false)
  }

  const headings = {
    signin: { title: 'Welcome back', sub: 'Sign in to your account' },
    signup: { title: 'Join Pulse', sub: 'Create your account' },
    forgot: { title: 'Reset password', sub: 'We\'ll send you a link' },
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;font-family:'Syne',sans-serif;color:#f0f0f0;min-height:100vh;}

        .acid{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
        .acid::before{content:'';position:absolute;width:70vmax;height:70vmax;border-radius:50%;background:radial-gradient(circle,rgba(255,102,0,0.14) 0%,rgba(232,0,29,0.06) 45%,transparent 70%);top:-20vmax;right:-10vmax;animation:orbA 20s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(50px);}
        .acid::after{content:'';position:absolute;width:55vmax;height:55vmax;border-radius:50%;background:radial-gradient(circle,rgba(192,26,111,0.12) 0%,transparent 65%);bottom:-10vmax;left:-10vmax;animation:orbB 24s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(55px);}
        @keyframes orbA{0%{transform:translate(0,0)}100%{transform:translate(-8vw,10vh)}}
        @keyframes orbB{0%{transform:translate(0,0)}100%{transform:translate(10vw,-8vh)}}

        .page{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;position:relative;z-index:1;}

        .logo-btn{background:none;border:none;cursor:pointer;margin-bottom:48px;line-height:0;}
        .logo-img{height:28px;width:auto;filter:drop-shadow(0 0 12px rgba(255,170,51,0.4));}

        .card{width:100%;max-width:400px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.08);border-radius:20px;padding:36px 32px;backdrop-filter:blur(20px);}
        @media(max-width:480px){.card{padding:28px 22px;}}

        .card-top{margin-bottom:28px;}
        .card-title{font-family:'Barlow Condensed',sans-serif;font-size:40px;font-weight:900;text-transform:uppercase;color:#fff;line-height:0.9;margin-bottom:6px;}
        .card-sub{font-size:13px;color:rgba(255,255,255,0.35);}

        .divider{display:flex;align-items:center;gap:12px;margin-bottom:24px;}
        .divider-line{flex:1;height:0.5px;background:rgba(255,255,255,0.08);}
        .divider-text{font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.2);text-transform:uppercase;}

        .field{margin-bottom:16px;}
        .field-label{display:block;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.3);margin-bottom:7px;}
        .field-input{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:10px;padding:13px 14px;color:#fff;font-size:14px;font-family:'Syne',sans-serif;outline:none;transition:border-color 0.2s;}
        .field-input::placeholder{color:rgba(255,255,255,0.2);}
        .field-input:focus{border-color:rgba(255,170,51,0.4);}

        .forgot-link{display:block;text-align:right;font-size:12px;color:rgba(255,255,255,0.3);cursor:pointer;margin-top:-8px;margin-bottom:20px;background:none;border:none;font-family:'Syne',sans-serif;transition:color 0.15s;}
        .forgot-link:hover{color:rgba(255,255,255,0.6);}

        .submit-btn{width:100%;background:#ffaa33;color:#000;border:none;border-radius:100px;padding:14px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;transition:opacity 0.15s;margin-top:4px;display:flex;align-items:center;justify-content:center;gap:8px;}
        .submit-btn:disabled{opacity:0.45;cursor:not-allowed;}
        .submit-btn:hover:not(:disabled){opacity:0.9;}

        .error{background:rgba(255,80,80,0.08);border:0.5px solid rgba(255,80,80,0.2);border-radius:8px;padding:10px 14px;font-size:13px;color:#ff8888;margin-bottom:16px;}
        .success{background:rgba(74,222,128,0.08);border:0.5px solid rgba(74,222,128,0.2);border-radius:8px;padding:10px 14px;font-size:13px;color:#4ade80;margin-bottom:16px;}

        .switch{text-align:center;margin-top:20px;font-size:13px;color:rgba(255,255,255,0.25);}
        .switch-btn{background:none;border:none;color:#ffaa33;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;cursor:pointer;padding:0;}

        .back-home{display:block;text-align:center;margin-top:16px;font-size:12px;color:rgba(255,255,255,0.2);cursor:pointer;background:none;border:none;font-family:'Syne',sans-serif;transition:color 0.15s;}
        .back-home:hover{color:rgba(255,255,255,0.5);}

        .spinner{width:16px;height:16px;border:2px solid rgba(0,0,0,0.3);border-top-color:#000;border-radius:50%;animation:spin 0.7s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div className="acid" aria-hidden="true"/>

      <div className="page">
        <button className="logo-btn" onClick={() => router.push('/')}>
          <img src="/pulse-word-tight.png" alt="Pulse" className="logo-img"/>
        </button>

        <div className="card">
          <div className="card-top">
            <div className="card-title">{headings[mode].title}</div>
            <div className="card-sub">{headings[mode].sub}</div>
          </div>

          <div className="divider">
            <div className="divider-line"/>
            <div className="divider-text">{mode === 'forgot' ? 'Enter your email' : 'Sign in with email'}</div>
            <div className="divider-line"/>
          </div>

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          {mode === 'signup' && (
            <div className="field">
              <label className="field-label">Name</label>
              <input
                className="field-input"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}

          <div className="field">
            <label className="field-label">Email</label>
            <input
              className="field-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()}
              autoComplete="email"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="field">
              <label className="field-label">Password</label>
              <input
                className="field-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
          )}

          {mode === 'signin' && (
            <button className="forgot-link" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}>
              Forgot password?
            </button>
          )}

          <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? <span className="spinner"/> : mode === 'signin' ? 'Sign in →' : mode === 'signup' ? 'Create account →' : 'Send reset link →'}
          </button>

          {mode === 'signin' && (
            <div className="switch">
              Don't have an account?{' '}
              <button className="switch-btn" onClick={() => { setMode('signup'); setError(''); setSuccess('') }}>Sign up</button>
            </div>
          )}
          {mode === 'signup' && (
            <div className="switch">
              Already have an account?{' '}
              <button className="switch-btn" onClick={() => { setMode('signin'); setError(''); setSuccess('') }}>Sign in</button>
            </div>
          )}
          {mode === 'forgot' && (
            <div className="switch">
              <button className="switch-btn" onClick={() => { setMode('signin'); setError(''); setSuccess('') }}>← Back to sign in</button>
            </div>
          )}
        </div>

        <button className="back-home" onClick={() => router.push('/')}>← Back to events</button>
      </div>
    </>
  )
}