/* ---------- transmitter setup: autodetect, guided stick setup that cannot be left half-broken, switch capture ---------- */
const STICKS=FUNCS.filter(f=>f.kind==='stick'), SWITCHES=FUNCS.filter(f=>f.kind!=='stick');
const wiz={on:false,i:0,phase:'settle',base:null,baseB:null,prev:null,stable:0,t:0};
let swCap=null; // {id, base, baseB, t}
function fnAvailable(f){return !f.feature||AC.features[f.feature];}
function usedSrcs(exceptId){const u=new Set();if(!dev)return u;for(const k in dev.map){if(k!==exceptId&&dev.map[k].src)u.add(dev.map[k].src);}return u;}
function srcLabel(src){if(!src)return 'Not set';return (src[0]==='a'?'Axis ':'Button ')+src.slice(1);}
function detectChange(base,baseB,minA,skip){let best=null,bd=minA,sign=0;padAxes.forEach((v,i)=>{if(skip.has('a'+i))return;const d=v-base[i];if(Math.abs(d)>bd){bd=Math.abs(d);best='a'+i;sign=Math.sign(d);}});padButtons.forEach((v,i)=>{if(skip.has('b'+i)||best)return;if(Math.abs(v-baseB[i])>0.5){best='b'+i;sign=v>baseB[i]?1:-1;}});return best?{src:best,sign}:null;}

function buildTx(){
  $('stickRows').innerHTML=STICKS.map(f=>`<div class="fnrow" data-fn="${f.id}"><span class="fnname">${f.name}<small id="st-${f.id}">Not set</small></span><div class="bar ctr"><i id="fb-${f.id}"></i></div><button class="btn mini" data-detect="${f.id}">Detect</button><button class="btn mini rev" data-inv="${f.id}">Normal</button></div>`).join('');
  $('switchRows').innerHTML=SWITCHES.map(f=>{const av=fnAvailable(f);return `<div class="fnrow${av?'':' off'}" data-fn="${f.id}"><span class="fnname">${f.name}<small id="st-${f.id}">${av?(f.desc+(f.hint?' · usually '+f.hint:'')):'not fitted on this aircraft'}</small></span><span class="chip" id="chip-${f.id}">Not set</span><button class="btn mini" data-set="${f.id}"${av?'':' disabled'}>Set</button><button class="btn mini" data-clear="${f.id}"${av?'':' disabled'}>Clear</button></div>`;}).join('');
  $('txCard').addEventListener('click',e=>{
    const d=e.target.closest('[data-detect]'),i=e.target.closest('[data-inv]'),s=e.target.closest('[data-set]'),c=e.target.closest('[data-clear]');
    if(!dev&&(d||i||s||c)){txHint('No transmitter detected. Plug in the sim cable and move a stick.','warn');return;}
    if(d){startWizard(STICKS.findIndex(f=>f.id===d.dataset.detect),true);}
    if(i){const m=dev.map[i.dataset.inv];if(!m.src){txHint('Detect '+FUNC[i.dataset.inv].name+' first.','warn');return;}m.inv=!m.inv;saveDevices();txHint(FUNC[i.dataset.inv].name+' is now '+(m.inv?'reversed':'normal')+'. Check the plane.','good');}
    if(s){startSwitch(s.dataset.set);}
    if(c){dev.map[c.dataset.clear]={src:null,inv:false,on:1};saveDevices();txHint(FUNC[c.dataset.clear].name+' cleared.','');}
  });
}
function txHint(t,kind){const h=$('txHint');h.textContent=t;h.className='hint '+(kind||'');}

/* stick monitor: draws both gimbals the way the TX screen would, from the MAPPED values */
const smc=$('stickMon').getContext('2d');
function drawStickMon(){const W=200,H=92;smc.clearRect(0,0,W,H);
  const g=(x0,lx,ly,lab)=>{smc.strokeStyle='#45515F';smc.lineWidth=1;smc.strokeRect(x0+0.5,6.5,78,78);smc.beginPath();smc.moveTo(x0+39.5,6);smc.lineTo(x0+39.5,85);smc.moveTo(x0,45.5);smc.lineTo(x0+79,45.5);smc.stroke();
    const px=x0+39.5+lx*36,py=45.5-ly*36;smc.fillStyle='#F26522';smc.beginPath();smc.arc(px,py,6,0,Math.PI*2);smc.fill();smc.fillStyle='#A3AEBA';smc.font='9px IBM Plex Mono,monospace';smc.fillText(lab,x0+2,H-1);};
  g(10,IN.rawRud,IN.rawThr*2-1,'THR / RUD');g(110,IN.rawAil,IN.rawEle,'ELE / AIL');}

function refreshTx(){
  if($('txCard').hidden)return;
  $('txDevice').textContent=pad?pad.id.slice(0,64):'No transmitter detected';
  $('txMeta').textContent=pad?padAxes.length+' axes, '+padButtons.length+' buttons detected · '+stickCount()+' of 4 sticks mapped':'Plug in the FlySky sim cable, switch the transmitter on, move a stick. On a phone, USB OTG works with Chrome on Android.';
  STICKS.forEach(f=>{const m=dev&&dev.map[f.id];$('st-'+f.id).textContent=m&&m.src?srcLabel(m.src)+(m.inv?' · reversed':''):'Not set';
    const r=$('txCard').querySelector(`[data-inv="${f.id}"]`);r.textContent=m&&m.inv?'Reversed':'Normal';r.classList.toggle('on',!!(m&&m.inv));
    const bar=$('fb-'+f.id);let v=f.id==='ail'?IN.rawAil:f.id==='ele'?IN.rawEle:f.id==='rud'?IN.rawRud:IN.rawThr*2-1;bar.style.left=v<0?((v+1)/2*100)+'%':'50%';bar.style.width=(Math.abs(v)*50)+'%';
    const row=$('txCard').querySelector(`.fnrow[data-fn="${f.id}"]`);row.classList.toggle('cur',wiz.on&&STICKS[wiz.i]===f);row.classList.toggle('ok',!!(m&&m.src));});
  SWITCHES.forEach(f=>{const m=dev&&dev.map[f.id];const ch=$('chip-'+f.id);if(!m||!m.src){ch.textContent=swCap&&swCap.id===f.id?'Flip it now':'Not set';ch.className='chip'+(swCap&&swCap.id===f.id?' wait':'');return;}
    if(f.kind==='switch3'){const p=sw3(f.id);ch.textContent=srcLabel(m.src)+' · '+(f.id==='stab'?['Off','Assist','Level'][p]:['0°','15°','35°'][p]);ch.className='chip set';}
    else{const on=swOn(f.id);ch.textContent=srcLabel(m.src)+' · '+(on?'ON':'off');ch.className='chip set'+(on?(f.id==='cut'?' bad':' on'):'');}});
  const ax=$('txAxes');const n=padAxes.length+padButtons.length;if(ax.childElementCount!==n){ax.innerHTML=padAxes.map((v,i)=>`<div><span>A${i}</span><div class="bar ctr"><i id="rawa${i}"></i></div><b id="rawv${i}">0.00</b></div>`).join('')+padButtons.map((v,i)=>`<div><span>B${i}</span><div class="bar"><i id="rawb${i}"></i></div><b id="rawbv${i}">off</b></div>`).join('');}
  const used=usedSrcs(null);
  padAxes.forEach((v,i)=>{const e=$('rawa'+i);if(!e)return;const nv=normAxis(i);e.style.left=nv<0?((nv+1)/2*100)+'%':'50%';e.style.width=(Math.abs(nv)*50)+'%';$('rawv'+i).textContent=(v>=0?'+':'')+v.toFixed(2);e.parentNode.parentNode.classList.toggle('used',used.has('a'+i));});
  padButtons.forEach((v,i)=>{const e=$('rawb'+i);if(e){e.style.width=v>0.5?'100%':'0%';$('rawbv'+i).textContent=v>0.5?'on':'off';}});
  drawStickMon();
}
function updateTx(){if($('txCard').hidden)return;refreshTx();if(wiz.on)wizTick();if(swCap)swTick();}

/* guided stick setup. Direction comes from the way the user moved the stick, so it is right by construction. */
function startWizard(from,single){if(!pad){txHint('No transmitter detected yet. Move a stick on the transmitter, then try again.','warn');return;}
  swCap=null;wiz.on=true;wiz.single=!!single;wiz.i=Math.max(0,from||0);wizEnter('settle');$('wiz').hidden=false;}
function wizEnter(phase){wiz.phase=phase;wiz.t=performance.now();wiz.lastMove=wiz.t;wiz.prev=padAxes.slice();if(phase==='settle'){wiz.base=null;wiz.snap=null;}wizRender();}
function wizRender(){const f=STICKS[wiz.i];$('wizStep').textContent=wiz.single?'Detect '+f.name:'Stick '+(wiz.i+1)+' of 4';$('wizTitle').textContent=f.name;
  const m=dev.map[f.id];
  if(wiz.phase==='settle'){$('wizText').textContent='Centre the sticks and leave the throttle at the bottom.';$('wizBtns').innerHTML='<button class="btn mini" id="wizCancel">Cancel</button>';}
  else if(wiz.phase==='detect'){$('wizText').textContent=f.dir+'.';$('wizBtns').innerHTML='<button class="btn mini" id="wizCancel">Cancel</button>';}
  else if(wiz.phase==='hold'){$('wizText').innerHTML='Found it on <b>'+srcLabel(m.src)+'</b>'+(m.inv?', reversed to match':'')+'. Check the plane: '+f.expect+'. Now let go'+(f.id==='thr'?' and bring the throttle back down':'')+'.';$('wizBtns').innerHTML='<button class="btn mini primary" id="wizNext">Next</button><button class="btn mini" id="wizRedo">Redo</button><button class="btn mini" id="wizCancel">Cancel</button>';}
  const nx=$('wizNext'),rd=$('wizRedo'),cn=$('wizCancel');
  if(nx)nx.onclick=wizNext;if(rd)rd.onclick=()=>{dev.map[f.id]={src:null,inv:false,on:1};wizEnter('settle');};if(cn)cn.onclick=wizStop;
}
function wizStop(){wiz.on=false;$('wiz').hidden=true;txHint(stickCount()===4?'All four sticks are set. Move each stick and watch the plane.':'Setup paused. Mapped sticks work now; anything not set falls back to keyboard or touch.','');}
function wizNext(){if(wiz.single){wizStop();return;}wiz.i++;if(wiz.i>=STICKS.length){wiz.on=false;$('wiz').hidden=true;dev.sticksDone=true;saveDevices();showPad();txHint('All four sticks are set. Optional: set your switches below, then Fly.','good');return;}wizEnter('settle');}
function wizTick(){const f=STICKS[wiz.i];if(!pad)return;const now=performance.now();
  if(wiz.phase==='settle'){
    // keep a snapshot of the last still position; a big move away from it is taken as the answer even if it comes early
    let moving=false;padAxes.forEach((v,i)=>{if(Math.abs(v-wiz.prev[i])>0.03)moving=true;});wiz.prev=padAxes.slice();
    if(!wiz.snap||!moving&&now-wiz.lastMove>120){if(!moving)wiz.snap=padAxes.slice();wiz.snapB=padButtons.slice();}
    if(moving)wiz.lastMove=now;
    const early=wiz.snap&&detectChange(wiz.snap,wiz.snapB||padButtons,0.5,usedSrcs(f.id));
    if(early&&early.src[0]==='a'){wiz.base=wiz.snap;wiz.baseB=wiz.snapB||padButtons.slice();wiz.phase='detect';wizTick();return;}
    if(now-wiz.lastMove>350||now-wiz.t>3000){wiz.base=wiz.snap||padAxes.slice();wiz.baseB=padButtons.slice();wizEnter('detect');}return;}
  if(wiz.phase==='detect'){const d=detectChange(wiz.base,wiz.baseB,0.5,usedSrcs(f.id));
    if(d&&d.src[0]==='a'){dev.map[f.id]={src:d.src,inv:d.sign<0,on:1};saveDevices();beepOk();wizEnter('hold');}return;}
  if(wiz.phase==='hold'){const i=+dev.map[f.id].src.slice(1);if(now-wiz.t>500&&Math.abs(padAxes[i]-wiz.base[i])<0.25)wizNext();}
}
/* switches: capture which control and which way is ON */
function startSwitch(id){if(!pad){txHint('No transmitter detected yet.','warn');return;}wiz.on=false;$('wiz').hidden=true;swCap={id,base:padAxes.slice(),baseB:padButtons.slice(),t:performance.now()};const f=FUNC[id];txHint('Flip the switch you want for '+f.name+' to its ON position'+(f.kind==='switch3'?' (fully down, position 3)':'')+'. Waiting…','wait');}
function swTick(){const f=FUNC[swCap.id];const d=detectChange(swCap.base,swCap.baseB,0.4,usedSrcs(f.id));
  if(d){dev.map[f.id]={src:d.src,inv:false,on:d.sign>=0?1:-1};if(d.src[0]==='b')dev.map[f.id].on=1;saveDevices();beepOk();txHint(f.name+' set on '+srcLabel(d.src)+'. The chip shows its live state.','good');swCap=null;}
  else if(performance.now()-swCap.t>10000){txHint('Nothing moved. Tap Set and try again.','warn');swCap=null;}}
function beepOk(){if(audio&&G.sound)tone(1320,0.08,'sine',0.05);try{navigator.vibrate&&navigator.vibrate(20);}catch(e){}}
function onNewDevice(){if(G.flying&&$('overlay').hidden){say('New transmitter detected. Open Transmitter to set it up.','warn');return;}openTx(true);}
function openTx(auto){show('txCard');refreshTx();if(auto&&pad&&stickCount()<4)startWizard(0);}
