import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function ClockInOutModal({ show, onClose, staff, staffList }) {
  const [clockStaff, setClockStaff] = useState(null)
  const [clockPhoto, setClockPhoto] = useState(null)
  const [clockSaving, setClockSaving] = useState(false)
  const [todayAtt, setTodayAtt] = useState(null)

  useEffect(() => {
    if (!show) {
      setClockStaff(null)
      setClockPhoto(null)
      setTodayAtt(null)
    }
  }, [show])

  if (!show) return null

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'#fff',borderRadius:20,padding:28,width:340,maxWidth:'90vw' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
          <div style={{ fontSize:17,fontWeight:800 }}>{todayAtt?.clock_in&&!todayAtt?.clock_out?"Clock Out":"Clock In"}</div>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#666' }}>✕</button>
        </div>
        {/* Staff selector */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11,fontWeight:700,color:'#6B778C',marginBottom:8 }}>SELECT STAFF</div>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6 }}>
            {staffList.map(s=>(
              <button key={s.name||s.id} onClick={async()=>{
                const cs=clockStaff?.name===s.name?null:s
                setClockStaff(cs)
                if(cs){
                  const today=new Date().toISOString().slice(0,10)
                  const attId="ATT-"+(cs.name||'').replace(/\s/g,"")+"-"+today
                  const {data}=await supabase.from("attendance").select("*").eq("id",attId).maybeSingle()
                  setTodayAtt(data)
                }
              }} style={{ padding:'8px 4px',borderRadius:10,border:'2px solid '+(clockStaff?.name===s.name?'#0052CC':'#f0f0f0'),
                background:clockStaff?.name===s.name?'#EFF6FF':'#fff',cursor:'pointer',fontSize:11,fontWeight:700,
                color:clockStaff?.name===s.name?'#0052CC':'#42526E',textAlign:'center' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        {clockStaff && (
          <div style={{ textAlign:'center',marginBottom:16 }}>
            <div style={{ fontSize:14,fontWeight:700,marginBottom:2 }}>{clockStaff.name}</div>
            <div style={{ fontSize:12,color:'#888' }}>{new Date().toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long"})}</div>
            {todayAtt?.clock_in && <div style={{ fontSize:12,color:'#059669',fontWeight:600,marginTop:4 }}>Clocked in at {new Date(todayAtt.clock_in).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</div>}
          </div>
        )}
        {clockStaff && clockPhoto ? (
          <div style={{ position:'relative',marginBottom:14 }}>
            <img src={clockPhoto} style={{ width:'100%',borderRadius:12,maxHeight:220,objectFit:'cover' }} />
            <button onClick={()=>setClockPhoto(null)} style={{ position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.6)',border:'none',color:'#fff',borderRadius:20,padding:'4px 10px',cursor:'pointer',fontSize:12 }}>Retake</button>
          </div>
        ) : clockStaff ? (
          <label style={{ display:'block',cursor:'pointer',marginBottom:14 }}>
            <div style={{ border:'2px dashed #ccc',borderRadius:12,padding:28,textAlign:'center',background:'#fafafa' }}>
              <div style={{ fontSize:36,marginBottom:8 }}>📸</div>
              <div style={{ fontSize:14,fontWeight:600,color:'#666' }}>Tap to take selfie</div>
            </div>
            <input type="file" accept="image/*" capture="user" style={{ display:'none' }}
              onChange={e=>{ const f=e.target.files[0]; if(f){const r=new FileReader();r.onload=ev=>setClockPhoto(ev.target.result);r.readAsDataURL(f)} }} />
          </label>
        ) : null}
        {clockStaff && <button disabled={clockSaving} onClick={async()=>{
          setClockSaving(true)
          const now=new Date()
          const today=now.toISOString().slice(0,10)
          const attId="ATT-"+(clockStaff||staff).name.replace(/\s/g,"")+"-"+today
          const isOut=todayAtt?.clock_in&&!todayAtt?.clock_out
          let photoUrl=null
          if (clockPhoto) {
            const blob=await fetch(clockPhoto).then(r=>r.blob())
            const fname=attId+(isOut?"-out":"-in")+".jpg"
            const {data:up}=await supabase.storage.from("attendance-photos").upload(fname,blob,{upsert:true,contentType:"image/jpeg"})
            if (up) { const {data:pub}=supabase.storage.from("attendance-photos").getPublicUrl(fname); photoUrl=pub?.publicUrl }
          }
          if (isOut) {
            await supabase.from("attendance").update({clock_out:now.toISOString(),clock_out_photo:photoUrl}).eq("id",attId)
          } else {
            await supabase.from("attendance").upsert({id:attId,staff_id:(clockStaff||staff).id||null,staff_name:(clockStaff||staff).name,date:today,clock_in:now.toISOString(),clock_in_photo:photoUrl,status:"on_time"},{onConflict:"id"})
          }
          setClockSaving(false)
          onClose()
          alert(isOut?"Clocked out!":"Clocked in!")
        }} style={{ width:'100%',padding:14,borderRadius:12,border:'none',fontSize:15,fontWeight:700,cursor:'pointer',background:todayAtt?.clock_in&&!todayAtt?.clock_out?"#DC2626":"#059669",color:'#fff' }}>
          {clockSaving?"Saving...":(todayAtt?.clock_in&&!todayAtt?.clock_out?"✓ Clock Out":"✓ Clock In")}
        </button>}
      </div>
    </div>
  )
}
