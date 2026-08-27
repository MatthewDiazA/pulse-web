'use client'
import { useEffect, useState, useRef } from 'react'
import { useSpringMessage, useMagneticButton } from '../lib/animations'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type ChatMessage = {
  id: string
  event_id: string
  user_id: string
  user_name: string
  user_avatar: string
  content: string
  is_pinned: boolean
  created_at: string
}

// The chat stays live until this many hours after the event start, then dissolves
// into a read-only state. Generous window so it never closes during the night-of.
const CHAT_OPEN_HOURS_AFTER_START = 12

export default function EventLounge({
  eventId,
  eventTitle,
  hostId,
}: {
  eventId: string
  eventTitle: string
  hostId: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [user, setUser] = useState<any>(null)
  const [hasTicket, setHasTicket] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sending, setSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [eventClosed, setEventClosed] = useState(false)
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useSpringMessage<HTMLDivElement>()
  const sendBtnRef = useMagneticButton<HTMLButtonElement>({ strength: 0.25 })

  // Fetch user, check ticket, check admin, determine if the event has closed
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUser(data.user)

      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', data.user.id)
        .eq('event_id', eventId)
      setHasTicket((count ?? 0) > 0)

      const { data: admin } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', data.user.id)
        .single()
      if (admin) setIsAdmin(true)

      const { data: ev } = await supabase
        .from('events')
        .select('starts_at')
        .eq('id', eventId)
        .single()
      const start = ev?.starts_at ? new Date(ev.starts_at).getTime() : null
      if (start !== null) {
        setEventClosed(Date.now() > start + CHAT_OPEN_HOURS_AFTER_START * 3600 * 1000)
      }
    })
  }, [eventId])

  // Fetch messages + subscribe to realtime
  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('lounge_messages')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[])
      })

    const channel = supabase
      .channel(`lounge-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lounge_messages', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const msg = payload.new as ChatMessage
          setMessages(prev => [...prev, msg])
          if (!isOpen) setUnread(u => u + 1)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'lounge_messages', filter: `event_id=eq.${eventId}` },
        (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [eventId, isOpen])

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, isOpen])

  // Hide the page's mobile buy bar while the chat panel is open so the two
  // fixed elements can never stack on top of each other.
  useEffect(() => {
    document.body.classList.toggle('lounge-open', isOpen)
    return () => document.body.classList.remove('lounge-open')
  }, [isOpen])

  const handleSend = async () => {
    if (!newMsg.trim() || !user || sending || eventClosed) return
    setSending(true)
    const supabase = createClient()
    const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Guest'

    await supabase.from('lounge_messages').insert({
      event_id: eventId,
      user_id: user.id,
      user_name: userName,
      user_avatar: '', // avatars are now derived initials; column kept for compatibility
      content: newMsg.trim(),
    })

    setNewMsg('')
    setSending(false)
  }

  const handleDelete = async (msgId: string) => {
    const supabase = createClient()
    await supabase.from('lounge_messages').delete().eq('id', msgId)
  }

  const handlePin = async (msg: ChatMessage) => {
    const supabase = createClient()
    await supabase
      .from('lounge_messages')
      .update({ is_pinned: !msg.is_pinned })
      .eq('id', msg.id)
    setMessages(prev =>
      prev.map(m => (m.id === msg.id ? { ...m, is_pinned: !m.is_pinned } : m)),
    )
  }

  // Don't render if no ticket
  if (!user || !hasTicket) return null

  const pinnedMessages = messages.filter(m => m.is_pinned)
  const isHost = user?.id === hostId
  const canModerate = isHost || isAdmin

  return (
    <>
      <style>{`
        /* Trigger — a label, not a bubble. Square, hairline, no glow. */
        .lounge-trigger{position:fixed;bottom:24px;right:24px;z-index:900;display:inline-flex;align-items:center;gap:10px;background:rgba(0,0,0,0.8);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:0.5px solid rgba(255,255,255,0.22);padding:11px 18px;cursor:pointer;transition:border-color 0.2s,background 0.2s;font-family:'Syne',sans-serif;}
        .lounge-trigger:hover{border-color:rgba(255,255,255,0.5);background:rgba(0,0,0,0.92);}
        .trigger-text{font-size:11px;font-weight:500;color:rgba(255,255,255,0.75);letter-spacing:2.5px;}
        .lounge-trigger.has-unread .trigger-text{color:#fff;}
        .unread-badge{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;color:#ffaa33;letter-spacing:0;line-height:1;}

        .lounge-panel{position:fixed;bottom:0;right:0;width:412px;height:620px;max-height:84vh;max-width:100vw;z-index:1000;display:flex;flex-direction:column;background:#000;border-left:0.5px solid rgba(255,255,255,0.12);border-top:0.5px solid rgba(255,255,255,0.12);transform:translateY(100%);transition:transform 0.38s cubic-bezier(0.16,1,0.3,1);overflow:hidden;}
        .lounge-panel.open{transform:translateY(0);}

        .lounge-header{padding:18px 20px 15px;border-bottom:0.5px solid rgba(255,255,255,0.1);display:flex;align-items:flex-end;justify-content:space-between;flex-shrink:0;}
        .lounge-title{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:700;color:#fff;line-height:0.9;letter-spacing:-0.3px;}
        .lounge-subtitle{font-size:10px;color:rgba(255,255,255,0.3);margin-top:6px;font-family:'Syne',sans-serif;letter-spacing:2px;}
        .lounge-close{background:none;border:none;color:rgba(255,255,255,0.35);font-size:12px;letter-spacing:2px;cursor:pointer;font-family:'Syne',sans-serif;padding:4px 0 4px 12px;transition:color 0.15s;flex-shrink:0;}
        .lounge-close:hover{color:#fff;}

        .pinned-bar{padding:11px 20px;border-bottom:0.5px solid rgba(255,255,255,0.08);flex-shrink:0;display:flex;gap:12px;align-items:baseline;}
        .pinned-label{font-size:9px;color:#ffaa33;letter-spacing:2px;flex-shrink:0;font-family:'Syne',sans-serif;}
        .pinned-text{font-size:12px;color:rgba(255,255,255,0.7);line-height:1.45;font-family:'Syne',sans-serif;}

        .lounge-messages{flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent;}
        .lounge-messages::-webkit-scrollbar{width:3px;}
        .lounge-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);}

        /* Flush left, no avatars, no bubbles — a transcript */
        .msg{padding:5px 0;position:relative;font-family:'Syne',sans-serif;}
        .msg:hover .msg-actions{opacity:1;}
        .msg-header{display:flex;align-items:baseline;gap:9px;margin-bottom:3px;margin-top:8px;}
        .msg-name{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.55);cursor:pointer;transition:color 0.1s;}
        .msg-name:hover{color:#fff;}
        .msg-name.host{color:#ffaa33;}
        .msg-host-tag{font-size:9px;color:#ffaa33;margin-left:7px;letter-spacing:1.5px;font-weight:500;}
        .msg-time{font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:1px;}
        .msg-text{font-size:14px;color:rgba(255,255,255,0.82);line-height:1.5;word-wrap:break-word;}
        .msg-pinned{border-left:1px solid rgba(255,170,51,0.5);padding-left:12px;margin-left:-13px;}
        .msg-actions{position:absolute;top:6px;right:0;display:flex;gap:10px;opacity:0;transition:opacity 0.15s;}
        .msg-action-btn{background:none;border:none;padding:0;font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,0.3);cursor:pointer;font-family:'Syne',sans-serif;transition:color 0.1s;}
        .msg-action-btn:hover{color:#fff;}
        .msg-action-btn.del:hover{color:#ff7070;}

        /* Input — hairline rule, no pill, no circle. Return sends. */
        .lounge-input-area{padding:14px 20px calc(16px + env(safe-area-inset-bottom));border-top:0.5px solid rgba(255,255,255,0.1);flex-shrink:0;display:flex;gap:14px;align-items:flex-end;}
        .msg-input{flex:1;background:none;border:none;padding:6px 0;color:#fff;font-size:14px;font-family:'Syne',sans-serif;outline:none;resize:none;max-height:80px;min-height:26px;line-height:1.45;}
        .msg-input::placeholder{color:rgba(255,255,255,0.25);}
        .send-btn{background:none;border:none;padding:6px 0;font-size:11px;letter-spacing:2.5px;color:rgba(255,255,255,0.3);cursor:pointer;flex-shrink:0;font-family:'Syne',sans-serif;transition:color 0.15s;}
        .send-btn:hover:not(:disabled){color:#ffaa33;}
        .send-btn:disabled{opacity:0.25;cursor:not-allowed;}

        .chat-closed-bar{padding:18px 20px calc(18px + env(safe-area-inset-bottom));border-top:0.5px solid rgba(255,255,255,0.1);flex-shrink:0;color:rgba(255,255,255,0.3);font-size:11px;font-family:'Syne',sans-serif;letter-spacing:1.5px;}

        .empty-lounge{flex:1;display:flex;align-items:center;padding:0;color:rgba(255,255,255,0.22);font-family:'Syne',sans-serif;}
        .empty-lounge-text{font-size:12px;letter-spacing:1.5px;}

        @media(max-width:699px){
          .lounge-panel{width:100%;height:78vh;border-left:none;}
          /* Sit above the event page's buy bar instead of on top of it */
          .lounge-trigger{bottom:calc(82px + env(safe-area-inset-bottom));right:16px;padding:10px 16px;}
        }
      `}</style>

      {/* Floating trigger */}
      {!isOpen && (
        <div className={`lounge-trigger ${unread > 0 ? 'has-unread' : ''}`} onClick={() => { setIsOpen(true); setUnread(0) }}>
          <span className="trigger-text">the chat</span>
          {unread > 0 && <span className="unread-badge">{unread}</span>}
        </div>
      )}

      {/* Chat panel */}
      <div className={`lounge-panel ${isOpen ? 'open' : ''}`}>
        <div className="lounge-header">
          <div style={{ minWidth: 0 }}>
            <div className="lounge-title">the chat</div>
            <div className="lounge-subtitle">
              {eventClosed ? 'closed · read only' : `${messages.length} message${messages.length === 1 ? '' : 's'}`}
            </div>
          </div>
          <button className="lounge-close" onClick={() => setIsOpen(false)}>close</button>
        </div>

        {pinnedMessages.length > 0 && (
          <div className="pinned-bar">
            <div className="pinned-label">pinned</div>
            <div className="pinned-text">{pinnedMessages[pinnedMessages.length - 1].content}</div>
          </div>
        )}

        <div className="lounge-messages" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="empty-lounge">
              <div className="empty-lounge-text">no one has said anything yet.</div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMe = msg.user_id === user?.id
              const isMsgHost = msg.user_id === hostId
              const showName = i === 0 || messages[i - 1].user_id !== msg.user_id
              const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'UTC',
              }).toLowerCase()
              return (
                <div key={msg.id} className={`msg ${msg.is_pinned ? 'msg-pinned' : ''}`}>
                  {showName && (
                    <div className="msg-header">
                      <span
                        className={`msg-name ${isMsgHost ? 'host' : ''}`}
                        onClick={() => {
                          if (!isMe) router.push(`/connect/whisper/${msg.user_id}?event=${eventId}`)
                        }}
                        title={isMe ? '' : `Whisper ${msg.user_name}`}
                      >
                        {msg.user_name}
                        {isMsgHost && <span className="msg-host-tag">host</span>}
                      </span>
                      <span className="msg-time">{time}</span>
                    </div>
                  )}
                  <div className="msg-text">{msg.content}</div>
                  {(isMe || canModerate) && (
                    <div className="msg-actions">
                      {canModerate && (
                        <button className="msg-action-btn" onClick={() => handlePin(msg)}>
                          {msg.is_pinned ? 'unpin' : 'pin'}
                        </button>
                      )}
                      <button className="msg-action-btn del" onClick={() => handleDelete(msg.id)}>delete</button>
                    </div>
                  )}
                </div>
              )
            })
          )}
          <div ref={bottomRef}/>
        </div>

        {eventClosed ? (
          <div className="chat-closed-bar">
            this chat has closed for {eventTitle.toLowerCase()}.
          </div>
        ) : (
          <div className="lounge-input-area">
            <textarea
              className="msg-input"
              placeholder="say something"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              maxLength={500}
              rows={1}
            />
            <button ref={sendBtnRef} className="send-btn" disabled={!newMsg.trim() || sending} onClick={handleSend}>
              {sending ? '···' : 'send'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}