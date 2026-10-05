// Server-only promo-code logic shared by checkout, the Stripe webhook and the validate endpoint.
// A code belongs to one event; a "use" is one completed order (any ticket quantity).
import { admin } from './guestTickets'

export type Promo = {
  id: string
  event_id: string
  code: string
  kind: 'percent' | 'amount'
  value: number
  max_uses: number | null
  uses: number
  expires_at: string | null
  active: boolean
}

export const normalizeCode = (code: unknown) => (typeof code === 'string' ? code.trim().toUpperCase() : '')

/** The promo if it can be used right now on this event, otherwise a buyer-facing reason. */
export async function findUsablePromo(eventId: string, rawCode: unknown): Promise<{ promo: Promo } | { error: string }> {
  const code = normalizeCode(rawCode)
  if (!code) return { error: 'Enter a promo code.' }
  // Codes are stored uppercase (normalizeCode on create), so typed case doesn't matter
  const { data } = await admin.from('promo_codes').select('*').eq('event_id', eventId).eq('code', code).maybeSingle()
  const promo = data as Promo | null
  if (!promo || !promo.active) return { error: 'That code isn’t valid for this event.' }
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return { error: 'That code has expired.' }
  if (promo.max_uses !== null && promo.uses >= promo.max_uses) return { error: 'That code has been used up.' }
  return { promo }
}

/** Price of one ticket after the code, in dollars (2 decimals, never below 0). */
export function applyPromo(price: number, promo: Pick<Promo, 'kind' | 'value'> | null): number {
  if (!promo) return price
  const off = promo.kind === 'percent' ? price * (Math.min(100, Number(promo.value)) / 100) : Number(promo.value)
  return Math.max(0, Math.round((price - off) * 100) / 100)
}

export const promoLabel = (p: Pick<Promo, 'kind' | 'value'>) =>
  p.kind === 'percent' ? `${Number(p.value)}% off` : `$${Number(p.value)} off each ticket`

/** Count one use (one order). Compare-and-swap so concurrent checkouts don't lose counts. */
export async function recordPromoUse(promoId: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await admin.from('promo_codes').select('uses').eq('id', promoId).maybeSingle()
    if (!data) return
    const { data: done } = await admin.from('promo_codes').update({ uses: data.uses + 1 }).eq('id', promoId).eq('uses', data.uses).select('id').maybeSingle()
    if (done) return
  }
}
