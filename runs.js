
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
// GPS: distinguish measured distance from missing tracking; never invent missing kilometres.
let runLastGpsAt=0,runLastGpsAccuracy=null,runWakeWarning='',runGpsIssue='',runWasHidden=false;
const RUN_GAP_MS=25000;
function runGpsStatus(){
 if(!runState)return 'Pronto para iniciar';
 const age=runLastGpsAt?Date.now()-runLastGpsAt:Date.now()-runState.started;
 if(document.hidden)return 'Ecrã em segundo plano · o Android pode suspender o GPS';
 if(age>RUN_GAP_MS)return '⚠ Sem atualizações GPS há '+Math.floor(age/1000)+' s. Distância possivelmente incompleta.';
 if(runGpsIssue)return runGpsIssue;
 return runLastGpsAccuracy!==null?'GPS ativo · precisão ~'+Math.round(runLastGpsAccuracy)+' m':'A obter localização GPS…';
}
function runPosition(pos){
 if(!runState||runState.status!=='running')return;
 const c=pos.coords,now=pos.timestamp||Date.now();
 if(!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||!Number.isFinite(c.accuracy))return;
 // A stale cached location is not evidence of current movement.
 if(now<Date.now()-15000){runGpsIssue='⚠ Leitura GPS antiga ignorada';return}
 runLastGpsAt=Date.now();runLastGpsAccuracy=c.accuracy;
 if(c.accuracy>60){runGpsIssue='Precisão GPS fraca (~'+Math.round(c.accuracy)+' m) · à espera de sinal';return}
 const next={lat:c.latitude,lon:c.longitude,t:now,accuracy:c.accuracy};
 if(runState.last){
  const dt=(now-runState.last.t)/1000;
  if(dt<=0)return;
  const meters=runDistanceMeters(runState.last,next);
  // After GPS gaps do not draw a straight line across unknown routes.
  if(dt>RUN_GAP_MS){runState.gaps=(runState.gaps||0)+1;runState.last=next;runGpsIssue='⚠ GPS retomado após interrupção; troço não contabilizado';runPersist();renderRuns();return}
  // Exclude obvious position jumps. Keep the previous point for a better fix.
  if(meters/dt>8.5||meters>Math.max(60,dt*8.5)){runGpsIssue='Leitura GPS irregular ignorada';return}
  // Ignore GPS jitter smaller than positional uncertainty, but advance anchor only on valid fixes.
  const threshold=Math.max(2,Math.min(8,(runState.last.accuracy+c.accuracy)*.12));
  if(meters>=threshold){
   runState.meters+=meters;
   const completed=Math.floor(runState.meters/1000);runState.splits=runState.splits||[];
   if(completed>runState.splits.length){const km=runState.splits.length+1,elapsed=Math.max(0,Date.now()-runState.started),prior=km===1?0:runState.splits[km-2].elapsedMs,splitMs=elapsed-prior;runState.splits.push({km,elapsedMs:elapsed,splitMs});runSpeakKm(km,splitMs)}
   runState.last=next;
  }
 }else runState.last=next;
 runGpsIssue='';runPersist();renderRuns();runGpsText(runGpsStatus());
}
function runGpsError(err){runGpsIssue=err.code===1?'⚠ Permissão GPS recusada':err.code===3?'⚠ GPS sem resposta; verifica a localização':'⚠ GPS indisponível; verifica o sinal';runGpsText(runGpsStatus())}
function watchRun(){if(!runState||runState.status!=='running'||runWatch!==null)return;if(!navigator.geolocation){runGpsIssue='GPS indisponível neste dispositivo';return}runWatch=navigator.geolocation.watchPosition(runPosition,runGpsError,{enableHighAccuracy:true,maximumAge:0,timeout:20000})}
async function runAcquireWake(){
 if(!runState||document.hidden)return;
 if(!('wakeLock' in navigator)){runWakeWarning='⚠ Manter ecrã ligado não é suportado neste navegador';renderRunWake();return}
 if(runWake)return;
 try{const lock=await navigator.wakeLock.request('screen');if(!runState||document.hidden){await lock.release();return}runWake=lock;runWakeWarning='';lock.addEventListener('release',()=>{if(runWake===lock)runWake=null;runWakeWarning='⚠ Ecrã ativo desativado pelo sistema';renderRunWake()})}
 catch(e){runWakeWarning='⚠ Não foi possível manter o ecrã ligado. Desativa a poupança de bateria e mantém a app aberta.'}
 renderRunWake();
}
function runReleaseWake(){const lock=runWake;runWake=null;if(lock)lock.release().catch(()=>{});renderRunWake()}
function renderRunWake(){const el=document.getElementById('runWakeStatus');if(!el)return;el.textContent=!runState?'':runWake?'☀ Ecrã mantido ativo (enquanto o sistema permitir)':runWakeWarning||'A ativar manutenção do ecrã…'}
function startRun(){if(runState){alert('Já tens uma corrida em curso.');return}if(!navigator.geolocation){alert('Este dispositivo não disponibiliza GPS ao navegador.');return}if(!window.isSecureContext){alert('O GPS exige HTTPS.');return}
 runUnlockAudio();runLastGpsAt=0;runLastGpsAccuracy=null;runGpsIssue='';runWakeWarning='';runState={started:Date.now(),meters:0,last:null,splits:[],gaps:0,status:'running'};runPersist();watchRun();runAcquireWake();runTicker=runTicker||setInterval(renderRuns,1000);renderRuns()}
function finishRun(){if(!runState)return;if(!confirm('Terminar e guardar esta corrida?'))return;const elapsed=Math.max(1000,Date.now()-runState.started),distanceKm=runState.meters/1000;
if(runWatch!==null){navigator.geolocation.clearWatch(runWatch);runWatch=null}runReleaseWake();
data.runs=data.runs||[];data.runs.unshift({id:'run-'+runState.started,date:new Date(runState.started).toISOString(),durationMs:elapsed,distanceKm:Number(distanceKm.toFixed(3)),splits:runState.splits||[],effort:Number(document.getElementById('runEffort').value)||null,gpsGaps:runState.gaps||0});save();runState=null;runPersist();if(runTicker){clearInterval(runTicker);runTicker=null}renderRuns();toast('Corrida guardada')}
function renderRuns(){const clock=document.getElementById('runClock');if(!clock)return;const elapsed=runState?Date.now()-runState.started:0,km=runState?runState.meters/1000:0;
clock.textContent=runFmtTime(elapsed);document.getElementById('runDistance').textContent=km.toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2});document.getElementById('runPace').textContent=runPaceFmt(km,elapsed);
document.getElementById('runLastSplit').textContent=runState?.splits?.length?runPaceFmt(1,runState.splits[runState.splits.length-1].splitMs):'--:--';
document.getElementById('runSpeed').textContent=(elapsed&&km?km/(elapsed/3600000):0).toLocaleString('pt-PT',{minimumFractionDigits:1,maximumFractionDigits:1});
document.getElementById('runVoiceEnabled').checked=runVoiceEnabled;
document.getElementById('runStart').disabled=!!runState;document.getElementById('runFinish').disabled=!runState;
runGpsText(runGpsStatus());renderRunWake();
const runs=(data.runs||[]).slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
document.getElementById('runHistory').innerHTML=runs.length?runs.map(r=>`<div class="box runEntry"><div><b>${new Date(r.date).toLocaleDateString('pt-PT',{day:'2-digit',month:'short',year:'numeric'})}</b><div class="hint">${runFmtTime(r.durationMs)} · ${runPaceFmt(r.distanceKm,r.durationMs)} min/km · ${(r.distanceKm/(r.durationMs/3600000)||0).toFixed(1).replace('.',',')} km/h${r.effort?' · Esforço '+r.effort+'/10':''}</div>${r.splits?.length?'<div class="runSplits">'+r.splits.map(sp=>'Km '+sp.km+': '+runPaceFmt(1,sp.splitMs)).join(' · ')+'</div>':''}</div><strong class="big accent">${Number(r.distanceKm).toLocaleString('pt-PT',{minimumFractionDigits:2,maximumFractionDigits:2})} km</strong></div>`).join(''):'<div class="box">Ainda não há corridas registadas.</div>'}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&runState){if(runWasHidden){runState.last=null;runState.gaps=(runState.gaps||0)+1;runGpsIssue='⚠ App retomada; verifica se faltam quilómetros';runWasHidden=false;runPersist()}watchRun();runAcquireWake();renderRuns()}else if(document.hidden&&runState){runWasHidden=true;runReleaseWake()}});
window.addEventListener('pageshow',()=>{if(runState){watchRun();runAcquireWake();if(!runTicker)runTicker=setInterval(renderRuns,1000)}});
if(runState){runLastGpsAt=0;runGpsIssue='⚠ Corrida recuperada; a distância durante a interrupção pode estar em falta';runState.last=null;watchRun();runTicker=setInterval(renderRuns,1000)}
