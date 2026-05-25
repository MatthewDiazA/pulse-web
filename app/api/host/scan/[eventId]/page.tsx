'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'

const COLORS = { primary: '#ffaa33', bg: '#000' } as const

type ScanResult = {
  valid: boolean
  error?: string
  tier_name?: string
  holder_name?: string
  is_guestlist?: boolean
  checked_in_at?: string
}

export default function ScanPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.eventId as string
  const videoRef = useRef<HTMLVideoElement>(null)
  const [event, setEvent] = useState<any>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [tab, setTab] = useState<'camera' | 'manual'>('camera')
  const [cameraError, setCameraError] = useState('')
  const [checkedInCount, setCheckedInCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const scannerRef = useRef<any>(null)
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: ev } = await supabase.from('events').select('id,title,host_id').eq('id', eventId).single()
      if (!ev || ev.host_id !== user.id) { router.push('/host'); return }
      setEvent(ev)
      const { count: checkedIn } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('is_checked_in', true)
      const { count: total } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
      setCheckedInCount(checkedIn ?? 0)
      setTotalCount(total ?? 0)
    }
    load()
  }, [eventId, router])

  useEffect(() => {
    if (tab !== 'camera') { stopCamera(); return }
    startCamera()
    return () => stopCamera()
  }, [tab])

  const startCamera = async () => {
    try {
      setCameraError('')
      // Dynamically load html5-qrcode
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (scanning) return
          await handleScan(decodedText)
        },
        () => {}
      )
    } catch (err: any) {
      setCameraError(err.message || 'Camera access denied')
    }
  }

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
  }

  const handleScan = async (code: string) => {
    setScanning(true)
    try {
      const res = await fetch('/api/host/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code: code, event_id: eventId }),
      })
      const data = await res.json()
      setResult(data)
      if (data.valid) {
        setCheckedInCount(p => p + 1)
        vibrate([50, 30, 50])
      } else {
        vibrate([200])
      }
      if (resultTimer.current) clearTimeout(resultTimer.current)
      resultTimer.current = setTimeout(() => {
        setResult(null)
        setScanning(false)
      }, 3000)
    } catch {
      setResult({ valid: false, error: 'Network error' })
      setScanning(false)
    }
  }

  const vibrate = (pattern: number[]) => {
    try { navigator.vibrate?.(pattern) } catch {}
  }

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) return
    await handleScan(manualCode.trim())
    setManualCode('')
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;color:#f0f0f0;font-family:'Syne',sans-serif;min-height:100vh;}
        nav{padding:14px 20px;background:rgba(0,0,0,0.95);position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:14px;backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(255,255,255,0.05);}
        .logo{background:none;border:none;padding:0;cursor:pointer;line-height:0;}
        .logo-img{height:20px;width:auto;filter:drop-shadow(0 0 8px rgba(255,170,51,0.4));}
        .nav-back{background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;font-family:'Syne',sans-serif;display:flex;align-items:center;gap:5px;}
        .wrap{max-width:480px;margin:0 auto;padding:24px 20px 80px;}
        .event-title{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;text-transform:uppercase;color:#fff;margin-bottom:4px;}
        .counter{display:flex;gap:6px;align-items:baseline;margin-bottom:24px;}
        .counter-num{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:#ffaa33;}
        .counter-label{font-size:12px;color:rgba(255,255,255,0.4);}
        .tabs{display:flex;gap:0;margin-bottom:20px;border-bottom:0.5px solid rgba(255,255,255,0.06);}
        .tab{flex:1;padding:10px 0;text-align:center;font-size:13px;font-weight:600;color:rgba(255,255,255,0.35);cursor:pointer;border-bottom:1.5px solid transparent;transition:all 0.2s;}
        .tab.active{color:#fff;border-bottom-color:#ffaa33;}
        #qr-reader{width:100%;border-radius:16px;overflow:hidden;background:#111;}
        #qr-reader video{width:100%!important;border-radius:16px;}
        .camera-error{background:rgba(255,80,80,0.08);border:0.5px solid rgba(255,80,80,0.2);border-radius:12px;padding:20px;color:#ff8888;font-size:14px;text-align:center;}
        .manual-form{display:flex;flex-direction:column;gap:10px;}
        .manual-input{background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.12);border-radius:10px;padding:14px;color:#fff;font-size:15px;font-family:'Syne',sans-serif;outline:none;width:100%;}
        .manual-input:focus{border-color:rgba(255,170,51,0.4);}
        .manual-btn{background:#ffaa33;color:#000;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;}
        .result{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);width:calc(100% - 48px);max-width:440px;border-radius:16px;padding:20px;z-index:200;animation:slideUp 0.3s cubic-bezier(0.16,1,0.3,1);}
        .result.valid{background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.35);}
        .result.invalid{background:rgba(255,80,80,0.12);border:1px solid rgba(255,80,80,0.35);}
        .result-icon{font-size:28px;margin-bottom:6px;}
        .result-title{font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:#fff;text-transform:uppercase;}
        .result-sub{font-size:13px;color:rgba(255,255,255,0.55);margin-top:2px;}
        @keyframes slideUp{from{transform:translate(-50%,20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
      `}</style>

      <nav>
        <button className="nav-back" onClick={() => router.push('/host')}>
          <i className="ti ti-arrow-left" style={{fontSize:'14px'}} aria-hidden="true"/>
          Dashboard
        </button>
        <button className="logo" onClick={() => router.push('/')}>
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        <div style={{width:'60px'}}/>
      </nav>

      <div className="wrap">
        <div className="event-title">{event?.title ?? 'Loading...'}</div>
        <div className="counter">
          <span className="counter-num">{checkedInCount}</span>
          <span className="counter-label">/ {totalCount} checked in</span>
        </div>

        <div className="tabs">
          <div className={`tab ${tab === 'camera' ? 'active' : ''}`} onClick={() => setTab('camera')}>Camera</div>
          <div className={`tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>Manual</div>
        </div>

        {tab === 'camera' && (
          <>
            {cameraError ? (
              <div className="camera-error">
                <i className="ti ti-camera-off" style={{fontSize:'24px',display:'block',margin:'0 auto 8px'}} aria-hidden="true"/>
                {cameraError}
                <br/>
                <small style={{opacity:0.6}}>Switch to Manual tab to enter codes directly</small>
              </div>
            ) : (
              <div id="qr-reader"/>
            )}
          </>
        )}

        {tab === 'manual' && (
          <div className="manual-form">
            <input
              className="manual-input"
              placeholder="Paste QR code or ticket ID"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              autoFocus
            />
            <button className="manual-btn" onClick={handleManualSubmit} disabled={!manualCode.trim()}>
              Check in
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className={`result ${result.valid ? 'valid' : 'invalid'}`}>
          {result.valid ? (
            <>
              <div className="result-icon">✓</div>
              <div className="result-title">{result.holder_name ?? 'Checked in'}</div>
              <div className="result-sub">
                {result.tier_name}{result.is_guestlist ? ' · GL' : ''}
              </div>
            </>
          ) : (
            <>
              <div className="result-icon" style={{color:'#ff8888'}}>✕</div>
              <div className="result-title" style={{color:'#ff8888'}}>
                {result.error === 'Already checked in' ? 'Already used' : 'Invalid ticket'}
              </div>
              <div className="result-sub">{result.error}</div>
            </>
          )}
        </div>
      )}
    </>
  )
}