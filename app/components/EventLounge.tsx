'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type LoungeMessage = {
  id: string
  event_id: string
  user_id: string
  user_name: string
  user_avatar: string
  content: string
  is_pinned: boolean
  created_at: string
}

const AVATARS = [
  { id: 'flame', emoji: '🔥', bg: 'rgba(255,100,0,0.15)' },
  { id: 'skull', emoji: '💀', bg: 'rgba(255,255,255,0.08)' },
  { id: 'alien', emoji: '👽', bg: 'rgba(100,255,100,0.1)' },
  { id: 'ghost', emoji: '👻', bg: 'rgba(255,255,255,0.1)' },
  { id: 'devil', emoji: '😈', bg: 'rgba(150,50,255,0.12)' },
  { id: 'star', emoji: '⭐', bg: 'rgba(255,200,50,0.12)' },
  { id: 'bolt', emoji: '⚡', bg: 'rgba(255,220,0,0.12)' },
  { id: 'moon', emoji: '🌙', bg: 'rgba(100,150,255,0.1)' },
  { id: 'heart', emoji: '🖤', bg: 'rgba(255,255,255,0.06)' },
  { id: 'crown', emoji: '👑', bg: 'rgba(255,180,0,0.12)' },
  { id: 'eye', emoji: '👁️', bg: 'rgba(100,200,255,0.1)' },
  { id: 'diamond', emoji: '💎', bg: 'rgba(100,200,255,0.12)' },
]

export default function EventLounge({
  eventId,
  eventTitle,
  hostId,
}: {
  eventId: string
  eventTitle: string
  hostId: string
}) {
  const [messages, setMessages] = useState<LoungeMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [user, setUser] = useState<any>(null)
  const [hasTicket, setHasTicket] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
  const [showPicker, setShowPicker] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch user, check ticket, check admin
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
        if (data) setMessages(data as LoungeMessage[])
      })

    const channel = supabase
      .channel(`lounge-${eventId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lounge_messages', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const msg = payload.new as LoungeMessage
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
    if (!newMsg.trim() || !user || sending) return
    setSending(true)
    const supabase = createClient()
    const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Anonymous'

    await supabase.from('lounge_messages').insert({
      event_id: eventId,
      user_id: user.id,
      user_name: userName,
      user_avatar: selectedAvatar.emoji,
      content: newMsg.trim(),
    })

    setNewMsg('')
    setSending(false)
  }

  const handleDelete = async (msgId: string) => {
    const supabase = createClient()
    await supabase.from('lounge_messages').delete().eq('id', msgId)
  }

  const handlePin = async (msg: LoungeMessage) => {
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
        .lounge-trigger{position:fixed;bottom:24px;right:24px;z-index:900;display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#1a0f00,#0d0800);border:1px solid rgba(255,170,51,0.3);border-radius:100px;padding:14px 22px;cursor:pointer;box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 20px rgba(255,170,51,0.15);transition:all 0.2s;font-family:'Nunito',sans-serif;}
        .lounge-trigger:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,0.7),0 0 30px rgba(255,170,51,0.25);border-color:rgba(255,170,51,0.5);}
        .lounge-trigger:active{transform:scale(0.96);}
        .trigger-text{font-size:14px;font-weight:700;color:#ffaa33;letter-spacing:0.5px;}
        .trigger-dot{width:8px;height:8px;border-radius:50%;background:#ffaa33;animation:triggerPulse 2s ease-in-out infinite;}
        @keyframes triggerPulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        .unread-badge{background:#ff6600;color:#fff;font-size:11px;font-weight:700;min-width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;}

        .lounge-panel{position:fixed;bottom:0;right:0;width:420px;height:600px;max-height:80vh;max-width:100vw;z-index:1000;display:flex;flex-direction:column;background:#080400;border:1px solid rgba(255,170,51,0.15);border-radius:20px 20px 0 0;box-shadow:0 -8px 60px rgba(0,0,0,0.9),0 0 40px rgba(255,170,51,0.05);transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.16,1,0.3,1);overflow:hidden;}
        .lounge-panel.open{transform:translateY(0);}

        .lounge-header{padding:18px 20px 14px;background:linear-gradient(180deg,rgba(255,170,51,0.06) 0%,transparent 100%);border-bottom:0.5px solid rgba(255,170,51,0.1);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
        .lounge-header-left{display:flex;align-items:center;gap:10px;}
        .lounge-icon{width:32px;height:32px;border-radius:10px;background:rgba(255,170,51,0.1);border:0.5px solid rgba(255,170,51,0.2);display:flex;align-items:center;justify-content:center;font-size:16px;}
        .lounge-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:0.5px;}
        .lounge-subtitle{font-size:11px;color:#554;margin-top:1px;}
        .lounge-close{background:none;border:none;color:#554;font-size:20px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:all 0.15s;}
        .lounge-close:hover{background:rgba(255,255,255,0.05);color:#fff;}

        .pinned-bar{padding:10px 20px;background:rgba(255,170,51,0.04);border-bottom:0.5px solid rgba(255,170,51,0.08);flex-shrink:0;}
        .pinned-label{font-size:9px;color:#ffaa33;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;font-weight:600;}
        .pinned-text{font-size:12px;color:#ccc;line-height:1.4;}

        .lounge-messages{flex:1;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:rgba(255,170,51,0.1) transparent;}
        .lounge-messages::-webkit-scrollbar{width:4px;}
        .lounge-messages::-webkit-scrollbar-thumb{background:rgba(255,170,51,0.15);border-radius:4px;}

        .msg{display:flex;gap:8px;padding:6px 0;position:relative;}
        .msg:hover .msg-actions{opacity:1;}
        .msg-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-top:2px;}
        .msg-body{flex:1;min-width:0;}
        .msg-header{display:flex;align-items:baseline;gap:6px;margin-bottom:1px;}
        .msg-name{font-size:12px;font-weight:600;color:#f0f0f0;cursor:pointer;transition:color 0.1s;}
        .msg-name:hover{color:#ffaa33;}
        .msg-name.host{color:#ffaa33;}
        .msg-time{font-size:10px;color:#332;}
        .msg-text{font-size:13px;color:#bbb;line-height:1.5;word-wrap:break-word;}
        .msg-pinned{background:rgba(255,170,51,0.03);border-left:2px solid rgba(255,170,51,0.3);padding-left:10px;margin-left:-10px;}
        .msg-actions{position:absolute;top:4px;right:0;display:flex;gap:4px;opacity:0;transition:opacity 0.15s;}
        .msg-action-btn{background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:4px;padding:2px 6px;font-size:10px;color:#554;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.1s;}
        .msg-action-btn:hover{color:#f0f0f0;background:rgba(255,255,255,0.08);}
        .msg-action-btn.del:hover{color:#ff6666;}

        .lounge-input-area{padding:12px 16px 16px;border-top:0.5px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.4);flex-shrink:0;display:flex;gap:8px;align-items:flex-end;}
        .avatar-pick{width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,170,51,0.25);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;flex-shrink:0;transition:all 0.15s;position:relative;}
        .avatar-pick:hover{border-color:rgba(255,170,51,0.5);}
        .avatar-dropdown{position:absolute;bottom:40px;left:0;background:#1a0f00;border:0.5px solid rgba(255,170,51,0.25);border-radius:12px;padding:8px;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;z-index:50;box-shadow:0 8px 32px rgba(0,0,0,0.8);}
        .av-opt{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;border:1px solid transparent;transition:all 0.1s;}
        .av-opt:hover{transform:scale(1.15);}
        .av-opt.sel{border-color:#ffaa33;background:rgba(255,170,51,0.1);}
        .msg-input{flex:1;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:20px;padding:10px 16px;color:#fff;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;resize:none;max-height:80px;min-height:38px;line-height:1.4;}
        .msg-input:focus{border-color:rgba(255,170,51,0.3);}
        .msg-input::placeholder{color:#443;}
        .send-btn{width:36px;height:36px;border-radius:50%;background:#ffaa33;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.15s;box-shadow:0 0 12px rgba(255,170,51,0.2);}
        .send-btn:hover{box-shadow:0 0 20px rgba(255,170,51,0.4);transform:scale(1.05);}
        .send-btn:active{transform:scale(0.92);}
        .send-btn:disabled{opacity:0.3;cursor:not-allowed;box-shadow:none;}
        .send-arrow{width:16px;height:16px;fill:none;stroke:#000;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}

        .empty-lounge{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#443;padding:40px;}
        .empty-lounge-icon{font-size:32px;opacity:0.3;}
        .empty-lounge-text{font-size:13px;text-align:center;line-height:1.5;}

        @media(max-width:480px){
          .lounge-panel{width:100%;border-radius:16px 16px 0 0;height:70vh;}
          .lounge-trigger{bottom:16px;right:16px;padding:12px 18px;}
        }
      `}</style>

      {/* Floating trigger button */}
      {!isOpen && (
        <div className="lounge-trigger" onClick={() => { setIsOpen(true); setUnread(0) }}>
          <div className="trigger-dot"/>
          <span className="trigger-text">Lounge</span>
          {unread > 0 && <span className="unread-badge">{unread}</span>}
        </div>
      )}

      {/* Chat panel */}
      <div className={`lounge-panel ${isOpen ? 'open' : ''}`}>
        <div className="lounge-header">
          <div className="lounge-header-left">
            <div className="lounge-icon">🎧</div>
            <div>
              <div className="lounge-title">Lounge</div>
              <div className="lounge-subtitle">{messages.length} messages</div>
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

        <div className="lounge-messages" ref={containerRef}>
          {messages.length === 0 ? (
            <div className="empty-lounge">
              <div className="empty-lounge-icon">🎧</div>
              <div className="empty-lounge-text">
                The lounge is empty<br/>
                Say something to the crowd
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
              const avBg = AVATARS.find(a => a.emoji === msg.user_avatar)?.bg ?? 'rgba(255,255,255,0.06)'
              return (
                <div key={msg.id} className={`msg ${msg.is_pinned ? 'msg-pinned' : ''}`}>
                  {showName ? (
                    <div className="msg-avatar" style={{ background: avBg }}>{msg.user_avatar}</div>
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
                          {isMsgHost && <span style={{fontSize:'9px',color:'#ffaa33',marginLeft:'4px',letterSpacing:'0.5px'}}>HOST</span>}
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

        <div className="lounge-input-area">
          <div
            className="avatar-pick"
            style={{ background: selectedAvatar.bg }}
            onClick={() => setShowPicker(!showPicker)}
          >
            {selectedAvatar.emoji}
            {showPicker && (
              <div className="avatar-dropdown" onClick={e => e.stopPropagation()}>
                {AVATARS.map(av => (
                  <div
                    key={av.id}
                    className={`av-opt ${selectedAvatar.id === av.id ? 'sel' : ''}`}
                    style={{ background: av.bg }}
                    onClick={() => { setSelectedAvatar(av); setShowPicker(false) }}
                  >
                    {av.emoji}
                  </div>
                ))}
              </div>
            )}
          </div>
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
          <button className="send-btn" disabled={!newMsg.trim() || sending} onClick={handleSend}>
            <svg className="send-arrow" viewBox="0 0 24 24">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}