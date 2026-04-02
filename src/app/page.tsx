'use client'
import { useState, useEffect, useCallback } from 'react'

const API = 'https://virtual-gateway.onrender.com'
const APP_URL = 'https://vcg-webapp.vercel.app'

// ── Types ───────────────────────────────────────────────────────────────────
interface Block {
  id: string; name: string; location: string; emoji: string
  generation: number; consumption: number; net: number
  status: 'Surplus'|'Deficit'|'Balanced'; devices: number; color: string
}
interface Sensor { icon: string; label: string; value: number; unit: string; color: string; bar: number }
interface EV { id: string; block: string; status: 'CHARGING'|'IDLE'; power: number; sessionTime: number; soc: number }
interface Device { sfdi: string; type: string; block: string; status: string }
type Screen = 'home'|'block'|'register'|'settings'|'qr'|'add-community'|'import'

// ── Default Sensor Template ─────────────────────────────────────────────────
const makeSensors = (t=20, sol=600, bat=50, gi=1, ge=1, ws=25, ec=0.38, co2=2): Sensor[] => [
  { icon:'🌡️', label:'Temperature',      value:t,   unit:'°C',   color:'#ff6b35', bar:Math.round(t/40*100) },
  { icon:'☀️', label:'Solar Irradiance', value:sol, unit:'W/m²', color:'#ffab00', bar:Math.round(sol/1000*100) },
  { icon:'🔋', label:'Battery SOC',      value:bat, unit:'%',    color:'#00c853', bar:bat },
  { icon:'🔌', label:'Grid Import',      value:gi,  unit:'kW',   color:'#ff1744', bar:Math.round(gi/5*100) },
  { icon:'📤', label:'Grid Export',      value:ge,  unit:'kW',   color:'#00b8a4', bar:Math.round(ge/5*100) },
  { icon:'💨', label:'Wind Speed',       value:ws,  unit:'km/h', color:'#2979ff', bar:Math.round(ws/60*100) },
  { icon:'€',  label:'Energy Cost',      value:ec,  unit:'/kWh', color:'#ffab00', bar:Math.round(ec/0.6*100) },
  { icon:'🌿', label:'CO₂ Saved',        value:co2, unit:'kg',   color:'#00c853', bar:Math.round(co2/8*100) },
]

// ── Initial Data ────────────────────────────────────────────────────────────
const INIT_BLOCKS: Block[] = [
  { id:'BLK-A', name:'Block A', location:'Dublin',  emoji:'🏙️', generation:145.8, consumption:98.2,  net:47.6,  status:'Surplus', devices:12, color:'#00b8a4' },
  { id:'BLK-B', name:'Block B', location:'Kerry',   emoji:'🏘️', generation:82.3,  consumption:110.7, net:-28.4, status:'Deficit', devices:8,  color:'#2979ff' },
  { id:'BLK-C', name:'Block C', location:'Galway',  emoji:'🌆', generation:200.1, consumption:195.4, net:4.7,   status:'Surplus', devices:15, color:'#ff6d00' },
  { id:'BLK-D', name:'Block D', location:'Limerick',emoji:'🌉', generation:134.5, consumption:89.0,  net:45.5,  status:'Surplus', devices:10, color:'#9c27b0' },
]

const INIT_SENSORS: Record<string,Sensor[]> = {
  'BLK-A': makeSensors(20.3,693,43,0.57,1.85,29,0.386,2.2),
  'BLK-B': makeSensors(18.1,510,22,3.2,0.4,41,0.42,0.8),
  'BLK-C': makeSensors(22.7,820,78,0.12,4.6,17,0.31,5.1),
  'BLK-D': makeSensors(19.5,640,61,0.88,2.3,23,0.355,3.4),
}

const INIT_EVS: EV[] = [
  { id:'EVCharger001', block:'BLK-A', status:'CHARGING', power:7.4, sessionTime:42, soc:68 },
  { id:'EVCharger002', block:'BLK-B', status:'IDLE',     power:0,   sessionTime:0,  soc:95 },
  { id:'EVCharger003', block:'BLK-C', status:'CHARGING', power:11.0,sessionTime:18, soc:34 },
  { id:'EVCharger004', block:'BLK-D', status:'IDLE',     power:0,   sessionTime:0,  soc:82 },
]

const INIT_DEVICES: Device[] = [
  { sfdi:'SM-A001', type:'Smart Meter',    block:'BLK-A', status:'Online' },
  { sfdi:'PV-A002', type:'Solar Inverter', block:'BLK-A', status:'Online' },
  { sfdi:'EV-A003', type:'EV Charger',     block:'BLK-A', status:'Online' },
  { sfdi:'SM-B001', type:'Smart Meter',    block:'BLK-B', status:'Online' },
  { sfdi:'BA-B002', type:'Battery Storage',block:'BLK-B', status:'Warning' },
  { sfdi:'SM-C001', type:'Smart Meter',    block:'BLK-C', status:'Online' },
  { sfdi:'WT-C002', type:'Wind Turbine',   block:'BLK-C', status:'Online' },
  { sfdi:'SM-D001', type:'Smart Meter',    block:'BLK-D', status:'Online' },
]

const BLOCK_COLORS = ['#00b8a4','#2979ff','#ff6d00','#9c27b0','#e91e63','#00897b','#f57c00','#1565c0','#6a1b9a','#558b2f']
const BLOCK_EMOJIS = ['🏙️','🏘️','🌆','🌉','🏚️','🌃','🏗️','🌇','🏛️','🌁']

// ── Style helpers ───────────────────────────────────────────────────────────
const C = { bg:'#f4f6f8', card:'#ffffff', cyan:'#00b8a4', navy:'#002970', text:'#1a1a2e', text2:'#5a6a7a', text3:'#9aaab8', border:'#e8edf2', green:'#00c853', red:'#ff1744', orange:'#ff6d00', amber:'#ffab00', blue:'#2979ff', cyanLight:'#e0f7f5' }
const card = (x?: React.CSSProperties): React.CSSProperties => ({ background:C.card, borderRadius:20, padding:20, boxShadow:'0 2px 12px rgba(0,0,0,0.07)', border:`1px solid ${C.border}`, ...x })
const pill = (color: string): React.CSSProperties => ({ fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:1.5, padding:'3px 10px', borderRadius:20, textTransform:'uppercase' as const, background:color+'18', border:`1px solid ${color}`, color })
const lbl: React.CSSProperties = { fontSize:12, fontWeight:700, color:C.text2, display:'block', marginBottom:6 }
const inp = (x?: React.CSSProperties): React.CSSProperties => ({ width:'100%', padding:'12px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:14, fontFamily:'Nunito,sans-serif', color:C.text, background:'#fafafa', outline:'none', transition:'border-color 0.2s', ...x })

// ── Main App ────────────────────────────────────────────────────────────────
export default function VCGApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [activeBlock, setActiveBlock] = useState<Block|null>(null)
  const [apiOnline, setApiOnline] = useState<boolean|null>(null)
  const [apiMsg, setApiMsg] = useState('')
  const [blocks, setBlocks] = useState<Block[]>(INIT_BLOCKS)
  const [sensors, setSensors] = useState<Record<string,Sensor[]>>(INIT_SENSORS)
  const [evs, setEvs] = useState<EV[]>(INIT_EVS)
  const [devices, setDevices] = useState<Device[]>(INIT_DEVICES)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  // Live data fluctuation
  useEffect(() => {
    const iv = setInterval(() => {
      setBlocks(prev => prev.map(b => {
        const gen = +(b.generation+(Math.random()-0.5)*2).toFixed(1)
        const con = +(b.consumption+(Math.random()-0.5)*1.5).toFixed(1)
        const net = +(gen-con).toFixed(1)
        return { ...b, generation:gen, consumption:con, net, status:net>0.5?'Surplus':net<-0.5?'Deficit':'Balanced' }
      }))
      setSensors(prev => {
        const n = { ...prev }
        Object.keys(n).forEach(k => { n[k] = n[k].map((s,i) => { const d=[0.3,8,1.5,0.04,0.08,0.8,0.004,0.08][i]||0.1; return { ...s, value:+(s.value+(Math.random()-0.5)*d).toFixed(s.value<10?2:1) } }) })
        return n
      })
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  const checkApi = useCallback(async () => {
    setApiOnline(null)
    try {
      const r = await fetch(API); const d = await r.json()
      setApiOnline(true); setApiMsg(d.message||'Connected')
      try {
        const r2 = await fetch(API+'/edev'); const d2 = await r2.json()
        const apiDevs: Device[] = (Array.isArray(d2)?d2:d2.EndDevice||[]).map((x:any) => ({ sfdi:x.sfdi||x.id, type:x.deviceType||'IEEE Device', block:x.block||'BLK-A', status:'Online' }))
        if (apiDevs.length > 0) setDevices(prev => [...prev.filter(d=>!apiDevs.find(a=>a.sfdi===d.sfdi)), ...apiDevs])
      } catch {}
    } catch { setApiOnline(false); setApiMsg('Could not reach API') }
  }, [])

  useEffect(() => { checkApi() }, [])

  // Add a new community block
  const addBlock = (newBlock: Block) => {
    setBlocks(prev => [...prev, newBlock])
    setSensors(prev => ({ ...prev, [newBlock.id]: makeSensors() }))
    setEvs(prev => [...prev, { id:`EVCharger-${newBlock.id}`, block:newBlock.id, status:'IDLE', power:0, sessionTime:0, soc:100 }])
  }

  const addDevice = (d: Device) => setDevices(prev => [...prev, d])

  const openBlock = (b: Block) => { setActiveBlock(b); setScreen('block') }
  const goHome = () => { setScreen('home'); setActiveBlock(null) }
  const totalGen = blocks.reduce((s,b)=>s+b.generation,0)
  const totalCon = blocks.reduce((s,b)=>s+b.consumption,0)
  const totalNet = +(totalGen-totalCon).toFixed(1)
  const statusColor = apiOnline===null?C.amber:apiOnline?C.green:C.red

  return (
    <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100vh', background:C.bg, fontFamily:'Nunito,sans-serif', position:'relative' }}>

      {/* HEADER */}
      <div style={{ background:'linear-gradient(135deg,#002970 0%,#00b8a4 100%)', padding:'16px 20px 70px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.04) 1px,transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }} />
        <div style={{ position:'relative', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:12,background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>⚡</div>
            <div>
              <div style={{ fontWeight:900, fontSize:16, color:'#fff' }}>VCG Portal</div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.7)', letterSpacing:1.5 }}>MI6228 · GROUP 13</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.15)',borderRadius:20,padding:'4px 10px' }}>
              <div style={{ width:6,height:6,borderRadius:'50%',background:statusColor }} />
              <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:'#fff',fontWeight:700 }}>{apiOnline===null?'Checking':apiOnline?'Live':'Offline'}</span>
            </div>
            {/* QR button in header */}
            <button onClick={()=>setShowQR(true)} style={{ background:'rgba(255,255,255,0.15)',border:'none',borderRadius:10,padding:'6px 10px',color:'#fff',fontSize:16,cursor:'pointer' }}>📲</button>
          </div>
        </div>
        <div style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:16 }}>
          {[
            { l:'Total Gen',  v:totalGen.toFixed(1), c:'#a7f3d0' },
            { l:'Total Con',  v:totalCon.toFixed(1), c:'#fde68a' },
            { l:'Net',        v:(totalNet>=0?'+':'')+totalNet, c:totalNet>=0?'#a7f3d0':'#fca5a5' },
          ].map(s=>(
            <div key={s.l} style={{ background:'rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 8px',textAlign:'center',backdropFilter:'blur(8px)' }}>
              <div style={{ fontSize:18,fontWeight:900,color:s.c,lineHeight:1 }}>{s.v}</div>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.6)',fontWeight:700,marginTop:2 }}>{s.l} kW</div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ marginTop:-44, padding:'0 16px 100px' }}>
        {screen==='home'          && <HomeScreen blocks={blocks} onBlockClick={openBlock} apiOnline={apiOnline} apiMsg={apiMsg} onAddCommunity={()=>setScreen('add-community')} />}
        {screen==='block'         && activeBlock && <BlockScreen block={activeBlock} blocks={blocks} sensors={sensors[activeBlock.id]||[]} evs={evs.filter(e=>e.block===activeBlock.id)} devices={devices.filter(d=>d.block===activeBlock.id)} onBack={goHome} onRegister={()=>setScreen('register')} />}
        {screen==='register'      && <RegisterScreen blocks={blocks} activeBlock={activeBlock} onBack={()=>setScreen(activeBlock?'block':'home')} apiOnline={apiOnline} onDeviceAdded={addDevice} />}
        {screen==='settings'      && <SettingsScreen apiOnline={apiOnline} apiMsg={apiMsg} onRefresh={checkApi} onShowQR={()=>setShowQR(true)} />}
        {screen==='add-community' && <AddCommunityScreen blocks={blocks} onBack={goHome} onAdd={(b)=>{ addBlock(b); goHome() }} />}
        {screen==='import' && <ImportScreen blocks={blocks} onBack={goHome} onBlocksImported={(bs:Block[])=>{ bs.forEach((b:Block)=>addBlock(b)); goHome() }} onDevicesImported={(ds:Device[])=>{ ds.forEach((d:Device)=>addDevice(d)) }} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:C.card,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-around',padding:'10px 0 18px',zIndex:50,boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
        {([
          { id:'home',     icon:'🏠', label:'Home'     },
          { id:'register', icon:'➕', label:'Register'  },
          { id:'import', icon:'📊', label:'Import'  },
          { id:'qr',       icon:'📲', label:'QR Code'  },
          { id:'settings', icon:'⚙️', label:'Settings' },
        ] as {id:Screen;icon:string;label:string}[]).map(t=>(
          <button key={t.id} onClick={()=>{ if(t.id==='qr'){ setShowQR(true); return } if(t.id!=='register') setActiveBlock(null); setScreen(t.id) }}
            style={{ background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'0 12px' }}>
            <div style={{ width:40,height:40,borderRadius:14,background:(screen===t.id&&t.id!=='qr')?'linear-gradient(135deg,#002970,#00b8a4)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,transition:'all 0.2s' }}>
              {t.icon}
            </div>
            <span style={{ fontSize:10,fontWeight:700,color:(screen===t.id&&t.id!=='qr')?C.navy:C.text3 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* QR MODAL */}
      {showQR && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,41,112,0.7)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:24 }} onClick={()=>setShowQR(false)}>
          <div style={{ background:'#fff',borderRadius:28,padding:32,textAlign:'center',maxWidth:320,width:'100%' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:900,fontSize:20,color:C.navy,marginBottom:4 }}>Share VCG App</div>
            <div style={{ fontSize:12,color:C.text2,marginBottom:20 }}>Scan to open on any device</div>
            <div style={{ display:'inline-block',border:`3px solid ${C.cyan}`,borderRadius:16,padding:8,marginBottom:16 }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(APP_URL)}&color=002970&bgcolor=ffffff&qzone=1`} width={200} height={200} alt="QR" style={{ borderRadius:8,display:'block' }} />
            </div>
            {/* URL copy */}
            <div style={{ background:'#f4f6f8',borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,marginBottom:16,border:`1px solid ${C.border}` }}>
              <span style={{ fontSize:16 }}>🌐</span>
              <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{APP_URL}</span>
              <button onClick={()=>{ navigator.clipboard.writeText(APP_URL); setCopied(true); setTimeout(()=>setCopied(false),2000) }} style={{ background:'none',border:'none',cursor:'pointer',fontSize:16 }}>
                {copied?'✅':'📋'}
              </button>
            </div>
            {/* App info */}
            <div style={{ display:'flex',justifyContent:'center',gap:12,marginBottom:20,fontSize:11,color:C.text3 }}>
              <span>📡 IEEE 2030.5</span><span>·</span><span>🔥 FIWARE</span><span>·</span><span>🔒 IDS</span>
            </div>
            <button onClick={()=>setShowQR(false)} style={{ width:'100%',background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:14,padding:'14px',fontWeight:800,fontSize:15,cursor:'pointer' }}>Done</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .su{animation:slideUp 0.35s ease forwards}`}</style>
    </div>
  )
}

// ── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ blocks, onBlockClick, apiOnline, apiMsg, onAddCommunity }: { blocks:Block[]; onBlockClick:(b:Block)=>void; apiOnline:boolean|null; apiMsg:string; onAddCommunity:()=>void }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      {apiOnline && apiMsg && (
        <div style={{ background:C.cyanLight,border:`1px solid ${C.cyan}`,borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,marginTop:4 }}>
          <span>✅</span><span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.cyan }}>{apiMsg}</span>
        </div>
      )}

      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4 }}>
        <div>
          <div style={{ fontWeight:900,fontSize:18,color:C.text }}>Energy Communities</div>
          <div style={{ fontSize:12,color:C.text2,marginTop:2 }}>{blocks.length} communities · tap to view</div>
        </div>
        {/* ADD COMMUNITY button */}
        <button onClick={onAddCommunity} style={{ background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:14,padding:'10px 16px',fontWeight:800,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap' }}>
          ＋ Add Block
        </button>
      </div>

      {blocks.map((b,i)=>(
        <div key={b.id} className="su" style={{ animationDelay:`${i*0.06}s`, opacity:0, background:C.card, borderRadius:20, padding:20, boxShadow:'0 2px 12px rgba(0,0,0,0.07)', border:`1px solid ${C.border}`, cursor:'pointer', transition:'transform 0.15s,box-shadow 0.15s' }}
          onClick={()=>onBlockClick(b)}
          onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'}}
          onMouseOut={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,0.07)'}}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
            <div style={{ display:'flex',gap:12,alignItems:'center' }}>
              <div style={{ width:46,height:46,borderRadius:14,background:b.color+'18',border:`1.5px solid ${b.color}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22 }}>{b.emoji}</div>
              <div>
                <div style={{ fontWeight:800,fontSize:16,color:C.text }}>{b.name} — {b.location}</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,marginTop:2 }}>{b.id} · {b.devices} devices</div>
              </div>
            </div>
            <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6 }}>
              <div style={pill(b.status==='Surplus'?C.green:b.status==='Deficit'?C.red:C.cyan)}>{b.status}</div>
              <span style={{ fontSize:20,color:C.text3 }}>›</span>
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
          <div style={{ marginTop:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6,paddingTop:10,borderTop:`1px solid ${C.border}` }}>
            <span style={{ fontSize:11,color:C.cyan,fontWeight:700 }}>Tap to view sensors, EV &amp; devices</span>
            <span>⚡</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ADD COMMUNITY SCREEN ─────────────────────────────────────────────────────
function AddCommunityScreen({ blocks, onBack, onAdd }: { blocks:Block[]; onBack:()=>void; onAdd:(b:Block)=>void }) {
  const nextIdx = blocks.length
  const [form, setForm] = useState({
    name: `Block ${String.fromCharCode(65+nextIdx)}`,
    location: '',
    emoji: BLOCK_EMOJIS[nextIdx % BLOCK_EMOJIS.length],
    color: BLOCK_COLORS[nextIdx % BLOCK_COLORS.length],
    generation: '',
    consumption: '',
  })
  const [error, setError] = useState('')

  const handleAdd = () => {
    if (!form.location.trim()) { setError('Please enter a location'); return }
    const id = `BLK-${String.fromCharCode(65+nextIdx)}`
    const gen = parseFloat(form.generation)||Math.round(80+Math.random()*150)
    const con = parseFloat(form.consumption)||Math.round(60+Math.random()*120)
    const net = +(gen-con).toFixed(1)
    const newBlock: Block = {
      id, name:form.name, location:form.location, emoji:form.emoji, color:form.color,
      generation:gen, consumption:con, net, devices:0,
      status: net>0.5?'Surplus':net<-0.5?'Deficit':'Balanced'
    }
    onAdd(newBlock)
  }

  const EMOJI_OPTIONS = ['🏙️','🏘️','🌆','🌉','🏚️','🌃','🏗️','🌇','🏛️','🌁','🏠','🌄','🏢','🌊','⛵']
  const COLOR_OPTIONS = ['#00b8a4','#2979ff','#ff6d00','#9c27b0','#e91e63','#00897b','#f57c00','#1565c0','#6a1b9a','#558b2f']

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={card()}>
        <button onClick={onBack} style={{ background:'#f4f6f8',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:C.text2,cursor:'pointer',marginBottom:14 }}>← Back</button>
        <div style={{ fontWeight:900,fontSize:18,color:C.text,marginBottom:4 }}>Add New Community</div>
        <div style={{ fontSize:12,color:C.text2 }}>Create a new IEEE 2030.5 energy block</div>
      </div>

      {/* Preview card */}
      <div style={{ background:`linear-gradient(135deg,${form.color}dd,${form.color}88)`,borderRadius:20,padding:20,color:'#fff' }}>
        <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:8 }}>
          <span style={{ fontSize:36 }}>{form.emoji}</span>
          <div>
            <div style={{ fontWeight:900,fontSize:20 }}>{form.name||'New Block'}</div>
            <div style={{ fontSize:13,color:'rgba(255,255,255,0.8)' }}>{form.location||'Location...'}</div>
          </div>
        </div>
        <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:'rgba(255,255,255,0.6)' }}>Preview — live data will start automatically</div>
      </div>

      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:14 }}>Block Details</div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          <div>
            <label style={lbl}>Block Name</label>
            <input style={inp()} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Block E"
              onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
          </div>
          <div>
            <label style={lbl}>Location *</label>
            <input style={inp()} value={form.location} onChange={e=>{ setForm(p=>({...p,location:e.target.value})); setError('') }} placeholder="e.g. Waterford, Belfast, Cork..."
              onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
            {error&&<div style={{ fontSize:11,color:C.red,marginTop:4 }}>{error}</div>}
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <div>
              <label style={lbl}>Initial Generation (kW)</label>
              <input style={inp()} value={form.generation} onChange={e=>setForm(p=>({...p,generation:e.target.value}))} placeholder="e.g. 120 (auto)"
                onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
            </div>
            <div>
              <label style={lbl}>Initial Consumption (kW)</label>
              <input style={inp()} value={form.consumption} onChange={e=>setForm(p=>({...p,consumption:e.target.value}))} placeholder="e.g. 95 (auto)"
                onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
            </div>
          </div>
        </div>
      </div>

      {/* Emoji picker */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:12 }}>Choose Icon</div>
        <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
          {EMOJI_OPTIONS.map(e=>(
            <button key={e} onClick={()=>setForm(p=>({...p,emoji:e}))}
              style={{ width:44,height:44,borderRadius:12,border:`2px solid ${form.emoji===e?C.cyan:C.border}`,background:form.emoji===e?C.cyanLight:'#f8fafc',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:12 }}>Choose Color</div>
        <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
          {COLOR_OPTIONS.map(col=>(
            <button key={col} onClick={()=>setForm(p=>({...p,color:col}))}
              style={{ width:36,height:36,borderRadius:10,background:col,border:`3px solid ${form.color===col?C.text:'transparent'}`,cursor:'pointer',transition:'all 0.15s',transform:form.color===col?'scale(1.15)':'scale(1)' }} />
          ))}
        </div>
      </div>

      <button onClick={handleAdd} style={{ width:'100%',background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:16,padding:'15px',fontWeight:900,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
        ＋ Add Community Block
      </button>

      <div style={{ padding:'10px 14px',background:C.cyanLight,borderRadius:12,border:`1px solid ${C.cyan}`,fontSize:12,color:C.cyan }}>
        💡 You can add unlimited blocks. Each block gets its own sensors, EV chargers and device registry automatically.
      </div>
    </div>
  )
}

// ── BLOCK SCREEN ─────────────────────────────────────────────────────────────
function BlockScreen({ block:b, blocks, sensors, evs, devices, onBack, onRegister }: { block:Block; blocks:Block[]; sensors:Sensor[]; evs:EV[]; devices:Device[]; onBack:()=>void; onRegister:()=>void }) {
  const liveBlock = blocks.find(x=>x.id===b.id)||b
  const sc = liveBlock.status==='Surplus'?C.green:liveBlock.status==='Deficit'?C.red:C.cyan
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      {/* Block header */}
      <div style={{ background:C.card,borderRadius:20,overflow:'hidden',boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
        <div style={{ background:`linear-gradient(135deg,${b.color}ee,${b.color}88)`,padding:'16px 20px' }}>
          <button onClick={onBack} style={{ background:'rgba(255,255,255,0.2)',border:'none',borderRadius:10,padding:'6px 14px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:12 }}>← Back</button>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <div style={{ display:'flex',gap:12,alignItems:'center' }}>
              <span style={{ fontSize:32 }}>{b.emoji}</span>
              <div>
                <div style={{ fontWeight:900,fontSize:20,color:'#fff' }}>{b.name}</div>
                <div style={{ fontSize:12,color:'rgba(255,255,255,0.8)' }}>{b.location} · {b.id}</div>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:900,fontSize:28,color:'#fff' }}>{(liveBlock.net>=0?'+':'')+liveBlock.net.toFixed(1)}</div>
              <div style={{ fontSize:10,color:'rgba(255,255,255,0.7)',fontWeight:700 }}>kW Net</div>
            </div>
          </div>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'14px 16px',gap:8 }}>
          {[{l:'Generation',v:liveBlock.generation.toFixed(1),c:C.green},{l:'Consumption',v:liveBlock.consumption.toFixed(1),c:C.amber},{l:'Status',v:liveBlock.status,c:sc}].map(s=>(
            <div key={s.l} style={{ textAlign:'center' }}>
              <div style={{ fontWeight:900,fontSize:20,color:s.c }}>{s.v}</div>
              <div style={{ fontSize:10,color:C.text3,fontWeight:600,marginTop:2 }}>{s.l}{s.l!=='Status'?' kW':''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sensors */}
      <SecHead title="Sensor Parameters" />
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
        {sensors.map(s=>(
          <div key={s.label} style={card({ padding:'14px 16px' })}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
              <span style={{ fontSize:20 }}>{s.icon}</span>
              <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,background:'#f4f6f8',padding:'2px 7px',borderRadius:6 }}>{s.unit}</span>
            </div>
            <div style={{ fontWeight:900,fontSize:26,color:s.color,lineHeight:1,marginBottom:4 }}>{s.value}</div>
            <div style={{ fontSize:11,color:C.text2,marginBottom:8 }}>{s.label}</div>
            <div style={{ height:3,background:'#f0f0f0',borderRadius:2,overflow:'hidden' }}>
              <div style={{ height:'100%',width:Math.min(s.bar,100)+'%',background:`linear-gradient(90deg,${s.color}88,${s.color})`,borderRadius:2,transition:'width 1s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* EV Chargers */}
      {evs.length>0 && <>
        <SecHead title="EV Charging Sessions" />
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
      <SecHead title={`Devices (${devices.length})`} />
      <div style={card({ padding:16 })}>
        {devices.length===0 ? (
          <div style={{ textAlign:'center',padding:'16px 0' }}>
            <div style={{ fontSize:32,marginBottom:8 }}>📭</div>
            <div style={{ fontSize:13,color:C.text2,marginBottom:4 }}>No devices in this block yet</div>
            <div style={{ fontSize:11,color:C.text3 }}>Use the button below to register</div>
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

      <button onClick={onRegister} style={{ width:'100%',background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:16,padding:'15px',fontWeight:900,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
        ➕ Register Device to {b.name}
      </button>
    </div>
  )
}

// ── REGISTER SCREEN ──────────────────────────────────────────────────────────
function RegisterScreen({ blocks, activeBlock, onBack, apiOnline, onDeviceAdded }: { blocks:Block[]; activeBlock:Block|null; onBack:()=>void; apiOnline:boolean|null; onDeviceAdded:(d:Device)=>void }) {
  const [form, setForm] = useState({ sfdi:'', lfdi:'', deviceType:'Smart Meter', block:activeBlock?.id||blocks[0]?.id||'BLK-A', realPower:'', voltage:'', temperature:'', solarIrradiance:'', batterySoc:'', gridImport:'' })
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.sfdi||!form.lfdi) { setMsg('⚠️ Device ID and Long Form ID required'); return }
    setLoading(true)
    try {
      const r = await fetch(API+'/edev',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      if (r.ok) {
        onDeviceAdded({ sfdi:form.sfdi, type:form.deviceType, block:form.block, status:'Online' })
        setMsg('✅ Device registered successfully!')
        setForm(p=>({...p,sfdi:'',lfdi:''}))
      } else setMsg('❌ Registration failed — '+r.status)
    } catch {
      onDeviceAdded({ sfdi:form.sfdi, type:form.deviceType, block:form.block, status:'Online' })
      setMsg('📴 API offline — saved locally')
    }
    setLoading(false)
    setTimeout(()=>setMsg(''),4000)
  }

  const selBlock = blocks.find(b=>b.id===form.block)

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={card()}>
        <button onClick={onBack} style={{ background:'#f4f6f8',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:C.text2,cursor:'pointer',marginBottom:14 }}>← Back</button>
        <div style={{ fontWeight:900,fontSize:18,color:C.text,marginBottom:4 }}>Register New Device</div>
        <div style={{ fontSize:12,color:C.text2 }}>IEEE 2030.5 End Device Registration</div>
      </div>

      {/* Block selector */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:12 }}>Select Block</div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
          {blocks.map(b=>(
            <button key={b.id} onClick={()=>setForm(p=>({...p,block:b.id}))}
              style={{ padding:'10px',borderRadius:12,border:`2px solid ${form.block===b.id?b.color:C.border}`,background:form.block===b.id?b.color+'12':'#fafafa',cursor:'pointer',textAlign:'left' as const,transition:'all 0.15s' }}>
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
        {selBlock&&<div style={{ marginTop:10,padding:'8px 12px',background:selBlock.color+'12',borderRadius:10,fontSize:12,color:selBlock.color,fontWeight:700 }}>{selBlock.emoji} Registering to {selBlock.name} — {selBlock.location}</div>}
      </div>

      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:14,color:C.text,marginBottom:14 }}>Device Identity</div>
        <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
          {[{l:'Device ID (SFDI) *',k:'sfdi',ph:'e.g. SM_BlockA_001'},{l:'Long Form ID (LFDI) *',k:'lfdi',ph:'e.g. LFDI-SM-001'}].map(f=>(
            <div key={f.k}>
              <label style={lbl}>{f.l}</label>
              <input style={inp()} placeholder={f.ph} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
            </div>
          ))}
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
          {[{l:'Real Power (W)',k:'realPower',ph:'1400'},{l:'Voltage (V)',k:'voltage',ph:'230'},{l:'Temperature (°C)',k:'temperature',ph:'18.5'},{l:'Solar Irradiance',k:'solarIrradiance',ph:'650'},{l:'Battery SOC (%)',k:'batterySoc',ph:'75'},{l:'Grid Import (kW)',k:'gridImport',ph:'1.2'}].map(f=>(
            <div key={f.k}>
              <label style={lbl}>{f.l}</label>
              <input style={inp()} placeholder={f.ph} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                onFocus={e=>(e.target.style.borderColor=C.cyan)} onBlur={e=>(e.target.style.borderColor=C.border)} />
            </div>
          ))}
        </div>
      </div>

      <button onClick={submit} disabled={loading} style={{ width:'100%',background:loading?C.text3:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:16,padding:'15px',fontWeight:900,fontSize:16,cursor:loading?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
        {loading?<><div style={{ width:16,height:16,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite' }} />Registering...</>:'⊕ Register Device'}
      </button>
      {msg&&<div style={{ padding:'12px 16px',borderRadius:12,background:msg.startsWith('✅')?'#e8f5e9':msg.startsWith('❌')?'#fce4ec':'#fff8e1',fontSize:13,fontWeight:700,color:msg.startsWith('✅')?C.green:msg.startsWith('❌')?C.red:C.amber }}>{msg}</div>}
    </div>
  )
}

// ── SETTINGS SCREEN ──────────────────────────────────────────────────────────
function SettingsScreen({ apiOnline, apiMsg, onRefresh, onShowQR }: { apiOnline:boolean|null; apiMsg:string; onRefresh:()=>void; onShowQR:()=>void }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
      <div style={{ background:`linear-gradient(135deg,${C.navy},${C.cyan})`,borderRadius:20,padding:24,color:'#fff' }}>
        <div style={{ width:56,height:56,borderRadius:18,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:12 }}>👨‍💻</div>
        <div style={{ fontWeight:900,fontSize:20 }}>Ronit</div>
        <div style={{ fontSize:12,color:'rgba(255,255,255,0.7)',marginTop:2 }}>Virtual Communication Gateway</div>
        <div style={{ display:'flex',gap:8,marginTop:14 }}>
          {[{l:'Student',v:'MI6228'},{l:'Group',v:'13'},{l:'Mentor',v:'Paolo C.'}].map(x=>(
            <div key={x.l} style={{ background:'rgba(255,255,255,0.15)',borderRadius:10,padding:'6px 12px' }}>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.6)',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:1 }}>{x.l}</div>
              <div style={{ fontSize:13,fontWeight:800 }}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Card */}
      <div style={card()}>
        <div style={{ fontWeight:800,fontSize:15,color:C.text,marginBottom:14 }}>Share App</div>
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(APP_URL)}&color=002970&bgcolor=ffffff&qzone=1`} width={80} height={80} alt="QR" style={{ borderRadius:10,border:`2px solid ${C.cyan}` }} />
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:C.cyan,marginBottom:4 }}>vcg-webapp.vercel.app</div>
            <div style={{ fontSize:12,color:C.text2,marginBottom:10 }}>Scan to open on any device</div>
            <button onClick={onShowQR} style={{ background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:10,padding:'8px 16px',fontWeight:700,fontSize:12,cursor:'pointer' }}>📲 Show Full QR</button>
          </div>
        </div>
      </div>

      {/* API */}
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
          {icon:'🚀',l:'Live API Docs',sub:'virtual-gateway.onrender.com/docs',href:API+'/docs'},
          {icon:'💻',l:'GitHub Repo',sub:'rt0181996/virtual-gateway',href:'https://github.com/rt0181996/virtual-gateway'},
          {icon:'📊',l:'Grafana Dashboard',sub:'localhost:3000',href:'http://localhost:3000'},
          {icon:'🌐',l:'IDS Dataspace',sub:'localhost:8181',href:'http://localhost:8181'},
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

      <div style={{ textAlign:'center',padding:8,fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:C.text3,letterSpacing:1.5 }}>VCG v1.0 · IEEE 2030.5 · FIWARE · IDS DATASPACE</div>
    </div>
  )
}

function SecHead({ title }: { title: string }) {
  return <div style={{ fontWeight:800,fontSize:14,color:C.text,paddingLeft:4 }}>{title}</div>
}

// ── IMPORT SCREEN ────────────────────────────────────────────────────────────
function ImportScreen({ blocks, onBack, onBlocksImported, onDevicesImported }: {
  blocks: Block[]
  onBack: () => void
  onBlocksImported: (b: Block[]) => void
  onDevicesImported: (d: Device[]) => void
}) {
  const [tab, setTab] = useState<'communities'|'devices'>('communities')
  const [preview, setPreview] = useState<any[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  const BLOCK_COLORS = ['#00b8a4','#2979ff','#ff6d00','#9c27b0','#e91e63','#00897b','#f57c00','#1565c0']
  const BLOCK_EMOJIS = ['🏙️','🏘️','🌆','🌉','🏚️','🌃','🏗️','🌇']

  const readExcel = (file: File) => {
    setError(''); setSuccess(''); setPreview([]); setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // Use SheetJS via dynamic import
        import('xlsx').then(XLSX => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const wb = XLSX.read(data, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rows: any[] = XLSX.utils.sheet_to_json(ws)
          if (rows.length === 0) { setError('No data found in the Excel file'); return }
          setPreview(rows.slice(0, 10)) // show first 10 rows
        })
      } catch (err) { setError('Could not read Excel file — make sure it is a valid .xlsx file') }
    }
    reader.readAsArrayBuffer(file)
  }

  const importData = async () => {
    if (preview.length === 0) { setError('No data to import'); return }
    setImporting(true)

    if (tab === 'communities') {
      const newBlocks: Block[] = preview.map((row: any, i: number) => {
        const gen = parseFloat(row['Generation (kW)'] || row['generation'] || row['Generation'] || 100)
        const con = parseFloat(row['Consumption (kW)'] || row['consumption'] || row['Consumption'] || 80)
        const net = +(gen - con).toFixed(1)
        const idx = blocks.length + i
        return {
          id: row['Block ID'] || row['id'] || `BLK-${String.fromCharCode(65+idx)}`,
          name: row['Block Name'] || row['name'] || `Block ${String.fromCharCode(65+idx)}`,
          location: row['Location'] || row['location'] || 'Ireland',
          emoji: BLOCK_EMOJIS[idx % BLOCK_EMOJIS.length],
          generation: gen, consumption: con, net,
          status: net > 0.5 ? 'Surplus' : net < -0.5 ? 'Deficit' : 'Balanced',
          devices: parseInt(row['Devices'] || '0'),
          color: row['Color'] || BLOCK_COLORS[idx % BLOCK_COLORS.length],
        }
      })
      onBlocksImported(newBlocks)
      setSuccess(`✅ Successfully imported ${newBlocks.length} community block${newBlocks.length>1?'s':''}!`)
    } else {
      const newDevices: Device[] = preview.map((row: any) => ({
        sfdi: row['Device ID (SFDI)'] || row['sfdi'] || row['Device ID'] || 'DEV-'+Math.random().toString(36).slice(2,6).toUpperCase(),
        type: row['Device Type'] || row['type'] || 'Smart Meter',
        block: row['Block ID'] || row['block'] || blocks[0]?.id || 'BLK-A',
        status: row['Status'] || 'Online',
      }))
      onDevicesImported(newDevices)
      setSuccess(`✅ Successfully imported ${newDevices.length} device${newDevices.length>1?'s':''}!`)
    }
    setImporting(false)
    setTimeout(() => { onBack() }, 1500)
  }

  const downloadTemplate = () => {
    import('xlsx').then(XLSX => {
      let ws: any, wb: any
      if (tab === 'communities') {
        const data = [
          { 'Block ID':'BLK-E', 'Block Name':'Block E', 'Location':'Waterford', 'Generation (kW)':120, 'Consumption (kW)':95, 'Devices':8, 'Color':'' },
          { 'Block ID':'BLK-F', 'Block Name':'Block F', 'Location':'Belfast',   'Generation (kW)':88,  'Consumption (kW)':110,'Devices':6, 'Color':'' },
        ]
        ws = XLSX.utils.json_to_sheet(data)
        wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Communities')
        XLSX.writeFile(wb, 'vcg_communities_template.xlsx')
      } else {
        const data = [
          { 'Device ID (SFDI)':'SM-E001', 'Long Form ID (LFDI)':'LFDI-SM-E001', 'Device Type':'Smart Meter',    'Block ID':'BLK-A', 'Real Power (W)':1400, 'Voltage (V)':230, 'Status':'Online' },
          { 'Device ID (SFDI)':'PV-E002', 'Long Form ID (LFDI)':'LFDI-PV-E002', 'Device Type':'Solar Inverter', 'Block ID':'BLK-B', 'Real Power (W)':3500, 'Voltage (V)':230, 'Status':'Online' },
          { 'Device ID (SFDI)':'EV-E003', 'Long Form ID (LFDI)':'LFDI-EV-E003', 'Device Type':'EV Charger',     'Block ID':'BLK-A', 'Real Power (W)':7400, 'Voltage (V)':230, 'Status':'Online' },
        ]
        ws = XLSX.utils.json_to_sheet(data)
        wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Devices')
        XLSX.writeFile(wb, 'vcg_devices_template.xlsx')
      }
    })
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex:1, padding:'10px', border:'none', borderRadius:12, fontWeight:800, fontSize:13, cursor:'pointer',
    background: active ? `linear-gradient(135deg,${C.navy},${C.cyan})` : '#f4f6f8',
    color: active ? '#fff' : C.text2, transition:'all 0.2s'
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Header */}
      <div style={card()}>
        <button onClick={onBack} style={{ background:'#f4f6f8',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:C.text2,cursor:'pointer',marginBottom:14 }}>← Back</button>
        <div style={{ fontWeight:900, fontSize:18, color:C.text, marginBottom:4 }}>📊 Import from Excel</div>
        <div style={{ fontSize:12, color:C.text2 }}>Upload .xlsx file to bulk-add communities or devices</div>
      </div>

      {/* Tab selector */}
      <div style={{ display:'flex', gap:8, background:C.card, borderRadius:16, padding:8, boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
        <button style={tabStyle(tab==='communities')} onClick={()=>{ setTab('communities'); setPreview([]); setFileName(''); setError(''); setSuccess('') }}>🏘️ Communities</button>
        <button style={tabStyle(tab==='devices')} onClick={()=>{ setTab('devices'); setPreview([]); setFileName(''); setError(''); setSuccess('') }}>📟 Devices</button>
      </div>

      {/* Template download */}
      <div style={card({ background:'#f0fdf4', border:`1px solid ${C.cyan}` })}>
        <div style={{ fontWeight:800, fontSize:13, color:C.cyan, marginBottom:6 }}>📥 Step 1 — Download Template</div>
        <div style={{ fontSize:12, color:C.text2, marginBottom:12 }}>
          {tab==='communities'
            ? 'Template has: Block ID, Block Name, Location, Generation (kW), Consumption (kW), Devices'
            : 'Template has: Device ID (SFDI), Long Form ID (LFDI), Device Type, Block ID, Real Power, Voltage'}
        </div>
        <button onClick={downloadTemplate} style={{ background:`linear-gradient(135deg,${C.navy},${C.cyan})`,color:'#fff',border:'none',borderRadius:12,padding:'11px 20px',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}>
          ⬇️ Download {tab==='communities'?'Communities':'Devices'} Template
        </button>
      </div>

      {/* File upload */}
      <div style={card()}>
        <div style={{ fontWeight:800, fontSize:13, color:C.text, marginBottom:12 }}>📤 Step 2 — Upload Your Excel File</div>
        <label style={{ display:'block', border:`2px dashed ${fileName?C.cyan:C.border}`, borderRadius:16, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:fileName?C.cyanLight:'#fafafa', transition:'all 0.2s' }}>
          <input type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>{ if(e.target.files?.[0]) readExcel(e.target.files[0]) }} />
          <div style={{ fontSize:36, marginBottom:8 }}>{fileName?'📗':'📂'}</div>
          {fileName ? (
            <>
              <div style={{ fontWeight:800, fontSize:14, color:C.cyan }}>{fileName}</div>
              <div style={{ fontSize:11, color:C.text2, marginTop:4 }}>{preview.length} rows detected · tap to change</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight:700, fontSize:14, color:C.text }}>Tap to choose Excel file</div>
              <div style={{ fontSize:11, color:C.text3, marginTop:4 }}>Supports .xlsx · .xls · .csv</div>
            </>
          )}
        </label>
        {error && <div style={{ marginTop:10,padding:'10px 14px',background:'#fce4ec',borderRadius:10,fontSize:12,color:C.red,fontWeight:600 }}>⚠️ {error}</div>}
      </div>

      {/* Preview table */}
      {preview.length > 0 && (
        <div style={card()}>
          <div style={{ fontWeight:800, fontSize:13, color:C.text, marginBottom:12 }}>👁️ Step 3 — Preview ({preview.length} rows)</div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr style={{ background:C.cyanLight }}>
                  {Object.keys(preview[0]).map(k=>(
                    <th key={k} style={{ padding:'8px 10px', textAlign:'left', fontFamily:"'Share Tech Mono',monospace", fontSize:10, color:C.cyan, fontWeight:700, whiteSpace:'nowrap', borderBottom:`1px solid ${C.cyan}30` }}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row,i)=>(
                  <tr key={i} style={{ background:i%2===0?'#fafafa':'#fff' }}>
                    {Object.values(row).map((v:any,j)=>(
                      <td key={j} style={{ padding:'8px 10px', color:C.text, borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10,fontSize:11,color:C.text3 }}>Showing first {preview.length} rows · all will be imported</div>
        </div>
      )}

      {/* Import button */}
      {preview.length > 0 && (
        <button onClick={importData} disabled={importing} style={{ width:'100%', background:importing?C.text3:`linear-gradient(135deg,${C.navy},${C.cyan})`, color:'#fff', border:'none', borderRadius:16, padding:'15px', fontWeight:900, fontSize:16, cursor:importing?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {importing
            ? <><div style={{ width:16,height:16,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite' }} />Importing...</>
            : `📊 Import ${preview.length} ${tab==='communities'?'Communities':'Devices'}`}
        </button>
      )}

      {success && (
        <div style={{ padding:'14px 16px', borderRadius:14, background:'#e8f5e9', border:`1px solid ${C.green}`, fontSize:14, fontWeight:800, color:C.green, textAlign:'center' }}>{success}</div>
      )}

      {/* How to use */}
      <div style={card({ background:'#fffbeb', border:`1px solid ${C.amber}` })}>
        <div style={{ fontWeight:800,fontSize:13,color:C.amber,marginBottom:8 }}>💡 How to use</div>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          {[
            '1. Download the template above',
            '2. Fill it in Excel / Google Sheets',
            '3. Save as .xlsx and upload here',
            '4. Preview your data, then import',
            '5. New blocks/devices appear instantly',
          ].map(t=>(
            <div key={t} style={{ fontSize:12,color:C.text2,display:'flex',gap:8,alignItems:'flex-start' }}>
              <span style={{ color:C.amber,fontWeight:700,flexShrink:0 }}>→</span>{t}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
