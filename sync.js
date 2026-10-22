import {firebaseConfig} from './firebase-config.js';
const state=document.getElementById('syncState'), msg=document.getElementById('syncMessage');
const login=document.getElementById('cloudLogin'),signed=document.getElementById('cloudSigned');
const status=(s,m='')=>{state.textContent=s;msg.textContent=m};
if(firebaseConfig.apiKey==='COLOCA_AQUI'||firebaseConfig.projectId==='COLOCA_AQUI'){
 status('Não configurado','A aplicação local funciona. Configura o Firebase para ativar a sincronização.');
}else{
 try{
  const [{initializeApp},{getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged},{getFirestore,doc,onSnapshot,setDoc,enableIndexedDbPersistence}] = await Promise.all([
   import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
  ]);
  const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
  enableIndexedDbPersistence(db).catch(()=>{});
  let unsub=null,user=null,timer=null,applying=false;
  const local=()=>{try{return JSON.parse(localStorage.getItem('gym_lb_v2'))||{plan:null,history:[],records:{}}}catch{return {plan:null,history:[],records:{}}}};
  const merge=(a,b,preferLocal=false)=>{
   const byId=new Map();
   for(const h of (b.history||[]))byId.set(h.date+'|'+h.name,h);
   for(const h of (a.history||[]))byId.set(h.date+'|'+h.name,h);
   return {plan:(preferLocal?a.plan:b.plan)||a.plan||b.plan||null,
    records:{...(b.records||{}),...(a.records||{})},
    history:[...byId.values()].sort((x,y)=>String(y.date).localeCompare(String(x.date)))};
  };
  async function push(){
   if(!user||applying)return;
   if(!navigator.onLine){status('Offline','Dados guardados localmente.');return}
   try{
    const payload=local();
    if(new Blob([JSON.stringify(payload)]).size>850000){status('Limite próximo','Exporta um backup; o histórico aproxima-se do limite do Firestore.');return}
    status('A sincronizar');
    await setDoc(doc(db,'users',user.uid),{data:payload,updatedAt:Date.now()});
    localStorage.removeItem('gym_lb_sync_dirty');
    status('Sincronizado','Os teus dados estão disponíveis nos dois dispositivos.');
   }catch(e){localStorage.setItem('gym_lb_sync_dirty','1');status('Pendente',e.code||'Sem ligação. Dados locais preservados.')}
  }
  const schedule=()=>{if(!user||applying)return;localStorage.setItem('gym_lb_sync_dirty','1');clearTimeout(timer);timer=setTimeout(push,1400)};
  window.addEventListener('gym-lb-data-changed',schedule);
  window.addEventListener('online',()=>{if(user)push()});
  const updateUI=()=>{login.classList.toggle('hidden',!!user);signed.classList.toggle('hidden',!user);document.getElementById('syncUser').textContent=user?.email||''};
  window.gymCloud={
   signUp:async()=>{try{await createUserWithEmailAndPassword(auth,document.getElementById('syncEmail').value,document.getElementById('syncPassword').value)}catch(e){status('Erro',e.code||e.message)}},
   signIn:async()=>{try{await signInWithEmailAndPassword(auth,document.getElementById('syncEmail').value,document.getElementById('syncPassword').value)}catch(e){status('Erro',e.code||e.message)}},
   signOut:async()=>{await signOut(auth)},syncNow:push
  };
  onAuthStateChanged(auth,u=>{
   if(unsub){unsub();unsub=null}clearTimeout(timer);user=u;updateUI();
   if(!u){status('Sem sessão','Os treinos continuam guardados neste dispositivo.');return}
   status('A ligar');
   unsub=onSnapshot(doc(db,'users',u.uid),snap=>{
    if(!user||user.uid!==u.uid)return;
    if(!snap.exists()){push();return}
    const incoming=snap.data().data;
    if(!incoming||!Array.isArray(incoming.history))return;
    const before=local(),dirty=localStorage.getItem('gym_lb_sync_dirty')==='1';
    const merged=merge(before,incoming,dirty);
    const changed=JSON.stringify(merged)!==JSON.stringify(before);
    applying=true;
    if(changed){
     localStorage.setItem('gym_lb_v2',JSON.stringify(merged));
     if(typeof data!=='undefined')data=merged;
     if(typeof renderHome==='function')renderHome();
     if(typeof renderHistory==='function')renderHistory();
    }
    applying=false;status('Sincronizado');
    if(dirty||JSON.stringify(merged)!==JSON.stringify(incoming))setTimeout(push,100);
   },e=>status('Erro de acesso',e.code||e.message));
  });
 }catch(e){status('Indisponível','Não foi possível carregar Firebase. A app local continua funcional.')}
}
