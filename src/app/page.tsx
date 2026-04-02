'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const API = 'https://virtual-gateway.onrender.com'
const APP_URL = 'https://vcg-webapp.vercel.app'

// ── Types ────────────────────────────────────────────────────────────────────
interface Block { id:string; name:string; location:string; emoji:string; generation:number; consumption:number; net:number; status:'Surplus'|'Deficit'|'Balanced'; devices:number; color:string; lat:number; lng:number }
interface Sensor { icon:string; label:string; value:number; unit:string; color:string; bar:number }
interface EV { id:string; block:string; status:'CHARGING'|'IDLE'; power:number; sessionTime:number; soc:number }
interface Device { sfdi:string; lfdi?:string; type:string; block:string; status:string; power?:number; voltage?:number; lastSeen?:string }
interface Alert { id:string; block:string; type:'deficit'|'battery'|'import'|'temp'; message:string; severity:'high'|'medium'|'low'; time:string; read:boolean }
interface HistoryEntry { time:string; block:string; generation:number; consumption:number; net:number; cost:number }
type Screen = 'home'|'block'|'charts'|'alerts'|'demand'|'history'|'cost'|'devices'|'map'|'compare'|'register'|'import'|'settings'

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeSensors = (t=20,sol=600,bat=50,gi=1,ge=1,ws=25,ec=0.38,co2=2): Sensor[] => [
  {icon:'🌡️',label:'Temperature',     value:t,   unit:'°C',   color:'#f97316',bar:Math.min(Math.round(t/40*100),100)},
  {icon:'☀️',label:'Solar Irradiance', value:sol, unit:'W/m²', color:'#f59e0b',bar:Math.min(Math.round(sol/1000*100),100)},
  {icon:'🔋',label:'Battery SOC',      value:bat, unit:'%',    color:'#10b981',bar:bat},
  {icon:'🔌',label:'Grid Import',      value:gi,  unit:'kW',   color:'#ef4444',bar:Math.min(Math.round(gi/5*100),100)},
  {icon:'📤',label:'Grid Export',      value:ge,  unit:'kW',   color:'#06b6d4',bar:Math.min(Math.round(ge/5*100),100)},
  {icon:'💨',label:'Wind Speed',       value:ws,  unit:'km/h', color:'#3b82f6',bar:Math.min(Math.round(ws/60*100),100)},
  {icon:'€', label:'Energy Cost',      value:ec,  unit:'/kWh', color:'#f59e0b',bar:Math.min(Math.round(ec/0.6*100),100)},
  {icon:'🌿',label:'CO₂ Saved',        value:co2, unit:'kg',   color:'#10b981',bar:Math.min(Math.round(co2/8*100),100)},
]

const makeHistory = (blockId:string, count=12): HistoryEntry[] =>
  Array.from({length:count},(_,i)=>{
    const gen = +(100+Math.random()*100).toFixed(1)
    const con = +(70+Math.random()*90).toFixed(1)
    const d = new Date(); d.setHours(d.getHours()-count+i)
    return {time:d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), block:blockId, generation:gen, consumption:con, net:+(gen-con).toFixed(1), cost:+(con*0.38/1000*3600).toFixed(3)}
  })

// ── Initial Data ─────────────────────────────────────────────────────────────
const INIT_BLOCKS: Block[] = [
  {id:'BLK-A',name:'Block A',location:'Dublin',  emoji:'🏙️',generation:145.8,consumption:98.2, net:47.6, status:'Surplus', devices:12,color:'#06b6d4',lat:53.3498,lng:-6.2603},
  {id:'BLK-B',name:'Block B',location:'Kerry',   emoji:'🏘️',generation:82.3, consumption:110.7,net:-28.4,status:'Deficit', devices:8, color:'#3b82f6',lat:52.1545,lng:-9.5669},
  {id:'BLK-C',name:'Block C',location:'Galway',  emoji:'🌆',generation:200.1,consumption:195.4,net:4.7,  status:'Surplus', devices:15,color:'#f97316',lat:53.2707,lng:-9.0568},
  {id:'BLK-D',name:'Block D',location:'Limerick',emoji:'🌉',generation:134.5,consumption:89.0, net:45.5, status:'Surplus', devices:10,color:'#8b5cf6',lat:52.6638,lng:-8.6267},
]
const INIT_SENSORS: Record<string,Sensor[]> = {
  'BLK-A':makeSensors(20.3,693,43,0.57,1.85,29,0.386,2.2),
  'BLK-B':makeSensors(18.1,510,22,3.2,0.4,41,0.42,0.8),
  'BLK-C':makeSensors(22.7,820,78,0.12,4.6,17,0.31,5.1),
  'BLK-D':makeSensors(19.5,640,61,0.88,2.3,23,0.355,3.4),
}
const INIT_EVS: EV[] = [
  {id:'EVCharger001',block:'BLK-A',status:'CHARGING',power:7.4,sessionTime:42,soc:68},
  {id:'EVCharger002',block:'BLK-B',status:'IDLE',    power:0,  sessionTime:0, soc:95},
  {id:'EVCharger003',block:'BLK-C',status:'CHARGING',power:11.0,sessionTime:18,soc:34},
  {id:'EVCharger004',block:'BLK-D',status:'IDLE',    power:0,  sessionTime:0, soc:82},
]
const INIT_DEVICES: Device[] = [
  {sfdi:'SM-A001',lfdi:'LFDI-SM-A001',type:'Smart Meter',    block:'BLK-A',status:'Online', power:1400,voltage:230,lastSeen:'Just now'},
  {sfdi:'PV-A002',lfdi:'LFDI-PV-A002',type:'Solar Inverter', block:'BLK-A',status:'Online', power:3500,voltage:230,lastSeen:'1 min ago'},
  {sfdi:'EV-A003',lfdi:'LFDI-EV-A003',type:'EV Charger',     block:'BLK-A',status:'Online', power:7400,voltage:230,lastSeen:'Just now'},
  {sfdi:'SM-B001',lfdi:'LFDI-SM-B001',type:'Smart Meter',    block:'BLK-B',status:'Online', power:1200,voltage:230,lastSeen:'2 min ago'},
  {sfdi:'BA-B002',lfdi:'LFDI-BA-B002',type:'Battery Storage', block:'BLK-B',status:'Warning',power:5000,voltage:48, lastSeen:'5 min ago'},
  {sfdi:'SM-C001',lfdi:'LFDI-SM-C001',type:'Smart Meter',    block:'BLK-C',status:'Online', power:1400,voltage:230,lastSeen:'Just now'},
  {sfdi:'WT-C002',lfdi:'LFDI-WT-C002',type:'Wind Turbine',   block:'BLK-C',status:'Online', power:8000,voltage:400,lastSeen:'30 sec ago'},
  {sfdi:'SM-D001',lfdi:'LFDI-SM-D001',type:'Smart Meter',    block:'BLK-D',status:'Online', power:1400,voltage:230,lastSeen:'3 min ago'},
]
const BLOCK_COLORS=['#06b6d4','#3b82f6','#f97316','#8b5cf6','#ec4899','#10b981','#f59e0b','#1d4ed8']
const BLOCK_EMOJIS=['🏙️','🏘️','🌆','🌉','🏚️','🌃','🏗️','🌇']

// ── Style tokens ─────────────────────────────────────────────────────────────
const C = {bg:'#f0f4ff',card:'#ffffff',cyan:'#06b6d4',navy:'#0f172a',text:'#0f172a',text2:'#475569',text3:'#94a3b8',border:'#e2e8f0',green:'#10b981',red:'#ef4444',orange:'#f97316',amber:'#f59e0b',blue:'#3b82f6',purple:'#8b5cf6',pink:'#ec4899',cyanLight:'#ecfeff',greenLight:'#d1fae5',redLight:'#fee2e2',amberLight:'#fef3c7',blueLight:'#dbeafe',purpleLight:'#ede9fe'}
const card=(x?:React.CSSProperties):React.CSSProperties=>({background:C.card,borderRadius:20,padding:20,boxShadow:'0 4px 16px rgba(0,0,0,0.08)',border:`1px solid ${C.border}`,...x})
const pill=(color:string):React.CSSProperties=>({fontFamily:"'Share Tech Mono',monospace",fontSize:10,letterSpacing:1.5,padding:'3px 10px',borderRadius:20,textTransform:'uppercase' as const,background:color+'20',border:`1px solid ${color}50`,color})
const lbl:React.CSSProperties={fontSize:12,fontWeight:700,color:C.text2,display:'block',marginBottom:6}
const inp=(x?:React.CSSProperties):React.CSSProperties=>({width:'100%',padding:'11px 14px',border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:14,fontFamily:'Plus Jakarta Sans,sans-serif',color:C.text,background:'#fafbff',outline:'none',...x})
const gradBtn=(color1=C.navy,color2=C.cyan):React.CSSProperties=>({background:`linear-gradient(135deg,${color1},${color2})`,color:'#fff',border:'none',borderRadius:14,padding:'13px',fontWeight:800,fontSize:14,cursor:'pointer',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:`0 4px 16px ${color2}40`})

// ── Main App ──────────────────────────────────────────────────────────────────
export default function VCGApp() {
  const [screen,setScreen]=useState<Screen>('home')
  const [activeBlock,setActiveBlock]=useState<Block|null>(null)
  const [activeDevice,setActiveDevice]=useState<Device|null>(null)
  const [apiOnline,setApiOnline]=useState<boolean|null>(null)
  const [apiMsg,setApiMsg]=useState('')
  const [blocks,setBlocks]=useState<Block[]>(INIT_BLOCKS)
  const [sensors,setSensors]=useState<Record<string,Sensor[]>>(INIT_SENSORS)
  const [evs,setEvs]=useState<EV[]>(INIT_EVS)
  const [devices,setDevices]=useState<Device[]>(INIT_DEVICES)
  const [alerts,setAlerts]=useState<Alert[]>([])
  const [history,setHistory]=useState<Record<string,HistoryEntry[]>>({
    'BLK-A':makeHistory('BLK-A'),'BLK-B':makeHistory('BLK-B'),'BLK-C':makeHistory('BLK-C'),'BLK-D':makeHistory('BLK-D')
  })
  const [showQR,setShowQR]=useState(false)
  const [copied,setCopied]=useState(false)
  const [drEvents,setDrEvents]=useState<any[]>([])

  // Live fluctuation
  useEffect(()=>{
    const iv=setInterval(()=>{
      setBlocks(prev=>prev.map(b=>{
        const gen=+(b.generation+(Math.random()-0.5)*2).toFixed(1)
        const con=+(b.consumption+(Math.random()-0.5)*1.5).toFixed(1)
        const net=+(gen-con).toFixed(1)
        const status=net>0.5?'Surplus':net<-0.5?'Deficit':'Balanced'
        return {...b,generation:gen,consumption:con,net,status}
      }))
      setSensors(prev=>{
        const n={...prev}
        Object.keys(n).forEach(k=>{n[k]=n[k].map((s,i)=>{const d=[0.3,8,1.5,0.04,0.08,0.8,0.004,0.08][i]||0.1;return{...s,value:+(s.value+(Math.random()-0.5)*d).toFixed(s.value<10?2:1)}})})
        return n
      })
      // Add history entries
      setHistory(prev=>{
        const n={...prev}
        INIT_BLOCKS.forEach(b=>{
          const gen=+(100+Math.random()*100).toFixed(1)
          const con=+(70+Math.random()*90).toFixed(1)
          const entry:HistoryEntry={time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),block:b.id,generation:gen,consumption:con,net:+(gen-con).toFixed(1),cost:+(con*0.38/1000*3600).toFixed(3)}
          n[b.id]=[...( n[b.id]||[]).slice(-20),entry]
        })
        return n
      })
    },3000)
    return ()=>clearInterval(iv)
  },[])

  // Auto-generate alerts
  useEffect(()=>{
    const newAlerts:Alert[]=[]
    blocks.forEach(b=>{
      if(b.status==='Deficit') newAlerts.push({id:`${b.id}-deficit`,block:b.id,type:'deficit',message:`${b.name} (${b.location}) is in energy deficit — ${Math.abs(b.net).toFixed(1)} kW shortfall`,severity:'high',time:'Just now',read:false})
      const bat=sensors[b.id]?.find(s=>s.label==='Battery SOC')
      if(bat&&bat.value<25) newAlerts.push({id:`${b.id}-battery`,block:b.id,type:'battery',message:`Battery SOC in ${b.name} is critically low at ${bat.value}%`,severity:'high',time:'Just now',read:false})
      const gi=sensors[b.id]?.find(s=>s.label==='Grid Import')
      if(gi&&gi.value>2.5) newAlerts.push({id:`${b.id}-import`,block:b.id,type:'import',message:`High grid import detected in ${b.name}: ${gi.value} kW`,severity:'medium',time:'Just now',read:false})
    })
    setAlerts(newAlerts)
  },[blocks,sensors])

  const checkApi=useCallback(async()=>{
    setApiOnline(null)
    try{const r=await fetch(API);const d=await r.json();setApiOnline(true);setApiMsg(d.message||'Connected')
      try{const r2=await fetch(API+'/dr');const d2=await r2.json();setDrEvents(Array.isArray(d2)?d2:d2.DemandResponseProgram||[])}catch{}
    }catch{setApiOnline(false);setApiMsg('API offline')}
  },[])

  useEffect(()=>{checkApi()},[])

  const addBlock=(b:Block)=>{setBlocks(p=>[...p,b]);setSensors(p=>({...p,[b.id]:makeSensors()}));setEvs(p=>[...p,{id:`EVC-${b.id}`,block:b.id,status:'IDLE',power:0,sessionTime:0,soc:100}]);setHistory(p=>({...p,[b.id]:makeHistory(b.id)}))}
  const addDevice=(d:Device)=>setDevices(p=>[...p,d])

  const totalGen=blocks.reduce((s,b)=>s+b.generation,0)
  const totalCon=blocks.reduce((s,b)=>s+b.consumption,0)
  const totalNet=+(totalGen-totalCon).toFixed(1)
  const unreadAlerts=alerts.filter(a=>!a.read).length
  const statusColor=apiOnline===null?C.amber:apiOnline?C.green:C.red

  const goHome=()=>{setScreen('home');setActiveBlock(null);setActiveDevice(null)}
  const openBlock=(b:Block)=>{setActiveBlock(b);setScreen('block')}

  const NAV=[
    {id:'home',   icon:'🏠',label:'Home'},
    {id:'charts', icon:'📈',label:'Charts'},
    {id:'alerts', icon:'⚠️',label:'Alerts',badge:unreadAlerts},
    {id:'map',    icon:'🗺️',label:'Map'},
    {id:'settings',icon:'⚙️',label:'More'},
  ]

  return (
    <div style={{maxWidth:430,margin:'0 auto',minHeight:'100vh',fontFamily:'Plus Jakarta Sans,sans-serif',position:'relative'}}>
      {/* HEADER */}
      <div style={{position:'relative',zIndex:2,padding:'16px 20px 72px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:40,height:40,borderRadius:14,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,backdropFilter:'blur(8px)'}}>⚡</div>
            <div>
              <div style={{fontWeight:900,fontSize:17,color:'#fff',letterSpacing:-0.3}}>VCG Portal</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'rgba(255,255,255,0.65)',letterSpacing:1.8}}>MI6228 · GROUP 13</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.12)',borderRadius:20,padding:'5px 12px',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.2)'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:statusColor}} className={apiOnline?'pulse-dot':''} />
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:'#fff',fontWeight:700}}>{apiOnline===null?'Checking':apiOnline?'Live':'Offline'}</span>
            </div>
            <button onClick={()=>setShowQR(true)} style={{background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:12,padding:'8px 10px',color:'#fff',fontSize:16,cursor:'pointer',backdropFilter:'blur(8px)'}}>📲</button>
          </div>
        </div>
        {/* Summary pills */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginTop:18}}>
          {[{l:'Generation',v:totalGen.toFixed(1),u:'kW',c:'#a5f3fc',bg:'rgba(255,255,255,0.1)'},{l:'Consumption',v:totalCon.toFixed(1),u:'kW',c:'#fde68a',bg:'rgba(255,255,255,0.1)'},{l:'Net Balance',v:(totalNet>=0?'+':'')+totalNet,u:'kW',c:totalNet>=0?'#a5f3fc':'#fca5a5',bg:'rgba(255,255,255,0.1)'}].map(s=>(
            <div key={s.l} style={{background:s.bg,borderRadius:14,padding:'12px 8px',textAlign:'center',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.15)'}}>
              <div style={{fontSize:20,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.6)',fontWeight:700,marginTop:3,textTransform:'uppercase',letterSpacing:0.8}}>{s.u} · {s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{position:'relative',zIndex:1,marginTop:-44,padding:'0 16px 100px'}}>
        {screen==='home'    && <HomeScreen    blocks={blocks} onBlockClick={openBlock} apiOnline={apiOnline} apiMsg={apiMsg} alerts={alerts} onAddCommunity={()=>setScreen('import')} onNavigate={setScreen} />}
        {screen==='block'   && activeBlock && <BlockScreen   block={activeBlock} blocks={blocks} sensors={sensors[activeBlock.id]||[]} evs={evs.filter(e=>e.block===activeBlock.id)} devices={devices.filter(d=>d.block===activeBlock.id)} history={history[activeBlock.id]||[]} onBack={goHome} onRegister={()=>setScreen('register')} onDeviceClick={(d)=>{setActiveDevice(d);setScreen('devices')}} />}
        {screen==='charts'  && <ChartsScreen  blocks={blocks} history={history} sensors={sensors} />}
        {screen==='alerts'  && <AlertsScreen  alerts={alerts} blocks={blocks} onMarkRead={(id)=>setAlerts(p=>p.map(a=>a.id===id?{...a,read:true}:a))} onMarkAllRead={()=>setAlerts(p=>p.map(a=>({...a,read:true})))} />}
        {screen==='demand'  && <DemandScreen  blocks={blocks} drEvents={drEvents} apiOnline={apiOnline} />}
        {screen==='history' && <HistoryScreen history={history} blocks={blocks} />}
        {screen==='cost'    && <CostScreen    blocks={blocks} sensors={sensors} history={history} />}
        {screen==='devices' && <DevicesScreen devices={devices} blocks={blocks} activeDevice={activeDevice} onBack={()=>{setActiveDevice(null);setScreen(activeBlock?'block':'home')}} onDelete={(sfdi)=>setDevices(p=>p.filter(d=>d.sfdi!==sfdi))} />}
        {screen==='map'     && <MapScreen     blocks={blocks} />}
        {screen==='compare' && <CompareScreen blocks={blocks} sensors={sensors} />}
        {screen==='register'&& <RegisterScreen blocks={blocks} activeBlock={activeBlock} onBack={()=>setScreen(activeBlock?'block':'home')} apiOnline={apiOnline} onDeviceAdded={addDevice} />}
        {screen==='import'  && <ImportScreen  blocks={blocks} onBack={goHome} onBlocksImported={(bs)=>{bs.forEach(b=>addBlock(b));goHome()}} onDevicesImported={(ds)=>{ds.forEach(d=>addDevice(d))}} />}
        {screen==='settings'&& <SettingsScreen apiOnline={apiOnline} apiMsg={apiMsg} onRefresh={checkApi} onShowQR={()=>setShowQR(true)} onNavigate={setScreen} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'rgba(255,255,255,0.95)',borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-around',padding:'8px 0 18px',zIndex:50,boxShadow:'0 -4px 24px rgba(0,0,0,0.1)',backdropFilter:'blur(16px)'}}>
        {NAV.map(t=>(
          <button key={t.id} onClick={()=>{setActiveBlock(null);setScreen(t.id as Screen)}} style={{background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'0 10px',position:'relative'}}>
            <div style={{width:42,height:42,borderRadius:14,background:screen===t.id?`linear-gradient(135deg,${C.navy},${C.cyan})`:'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,transition:'all 0.2s',boxShadow:screen===t.id?`0 4px 12px ${C.cyan}40`:undefined}}>
              {t.icon}
            </div>
            {(t as any).badge>0 && <div style={{position:'absolute',top:0,right:6,width:16,height:16,borderRadius:'50%',background:C.red,color:'#fff',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #fff'}}>{(t as any).badge}</div>}
            <span style={{fontSize:10,fontWeight:700,color:screen===t.id?C.navy:C.text3}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* QR MODAL */}
      {showQR&&(
        <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.8)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:24}} onClick={()=>setShowQR(false)}>
          <div style={{background:'#fff',borderRadius:28,padding:32,textAlign:'center',maxWidth:320,width:'100%',boxShadow:'0 24px 64px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:900,fontSize:20,color:C.navy,marginBottom:4}}>Share VCG App</div>
            <div style={{fontSize:12,color:C.text2,marginBottom:20}}>Scan to open on any device</div>
            <div style={{display:'inline-block',border:`3px solid ${C.cyan}`,borderRadius:18,padding:10,marginBottom:16,boxShadow:`0 0 24px ${C.cyan}30`}}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(APP_URL)}&color=0f172a&bgcolor=ffffff&qzone=1`} width={200} height={200} alt="QR" style={{borderRadius:10,display:'block'}} />
            </div>
            <div style={{background:'#f8faff',borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,marginBottom:16,border:`1px solid ${C.border}`}}>
              <span style={{fontSize:14}}>🌐</span>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{APP_URL}</span>
              <button onClick={()=>{navigator.clipboard.writeText(APP_URL);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16}}>{copied?'✅':'📋'}</button>
            </div>
            <button onClick={()=>setShowQR(false)} style={gradBtn()}>Done</button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── HOME SCREEN ───────────────────────────────────────────────────────────────
function HomeScreen({blocks,onBlockClick,apiOnline,apiMsg,alerts,onAddCommunity,onNavigate}:any) {
  const unread=alerts.filter((a:Alert)=>!a.read).length
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {apiOnline&&apiMsg&&<div className="su" style={{background:'linear-gradient(135deg,#d1fae5,#a7f3d0)',border:`1px solid ${C.green}40`,borderRadius:16,padding:'10px 14px',display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:16}}>✅</span><span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:'#065f46'}}>{apiMsg}</span>
      </div>}

      {/* Alert banner */}
      {unread>0&&<div className="su" onClick={()=>onNavigate('alerts')} style={{background:'linear-gradient(135deg,#fef3c7,#fde68a)',border:`1px solid ${C.amber}50`,borderRadius:16,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
        <div style={{width:36,height:36,borderRadius:12,background:C.amber,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>⚠️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:13,color:'#92400e'}}>{unread} Active Alert{unread>1?'s':''}</div>
          <div style={{fontSize:11,color:'#b45309'}}>Tap to view — {alerts.filter((a:Alert)=>a.severity==='high'&&!a.read).length} high priority</div>
        </div>
        <span style={{fontSize:18,color:'#b45309'}}>›</span>
      </div>}

      {/* Quick actions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {[
          {icon:'📈',label:'Live Charts',   color:C.blue,   light:'#dbeafe', screen:'charts'},
          {icon:'⚡',label:'Demand Response',color:C.orange, light:'#ffedd5',screen:'demand'},
          {icon:'📋',label:'History Log',   color:C.purple, light:'#ede9fe',screen:'history'},
          {icon:'💰',label:'Cost & Savings', color:C.green,  light:'#d1fae5',screen:'cost'},
          {icon:'📟',label:'All Devices',   color:C.cyan,   light:C.cyanLight,screen:'devices'},
          {icon:'🏆',label:'Compare Blocks',color:C.pink,   light:'#fce7f3',screen:'compare'},
        ].map((q,i)=>(
          <div key={q.label} className={`su d${i+1}`} onClick={()=>onNavigate(q.screen)} style={{background:C.card,borderRadius:16,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',boxShadow:'0 2px 10px rgba(0,0,0,0.06)',border:`1px solid ${C.border}`,transition:'transform 0.15s'}}>
            <div style={{width:40,height:40,borderRadius:12,background:q.light,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{q.icon}</div>
            <span style={{fontWeight:700,fontSize:13,color:C.text}}>{q.label}</span>
          </div>
        ))}
      </div>

      {/* Communities */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
        <div>
          <div style={{fontWeight:900,fontSize:17,color:C.text}}>Communities</div>
          <div style={{fontSize:12,color:C.text2,marginTop:1}}>{blocks.length} blocks · tap to explore</div>
        </div>
        <button onClick={onAddCommunity} style={{background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:12,padding:'9px 16px',fontWeight:700,fontSize:12,cursor:'pointer',boxShadow:`0 4px 12px ${C.cyan}30`}}>＋ Add Block</button>
      </div>

      {blocks.map((b:Block,i:number)=>(
        <div key={b.id} className={`su d${Math.min(i+1,6)}`} onClick={()=>onBlockClick(b)} style={{background:C.card,borderRadius:20,padding:20,boxShadow:'0 4px 16px rgba(0,0,0,0.07)',border:`1px solid ${C.border}`,cursor:'pointer',transition:'all 0.2s'}}
          onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 28px rgba(0,0,0,0.12)'}}
          onMouseOut={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.07)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:48,height:48,borderRadius:16,background:`linear-gradient(135deg,${b.color}20,${b.color}40)`,border:`1.5px solid ${b.color}50`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>{b.emoji}</div>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:C.text}}>{b.name} — {b.location}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,marginTop:2}}>{b.id} · {b.devices} devices</div>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
              <div style={{...pill(b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan)}}>{b.status}</div>
              <span style={{fontSize:18,color:C.text3}}>›</span>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[{l:'Gen',v:b.generation.toFixed(1),c:C.green},{l:'Con',v:b.consumption.toFixed(1),c:C.amber},{l:'Net',v:(b.net>=0?'+':'')+b.net.toFixed(1),c:b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan}].map(s=>(
              <div key={s.l} style={{background:'#f8faff',borderRadius:12,padding:'10px 6px',textAlign:'center',border:`1px solid ${C.border}`}}>
                <div style={{fontSize:18,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:9,color:C.text3,fontWeight:700,marginTop:3}}>{s.l} kW</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            <span style={{fontSize:11,color:b.color,fontWeight:700}}>Tap to view sensors, EV &amp; devices</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── BLOCK SCREEN ──────────────────────────────────────────────────────────────
function BlockScreen({block:b,blocks,sensors,evs,devices,history,onBack,onRegister,onDeviceClick}:any) {
  const live=blocks.find((x:Block)=>x.id===b.id)||b
  const sc=live.status==='Surplus'?C.green:live.status==='Deficit'?C.red:C.cyan
  const recentH=(history||[]).slice(-6)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{background:C.card,borderRadius:20,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
        <div style={{background:`linear-gradient(135deg,${b.color},${b.color}99)`,padding:'18px 20px'}}>
          <button onClick={onBack} style={{background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'6px 14px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:14}}>← Back</button>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <span style={{fontSize:36}}>{b.emoji}</span>
              <div><div style={{fontWeight:900,fontSize:22,color:'#fff'}}>{b.name}</div><div style={{fontSize:12,color:'rgba(255,255,255,0.8)'}}>{b.location} · {b.id}</div></div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:900,fontSize:28,color:'#fff'}}>{(live.net>=0?'+':'')+live.net.toFixed(1)}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:700}}>kW Net</div>
            </div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'16px',gap:8}}>
          {[{l:'Generation',v:live.generation.toFixed(1),c:C.green},{l:'Consumption',v:live.consumption.toFixed(1),c:C.amber},{l:'Status',v:live.status,c:sc}].map(s=>(
            <div key={s.l} style={{textAlign:'center'}}>
              <div style={{fontWeight:900,fontSize:20,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:C.text3,fontWeight:600,marginTop:2}}>{s.l}{s.l!=='Status'?' kW':''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini chart */}
      {recentH.length>0&&<>
        <SH title="Recent Energy (Last 6 Readings)" />
        <div style={card({padding:'16px 12px'})}>
          <div style={{display:'flex',alignItems:'flex-end',gap:4,height:80}}>
            {recentH.map((h:HistoryEntry,i:number)=>{
              const maxV=Math.max(...recentH.map((x:HistoryEntry)=>Math.max(x.generation,x.consumption)))
              return (
                <div key={i} style={{flex:1,display:'flex',gap:2,alignItems:'flex-end',height:'100%'}}>
                  <div className="bar-grow" style={{flex:1,height:`${(h.generation/maxV)*100}%`,background:`linear-gradient(180deg,${C.green},${C.green}80)`,borderRadius:'4px 4px 0 0',minHeight:4}} title={`Gen: ${h.generation}`} />
                  <div className="bar-grow" style={{flex:1,height:`${(h.consumption/maxV)*100}%`,background:`linear-gradient(180deg,${C.amber},${C.amber}80)`,borderRadius:'4px 4px 0 0',minHeight:4}} title={`Con: ${h.consumption}`} />
                </div>
              )
            })}
          </div>
          <div style={{display:'flex',gap:16,marginTop:8,justifyContent:'center'}}>
            {[{c:C.green,l:'Generation'},{c:C.amber,l:'Consumption'}].map(l=><div key={l.l} style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:2,background:l.c}} /><span style={{fontSize:10,color:C.text3}}>{l.l}</span></div>)}
          </div>
        </div>
      </>}

      {/* Sensors */}
      <SH title="Sensor Parameters" />
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {sensors.map((s:Sensor,i:number)=>(
          <div key={s.label} className={`su d${(i%4)+1}`} style={card({padding:'14px 16px'})}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:20}}>{s.icon}</span>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,background:'#f8faff',padding:'2px 7px',borderRadius:6}}>{s.unit}</span>
            </div>
            <div style={{fontWeight:900,fontSize:26,color:s.color,lineHeight:1,marginBottom:4}}>{s.value}</div>
            <div style={{fontSize:11,color:C.text2,marginBottom:8}}>{s.label}</div>
            <div style={{height:3,background:'#f0f4ff',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',width:Math.min(s.bar,100)+'%',background:`linear-gradient(90deg,${s.color}60,${s.color})`,borderRadius:2,transition:'width 1s ease'}} />
            </div>
          </div>
        ))}
      </div>

      {/* EVs */}
      {evs.length>0&&<><SH title="EV Charging Sessions" />
        {evs.map((ev:EV)=>(
          <div key={ev.id} style={card({border:`1.5px solid ${ev.status==='CHARGING'?C.amber:C.border}`})}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:24}}>🚗</span><div style={{fontWeight:800,fontSize:15,color:C.text}}>{ev.id}</div></div>
              <div style={pill(ev.status==='CHARGING'?C.amber:C.text3)}>{ev.status}</div>
            </div>
            {[{l:'Power Draw',v:ev.power+' kW'},{l:'Session Time',v:ev.sessionTime+' min'},{l:'Battery SOC',v:ev.soc+'%'}].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:12,color:C.text2}}>{r.l}</span>
                <span style={{fontWeight:800,fontSize:12,color:C.text}}>{r.v}</span>
              </div>
            ))}
            <div style={{height:4,background:'#f0f4ff',borderRadius:2,overflow:'hidden',marginTop:8}}>
              <div style={{height:'100%',width:ev.soc+'%',background:ev.status==='CHARGING'?`linear-gradient(90deg,${C.amber},${C.orange})`:`linear-gradient(90deg,${C.cyan},#06b6d4)`,borderRadius:2}} />
            </div>
          </div>
        ))}
      </>}

      {/* Devices */}
      <SH title={`Devices (${devices.length})`} />
      <div style={card({padding:16})}>
        {devices.length===0?(<div style={{textAlign:'center',padding:'16px 0'}}><div style={{fontSize:32,marginBottom:8}}>📭</div><div style={{fontSize:13,color:C.text2}}>No devices yet</div></div>):(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {devices.map((d:Device,i:number)=>(
              <div key={i} onClick={()=>onDeviceClick(d)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'#f8faff',borderRadius:12,border:`1px solid ${C.border}`,cursor:'pointer',transition:'background 0.15s'}}
                onMouseOver={e=>(e.currentTarget.style.background=C.cyanLight)} onMouseOut={e=>(e.currentTarget.style.background='#f8faff')}>
                <div style={{width:36,height:36,borderRadius:10,background:C.cyanLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>📟</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontWeight:700,fontSize:12,color:C.cyan}}>{d.sfdi}</div>
                  <div style={{fontSize:11,color:C.text3}}>{d.type}</div>
                </div>
                <div style={pill(d.status==='Online'?C.green:C.amber)}>{d.status}</div>
                <span style={{color:C.text3}}>›</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onRegister} style={gradBtn(C.navy,b.color)}>➕ Register Device to {b.name}</button>
    </div>
  )
}

// ── CHARTS SCREEN ─────────────────────────────────────────────────────────────
function ChartsScreen({blocks,history,sensors}:any) {
  const [selBlock,setSelBlock]=useState('ALL')
  const allHistory=selBlock==='ALL'?Object.values(history).flat() as HistoryEntry[]:(history[selBlock]||[]) as HistoryEntry[]
  const recent=allHistory.slice(-10)
  const maxV=Math.max(...recent.map((h:HistoryEntry)=>Math.max(h.generation,h.consumption)),1)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>📈 Live Charts</div>
        <div style={{fontSize:12,color:C.text2}}>Real-time energy generation vs consumption</div>
      </div>
      {/* Block selector */}
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
        {['ALL',...blocks.map((b:Block)=>b.id)].map((id:string)=>{
          const b=blocks.find((x:Block)=>x.id===id)
          return <button key={id} onClick={()=>setSelBlock(id)} style={{flexShrink:0,padding:'8px 16px',borderRadius:20,border:`2px solid ${selBlock===id?(b?.color||C.cyan):C.border}`,background:selBlock===id?(b?.color||C.cyan)+'18':C.card,fontWeight:700,fontSize:12,color:selBlock===id?(b?.color||C.cyan):C.text2,cursor:'pointer',whiteSpace:'nowrap'}}>{id==='ALL'?'All Blocks':b?.name||id}</button>
        })}
      </div>

      {/* Bar chart */}
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:16}}>Generation vs Consumption</div>
        <div style={{display:'flex',alignItems:'flex-end',gap:3,height:120,marginBottom:12}}>
          {recent.map((h:HistoryEntry,i:number)=>(
            <div key={i} style={{flex:1,display:'flex',gap:1,alignItems:'flex-end',height:'100%'}}>
              <div className="bar-grow" style={{flex:1,height:`${(h.generation/maxV)*100}%`,background:`linear-gradient(180deg,${C.green},${C.green}60)`,borderRadius:'4px 4px 0 0',minHeight:4}} />
              <div className="bar-grow" style={{flex:1,height:`${(h.consumption/maxV)*100}%`,background:`linear-gradient(180deg,${C.amber},${C.amber}60)`,borderRadius:'4px 4px 0 0',minHeight:4}} />
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:20,justifyContent:'center'}}>
          {[{c:C.green,l:'Generation'},{c:C.amber,l:'Consumption'}].map(l=><div key={l.l} style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:12,height:12,borderRadius:3,background:l.c}} /><span style={{fontSize:11,color:C.text2,fontWeight:600}}>{l.l}</span></div>)}
        </div>
      </div>

      {/* Per-block stats */}
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:14}}>Block Performance</div>
        {blocks.map((b:Block)=>{
          const eff=b.generation>0?Math.round((b.net/b.generation)*100):0
          return (
            <div key={b.id} style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{b.emoji}</span>
                  <span style={{fontWeight:700,fontSize:13,color:C.text}}>{b.name}</span>
                </div>
                <span style={{fontWeight:800,fontSize:12,color:eff>=0?C.green:C.red}}>{eff>=0?'+':''}{eff}% efficiency</span>
              </div>
              <div style={{height:8,background:'#f0f4ff',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(Math.abs(eff),100)}%`,background:eff>=0?`linear-gradient(90deg,${C.green},${b.color})`:`linear-gradient(90deg,${C.red},${C.orange})`,borderRadius:4,transition:'width 1s ease'}} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Sensor chart for selected block */}
      {selBlock!=='ALL'&&sensors[selBlock]&&(
        <div style={card()}>
          <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:14}}>Sensor Readings — {blocks.find((b:Block)=>b.id===selBlock)?.name}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {sensors[selBlock].map((s:Sensor)=>(
              <div key={s.label} style={{background:'#f8faff',borderRadius:12,padding:'10px 12px',border:`1px solid ${C.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:14}}>{s.icon}</span>
                  <span style={{fontWeight:900,fontSize:16,color:s.color}}>{s.value}</span>
                </div>
                <div style={{fontSize:10,color:C.text3,marginBottom:6}}>{s.label}</div>
                <div style={{height:3,background:'#e2e8f0',borderRadius:2}}>
                  <div style={{height:'100%',width:s.bar+'%',background:s.color,borderRadius:2}} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ALERTS SCREEN ─────────────────────────────────────────────────────────────
function AlertsScreen({alerts,blocks,onMarkRead,onMarkAllRead}:any) {
  const sevColor=(s:string)=>s==='high'?C.red:s==='medium'?C.amber:C.blue
  const sevIcon=(t:string)=>t==='deficit'?'⚡':t==='battery'?'🔋':t==='import'?'🔌':'🌡️'
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontWeight:900,fontSize:18,color:C.text}}>⚠️ Alerts</div>
          <div style={{fontSize:12,color:C.text2,marginTop:2}}>{alerts.filter((a:Alert)=>!a.read).length} unread · {alerts.length} total</div>
        </div>
        {alerts.some((a:Alert)=>!a.read)&&<button onClick={onMarkAllRead} style={{background:C.cyanLight,border:`1px solid ${C.cyan}`,borderRadius:10,padding:'8px 14px',fontWeight:700,fontSize:12,color:C.cyan,cursor:'pointer'}}>Mark all read</button>}
      </div>

      {alerts.length===0&&<div style={card({textAlign:'center',padding:'40px 20px'})}>
        <div style={{fontSize:48,marginBottom:12}}>✅</div>
        <div style={{fontWeight:700,fontSize:16,color:C.text}}>All clear!</div>
        <div style={{fontSize:13,color:C.text2,marginTop:4}}>No active alerts</div>
      </div>}

      {alerts.map((a:Alert)=>(
        <div key={a.id} style={{...card(),border:`1.5px solid ${sevColor(a.severity)}30`,background:a.read?C.card:`${sevColor(a.severity)}08`,opacity:a.read?0.6:1}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
            <div style={{width:42,height:42,borderRadius:14,background:sevColor(a.severity)+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{sevIcon(a.type)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <div style={pill(sevColor(a.severity))}>{a.severity}</div>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3}}>{a.time}</span>
              </div>
              <div style={{fontSize:13,color:C.text,lineHeight:1.5,marginBottom:8}}>{a.message}</div>
              {!a.read&&<button onClick={()=>onMarkRead(a.id)} style={{background:'none',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:600,color:C.text2,cursor:'pointer'}}>Mark as read</button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── DEMAND RESPONSE SCREEN ────────────────────────────────────────────────────
function DemandScreen({blocks,drEvents,apiOnline}:any) {
  const [triggered,setTriggered]=useState<string[]>([])
  const [localEvents,setLocalEvents]=useState([
    {id:'DR-001',block:'BLK-B',type:'Load Reduction',target:15,duration:30,status:'Active',time:'10:42'},
    {id:'DR-002',block:'BLK-A',type:'Peak Shaving',  target:10,duration:60,status:'Scheduled',time:'14:00'},
  ])
  const trigger=(blockId:string)=>{
    setTriggered(p=>[...p,blockId])
    setLocalEvents(p=>[...p,{id:'DR-'+Date.now(),block:blockId,type:'Manual DR',target:20,duration:15,status:'Active',time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}])
    setTimeout(()=>setTriggered(p=>p.filter(x=>x!==blockId)),3000)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>⚡ Demand Response</div>
        <div style={{fontSize:12,color:C.text2}}>Manage and trigger DR events per community block</div>
      </div>

      {/* Active events */}
      <SH title={`Active Events (${localEvents.filter(e=>e.status==='Active').length})`} />
      {localEvents.map(e=>(
        <div key={e.id} style={card({border:`1.5px solid ${e.status==='Active'?C.orange:C.border}`})}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <div>
              <div style={{fontWeight:800,fontSize:14,color:C.text}}>{e.type}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3}}>{e.id} · {blocks.find((b:Block)=>b.id===e.block)?.name||e.block}</div>
            </div>
            <div style={pill(e.status==='Active'?C.orange:C.blue)}>{e.status}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[{l:'Target',v:e.target+'%'},{l:'Duration',v:e.duration+' min'},{l:'Time',v:e.time}].map(r=>(
              <div key={r.l} style={{background:'#f8faff',borderRadius:10,padding:'8px',textAlign:'center'}}>
                <div style={{fontWeight:800,fontSize:14,color:C.text}}>{r.v}</div>
                <div style={{fontSize:10,color:C.text3}}>{r.l}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Manual trigger */}
      <SH title="Manual Trigger" />
      <div style={card()}>
        <div style={{fontSize:12,color:C.text2,marginBottom:14}}>Tap a block to manually trigger a demand response event</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {blocks.map((b:Block)=>(
            <div key={b.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#f8faff',borderRadius:14,border:`1px solid ${C.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:20}}>{b.emoji}</span>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:C.text}}>{b.name} — {b.location}</div>
                  <div style={pill(b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan)}>{b.status}</div>
                </div>
              </div>
              <button onClick={()=>trigger(b.id)} disabled={triggered.includes(b.id)} style={{background:triggered.includes(b.id)?C.green:`linear-gradient(135deg,${C.orange},${C.amber})`,color:'#fff',border:'none',borderRadius:10,padding:'8px 14px',fontWeight:700,fontSize:12,cursor:'pointer',boxShadow:'0 2px 8px rgba(249,115,22,0.3)'}}>
                {triggered.includes(b.id)?'✓ Sent':'Trigger DR'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── HISTORY SCREEN ────────────────────────────────────────────────────────────
function HistoryScreen({history,blocks}:any) {
  const [selBlock,setSelBlock]=useState('BLK-A')
  const entries:HistoryEntry[]=(history[selBlock]||[]).slice().reverse().slice(0,20)
  const exportExcel=()=>{
    import('xlsx').then(XLSX=>{
      const ws=XLSX.utils.json_to_sheet(entries)
      const wb=XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb,ws,'History')
      XLSX.writeFile(wb,`vcg_history_${selBlock}_${new Date().toISOString().slice(0,10)}.xlsx`)
    })
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontWeight:900,fontSize:18,color:C.text}}>📋 History Log</div><div style={{fontSize:12,color:C.text2,marginTop:2}}>Energy readings over time</div></div>
        <button onClick={exportExcel} style={{background:`linear-gradient(135deg,${C.green},#059669)`,color:'#fff',border:'none',borderRadius:12,padding:'9px 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>⬇️ Export</button>
      </div>
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
        {blocks.map((b:Block)=><button key={b.id} onClick={()=>setSelBlock(b.id)} style={{flexShrink:0,padding:'8px 16px',borderRadius:20,border:`2px solid ${selBlock===b.id?b.color:C.border}`,background:selBlock===b.id?b.color+'18':C.card,fontWeight:700,fontSize:12,color:selBlock===b.id?b.color:C.text2,cursor:'pointer'}}>{b.name}</button>)}
      </div>
      <div style={card({padding:0,overflow:'hidden'})}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:`linear-gradient(135deg,${C.navy},${C.navy}ee)`}}>
              {['Time','Gen kW','Con kW','Net kW','Cost €'].map(h=><th key={h} style={{padding:'12px 10px',textAlign:'left',fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:'rgba(255,255,255,0.8)',letterSpacing:1,whiteSpace:'nowrap'}}>{h}</th>)}
            </tr></thead>
            <tbody>{entries.map((e:HistoryEntry,i:number)=>(
              <tr key={i} style={{background:i%2===0?'#fafbff':'#fff',borderBottom:`1px solid ${C.border}`}}>
                <td style={{padding:'10px',fontFamily:"'Share Tech Mono',monospace",color:C.text2,fontSize:11}}>{e.time}</td>
                <td style={{padding:'10px',fontWeight:700,color:C.green}}>{e.generation}</td>
                <td style={{padding:'10px',fontWeight:700,color:C.amber}}>{e.consumption}</td>
                <td style={{padding:'10px',fontWeight:700,color:e.net>=0?C.green:C.red}}>{e.net>=0?'+':''}{e.net}</td>
                <td style={{padding:'10px',fontWeight:700,color:C.text2}}>€{e.cost}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── COST SCREEN ───────────────────────────────────────────────────────────────
function CostScreen({blocks,sensors,history}:any) {
  const rate=0.38
  const totalCost=blocks.reduce((s:number,b:Block)=>s++(b.consumption*rate/1000*3600).toFixed(2),0)
  const totalSavings=blocks.reduce((s:number,b:Block)=>s++(b.generation*rate/1000*3600).toFixed(2),0)
  const totalCO2=Object.values(sensors).flat().filter((s:any)=>s.label==='CO₂ Saved').reduce((t:number,s:any)=>t+s.value,0)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>💰 Cost & Savings</div>
        <div style={{fontSize:12,color:C.text2}}>Energy cost analysis and savings tracker</div>
      </div>
      {/* Summary */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {[
          {icon:'💸',label:'Est. Daily Cost', value:`€${totalCost.toFixed(2)}`,  color:C.red,   bg:'#fef2f2'},
          {icon:'💚',label:'Solar Savings',   value:`€${totalSavings.toFixed(2)}`,color:C.green, bg:'#f0fdf4'},
          {icon:'🌿',label:'CO₂ Saved Today', value:`${(+totalCO2).toFixed(1)} kg`,color:C.teal||C.cyan, bg:C.cyanLight},
          {icon:'📊',label:'Avg Cost/kWh',    value:`€${rate}/kWh`,             color:C.amber,  bg:'#fffbeb'},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:18,padding:'18px 16px',border:`1px solid ${s.color}20`}}>
            <div style={{fontSize:28,marginBottom:8}}>{s.icon}</div>
            <div style={{fontWeight:900,fontSize:22,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:C.text2,marginTop:4,fontWeight:600}}>{s.label}</div>
          </div>
        ))}
      </div>
      {/* Per block breakdown */}
      <SH title="Cost per Block" />
      {blocks.map((b:Block)=>{
        const cost=+(b.consumption*rate/1000*3600).toFixed(3)
        const saving=+(b.generation*rate/1000*3600).toFixed(3)
        const net=+(saving-cost).toFixed(3)
        return (
          <div key={b.id} style={card()}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{width:40,height:40,borderRadius:12,background:b.color+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{b.emoji}</div>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:C.text}}>{b.name} — {b.location}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3}}>{b.id}</div>
              </div>
              <div style={{marginLeft:'auto',fontWeight:900,fontSize:16,color:net>=0?C.green:C.red}}>{net>=0?'+€':'−€'}{Math.abs(net).toFixed(3)}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[{l:'Energy Cost',v:`€${cost}`,c:C.red},{l:'Solar Savings',v:`€${saving}`,c:C.green},{l:'Net',v:`${net>=0?'+€':'−€'}${Math.abs(net)}`,c:net>=0?C.green:C.red}].map(s=>(
                <div key={s.l} style={{background:'#f8faff',borderRadius:10,padding:'10px 8px',textAlign:'center'}}>
                  <div style={{fontWeight:800,fontSize:13,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:9,color:C.text3,marginTop:3}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── DEVICES SCREEN ────────────────────────────────────────────────────────────
function DevicesScreen({devices,blocks,activeDevice,onBack,onDelete}:any) {
  const [selected,setSelected]=useState<Device|null>(activeDevice)
  if(selected) return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}>
        <button onClick={()=>setSelected(null)} style={{background:'#f0f4ff',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:C.text2,cursor:'pointer',marginBottom:14}}>← Back to Devices</button>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>📟 Device Detail</div>
      </div>
      <div style={{...card(),border:`2px solid ${selected.status==='Online'?C.green:C.amber}`}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
          <div style={{width:56,height:56,borderRadius:18,background:C.cyanLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>📟</div>
          <div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontWeight:700,fontSize:16,color:C.cyan}}>{selected.sfdi}</div>
            <div style={{fontSize:13,color:C.text2}}>{selected.type}</div>
            <div style={pill(selected.status==='Online'?C.green:C.amber)}>{selected.status}</div>
          </div>
        </div>
        {[
          {l:'Long Form ID (LFDI)',v:selected.lfdi||'—'},
          {l:'Device Type',        v:selected.type},
          {l:'Block',              v:blocks.find((b:Block)=>b.id===selected.block)?.name+' — '+blocks.find((b:Block)=>b.id===selected.block)?.location||selected.block},
          {l:'Real Power',         v:selected.power?selected.power+' W':'—'},
          {l:'Voltage',            v:selected.voltage?selected.voltage+' V':'—'},
          {l:'Last Seen',          v:selected.lastSeen||'—'},
          {l:'Status',             v:selected.status},
        ].map(r=>(
          <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}>
            <span style={{fontSize:12,color:C.text2,fontWeight:600}}>{r.l}</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:C.text,fontWeight:700,maxWidth:'55%',textAlign:'right'}}>{r.v}</span>
          </div>
        ))}
        <button onClick={()=>{onDelete(selected.sfdi);setSelected(null)}} style={{...gradBtn(C.red,'#ef4444'),marginTop:16,background:'#fef2f2',color:C.red,boxShadow:'none',border:`1px solid ${C.red}30`}}>🗑️ Deregister Device</button>
      </div>
    </div>
  )
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontWeight:900,fontSize:18,color:C.text}}>📟 All Devices</div>
          <div style={{fontSize:12,color:C.text2,marginTop:2}}>{devices.length} total · {devices.filter((d:Device)=>d.status==='Online').length} online</div>
        </div>
        <div style={{display:'flex',gap:6}}>
          <div style={{...pill(C.green),display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:C.green,display:'inline-block'}} />{devices.filter((d:Device)=>d.status==='Online').length} Online</div>
        </div>
      </div>
      {blocks.map((b:Block)=>{
        const bd=devices.filter((d:Device)=>d.block===b.id)
        if(bd.length===0) return null
        return (
          <div key={b.id}>
            <div style={{fontWeight:700,fontSize:12,color:C.text2,padding:'4px 4px 8px',display:'flex',alignItems:'center',gap:6}}><span>{b.emoji}</span>{b.name} — {b.location} <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3}}>({bd.length})</span></div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {bd.map((d:Device,i:number)=>(
                <div key={i} onClick={()=>setSelected(d)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:C.card,borderRadius:16,border:`1px solid ${C.border}`,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.05)',transition:'all 0.15s'}}
                  onMouseOver={e=>{e.currentTarget.style.background=C.cyanLight;e.currentTarget.style.borderColor=C.cyan+'50'}}
                  onMouseOut={e=>{e.currentTarget.style.background=C.card;e.currentTarget.style.borderColor=C.border}}>
                  <div style={{width:38,height:38,borderRadius:12,background:b.color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📟</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontWeight:700,fontSize:12,color:C.cyan}}>{d.sfdi}</div>
                    <div style={{fontSize:11,color:C.text3}}>{d.type}{d.power?` · ${d.power}W`:''}</div>
                  </div>
                  <div style={pill(d.status==='Online'?C.green:C.amber)}>{d.status}</div>
                  <span style={{color:C.text3}}>›</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── MAP SCREEN ────────────────────────────────────────────────────────────────
function MapScreen({blocks}:any) {
  // SVG map of Ireland with block pins
  const W=380,H=400
  // Approximate Ireland outline as SVG path
  const irelandPath="M190,20 C210,18 230,22 245,35 C260,48 268,58 272,72 C278,90 275,105 270,118 C265,130 258,138 252,148 C248,158 246,168 244,180 C242,195 240,210 238,225 C234,240 228,252 220,262 C210,274 198,282 188,290 C178,298 168,304 158,312 C148,320 140,330 135,342 C130,354 128,366 130,378 C132,388 138,394 145,398 C152,400 158,398 162,394 C168,388 170,378 168,368 C166,358 160,350 155,342 C150,334 145,326 142,316 C138,304 136,292 138,280 C140,268 146,258 150,246 C154,234 156,222 155,210 C154,198 150,187 145,178 C140,168 134,160 128,152 C120,142 112,134 106,124 C98,112 92,100 90,86 C88,72 90,58 96,46 C102,34 112,24 124,18 C136,12 152,10 168,12 C178,14 186,18 190,20Z"
  // Map lat/lng to SVG coords (rough Ireland bounding box)
  const toXY=(lat:number,lng:number)=>{
    const x=((lng-(-10.5))/((-5.5)-(-10.5)))*(W*0.6)+W*0.2
    const y=((54.5-lat)/((54.5)-(51.3)))*(H*0.8)+H*0.06
    return {x,y}
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>🗺️ Ireland Map</div>
        <div style={{fontSize:12,color:C.text2}}>All community blocks across Ireland</div>
      </div>
      <div style={{...card(),padding:'16px',overflow:'hidden'}}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
          {/* Ocean background */}
          <rect width={W} height={H} fill="#e0f2fe" rx="12" />
          {/* Ireland landmass */}
          <path d={irelandPath} fill="#d1fae5" stroke="#10b981" strokeWidth="1.5" />
          {/* Grid lines */}
          {[0.25,0.5,0.75].map(f=>[
            <line key={`h${f}`} x1={0} y1={H*f} x2={W} y2={H*f} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="4,4" />,
            <line key={`v${f}`} x1={W*f} y1={0} x2={W*f} y2={H} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" strokeDasharray="4,4" />,
          ])}
          {/* Block pins */}
          {blocks.map((b:Block)=>{
            const {x,y}=toXY(b.lat,b.lng)
            const sc=b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan
            return (
              <g key={b.id}>
                {/* Pulse ring */}
                <circle cx={x} cy={y} r={18} fill={sc} opacity={0.15} />
                <circle cx={x} cy={y} r={12} fill={sc} opacity={0.25} />
                {/* Pin */}
                <circle cx={x} cy={y} r={8} fill={b.color} stroke="#fff" strokeWidth="2" />
                {/* Label */}
                <rect x={x+12} y={y-12} width={72} height={24} rx="6" fill="white" opacity="0.92" />
                <text x={x+16} y={y-1} fontSize="9" fontWeight="700" fill={C.navy} fontFamily="Plus Jakarta Sans,sans-serif">{b.name}</text>
                <text x={x+16} y={y+9} fontSize="8" fill={C.text3} fontFamily="Plus Jakarta Sans,sans-serif">{b.location}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {/* Legend */}
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>Block Summary</div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {blocks.map((b:Block)=>{
            const sc=b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan
            return (
              <div key={b.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#f8faff',borderRadius:12,border:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:b.color}} />
                  <span style={{fontWeight:700,fontSize:13,color:C.text}}>{b.emoji} {b.name}</span>
                  <span style={{fontSize:11,color:C.text3}}>{b.location}</span>
                </div>
                <div style={pill(sc)}>{b.status}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── COMPARE SCREEN ────────────────────────────────────────────────────────────
function CompareScreen({blocks,sensors}:any) {
  const sorted=[...blocks].sort((a:Block,b:Block)=>b.net-a.net)
  const maxGen=Math.max(...blocks.map((b:Block)=>b.generation),1)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>🏆 Block Comparison</div>
        <div style={{fontSize:12,color:C.text2}}>Performance leaderboard &amp; side-by-side comparison</div>
      </div>
      {/* Leaderboard */}
      <SH title="Leaderboard — Net Energy" />
      {sorted.map((b:Block,i:number)=>(
        <div key={b.id} style={{...card(),border:`1.5px solid ${i===0?C.amber:C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:14,background:i===0?'#fef3c7':i===1?'#f1f5f9':i===2?'#fef3c7':'#f8faff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅'}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:C.text}}>{b.emoji} {b.name} — {b.location}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3}}>{b.id}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontWeight:900,fontSize:20,color:b.net>=0?C.green:C.red}}>{b.net>=0?'+':''}{b.net.toFixed(1)}</div>
              <div style={{fontSize:10,color:C.text3}}>kW Net</div>
            </div>
          </div>
          {/* Bars */}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[{l:'Generation',v:b.generation,max:maxGen,c:C.green},{l:'Consumption',v:b.consumption,max:maxGen,c:C.amber}].map(s=>(
              <div key={s.l}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:11,color:C.text2}}>{s.l}</span>
                  <span style={{fontWeight:700,fontSize:11,color:s.c}}>{s.v.toFixed(1)} kW</span>
                </div>
                <div style={{height:6,background:'#f0f4ff',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(s.v/s.max)*100}%`,background:`linear-gradient(90deg,${s.c}80,${s.c})`,borderRadius:3,transition:'width 1s'}} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {/* Sensor comparison table */}
      <SH title="Sensor Comparison" />
      <div style={card({padding:0,overflow:'hidden'})}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:`linear-gradient(135deg,${C.navy},${C.navy}ee)`}}>
              <th style={{padding:'10px 12px',textAlign:'left',color:'rgba(255,255,255,0.8)',fontFamily:"'Share Tech Mono',monospace",fontSize:9,letterSpacing:1}}>Sensor</th>
              {blocks.map((b:Block)=><th key={b.id} style={{padding:'10px 8px',textAlign:'center',color:b.color,fontFamily:"'Share Tech Mono',monospace",fontSize:9}}>{b.name.replace('Block ','')}</th>)}
            </tr></thead>
            <tbody>{(sensors[blocks[0]?.id]||[]).map((s:Sensor,i:number)=>(
              <tr key={s.label} style={{background:i%2===0?'#f8faff':'#fff',borderBottom:`1px solid ${C.border}`}}>
                <td style={{padding:'10px 12px',display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:14}}>{s.icon}</span><span style={{color:C.text2,fontSize:11}}>{s.label}</span></td>
                {blocks.map((b:Block)=>{
                  const sv=sensors[b.id]?.[i]
                  return <td key={b.id} style={{padding:'10px 8px',textAlign:'center',fontWeight:700,color:sv?.color||C.text,fontSize:12}}>{sv?.value||'—'}<span style={{fontSize:9,color:C.text3,fontWeight:400}}> {sv?.unit}</span></td>
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── REGISTER SCREEN ───────────────────────────────────────────────────────────
function RegisterScreen({blocks,activeBlock,onBack,apiOnline,onDeviceAdded}:any) {
  const [form,setForm]=useState({sfdi:'',lfdi:'',deviceType:'Smart Meter',block:activeBlock?.id||blocks[0]?.id||'BLK-A',realPower:'',voltage:'',temperature:'',solarIrradiance:'',batterySoc:'',gridImport:''})
  const [msg,setMsg]=useState('');const [loading,setLoading]=useState(false)
  const selBlock=blocks.find((b:Block)=>b.id===form.block)
  const submit=async()=>{
    if(!form.sfdi||!form.lfdi){setMsg('⚠️ Device ID and Long Form ID required');return}
    setLoading(true)
    try{const r=await fetch(API+'/edev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
      if(r.ok){onDeviceAdded({sfdi:form.sfdi,lfdi:form.lfdi,type:form.deviceType,block:form.block,status:'Online',power:+form.realPower||0,voltage:+form.voltage||0,lastSeen:'Just now'});setMsg('✅ Device registered!');setForm(p=>({...p,sfdi:'',lfdi:''}))}
      else setMsg('❌ Failed — '+r.status)
    }catch{onDeviceAdded({sfdi:form.sfdi,lfdi:form.lfdi,type:form.deviceType,block:form.block,status:'Online',power:+form.realPower||0,voltage:+form.voltage||0,lastSeen:'Just now'});setMsg('📴 API offline — saved locally')}
    setLoading(false);setTimeout(()=>setMsg(''),4000)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}><button onClick={onBack} style={{background:'#f0f4ff',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:C.text2,cursor:'pointer',marginBottom:14}}>← Back</button>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>➕ Register Device</div>
        <div style={{fontSize:12,color:C.text2}}>IEEE 2030.5 End Device Registration</div>
      </div>
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>Select Block</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {blocks.map((b:Block)=>(
            <button key={b.id} onClick={()=>setForm(p=>({...p,block:b.id}))} style={{padding:'10px',borderRadius:12,border:`2px solid ${form.block===b.id?b.color:C.border}`,background:form.block===b.id?b.color+'12':'#fafbff',cursor:'pointer',textAlign:'left' as const}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:18}}>{b.emoji}</span><div><div style={{fontWeight:700,fontSize:12,color:form.block===b.id?b.color:C.text}}>{b.name}</div><div style={{fontSize:10,color:C.text3}}>{b.location}</div></div></div>
            </button>
          ))}
        </div>
        {selBlock&&<div style={{marginTop:10,padding:'8px 12px',background:selBlock.color+'12',borderRadius:10,fontSize:12,color:selBlock.color,fontWeight:700}}>{selBlock.emoji} Registering to {selBlock.name} — {selBlock.location}</div>}
      </div>
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:14}}>Device Identity</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[{l:'Device ID (SFDI) *',k:'sfdi',ph:'e.g. SM_BlockA_001'},{l:'Long Form ID (LFDI) *',k:'lfdi',ph:'e.g. LFDI-SM-001'}].map(f=>(
            <div key={f.k}><label style={lbl}>{f.l}</label><input style={inp()} placeholder={f.ph} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} /></div>
          ))}
          <div><label style={lbl}>Device Type</label>
            <select style={inp({cursor:'pointer'})} value={form.deviceType} onChange={e=>setForm(p=>({...p,deviceType:e.target.value}))}>
              {['Smart Meter','Solar Inverter','EV Charger','HVAC','Battery Storage','Wind Turbine','Load Controller'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:14}}>Parameters</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {[{l:'Real Power (W)',k:'realPower',ph:'1400'},{l:'Voltage (V)',k:'voltage',ph:'230'},{l:'Temperature (°C)',k:'temperature',ph:'18.5'},{l:'Solar Irradiance',k:'solarIrradiance',ph:'650'},{l:'Battery SOC (%)',k:'batterySoc',ph:'75'},{l:'Grid Import (kW)',k:'gridImport',ph:'1.2'}].map(f=>(
            <div key={f.k}><label style={lbl}>{f.l}</label><input style={inp()} placeholder={f.ph} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} /></div>
          ))}
        </div>
      </div>
      <button onClick={submit} disabled={loading} style={gradBtn(C.navy,C.cyan)}>
        {loading?<><div style={{width:16,height:16,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}} />Registering...</>:'⊕ Register Device'}
      </button>
      {msg&&<div style={{padding:'12px 16px',borderRadius:12,background:msg.startsWith('✅')?'#ecfdf5':msg.startsWith('❌')?'#fef2f2':'#fffbeb',fontSize:13,fontWeight:700,color:msg.startsWith('✅')?C.green:msg.startsWith('❌')?C.red:C.amber}}>{msg}</div>}
    </div>
  )
}

// ── IMPORT SCREEN ─────────────────────────────────────────────────────────────
function ImportScreen({blocks,onBack,onBlocksImported,onDevicesImported}:any) {
  const [tab,setTab]=useState<'communities'|'devices'>('communities')
  const [preview,setPreview]=useState<any[]>([])
  const [error,setError]=useState('');const [success,setSuccess]=useState('');const [fileName,setFileName]=useState('')
  const readExcel=(file:File)=>{
    setError('');setSuccess('');setPreview([]);setFileName(file.name)
    const reader=new FileReader()
    reader.onload=(e)=>{
      import('xlsx').then(XLSX=>{
        try{const data=new Uint8Array(e.target?.result as ArrayBuffer);const wb=XLSX.read(data,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const rows:any[]=XLSX.utils.sheet_to_json(ws);if(rows.length===0){setError('No data found');return}setPreview(rows.slice(0,10))}
        catch{setError('Could not read file')}
      })
    }
    reader.readAsArrayBuffer(file)
  }
  const importData=()=>{
    if(preview.length===0){setError('No data to import');return}
    if(tab==='communities'){
      const nb:Block[]=preview.map((row:any,i:number)=>{
        const gen=parseFloat(row['Generation (kW)']||row['generation']||100);const con=parseFloat(row['Consumption (kW)']||row['consumption']||80);const net=+(gen-con).toFixed(1);const idx=blocks.length+i
        return {id:row['Block ID']||`BLK-${String.fromCharCode(65+idx)}`,name:row['Block Name']||`Block ${String.fromCharCode(65+idx)}`,location:row['Location']||'Ireland',emoji:BLOCK_EMOJIS[idx%BLOCK_EMOJIS.length],generation:gen,consumption:con,net,status:net>0.5?'Surplus':net<-0.5?'Deficit':'Balanced',devices:parseInt(row['Devices']||'0'),color:BLOCK_COLORS[idx%BLOCK_COLORS.length],lat:53+Math.random()*2,lng:-8+Math.random()*3}
      })
      onBlocksImported(nb);setSuccess(`✅ Imported ${nb.length} block${nb.length>1?'s':''}!`)
    } else {
      const nd:Device[]=preview.map((row:any)=>({sfdi:row['Device ID (SFDI)']||row['sfdi']||'DEV-'+Math.random().toString(36).slice(2,6).toUpperCase(),lfdi:row['Long Form ID (LFDI)']||row['lfdi']||'',type:row['Device Type']||row['type']||'Smart Meter',block:row['Block ID']||row['block']||blocks[0]?.id||'BLK-A',status:row['Status']||'Online',power:+row['Real Power (W)']||0,voltage:+row['Voltage (V)']||230,lastSeen:'Just imported'}))
      onDevicesImported(nd);setSuccess(`✅ Imported ${nd.length} device${nd.length>1?'s':''}!`)
    }
    setTimeout(()=>onBack(),1500)
  }
  const downloadTemplate=()=>{
    import('xlsx').then(XLSX=>{
      const data=tab==='communities'?[{'Block ID':'BLK-E','Block Name':'Block E','Location':'Waterford','Generation (kW)':120,'Consumption (kW)':95,'Devices':8}]:
        [{'Device ID (SFDI)':'SM-E001','Long Form ID (LFDI)':'LFDI-SM-E001','Device Type':'Smart Meter','Block ID':'BLK-A','Real Power (W)':1400,'Voltage (V)':230}]
      const ws=XLSX.utils.json_to_sheet(data);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,tab==='communities'?'Communities':'Devices')
      XLSX.writeFile(wb,`vcg_${tab}_template.xlsx`)
    })
  }
  const BLOCK_COLORS=['#06b6d4','#3b82f6','#f97316','#8b5cf6','#ec4899','#10b981']
  const BLOCK_EMOJIS=['🏙️','🏘️','🌆','🌉','🏚️','🌃']
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}><button onClick={onBack} style={{background:'#f0f4ff',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:C.text2,cursor:'pointer',marginBottom:14}}>← Back</button>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>📊 Import from Excel</div>
        <div style={{fontSize:12,color:C.text2}}>Bulk-import communities or devices from .xlsx</div>
      </div>
      <div style={{display:'flex',gap:8,background:C.card,borderRadius:16,padding:8,boxShadow:'0 2px 10px rgba(0,0,0,0.06)'}}>
        {(['communities','devices'] as const).map(t=>(
          <button key={t} onClick={()=>{setTab(t);setPreview([]);setFileName('');setError('');setSuccess('')}} style={{flex:1,padding:'10px',border:'none',borderRadius:12,fontWeight:800,fontSize:13,cursor:'pointer',background:tab===t?`linear-gradient(135deg,${C.navy},${C.cyan})`:'#f0f4ff',color:tab===t?'#fff':C.text2}}>
            {t==='communities'?'🏘️ Communities':'📟 Devices'}
          </button>
        ))}
      </div>
      <div style={{...card(),background:'#f0fdf4',border:`1px solid ${C.green}30`}}>
        <div style={{fontWeight:700,fontSize:13,color:C.green,marginBottom:8}}>📥 Step 1 — Download Template</div>
        <button onClick={downloadTemplate} style={gradBtn(C.navy,C.green)}>⬇️ Download {tab==='communities'?'Communities':'Devices'} Template</button>
      </div>
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>📤 Step 2 — Upload Excel File</div>
        <label style={{display:'block',border:`2px dashed ${fileName?C.cyan:C.border}`,borderRadius:16,padding:'28px 20px',textAlign:'center',cursor:'pointer',background:fileName?C.cyanLight:'#fafbff'}}>
          <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>{if(e.target.files?.[0]) readExcel(e.target.files[0])}} />
          <div style={{fontSize:36,marginBottom:8}}>{fileName?'📗':'📂'}</div>
          {fileName?<><div style={{fontWeight:800,fontSize:14,color:C.cyan}}>{fileName}</div><div style={{fontSize:11,color:C.text2,marginTop:4}}>{preview.length} rows detected</div></>
            :<><div style={{fontWeight:700,fontSize:14,color:C.text}}>Tap to choose Excel file</div><div style={{fontSize:11,color:C.text3,marginTop:4}}>Supports .xlsx · .xls · .csv</div></>}
        </label>
        {error&&<div style={{marginTop:10,padding:'10px 14px',background:'#fef2f2',borderRadius:10,fontSize:12,color:C.red}}>⚠️ {error}</div>}
      </div>
      {preview.length>0&&<div style={card({padding:0,overflow:'hidden'})}>
        <div style={{padding:'14px 16px',fontWeight:700,fontSize:13,color:C.text}}>👁️ Preview ({preview.length} rows)</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:`linear-gradient(135deg,${C.navy},${C.navy}ee)`}}>{Object.keys(preview[0]).map(k=><th key={k} style={{padding:'8px 10px',textAlign:'left',fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'rgba(255,255,255,0.8)',whiteSpace:'nowrap'}}>{k}</th>)}</tr></thead>
            <tbody>{preview.map((row,i)=><tr key={i} style={{background:i%2===0?'#f8faff':'#fff',borderBottom:`1px solid ${C.border}`}}>{Object.values(row).map((v:any,j)=><td key={j} style={{padding:'8px 10px',color:C.text,whiteSpace:'nowrap'}}>{String(v)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>}
      {preview.length>0&&<button onClick={importData} style={gradBtn(C.navy,C.cyan)}>📊 Import {preview.length} {tab==='communities'?'Communities':'Devices'}</button>}
      {success&&<div style={{padding:'14px',borderRadius:14,background:'#ecfdf5',border:`1px solid ${C.green}30`,fontSize:14,fontWeight:800,color:C.green,textAlign:'center'}}>{success}</div>}
    </div>
  )
}

// ── SETTINGS SCREEN ───────────────────────────────────────────────────────────
function SettingsScreen({apiOnline,apiMsg,onRefresh,onShowQR,onNavigate}:any) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{background:`linear-gradient(135deg,${C.navy},#1e3a5f,${C.cyan})`,borderRadius:24,padding:24,color:'#fff',boxShadow:`0 8px 32px ${C.cyan}30`}}>
        <div style={{width:60,height:60,borderRadius:20,background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,marginBottom:14,border:'1px solid rgba(255,255,255,0.2)'}}>👨‍💻</div>
        <div style={{fontWeight:900,fontSize:22}}>Ronit</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',marginTop:3}}>Virtual Communication Gateway</div>
        <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
          {[{l:'Student',v:'MI6228'},{l:'Group',v:'13'},{l:'Mentor',v:'Paolo C.'},{l:'Protocol',v:'IEEE 2030.5'}].map(x=>(
            <div key={x.l} style={{background:'rgba(255,255,255,0.12)',borderRadius:10,padding:'6px 12px',border:'1px solid rgba(255,255,255,0.15)'}}>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.55)',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:1.2}}>{x.l}</div>
              <div style={{fontSize:13,fontWeight:800}}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>
      {/* QR Card */}
      <div style={card()}>
        <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:14}}>📲 Share App</div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=${encodeURIComponent(APP_URL)}&color=0f172a&bgcolor=ffffff&qzone=1`} width={88} height={88} alt="QR" style={{borderRadius:12,border:`2px solid ${C.cyan}`,boxShadow:`0 0 16px ${C.cyan}30`}} />
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.cyan,marginBottom:4}}>vcg-webapp.vercel.app</div>
            <div style={{fontSize:12,color:C.text2,marginBottom:10}}>Scan to open on any device</div>
            <button onClick={onShowQR} style={gradBtn(C.navy,C.cyan)}>📲 Show Full QR</button>
          </div>
        </div>
      </div>
      {/* API */}
      <div style={card()}>
        <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:14}}>🔌 API Status</div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#f8faff',borderRadius:12,marginBottom:10,border:`1px solid ${C.border}`}}>
          <div><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.text2}}>virtual-gateway.onrender.com</div>{apiMsg&&<div style={{fontSize:11,color:apiOnline?C.green:C.red,marginTop:2}}>{apiMsg}</div>}</div>
          <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:'50%',background:apiOnline===null?C.amber:apiOnline?C.green:C.red}} /><span style={{fontSize:11,fontWeight:700,color:apiOnline===null?C.amber:apiOnline?C.green:C.red}}>{apiOnline===null?'Checking':apiOnline?'Online':'Offline'}</span></div>
        </div>
        <button onClick={onRefresh} style={gradBtn(C.navy,C.cyan)}>↺ Refresh Connection</button>
      </div>
      {/* Navigation shortcuts */}
      <div style={card()}>
        <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:14}}>🚀 Quick Navigate</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[{icon:'📈',l:'Charts',s:'charts'},{icon:'⚠️',l:'Alerts',s:'alerts'},{icon:'⚡',l:'Demand',s:'demand'},{icon:'📋',l:'History',s:'history'},{icon:'💰',l:'Cost',s:'cost'},{icon:'🏆',l:'Compare',s:'compare'},{icon:'➕',l:'Register',s:'register'},{icon:'📊',l:'Import',s:'import'}].map(x=>(
            <button key={x.s} onClick={()=>onNavigate(x.s)} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'#f8faff',border:`1px solid ${C.border}`,borderRadius:14,cursor:'pointer',textAlign:'left' as const}}>
              <span style={{fontSize:18}}>{x.icon}</span><span style={{fontWeight:700,fontSize:13,color:C.text}}>{x.l}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Quick links */}
      <div style={card()}>
        <div style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:14}}>🔗 Quick Links</div>
        {[{icon:'🚀',l:'Live API Docs',sub:'virtual-gateway.onrender.com/docs',href:API+'/docs'},{icon:'💻',l:'GitHub Repo',sub:'rt0181996/virtual-gateway',href:'https://github.com/rt0181996/virtual-gateway'},{icon:'📊',l:'Grafana',sub:'localhost:3000',href:'http://localhost:3000'},{icon:'🌐',l:'IDS Dataspace',sub:'localhost:8181',href:'http://localhost:8181'}].map((x,i)=>(
          <a key={x.l} href={x.href} target="_blank" rel="noopener" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:i<3?`1px solid ${C.border}`:'none',textDecoration:'none'}}>
            <div style={{width:38,height:38,borderRadius:12,background:C.cyanLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{x.icon}</div>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:C.text}}>{x.l}</div><div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3}}>{x.sub}</div></div>
            <span style={{color:C.text3,fontSize:18}}>›</span>
          </a>
        ))}
      </div>
      <div style={{textAlign:'center',padding:8,fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,letterSpacing:1.5}}>VCG v5.0 · IEEE 2030.5 · FIWARE · IDS DATASPACE</div>
    </div>
  )
}

function SH({title}:{title:string}){return <div style={{fontWeight:800,fontSize:14,color:C.text,paddingLeft:4}}>{title}</div>}
// VCG v5 - Thu Apr  2 18:14:30 UTC 2026
 
