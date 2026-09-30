// app/api/link-tickets/route.ts
// Moves tickets bought/claimed as a guest into the signed-in account whose
// confirmed email matches. Called from the account page on load.
import { NextResponse } from 'next/server'
import { admin, linkGuestTickets } from '../../lib/guestTickets'

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Only a confirmed email proves the person owns that inbox (and the tickets sent to it)
  if (!user.email_confirmed_at) return NextResponse.json({ linked: 0 })

  const linked = await linkGuestTickets(user.id, user.email)
  return NextResponse.json({ linked })
}
