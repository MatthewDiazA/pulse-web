'use client'
import { useEffect, useRef } from 'react'

interface FrequencyVisualizerProps {
  audio: HTMLAudioElement | null
  playing: boolean
  color?: string
  bars?: number
  height?: number
}

export default function FrequencyVisualizer({
  audio,
  playing,
  color = '#ffaa33',
  bars = 5,
  height = 16,
}: FrequencyVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!audio || !playing) {
      cancelAnimationFrame(rafRef.current)
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return

    // Create audio context and analyser once
    if (!ctxRef.current) {
      try {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch { return }
    }

    const audioCtx = ctxRef.current

    if (!sourceRef.current) {
      try {
        sourceRef.current = audioCtx.createMediaElementSource(audio)
        analyserRef.current = audioCtx.createAnalyser()
        analyserRef.current.fftSize = 64
        sourceRef.current.connect(analyserRef.current)
        analyserRef.current.connect(audioCtx.destination)
      } catch { return }
    }

    const analyser = analyserRef.current
    if (!analyser) return
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const W = canvas.width
    const H = canvas.height
    const barW = W / bars - 2

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      ctx2d.clearRect(0, 0, W, H)

      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * dataArray.length)
        const val = dataArray[idx] / 255
        const barH = Math.max(3, val * H)
        const x = i * (barW + 2)
        const y = (H - barH) / 2

        // Gradient bar
        const grad = ctx2d.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, color)
        grad.addColorStop(1, color + '88')
        ctx2d.fillStyle = grad
        ctx2d.beginPath()
        ctx2d.roundRect(x, y, barW, barH, 2)
        ctx2d.fill()
      }
    }

    if (audioCtx.state === 'suspended') audioCtx.resume()
    draw()

    return () => cancelAnimationFrame(rafRef.current)
  }, [audio, playing, color, bars, height])

  if (!playing) {
    // Static bars when not playing
    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${height}px` }}>
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            style={{
              width: '3px',
              height: `${[4, 10, 7, 14, 6][i % 5]}px`,
              background: color,
              borderRadius: '2px',
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={bars * 5}
      height={height}
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  )
}