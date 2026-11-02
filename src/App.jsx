
import React,{useEffect,useRef,useState} from 'react';
import {Activity,LayoutDashboard,History,Settings,Thermometer, Droplets,ShieldCheck,AlertTriangle,Wifi,Bell,Download,Menu, X, RefreshCw, Server, Gauge} from 'lucide-react';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer,AreaChart,Area} from 'recharts';
import { supabase, isSupabaseConfigured } from './supabase';

const nav=[['monitor','Monitoring',LayoutDashboard],['history','Riwayat Monitoring',History],['settings','Pengaturan & Notifikasi',Settings]];
const stamp=()=>new Date().toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'medium'});
const initialHistory=()=>Array.from({length:12},(_,i)=>({time:new Date(Date.now()-(11-i)*5*60000).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),temp:+(23.8+Math.sin(i)*.6).toFixed(1),hum:+(47+Math.cos(i)*3).toFixed(1),status:'NORMAL'}));
const mapDbRow=row=>({time:new Date(row.recorded_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),temp:Number(row.temperature),hum:Number(row.humidity),status:row.status,recordedAt:row.recorded_at});

export default function App(){
 const [page,setPage]=useState('monitor'),[mobile,setMobile]=useState(false);
 const [bounds,setBounds]=useState({tmin:18,tmax:25,hmin:30,hmax:60}),[form,setForm]=useState(bounds);
 const [mode,setMode]=useState('normal'),[reading,setReading]=useState({temp:23.8,hum:48}),[history,setHistory]=useState(initialHistory),[last,setLast]=useState(stamp());
 const [alerts,setAlerts]=useState([{time:stamp(),title:'Sistem simulasi dimulai',detail:'Dashboard prototype SMART CSSD aktif.',kind:'info'}]),[toast,setToast]=useState('');
 const [dbState,setDbState]=useState(isSupabaseConfigured?'Menghubungkan...':'Belum dikonfigurasi');
 const [soundEnabled,setSoundEnabled]=useState(false);
 const audioContextRef=useRef(null);
 const status=reading.temp<bounds.tmin||reading.temp>bounds.tmax||reading.hum<bounds.hmin||reading.hum>bounds.hmax?'WARNING':'NORMAL';
 const playAlarmPair=()=>{
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass)return;
  if(!audioContextRef.current)audioContextRef.current=new AudioContextClass();
  const ctx=audioContextRef.current;
  if(ctx.state==='suspended')ctx.resume();
  [0,0.28].forEach(offset=>{
   const osc=ctx.createOscillator();
   const gain=ctx.createGain();
   const start=ctx.currentTime+offset;
   osc.type='sine';
   osc.frequency.setValueAtTime(880,start);
   gain.gain.setValueAtTime(0.0001,start);
   gain.gain.exponentialRampToValueAtTime(0.16,start+0.02);
   gain.gain.exponentialRampToValueAtTime(0.0001,start+0.18);
   osc.connect(gain);gain.connect(ctx.destination);
   osc.start(start);osc.stop(start+0.2);
  });
 };
 const toggleAlarm=async()=>{
  if(soundEnabled){setSoundEnabled(false);return;}
  const AudioContextClass=window.AudioContext||window.webkitAudioContext;
  if(!AudioContextClass){notify('Browser tidak mendukung alarm audio.');return;}
  try{
   if(!audioContextRef.current)audioContextRef.current=new AudioContextClass();
   await audioContextRef.current.resume();
   setSoundEnabled(true);
   notify('Alarm suara diaktifkan.');
  }catch{notify('Audio belum diizinkan oleh browser.');}
 };
 useEffect(()=>{
  if(status!=='WARNING'||!soundEnabled)return;
  playAlarmPair();
  const id=setInterval(playAlarmPair,1400);
  return()=>clearInterval(id);
 },[status,soundEnabled]);

 useEffect(()=>{
  let active=true;
  if(!supabase){setDbState('Belum dikonfigurasi');return()=>{active=false};}
  setDbState('Menghubungkan...');
  supabase.from('monitoring_data').select('id, recorded_at, temperature, humidity, status').order('recorded_at',{ascending:false}).limit(24)
   .then(({data,error})=>{
    if(!active)return;
    if(error){setDbState('Gagal membaca database');return;}
    if(data?.length){const rows=data.map(mapDbRow).reverse();setHistory(rows);setReading({temp:rows[rows.length-1].temp,hum:rows[rows.length-1].hum});setLast(stamp());}
    setDbState('Terhubung ke Supabase');
   });
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  let id=setInterval(async()=>{
   let t=23.5+Math.random(),h=45+Math.random()*6;
   if(mode==='highT')t=26+Math.random();
   if(mode==='lowT')t=16+Math.random();
   if(mode==='highH')h=64+Math.random()*4;
   if(mode==='lowH')h=24+Math.random()*4;
   let r={temp:+t.toFixed(1),hum:+h.toFixed(1)};
   const readingStatus=r.temp<bounds.tmin||r.temp>bounds.tmax||r.hum<bounds.hmin||r.hum>bounds.hmax?'WARNING':'NORMAL';
   const tm=new Date().toLocaleTimeString('id-ID');
   const sample={time:tm,temp:r.temp,hum:r.hum,status:readingStatus};
   setReading(r);
   setHistory(old=>[...old.slice(-23),sample]);
   setLast(stamp());
   if(supabase){
    const {error}=await supabase.from('monitoring_data').insert({temperature:r.temp,humidity:r.hum,status:readingStatus});
    if(error)setDbState('Gagal menyimpan data');else setDbState('Terhubung ke Supabase');
   }
   if(readingStatus==='WARNING')setAlerts(old=>old[0]?.kind==='warning'?old:[{time:stamp(),title:'Peringatan kondisi lingkungan',detail:`Suhu ${r.temp}°C • Kelembapan ${r.hum}% RH`,kind:'warning'},...old].slice(0,20));
  },4000);
  return()=>clearInterval(id);
 },[mode,bounds]);
 const notify=s=>{setToast(s);setTimeout(()=>setToast(''),2500)};
 const exportCSV=()=>{let csv='Waktu,Suhu (C),Kelembapan (% RH)\\n'+history.map(x=>`${x.time},${x.temp},${x.hum}`).join('\\n');let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='riwayat-smart-cssd.csv';a.click();notify('CSV berhasil disiapkan')};
 const current=nav.find(x=>x[0]===page);
 return <div className="shell">
  <aside className={mobile?'sidebar open':'sidebar'}><div className="brand"><div className="logo"><Activity/></div><div><b>SMART CSSD</b><small>ENVIRONMENT MONITORING</small></div><button className="close" onClick={()=>setMobile(false)}><X/></button></div>
   <div className="room"><i/> <div><b>Ruang Penyimpanan</b><small>Instrumen Steril</small></div></div><label className="navlabel">MENU UTAMA</label>
   {nav.map(([id,label,Icon])=><button key={id} className={'nav '+(page===id?'selected':'')} onClick={()=>{setPage(id);setMobile(false)}}><Icon size={18}/>{label}</button>)}
   <div className="sidebottom"><div className="simside"><Wifi size={17}/><div><b>Mode Simulasi</b><small>Data contoh aktif</small></div><i/></div><small>SMART CSSD · Prototype v1.0</small></div>
  </aside>
  {mobile&&<div className="scrim" onClick={()=>setMobile(false)}/>}
  <main><header><div className="headleft"><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div><small>SMART CSSD / {current[1].toUpperCase()}</small><h1>{current[1]}</h1></div></div><div className="headright"><span>{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span><button onClick={()=>setPage('settings')}><Bell size={18}/></button><b className="avatar">C</b></div></header>
  <div className="content"><div className="banner"><Activity size={18}/><div><b>Mode demonstrasi — data simulasi</b><small>Nilai pada dashboard bukan data sensor aktual dari ruang CSSD.</small></div><strong>SIMULASI</strong></div>
  {page==='monitor'&&<><div className="intro"><div><h2>Ringkasan kondisi ruangan</h2><p>Pemantauan parameter lingkungan ruang penyimpanan instrumen steril.</p></div><small><RefreshCw size={13}/> Diperbarui: {last}</small></div>
   <div className="metrics"><Metric title="Suhu Ruangan" value={reading.temp.toFixed(1)} unit="°C" icon={Thermometer} range={`${bounds.tmin}–${bounds.tmax} °C`}/><Metric title="Kelembapan" value={reading.hum.toFixed(1)} unit="% RH" icon={Droplets} range={`${bounds.hmin}–${bounds.hmax}%`}/><div className={'status '+(status==='NORMAL'?'ok':'warn')}><div className="statusicon">{status==='NORMAL'?<ShieldCheck/>:<AlertTriangle/>}</div><div><small>STATUS LINGKUNGAN</small><b>{status}</b><p>{status==='NORMAL'?'Parameter dalam batas simulasi.':'Terdapat parameter di luar batas simulasi.'}</p></div></div></div>
   <div className="columns"><section className="panel"><PanelTitle title="Tren suhu & kelembapan" sub="Perubahan nilai pada sesi simulasi"/><div className="legend"><span>● Suhu (°C)</span><span>● Kelembapan (% RH)</span></div><div className="chart"><ResponsiveContainer><LineChart data={history}><CartesianGrid stroke="#edf1f6" vertical={false}/><XAxis dataKey="time" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Line dataKey="temp" name="Suhu" stroke="#246bb4" strokeWidth={2.5} dot={false}/><Line dataKey="hum" name="Kelembapan" stroke="#18a6b9" strokeWidth={2.5} dot={false}/></LineChart></ResponsiveContainer></div></section>
   <section className="panel"><PanelTitle title="Status perangkat" sub="Komponen rancangan Smart CSSD"/>{[['ESP32','Mikrokontroler','Aktif'],['Sensor SHT31','Pembacaan suhu & RH','Simulasi'],['OLED SSD1306','Tampilan lokal','Aktif'],['LED indikator',status==='NORMAL'?'LED hijau menyala':'LED merah menyala',status],['Buzzer','Alarm kondisi',status==='NORMAL'?'OFF':'ON']].map((x,i)=><div className="device" key={i}><span className="deviceicon">{i===0?<Server/>:i===2?<Gauge/>:<Activity/>}</span><div><b>{x[0]}</b><small>{x[1]}</small></div><em className={x[2]==='WARNING'?'bad':''}>{x[2]}</em></div>)}<p className="note">Koneksi Wi-Fi belum diintegrasikan pada prototype.</p></section></div>
   <section className="panel"><PanelTitle title="Kontrol skenario simulasi" sub="Pilih kondisi untuk melihat perubahan indikator dashboard."/><div className="scenarios">{[['normal','Normal'],['highT','Suhu tinggi'],['lowT','Suhu rendah'],['highH','Kelembapan tinggi'],['lowH','Kelembapan rendah']].map(x=><button className={mode===x[0]?'chosen':''} onClick={()=>setMode(x[0])} key={x[0]}>{x[1]}</button>)}</div></section>
  </>}
  {page==='history'&&<><div className="intro"><div><h2>Riwayat pengukuran</h2><p>Data suhu dan kelembapan selama simulasi berjalan.</p></div><button className="primary" onClick={exportCSV}><Download size={15}/> Ekspor CSV</button></div><div className="stats"><Stat label="Jumlah sampel" value={history.length}/><Stat label="Rata-rata suhu" value={(history.reduce((a,x)=>a+x.temp,0)/history.length).toFixed(1)+' °C'}/><Stat label="Rata-rata kelembapan" value={(history.reduce((a,x)=>a+x.hum,0)/history.length).toFixed(1)+'%'}/></div>
   <section className="panel"><PanelTitle title="Grafik suhu" sub="Riwayat pembacaan suhu (°C)"/><div className="chart tall"><ResponsiveContainer><AreaChart data={history}><defs><linearGradient id="fillt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#286fc2" stopOpacity={.22}/><stop offset="100%" stopColor="#286fc2" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf1f6" vertical={false}/><XAxis dataKey="time" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Area dataKey="temp" name="Suhu" stroke="#286fc2" fill="url(#fillt)"/></AreaChart></ResponsiveContainer></div></section>
   <section className="panel"><PanelTitle title="Grafik kelembapan" sub="Riwayat pembacaan kelembapan (% RH)"/><div className="chart tall"><ResponsiveContainer><AreaChart data={history}><defs><linearGradient id="fillh" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#18a6b9" stopOpacity={.22}/><stop offset="100%" stopColor="#18a6b9" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf1f6" vertical={false}/><XAxis dataKey="time" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Area dataKey="hum" name="Kelembapan" stroke="#18a6b9" fill="url(#fillh)"/></AreaChart></ResponsiveContainer></div></section>
   <section className="panel"><PanelTitle title="Tabel data pengukuran" sub="Sampel terbaru"/><div className="tablewrap"><table><thead><tr><th>Waktu</th><th>Suhu</th><th>Kelembapan</th><th>Status</th></tr></thead><tbody>{[...history].reverse().map((x,i)=><tr key={i}><td>{x.time}</td><td>{x.temp} °C</td><td>{x.hum} % RH</td><td><em className={x.status==='WARNING'?'bad':''}>{x.status||'NORMAL'}</em></td></tr>)}</tbody></table></div></section>
  </>}
  {page==='settings'&&<><div className="intro"><div><h2>Pengaturan sistem</h2><p>Atur batas parameter simulasi dan tinjau catatan peringatan.</p></div></div><div className="columns settingscols"><section className="panel"><PanelTitle title="Batas parameter lingkungan" sub="Nilai awal untuk keperluan simulasi prototype."/><h4>SUHU RUANGAN</h4><div className="fields"><label>Minimum (°C)<input type="number" value={form.tmin} onChange={e=>setForm({...form,tmin:e.target.value})}/></label><label>Maksimum (°C)<input type="number" value={form.tmax} onChange={e=>setForm({...form,tmax:e.target.value})}/></label></div><h4>KELEMBAPAN RELATIF</h4><div className="fields"><label>Minimum (% RH)<input type="number" value={form.hmin} onChange={e=>setForm({...form,hmin:e.target.value})}/></label><label>Maksimum (% RH)<input type="number" value={form.hmax} onChange={e=>setForm({...form,hmax:e.target.value})}/></label></div><p className="warningnote">Nilai ini merupakan parameter awal simulasi, bukan standar operasional final CSSD. Sesuaikan dengan SOP dan ketentuan yang berlaku sebelum penerapan nyata.</p><button className="primary" onClick={()=>{if(+form.tmin>=+form.tmax||+form.hmin>=+form.hmax){notify('Nilai minimum harus lebih kecil dari maksimum.');return}setBounds({tmin:+form.tmin,tmax:+form.tmax,hmin:+form.hmin,hmax:+form.hmax});notify('Pengaturan simulasi disimpan.')}}>Simpan pengaturan</button></section>
   <section className="panel"><PanelTitle title="Status koneksi" sub="Informasi konektivitas prototype"/><div className="settingrow"><span>Alarm suara dashboard</span><button className="primary" onClick={toggleAlarm}>{soundEnabled?'Matikan suara':'Aktifkan suara'}</button></div><p className="note">Jika diaktifkan, bunyi beep-beep akan berulang saat status WARNING dan berhenti saat kembali NORMAL.</p><div className="offline"><Wifi size={20}/><div><b>{dbState}</b><small>{isSupabaseConfigured?'Penyimpanan data simulasi melalui Supabase':'Periksa konfigurasi file .env'}</small></div><em>{dbState==='Terhubung ke Supabase'?'ONLINE':'CHECK'}</em></div>{[['Mode data','Simulasi lokal'],['Database',dbState],['Platform database','Supabase'],['Hosting','Vercel']].map(x=><div className="settingrow"><span>{x[0]}</span><b>{x[1]}</b></div>)}</section></div>
   <section className="panel"><PanelTitle title="Riwayat notifikasi" sub="Catatan perubahan status selama simulasi"/>{alerts.map((a,i)=><div className="alertrow" key={i}><span className={a.kind==='warning'?'alertbad':'alertinfo'}>{a.kind==='warning'?<AlertTriangle/>:<Activity/>}</span><div><b>{a.title}</b><small>{a.detail}</small></div><time>{a.time}</time></div>)}</section>
  </>}
  <footer>© 2026 SMART CSSD · Prototype IoT Monitoring <span>● Data simulasi</span></footer>
  </div></main>{toast&&<div className="toast">{toast}</div>}
 </div>
}
function Metric({title,value,unit,icon:Icon,range}){return <div className="metric"><div className="metrichead"><span><Icon/></span>{title}<small>LIVE</small></div><strong>{value}<i>{unit}</i></strong><div className="range">Batas simulasi <b>{range}</b></div></div>}
function PanelTitle({title,sub}){return <div className="paneltitle"><div><h3>{title}</h3><p>{sub}</p></div></div>}
function Stat({label,value}){return <div className="stat"><small>{label}</small><b>{value}</b><span>Data simulasi</span></div>}
