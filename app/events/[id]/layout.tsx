// app/events/[id]/layout.tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: event } = await supabase
    .from('events')
    .select('title, tagline, starts_at, venue_name, cover_image_url')
    .eq('id', id)
    .single()

  if (!event) return { title: 'Event · Pulse' }

  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : ''
  const description = (event as any).tagline ?? `${date}${event.venue_name ? ` · ${event.venue_name}` : ''}`
  const ogImage = `${process.env.NEXT_PUBLIC_APP_URL}/api/og?id=${id}`

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