// Home: events are fetched on the server so the page arrives with them already in it
// (no blank skeleton while the browser boots, then queries Supabase).
import { createClient } from '@supabase/supabase-js'
import HomeClient, { type HomeEvent } from './HomeClient'

// Rebuild the cached page at most every 30s, so new/edited events show up quickly
export const revalidate = 30

export default async function Home() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data } = await supabase
    .from('events')
    .select('id, title, category, starts_at, venue_name, city, cover_image_url, ticket_tiers(id, price, quantity, name)')
    .eq('status', 'published')
    .order('starts_at', { ascending: true })

  return <HomeClient initialEvents={(data ?? []) as unknown as HomeEvent[]}/>
}
