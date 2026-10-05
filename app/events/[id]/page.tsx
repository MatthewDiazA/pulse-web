// Event page: fetched on the server and cached briefly, so it opens with the poster already
// in place — Home/Discover prefetch it, and the tapped flyer morphs straight into the poster.
import { createClient } from '@supabase/supabase-js'
import EventClient, { type EventData } from './EventClient'

// Rebuilt at most every 30s; the client refreshes ticket availability right after it opens
export const revalidate = 30

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await supabase.from('events').select('*, ticket_tiers(*)').eq('id', id).maybeSingle()
  return <EventClient initialEvent={(data as unknown as EventData) ?? null}/>
}
