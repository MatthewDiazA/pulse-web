'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

type WhisperMsg = {
  id: string
  event_id: string
  sender_id: string
  receiver_id: string
  sender_name: string
  sender_avatar: string
  content: string
  created_at: string
  expires_at: string
}

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  bg: '#000',
} as const

export default function WhisperChat() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState<WhisperMsg[]>([])
  const [user, setUser] = useState<any>(null)
  const [otherName, setOtherName] = useState('User')
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [expiresIn, setExpiresIn] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const otherId = params.id as string
  const eventId = searchParams.get('event') ?? ''

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      // Fetch whisper messages between these two users for this event
      const { data: msgs } = await supabase
        .from('whispers')
        .select('*')
        .eq('event_id', eventId)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })

      if (msgs) {
        setMessages(msgs as WhisperMsg[])
        const otherMsg = msgs.find((m: any) => m.sender_id === otherId)
        if (otherMsg) setOtherName((otherMsg as any).sender_name)

        if (msgs.length > 0) {
          const exp = new Date((msgs[0] as any).expires_at).getTime()
          const diff = exp - Date.now()
          const hrs = Math.max(0, Math.floor(diff / 3600000))
          setExpiresIn(hrs > 0 ? `${hrs}h left` : 'expiring soon')
        }
      }

      // Get other user's name from comments
      const { data: commentData } = await supabase
        .from('comments')
        .select('user_name')
        .eq('user_id', otherId)
        .limit(1)
      if (commentData?.[0]) setOtherName(commentData[0].user_name)

      // Realtime
      const channel = supabase
        .channel(`whisper-${user.id}-${otherId}-${eventId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'whispers',
          filter: `event_id=eq.${eventId}`,
        }, payload => {
          const msg = payload.new as WhisperMsg
          if (
            (msg.sender_id === user.id && msg.receiver_id === otherId) ||
            (msg.sender_id === otherId && msg.receiver_id === user.id)
          ) {
            setMessages(prev => [...prev, msg])
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [otherId, eventId, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Anonymous'

    // Get event end time for expiry
    const { data: event } = await supabase
      .from('events')
      .select('starts_at')
      .eq('id', eventId)
      .single()

    const eventDate = event?.starts_at ? new Date(event.starts_at) : new Date()
    const expiresAt = new Date(eventDate.getTime() + 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('whispers').insert({
      event_id: eventId,
      sender_id: user.id,
      receiver_id: otherId,
      sender_name: userName,
      sender_avatar: '🔥',
      content: newMsg.trim(),
      expires_at: expiresAt,
    })

    setNewMsg('')
    setSending(false)
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'DM Sans',sans-serif;overflow:hidden;}

        .chat-layout{display:flex;flex-direction:column;height:100vh;}
        .chat-header{padding:14px 20px;background:rgba(0,0,0,0.95);display:flex;align-items:center;gap:14px;border-bottom:0.5px solid rgba(255,255,255,0.06);flex-shrink:0;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
        .chat-back{background:none;border:none;color:#665;cursor:pointer;font-size:20px;display:flex;align-items:center;}
        .chat-back:hover{color:#f0f0f0;}
        .chat-av{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#888;}
        .chat-info{flex:1;}
        .chat-name{font-size:16px;font-weight:600;color:#f0f0f0;}
        .chat-ephemeral{font-size:11px;color:${COLORS.accent};display:flex;align-items:center;gap:4px;margin-top:1px;}

        .messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:6px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.05) transparent;}
        .messages::-webkit-scrollbar{width:4px;}
        .messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px;}

        .bubble-wrap{display:flex;}
        .bubble-wrap.mine{justify-content:flex-end;}
        .bubble{max-width:75%;padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.5;word-wrap:break-word;}
        .bubble.theirs{background:rgba(255,255,255,0.06);color:#ccc;border-bottom-left-radius:4px;}
        .bubble.mine{background:rgba(255,170,51,0.15);color:#f0f0f0;border-bottom-right-radius:4px;}
        .bubble-time{font-size:9px;color:#332;margin-top:3px;}
        .bubble-wrap.mine .bubble-time{text-align:right;}

        .input-area{padding:12px 16px 24px;border-top:0.5px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.6);flex-shrink:0;display:flex;gap:8px;align-items:flex-end;}
        .msg-input{flex:1;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:20px;padding:10px 16px;color:#fff;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;resize:none;max-height:80px;min-height:38px;}
        .msg-input:focus{border-color:rgba(255,170,51,0.3);}
        .msg-input::placeholder{color:#443;}
        .send{width:36px;height:36px;border-radius:50%;background:${COLORS.primary};border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.15s;}
        .send:hover{box-shadow:0 0 16px rgba(255,170,51,0.3);}
        .send:active{transform:scale(0.92);}
        .send:disabled{opacity:0.3;cursor:not-allowed;}
        .send svg{width:16px;height:16px;fill:none;stroke:#000;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}

        .empty-whisper{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#443;padding:40px;text-align:center;}
        .empty-whisper-icon{font-size:36px;opacity:0.15;}
        .empty-whisper-text{font-size:13px;line-height:1.5;}
        .empty-whisper-note{font-size:11px;color:#332;max-width:260px;}
      `}</style>

      <div className="chat-layout">
        <div className="chat-header">
          <button className="chat-back" onClick={() => router.push('/connect')}>
            <i className="ti ti-arrow-left" style={{fontSize:'18px'}}/>
          </button>
          <div className="chat-av">{otherName.slice(0, 2).toUpperCase()}</div>
          <div className="chat-info">
            <div className="chat-name">{otherName}</div>
            <div className="chat-ephemeral">
              <i className="ti ti-clock" style={{fontSize:'11px'}}/>
              {expiresIn || 'Ephemeral'}
            </div>
          </div>
        </div>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="empty-whisper">
              <div className="empty-whisper-icon">🤫</div>
              <div className="empty-whisper-text">Start a whisper with {otherName}</div>
              <div className="empty-whisper-note">Messages disappear 24 hours after the event ends</div>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.sender_id === user?.id
              const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
              })
              return (
                <div key={msg.id} className={`bubble-wrap ${isMe ? 'mine' : ''}`}>
                  <div>
                    <div className={`bubble ${isMe ? 'mine' : 'theirs'}`}>{msg.content}</div>
                    <div className="bubble-time">{time}</div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef}/>
        </div>

        <div className="input-area">
          <textarea
            className="msg-input"
            placeholder="Whisper something..."
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            maxLength={500}
            rows={1}
          />
          <button className="send" disabled={!newMsg.trim() || sending} onClick={handleSend}>
            <svg viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}