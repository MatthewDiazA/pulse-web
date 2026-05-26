// app/api/pageview/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — record a page view
export async function POST(request: Request) {
  try {
    const { page, event_id, referrer } = await request.json()
    if (!page) return NextResponse.json({ error: 'Missing page' }, { status: 400 })

    await supabase.from('page_views').insert({
      page,
      event_id: event_id || null,
      referrer: referrer || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 255) || null,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — fetch view counts (for admin/host dashboard)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const event_id = searchParams.get('event_id')
    const period = searchParams.get('period') || '30d'

    const daysAgo = period === '7d' ? 7 : period === '24h' ? 1 : 30
    const since = new Date(Date.now() - daysAgo * 86400000).toISOString()

    if (event_id) {
      // Event-specific views
      const { count: total } = await supabase
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event_id)

      const { count: recent } = await supabase
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event_id)
        .gte('created_at', since)

      // Today's views
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const { count: today } = await supabase
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event_id)
        .gte('created_at', todayStart.toISOString())

      return NextResponse.json({ total, recent, today, period })
    }

    // Site-wide views
    const { count: total } = await supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })

    const { count: recent } = await supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count: today } = await supabase
      .from('page_views')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())

    // Per-page breakdown
    const { data: pages } = await supabase
      .from('page_views')
      .select('page')
      .gte('created_at', since)

    const pageCounts: Record<string, number> = {}
    for (const p of pages ?? []) {
      pageCounts[p.page] = (pageCounts[p.page] || 0) + 1
    }

    // Per-event breakdown
    const { data: eventViews } = await supabase
      .from('page_views')
      .select('event_id, events(title)')
      .not('event_id', 'is', null)
      .gte('created_at', since)

    const eventCounts: Record<string, { title: string; count: number }> = {}
    for (const v of eventViews ?? []) {
      const eid = v.event_id as string
      if (!eventCounts[eid]) eventCounts[eid] = { title: (v.events as any)?.title ?? 'Unknown', count: 0 }
      eventCounts[eid].count++
    }

    return NextResponse.json({
      total,
      recent,
      today,
      period,
      pages: pageCounts,
      events: Object.values(eventCounts).sort((a, b) => b.count - a.count),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}