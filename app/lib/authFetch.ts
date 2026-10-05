// Client: fetch with the signed-in user's session token, for host-only API routes.
import { createClient } from './supabase/client'

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await createClient().auth.getSession()
  const headers = new Headers(init.headers)
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(input, { ...init, headers })
}
