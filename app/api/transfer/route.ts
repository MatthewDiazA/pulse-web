import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/transfer — generate a one-time transfer token
export async function POST(request: Request) {
  try {
    const { ticket_id, user_id } = await request.json()

    // Verify ownership
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, user_id, is_transferred, is_checked_in, event_id, tier_id')
      .eq('id', ticket_id)
      .single()

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    if (ticket.user_id !== user_id) return NextResponse.json({ error: 'Not your ticket' }, { status: 403 })
    if (ticket.is_transferred) return NextResponse.json({ error: 'Already transferred' }, { status: 400 })
    if (ticket.is_checked_in) return NextResponse.json({ error: 'Already used at door' }, { status: 400 })

    // Generate token
    const token = `TXF-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 48h

    const { error } = await supabase.from('ticket_transfers').insert({
      ticket_id,
      from_user_id: user_id,
      token,
      expires_at: expiresAt,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ token, expires_at: expiresAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET /api/transfer?token=... — claim a transfer
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const claimUserId = searchParams.get('userId')
    if (!token || !claimUserId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const { data: transfer } = await supabase
      .from('ticket_transfers')
      .select('*, ticket:tickets(*)')
      .eq('token', token)
      .single()

    if (!transfer) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    if (transfer.claimed_at) return NextResponse.json({ error: 'Already claimed' }, { status: 400 })
    if (new Date(transfer.expires_at) < new Date()) return NextResponse.json({ error: 'Transfer link expired' }, { status: 400 })
    if (transfer.from_user_id === claimUserId) return NextResponse.json({ error: 'Cannot transfer to yourself' }, { status: 400 })

    // Generate new QR for the new owner
    const newQr = `PULSE-TXF-${transfer.ticket_id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Update ticket owner + new QR
    await supabase.from('tickets').update({
      user_id: claimUserId,
      qr_code: newQr,
      is_transferred: true,
    }).eq('id', transfer.ticket_id)

    // Mark transfer claimed
    await supabase.from('ticket_transfers').update({
      claimed_at: new Date().toISOString(),
      to_user_id: claimUserId,
    }).eq('id', transfer.id)

    return NextResponse.json({ success: true, ticket_id: transfer.ticket_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}