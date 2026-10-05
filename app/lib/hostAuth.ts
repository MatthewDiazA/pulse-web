// Server-only: who is calling, and may they manage this event?
// Callers send their Supabase session token as `Authorization: Bearer <token>`;
// never trust a user id from the request body.
import { admin } from './guestTickets'

// Site owner — matches the override on the event page
const OWNER_EMAIL = 'mad2288@columbia.edu'

export async function requestUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await admin.auth.getUser(token)
  return user ?? null
}

/** The signed-in user if they host this event (or are an admin), else null. */
export async function requireEventHost(request: Request, eventId: string | null | undefined) {
  if (!eventId) return null
  const user = await requestUser(request)
  if (!user) return null
  if (user.email === OWNER_EMAIL) return user
  const { data: ev } = await admin.from('events').select('host_id').eq('id', eventId).single()
  if (ev?.host_id === user.id) return user
  const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return isAdmin ? user : null
}
