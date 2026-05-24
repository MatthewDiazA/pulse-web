// app/events/[id]/layout.tsx
// Adds OG meta tags for sharing cards — place next to page.tsx
import { createClient } from '../../lib/supabase/server'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: event } = await supabase
    .from('events')
    .select('title, tagline, starts_at, venue_name, city, cover_image_url')
    .eq('id', params.id)
    .single()

  if (!event) return { title: 'Event · Pulse' }

  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ''
  const description = event.tagline ?? `${date}${event.venue_name ? ` · ${event.venue_name}` : ''}`
  const ogImage = `${process.env.NEXT_PUBLIC_APP_URL}/api/og?id=${params.id}`

  return {
    title: `${event.title} · Pulse`,
    description,
    openGraph: {
      title: event.title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: [ogImage],
    },
  }
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}