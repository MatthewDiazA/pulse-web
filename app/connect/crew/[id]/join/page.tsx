'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/client'

const COLORS = { primary: '#ffaa33', bg: '#000' } as const

export default function JoinCrew() {
  const router = useRouter()
  const params = useParams()
  const [status, setStatus] = useState<'loading' | 'joining' | 'joined' | 'error' | 'already'>('loading')
  const [crewName, setCrewName] = useState('')

  useEffect(() => {
    const join = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const crewId = params.id as string

      const { data: crew } = await supabase
        .from('crews')
        .select('name')
        .eq('id', crewId)
        .single()

      if (!crew) { setStatus('error'); return }
      setCrewName(crew.name)

      // Check if already a member
      const { count } = await supabase
        .from('crew_members')
        .select('*', { count: 'exact', head: true })
        .eq('crew_id', crewId)
        .eq('user_id', user.id)

      if ((count ?? 0) > 0) {
        setStatus('already')
        setTimeout(() => router.push(`/connect/crew/${crewId}`), 1500)
        return
      }

      setStatus('joining')
      const { error } = await supabase.from('crew_members').insert({
        crew_id: crewId,
        user_id: user.id,
        role: 'member',
      })

      if (error) { setStatus('error'); return }
      setStatus('joined')
      setTimeout(() => router.push(`/connect/crew/${crewId}`), 1500)
    }
    join()
  }, [params.id, router])

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:${COLORS.bg};font-family:'DM Sans',sans-serif;color:#f0f0f0;}
      `}</style>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px',padding:'40px'}}>
        {status === 'loading' && <div style={{color:'#665'}}>Loading...</div>}
        {status === 'joining' && <div style={{color:'#665'}}>Joining {crewName}...</div>}
        {status === 'joined' && (
          <>
            <div style={{fontSize:'32px'}}>⚡</div>
            <div style={{fontSize:'18px',fontWeight:600}}>You're in!</div>
            <div style={{color:'#665',fontSize:'14px'}}>Welcome to {crewName}</div>
          </>
        )}
        {status === 'already' && (
          <>
            <div style={{fontSize:'32px'}}>👋</div>
            <div style={{fontSize:'16px',color:'#665'}}>Already a member of {crewName}</div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{fontSize:'16px',color:'#ff6666'}}>Crew not found</div>
            <button onClick={() => router.push('/')} style={{padding:'10px 24px',background:COLORS.primary,color:'#000',border:'none',borderRadius:'100px',cursor:'pointer',fontSize:'14px',fontWeight:700}}>Go home</button>
          </>
        )}
      </div>
    </>
  )
}