// Pull an accent palette out of an event's cover image so each event page
// is tinted by its own flyer instead of a fixed brand color.

export type FlyerPalette = {
  accent: string // main accent, tuned to read on black
  accent2: string // a second hue from the flyer (or a shade of the first)
  ink: string // text color that sits on top of `accent`
  rgb: string // "r,g,b" of accent, for rgba() in CSS
}

// Used before the image loads, and for flyers with no real color (b&w, missing)
export const NEUTRAL_PALETTE: FlyerPalette = { accent: '#ece6da', accent2: '#8e8a82', ink: '#0a0a0a', rgb: '236,230,218' }

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

const hex = ([r, g, b]: [number, number, number]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

// Push a flyer hue into a range that glows on a black page: vivid, never muddy or neon-blinding
function tune(h: number, s: number, l: number): [number, number, number] {
  return hslToRgb(h, Math.min(0.95, Math.max(0.6, s)), Math.min(0.7, Math.max(0.58, l)))
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export function paletteFromImage(img: HTMLImageElement): FlyerPalette {
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return NEUTRAL_PALETTE
  ctx.drawImage(img, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size) // throws if the image is cross-origin tainted

  // Hue histogram weighted by how colorful each pixel is; greys, blacks and whites don't vote
  const BUCKETS = 24
  const weight = new Array(BUCKETS).fill(0)
  const sum = Array.from({ length: BUCKETS }, () => [0, 0, 0])
  let colorful = 0
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
    if (s < 0.3 || l < 0.12 || l > 0.88) continue
    // Cubed saturation: a few vivid pixels outvote a big dull background (beige walls, skin, haze)
    const w = s ** 3 * (1 - Math.abs(l - 0.5) * 1.4)
    const b = Math.floor(h / (360 / BUCKETS)) % BUCKETS
    weight[b] += w
    sum[b][0] += h * w; sum[b][1] += s * w; sum[b][2] += l * w
    colorful++
  }
  if (colorful < (size * size) * 0.04) return NEUTRAL_PALETTE

  const order = weight.map((w, i) => [w, i] as const).sort((a, b) => b[0] - a[0])
  const avg = (b: number): [number, number, number] => [sum[b][0] / weight[b], sum[b][1] / weight[b], sum[b][2] / weight[b]]

  const first = avg(order[0][1])
  const accentRgb = tune(...first)

  // Second color: the strongest hue at least ~50° away from the first, if it carries real weight
  const firstBucket = order[0][1]
  const other = order.find(([w, b]) => {
    const dist = Math.min(Math.abs(b - firstBucket), BUCKETS - Math.abs(b - firstBucket)) * (360 / BUCKETS)
    return dist >= 50 && w > order[0][0] * 0.15
  })
  const accent2Rgb = other ? tune(...avg(other[1])) : hslToRgb(first[0], 0.55, 0.38)

  return {
    accent: hex(accentRgb),
    accent2: hex(accent2Rgb),
    ink: luminance(accentRgb) > 0.4 ? '#0a0a0a' : '#ffffff',
    rgb: accentRgb.join(','),
  }
}

export function loadFlyerPalette(url: string): Promise<FlyerPalette> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { try { resolve(paletteFromImage(img)) } catch { resolve(NEUTRAL_PALETTE) } }
    img.onerror = () => resolve(NEUTRAL_PALETTE)
    img.src = url
  })
}
