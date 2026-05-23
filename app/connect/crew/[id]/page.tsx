'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

type CrewMsg = {
  id: string
  crew_id: string
  user_id: string
  user_name: string
  user_avatar: string
  content: string
  created_at: string
}

type Member = {
  user_id: string
  role: string
  user_name?: string
}

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  bg: '#000',
} as const

export default function CrewChat() {
  const router = useRouter()
  const params = useParams()
  const [crew, setCrew] = useState<any>(null)
  const [messages, setMessages] = useState<CrewMsg[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [user, setUser] = useState<any>(null)
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const crewId = params.id as string

      // Membership gate — only members can open this crew
      const { data: membership } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', crewId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) {
        router.push('/connect')
        return
      }

      const { data: crewData } = await supabase
        .from('crews')
        .select('*')
        .eq('id', crewId)
        .single()
      if (crewData) setCrew(crewData)

      const { data: msgs } = await supabase
        .from('crew_messages')
        .select('*')
        .eq('crew_id', crewId)
        .order('created_at', { ascending: true })
      if (msgs) setMessages(msgs as CrewMsg[])

      const { data: mems } = await supabase
        .from('crew_members')
        .select('user_id, role, user_name')
        .eq('crew_id', crewId)
      if (mems) setMembers(mems as Member[])

      // Realtime
      const channel = supabase
        .channel(`crew-${crewId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'crew_messages',
          filter: `crew_id=eq.${crewId}`,
        }, payload => {
          setMessages(prev => [...prev, payload.new as CrewMsg])
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }
    load()
  }, [params.id, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    const userName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Anonymous'

    await supabase.from('crew_messages').insert({
      crew_id: params.id,
      user_id: user.id,
      user_name: userName,
      user_avatar: '🔥',
      content: newMsg.trim(),
    })
    setNewMsg('')
    setSending(false)
  }

  const [copied, setCopied] = useState(false)

  const handleInvite = async () => {
    const inviteLink = `${window.location.origin}/connect/crew/${params.id}/join`
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers that block clipboard
      prompt('Copy this invite link:', inviteLink)
    }
  }

  const handleLeave = async () => {
    if (!confirm('Leave this crew?')) return
    const supabase = createClient()
    await supabase.from('crew_members').delete().eq('crew_id', params.id).eq('user_id', user.id)
    router.push('/connect')
  }

  if (!crew) return (
    <div style={{background:'#000',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#665',fontFamily:'DM Sans,sans-serif'}}>
      Loading...
    </div>
  )

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'DM Sans',sans-serif;overflow:hidden;}

        .chat-layout{display:flex;flex-direction:column;height:100vh;}
        .chat-header{padding:14px 20px;background:rgba(0,0,0,0.95);display:flex;align-items:center;gap:14px;border-bottom:0.5px solid rgba(255,170,51,0.1);flex-shrink:0;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
        .chat-back{background:none;border:none;color:#665;cursor:pointer;font-size:20px;display:flex;align-items:center;}
        .chat-back:hover{color:#f0f0f0;}
        .chat-avatar{width:36px;height:36px;border-radius:10px;background:rgba(255,170,51,0.1);border:0.5px solid rgba(255,170,51,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
        .chat-title{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:#fff;text-transform:uppercase;flex:1;}
        .chat-subtitle{font-size:11px;color:#554;margin-top:1px;}
        .members-btn{background:none;border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 12px;font-size:12px;color:#888;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .members-btn:hover{color:#f0f0f0;border-color:rgba(255,255,255,0.2);}

        .messages-area{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:rgba(255,170,51,0.1) transparent;}
        .messages-area::-webkit-scrollbar{width:4px;}
        .messages-area::-webkit-scrollbar-thumb{background:rgba(255,170,51,0.15);border-radius:4px;}

        .msg{display:flex;gap:8px;padding:4px 0;}
        .msg-av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;margin-top:2px;}
        .msg-body{flex:1;min-width:0;}
        .msg-head{display:flex;align-items:baseline;gap:6px;margin-bottom:1px;}
        .msg-name{font-size:12px;font-weight:600;color:#f0f0f0;}
        .msg-time{font-size:10px;color:#332;}
        .msg-text{font-size:13px;color:#bbb;line-height:1.5;word-wrap:break-word;}

        .input-area{padding:12px 16px 24px;border-top:0.5px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.6);flex-shrink:0;display:flex;gap:8px;align-items:flex-end;}
        .msg-input{flex:1;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:20px;padding:10px 16px;color:#fff;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;resize:none;max-height:80px;min-height:38px;}
        .msg-input:focus{border-color:rgba(255,170,51,0.3);}
        .msg-input::placeholder{color:#443;}
        .send{width:36px;height:36px;border-radius:50%;background:${COLORS.primary};border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.15s;}
        .send:hover{box-shadow:0 0 16px rgba(255,170,51,0.3);}
        .send:active{transform:scale(0.92);}
        .send:disabled{opacity:0.3;cursor:not-allowed;}
        .send svg{width:16px;height:16px;fill:none;stroke:#000;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;}

        .members-panel{position:fixed;top:0;right:0;width:300px;height:100vh;background:#0a0500;border-left:0.5px solid rgba(255,170,51,0.1);z-index:200;padding:20px;overflow-y:auto;transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);}
        .members-panel.open{transform:translateX(0);}
        .members-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:199;opacity:0;pointer-events:none;transition:opacity 0.2s;}
        .members-overlay.open{opacity:1;pointer-events:auto;}
        .members-title{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;color:#fff;text-transform:uppercase;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;}
        .members-close{background:none;border:none;color:#665;font-size:20px;cursor:pointer;}
        .member-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.04);}
        .member-av{width:32px;height:32px;border-radius:50%;background:rgba(255,170,51,0.1);display:flex;align-items:center;justify-content:center;font-size:14px;color:${COLORS.primary};font-weight:600;}
        .member-name{font-size:14px;color:#f0f0f0;flex:1;}
        .member-role{font-size:10px;color:${COLORS.primary};background:rgba(255,170,51,0.1);padding:2px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;}
        .invite-row{display:flex;gap:8px;margin-top:20px;}
        .invite-btn{background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;white-space:nowrap;}
        .leave-btn{width:100%;margin-top:20px;background:none;border:0.5px solid rgba(255,80,80,0.2);color:#ff6666;padding:10px;border-radius:10px;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all 0.15s;}
        .leave-btn:hover{background:rgba(255,80,80,0.06);}

        .empty-chat{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#443;}
        .empty-chat-icon{font-size:40px;opacity:0.2;margin-bottom:8px;}
        .empty-chat-text{font-size:13px;}
      `}</style>

      <div className="chat-layout">
        <div className="chat-header">
          <button className="chat-back" onClick={() => router.push('/connect')}>
            <i className="ti ti-arrow-left" style={{fontSize:'18px'}}/>
          </button>
          <div className="chat-avatar">{crew.avatar}</div>
          <div style={{flex:1}}>
            <div className="chat-title">{crew.name}</div>
            <div className="chat-subtitle">{members.length} members</div>
          </div>
          <button className="members-btn" onClick={() => setShowMembers(true)}>
            Members
          </button>
        </div>

        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <div className="empty-chat-icon">{crew.avatar}</div>
              <div className="empty-chat-text">Start the conversation</div>
            </div>
          ) : (
            messages.map((msg, i) => {
              const showName = i === 0 || messages[i - 1].user_id !== msg.user_id
              const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
                hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
              })
              return (
                <div key={msg.id} className="msg">
                  {showName ? (
                    <div className="msg-av" style={{background:'rgba(255,170,51,0.08)'}}>{msg.user_avatar}</div>
                  ) : (
                    <div style={{width:28,flexShrink:0}}/>
                  )}
                  <div className="msg-body">
                    {showName && (
                      <div className="msg-head">
                        <span
                          className="msg-name"
                          style={{cursor:'pointer'}}
                          onClick={() => router.push(`/profile/${msg.user_id}`)}
                        >
                          {msg.user_name}
                        </span>
                        <span className="msg-time">{time}</span>
                      </div>
                    )}
                    <div className="msg-text">{msg.content}</div>
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
            placeholder="Message the crew..."
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

      <div className={`members-overlay ${showMembers ? 'open' : ''}`} onClick={() => setShowMembers(false)}/>
      <div className={`members-panel ${showMembers ? 'open' : ''}`}>
        <div className="members-title">
          Members
          <button className="members-close" onClick={() => setShowMembers(false)}>×</button>
        </div>
        {members.map(m => (
          <div key={m.user_id} className="member-row">
            <div className="member-av">{(m.user_name ?? m.user_id).slice(0, 2).toUpperCase()}</div>
            <div
              className="member-name"
              style={{cursor:'pointer'}}
              onClick={() => router.push(`/profile/${m.user_id}`)}
            >
              {m.user_id === user?.id ? 'You' : (m.user_name ?? m.user_id.slice(0, 8))}
            </div>
            {m.role === 'owner' && <span className="member-role">Owner</span>}
          </div>
        ))}
        <div className="invite-row">
          <button className="invite-btn" onClick={handleInvite}>
            <i className="ti ti-link" style={{fontSize:'13px',marginRight:'4px'}} aria-hidden="true"/>
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
        </div>
        <button className="leave-btn" onClick={handleLeave}>Leave crew</button>
      </div>
    </>
  )
}