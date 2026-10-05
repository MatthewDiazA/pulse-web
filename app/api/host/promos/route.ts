// app/api/host/promos/route.ts
// Host manages an event's promo codes: list, create, pause/resume, delete. Host/admin only.
import { NextResponse } from 'next/server'
import { admin } from '../../../lib/guestTickets'
import { requireEventHost } from '../../../lib/hostAuth'
import { normalizeCode } from '../../../lib/promo'

const forbidden = () => NextResponse.json({ error: 'Only the host can manage promo codes.' }, { status: 403 })

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('eventId')
  if (!(await requireEventHost(request, eventId))) return forbidden()
  const { data } = await admin.from('promo_codes').select('*').eq('event_id', eventId!).order('created_at', { ascending: false })
  return NextResponse.json({ promos: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await requireEventHost(request, body.eventId)
  if (!user) return forbidden()

  const code = normalizeCode(body.code)
  const kind = body.kind === 'amount' ? 'amount' : 'percent'
  const value = Number(body.value)
  const maxUses = body.max_uses === '' || body.max_uses === null || body.max_uses === undefined ? null : parseInt(String(body.max_uses))
  const expiresAt = body.expires_at ? new Date(body.expires_at) : null

  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return NextResponse.json({ error: 'Codes are 3–24 letters or numbers, no spaces.' }, { status: 400 })
  if (!(value > 0) || (kind === 'percent' && value > 100)) return NextResponse.json({ error: kind === 'percent' ? 'Pick a discount between 1% and 100%.' : 'Enter a dollar amount above $0.' }, { status: 400 })
  if (maxUses !== null && !(maxUses > 0)) return NextResponse.json({ error: 'Usage limit must be at least 1, or leave it empty.' }, { status: 400 })
  if (expiresAt && isNaN(expiresAt.getTime())) return NextResponse.json({ error: 'That expiry date isn’t valid.' }, { status: 400 })

  const { data, error } = await admin.from('promo_codes').insert({
    event_id: body.eventId,
    code,
    kind,
    value,
    max_uses: maxUses,
    expires_at: expiresAt ? expiresAt.toISOString() : null,
    created_by: user.id,
  }).select('*').single()

  if (error) {
    const dupe = error.code === '23505'
    return NextResponse.json({ error: dupe ? 'This event already has that code.' : 'Couldn’t create the code.' }, { status: dupe ? 409 : 500 })
  }
  return NextResponse.json({ promo: data })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  if (!(await requireEventHost(request, body.eventId))) return forbidden()
  const { data } = await admin.from('promo_codes').update({ active: !!body.active }).eq('id', body.id).eq('event_id', body.eventId).select('*').single()
  return NextResponse.json({ promo: data })
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  if (!(await requireEventHost(request, eventId))) return forbidden()
  await admin.from('promo_codes').delete().eq('id', searchParams.get('id') ?? '').eq('event_id', eventId!)
  return NextResponse.json({ success: true })
}
