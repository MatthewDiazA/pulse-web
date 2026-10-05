// app/api/promo/route.ts
// Buyer checks a promo code before checkout. Checkout re-validates it server-side regardless.
import { NextResponse } from 'next/server'
import { findUsablePromo, promoLabel } from '../../lib/promo'

export async function POST(request: Request) {
  try {
    const { eventId, code } = await request.json()
    if (!eventId) return NextResponse.json({ error: 'Missing event' }, { status: 400 })
    const found = await findUsablePromo(eventId, code)
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: 404 })
    const { promo } = found
    return NextResponse.json({ code: promo.code, kind: promo.kind, value: Number(promo.value), label: promoLabel(promo) })
  } catch {
    return NextResponse.json({ error: 'Couldn’t check that code. Try again.' }, { status: 500 })
  }
}
