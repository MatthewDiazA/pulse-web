import { NextResponse } from 'next/server'
import { createClient } from '../../lib/supabase/server'
import { linkGuestTickets } from '../../lib/guestTickets'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data } = await supabase.auth.exchangeCodeForSession(code)
    // Email just confirmed — move any tickets they got as a guest into the new account
    const user = data?.user
    if (user?.email && user.email_confirmed_at) {
      try { await linkGuestTickets(user.id, user.email) } catch (e) { console.error('Ticket linking failed:', e) }
    }
  }

  return NextResponse.redirect(`${origin}/`)
}