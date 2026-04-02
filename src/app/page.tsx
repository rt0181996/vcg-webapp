'use client'
import { useState, useEffect, useCallback } from 'react'

const API = 'https://virtual-gateway.onrender.com'

// ── Types ──────────────────────────────────────────────────────────────────
interface Block {
  id: string; name: string; location: string; emoji: string
  generation: number; consumption: number; net: number; status: 'Surplus'|'Deficit'|'Balanced'
  devices: number; color: string
}
interface Sensor { icon: string; label: string; value: number; unit: string; color: string; bar: number }
interface EV { id: string; block: string; status: 'CHARGING'|'IDLE'; power: number; sessionTime: number; soc: number }
interface Device { sfdi: string; type: string; block: string; status: string }
type Screen = 'home' | 'block' | 'register' | 'settings'

// ── Seed Data ──────────────────────────────────────────────────────────────
const BLOCKS: Block[] = [
  { id:'BLK-A', name:'Block A', location:'Dublin',  emoji:'🏙️', generation:145.8, consumption:98.2,  net:47.6,  status:'Surplus',  devices:12, color:'#00b8a4' },
  { id:'BLK-B', name:'Block B', location:'Kerry',   emoji:'🏘️', generation:82.3,  consumption:110.7, net:-28.4, status:'Deficit',  devices:8,  color:'#2979ff' },
  { id:'BLK-C', name:'Block C', location:'Galway',  emoji:'🌆', generation:200.1, consumption:195.4, net:4.7,   status:'Surplus',  devices:15, color:'#ff6d00' },
  { id:'BLK-D', name:'Block D', location:'Limerick',emoji:'🌉', generation:134.5, consumption:89.0,  net:45.5,  status:'Surplus',  devices:10, color:'#9c27b0' },
]

const BLOCK_SENSORS: Record<string, Sensor[]> = {
  'BLK-A': [
    { icon:'🌡️', label:'Temperature',           value:20.3,  unit:'°C',    color:'#ff6b35', bar:60 },
    { icon:'☀️', label:'Solar Irradiance',       value:693,   unit:'W/m²',  color:'#ffab00', bar:75 },
    { icon:'🔋', label:'Battery SOC',            value:43,    unit:'%',     color:'#00c853', bar:43 },
    { icon:'🔌', label:'Grid Import',            value:0.57,  unit:'kW',    color:'#ff1744', bar:20 },
    { icon:'📤', label:'Grid Export',            value:1.85,  unit:'kW',    color:'#00b8a4', bar:35 },
    { icon:'💨', label:'Wind Speed',             value:29,    unit:'km/h',  color:'#2979ff', bar:45 },
    { icon:'€',  label:'Energy Cost',            value:0.386, unit:'/kWh',  color:'#ffab00', bar:55 },
    { icon:'🌿', label:'CO₂ Saved',              value:2.2,   unit:'kg',    color:'#00c853', bar:40 },
  ],
  'BLK-B': [
    { icon:'🌡️', label:'Temperature',           value:18.1,  unit:'°C',    color:'#ff6b35', bar:50 },
    { icon:'☀️', label:'Solar Irradiance',       value:510,   unit:'W/m²',  color:'#ffab00', bar:55 },
    { icon:'🔋', label:'Battery SOC',            value:22,    unit:'%',     color:'#ff1744', bar:22 },
    { icon:'🔌', label:'Grid Import',            value:3.2,   unit:'kW',    color:'#ff1744', bar:65 },
    { icon:'📤', label:'Grid Export',            value:0.4,   unit:'kW',    color:'#00b8a4', bar:15 },
    { icon:'💨', label:'Wind Speed',             value:41,    unit:'km/h',  color:'#2979ff', bar:68 },
    { icon:'€',  label:'Energy Cost',            value:0.42,  unit:'/kWh',  color:'#ffab00', bar:70 },
    { icon:'🌿', label:'CO₂ Saved',              value:0.8,   unit:'kg',    color:'#00c853', bar:18 },
  ],
  'BLK-C': [
    { icon:'🌡️', label:'Temperature',           value:22.7,  unit:'°C',    color:'#ff6b35', bar:70 },
    { icon:'☀️', label:'Solar Irradiance',       value:820,   unit:'W/m²',  color:'#ffab00', bar:88 },
    { icon:'🔋', label:'Battery SOC',            value:78,    unit:'%',     color:'#00c853', bar:78 },
    { icon:'🔌', label:'Grid Import',            value:0.12,  unit:'kW',    color:'#ff1744', bar:8  },
    { icon:'📤', label:'Grid Export',            value:4.6,   unit:'kW',    color:'#00b8a4', bar:72 },
    { icon:'💨', label:'Wind Speed',             value:17,    unit:'km/h',  color:'#2979ff', bar:28 },
    { icon:'€',  label:'Energy Cost',            value:0.31,  unit:'/kWh',  color:'#ffab00', bar:40 },
    { icon:'🌿', label:'CO₂ Saved',              value:5.1,   unit:'kg',    color:'#00c853', bar:75 },
  ],
  'BLK-D': [
    { icon:'🌡️', label:'Temperature',           value:19.5,  unit:'°C',    color:'#ff6b35', bar:56 },
    { icon:'☀️', label:'Solar Irradiance',       value:640,   unit:'W/m²',  color:'#ffab00', bar:68 },
    { icon:'🔋', label:'Battery SOC',            value:61,    unit:'%',     color:'#00c853', bar:61 },
    { icon:'🔌', label:'Grid Import',            value:0.88,  unit:'kW',    color:'#ff1744', bar:30 },
    { icon:'📤', label:'Grid Export',            value:2.3,   unit:'kW',    color:'#00b8a4', bar:48 },
    { icon:'💨', label:'Wind Speed',             value:23,    unit:'km/h',  color:'#2979ff', bar:37 },
    { icon:'€',  label:'Energy Cost',            value:0.355, unit:'/kWh',  color:'#ffab00', bar:48 },
    { icon:'🌿', label:'CO₂ Saved',              value:3.4,   unit:'kg',    color:'#00c853', bar:55 },
  ],
}

const EV_CHARGERS: EV[] = [
  { id:'EVCharger001', block:'BLK-A', status:'CHARGING', power:7.4, sessionTime:42, soc:68 },
  { id:'EVCharger002', block:'BLK-B', status:'IDLE',     power:0,   sessionTime:0,  soc:95 },
  { id:'EVCharger003', block:'BLK-C', status:'CHARGING', power:11.0,sessionTime:18, soc:34 },
  { id:'EVCharger004', block:'BLK-D', status:'IDLE',     power:0,   sessionTime:0,  soc:82 },
]

const MOCK_DEVICES: Device[] = [
  { sfdi:'SM-A001', type:'Smart Meter',    block:'BLK-A', status:'Online' },
  { sfdi:'PV-A002', type:'Solar Inverter', block:'BLK-A', status:'Online' },
  { sfdi:'EV-A003', type:'EV Charger',     block:'BLK-A', status:'Online' },
  { sfdi:'SM-B001', type:'Smart Meter',    block:'BLK-B', status:'Online' },
  { sfdi:'BA-B002', type:'Battery Storage',block:'BLK-B', status:'Warning' },
  { sfdi:'SM-C001', type:'Smart Meter',    block:'BLK-C', status:'Online' },
  { sfdi:'WT-C002', type:'Wind Turbine',   block:'BLK-C', status:'Online' },
  { sfdi:'SM-D001', type:'Smart Meter',    block:'BLK-D', status:'Online' },
]

// ── Styles ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#f4f6f8', card: '#ffffff', cyan: '#00b8a4', navy: '#002970',
  text: '#1a1a2e', text2: '#5a6a7a', text3: '#9aaab8',
  border: '#e8edf2', green: '#00c853', red: '#ff1744',
  orange: '#ff6d00', amber: '#ffab00', blue: '#2979ff',
  cyanLight: '#e0f7f5',
}
const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.card, borderRadius: 20, padding: 20,
  boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0', ...extra
})
const pill = (color: string): React.CSSProperties => ({
  fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: 1.5,
  padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
  background: color + '18', border: `1px solid ${color}`, color,
})

// ── App ────────────────────────────────────────────────────────────────────
export default function VCGApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [activeBlock, setActiveBlock] = useState<Block|null>(null)
  const [apiOnline, setApiOnline] = useState<boolean|null>(null)
  const [apiMsg, setApiMsg] = useState('')
  const [blocks, setBlocks] = useState<Block[]>(BLOCKS)
  const [sensors, setSensors] = useState<Record<string,Sensor[]>>(BLOCK_SENSORS)
  const [apiDevices, setApiDevices] = useState<Device[]>([])

  // Live updates
  useEffect(() => {
    const iv = setInterval(() => {
      setBlocks(prev => prev.map(b => {
        const gen = +(b.generation + (Math.random()-0.5)*2).toFixed(1)
        const con = +(b.consumption + (Math.random()-0.5)*1.5).toFixed(1)
        const net = +(gen-con).toFixed(1)
        return { ...b, generation:gen, consumption:con, net, status:net>0.5?'Surplus':net<-0.5?'Deficit':'Balanced' }
      }))
      setSensors(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => {
          next[k] = next[k].map((s,i) => {
            const d = [0.3,8,1.5,0.04,0.08,0.8,0.004,0.08][i]||0.1
            return { ...s, value: +(s.value+(Math.random()-0.5)*d).toFixed(s.value<10?2:1) }
          })
        })
        return next
      })
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  const checkApi = useCallback(async () => {
    setApiOnline(null)
    try {
      const r = await fetch(API)
      const d = await r.json()
      setApiOnline(true); setApiMsg(d.message||'')
      const r2 = await fetch(API+'/edev')
      const d2 = await r2.json()
      setApiDevices(Array.isArray(d2)?d2:d2.EndDevice||[])
    } catch { setApiOnline(false); setApiMsg('API offline') }
  }, [])

  useEffect(() => { checkApi() }, [])

  const openBlock = (b: Block) => { setActiveBlock(b); setScreen('block') }
  const goHome = () => { setScreen('home'); setActiveBlock(null) }

  const totalGen = blocks.reduce((s,b)=>s+b.generation,0)
  const totalCon = blocks.reduce((s,b)=>s+b.consumption,0)
  const totalNet = +(totalGen-totalCon).toFixed(1)

  const statusColor = apiOnline===null?C.amber:apiOnline?C.green:C.red

  return (
    <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100vh', background:C.bg, fontFamily:'Nunito,sans-serif', position:'relative' }}>

      {/* ── HEADER ── */}
      <div style={{ background:'linear-gradient(135deg,#002970 0%,#00b8a4 100%)', padding:'16px 20px 70px', position:'relative', overflow:'hidden' }}>
        {/* subtle grid overlay */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }} />
        <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:36,height:36,borderRadius:12,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>⚡</div>
              <div>
                <div style={{ fontWeight:900, fontSize:16, color:'#fff' }}>VCG Portal</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.7)', letterSpacing:1.5 }}>MI6228 · GROUP 13</div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.15)', borderRadius:20, padding:'4px 10px' }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:statusColor,animation:apiOnline?'pulse 2s infinite':undefined }} />
              <span style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:'#fff', fontWeight:700 }}>
                {apiOnline===null?'Checking':apiOnline?'Live':'Offline'}
              </span>
            </div>
            <button onClick={checkApi} style={{ background:'rgba(255,255,255,0.15)',border:'none',borderRadius:8,padding:'4px 10px',color:'#fff',fontSize:10,cursor:'pointer',fontFamily:"'Share Tech Mono',monospace" }}>↺ Refresh</button>
          </div>
        </div>

        {/* Summary strip */}
        <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:16 }}>
          {[
            { l:'Total Gen', v:totalGen.toFixed(1), u:'kW', c:'#a7f3d0' },
            { l:'Total Con', v:totalCon.toFixed(1), u:'kW', c:'#fde68a' },
            { l:'Net Balance', v:(totalNet>=0?'+':'')+totalNet, u:'kW', c:totalNet>=0?'#a7f3d0':'#fca5a5' },
          ].map(s=>(
            <div key={s.l} style={{ background:'rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 8px',textAlign:'center',backdropFilter:'blur(8px)' }}>
              <div style={{ fontSize:18,fontWeight:900,color:s.c,lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.6)',fontWeight:700,marginTop:2 }}>{s.u} · {s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div style={{ marginTop:-44, padding:'0 16px 100px' }}>
        {screen==='home'    && <HomeScreen blocks={blocks} onBlockClick={openBlock} apiMsg={apiMsg} apiOnline={apiOnline} />}
        {screen==='block'   && activeBlock && <BlockScreen block={activeBlock} blocks={blocks} sensors={sensors[activeBlock.id]||[]} evs={EV_CHARGERS.filter(e=>e.block===activeBlock.id)} devices={[...MOCK_DEVICES,...apiDevices].filter(d=>d.block===activeBlock.id)} onBack={goHome} onRegister={()=>setScreen('register')} />}
        {screen==='register'&& <RegisterScreen blocks={blocks} activeBlock={activeBlock} onBack={()=>setScreen(activeBlock?'block':'home')} apiOnline={apiOnline} apiUrl={API} />}
        {screen==='settings'&& <SettingsScreen apiOnline={apiOnline} apiMsg={apiMsg} onRefresh={checkApi} />}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-around',padding:'10px 0 18px',zIndex:50,boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
        {([
          { id:'home',     icon:'🏠', label:'Home' },
          { id:'register', icon:'➕', label:'Register' },
          { id:'settings', icon:'⚙️', label:'Settings' },
        ] as {id:Screen;icon:string;label:string}[]).map(t=>(
          <button key={t.id} onClick={()=>{ if(t.id!=='register'||screen!=='block') setActiveBlock(null); setScreen(t.id) }}
            style={{ background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'0 20px' }}>
            <div style={{ width:40,height:40,borderRadius:14,background:(screen===t.id)?'linear-gradient(135deg,#002970,#00b8a4)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,transition:'all 0.2s' }}>
              {screen===t.id ? <span style={{ filter:'brightness(10)' }}>{t.icon}</span> : <span>{t.icon}</span>}
            </div>
            <span style={{ fontSize:10,fontWeight:700,color:screen===t.id?C.navy:C.text3 }}>{t.label}</span>
          </button>
        ))}
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.5)}}`}</style>
    </div>
  )
}

// ── HOME SCREEN ─────────────────────────────────────────────────────────────
function HomeScreen({ blocks, onBlockClick, apiMsg, apiOnline }: { blocks:Block[]; onBlockClick:(b:Block)=>void; apiMsg:string; apiOnline:boolean|null }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      {/* API banner */}
      {apiOnline && apiMsg && (
        <div className="slide-up" style={{ background:C.cyanLight,border:`1px solid ${C.cyan}`,borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,marginTop:4 }}>
          <span style={{ fontSize:14 }}>✅</span>
          <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.cyan }}>{apiMsg}</span>
        </div>
      )}

      {/* Section title */}
      <div style={{ marginTop:4 }}>
        <div style={{ fontWeight:900,fontSize:18,color:C.text }}>Energy Communities</div>
        <div style={{ fontSize:12,color:C.text2,marginTop:2 }}>Tap a block to view details, sensors & devices</div>
      </div>

      {/* Block cards */}
      {blocks.map((b,i)=>(
        <div key={b.id} className={`slide-up d${i+1}`} onClick={()=>onBlockClick(b)}
          style={{ background:C.card,borderRadius:20,padding:20,boxShadow:'0 2px 12px rgba(0,0,0,0.07)',border:`1px solid ${C.border}`,cursor:'pointer',transition:'transform 0.15s,box-shadow 0.15s' }}
          onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'}}
          onMouseOut={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.07)'}}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
            <div style={{ display:'flex',gap:12,alignItems:'center' }}>
              <div style={{ width:46,height:46,borderRadius:14,background:b.color+'18',border:`1.5px solid ${b.color}30`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>{b.emoji}</div>
              <div>
                <div style={{ fontWeight:800,fontSize:16,color:C.text }}>{b.name} — {b.location}</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,marginTop:2 }}>{b.id} · {b.devices} devices</div>
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6 }}>
              <div style={pill(b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan)}>{b.status}</div>
              <span style={{ fontSize:18,color:C.text3 }}>›</span>
            </div>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8 }}>
            {[
              { l:'Generation', v:b.generation.toFixed(1), c:C.green },
              { l:'Consumption', v:b.consumption.toFixed(1), c:C.amber },
              { l:'Net', v:(b.net>=0?'+':'')+b.net.toFixed(1), c:b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan },
            ].map(s=>(
              <div key={s.l} style={{ background:'#f8fafc',borderRadius:12,padding:'10px 6px',textAlign:'center' }}>
                <div style={{ fontSize:18,fontWeight:900,color:s.c,lineHeight:1 }}>{s.v}</div>
                <div style={{ fontSize:9,color:C.text3,fontWeight:700,marginTop:3 }}>{s.l} kW</div>
              </div>
            ))}
          </div>
          {/* tap hint */}
          <div style={{ marginTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6,paddingTop:10,borderTop:`1px solid ${C.border}` }}>
            <span style={{ fontSize:11,color:C.cyan,fontWeight:700 }}>Tap to view sensors, EV & devices</span>
            <span style={{ fontSize:14 }}>⚡</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── BLOCK SCREEN ────────────────────────────────────────────────────────────
function BlockScreen({ block:b, blocks, sensors, evs, devices, onBack, onRegister }: { block:Block; blocks:Block[]; sensors:Sensor[]; evs:EV[]; devices:Device[]; onBack:()=>void; onRegister:()=>void }) {
  const sc = b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan
  const liveBlock = blocks.find(x=>x.id===b.id)||b

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      {/* Back + header */}
      <div className="fade-in" style={{ background:C.card,borderRadius:20,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
        <div style={{ background:`linear-gradient(135deg,${b.color}dd,${b.color}88)`, padding:'16px 20px' }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'6px 14px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:12,display:'flex',alignItems:'center',gap:6 }}>
            ← Back
          </button>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div style={{ display:'flex',gap:12,alignItems:'center' }}>
              <span style={{ fontSize:32 }}>{b.emoji}</span>
              <div>
                <div style={{ fontWeight:900,fontSize:20,color:'#fff' }}>{b.name}</div>
                <div style={{ fontSize:12,color:'rgba(255,255,255,0.8)' }}>{b.location} · {b.id}</div>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:900,fontSize:24,color:'#fff' }}>{(liveBlock.net>=0?'+':'')+liveBlock.net.toFixed(1)}</div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:700 }}>kW Net</div>
            </div>
          </div>
        </div>
        {/* Energy stats */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'14px 16px',gap:8 }}>
          {[
            { l:'Generation', v:liveBlock.generation.toFixed(1), c:C.green },
            { l:'Consumption', v:liveBlock.consumption.toFixed(1), c:C.amber },
            { l:'Status', v:liveBlock.status, c:sc },
          ].map(s=>(
            <div key={s.l} style={{ textAlign:'center' }}>
              <div style={{ fontWeight:900,fontSize:20,color:s.c }}>{s.v}</div>
              <div style={{ fontSize:10,color:C.text3,fontWeight:600,marginTop:2 }}>{s.l} {s.l!=='Status'?'kW':''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sensors */}
      <SectionHeader title="Sensor Parameters" />
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
        {sensors.map((s,i)=>(
          <div key={s.label} className={`slide-up d${(i%4)+1}`} style={card({ padding:'14px 16px' })}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
              <span style={{ fontSize:20 }}>{s.icon}</span>
              <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,background:'#f4f6f8',padding:'2px 7px',borderRadius:6 }}>{s.unit}</span>
            </div>
            <div style={{ fontWeight:900,fontSize:26,color:s.color,lineHeight:1,marginBottom:4 }}>{s.value}</div>
            <div style={{ fontSize:11,color:C.text2,marginBottom:8 }}>{s.label}</div>
            <div style={{ height:3,background:'#f0f0f0',borderRadius:2,overflow:'hidden' }}>
              <div style={{ height:'100%',width:s.bar+'%',background:`linear-gradient(90deg,${s.color}88,${s.color})`,borderRadius:2,transition:'width 1s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* EV Chargers */}
      {evs.length>0 && <>
        <SectionHeader title="EV Charging Sessions" />
        {evs.map(ev=>(
          <div key={ev.id} style={card({ border:`1.5px solid ${ev.status==='CHARGING'?C.amber:C.border}` })}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
              <div style={{ display:'flex',gap:10,alignItems:'center' }}>
                <span style={{ fontSize:24 }}>🚗</span>
                <div style={{ fontWeight:800,fontSize:15,color:C.text }}>{ev.id}</div>
              </div>
              <div style={pill(ev.status==='CHARGING'?C.amber:C.text3)}>{ev.status}</div>
            </div>
            {[{l:'Power Draw',v:ev.power+' kW'},{l:'Session Time',v:ev.sessionTime+' min'},{l:'Battery SOC',v:ev.soc+'%'}].map(r=>(
              <div key={r.l} style={{ display:'flex',justifyContent:'space-between',marginBottom:8 }}>
                <span style={{ fontSize:12,color:C.text2 }}>{r.l}</span>
                <span style={{ fontWeight:800,fontSize:12,color:C.text }}>{r.v}</span>
              </div>
            ))}
            <div style={{ height:4,background:'#f0f0f0',borderRadius:2,overflow:'hidden',marginTop:4 }}>
              <div style={{ height:'100%',width:ev.soc+'%',background:ev.status==='CHARGING'?`linear-gradient(90deg,${C.amber},${C.orange})`:`linear-gradient(90deg,${C.cyan},#00e5cc)`,borderRadius:2 }} />
            </div>
          </div>
        ))}
      </>}

      {/* Devices */}
      <SectionHeader title={`Registered Devices (${devices.length})`} />
      <div style={card({ padding:16 })}>
        {devices.length===0 ? (
          <div style={{ textAlign:'center',padding:'16px 0' }}>
            <div style={{ fontSize:32,marginBottom:8 }}>📭</div>
            <div style={{ fontSize:13,color:C.text2 }}>No devices in this block yet</div>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {devices.map((d,i)=>(
              <div key={i} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'#f8fafc',borderRadius:12,border:`1px solid ${C.border}` }}>
                <div style={{ width:36,height:36,borderRadius:10,background:C.cyanLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>📟</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Share Tech Mono',monospace",fontWeight:700,fontSize:12,color:C.cyan }}>{d.sfdi}</div>
                  <div style={{ fontSize:11,color:C.text3 }}>{d.type}</div>
                </div>
                <div style={pill(d.status==='Online'?C.green:C.amber)}>{d.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register button */}
      <button onClick={onRegister} style={{ width:'100%',background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:16,padding:'15px',fontWeight:900,fontSize:16,cursor:'pointer',marginTop:4,display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
        ➕ Register Device to {b.name}
      </button>
    </div>
  )
}

// ── REGISTER SCREEN ─────────────────────────────────────────────────────────
function RegisterScreen({ blocks, activeBlock, onBack, apiOnline, apiUrl }: { blocks:Block[]; activeBlock:Block|null; onBack:()=>void; apiOnline:boolean|null; apiUrl:string }) {
  const [form, setForm] = useState({
    sfdi:'', lfdi:'', deviceType:'Smart Meter',
    block: activeBlock?.id||'BLK-A',
    realPower:'', voltage:'', temperature:'', solarIrradiance:'', batterySoc:'', gridImport:''
  })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width:'100%', padding:'12px 14px', border:`1.5px solid ${C.border}`, borderRadius:12,
    fontSize:14, fontFamily:'Nunito,sans-serif', color:C.text, background:'#fafafa',
    outline:'none', transition:'border-color 0.2s', ...extra
  })
  const lbl: React.CSSProperties = { fontSize:12, fontWeight:700, color:C.text2, display:'block', marginBottom:6 }

  const submit = async () => {
    if (!form.sfdi||!form.lfdi) { setMsg('⚠️ Device ID and Long Form ID are required'); return }
    setLoading(true)
    try {
      const r = await fetch(apiUrl+'/edev',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setMsg(r.ok?'✅ Device registered successfully!':'❌ Registration failed — '+r.status)
    } catch { setMsg('📴 API offline — registration queued locally') }
    setLoading(false)
    setTimeout(()=>setMsg(''),4000)
  }

  const selectedBlock = blocks.find(b=>b.id===form.block)

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={card()}>
        <button onClick={onBack} style={{ background:'#f4f6f8',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:C.text2,cursor:'pointer',marginBottom:14,display:'flex',alignItems:'center',gap:6 }}>← Back</button>
        <div style={{ fontWeight:900,fontSize:18,color:C.text,marginBottom:4 }}>Register New Device</div>
        <div style={{ fontSize:12,color:C.text2 }}>IEEE 2030.5 End Device Registration</div>
      </div>

      {/* Block selector */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:12 }}>Select Community Block</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
          {blocks.map(b=>(
            <button key={b.id} onClick={()=>setForm(p=>({...p,block:b.id}))}
              style={{ padding:'10px',borderRadius:12,border:`2px solid ${form.block===b.id?b.color:C.border}`,background:form.block===b.id?b.color+'12':'#fafafa',cursor:'pointer',textAlign:'left',transition:'all 0.15s' }}>
              <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                <span style={{ fontSize:18 }}>{b.emoji}</span>
                <div>
                  <div style={{ fontWeight:700,fontSize:13,color:form.block===b.id?b.color:C.text }}>{b.name}</div>
                  <div style={{ fontSize:10,color:C.text3 }}>{b.location}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {selectedBlock && (
          <div style={{ marginTop:10,padding:'8px 12px',background:selectedBlock.color+'12',borderRadius:10,fontSize:12,color:selectedBlock.color,fontWeight:700,display:'flex',alignItems:'center',gap:6 }}>
            <span>{selectedBlock.emoji}</span> Registering to {selectedBlock.name} — {selectedBlock.location}
          </div>
        )}
      </div>

      {/* Form */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:14 }}>Device Identity</div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div>
            <label style={lbl}>Device ID (SFDI) *</label>
            <input style={inp()} placeholder="e.g. SM_BlockA_001" value={form.sfdi} onChange={e=>setForm(p=>({...p,sfdi:e.target.value}))}
              onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
          </div>
          <div>
            <label style={lbl}>Long Form ID (LFDI) *</label>
            <input style={inp()} placeholder="e.g. LFDI-SM-001" value={form.lfdi} onChange={e=>setForm(p=>({...p,lfdi:e.target.value}))}
              onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
          </div>
          <div>
            <label style={lbl}>Device Type</label>
            <select style={inp({ cursor:'pointer' })} value={form.deviceType} onChange={e=>setForm(p=>({...p,deviceType:e.target.value}))}>
              {['Smart Meter','Solar Inverter','EV Charger','HVAC','Battery Storage','Wind Turbine','Load Controller'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:14 }}>Parameters</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          {[
            { l:'Real Power (W)',         k:'realPower',       ph:'e.g. 1400' },
            { l:'Voltage (V)',            k:'voltage',         ph:'e.g. 230'  },
            { l:'Temperature (°C)',       k:'temperature',     ph:'e.g. 18.5' },
            { l:'Solar Irradiance (W/m²)',k:'solarIrradiance', ph:'e.g. 650'  },
            { l:'Battery SOC (%)',        k:'batterySoc',      ph:'e.g. 75'   },
            { l:'Grid Import (kW)',       k:'gridImport',      ph:'e.g. 1.2'  },
          ].map(f=>(
            <div key={f.k}>
              <label style={lbl}>{f.l}</label>
              <input style={inp()} placeholder={f.ph} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'10px 14px',background:C.cyanLight,borderRadius:12,border:`1px solid ${C.cyan}`,fontSize:12,color:C.cyan,fontWeight:700 }}>
        📡 Will POST to <span style={{ fontFamily:"'Share Tech Mono',monospace" }}>/edev</span> on your IEEE 2030.5 gateway
        {!apiOnline&&<div style={{ color:C.red,marginTop:4 }}>⚠️ API offline — will queue locally</div>}
      </div>

      <button onClick={submit} disabled={loading}
        style={{ width:'100%',background:loading?C.text3:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:16,padding:'15px',fontWeight:900,fontSize:16,cursor:loading?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
        {loading?<><div style={{ width:16,height:16,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite' }} /> Registering...</>:'⊕ Register Device'}
      </button>

      {msg&&<div style={{ padding:'12px 16px',borderRadius:12,background:msg.startsWith('✅')?'#e8f5e9':msg.startsWith('❌')?'#fce4ec':'#fff8e1',fontSize:13,fontWeight:700,color:msg.startsWith('✅')?C.green:msg.startsWith('❌')?C.red:C.amber,border:`1px solid ${msg.startsWith('✅')?C.green:msg.startsWith('❌')?C.red:C.amber}30` }}>{msg}</div>}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── SETTINGS SCREEN ─────────────────────────────────────────────────────────
function SettingsScreen({ apiOnline, apiMsg, onRefresh }: { apiOnline:boolean|null; apiMsg:string; onRefresh:()=>void }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      {/* Profile */}
      <div style={{ background:`linear-gradient(135deg,${C.navy},${C.cyan})`,borderRadius:20,padding:24,color:'#fff' }}>
        <div style={{ width:56,height:56,borderRadius:18,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:12 }}>👨‍💻</div>
        <div style={{ fontWeight:900,fontSize:20 }}>Ronit</div>
        <div style={{ fontSize:12,color:'rgba(255,255,255,0.7)',marginTop:2 }}>Virtual Communication Gateway</div>
        <div style={{ display:'flex',gap:8,marginTop:14 }}>
          {[{ l:'Student', v:'MI6228' },{ l:'Group', v:'13' },{ l:'Mentor', v:'Paolo C.' }].map(x=>(
            <div key={x.l} style={{ background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'6px 12px' }}>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.6)',fontWeight:700,textTransform:'uppercase',letterSpacing:1 }}>{x.l}</div>
              <div style={{ fontSize:13,fontWeight:800 }}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* API Status */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:15,color:C.text,marginBottom:14 }}>API Status</div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#f8fafc',borderRadius:12,marginBottom:8 }}>
          <div>
            <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.text2 }}>virtual-gateway.onrender.com</div>
            {apiMsg&&<div style={{ fontSize:11,color:apiOnline?C.green:C.red,marginTop:2 }}>{apiMsg}</div>}
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ width:8,height:8,borderRadius:'50%',background:apiOnline===null?C.amber:apiOnline?C.green:C.red }} />
            <span style={{ fontSize:11,fontWeight:700,color:apiOnline===null?C.amber:apiOnline?C.green:C.red }}>{apiOnline===null?'Checking':apiOnline?'Online':'Offline'}</span>
          </div>
        </div>
        <button onClick={onRefresh} style={{ width:'100%',background:C.cyanLight,border:`1px solid ${C.cyan}`,borderRadius:12,padding:'11px',fontWeight:700,fontSize:13,color:C.cyan,cursor:'pointer' }}>↺ Refresh Connection</button>
      </div>

      {/* Quick Links */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:15,color:C.text,marginBottom:14 }}>Quick Links</div>
        {[
          { icon:'🚀', l:'Live API Docs',     sub:'virtual-gateway.onrender.com/docs', href:API+'/docs' },
          { icon:'💻', l:'GitHub Repo',        sub:'rt0181996/virtual-gateway',         href:'https://github.com/rt0181996/virtual-gateway' },
          { icon:'📊', l:'Grafana Dashboard', sub:'localhost:3000',                     href:'http://localhost:3000' },
          { icon:'🌐', l:'IDS Dataspace',     sub:'localhost:8181',                     href:'http://localhost:8181' },
        ].map((x,i)=>(
          <a key={x.l} href={x.href} target="_blank" rel="noopener" style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:i<3?`1px solid ${C.border}`:'none',textDecoration:'none' }}>
            <div style={{ width:38,height:38,borderRadius:12,background:C.cyanLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>{x.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700,fontSize:13,color:C.text }}>{x.l}</div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3 }}>{x.sub}</div>
            </div>
            <span style={{ color:C.text3,fontSize:18 }}>›</span>
          </a>
        ))}
      </div>

      <div style={{ textAlign:'center',padding:8,fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,letterSpacing:1.5 }}>
        VCG v1.0 · IEEE 2030.5 · FIWARE · IDS DATASPACE
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return <div style={{ fontWeight:800,fontSize:14,color:C.text,paddingLeft:4 }}>{title}</div>
}
