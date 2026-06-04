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

const initialsOf = (name: string) =>
  (name || 'G').trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)

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

  const ChatIcon = ({ size = 16, color = '#ffaa33', opacity = 1 }: { size?: number; color?: string; opacity?: number }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity }}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )

  return (
    <>
      <style>{`
        .lounge-trigger{position:fixed;bottom:24px;right:24px;z-index:900;display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.62);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:0.5px solid rgba(255,255,255,0.14);border-radius:100px;padding:12px 22px;cursor:pointer;box-shadow:0 8px 30px rgba(0,0,0,0.5);transition:transform 0.2s,border-color 0.2s;font-family:'Syne',sans-serif;}
        .lounge-trigger:hover{transform:translateY(-2px);border-color:rgba(255,255,255,0.26);}
        .lounge-trigger:active{transform:scale(0.97);}
        .lounge-trigger.has-unread{border-color:rgba(255,170,51,0.45);}
        .trigger-text{font-size:12px;font-weight:600;color:rgba(255,255,255,0.62);letter-spacing:1.2px;transition:color 0.2s;}
        .lounge-trigger.has-unread .trigger-text{color:#ffaa33;}
        .unread-badge{background:#ffaa33;color:#000;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;padding:0 5px;}

        .lounge-panel{position:fixed;bottom:0;right:0;width:412px;height:600px;max-height:82vh;max-width:100vw;z-index:1000;display:flex;flex-direction:column;background:#070400;border:0.5px solid rgba(255,255,255,0.08);border-radius:18px 18px 0 0;box-shadow:0 -8px 60px rgba(0,0,0,0.85);transform:translateY(100%);transition:transform 0.38s cubic-bezier(0.16,1,0.3,1);overflow:hidden;}
        .lounge-panel.open{transform:translateY(0);}

        .lounge-header{padding:17px 20px 14px;border-bottom:0.5px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
        .lounge-header-left{display:flex;align-items:center;gap:11px;min-width:0;}
        .lounge-icon{width:32px;height:32px;border-radius:9px;background:rgba(255,170,51,0.08);border:0.5px solid rgba(255,170,51,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .lounge-title{font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.5px;line-height:1;}
        .lounge-subtitle{font-size:11px;color:rgba(255,255,255,0.3);margin-top:3px;font-family:'Syne',sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .lounge-close{background:none;border:none;color:rgba(255,255,255,0.3);font-size:22px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:all 0.15s;flex-shrink:0;line-height:1;}
        .lounge-close:hover{background:rgba(255,255,255,0.05);color:#fff;}

        .pinned-bar{padding:10px 20px;background:rgba(255,170,51,0.035);border-bottom:0.5px solid rgba(255,170,51,0.08);flex-shrink:0;}
        .pinned-label{font-size:9px;color:#ffaa33;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;font-weight:700;font-family:'Barlow Condensed',sans-serif;}
        .pinned-text{font-size:12px;color:rgba(255,255,255,0.7);line-height:1.4;font-family:'Syne',sans-serif;}

        .lounge-messages{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent;}
        .lounge-messages::-webkit-scrollbar{width:4px;}
        .lounge-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px;}

        .msg{display:flex;gap:9px;padding:6px 0;position:relative;font-family:'Syne',sans-serif;}
        .msg:hover .msg-actions{opacity:1;}
        .msg-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:2px;background:rgba(255,170,51,0.1);border:0.5px solid rgba(255,170,51,0.2);color:rgba(255,170,51,0.8);letter-spacing:0.3px;}
        .msg-body{flex:1;min-width:0;}
        .msg-header{display:flex;align-items:baseline;gap:7px;margin-bottom:2px;}
        .msg-name{font-size:12px;font-weight:700;color:#f0f0f0;cursor:pointer;transition:color 0.1s;}
        .msg-name:hover{color:#ffaa33;}
        .msg-name.host{color:#ffaa33;}
        .msg-host-tag{font-size:8px;color:#ffaa33;margin-left:5px;letter-spacing:1.5px;font-weight:700;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;}
        .msg-time{font-size:10px;color:rgba(255,255,255,0.18);}
        .msg-text{font-size:13px;color:rgba(255,255,255,0.72);line-height:1.5;word-wrap:break-word;}
        .msg-pinned{background:rgba(255,170,51,0.03);border-left:2px solid rgba(255,170,51,0.3);padding-left:11px;margin-left:-11px;}
        .msg-actions{position:absolute;top:4px;right:0;display:flex;gap:4px;opacity:0;transition:opacity 0.15s;}
        .msg-action-btn{background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:5px;padding:2px 7px;font-size:10px;color:rgba(255,255,255,0.4);cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.1s;}
        .msg-action-btn:hover{color:#f0f0f0;background:rgba(255,255,255,0.08);}
        .msg-action-btn.del:hover{color:#ff6666;}

        .lounge-input-area{padding:12px 16px 16px;border-top:0.5px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.3);flex-shrink:0;display:flex;gap:9px;align-items:flex-end;}
        .msg-input{flex:1;background:rgba(255,255,255,0.045);border:0.5px solid rgba(255,255,255,0.1);border-radius:20px;padding:10px 16px;color:#fff;font-size:13px;font-family:'Syne',sans-serif;outline:none;resize:none;max-height:80px;min-height:38px;line-height:1.4;transition:border-color 0.15s;}
        .msg-input:focus{border-color:rgba(255,170,51,0.3);}
        .msg-input::placeholder{color:rgba(255,255,255,0.22);}
        .send-btn{width:36px;height:36px;border-radius:50%;background:#ffaa33;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform 0.15s;}
        .send-btn:hover{transform:scale(1.06);}
        .send-btn:active{transform:scale(0.92);}
        .send-btn:disabled{opacity:0.3;cursor:not-allowed;}
        .send-arrow{width:16px;height:16px;fill:none;stroke:#000;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}

        .chat-closed-bar{padding:16px 20px;border-top:0.5px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.3);flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:8px;color:rgba(255,255,255,0.32);font-size:12px;font-family:'Syne',sans-serif;letter-spacing:0.2px;}

        .empty-lounge{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:rgba(255,255,255,0.25);padding:40px;font-family:'Syne',sans-serif;}
        .empty-lounge-text{font-size:13px;text-align:center;line-height:1.6;}

        @media(max-width:480px){
          .lounge-panel{width:100%;border-radius:14px 14px 0 0;height:72vh;}
          .lounge-trigger{bottom:16px;right:16px;padding:12px 17px;}
        }
      `}</style>

      {/* Floating trigger button */}
      {!isOpen && (
        <div className={`lounge-trigger ${unread > 0 ? 'has-unread' : ''}`} onClick={() => { setIsOpen(true); setUnread(0) }}>
          <span className="trigger-text">the Chat</span>
          {unread > 0 && <span className="unread-badge">{unread}</span>}
        </div>
      )}

      {/* Chat panel */}
      <div className={`lounge-panel ${isOpen ? 'open' : ''}`}>
        <div className="lounge-header">
          <div className="lounge-header-left">
            <div className="lounge-icon"><ChatIcon size={16}/></div>
            <div style={{ minWidth: 0 }}>
              <div className="lounge-title">the Chat</div>
              <div className="lounge-subtitle">
                {eventClosed ? 'Closed · read only' : `${messages.length} message${messages.length === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>
          <button className="lounge-close" onClick={() => setIsOpen(false)}>×</button>
        </div>

        {pinnedMessages.length > 0 && (
          <div className="pinned-bar">
            <div className="pinned-label">Pinned</div>
            <div className="pinned-text">{pinnedMessages[pinnedMessages.length - 1].content}</div>
          </div>
        )}

        <div className="lounge-messages" ref={messagesRef}>
          {messages.length === 0 ? (
            <div className="empty-lounge">
              <ChatIcon size={30} color="rgba(255,255,255,0.25)"/>
              <div className="empty-lounge-text">
                No messages yet.<br/>Say something to the room.
              </div>
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
              })
              return (
                <div key={msg.id} className={`msg ${msg.is_pinned ? 'msg-pinned' : ''}`}>
                  {showName ? (
                    <div className="msg-avatar">{initialsOf(msg.user_name)}</div>
                  ) : (
                    <div style={{ width: 28, flexShrink: 0 }}/>
                  )}
                  <div className="msg-body">
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
                          {isMsgHost && <span className="msg-host-tag">Host</span>}
                        </span>
                        <span className="msg-time">{time}</span>
                      </div>
                    )}
                    <div className="msg-text">{msg.content}</div>
                  </div>
                  {(isMe || canModerate) && (
                    <div className="msg-actions">
                      {canModerate && (
                        <button className="msg-action-btn" onClick={() => handlePin(msg)}>
                          {msg.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                      )}
                      <button className="msg-action-btn del" onClick={() => handleDelete(msg.id)}>×</button>
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
            This chat has closed for {eventTitle}.
          </div>
        ) : (
          <div className="lounge-input-area">
            <textarea
              className="msg-input"
              placeholder="Say something..."
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
              <svg className="send-arrow" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  )
}