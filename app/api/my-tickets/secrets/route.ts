// app/api/my-tickets/secrets/route.ts
// Live-QR secrets for the signed-in user's own tickets. The qr_secret column is hidden
// from browser reads (tickets are otherwise public), so the account page gets them here.
import { NextResponse } from 'next/server'
import { admin } from '../../../lib/guestTickets'
import { requestUser } from '../../../lib/hostAuth'

export async function POST(request: Request) {
  const user = await requestUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await admin.from('tickets').select('id, qr_secret').eq('user_id', user.id).not('qr_secret', 'is', null)
  const secrets: Record<string, string> = {}
  for (const t of data ?? []) secrets[t.id] = t.qr_secret
  return NextResponse.json({ secrets })
}
