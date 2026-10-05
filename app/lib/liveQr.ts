// Live (rotating) ticket QR codes — the anti-screenshot system.
// Each ticket has a random qr_secret. The holder's ticket page shows
//   P1:<ticketId>:<window>:<sig>   where window = 20-second slot, sig = HMAC(secret, id:window)
// so a screenshot stops scanning within about a minute. Runs on Web Crypto,
// which exists both in the browser (https) and in Node, so client and server share it.

export const QR_STEP_SECONDS = 20
// Windows accepted at the door, relative to now: covers slow scanners and slightly-off phone clocks
const ACCEPT_PAST = 2
const ACCEPT_FUTURE = 1

const enc = new TextEncoder()
const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')

export const qrWindow = (ms = Date.now()) => Math.floor(ms / 1000 / QR_STEP_SECONDS)

export function newQrSecret(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer)
}

async function sign(secret: string, ticketId: string, window: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`${ticketId}:${window}`))).slice(0, 16)
}

export async function liveCode(ticketId: string, secret: string, ms = Date.now()): Promise<string> {
  const w = qrWindow(ms)
  return `P1:${ticketId}:${w}:${await sign(secret, ticketId, w)}`
}

export function parseLiveCode(code: string): { ticketId: string; window: number; sig: string } | null {
  const m = code.trim().match(/^P1:([0-9a-f-]{36}):(\d+):([0-9a-f]{16})$/i)
  return m ? { ticketId: m[1], window: parseInt(m[2]), sig: m[3].toLowerCase() } : null
}

/** 'ok' | 'expired' (right ticket, stale code — a screenshot) | 'bad' (forged / corrupted) */
export async function checkLiveCode(parsed: { ticketId: string; window: number; sig: string }, secret: string): Promise<'ok' | 'expired' | 'bad'> {
  if ((await sign(secret, parsed.ticketId, parsed.window)) !== parsed.sig) return 'bad'
  const now = qrWindow()
  return parsed.window >= now - ACCEPT_PAST && parsed.window <= now + ACCEPT_FUTURE ? 'ok' : 'expired'
}
