'use client'
import { useState, useEffect, useCallback } from 'react'

const API = 'https://virtual-gateway.onrender.com'
const APP_URL = 'https://vcg-webapp.vercel.app'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Block { id:string;name:string;location:string;emoji:string;generation:number;consumption:number;net:number;status:'Surplus'|'Deficit'|'Balanced';devices:number;color:string;lat:number;lng:number }
interface Sensor { icon:string;label:string;value:number;unit:string;color:string;bar:number }
interface EV { id:string;block:string;status:'CHARGING'|'IDLE';power:number;sessionTime:number;soc:number }
interface Device { sfdi:string;lfdi?:string;type:string;block:string;status:string;power?:number;voltage?:number;lastSeen?:string }
interface Alert { id:string;block:string;type:string;message:string;severity:'high'|'medium'|'low';time:string;read:boolean }
interface HistoryEntry { time:string;block:string;generation:number;consumption:number;net:number;cost:number }
type Screen = 'home'|'block'|'charts'|'alerts'|'demand'|'history'|'cost'|'devices'|'map'|'compare'|'register'|'import'|'settings'
type ChartType = 'bar'|'line'|'area'|'donut'|'radar'

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeSensors=(t=20,sol=600,bat=50,gi=1,ge=1,ws=25,ec=0.38,co2=2):Sensor[]=>[
  {icon:'🌡️',label:'Temperature',     value:t,   unit:'°C',   color:'#f97316',bar:Math.min(Math.round(t/40*100),100)},
  {icon:'☀️',label:'Solar Irradiance', value:sol, unit:'W/m²', color:'#ffd60a',bar:Math.min(Math.round(sol/1000*100),100)},
  {icon:'🔋',label:'Battery SOC',      value:bat, unit:'%',    color:'#10b981',bar:bat},
  {icon:'🔌',label:'Grid Import',      value:gi,  unit:'kW',   color:'#e63946',bar:Math.min(Math.round(gi/5*100),100)},
  {icon:'📤',label:'Grid Export',      value:ge,  unit:'kW',   color:'#58c4dc',bar:Math.min(Math.round(ge/5*100),100)},
  {icon:'💨',label:'Wind Speed',       value:ws,  unit:'km/h', color:'#3b82f6',bar:Math.min(Math.round(ws/60*100),100)},
  {icon:'€', label:'Energy Cost',      value:ec,  unit:'/kWh', color:'#ffd60a',bar:Math.min(Math.round(ec/0.6*100),100)},
  {icon:'🌿',label:'CO₂ Saved',        value:co2, unit:'kg',   color:'#10b981',bar:Math.min(Math.round(co2/8*100),100)},
]
const makeHistory=(blockId:string,count=12):HistoryEntry[]=>{
  const now=new Date()
  return Array.from({length:count},(_,i)=>{
    const gen=+(100+Math.random()*100).toFixed(1)
    const con=+(70+Math.random()*90).toFixed(1)
    const d=new Date(now); d.setHours(d.getHours()-count+i)
    return {time:d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),block:blockId,generation:gen,consumption:con,net:+(gen-con).toFixed(1),cost:+(con*0.38/1000*3600).toFixed(3)}
  })
}

// ── Data ──────────────────────────────────────────────────────────────────────
const INIT_BLOCKS:Block[]=[
  {id:'BLK-A',name:'Block A',location:'Dublin',  emoji:'🏙️',generation:145.8,consumption:98.2, net:47.6, status:'Surplus', devices:12,color:'#e63946',lat:53.3498,lng:-6.2603},
  {id:'BLK-B',name:'Block B',location:'Kerry',   emoji:'🏘️',generation:82.3, consumption:110.7,net:-28.4,status:'Deficit', devices:8, color:'#ffd60a',lat:52.1545,lng:-9.5669},
  {id:'BLK-C',name:'Block C',location:'Galway',  emoji:'🌆',generation:200.1,consumption:195.4,net:4.7,  status:'Surplus', devices:15,color:'#58c4dc',lat:53.2707,lng:-9.0568},
  {id:'BLK-D',name:'Block D',location:'Limerick',emoji:'🌉',generation:134.5,consumption:89.0, net:45.5, status:'Surplus', devices:10,color:'#10b981',lat:52.6638,lng:-8.6267},
]
const INIT_SENSORS:Record<string,Sensor[]>={
  'BLK-A':makeSensors(20.3,693,43,0.57,1.85,29,0.386,2.2),
  'BLK-B':makeSensors(18.1,510,22,3.2,0.4,41,0.42,0.8),
  'BLK-C':makeSensors(22.7,820,78,0.12,4.6,17,0.31,5.1),
  'BLK-D':makeSensors(19.5,640,61,0.88,2.3,23,0.355,3.4),
}
const INIT_EVS:EV[]=[
  {id:'EVCharger001',block:'BLK-A',status:'CHARGING',power:7.4,sessionTime:42,soc:68},
  {id:'EVCharger002',block:'BLK-B',status:'IDLE',    power:0,  sessionTime:0, soc:95},
  {id:'EVCharger003',block:'BLK-C',status:'CHARGING',power:11.0,sessionTime:18,soc:34},
  {id:'EVCharger004',block:'BLK-D',status:'IDLE',    power:0,  sessionTime:0, soc:82},
]
const INIT_DEVICES:Device[]=[
  {sfdi:'SM-A001',lfdi:'LFDI-SM-A001',type:'Smart Meter',    block:'BLK-A',status:'Online', power:1400,voltage:230,lastSeen:'Just now'},
  {sfdi:'PV-A002',lfdi:'LFDI-PV-A002',type:'Solar Inverter', block:'BLK-A',status:'Online', power:3500,voltage:230,lastSeen:'1 min ago'},
  {sfdi:'EV-A003',lfdi:'LFDI-EV-A003',type:'EV Charger',     block:'BLK-A',status:'Online', power:7400,voltage:230,lastSeen:'Just now'},
  {sfdi:'SM-B001',lfdi:'LFDI-SM-B001',type:'Smart Meter',    block:'BLK-B',status:'Online', power:1200,voltage:230,lastSeen:'2 min ago'},
  {sfdi:'BA-B002',lfdi:'LFDI-BA-B002',type:'Battery Storage', block:'BLK-B',status:'Warning',power:5000,voltage:48, lastSeen:'5 min ago'},
  {sfdi:'SM-C001',lfdi:'LFDI-SM-C001',type:'Smart Meter',    block:'BLK-C',status:'Online', power:1400,voltage:230,lastSeen:'Just now'},
  {sfdi:'WT-C002',lfdi:'LFDI-WT-C002',type:'Wind Turbine',   block:'BLK-C',status:'Online', power:8000,voltage:400,lastSeen:'30s ago'},
  {sfdi:'SM-D001',lfdi:'LFDI-SM-D001',type:'Smart Meter',    block:'BLK-D',status:'Online', power:1400,voltage:230,lastSeen:'3 min ago'},
]

// ── Iron Man Style Tokens ─────────────────────────────────────────────────────
const IM = {
  red:'#e63946', redDark:'#c1121f', redLight:'#ffd6d8',
  gold:'#ffd60a', goldDark:'#e5b800', goldLight:'#fff5cc',
  arc:'#58c4dc',  arcLight:'#e0f7ff',
  navy:'#0d1117', navy2:'#161b22', navy3:'#21262d',
  bg:'#f4f5fa', card:'#ffffff',
  text:'#0d1117', text2:'#4a5568', text3:'#9aa5b4',
  border:'#e2e6f0', green:'#10b981', greenL:'#d1fae5',
  amber:'#f59e0b', amberL:'#fef3c7',
}
const card=(x?:React.CSSProperties):React.CSSProperties=>({background:IM.card,borderRadius:20,padding:20,boxShadow:'0 4px 16px rgba(0,0,0,0.07)',border:`1px solid ${IM.border}`,...x})
const ironBtn=(x?:React.CSSProperties):React.CSSProperties=>({background:`linear-gradient(135deg,${IM.redDark},${IM.red})`,color:'#fff',border:'none',borderRadius:14,padding:'13px',fontWeight:800,fontSize:14,cursor:'pointer',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:`0 4px 16px ${IM.red}40`,...x})
const goldBtn=(x?:React.CSSProperties):React.CSSProperties=>({background:`linear-gradient(135deg,${IM.goldDark},${IM.gold})`,color:IM.navy,border:'none',borderRadius:14,padding:'13px',fontWeight:800,fontSize:14,cursor:'pointer',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:`0 4px 16px ${IM.gold}40`,...x})
const pill=(color:string):React.CSSProperties=>({fontFamily:"'Share Tech Mono',monospace",fontSize:10,letterSpacing:1.5,padding:'3px 10px',borderRadius:20,textTransform:'uppercase' as const,background:color+'20',border:`1px solid ${color}60`,color})
const lbl:React.CSSProperties={fontSize:12,fontWeight:700,color:IM.text2,display:'block',marginBottom:6}
const inp=(x?:React.CSSProperties):React.CSSProperties=>({width:'100%',padding:'11px 14px',border:`1.5px solid ${IM.border}`,borderRadius:12,fontSize:14,fontFamily:'Plus Jakarta Sans,sans-serif',color:IM.text,background:'#fafbff',outline:'none',...x})

// ── CHART COMPONENTS ──────────────────────────────────────────────────────────

// Bar Chart with data labels
function BarChart({data,colors,height=140}:{data:{label:string;values:number[];colors?:string[]}[];colors:string[];height?:number}) {
  const allVals=data.flatMap(d=>d.values)
  const maxV=Math.max(...allVals,1)
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{display:'flex',gap:6,alignItems:'flex-end',height,minWidth:data.length*52,padding:'20px 4px 0'}}>
        {data.map((d,i)=>(
          <div key={i} style={{flex:1,display:'flex',gap:2,alignItems:'flex-end',flexDirection:'column',minWidth:44}}>
            <div style={{display:'flex',gap:2,alignItems:'flex-end',width:'100%',height:height-24}}>
              {d.values.map((v,j)=>{
                const h=Math.max((v/maxV)*(height-24),4)
                return (
                  <div key={j} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:height-24}}>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:colors[j]||IM.red,fontWeight:700,marginBottom:2,whiteSpace:'nowrap'}}>{v}</div>
                    <div style={{width:'100%',height,background:`linear-gradient(180deg,${colors[j]||IM.red},${colors[j]||IM.red}80)`,borderRadius:'4px 4px 0 0',transition:'height 0.8s ease',animation:'barGrow 0.8s ease forwards'}} />
                  </div>
                )
              })}
            </div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:IM.text3,textAlign:'center',width:'100%',marginTop:4}}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Line Chart with data labels
function LineChart({data,color='#e63946',height=120,label=''}:{data:number[];color?:string;height?:number;label?:string}) {
  if(data.length<2) return null
  const maxV=Math.max(...data,1), minV=Math.min(...data,0)
  const range=maxV-minV||1
  const W=320, H=height
  const pts=data.map((v,i)=>({x:(i/(data.length-1))*W, y:H-((v-minV)/range)*(H-24)-4}))
  const pathD=pts.map((p,i)=>i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`).join(' ')
  const areaD=`${pathD} L${W},${H} L0,${H} Z`
  return (
    <div style={{overflowX:'auto'}}>
      <svg width="100%" viewBox={`0 0 ${W} ${H+10}`} style={{display:'block',minWidth:280}}>
        <defs>
          <linearGradient id={`lg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25,0.5,0.75].map(f=>(
          <line key={f} x1={0} y1={H*f} x2={W} y2={H*f} stroke={IM.border} strokeWidth="0.5" strokeDasharray="4,4"/>
        ))}
        {/* Area fill */}
        <path d={areaD} fill={`url(#lg-${color.replace('#','')})`}/>
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Data points + labels */}
        {pts.map((p,i)=>(
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} stroke="#fff" strokeWidth="1.5"/>
            {(i%Math.ceil(data.length/6)===0||i===data.length-1)&&(
              <text x={p.x} y={p.y-8} textAnchor="middle" fontSize="8" fill={color} fontFamily="Share Tech Mono,monospace" fontWeight="700">{data[i]}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

// Donut Chart with labels
function DonutChart({segments,size=160}:{segments:{label:string;value:number;color:string}[];size?:number}) {
  const total=segments.reduce((s,x)=>s+x.value,0)||1
  const cx=size/2, cy=size/2, r=size*0.35, inner=size*0.22
  let angle=-Math.PI/2
  const arcs=segments.map(s=>{
    const sweep=(s.value/total)*2*Math.PI
    const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle)
    angle+=sweep
    const x2=cx+r*Math.cos(angle), y2=cy+r*Math.sin(angle)
    const large=sweep>Math.PI?1:0
    const midAngle=angle-sweep/2
    const lx=cx+(r+18)*Math.cos(midAngle), ly=cy+(r+18)*Math.sin(midAngle)
    const ix=cx+inner*Math.cos(angle-sweep/2), iy=cy+inner*Math.sin(angle-sweep/2)
    return {x1,y1,x2,y2,large,color:s.color,label:s.label,value:s.value,pct:Math.round(s.value/total*100),lx,ly,ix,iy,midAngle}
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',margin:'0 auto',overflow:'visible'}}>
      {arcs.map((a,i)=>(
        <g key={i}>
          <path d={`M${cx+inner*Math.cos(angle-((segments[i].value/total)*2*Math.PI))} ${cy+inner*Math.sin(angle-((segments[i].value/total)*2*Math.PI))} L${a.x1} ${a.y1} A${r} ${r} 0 ${a.large} 1 ${a.x2} ${a.y2} L${cx+inner*Math.cos(angle)} ${cy+inner*Math.sin(angle)} A${inner} ${inner} 0 ${a.large} 0 ${cx+inner*Math.cos(angle-((segments[i].value/total)*2*Math.PI))} ${cy+inner*Math.sin(angle-((segments[i].value/total)*2*Math.PI))} Z`}
            fill={a.color} stroke="#fff" strokeWidth="2"/>
          {a.pct>5&&<text x={a.lx} y={a.ly} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill={a.color} fontWeight="700" fontFamily="Share Tech Mono,monospace">{a.pct}%</text>}
        </g>
      ))}
      <circle cx={cx} cy={cy} r={inner} fill="#fff"/>
      <text x={cx} y={cy-6} textAnchor="middle" fontSize="11" fill={IM.text} fontWeight="700" fontFamily="Orbitron,monospace">{total.toFixed(0)}</text>
      <text x={cx} y={cy+8} textAnchor="middle" fontSize="8" fill={IM.text3} fontFamily="Share Tech Mono,monospace">kW Total</text>
    </svg>
  )
}

// Horizontal Bar Chart
function HBarChart({data}:{data:{label:string;value:number;max:number;color:string}[]}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {data.map((d,i)=>(
        <div key={i}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:12,color:IM.text2,fontWeight:600}}>{d.label}</span>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:d.color,fontWeight:700}}>{d.value} kW</span>
          </div>
          <div style={{height:10,background:'#f0f4ff',borderRadius:5,overflow:'visible',position:'relative'}}>
            <div style={{height:'100%',width:`${Math.min((d.value/d.max)*100,100)}%`,background:`linear-gradient(90deg,${d.color}80,${d.color})`,borderRadius:5,transition:'width 1s ease',position:'relative'}}>
              <div style={{position:'absolute',right:-2,top:'50%',transform:'translateY(-50%)',width:14,height:14,borderRadius:'50%',background:d.color,border:'2px solid #fff',boxShadow:`0 0 6px ${d.color}`}} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
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
  const [history,setHistory]=useState<Record<string,HistoryEntry[]>>({'BLK-A':makeHistory('BLK-A'),'BLK-B':makeHistory('BLK-B'),'BLK-C':makeHistory('BLK-C'),'BLK-D':makeHistory('BLK-D')})
  const [showQR,setShowQR]=useState(false)
  const [copied,setCopied]=useState(false)

  useEffect(()=>{
    const iv=setInterval(()=>{
      setBlocks(p=>p.map(b=>{const gen=+(b.generation+(Math.random()-0.5)*2).toFixed(1);const con=+(b.consumption+(Math.random()-0.5)*1.5).toFixed(1);const net=+(gen-con).toFixed(1);return{...b,generation:gen,consumption:con,net,status:net>0.5?'Surplus':net<-0.5?'Deficit':'Balanced'}}))
      setSensors(p=>{const n={...p};Object.keys(n).forEach(k=>{n[k]=n[k].map((s,i)=>{const d=[0.3,8,1.5,0.04,0.08,0.8,0.004,0.08][i]||0.1;return{...s,value:+(s.value+(Math.random()-0.5)*d).toFixed(s.value<10?2:1)}})});return n})
      setHistory(p=>{const n={...p};INIT_BLOCKS.forEach(b=>{const gen=+(100+Math.random()*100).toFixed(1);const con=+(70+Math.random()*90).toFixed(1);const entry:HistoryEntry={time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),block:b.id,generation:gen,consumption:con,net:+(gen-con).toFixed(1),cost:+(con*0.38/1000*3600).toFixed(3)};n[b.id]=[...(n[b.id]||[]).slice(-20),entry]});return n})
    },3000)
    return ()=>clearInterval(iv)
  },[])

  useEffect(()=>{
    const a:Alert[]=[]
    blocks.forEach(b=>{
      if(b.status==='Deficit') a.push({id:`${b.id}-d`,block:b.id,type:'deficit',message:`${b.name} is in deficit — ${Math.abs(b.net).toFixed(1)} kW shortfall`,severity:'high',time:'Now',read:false})
      const bat=sensors[b.id]?.find(s=>s.label==='Battery SOC')
      if(bat&&bat.value<25) a.push({id:`${b.id}-b`,block:b.id,type:'battery',message:`Battery in ${b.name} critically low: ${bat.value}%`,severity:'high',time:'Now',read:false})
    })
    setAlerts(a)
  },[blocks,sensors])

  const checkApi=useCallback(async()=>{
    setApiOnline(null)
    try{const r=await fetch(API);const d=await r.json();setApiOnline(true);setApiMsg(d.message||'Connected')}
    catch{setApiOnline(false);setApiMsg('API offline')}
  },[])
  useEffect(()=>{checkApi()},[])

  const addBlock=(b:Block)=>{setBlocks(p=>[...p,b]);setSensors(p=>({...p,[b.id]:makeSensors()}));setEvs(p=>[...p,{id:`EVC-${b.id}`,block:b.id,status:'IDLE',power:0,sessionTime:0,soc:100}]);setHistory(p=>({...p,[b.id]:makeHistory(b.id)}))}
  const addDevice=(d:Device)=>setDevices(p=>[...p,d])
  const goHome=()=>{setScreen('home');setActiveBlock(null);setActiveDevice(null)}
  const openBlock=(b:Block)=>{setActiveBlock(b);setScreen('block')}

  const totalGen=blocks.reduce((s,b)=>s+b.generation,0)
  const totalCon=blocks.reduce((s,b)=>s+b.consumption,0)
  const totalNet=+(totalGen-totalCon).toFixed(1)
  const unread=alerts.filter(a=>!a.read).length
  const statusColor=apiOnline===null?IM.amber:apiOnline?IM.green:IM.red

  const NAV=[
    {id:'home',    icon:'🏠',label:'Home'},
    {id:'charts',  icon:'📈',label:'Charts'},
    {id:'alerts',  icon:'⚠️',label:'Alerts',badge:unread},
    {id:'demand',  icon:'⚡',label:'Demand'},
    {id:'settings',icon:'⚙️',label:'More'},
  ]

  return (
    <div style={{maxWidth:430,margin:'0 auto',minHeight:'100vh',fontFamily:'Plus Jakarta Sans,sans-serif',position:'relative'}}>

      {/* IRON MAN HEADER */}
      <div style={{position:'relative',zIndex:2,padding:'16px 20px 72px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {/* Arc Reactor icon */}
            <div className="arc-pulse" style={{width:42,height:42,borderRadius:14,background:'radial-gradient(circle,#58c4dc,#0d4f6e)',border:'2px solid #58c4dc',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>⚡</div>
            <div>
              <div className="orb" style={{fontSize:15,fontWeight:900,color:'#fff',letterSpacing:1}}>VCG Portal</div>
              <div className="mono" style={{fontSize:9,color:IM.gold,letterSpacing:2}}>MI6228 · GROUP 13</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{display:'flex',alignItems:'center',gap:5,background:'rgba(255,255,255,0.1)',borderRadius:20,padding:'5px 12px',border:'1px solid rgba(255,255,255,0.15)'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:statusColor}} className={apiOnline?'pulse-dot':''} />
              <span className="mono" style={{fontSize:10,color:'#fff',fontWeight:700}}>{apiOnline===null?'Checking':apiOnline?'Live':'Offline'}</span>
            </div>
            <button onClick={()=>setShowQR(true)} style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,padding:'8px 10px',color:'#fff',fontSize:16,cursor:'pointer'}}>📲</button>
          </div>
        </div>

        {/* Iron Man stats strip */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginTop:18}}>
          {[
            {l:'Generation',v:totalGen.toFixed(1),u:'kW',c:IM.gold},
            {l:'Consumption',v:totalCon.toFixed(1),u:'kW',c:'#ff6b6b'},
            {l:'Net Balance',v:(totalNet>=0?'+':'')+totalNet,u:'kW',c:totalNet>=0?IM.gold:IM.red},
          ].map(s=>(
            <div key={s.l} style={{background:'rgba(255,255,255,0.08)',borderRadius:14,padding:'12px 8px',textAlign:'center',backdropFilter:'blur(8px)',border:'1px solid rgba(255,214,10,0.15)'}}>
              <div className="orb" style={{fontSize:18,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.5)',fontWeight:700,marginTop:3,textTransform:'uppercase',letterSpacing:0.8}}>{s.u} · {s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{position:'relative',zIndex:1,marginTop:-44,padding:'0 16px 120px'}}>
        {screen==='home'    && <HomeScreen     blocks={blocks} onBlockClick={openBlock} apiOnline={apiOnline} apiMsg={apiMsg} alerts={alerts} onAddCommunity={()=>setScreen('import')} onNavigate={setScreen} />}
        {screen==='block'   && activeBlock && <BlockDetailScreen block={activeBlock} blocks={blocks} sensors={sensors[activeBlock.id]||[]} evs={evs.filter(e=>e.block===activeBlock.id)} devices={devices.filter(d=>d.block===activeBlock.id)} history={history[activeBlock.id]||[]} onBack={goHome} onRegister={()=>setScreen('register')} onDeviceClick={(d)=>{setActiveDevice(d);setScreen('devices')}} />}
        {screen==='charts'  && <ChartsScreen   blocks={blocks} history={history} sensors={sensors} />}
        {screen==='alerts'  && <AlertsScreen   alerts={alerts} onMarkRead={(id)=>setAlerts(p=>p.map(a=>a.id===id?{...a,read:true}:a))} onMarkAll={()=>setAlerts(p=>p.map(a=>({...a,read:true})))} />}
        {screen==='demand'  && <DemandScreen   blocks={blocks} apiOnline={apiOnline} />}
        {screen==='history' && <HistoryScreen  history={history} blocks={blocks} />}
        {screen==='cost'    && <CostScreen     blocks={blocks} sensors={sensors} />}
        {screen==='devices' && <DevicesScreen  devices={devices} blocks={blocks} activeDevice={activeDevice} onDelete={(s)=>setDevices(p=>p.filter(d=>d.sfdi!==s))} />}
        {screen==='map'     && <MapScreen      blocks={blocks} />}
        {screen==='compare' && <CompareScreen  blocks={blocks} sensors={sensors} />}
        {screen==='register'&& <RegisterScreen blocks={blocks} activeBlock={activeBlock} onBack={()=>setScreen(activeBlock?'block':'home')} apiOnline={apiOnline} onDeviceAdded={addDevice} />}
        {screen==='import'  && <ImportScreen   blocks={blocks} onBack={goHome} onBlocksImported={(bs)=>{bs.forEach(b=>addBlock(b));goHome()}} onDevicesImported={(ds)=>{ds.forEach(d=>addDevice(d))}} />}
        {screen==='settings'&& <SettingsScreen apiOnline={apiOnline} apiMsg={apiMsg} onRefresh={checkApi} onShowQR={()=>setShowQR(true)} onNavigate={setScreen} />}
      </div>

      {/* SINGLE ROW IRON MAN NAV */}
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'rgba(255,255,255,0.97)',borderTop:`2px solid ${IM.red}30`,zIndex:50,boxShadow:'0 -4px 24px rgba(230,57,70,0.12)',backdropFilter:'blur(16px)',padding:'8px 0 18px'}}>
        <div style={{display:'flex',justifyContent:'space-around'}}>
          {NAV.map(t=>(
            <button key={t.id} onClick={()=>{setActiveBlock(null);setScreen(t.id as Screen)}} style={{background:'none',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'0 8px',position:'relative'}}>
              <div style={{width:42,height:42,borderRadius:14,background:screen===t.id?`linear-gradient(135deg,${IM.redDark},${IM.red})`:'transparent',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,transition:'all 0.2s',boxShadow:screen===t.id?`0 4px 12px ${IM.red}50`:undefined}}>
                {t.icon}
              </div>
              {(t as any).badge>0&&<div style={{position:'absolute',top:0,right:6,width:16,height:16,borderRadius:'50%',background:IM.red,color:'#fff',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #fff'}}>{(t as any).badge}</div>}
              <span style={{fontSize:10,fontWeight:700,color:screen===t.id?IM.red:IM.text3}}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* QR Modal */}
      {showQR&&(
        <div style={{position:'fixed',inset:0,background:'rgba(13,17,23,0.9)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:24}} onClick={()=>setShowQR(false)}>
          <div style={{background:'#fff',borderRadius:28,padding:32,textAlign:'center',maxWidth:300,width:'100%',boxShadow:`0 24px 64px ${IM.red}30`}} onClick={e=>e.stopPropagation()}>
            <div className="orb" style={{fontSize:18,color:IM.navy,marginBottom:4}}>VCG Portal</div>
            <div style={{fontSize:12,color:IM.text2,marginBottom:20}}>Scan to open on any device</div>
            <div style={{display:'inline-block',border:`3px solid ${IM.red}`,borderRadius:18,padding:10,marginBottom:16,boxShadow:`0 0 24px ${IM.red}40`}}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(APP_URL)}&color=c1121f&bgcolor=ffffff&qzone=1`} width={200} height={200} alt="QR" style={{borderRadius:10,display:'block'}} />
            </div>
            <div style={{background:'#f8faff',borderRadius:12,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,marginBottom:16,border:`1px solid ${IM.border}`}}>
              <span>🌐</span><span className="mono" style={{fontSize:11,color:IM.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{APP_URL}</span>
              <button onClick={()=>{navigator.clipboard.writeText(APP_URL);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:16}}>{copied?'✅':'📋'}</button>
            </div>
            <button onClick={()=>setShowQR(false)} style={ironBtn()}>Done</button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes barGrow{from{height:0;opacity:0}to{opacity:1}}`}</style>
    </div>
  )
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomeScreen({blocks,onBlockClick,apiOnline,apiMsg,alerts,onAddCommunity,onNavigate}:any) {
  const unread=alerts.filter((a:Alert)=>!a.read).length
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {apiOnline&&apiMsg&&<div className="su" style={{background:IM.greenL,border:`1px solid ${IM.green}40`,borderRadius:16,padding:'10px 14px',display:'flex',alignItems:'center',gap:8}}>
        <span>✅</span><span className="mono" style={{fontSize:11,color:'#065f46'}}>{apiMsg}</span>
      </div>}

      {unread>0&&<div className="su" onClick={()=>onNavigate('alerts')} style={{background:`linear-gradient(135deg,${IM.redDark}15,${IM.red}08)`,border:`1.5px solid ${IM.red}40`,borderRadius:16,padding:'14px 16px',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
        <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${IM.redDark},${IM.red})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,boxShadow:`0 4px 12px ${IM.red}40`}}>⚠️</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:800,fontSize:13,color:IM.redDark}}>{unread} Active Alert{unread>1?'s':''}</div>
          <div style={{fontSize:11,color:IM.text2}}>Tap to view details</div>
        </div>
        <span style={{fontSize:18,color:IM.red}}>›</span>
      </div>}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontWeight:900,fontSize:17,color:IM.text}}>Energy Communities</div>
          <div style={{fontSize:12,color:IM.text2,marginTop:1}}>{blocks.length} blocks · tap to explore</div>
        </div>
        <button onClick={onAddCommunity} style={{background:`linear-gradient(135deg,${IM.redDark},${IM.red})`,color:'#fff',border:'none',borderRadius:12,padding:'9px 16px',fontWeight:700,fontSize:12,cursor:'pointer',boxShadow:`0 4px 12px ${IM.red}30`}}>＋ Add Block</button>
      </div>

      {blocks.map((b:Block,i:number)=>(
        <div key={b.id} className={`su d${Math.min(i+1,6)}`} onClick={()=>onBlockClick(b)}
          style={{background:IM.card,borderRadius:20,padding:20,boxShadow:'0 4px 16px rgba(0,0,0,0.07)',border:`1px solid ${IM.border}`,cursor:'pointer',transition:'all 0.2s'}}
          onMouseOver={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.borderColor=b.color+'60';e.currentTarget.style.boxShadow=`0 8px 28px ${b.color}20`}}
          onMouseOut={e=>{e.currentTarget.style.transform='';e.currentTarget.style.borderColor=IM.border;e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.07)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:48,height:48,borderRadius:16,background:`linear-gradient(135deg,${b.color}20,${b.color}40)`,border:`2px solid ${b.color}60`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>{b.emoji}</div>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:IM.text}}>{b.name} — {b.location}</div>
                <div className="mono" style={{fontSize:10,color:IM.text3,marginTop:2}}>{b.id} · {b.devices} devices</div>
              </div>
            </div>
            <div style={pill(b.status==='Surplus'?IM.green:b.status==='Deficit'?IM.red:IM.arc)}>{b.status}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[
              {l:'Gen kW',v:b.generation.toFixed(1),c:IM.green},
              {l:'Con kW',v:b.consumption.toFixed(1),c:IM.amber},
              {l:'Net kW',v:(b.net>=0?'+':'')+b.net.toFixed(1),c:b.status==='Surplus'?IM.green:b.status==='Deficit'?IM.red:IM.arc},
            ].map(s=>(
              <div key={s.l} style={{background:'#f8faff',borderRadius:12,padding:'10px 6px',textAlign:'center',border:`1px solid ${IM.border}`}}>
                <div className="orb" style={{fontSize:17,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:9,color:IM.text3,fontWeight:700,marginTop:3}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── CHARTS SCREEN (multiple chart types + data labels) ────────────────────────
function ChartsScreen({blocks,history,sensors}:any) {
  const [chartType,setChartType]=useState<ChartType>('bar')
  const [selBlock,setSelBlock]=useState('ALL')

  const recentHistory=selBlock==='ALL'
    ? (history['BLK-A']||[]).slice(-8)
    : (history[selBlock]||[]).slice(-8)

  const genData=recentHistory.map((h:HistoryEntry)=>h.generation)
  const conData=recentHistory.map((h:HistoryEntry)=>h.consumption)
  const labels=recentHistory.map((h:HistoryEntry)=>h.time)
  const maxV=Math.max(...genData,...conData,1)

  const CHART_TYPES=[
    {id:'bar',    icon:'📊',label:'Bar'},
    {id:'line',   icon:'📈',label:'Line'},
    {id:'area',   icon:'🌊',label:'Area'},
    {id:'donut',  icon:'🍩',label:'Donut'},
    {id:'radar',  icon:'🎯',label:'H-Bar'},
  ]

  const donutData=[
    ...blocks.map((b:Block)=>({label:b.name,value:b.generation,color:b.color}))
  ]

  const hbarData=blocks.map((b:Block)=>({label:b.name,value:b.generation,max:Math.max(...blocks.map((x:Block)=>x.generation)),color:b.color}))

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card({background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none'})}>
        <div className="orb" style={{fontSize:16,color:IM.gold,marginBottom:4}}>📈 Live Charts</div>
        <div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>Real-time energy data visualization</div>
      </div>

      {/* Chart type selector */}
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
        {CHART_TYPES.map(t=>(
          <button key={t.id} onClick={()=>setChartType(t.id as ChartType)}
            style={{flexShrink:0,padding:'8px 16px',borderRadius:20,border:`2px solid ${chartType===t.id?IM.red:IM.border}`,background:chartType===t.id?`linear-gradient(135deg,${IM.redDark},${IM.red})`:'#fff',fontWeight:700,fontSize:12,color:chartType===t.id?'#fff':IM.text2,cursor:'pointer',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',boxShadow:chartType===t.id?`0 4px 12px ${IM.red}30`:undefined}}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Block filter */}
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
        {['ALL',...blocks.map((b:Block)=>b.id)].map((id:string)=>{
          const b=blocks.find((x:Block)=>x.id===id)
          return <button key={id} onClick={()=>setSelBlock(id)} style={{flexShrink:0,padding:'6px 14px',borderRadius:20,border:`2px solid ${selBlock===id?(b?.color||IM.arc):IM.border}`,background:selBlock===id?(b?.color||IM.arc)+'18':'#fff',fontWeight:700,fontSize:11,color:selBlock===id?(b?.color||IM.arc):IM.text3,cursor:'pointer',whiteSpace:'nowrap'}}>{id==='ALL'?'All':b?.name||id}</button>
        })}
      </div>

      {/* Chart display */}
      <div style={card()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:14,color:IM.text}}>
            {chartType==='bar'?'Generation vs Consumption':chartType==='line'?'Generation Trend':chartType==='area'?'Consumption Trend':chartType==='donut'?'Generation Distribution':'Block Performance'}
          </div>
          <div className="mono" style={{fontSize:10,color:IM.text3}}>{new Date().toLocaleTimeString()}</div>
        </div>

        {chartType==='bar'&&(
          <>
            <BarChart
              data={labels.map((l:string,i:number)=>({label:l,values:[+genData[i].toFixed(1),+conData[i].toFixed(1)]}))}
              colors={[IM.green,IM.red]} height={120}
            />
            <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:12}}>
              {[{c:IM.green,l:'Generation'},{c:IM.red,l:'Consumption'}].map(x=>(
                <div key={x.l} style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:12,height:12,borderRadius:3,background:x.c}}/><span style={{fontSize:11,color:IM.text2,fontWeight:600}}>{x.l}</span></div>
              ))}
            </div>
          </>
        )}

        {chartType==='line'&&(
          <>
            <div style={{marginBottom:8}}>
              <div style={{fontSize:11,color:IM.text2,marginBottom:4,fontWeight:600}}>⚡ Generation (kW)</div>
              <LineChart data={genData.map((v:number)=>+v)} color={IM.green} height={100} />
            </div>
            <div>
              <div style={{fontSize:11,color:IM.text2,marginBottom:4,fontWeight:600}}>🔌 Consumption (kW)</div>
              <LineChart data={conData.map((v:number)=>+v)} color={IM.red} height={100} />
            </div>
          </>
        )}

        {chartType==='area'&&(
          <>
            <div style={{fontSize:11,color:IM.text2,marginBottom:8,fontWeight:600}}>📊 Net Energy Balance (kW)</div>
            <LineChart data={recentHistory.map((h:HistoryEntry)=>+h.net)} color={IM.arc} height={120} />
          </>
        )}

        {chartType==='donut'&&(
          <>
            <DonutChart segments={donutData} size={180} />
            <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginTop:12}}>
              {donutData.map((d:any)=>(
                <div key={d.label} style={{display:'flex',alignItems:'center',gap:6}}>
                  <div style={{width:10,height:10,borderRadius:2,background:d.color}}/><span style={{fontSize:11,color:IM.text2}}>{d.label}: <strong style={{color:d.color}}>{d.value.toFixed(1)}</strong></span>
                </div>
              ))}
            </div>
          </>
        )}

        {chartType==='radar'&&<HBarChart data={hbarData} />}
      </div>

      {/* Live stats summary */}
      <div style={card()}>
        <div style={{fontWeight:800,fontSize:14,color:IM.text,marginBottom:14}}>Block Efficiency</div>
        {blocks.map((b:Block)=>{
          const eff=b.generation>0?Math.round((b.net/b.generation)*100):0
          return (
            <div key={b.id} style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{b.emoji}</span>
                  <span style={{fontWeight:700,fontSize:13,color:IM.text}}>{b.name}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span className="mono" style={{fontSize:11,color:b.color,fontWeight:700}}>{b.generation.toFixed(1)} kW</span>
                  <span style={{fontWeight:800,fontSize:12,color:eff>=0?IM.green:IM.red}}>{eff>=0?'+':''}{eff}%</span>
                </div>
              </div>
              <div style={{height:8,background:'#f0f4ff',borderRadius:4,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(Math.abs(eff),100)}%`,background:eff>=0?`linear-gradient(90deg,${IM.green},${b.color})`:`linear-gradient(90deg,${IM.red},${IM.redDark})`,borderRadius:4,transition:'width 1s ease'}} />
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
                <span className="mono" style={{fontSize:9,color:IM.text3}}>0%</span>
                <span className="mono" style={{fontSize:9,color:IM.text3}}>100%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── BLOCK DETAIL ──────────────────────────────────────────────────────────────
function BlockDetailScreen({block:b,blocks,sensors,evs,devices,history,onBack,onRegister,onDeviceClick}:any) {
  const live=blocks.find((x:Block)=>x.id===b.id)||b
  const sc=live.status==='Surplus'?IM.green:live.status==='Deficit'?IM.red:IM.arc
  const recentH=(history||[]).slice(-6)
  const genData=recentH.map((h:HistoryEntry)=>h.generation)
  const conData=recentH.map((h:HistoryEntry)=>h.consumption)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{background:IM.card,borderRadius:20,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
        <div style={{background:`linear-gradient(135deg,${IM.navy},${b.color}cc)`,padding:'18px 20px'}}>
          <button onClick={onBack} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:10,padding:'6px 14px',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:14}}>← Back</button>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <span style={{fontSize:36}}>{b.emoji}</span>
              <div><div className="orb" style={{fontSize:18,fontWeight:900,color:'#fff'}}>{b.name}</div><div style={{fontSize:12,color:'rgba(255,255,255,0.7)'}}>{b.location} · {b.id}</div></div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="orb" style={{fontSize:26,fontWeight:900,color:live.net>=0?IM.gold:IM.red}}>{(live.net>=0?'+':'')+live.net.toFixed(1)}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',fontWeight:700}}>kW Net</div>
            </div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',padding:'16px',gap:8}}>
          {[{l:'Generation',v:live.generation.toFixed(1),c:IM.green},{l:'Consumption',v:live.consumption.toFixed(1),c:IM.amber},{l:'Status',v:live.status,c:sc}].map(s=>(
            <div key={s.l} style={{textAlign:'center'}}>
              <div className="orb" style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
              <div style={{fontSize:10,color:IM.text3,marginTop:2}}>{s.l}{s.l!=='Status'?' kW':''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mini chart with labels */}
      {recentH.length>0&&<>
        <SH title="Energy Trend" />
        <div style={card({padding:'16px 12px'})}>
          <BarChart data={recentH.map((h:HistoryEntry)=>({label:h.time,values:[h.generation,h.consumption]}))} colors={[IM.green,IM.red]} height={100} />
          <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:8}}>
            {[{c:IM.green,l:'Gen'},{c:IM.red,l:'Con'}].map(l=><div key={l.l} style={{display:'flex',alignItems:'center',gap:4}}><div style={{width:10,height:10,borderRadius:2,background:l.c}}/><span style={{fontSize:10,color:IM.text3}}>{l.l}</span></div>)}
          </div>
        </div>
      </>}

      <SH title="Sensor Parameters" />
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {sensors.map((s:Sensor,i:number)=>(
          <div key={s.label} className={`su d${(i%4)+1}`} style={card({padding:'14px 16px'})}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
              <span style={{fontSize:20}}>{s.icon}</span>
              <span className="mono" style={{fontSize:10,color:IM.text3,background:'#f8faff',padding:'2px 7px',borderRadius:6}}>{s.unit}</span>
            </div>
            <div className="orb" style={{fontSize:24,fontWeight:700,color:s.color,lineHeight:1,marginBottom:4}}>{s.value}</div>
            <div style={{fontSize:11,color:IM.text2,marginBottom:8}}>{s.label}</div>
            <div style={{height:3,background:'#f0f4ff',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',width:Math.min(s.bar,100)+'%',background:`linear-gradient(90deg,${s.color}60,${s.color})`,borderRadius:2}} />
            </div>
          </div>
        ))}
      </div>

      {evs.length>0&&<><SH title="EV Charging" />
        {evs.map((ev:EV)=>(
          <div key={ev.id} style={card({border:`1.5px solid ${ev.status==='CHARGING'?IM.gold:IM.border}`})}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div style={{display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:24}}>🚗</span><div style={{fontWeight:800,fontSize:15,color:IM.text}}>{ev.id}</div></div>
              <div style={pill(ev.status==='CHARGING'?IM.gold:IM.text3)}>{ev.status}</div>
            </div>
            {[{l:'Power Draw',v:ev.power+' kW'},{l:'Session Time',v:ev.sessionTime+' min'},{l:'Battery SOC',v:ev.soc+'%'}].map(r=>(
              <div key={r.l} style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:12,color:IM.text2}}>{r.l}</span>
                <span style={{fontWeight:800,fontSize:12,color:IM.text}}>{r.v}</span>
              </div>
            ))}
            <div style={{height:4,background:'#f0f4ff',borderRadius:2,overflow:'hidden',marginTop:8}}>
              <div style={{height:'100%',width:ev.soc+'%',background:ev.status==='CHARGING'?`linear-gradient(90deg,${IM.gold},${IM.amber})`:`linear-gradient(90deg,${IM.arc},#58c4dc)`,borderRadius:2}} />
            </div>
          </div>
        ))}
      </>}

      <SH title={`Devices (${devices.length})`} />
      <div style={card({padding:16})}>
        {devices.length===0?(<div style={{textAlign:'center',padding:'16px 0'}}><div style={{fontSize:32,marginBottom:8}}>📭</div><div style={{fontSize:13,color:IM.text2}}>No devices yet</div></div>):(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {devices.map((d:Device,i:number)=>(
              <div key={i} onClick={()=>onDeviceClick(d)} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',background:'#f8faff',borderRadius:12,border:`1px solid ${IM.border}`,cursor:'pointer'}}
                onMouseOver={e=>{e.currentTarget.style.background=IM.arcLight;e.currentTarget.style.borderColor=IM.arc+'50'}}
                onMouseOut={e=>{e.currentTarget.style.background='#f8faff';e.currentTarget.style.borderColor=IM.border}}>
                <div style={{width:36,height:36,borderRadius:10,background:IM.arcLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>📟</div>
                <div style={{flex:1}}>
                  <div className="mono" style={{fontWeight:700,fontSize:12,color:IM.arc}}>{d.sfdi}</div>
                  <div style={{fontSize:11,color:IM.text3}}>{d.type}</div>
                </div>
                <div style={pill(d.status==='Online'?IM.green:IM.amber)}>{d.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onRegister} style={ironBtn()}>➕ Register Device to {b.name}</button>
    </div>
  )
}

// ── ALERTS ────────────────────────────────────────────────────────────────────
function AlertsScreen({alerts,onMarkRead,onMarkAll}:any) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div className="orb" style={{fontSize:16,color:IM.red}}>⚠️ Alerts</div><div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>{alerts.filter((a:Alert)=>!a.read).length} unread</div></div>
        {alerts.some((a:Alert)=>!a.read)&&<button onClick={onMarkAll} style={{background:IM.arcLight,border:`1px solid ${IM.arc}`,borderRadius:10,padding:'8px 14px',fontWeight:700,fontSize:12,color:IM.arc,cursor:'pointer'}}>Mark all read</button>}
      </div>
      {alerts.length===0&&<div style={card({textAlign:'center',padding:'40px 20px'})}><div style={{fontSize:48,marginBottom:12}}>✅</div><div style={{fontWeight:700,fontSize:16,color:IM.text}}>All clear!</div></div>}
      {alerts.map((a:Alert)=>{
        const c=a.severity==='high'?IM.red:a.severity==='medium'?IM.amber:IM.arc
        return (
          <div key={a.id} style={card({border:`1.5px solid ${c}30`,background:a.read?IM.card:`${c}06`,opacity:a.read?0.6:1})}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
              <div style={{width:42,height:42,borderRadius:14,background:`${c}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{a.type==='deficit'?'⚡':a.type==='battery'?'🔋':'🔌'}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <div style={pill(c)}>{a.severity}</div>
                  <span className="mono" style={{fontSize:10,color:IM.text3}}>{a.time}</span>
                </div>
                <div style={{fontSize:13,color:IM.text,lineHeight:1.5,marginBottom:8}}>{a.message}</div>
                {!a.read&&<button onClick={()=>onMarkRead(a.id)} style={{background:'none',border:`1px solid ${IM.border}`,borderRadius:8,padding:'5px 12px',fontSize:11,fontWeight:600,color:IM.text2,cursor:'pointer'}}>Mark read</button>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── DEMAND ────────────────────────────────────────────────────────────────────
function DemandScreen({blocks,apiOnline}:any) {
  const [triggered,setTriggered]=useState<string[]>([])
  const [events,setEvents]=useState([
    {id:'DR-001',block:'BLK-B',type:'Load Reduction',target:15,duration:30,status:'Active',time:'10:42'},
    {id:'DR-002',block:'BLK-A',type:'Peak Shaving',  target:10,duration:60,status:'Scheduled',time:'14:00'},
  ])
  const trigger=(id:string)=>{
    setTriggered(p=>[...p,id])
    setEvents(p=>[...p,{id:'DR-'+Date.now(),block:id,type:'Manual DR',target:20,duration:15,status:'Active',time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}])
    setTimeout(()=>setTriggered(p=>p.filter(x=>x!==id)),3000)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none'}}><div className="orb" style={{fontSize:16,color:IM.gold}}>⚡ Demand Response</div><div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>Manage DR events per community</div></div>
      <SH title="Active Events" />
      {events.map(e=>(
        <div key={e.id} style={card({border:`1.5px solid ${e.status==='Active'?IM.gold:IM.border}`})}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <div><div style={{fontWeight:800,fontSize:14,color:IM.text}}>{e.type}</div><div className="mono" style={{fontSize:10,color:IM.text3}}>{e.id}</div></div>
            <div style={pill(e.status==='Active'?IM.gold:IM.arc)}>{e.status}</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[{l:'Target',v:e.target+'%'},{l:'Duration',v:e.duration+' min'},{l:'Time',v:e.time}].map(r=>(
              <div key={r.l} style={{background:'#f8faff',borderRadius:10,padding:'8px',textAlign:'center'}}><div style={{fontWeight:800,fontSize:14,color:IM.text}}>{r.v}</div><div style={{fontSize:10,color:IM.text3}}>{r.l}</div></div>
            ))}
          </div>
        </div>
      ))}
      <SH title="Manual Trigger" />
      {blocks.map((b:Block)=>(
        <div key={b.id} style={{...card(),display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:20}}>{b.emoji}</span><div><div style={{fontWeight:700,fontSize:13,color:IM.text}}>{b.name} — {b.location}</div><div style={pill(b.status==='Surplus'?IM.green:b.status==='Deficit'?IM.red:IM.arc)}>{b.status}</div></div></div>
          <button onClick={()=>trigger(b.id)} disabled={triggered.includes(b.id)} style={{background:triggered.includes(b.id)?IM.green:`linear-gradient(135deg,${IM.goldDark},${IM.gold})`,color:triggered.includes(b.id)?'#fff':IM.navy,border:'none',borderRadius:10,padding:'8px 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>{triggered.includes(b.id)?'✓ Sent':'Trigger DR'}</button>
        </div>
      ))}
    </div>
  )
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
function HistoryScreen({history,blocks}:any) {
  const [sel,setSel]=useState('BLK-A')
  const entries:HistoryEntry[]=(history[sel]||[]).slice().reverse().slice(0,20)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div className="orb" style={{fontSize:16,color:IM.arc}}>📋 History</div><div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>Energy readings log</div></div>
        <button onClick={()=>import('xlsx').then(X=>{const ws=X.utils.json_to_sheet(entries);const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'History');X.writeFile(wb,`vcg_history_${sel}.xlsx`)})} style={{background:`linear-gradient(135deg,${IM.green},#059669)`,color:'#fff',border:'none',borderRadius:12,padding:'9px 14px',fontWeight:700,fontSize:12,cursor:'pointer'}}>⬇️ Export</button>
      </div>
      <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
        {blocks.map((b:Block)=><button key={b.id} onClick={()=>setSel(b.id)} style={{flexShrink:0,padding:'8px 16px',borderRadius:20,border:`2px solid ${sel===b.id?b.color:IM.border}`,background:sel===b.id?b.color+'18':'#fff',fontWeight:700,fontSize:12,color:sel===b.id?b.color:IM.text2,cursor:'pointer'}}>{b.name}</button>)}
      </div>
      {/* Line chart of history */}
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:IM.text,marginBottom:12}}>Generation Trend</div>
        <LineChart data={entries.slice(0,12).reverse().map((e:HistoryEntry)=>e.generation)} color={IM.green} height={90} />
      </div>
      <div style={card({padding:0,overflow:'hidden'})}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`}}>
              {['Time','Gen','Con','Net','Cost €'].map(h=><th key={h} style={{padding:'12px 10px',textAlign:'left',fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'rgba(255,255,255,0.7)',letterSpacing:1}}>{h}</th>)}
            </tr></thead>
            <tbody>{entries.map((e:HistoryEntry,i:number)=>(
              <tr key={i} style={{background:i%2===0?'#f8faff':'#fff',borderBottom:`1px solid ${IM.border}`}}>
                <td style={{padding:'10px',fontFamily:"'Share Tech Mono',monospace",color:IM.text2,fontSize:11}}>{e.time}</td>
                <td style={{padding:'10px',fontWeight:700,color:IM.green}}>{e.generation}</td>
                <td style={{padding:'10px',fontWeight:700,color:IM.amber}}>{e.consumption}</td>
                <td style={{padding:'10px',fontWeight:700,color:e.net>=0?IM.green:IM.red}}>{e.net>=0?'+':''}{e.net}</td>
                <td style={{padding:'10px',fontWeight:700,color:IM.text2}}>€{e.cost}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── COST ──────────────────────────────────────────────────────────────────────
function CostScreen({blocks,sensors}:any) {
  const rate=0.38
  const totalCost=blocks.reduce((s:number,b:Block)=>s+parseFloat((b.consumption*rate/1000*3600).toFixed(2)),0)
  const totalSave=blocks.reduce((s:number,b:Block)=>s+parseFloat((b.generation*rate/1000*3600).toFixed(2)),0)
  const totalCO2=Object.values(sensors).flat().filter((s:any)=>s.label==='CO₂ Saved').reduce((t:number,s:any)=>t+s.value,0)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none'}}><div className="orb" style={{fontSize:16,color:IM.gold}}>💰 Cost & Savings</div><div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>Energy cost analysis</div></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        {[
          {icon:'💸',l:'Daily Cost',  v:`€${totalCost.toFixed(2)}`,  c:IM.red,   bg:'#fef2f2'},
          {icon:'💚',l:'Solar Savings',v:`€${totalSave.toFixed(2)}`, c:IM.green, bg:IM.greenL},
          {icon:'🌿',l:'CO₂ Saved',  v:`${(+totalCO2).toFixed(1)}kg`,c:IM.arc,   bg:IM.arcLight},
          {icon:'📊',l:'Rate/kWh',   v:`€${rate}`,                  c:IM.amber, bg:IM.amberL},
        ].map(s=>(
          <div key={s.l} style={{background:s.bg,borderRadius:18,padding:'18px 16px',border:`1px solid ${s.c}20`}}>
            <div style={{fontSize:28,marginBottom:8}}>{s.icon}</div>
            <div className="orb" style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div>
            <div style={{fontSize:11,color:IM.text2,marginTop:4,fontWeight:600}}>{s.l}</div>
          </div>
        ))}
      </div>
      {/* Donut for cost distribution */}
      <div style={card()}>
        <div style={{fontWeight:800,fontSize:14,color:IM.text,marginBottom:14}}>Cost Distribution</div>
        <DonutChart segments={blocks.map((b:Block)=>({label:b.name,value:parseFloat((b.consumption*rate/1000*3600).toFixed(2)),color:b.color}))} size={160} />
      </div>
      <SH title="Per Block Breakdown" />
      {blocks.map((b:Block)=>{
        const cost=+(b.consumption*rate/1000*3600).toFixed(3)
        const save=+(b.generation*rate/1000*3600).toFixed(3)
        const net=+(save-cost).toFixed(3)
        return (
          <div key={b.id} style={card()}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
              <div style={{width:40,height:40,borderRadius:12,background:b.color+'20',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{b.emoji}</div>
              <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14,color:IM.text}}>{b.name}</div><div className="mono" style={{fontSize:10,color:IM.text3}}>{b.id}</div></div>
              <div className="orb" style={{fontWeight:900,fontSize:16,color:net>=0?IM.green:IM.red}}>{net>=0?'+€':'−€'}{Math.abs(net).toFixed(3)}</div>
            </div>
            <HBarChart data={[{label:'Energy Cost',value:cost,max:cost+save,color:IM.red},{label:'Solar Savings',value:save,max:cost+save,color:IM.green}]} />
          </div>
        )
      })}
    </div>
  )
}

// ── DEVICES ───────────────────────────────────────────────────────────────────
function DevicesScreen({devices,blocks,activeDevice,onDelete}:any) {
  const [sel,setSel]=useState<Device|null>(activeDevice)
  if(sel) return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}><button onClick={()=>setSel(null)} style={{background:'#f0f4ff',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:IM.text2,cursor:'pointer',marginBottom:14}}>← Back</button><div className="orb" style={{fontSize:16,color:IM.navy}}>📟 Device Detail</div></div>
      <div style={card({border:`2px solid ${sel.status==='Online'?IM.green:IM.amber}`})}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
          <div style={{width:56,height:56,borderRadius:18,background:IM.arcLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>📟</div>
          <div><div className="mono" style={{fontWeight:700,fontSize:16,color:IM.arc}}>{sel.sfdi}</div><div style={{fontSize:13,color:IM.text2}}>{sel.type}</div><div style={pill(sel.status==='Online'?IM.green:IM.amber)}>{sel.status}</div></div>
        </div>
        {[{l:'Long Form ID',v:sel.lfdi||'—'},{l:'Device Type',v:sel.type},{l:'Block',v:blocks.find((b:Block)=>b.id===sel.block)?.name||sel.block},{l:'Power',v:sel.power?sel.power+'W':'—'},{l:'Voltage',v:sel.voltage?sel.voltage+'V':'—'},{l:'Last Seen',v:sel.lastSeen||'—'}].map(r=>(
          <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${IM.border}`}}>
            <span style={{fontSize:12,color:IM.text2,fontWeight:600}}>{r.l}</span>
            <span className="mono" style={{fontSize:12,color:IM.text,fontWeight:700,maxWidth:'55%',textAlign:'right'}}>{r.v}</span>
          </div>
        ))}
        <button onClick={()=>{onDelete(sel.sfdi);setSel(null)}} style={{...ironBtn(),marginTop:16,background:'#fef2f2',color:IM.red,boxShadow:'none',border:`1px solid ${IM.red}30`}}>🗑️ Deregister</button>
      </div>
    </div>
  )
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div className="orb" style={{fontSize:16,color:IM.arc}}>📟 All Devices</div><div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>{devices.length} total · {devices.filter((d:Device)=>d.status==='Online').length} online</div></div>
      </div>
      {blocks.map((b:Block)=>{
        const bd=devices.filter((d:Device)=>d.block===b.id)
        if(!bd.length) return null
        return <div key={b.id}>
          <div style={{fontWeight:700,fontSize:12,color:IM.text2,padding:'4px 4px 8px',display:'flex',alignItems:'center',gap:6}}><span>{b.emoji}</span>{b.name} — {b.location}</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {bd.map((d:Device,i:number)=>(
              <div key={i} onClick={()=>setSel(d)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:IM.card,borderRadius:16,border:`1px solid ${IM.border}`,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.05)',transition:'all 0.15s'}}
                onMouseOver={e=>{e.currentTarget.style.background=IM.arcLight;e.currentTarget.style.borderColor=IM.arc+'50'}}
                onMouseOut={e=>{e.currentTarget.style.background=IM.card;e.currentTarget.style.borderColor=IM.border}}>
                <div style={{width:38,height:38,borderRadius:12,background:b.color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>📟</div>
                <div style={{flex:1}}><div className="mono" style={{fontWeight:700,fontSize:12,color:IM.arc}}>{d.sfdi}</div><div style={{fontSize:11,color:IM.text3}}>{d.type}{d.power?` · ${d.power}W`:''}</div></div>
                <div style={pill(d.status==='Online'?IM.green:IM.amber)}>{d.status}</div>
                <span style={{color:IM.text3}}>›</span>
              </div>
            ))}
          </div>
        </div>
      })}
    </div>
  )
}

// ── MAP ───────────────────────────────────────────────────────────────────────
function MapScreen({blocks}:any) {
  const W=380,H=400
  const irelandPath="M190,20 C210,18 230,22 245,35 C260,48 268,58 272,72 C278,90 275,105 270,118 C265,130 258,138 252,148 C248,158 246,168 244,180 C242,195 240,210 238,225 C234,240 228,252 220,262 C210,274 198,282 188,290 C178,298 168,304 158,312 C148,320 140,330 135,342 C130,354 128,366 130,378 C132,388 138,394 145,398 L162,394 C168,388 170,378 168,368 C166,358 160,350 155,342 C150,334 145,326 142,316 C138,304 136,292 138,280 C140,268 146,258 150,246 C154,234 156,222 155,210 C154,198 150,187 145,178 C140,168 134,160 128,152 C120,142 112,134 106,124 C98,112 92,100 90,86 C88,72 90,58 96,46 C102,34 112,24 124,18 Z"
  const toXY=(lat:number,lng:number)=>({x:((lng-(-10.5))/((-5.5)-(-10.5)))*(W*0.6)+W*0.2, y:((54.5-lat)/((54.5)-(51.3)))*(H*0.8)+H*0.06})
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none'}}><div className="orb" style={{fontSize:16,color:IM.arc}}>🗺️ Ireland Map</div><div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>Community blocks across Ireland</div></div>
      <div style={card({padding:16,overflow:'hidden'})}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:'block'}}>
          <rect width={W} height={H} fill="#e8f4fd" rx="12"/>
          <path d={irelandPath} fill="#d4edda" stroke="#10b981" strokeWidth="1.5"/>
          {[0.25,0.5,0.75].map(f=>[
            <line key={`h${f}`} x1={0} y1={H*f} x2={W} y2={H*f} stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" strokeDasharray="4,4"/>,
            <line key={`v${f}`} x1={W*f} y1={0} x2={W*f} y2={H} stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" strokeDasharray="4,4"/>,
          ])}
          {blocks.map((b:Block)=>{
            const {x,y}=toXY(b.lat,b.lng)
            const sc=b.status==='Surplus'?IM.green:b.status==='Deficit'?IM.red:IM.arc
            return <g key={b.id}>
              <circle cx={x} cy={y} r={16} fill={b.color} opacity={0.15}/>
              <circle cx={x} cy={y} r={10} fill={b.color} opacity={0.3}/>
              <circle cx={x} cy={y} r={7} fill={b.color} stroke="#fff" strokeWidth="2"/>
              <rect x={x+12} y={y-13} width={76} height={26} rx="7" fill="white" opacity="0.95"/>
              <text x={x+16} y={y-1} fontSize="9" fontWeight="700" fill={IM.navy} fontFamily="Plus Jakarta Sans,sans-serif">{b.name}</text>
              <text x={x+16} y={y+10} fontSize="8" fill={IM.text3} fontFamily="Plus Jakarta Sans,sans-serif">{b.location}</text>
            </g>
          })}
        </svg>
      </div>
      <div style={card()}>
        {blocks.map((b:Block)=>{
          const sc=b.status==='Surplus'?IM.green:b.status==='Deficit'?IM.red:IM.arc
          return <div key={b.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${IM.border}`}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:12,height:12,borderRadius:'50%',background:b.color}}/><span style={{fontWeight:700,fontSize:13,color:IM.text}}>{b.emoji} {b.name}</span><span style={{fontSize:11,color:IM.text3}}>{b.location}</span></div>
            <div style={pill(sc)}>{b.status}</div>
          </div>
        })}
      </div>
    </div>
  )
}

// ── COMPARE ───────────────────────────────────────────────────────────────────
function CompareScreen({blocks,sensors}:any) {
  const sorted=[...blocks].sort((a:Block,b:Block)=>b.net-a.net)
  const maxGen=Math.max(...blocks.map((b:Block)=>b.generation),1)
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{...card(),background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,border:'none'}}><div className="orb" style={{fontSize:16,color:IM.gold}}>🏆 Compare</div><div className="mono" style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:4}}>Block leaderboard</div></div>
      {sorted.map((b:Block,i:number)=>(
        <div key={b.id} style={card({border:`1.5px solid ${i===0?IM.gold:IM.border}`})}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:14,background:i===0?IM.goldLight:i===1?'#f1f5f9':'#f8faff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅'}</div>
            <div style={{flex:1}}><div style={{fontWeight:800,fontSize:15,color:IM.text}}>{b.emoji} {b.name} — {b.location}</div><div className="mono" style={{fontSize:10,color:IM.text3}}>{b.id}</div></div>
            <div style={{textAlign:'right'}}><div className="orb" style={{fontSize:20,color:b.net>=0?IM.green:IM.red}}>{b.net>=0?'+':''}{b.net.toFixed(1)}</div><div style={{fontSize:10,color:IM.text3}}>kW Net</div></div>
          </div>
          <HBarChart data={[{label:'Generation',value:b.generation,max:maxGen,color:IM.green},{label:'Consumption',value:b.consumption,max:maxGen,color:IM.red}]} />
        </div>
      ))}
      {/* Sensor comparison table */}
      <SH title="Sensor Comparison" />
      <div style={card({padding:0,overflow:'hidden'})}>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`}}>
              <th style={{padding:'10px 12px',textAlign:'left',color:'rgba(255,255,255,0.7)',fontFamily:"'Share Tech Mono',monospace",fontSize:9,letterSpacing:1}}>Sensor</th>
              {blocks.map((b:Block)=><th key={b.id} style={{padding:'10px 8px',textAlign:'center',color:b.color,fontFamily:"'Share Tech Mono',monospace",fontSize:9}}>{b.name.replace('Block ','')}</th>)}
            </tr></thead>
            <tbody>{(sensors[blocks[0]?.id]||[]).map((s:Sensor,i:number)=>(
              <tr key={s.label} style={{background:i%2===0?'#f8faff':'#fff',borderBottom:`1px solid ${IM.border}`}}>
                <td style={{padding:'10px 12px',display:'flex',alignItems:'center',gap:6}}><span style={{fontSize:14}}>{s.icon}</span><span style={{color:IM.text2,fontSize:11}}>{s.label}</span></td>
                {blocks.map((b:Block)=>{const sv=sensors[b.id]?.[i];return <td key={b.id} style={{padding:'10px 8px',textAlign:'center',fontWeight:700,color:sv?.color||IM.text,fontSize:12}}>{sv?.value||'—'}<span style={{fontSize:9,color:IM.text3,fontWeight:400}}> {sv?.unit}</span></td>})}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
function RegisterScreen({blocks,activeBlock,onBack,apiOnline,onDeviceAdded}:any) {
  const [form,setForm]=useState({sfdi:'',lfdi:'',deviceType:'Smart Meter',block:activeBlock?.id||blocks[0]?.id||'BLK-A',realPower:'',voltage:''})
  const [msg,setMsg]=useState('');const [loading,setLoading]=useState(false)
  const submit=async()=>{
    if(!form.sfdi||!form.lfdi){setMsg('⚠️ SFDI and LFDI required');return}
    setLoading(true)
    try{const r=await fetch(API+'/edev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});if(r.ok){onDeviceAdded({...form,status:'Online',power:+form.realPower||0,voltage:+form.voltage||0,lastSeen:'Just now'});setMsg('✅ Registered!')}else setMsg('❌ Failed')}
    catch{onDeviceAdded({...form,status:'Online',power:+form.realPower||0,voltage:+form.voltage||0,lastSeen:'Just now'});setMsg('📴 Saved locally')}
    setLoading(false);setTimeout(()=>setMsg(''),3000)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}><button onClick={onBack} style={{background:'#f0f4ff',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:IM.text2,cursor:'pointer',marginBottom:14}}>← Back</button><div className="orb" style={{fontSize:16,color:IM.navy}}>➕ Register Device</div></div>
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:IM.text,marginBottom:12}}>Select Block</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {blocks.map((b:Block)=>(
            <button key={b.id} onClick={()=>setForm(p=>({...p,block:b.id}))} style={{padding:'10px',borderRadius:12,border:`2px solid ${form.block===b.id?b.color:IM.border}`,background:form.block===b.id?b.color+'12':'#fafbff',cursor:'pointer',textAlign:'left' as const}}>
              <div style={{display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:18}}>{b.emoji}</span><div><div style={{fontWeight:700,fontSize:12,color:form.block===b.id?b.color:IM.text}}>{b.name}</div><div style={{fontSize:10,color:IM.text3}}>{b.location}</div></div></div>
            </button>
          ))}
        </div>
      </div>
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:IM.text,marginBottom:14}}>Device Identity</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[{l:'Device ID (SFDI) *',k:'sfdi',ph:'e.g. SM_BlockA_001'},{l:'Long Form ID (LFDI) *',k:'lfdi',ph:'e.g. LFDI-SM-001'}].map(f=>(
            <div key={f.k}><label style={lbl}>{f.l}</label><input style={inp()} placeholder={f.ph} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} onFocus={e=>(e.target.style.borderColor=IM.red)} onBlur={e=>(e.target.style.borderColor=IM.border)} /></div>
          ))}
          <div><label style={lbl}>Device Type</label>
            <select style={inp({cursor:'pointer'})} value={form.deviceType} onChange={e=>setForm(p=>({...p,deviceType:e.target.value}))}>
              {['Smart Meter','Solar Inverter','EV Charger','HVAC','Battery Storage','Wind Turbine','Load Controller'].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={lbl}>Real Power (W)</label><input style={inp()} placeholder="1400" value={form.realPower} onChange={e=>setForm(p=>({...p,realPower:e.target.value}))} onFocus={e=>(e.target.style.borderColor=IM.red)} onBlur={e=>(e.target.style.borderColor=IM.border)} /></div>
            <div><label style={lbl}>Voltage (V)</label><input style={inp()} placeholder="230" value={form.voltage} onChange={e=>setForm(p=>({...p,voltage:e.target.value}))} onFocus={e=>(e.target.style.borderColor=IM.red)} onBlur={e=>(e.target.style.borderColor=IM.border)} /></div>
          </div>
        </div>
      </div>
      <button onClick={submit} disabled={loading} style={ironBtn({background:loading?IM.text3:`linear-gradient(135deg,${IM.redDark},${IM.red})`})}>{loading?<><div style={{width:16,height:16,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}} />Registering...</>:'⊕ Register Device'}</button>
      {msg&&<div style={{padding:'12px',borderRadius:12,background:msg.startsWith('✅')?IM.greenL:'#fef2f2',fontSize:13,fontWeight:700,color:msg.startsWith('✅')?IM.green:IM.red,textAlign:'center'}}>{msg}</div>}
    </div>
  )
}

// ── IMPORT ────────────────────────────────────────────────────────────────────
function ImportScreen({blocks,onBack,onBlocksImported,onDevicesImported}:any) {
  const [tab,setTab]=useState<'communities'|'devices'>('communities')
  const [preview,setPreview]=useState<any[]>([]);const [error,setError]=useState('');const [success,setSuccess]=useState('');const [fileName,setFileName]=useState('')
  const COLORS=['#e63946','#ffd60a','#58c4dc','#10b981','#f97316','#8b5cf6']
  const EMOJIS=['🏙️','🏘️','🌆','🌉','🏚️','🌃']
  const readExcel=(file:File)=>{
    setError('');setSuccess('');setPreview([]);setFileName(file.name)
    const reader=new FileReader();reader.onload=(e)=>{import('xlsx').then(X=>{try{const data=new Uint8Array(e.target?.result as ArrayBuffer);const wb=X.read(data,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const rows:any[]=X.utils.sheet_to_json(ws);if(!rows.length){setError('No data found');return}setPreview(rows.slice(0,10))}catch{setError('Could not read file')}})}
    reader.readAsArrayBuffer(file)
  }
  const importData=()=>{
    if(!preview.length){setError('No data');return}
    if(tab==='communities'){
      const nb=preview.map((row:any,i:number)=>{const gen=parseFloat(row['Generation (kW)']||100);const con=parseFloat(row['Consumption (kW)']||80);const net=+(gen-con).toFixed(1);const idx=blocks.length+i;return{id:row['Block ID']||`BLK-${String.fromCharCode(65+idx)}`,name:row['Block Name']||`Block ${String.fromCharCode(65+idx)}`,location:row['Location']||'Ireland',emoji:EMOJIS[idx%EMOJIS.length],generation:gen,consumption:con,net,status:net>0.5?'Surplus':net<-0.5?'Deficit':'Balanced',devices:+row['Devices']||0,color:COLORS[idx%COLORS.length],lat:53+Math.random()*2,lng:-8+Math.random()*3}})
      onBlocksImported(nb);setSuccess(`✅ Imported ${nb.length} blocks!`)
    }else{
      const nd=preview.map((row:any)=>({sfdi:row['Device ID (SFDI)']||'DEV-'+Math.random().toString(36).slice(2,6).toUpperCase(),lfdi:row['Long Form ID (LFDI)']||'',type:row['Device Type']||'Smart Meter',block:row['Block ID']||blocks[0]?.id||'BLK-A',status:'Online',power:+row['Real Power (W)']||0,voltage:+row['Voltage (V)']||230,lastSeen:'Just imported'}))
      onDevicesImported(nd);setSuccess(`✅ Imported ${nd.length} devices!`)
    }
    setTimeout(()=>onBack(),1500)
  }
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={card()}><button onClick={onBack} style={{background:'#f0f4ff',border:'none',borderRadius:10,padding:'7px 14px',fontSize:12,fontWeight:700,color:IM.text2,cursor:'pointer',marginBottom:14}}>← Back</button><div className="orb" style={{fontSize:16,color:IM.navy}}>📊 Import Excel</div></div>
      <div style={{display:'flex',gap:8,background:IM.card,borderRadius:16,padding:8,boxShadow:'0 2px 10px rgba(0,0,0,0.06)'}}>
        {(['communities','devices'] as const).map(t=><button key={t} onClick={()=>{setTab(t);setPreview([]);setFileName('');setError('');setSuccess('')}} style={{flex:1,padding:'10px',border:'none',borderRadius:12,fontWeight:800,fontSize:13,cursor:'pointer',background:tab===t?`linear-gradient(135deg,${IM.redDark},${IM.red})`:'#f0f4ff',color:tab===t?'#fff':IM.text2}}>{t==='communities'?'🏘️ Communities':'📟 Devices'}</button>)}
      </div>
      <div style={{...card(),background:IM.greenL,border:`1px solid ${IM.green}30`}}>
        <div style={{fontWeight:700,fontSize:13,color:IM.green,marginBottom:8}}>📥 Download Template</div>
        <button onClick={()=>import('xlsx').then(X=>{const ws=X.utils.json_to_sheet(tab==='communities'?[{'Block ID':'BLK-E','Block Name':'Block E','Location':'Waterford','Generation (kW)':120,'Consumption (kW)':95,'Devices':8}]:[{'Device ID (SFDI)':'SM-E001','Long Form ID (LFDI)':'LFDI-SM-E001','Device Type':'Smart Meter','Block ID':'BLK-A','Real Power (W)':1400,'Voltage (V)':230}]);const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,tab);X.writeFile(wb,`vcg_${tab}_template.xlsx`)})} style={ironBtn()}>⬇️ Download Template</button>
      </div>
      <div style={card()}>
        <div style={{fontWeight:700,fontSize:13,color:IM.text,marginBottom:12}}>📤 Upload Excel File</div>
        <label style={{display:'block',border:`2px dashed ${fileName?IM.red:IM.border}`,borderRadius:16,padding:'28px 20px',textAlign:'center',cursor:'pointer',background:fileName?IM.redLight:'#fafbff'}}>
          <input type="file" accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>{if(e.target.files?.[0]) readExcel(e.target.files[0])}} />
          <div style={{fontSize:36,marginBottom:8}}>{fileName?'📗':'📂'}</div>
          {fileName?<><div style={{fontWeight:800,fontSize:14,color:IM.red}}>{fileName}</div><div style={{fontSize:11,color:IM.text2,marginTop:4}}>{preview.length} rows</div></>:<><div style={{fontWeight:700,fontSize:14,color:IM.text}}>Tap to choose file</div><div style={{fontSize:11,color:IM.text3,marginTop:4}}>.xlsx · .xls · .csv</div></>}
        </label>
        {error&&<div style={{marginTop:10,padding:'10px',background:'#fef2f2',borderRadius:10,fontSize:12,color:IM.red}}>⚠️ {error}</div>}
      </div>
      {preview.length>0&&<div style={card({padding:0,overflow:'hidden'})}>
        <div style={{padding:'14px 16px',fontWeight:700,fontSize:13,color:IM.text}}>Preview ({preview.length} rows)</div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead><tr style={{background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`}}>{Object.keys(preview[0]).map(k=><th key={k} style={{padding:'8px 10px',textAlign:'left',fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:'rgba(255,255,255,0.8)',whiteSpace:'nowrap'}}>{k}</th>)}</tr></thead>
            <tbody>{preview.map((row,i)=><tr key={i} style={{background:i%2===0?'#f8faff':'#fff',borderBottom:`1px solid ${IM.border}`}}>{Object.values(row).map((v:any,j)=><td key={j} style={{padding:'8px 10px',color:IM.text,whiteSpace:'nowrap'}}>{String(v)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>}
      {preview.length>0&&<button onClick={importData} style={ironBtn()}>📊 Import {preview.length} {tab==='communities'?'Communities':'Devices'}</button>}
      {success&&<div style={{padding:'14px',borderRadius:14,background:IM.greenL,fontSize:14,fontWeight:800,color:IM.green,textAlign:'center'}}>{success}</div>}
    </div>
  )
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function SettingsScreen({apiOnline,apiMsg,onRefresh,onShowQR,onNavigate}:any) {
  const MORE=[
    {icon:'📋',label:'History',     s:'history', c:IM.arc},
    {icon:'💰',label:'Cost & Savings',s:'cost',  c:IM.gold},
    {icon:'📟',label:'All Devices', s:'devices', c:IM.arc},
    {icon:'🏆',label:'Compare',     s:'compare', c:IM.gold},
    {icon:'🗺️',label:'Ireland Map', s:'map',     c:IM.green},
    {icon:'➕',label:'Register',    s:'register',c:IM.red},
    {icon:'📊',label:'Import Excel',s:'import',  c:IM.green},
  ]
  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {/* MORE FEATURES GRID */}
      <div style={{background:`linear-gradient(135deg,${IM.navy},${IM.navy2})`,borderRadius:24,padding:20,border:`1px solid ${IM.red}20`}}>
        <div className="orb" style={{fontSize:14,color:IM.gold,marginBottom:14,letterSpacing:1}}>⚙️ More Features</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {MORE.map(item=>(
            <button key={item.s} onClick={()=>onNavigate(item.s)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,cursor:'pointer',textAlign:'left' as const,transition:'all 0.15s'}}
              onMouseOver={e=>{e.currentTarget.style.background='rgba(255,255,255,0.13)';e.currentTarget.style.borderColor=item.c+'80'}}
              onMouseOut={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'}}>
              <div style={{width:38,height:38,borderRadius:12,background:item.c+'25',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{item.icon}</div>
              <span style={{fontWeight:700,fontSize:13,color:'#fff'}}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{background:`linear-gradient(135deg,${IM.navy},#3d0c0c)`,borderRadius:24,padding:24,color:'#fff',boxShadow:`0 8px 32px ${IM.red}30`,border:`1px solid ${IM.red}30`}}>
        <div style={{width:60,height:60,borderRadius:20,background:`linear-gradient(135deg,${IM.redDark},${IM.red})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,marginBottom:14,boxShadow:`0 4px 16px ${IM.red}50`}}>👨‍💻</div>
        <div className="orb" style={{fontSize:22,color:'#fff'}}>Ronit</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.6)',marginTop:3}}>Virtual Communication Gateway</div>
        <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
          {[{l:'Student',v:'MI6228'},{l:'Group',v:'13'},{l:'Mentor',v:'Paolo C.'},{l:'Protocol',v:'IEEE 2030.5'}].map(x=>(
            <div key={x.l} style={{background:'rgba(255,255,255,0.08)',borderRadius:10,padding:'6px 12px',border:`1px solid ${IM.red}30`}}>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.4)',fontWeight:700,textTransform:'uppercase' as const,letterSpacing:1.2}}>{x.l}</div>
              <div style={{fontSize:13,fontWeight:800,color:IM.gold}}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card()}>
        <div style={{fontWeight:800,fontSize:15,color:IM.text,marginBottom:14}}>📲 Share App</div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=88x88&data=${encodeURIComponent(APP_URL)}&color=c1121f&bgcolor=ffffff&qzone=1`} width={88} height={88} alt="QR" style={{borderRadius:12,border:`2px solid ${IM.red}`,boxShadow:`0 0 16px ${IM.red}30`}} />
          <div style={{flex:1}}>
            <div className="mono" style={{fontSize:11,color:IM.red,marginBottom:4}}>vcg-webapp.vercel.app</div>
            <div style={{fontSize:12,color:IM.text2,marginBottom:10}}>Scan to open on any device</div>
            <button onClick={onShowQR} style={ironBtn({padding:'9px 16px',width:'auto',fontSize:12})}>📲 Full QR</button>
          </div>
        </div>
      </div>

      <div style={card()}>
        <div style={{fontWeight:800,fontSize:15,color:IM.text,marginBottom:14}}>🔌 API Status</div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'#f8faff',borderRadius:12,marginBottom:10,border:`1px solid ${IM.border}`}}>
          <div><div className="mono" style={{fontSize:11,color:IM.text2}}>virtual-gateway.onrender.com</div>{apiMsg&&<div style={{fontSize:11,color:apiOnline?IM.green:IM.red,marginTop:2}}>{apiMsg}</div>}</div>
          <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:'50%',background:apiOnline===null?IM.amber:apiOnline?IM.green:IM.red}}/><span style={{fontSize:11,fontWeight:700,color:apiOnline===null?IM.amber:apiOnline?IM.green:IM.red}}>{apiOnline===null?'Checking':apiOnline?'Online':'Offline'}</span></div>
        </div>
        <button onClick={onRefresh} style={ironBtn()}>↺ Refresh</button>
      </div>

      <div style={card()}>
        <div style={{fontWeight:800,fontSize:15,color:IM.text,marginBottom:14}}>🔗 Quick Links</div>
        {[{icon:'🚀',l:'Live API Docs',sub:'virtual-gateway.onrender.com/docs',href:API+'/docs'},{icon:'💻',l:'GitHub',sub:'rt0181996/virtual-gateway',href:'https://github.com/rt0181996/virtual-gateway'},{icon:'📊',l:'Grafana',sub:'localhost:3000',href:'http://localhost:3000'},{icon:'🌐',l:'IDS Dataspace',sub:'localhost:8181',href:'http://localhost:8181'}].map((x,i)=>(
          <a key={x.l} href={x.href} target="_blank" rel="noopener" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:i<3?`1px solid ${IM.border}`:'none',textDecoration:'none'}}>
            <div style={{width:38,height:38,borderRadius:12,background:IM.redLight,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{x.icon}</div>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:IM.text}}>{x.l}</div><div className="mono" style={{fontSize:10,color:IM.text3}}>{x.sub}</div></div>
            <span style={{color:IM.text3,fontSize:18}}>›</span>
          </a>
        ))}
      </div>
      <div style={{textAlign:'center',padding:8,fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:IM.text3,letterSpacing:1.5}}>VCG v6.0 · IRON MAN EDITION ⚡</div>
    </div>
  )
}

function SH({title}:{title:string}){return <div style={{fontWeight:800,fontSize:14,color:IM.text,paddingLeft:4}}>{title}</div>}
