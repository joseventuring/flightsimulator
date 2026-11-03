/* ---------- screens (game-ui-ux: a screen stack, focus per screen) ---------- */
const SCREENS=['menuCard','hangarCard','txCard','preCard','crashCard','landCard','winCard','logCard','pauseCard'];
const SIDE=new Set(['hangarCard','txCard','preCard']);   // docked right, scene stays visible with the hangar camera
let screenStack=[];
function show(id,push){const ov=$('overlay');ov.hidden=false;SCREENS.forEach(c=>$(c).hidden=c!==id);ov.classList.toggle('side',SIDE.has(id));document.body.classList.toggle('hangar',SIDE.has(id));G.view=SIDE.has(id)?'hangar':'fly';if(push!==false)screenStack.push(id);const b=$(id).querySelector('.btn.primary')||$(id).querySelector('.btn');if(b)setTimeout(()=>b.focus(),30);if(id==='txCard')refreshTx();}
function hide(){$('overlay').hidden=true;$('overlay').classList.remove('side');document.body.classList.remove('hangar');G.view='fly';screenStack=[];}
function back(){screenStack.pop();const prev=screenStack.pop();if(prev)show(prev);else if(G.paused)show('pauseCard');else if(G.landed)show('landCard');else if(G.crashed)show('crashCard');else if(G.started)hide();else show('menuCard');}
function togglePause(){if(!G.started||G.crashed||G.landed)return;if(G.paused){G.paused=false;hide();last=performance.now();}else if($('overlay').hidden){G.paused=true;show('pauseCard');}}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.started&&!G.paused&&$('overlay').hidden&&!G.crashed&&!G.landed){G.paused=true;show('pauseCard');}});
function fmtTime(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function save(){store.set('jgsim.log',logbook);}
function saveSettings(){store.set('jgsim.settings',settings);}
function reset(){
  st=Sim.create();G.crashed=false;G.landed=false;G.paused=false;G.trauma=0;G.viol=0;G.flightStart=0;G.flying=false;kThr=0;touch.l.y=-1;$('stL').querySelector('.nub').style.transform='translate(0px,48px)';
  MSG.length=0;for(const k in cool)delete cool[k];renderMarshal();
  gate.i=0;gate.running=false;gate.lastD=0;gateMeshes.forEach(m=>m.material=gateDim);if(gateMeshes[0])gateMeshes[0].material=gateM;
  gateObjs.forEach(g=>g.grp.visible=G.mode==='gates');$('gatebox').style.display=G.mode==='gates'?'flex':'none';
  camPos.set(0,1.2,3);
  if(G.started){hide();say('On the strip. RWY 00, wind '+settings.wdir+'° at '+settings.wind+' m/s.','', 'rwy',0);}else show('menuCard');
}
function startFlight(){G.started=true;G.flying=true;hide();if(!audio)initAudio();if(audio&&audio.ctx.state==='suspended')audio.ctx.resume();say('Cleared to taxi. RWY 00, wind '+settings.wdir+'° at '+settings.wind+' m/s. Keep it in front of the line.','good');}
function endFlight(kind,why){
  const air=st.time-G.flightStart;G.flying=false;
  logbook.flights++;logbook.airtime+=air;if(air>logbook.longest)logbook.longest=air;
  if(kind==='crash'){logbook.crashes++;G.crashed=true;G.lastCrash=why;feedback('large',st.pos.x,Math.max(st.pos.y,0.05),st.pos.z);thud(1);$('crashWhy').textContent=why;$('crashTime').textContent=fmtTime(air);$('crashSpd').textContent=Math.round(st.maxV*3.6);$('crashAlt').textContent=st.maxAlt.toFixed(0);setTimeout(()=>{if(G.crashed)show('crashCard');},reduceMotion?0:650);if(audio)audio.motor.gain.setTargetAtTime(0,audio.ctx.currentTime,0.05);}
  else{G.landed=true;const td=st.touchdown||{sink:0,speed:0};let grade='Greaser.';if(td.sink>1.8){grade='Hard landing, but it lives.';logbook.hard++;}else if(td.sink>1.0){grade='Firm landing.';logbook.firm++;}else logbook.landings++;$('landWhy').textContent=grade+' Touched down at '+(td.speed*3.6).toFixed(0)+' km/h, sink '+td.sink.toFixed(1)+' m/s.';$('landTime').textContent=fmtTime(air);$('landSink').textContent=td.sink.toFixed(1);$('landViol').textContent=G.viol;show('landCard');}
  save();
}
function checkGate(){
  const g=gateObjs[gate.i]; if(!g) return;
  const rel=st.pos.clone().sub(g.pos);const d=rel.dot(g.n);const lateral=rel.clone().addScaledVector(g.n,-d).length();
  if((gate.lastD<0&&d>=0||gate.lastD>0&&d<=0)&&lateral<3.3){
    if(!gate.running){gate.running=true;gate.t0=st.time;}
    gateMeshes[gate.i].material=gateDone;if(!reduceMotion)tween(gateMeshes[gate.i],1.25,1,0.35,easeOutBack);chime();gate.i++;say('Gate '+gate.i+' of '+gateObjs.length+'.','good');
    if(gate.i<gateObjs.length)gateMeshes[gate.i].material=gateM;
    else{const t=st.time-gate.t0;gate.running=false;if(logbook.bestGate===null||t<logbook.bestGate)logbook.bestGate=t;save();$('winTime').textContent=t.toFixed(2);$('winBest').textContent=logbook.bestGate.toFixed(2);$('winViol').textContent=G.viol;show('winCard');}
  }
  gate.lastD=d;
}

/* ---------- camera (camera-systems): pilot, chase, FPV, hangar ---------- */
const camPos=new THREE.Vector3(0,1.2,3),camLook=new THREE.Vector3();
const FWD=new THREE.Vector3(0,0,-1);
let hangarAngle=0;
function cycleCam(){G.cam=G.cam==='pilot'?'chase':G.cam==='chase'?'fpv':'pilot';$('bCam').textContent='Cam: '+(G.cam==='pilot'?'Pilot':G.cam==='chase'?'Chase':'FPV');}
function updateCamera(dt){
  if(G.view==='hangar'){hangarAngle+=dt*0.12;const a=-0.9+Math.sin(hangarAngle)*0.35;const target=st.pos.clone().add(new THREE.Vector3(0,0.02,0));const want=new THREE.Vector3(Math.sin(a)*1.9,0.55,Math.cos(a)*1.9).add(target);camPos.lerp(want,1-Math.exp(-dt*3));camera.position.copy(camPos);camera.lookAt(target);camera.fov=38;const W=canvas.clientWidth,H=canvas.clientHeight;if(W>620)camera.setViewOffset(W,H,W*0.24,0,W,H);else camera.clearViewOffset();camera.updateProjectionMatrix();return;}
  if(camera.view&&camera.view.enabled)camera.clearViewOffset();
  if(G.cam==='pilot'){camera.position.copy(PILOT_EYE);camLook.lerp(st.pos,1-Math.exp(-dt*14));camera.lookAt(camLook);const d=PILOT_EYE.distanceTo(st.pos);camera.fov=clamp(44*14/Math.max(d,14),7,44);camera.updateProjectionMatrix();}
  else if(G.cam==='chase'){const target=new THREE.Vector3(0,0.5,2.2).applyQuaternion(st.q).add(st.pos);camPos.lerp(target,1-Math.exp(-dt*5));camPos.y=Math.max(camPos.y,0.25);camera.position.copy(camPos);const lead=st.vel.clone().multiplyScalar(0.12);camera.lookAt(st.pos.clone().addScaledVector(FWD.clone().applyQuaternion(st.q),2).add(lead));camera.fov=55;camera.updateProjectionMatrix();}
  else{camera.position.copy(new THREE.Vector3(0,0.09,-0.2).applyQuaternion(st.q).add(st.pos));camera.quaternion.copy(st.q);camera.fov=80;camera.updateProjectionMatrix();}
  if(G.trauma>0&&!reduceMotion){G.trauma=Math.max(0,G.trauma-1.4*dt);const sh=G.trauma*G.trauma,t=performance.now()/1000*30;if(G.cam!=='pilot'){camera.rotation.z+=0.06*sh*Math.sin(t*1.1);camera.rotation.x+=0.03*sh*Math.sin(t*1.7);}else{camera.fov*=1+0.02*sh*Math.sin(t*1.3);camera.updateProjectionMatrix();}}
  const buffet=st.stall*0.004*(G.cam==='fpv'?1:0);if(buffet>0&&!reduceMotion){camera.rotation.z+=buffet*Math.sin(performance.now()/1000*40);}
}

/* ---------- preflight ---------- */
function updatePreflight(){
  if($('preCard').hidden)return;
  const p=G.preflight;
  $('pf-thr-v').textContent=Math.round(IN.rawThr*100)+'%';$('pf-thr').classList.toggle('done',IN.rawThr<0.05);
  if(IN.rawAil>0.7)p.ail=true;if(IN.rawEle>0.7)p.ele=true;if(IN.rawRud>0.7)p.rud=true;
  $('pf-ail').classList.toggle('done',p.ail);$('pf-ele').classList.toggle('done',p.ele);$('pf-rud').classList.toggle('done',p.rud);
  $('pf-wind-v').textContent=settings.wdir+'° at '+settings.wind+' m/s, RWY 00';
  $('pf-wind').classList.toggle('done',p.wind);
  $('pf-tx-v').textContent=pad?(dev&&dev.done?'mapped':'needs setup'):'keyboard or touch';$('pf-tx').classList.toggle('done',!pad||(dev&&dev.done));
  const all=IN.rawThr<0.05&&p.ail&&p.ele&&p.rud&&(!pad||(dev&&dev.done));$('bClear').disabled=!all;
}
$('pf-wind').addEventListener('click',()=>{G.preflight.wind=true;});

/* ---------- hangar ---------- */
function showHangar(){$('sheet').innerHTML=SHEET.map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join('');show('hangarCard');}

/* ---------- telemetry overlay modes ---------- */
const TELE=['full','minimal','off'];
function cycleTelemetry(){settings.tele=TELE[(TELE.indexOf(settings.tele||'full')+1)%3];applyTelemetry();saveSettings();}
function applyTelemetry(){const m=settings.tele||'full';$('hud').classList.toggle('minimal',m==='minimal');$('hud').classList.toggle('hidden',m==='off');$('bTele').textContent='Telemetry: '+m;}

/* ---------- logbook ---------- */
function showLog(){const L=logbook;$('logStats').innerHTML=[['Flights',L.flights],['Airtime',fmtTime(L.airtime)],['Longest',fmtTime(L.longest)],['Greasers',L.landings],['Firm',L.firm],['Hard',L.hard],['Crashes',L.crashes],['Violations',L.violations],['Best course',L.bestGate===null?'none':L.bestGate.toFixed(1)+' s']].map(([k,v])=>`<div><span class="lbl">${k}</span><b>${v}</b></div>`).join('');show('logCard');}

/* ---------- wiring ---------- */
$('bFly').addEventListener('click',()=>{G.started=true;if(!audio)initAudio();if(audio&&audio.ctx.state==='suspended')audio.ctx.resume();show('preCard');});
$('bHangar').addEventListener('click',showHangar);
$('bMenuTx').addEventListener('click',()=>openTx(false));
$('bMenuLog').addEventListener('click',showLog);
$('bTouch').addEventListener('click',()=>{setSticks(true);G.started=true;startFlight();});
$('bMenuSettings').addEventListener('click',()=>{$('drawer').hidden=false;});
$('bHangarFly').addEventListener('click',()=>{G.started=true;show('preCard');});
$('bHangarBack').addEventListener('click',back);
$('bTxWizard').addEventListener('click',startWizard);
$('bTxBack').addEventListener('click',()=>{wiz.on=false;$('wiz').hidden=true;$('fnTable').classList.remove('dim');back();});
$('bClear').addEventListener('click',startFlight);
$('bSkipPre').addEventListener('click',startFlight);
$('bPreTx').addEventListener('click',()=>openTx(false));
$('bAgain').addEventListener('click',reset);
$('bLandAgain').addEventListener('click',reset);
$('bLandLog').addEventListener('click',showLog);
$('bWinGo').addEventListener('click',hide);
$('bWinAgain').addEventListener('click',reset);
$('bCam').addEventListener('click',cycleCam);
$('bTele').addEventListener('click',cycleTelemetry);
$('bMode').addEventListener('click',()=>{G.mode=G.mode==='free'?'gates':'free';$('bMode').textContent=G.mode==='free'?'Freefly':'Gates';reset();});
$('bSound').addEventListener('click',()=>{if(!audio)initAudio();if(audio&&audio.ctx.state==='suspended')audio.ctx.resume();G.sound=!G.sound;$('bSound').textContent='Sound '+(G.sound?'on':'off');});
$('bPause').addEventListener('click',togglePause);$('bResume').addEventListener('click',togglePause);
$('bPauseTx').addEventListener('click',()=>openTx(false));$('bPauseLog').addEventListener('click',showLog);$('bPauseReset').addEventListener('click',reset);$('bPauseMenu').addEventListener('click',()=>{G.started=false;G.paused=false;G.flying=false;reset();});
$('bTx').addEventListener('click',()=>openTx(false));
$('bClose').addEventListener('click',()=>{$('drawer').hidden=true;});
$('bTrim0').addEventListener('click',()=>{trims.ail=trims.ele=trims.rud=0;store.set('jgsim.trims',trims);refreshTrims();});
$('bLogClose').addEventListener('click',back);
$('bLogClear').addEventListener('click',()=>{Object.assign(logbook,{flights:0,airtime:0,landings:0,firm:0,hard:0,crashes:0,violations:0,longest:0,bestGate:null});save();showLog();});
$('trims').addEventListener('click',e=>{const t=e.target.closest('[data-trim]');if(!t)return;const k=t.dataset.trim;trims[k]=clamp(Math.round((trims[k]+0.02*(+t.dataset.d))*100)/100,-0.3,0.3);store.set('jgsim.trims',trims);refreshTrims();});
function refreshTrims(){['ail','ele','rud'].forEach(k=>{$('trim-'+k).textContent=(trims[k]>0?'+':'')+Math.round(trims[k]*50);});}
const bind=(id,key,out,fmt)=>{const el=$(id);el.value=settings[key];$(out).textContent=fmt(settings[key]);el.addEventListener('input',e=>{settings[key]=+e.target.value;$(out).textContent=fmt(settings[key]);saveSettings();});};
bind('sRates','rates','oRates',v=>v+'%');bind('sExpo','expo','oExpo',v=>v+'%');bind('sLow','low','oLow',v=>v+'%');bind('sVol','vol','oVol',v=>v+'%');bind('sWind','wind','oWind',v=>v+' m/s');bind('sWdir','wdir','oWdir',v=>v+'°');bind('sGust','gust','oGust',v=>v+'%');
$('cShadow').checked=settings.shadow;
$('cSticks').addEventListener('change',e=>setSticks(e.target.checked));
$('cShadow').addEventListener('change',e=>{settings.shadow=e.target.checked;renderer.shadowMap.enabled=settings.shadow;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});saveSettings();});
buildTx();refreshTrims();applyTelemetry();
const coarse=matchMedia('(pointer:coarse)').matches&&!matchMedia('(min-width:900px)').matches;
if(settings.sticks||coarse)setSticks(true);
$('cSticks').checked=settings.sticks;
