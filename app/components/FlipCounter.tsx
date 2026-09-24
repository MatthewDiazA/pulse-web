'use client'
import { useState } from 'react'

// Split-flap style number picker (old flip-clock look). Two digits, − / + controls.

function FlipDigit({ digit }: { digit: string }) {
  const [state, setState] = useState({ cur: digit, prev: digit, n: 0 })

  // Adjust state during render when the digit changes (kicks off a new flip)
  if (state.cur !== digit) setState({ cur: digit, prev: state.cur, n: state.n + 1 })

  const { cur, prev, n } = state
  return (
    <div className="fc-card">
      <div className="fc-half fc-top"><span>{cur}</span></div>
      <div className="fc-half fc-bottom"><span>{n ? prev : cur}</span></div>
      {n > 0 && (
        <div key={n}>
          <div className="fc-half fc-top fc-flap-top"><span>{prev}</span></div>
          <div className="fc-half fc-bottom fc-flap-bottom"><span>{cur}</span></div>
        </div>
      )}
    </div>
  )
}

export default function FlipCounter({
  value,
  onChange,
  min = 1,
  max = 50,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label?: string
}) {
  const digits = String(value).padStart(2, '0').split('')
  return (
    <div className="fc-wrap">
      <style>{`
        .fc-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:18px;}
        .fc-label{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.35);font-family:'Syne',sans-serif;}
        .fc-row{display:flex;align-items:center;gap:14px;}
        .fc-digits{display:flex;gap:5px;perspective:300px;}
        .fc-btn{width:38px;height:38px;border-radius:50%;background:transparent;border:0.5px solid rgba(255,255,255,0.2);color:#fff;font-size:20px;line-height:1;cursor:pointer;font-family:'Syne',sans-serif;transition:border-color 0.15s,opacity 0.15s;}
        .fc-btn:hover:not(:disabled){border-color:#fff;}
        .fc-btn:disabled{opacity:0.25;cursor:default;}
        .fc-card{position:relative;width:44px;height:62px;border-radius:6px;background:#161616;box-shadow:0 4px 14px rgba(0,0,0,0.6),inset 0 0 0 0.5px rgba(255,255,255,0.08);}
        .fc-half{position:absolute;left:0;right:0;height:50%;overflow:hidden;background:#161616;}
        .fc-half span{display:block;height:62px;line-height:62px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:46px;font-weight:700;color:#f4f4f4;}
        .fc-top{top:0;border-radius:6px 6px 0 0;transform-origin:bottom;}
        .fc-bottom{bottom:0;border-radius:0 0 6px 6px;transform-origin:top;border-top:1px solid #000;}
        .fc-bottom span{transform:translateY(-50%);}
        .fc-flap-top{z-index:2;animation:fcTop 0.18s ease-in forwards;backface-visibility:hidden;}
        .fc-flap-bottom{z-index:2;transform:rotateX(90deg);animation:fcBottom 0.18s 0.18s ease-out forwards;backface-visibility:hidden;}
        @keyframes fcTop{to{transform:rotateX(-90deg);}}
        @keyframes fcBottom{to{transform:rotateX(0deg);}}
        @media (prefers-reduced-motion: reduce){.fc-flap-top,.fc-flap-bottom{animation-duration:0.01s;animation-delay:0s;}}
      `}</style>
      {label && <div className="fc-label">{label}</div>}
      <div className="fc-row">
        <button type="button" className="fc-btn" aria-label="Fewer" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <div className="fc-digits" role="status" aria-label={`${value}`}>
          {digits.map((d, i) => <FlipDigit key={i} digit={d} />)}
        </div>
        <button type="button" className="fc-btn" aria-label="More" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  )
}
