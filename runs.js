
// My Runs: GPS readings are only collected while this page is permitted to run.
let runState=null,runWatch=null,runTicker=null,runWake=null;
const RUN_ACTIVE_KEY='gym_lb_run_active_v4';
let runVoiceEnabled=localStorage.getItem('gym_lb_run_voice')!=='off';let runAudioContext=null;
function setRunVoice(v){runVoiceEnabled=!!v;localStorage.setItem('gym_lb_run_voice',v?'on':'off');if(!v&&'speechSynthesis'in window)window.speechSynthesis.cancel();}
function runUnlockAudio(){try{runAudioContext=runAudioContext||new(window.AudioContext||window.webkitAudioContext)();if(runAudioContext.state==='suspended')runAudioContext.resume().catch(()=>{})}catch{}}
function runChime(){if(!runAudioContext||runAudioContext.state!=='running')return;const t=runAudioContext.currentTime;[950,1250,1500].forEach((f,i)=>{const o=runAudioContext.createOscillator(),g=runAudioContext.createGain(),start=t+i*.19;o.type='square';o.frequency.value=f;g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(.35,start+.018);g.gain.exponentialRampToValueAtTime(.0001,start+.15);o.connect(g);g.connect(runAudioContext.destination);o.start(start);o.stop(start+.17)})}
function runSpeakKm(km,splitMs){if(!runVoiceEnabled)return;runChime();if(navigator.vibrate)navigator.vibrate([160,90,160]);if(!('speechSynthesis'in window))return;try{window.speechSynthesis.cancel();const secs=Math.max(1,Math.round(splitMs/1000)),min=Math.floor(secs/60),sec=secs%60;const msg=`Quilómetro ${km} concluído. Último quilómetro em ${min} minutos${sec?' e '+sec+' segundos':''}.`;const u=new SpeechSynthesisUtterance(msg);u.lang='pt-PT';u.rate=.94;u.volume=1;const voices=window.speechSynthesis.getVoices();const pt=voices.find(v=>v.lang.toLowerCase()==='pt-pt')||voices.find(v=>v.lang.toLowerCase().startsWith('pt'));if(pt)u.voice=pt;setTimeout(()=>{if(runVoiceEnabled)window.speechSynthesis.speak(u)},650)}catch{}}
function testRunVoice(){runUnlockAudio();runSpeakKm(1,360000)}

try{const saved=JSON.parse(localStorage.getItem(RUN_ACTIVE_KEY)||'null');if(saved?.started&&saved?.status==='running'){runState=saved;}}catch{}
function runFmtTime(ms){let t=Math.floor(Math.max(0,ms)/1000);return [Math.floor(t/3600),Math.floor(t/60)%60,t%60].map(v=>String(v).padStart(2,'0')).join(':')}
function runPaceFmt(distanceKm,ms){if(distanceKm<.05)return '--:--';const seconds=Math.round(ms/1000/distanceKm);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')}
function runDistanceMeters(a,b){const rad=Math.PI/180,R=6371000,lat=(b.lat-a.lat)*rad,lon=(b.lon-a.lon)*rad,x=Math.sin(lat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(lon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function runPersist(){if(runState)localStorage.setItem(RUN_ACTIVE_KEY,JSON.stringify(runState));else localStorage.removeItem(RUN_ACTIVE_KEY)}
function runGpsText(t){const el=document.getElementById('runGpsStatus');if(el)el.textContent=t}
function runPosition(pos){if(!runState||runState.status!=='running')return;const c=pos.coords,now=pos.timestamp||Date.now();if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude))return;if(!Number.isFinite(c.accuracy)||c.accuracy>35){runGpsText('À espera de sinal GPS mais preciso…');return}
const next={lat:c.latitude,lon:c.longitude,t:now,accuracy:c.accuracy};
if(runState.last){const dt=(now-runState.last.t)/1000;if(dt<=0)return;const meters=runDistanceMeters(runState.last,next);if(meters<3)return;if(meters/dt>7){runGpsText('Leitura GPS irregular ignorada');return}if(meters>Math.max(12,c.accuracy+runState.last.accuracy)){runGpsText('A validar precisão GPS…');return}runState.meters+=meters;
const completed=Math.floor(runState.meters/1000);runState.splits=runState.splits||[];
if(completed>runState.splits.length){const km=runState.splits.length+1;const elapsed=Math.max(0,Date.now()-runState.started),prior=km===1?0:runState.splits[km-2].elapsedMs;const splitMs=elapsed-prior;runState.splits.push({km,elapsedMs:elapsed,splitMs});runSpeakKm(km,splitMs)}
}
runState.last=next;runPersist();renderRuns();runGpsText('GPS ativo · precisão ~'+Math.round(c.accuracy)+' m')}
function runGpsError(err){runGpsText(err.code===1?'Localização recusada. Autoriza o GPS nas definições.':'Sem sinal GPS. Verifica a localização e o céu aberto.')}
function watchRun(){if(!runState||runState.status!=='running'||runWatch!==null)return;if(!navigator.geolocation){runGpsText('GPS indisponível neste dispositivo');return}runWatch=navigator.geolocation.watchPosition(runPosition,runGpsError,{enableHighAccuracy:true,maximumAge:0,timeout:20000})}
async function runAcquireWake(){if(!runState||document.hidden||!('wakeLock' in navigator))return;try{runWake=await navigator.wakeLock.request('screen')}catch{}}
function runReleaseWake(){if(runWake){runWake.release().catch(()=>{});runWake=null}}
function startRun(){if(runState){alert('Já tens uma corrida em curso.');return}if(!navigator.geolocation){alert('Este dispositivo não disponibiliza GPS ao navegador.');return}if(!window.isSecureContext){alert('O GPS exige HTTPS.');return}
runUnlockAudio();runState={started:Date.now(),meters:0,last:null,splits:[],status:'running'};runPersist();watchRun();runAcquireWake();runTicker=runTicker||setInterval(renderRuns,1000);renderRuns();runGpsText('A obter localização GPS…')}
function finishRun(){if(!runState)return;if(!confirm('Terminar e guardar esta corrida?'))return;const elapsed=Math.max(1000,Date.now()-runState.started),distanceKm=runState.meters/1000;
if(runWatch!==null){navigator.geolocation.clearWatch(runWatch);runWatch=null}runReleaseWake();
data.runs=data.runs||[];data.runs.unshift({id:'run-'+runState.started,date:new Date(runState.started).toISOString(),durationMs:elapsed,distanceKm:Number(distanceKm.toFixed(3)),splits:runState.splits||[],effort:Number(document.getElementById('runEffort').value)||null});save();runState=null;runPersist();if(runTicker){clearInterval(runTicker);runTicker=null}renderRuns();toast('Corrida guardada')}
function renderRuns(){const clock=document.getElementById('runClock');if(!clock)return;const elapsed=runState?Date.now()-runState.started:0,km=runState?runState.meters/1000:0;
clock.textContent=runFmtTime(elapsed);document.getElementById('runDistance').textContent=km.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});document.getElementById('runPace').textContent=runPaceFmt(km,elapsed);
document.getElementById('runLastSplit').textContent=runState?.splits?.length?runPaceFmt(1,runState.splits[runState.splits.length-1].splitMs):'--:--';
document.getElementById('runSpeed').textContent=(elapsed&&km?km/(elapsed/3600000):0).toLocaleString('pt-PT',{minimumFractionDigits:1,maximumFractionDigits:1});
document.getElementById('runVoiceEnabled').checked=runVoiceEnabled;
document.getElementById('runStart').disabled=!!runState;document.getElementById('runFinish').disabled=!runState;
if(!runState)runGpsText('Pronto para iniciar');
const runs=(data.runs||[]).slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
document.getElementById('runHistory').innerHTML=runs.length?runs.map(r=>`<div class="box runEntry"><div><b>${new Date(r.date).toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'})}</b><div class="hint">${runFmtTime(r.durationMs)} · ${runPaceFmt(r.distanceKm,r.durationMs)} min/km · ${(r.distanceKm/(r.durationMs/3600000)||0).toFixed(1).replace('.',',')} km/h${r.effort?' · Esforço '+r.effort+'/10':''}</div>${r.splits?.length?'<div class="runSplits">'+r.splits.map(sp=>'Km '+sp.km+': '+runPaceFmt(1,sp.splitMs)).join(' · ')+'</div>':''}</div><strong class="big accent">${Number(r.distanceKm).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})} km</strong></div>`).join(''):'<div class="box">Ainda não há corridas registadas.</div>'}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&runState){watchRun();runAcquireWake();renderRuns()}else if(document.hidden)runReleaseWake()});
window.addEventListener('pageshow',()=>{if(runState){watchRun();runAcquireWake();if(!runTicker)runTicker=setInterval(renderRuns,1000)}});
if(runState){watchRun();runTicker=setInterval(renderRuns,1000)}
