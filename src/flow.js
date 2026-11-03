const on=(id,fn)=>{const el=$(id);if(el)el.addEventListener('click',fn);};
const onAll=(sel,fn)=>document.querySelectorAll(sel).forEach(el=>el.addEventListener('click',fn));
/* ---------- screens (game-ui-ux: a screen stack with Back, focus per screen) ---------- */
const SCREENS=['menuCard','hangarCard','txCard','preCard','crashCard','landCard','winCard','logCard','pauseCard','fieldCard','careerCard','purCard'];
const SIDE=new Set(['hangarCard','txCard','preCard']);   // docked right, the aircraft stays visible
let screenStack=[];
function show(id,push){const ov=$('overlay');ov.hidden=false;SCREENS.forEach(c=>$(c).hidden=c!==id);const side=SIDE.has(id);ov.classList.toggle('side',side);ov.classList.toggle('left',id==='menuCard');document.body.classList.toggle('hangar',side);document.body.classList.toggle('in-menu',!side);document.body.classList.toggle('pre',id==='preCard');G.view=side?'hangar':'fly';
  if(push!==false&&screenStack[screenStack.length-1]!==id)screenStack.push(id);const b=$(id).querySelector('.btn.primary')||$(id).querySelector('.btn');if(b&&!MOBILE)setTimeout(()=>b.focus({preventScroll:true}),30);$(id).scrollTop=0;if(id==='txCard')refreshTx();if(id==='menuCard')refreshMenu();if(id!=='hangarCard'&&!G.flying&&typeof loadedId!=='undefined'&&loadedId&&loadedId!==career.selected)loadPlayerAircraft(career.selected);}
function hide(){$('overlay').hidden=true;$('overlay').classList.remove('side','left');document.body.classList.remove('hangar','in-menu','pre');G.view='fly';screenStack=[];}
function back(){screenStack.pop();const prev=screenStack.pop();if(prev)show(prev);else if(G.paused)show('pauseCard');else if(G.landed)show('landCard');else if(G.crashed)show('crashCard');else if(G.flying)hide();else show('menuCard');}
function togglePause(){if(!G.flying||G.crashed||G.landed)return;if(G.paused){G.paused=false;hide();last=performance.now();}else if($('overlay').hidden){G.paused=true;show('pauseCard');}}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.flying&&!G.paused&&$('overlay').hidden&&!G.crashed&&!G.landed){G.paused=true;show('pauseCard');}});
function fmtTime(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function save(){store.set('jgsim.log',logbook);}
function saveSettings(){store.set('jgsim.settings',settings);}
function haptic(ms){try{if(settings.haptics&&navigator.vibrate)navigator.vibrate(ms);}catch(e){}}
function reset(){
  st=Sim.create();G.gearUp=false;G.flapPos=0;syncFeatureButtons();G.crashed=false;G.landed=false;G.paused=false;G.trauma=0;G.viol=0;G.flightStart=0;G.lastGroundT=0;kThr=0;touch.l.y=-1;touch.l.place&&touch.l.place();
  MSG.length=0;for(const k in cool)delete cool[k];renderMarshal();
  gate.i=0;gate.running=false;gate.lastD=0;gateMeshes.forEach(m=>m.material=gateDim);if(gateMeshes[0])gateMeshes[0].material=gateM;
  gateObjs.forEach(g=>g.grp.visible=G.mode==='gates');$('gatebox').style.display=G.mode==='gates'?'flex':'none';
  camPos.set(0,1.2,3);
  if(G.mode==='pursuit')startPursuit(pursuit.chapter);else stopPursuit();
  if(G.flying){hide();say('On the strip. RWY 00, wind '+settings.wdir+'° at '+settings.wind+' m/s.','', 'rwy',0);}
}
function goFull(){if(!MOBILE)return;try{const el=document.documentElement;const p=el.requestFullscreen?el.requestFullscreen({navigationUI:'hide'}):null;if(p&&p.then)p.then(()=>{try{screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape').catch(()=>{});}catch(e){}}).catch(()=>{});}catch(e){}}
function startFlight(){if(loadedId!==career.selected)loadPlayerAircraft(career.selected);G.started=true;G.flying=true;goFull();hide();if(!audio)initAudio();if(audio&&audio.ctx.state==='suspended')audio.ctx.resume();
  say('Cleared to taxi. RWY 00, wind '+settings.wdir+'° at '+settings.wind+' m/s.','good');
  if(G.stab===2)say('Self-level is on: the stick sets a bank angle and it levels when you let go.','', 'stabinfo',0);}
function toMenu(){G.flying=false;G.started=false;G.paused=false;if(G.mode==='pursuit')G.mode='free';reset();screenStack=[];show('menuCard');}
function endFlight(kind,why){
  if(pursuit.active&&pursuit.started){if(kind==='land')return endPursuit('busted');stopPursuit();career.busts++;saveCareer();}
  const air=st.airborne?st.time-G.flightStart:0;
  logbook.flights++;logbook.airtime+=air;if(air>logbook.longest)logbook.longest=air;
  if(kind==='crash'){logbook.crashes++;G.crashed=true;G.lastCrash=why;haptic([60,40,140]);feedback('large',st.pos.x,Math.max(st.pos.y,0.05),st.pos.z);thud(1);$('crashWhy').textContent=why;$('crashTime').textContent=fmtTime(air);$('crashSpd').textContent=Math.round(st.maxV*3.6);$('crashAlt').textContent=st.maxAlt.toFixed(0);setTimeout(()=>{if(G.crashed)show('crashCard');},reduceMotion?0:700);if(audio)audio.motor.gain.setTargetAtTime(0,audio.ctx.currentTime,0.05);}
  else{G.landed=true;const td=st.touchdown||{sink:0,speed:0};let grade='Greaser.';if(td.sink>1.8){grade='Hard landing, but it lives.';logbook.hard++;}else if(td.sink>1.0){grade='Firm landing.';logbook.firm++;}else logbook.landings++;$('landWhy').textContent=grade+' Touched down at '+(td.speed*3.6).toFixed(0)+' km/h, sink '+td.sink.toFixed(1)+' m/s.';$('landTime').textContent=fmtTime(air);$('landSink').textContent=td.sink.toFixed(1);$('landViol').textContent=G.viol;show('landCard');}
  save();
}
function checkGate(){
  const g=gateObjs[gate.i]; if(!g) return;
  const rel=st.pos.clone().sub(g.pos);const d=rel.dot(g.n);const lateral=rel.clone().addScaledVector(g.n,-d).length();
  if((gate.lastD<0&&d>=0||gate.lastD>0&&d<=0)&&lateral<3.3){
    if(!gate.running){gate.running=true;gate.t0=st.time;}
    gateMeshes[gate.i].material=gateDone;if(!reduceMotion)tween(gateMeshes[gate.i],1.25,1,0.35,easeOutBack);chime();haptic(25);gate.i++;say('Gate '+gate.i+' of '+gateObjs.length+'.','good');
    if(gate.i<gateObjs.length)gateMeshes[gate.i].material=gateM;
    else{const t=st.time-gate.t0;gate.running=false;if(logbook.bestGate===null||t<logbook.bestGate)logbook.bestGate=t;save();$('winTime').textContent=t.toFixed(2);$('winBest').textContent=logbook.bestGate.toFixed(2);$('winViol').textContent=G.viol;show('winCard');}
  }
  gate.lastD=d;
}

/* ---------- camera (camera-systems): pilot, chase, FPV, hangar ---------- */
const camPos=new THREE.Vector3(0,1.2,3),camLook=new THREE.Vector3();
const FWD=new THREE.Vector3(0,0,-1);
let hangarAngle=0;
const CAMS=['pilot','chase','fpv'],CAMN={pilot:'Pilot',chase:'Chase',fpv:'FPV'};
function cycleCam(){G.cam=CAMS[(CAMS.indexOf(G.cam)+1)%3];document.querySelectorAll('[data-cam]').forEach(b=>b.textContent=CAMN[G.cam]);}
/* model marker: constant-size ring when the model is far, a standard aid in RC sims */
const marker=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.strokeStyle='#F26522';g.lineWidth=7;g.beginPath();g.arc(64,64,52,0,Math.PI*2);g.stroke();
  const t=new THREE.CanvasTexture(c);const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true,opacity:0.85,fog:false}));sp.renderOrder=10;scene.add(sp);return sp;})();
/* marker: constant screen size (5% of the view height), shown only when the model is too small to read */
function updateMarker(){const d=camera.position.distanceTo(st.pos);const viewH=2*d*Math.tan(camera.fov*Math.PI/360);const modelFrac=AC.span/viewH;
  marker.position.copy(st.pos);const sz=viewH*(MOBILE?0.075:0.055);marker.scale.set(sz,sz,1);
  marker.visible=G.flying&&G.view==='fly'&&G.cam==='pilot'&&modelFrac<0.06;marker.material.opacity=clamp((0.06-modelFrac)/0.03,0,0.85);}
function updateCamera(dt){
  if(G.view==='hangar'||(!G.flying&&!G.crashed&&!G.landed)){hangarAngle+=dt*0.1;const a=0.75+Math.sin(hangarAngle)*0.55;const target=st.pos.clone().add(new THREE.Vector3(0,0.03,0.02));const sc=Math.max(1,AC.span/0.8);const want=new THREE.Vector3(Math.sin(a)*1.35*sc,0.62*sc,Math.cos(a)*1.35*sc).add(target);camPos.lerp(want,1-Math.exp(-dt*3));camera.position.copy(camPos);camera.lookAt(target);camera.fov=40;const W=canvas.clientWidth,H=canvas.clientHeight;if(G.view==='hangar'&&W>700)camera.setViewOffset(W,H,W*0.22,0,W,H);else camera.clearViewOffset();camera.updateProjectionMatrix();return;}
  if(camera.view&&camera.view.enabled)camera.clearViewOffset();
  if(G.cam==='pilot'){camera.position.copy(PILOT_EYE);camLook.lerp(st.pos,1-Math.exp(-dt*12));camera.lookAt(camLook);
    /* Auto-zoom like RealFlight: keep the model readable but never zoom so far that the horizon and field drop out of view.
       Model fills about 1/6 of the screen height when it can; the lens never goes narrower than 18 deg (phone) or 15 deg (desktop). */
    const d=PILOT_EYE.distanceTo(st.pos);const want=clamp(2*Math.atan(AC.span*6/2/Math.max(d,1))*57.3,MOBILE?18:15,MOBILE?55:50);
    camera.fov+=(want-camera.fov)*(1-Math.exp(-dt*3));camera.updateProjectionMatrix();}
  else if(G.cam==='chase'){const cs=Math.max(1,AC.span/0.8);const target=new THREE.Vector3(0,0.45*cs,2.0*cs).applyQuaternion(st.q).add(st.pos);camPos.lerp(target,1-Math.exp(-dt*(5+0.3*st.V)));camPos.y=Math.max(camPos.y,0.25);/* follow rate rises with speed so the trailing lag stays near 2 m on the jet too */camera.position.copy(camPos);const lead=st.vel.clone().multiplyScalar(0.12);camera.lookAt(st.pos.clone().addScaledVector(FWD.clone().applyQuaternion(st.q),2).add(lead));camera.fov=58;camera.updateProjectionMatrix();}
  else{camera.position.copy(new THREE.Vector3(0,0.1*Math.max(1,AC.span/0.8),-0.19*AIRCRAFT[loadedId].geom.k).applyQuaternion(st.q).add(st.pos));camera.quaternion.copy(st.q);camera.fov=85;camera.updateProjectionMatrix();}
  if(G.trauma>0&&!reduceMotion){G.trauma=Math.max(0,G.trauma-1.4*dt);const sh=G.trauma*G.trauma,t=performance.now()/1000*30;if(G.cam!=='pilot'){camera.rotation.z+=0.06*sh*Math.sin(t*1.1);camera.rotation.x+=0.03*sh*Math.sin(t*1.7);}else{camera.fov*=1+0.02*sh*Math.sin(t*1.3);camera.updateProjectionMatrix();}}
  const buffet=st.stall*0.004*(G.cam==='fpv'?1:0);if(buffet>0&&!reduceMotion){camera.rotation.z+=buffet*Math.sin(performance.now()/1000*40);}
}

/* ---------- preflight ---------- */
function updatePreflight(){
  if($('preCard').hidden)return;
  const p=G.preflight;const n=stickCount();
  $('pf-tx-v').textContent=pad?(n===4?'4 sticks mapped':n+' of 4 mapped'):(settings.sticks?'touch sticks':'keyboard');$('pf-tx').classList.toggle('done',!pad||n===4);
  $('pf-thr-v').textContent=Math.round(IN.rawThr*100)+'%';$('pf-thr').classList.toggle('done',IN.rawThr<0.05);
  $('pf-cut').hidden=!(dev&&dev.map.cut.src);$('pf-cut').classList.toggle('done',!G.cut);$('pf-cut-v').textContent=G.cut?'ON, flip it off':'off';
  if(IN.rawAil>0.7)p.ail=true;if(IN.rawEle>0.7)p.ele=true;if(IN.rawRud>0.7)p.rud=true;
  $('pf-ail').classList.toggle('done',p.ail);$('pf-ele').classList.toggle('done',p.ele);$('pf-rud').classList.toggle('done',p.rud);
  $('pf-wind-v').textContent=settings.wdir+'° at '+settings.wind+' m/s, RWY 00';$('pf-wind').classList.toggle('done',p.wind);
  const all=IN.rawThr<0.05&&!G.cut&&p.ail&&p.ele&&p.rud&&p.wind;$('bClear').disabled=!all;
  $('pfWhy').textContent=all?(pad&&n<4?'Ready. '+(4-n)+' stick'+(4-n>1?'s are':' is')+' not on the transmitter yet and will use '+(settings.sticks?'touch':'the keyboard')+'.':'All checks done.'):G.cut?'Throttle cut is ON. Flip it off.':'Move each control fully, then tap Wind to confirm.';
}
$('pf-wind').addEventListener('click',()=>{G.preflight.wind=true;});

/* ---------- hangar, telemetry, logbook ---------- */
let hgView=career.selected;
function showHangar(){hgView=career.selected;renderHangar();show('hangarCard');}
function renderHangar(){const id=hgView,A=AIRCRAFT[id],own=career.owned.includes(id);
  $('hgCredits').textContent=career.credits;
  $('hgPlanes').innerHTML=Object.values(AIRCRAFT).map(P=>{const o=career.owned.includes(P.id);return `<div class="pl${P.id===id?' sel':''}" data-pl="${P.id}"><b>${P.name}</b><small>${P.role}</small><span class="tag ${o?'own':'lock'}">${P.id===career.selected?'Flying':o?'Owned':P.price+' cr'}</span></div>`;}).join('');
  $('hgName').textContent=A.name+' · '+A.role;$('hgBlurb').textContent=A.blurb;
  const S=statsOf(id),row=(k,v,u,f)=>`<span>${k}</span><span class="bar"><i style="width:${clamp(f,0.04,1)*100}%"></i></span><b>${v}${u}</b>`;
  $('hgStats').innerHTML=row('Top speed',S.vmax.toFixed(0),' km/h',S.vmax/200)+row('Stall',S.vs.toFixed(0),' km/h',1-S.vs/45)+row('Thrust/wt',S.climb.toFixed(2),'',S.climb/2.5)+row('Roll',S.roll.toFixed(0),' °/s',S.roll/450)+row('Endurance',S.endur.toFixed(1),' min',S.endur/12);
  const pt=paintOf(id);$('hgPaint').innerHTML=['primary','secondary','accent'].map(k=>`<span>${k[0].toUpperCase()+k.slice(1)}</span><span class="sw">${PAINTS.map(c=>`<button data-paint="${k}" data-c="${c}" class="${pt[k].toLowerCase()===c.toLowerCase()?'on':''}" style="background:${c}" aria-label="${k} ${c}"${own?'':' disabled'}></button>`).join('')}</span>`).join('');
  const u=upOf(id);const have=career.up[id]&&career.up[id].have||{};
  $('hgUps').innerHTML=Object.entries(UPGRADES).map(([k,list])=>`<div class="up"><span>${k[0].toUpperCase()+k.slice(1)}</span><span class="opts">${list.map((o,i)=>{const h=i===0||(have[k]||[]).includes(i);return `<button class="btn mini${u[k]===i?' cur':h?' have':''}" data-up="${k}" data-i="${i}"${own?'':' disabled'}>${k==='battery'?packName(id,i):o.name}${h?'':' · '+o.cost}</button>`;}).join('')}</span></div>`).join('');
  $('hgSheetWrap').hidden=id!=='cub';$('sheet').innerHTML=SHEET.map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join('');
  $('bHangarFly').textContent=own?(id===career.selected?'Fly this one':'Select and fly'):'Buy for '+A.price+' cr';$('bHangarFly').disabled=!own&&career.credits<A.price;
  $('hgHint').textContent=own?'Upgrades change the flight model itself: thrust, pitch speed, weight and endurance.':career.credits<A.price?'Earn credits in Career to unlock it.':'';}
$('hangarCard').addEventListener('click',e=>{const pl=e.target.closest('[data-pl]'),pa=e.target.closest('[data-paint]'),up=e.target.closest('[data-up]');
  if(pl){hgView=pl.dataset.pl;if(career.owned.includes(hgView)&&hgView!==career.selected){career.selected=hgView;saveCareer();}if(loadedId!==hgView)loadPlayerAircraft(hgView);renderHangar();}
  if(pa&&!pa.disabled){const id=hgView;career.paint[id]=Object.assign({},career.paint[id]||{},{[pa.dataset.paint]:pa.dataset.c});saveCareer();loadPlayerAircraft(id);renderHangar();}
  if(up&&!up.disabled){const id=hgView,k=up.dataset.up,i=+up.dataset.i,o=UPGRADES[k][i];const rec=career.up[id]=career.up[id]||{};rec.have=rec.have||{};rec.have[k]=rec.have[k]||[];
    const owned=i===0||rec.have[k].includes(i);if(!owned){if(career.credits<o.cost){$('hgHint').textContent='Not enough credits for '+o.name+'.';return;}career.credits-=o.cost;rec.have[k].push(i);}
    rec[k]=i;saveCareer();if(id===career.selected)loadPlayerAircraft(id);renderHangar();}});
on('bHangarFly',()=>{const id=hgView,A=AIRCRAFT[id];if(!career.owned.includes(id)){if(career.credits<A.price)return;career.credits-=A.price;career.owned.push(id);career.selected=id;saveCareer();loadPlayerAircraft(id);renderHangar();return;}
  if(id!==career.selected){career.selected=id;saveCareer();loadPlayerAircraft(id);}$('bFly').click();});
/* career */
let crSel=0;
function showCareer(){crSel=Math.min(career.chapter,CHAPTERS.length-1);renderCareer();show('careerCard');}
function renderCareer(){$('crCredits').textContent=career.credits;
  $('crList').innerHTML=CHAPTERS.map((c,i)=>{const lock=i>career.chapter,done=i<career.chapter;return `<div class="chap${i===crSel?' sel':''}${lock?' lock':''}${done?' done':''}" data-ch="${i}"><span class="n">${done?'✓':i+1}</span><span><b>${c.name}</b><br><small>Heat ${c.heat}${c.goal==='survive'?' · survive '+c.time+' s':c.goal==='endless'?' · endless':''}</small></span><small>${lock?'locked':c.reward?'+'+c.reward+' cr':'bounty'}</small></div>`;}).join('');
  $('crBrief').textContent=CHAPTERS[crSel].brief+' Flying: '+AIRCRAFT[career.selected].name+'.';}
$('crList').addEventListener('click',e=>{const c=e.target.closest('[data-ch]');if(!c)return;const i=+c.dataset.ch;if(i>career.chapter)return;crSel=i;renderCareer();});
on('bCareer',showCareer);on('bCareerBack',back);on('bCareerHangar',showHangar);
on('bCareerGo',()=>{G.mode='pursuit';pursuit.chapter=crSel;document.querySelectorAll('[data-mode]').forEach(b=>b.textContent='Pursuit');reset();$('bFly').click();});
on('bPurAgain',()=>{G.flying=true;G.crashed=false;reset();});on('bPurCareer',showCareer);on('bPurHangar',showHangar);on('bPurMenu',toMenu);
function refreshMenu(){$('menuCredits').textContent=career.credits+' cr';const c=CHAPTERS[Math.min(career.chapter,CHAPTERS.length-1)];$('careerSub').textContent='Chapter '+(Math.min(career.chapter,CHAPTERS.length-1)+1)+': '+c.name+' · '+AIRCRAFT[career.selected].name;}
const TELE=['full','minimal','off'];
function cycleTelemetry(){settings.tele=TELE[(TELE.indexOf(settings.tele||'full')+1)%3];applyTelemetry();saveSettings();}
function applyTelemetry(){const m=settings.tele||'full';$('hud').classList.toggle('minimal',m==='minimal');$('hud').classList.toggle('hidden',m==='off');document.querySelectorAll('[data-tele]').forEach(b=>b.textContent='Telemetry: '+m);}
function showLog(){const L=logbook;$('logStats').innerHTML=[['Flights',L.flights],['Airtime',fmtTime(L.airtime)],['Longest',fmtTime(L.longest)],['Greasers',L.landings],['Firm',L.firm],['Hard',L.hard],['Crashes',L.crashes],['Violations',L.violations],['Best course',L.bestGate===null?'none':L.bestGate.toFixed(1)+' s']].map(([k,v])=>`<div><span class="lbl">${k}</span><b>${v}</b></div>`).join('');show('logCard');}
const STABN=['Stab off','Assist','Self-level'];
function cycleStab(){if(dev&&dev.map.stab.src){say('Stabiliser is on a transmitter switch.','warn','stabsw',3);return;}G.kStab=(G.kStab+1)%3;settings.stab=G.kStab;saveSettings();applyStabLabel();}
function applyStabLabel(){document.querySelectorAll('[data-stab]').forEach(b=>{b.textContent=STABN[G.stab];b.classList.toggle('on',G.stab>0);});}
function setMode(m){G.mode=m;document.querySelectorAll('[data-mode]').forEach(b=>b.textContent=m==='free'?'Freefly':m==='gates'?'Gates':'Pursuit');reset();}

/* ---------- wiring ---------- */
on('bFly',()=>{G.started=true;if(!audio)initAudio();if(audio&&audio.ctx.state==='suspended')audio.ctx.resume();if(MOBILE&&!pad)setSticks(true);G.preflight={ail:false,ele:false,rud:false,wind:false};show('preCard');});
on('bHangar',showHangar);on('bMenuTx',()=>openTx(false));on('bMenuLog',showLog);on('bMenuField',()=>show('fieldCard'));
on('bHangarBack',back);
on('bTxWizard',()=>startWizard(0));on('bTxBack',()=>{wiz.on=false;swCap=null;$('wiz').hidden=true;back();});
on('bClear',startFlight);on('bSkipPre',startFlight);on('bPreTx',()=>openTx(false));on('bPreBack',back);
on('bAgain',reset);on('bLandAgain',reset);on('bLandLog',showLog);on('bWinGo',hide);on('bWinAgain',reset);on('bCrashMenu',toMenu);on('bLandMenu',toMenu);
onAll('[data-cam]',cycleCam);onAll('[data-gear]',toggleGear);onAll('[data-flap]',cycleFlaps);onAll('[data-tele]',cycleTelemetry);onAll('[data-stab]',cycleStab);onAll('[data-mode]',()=>setMode(G.mode==='free'?'gates':'free'));
onAll('[data-sound]',()=>{if(!audio)initAudio();if(audio&&audio.ctx.state==='suspended')audio.ctx.resume();G.sound=!G.sound;document.querySelectorAll('[data-sound]').forEach(b=>b.textContent='Sound '+(G.sound?'on':'off'));});
on('bPause',togglePause);on('bPauseM',togglePause);on('bResume',togglePause);
on('bPauseTx',()=>openTx(false));on('bPauseLog',showLog);on('bPauseReset',reset);on('bPauseMenu',toMenu);on('bPauseField',()=>show('fieldCard'));
on('bTx',()=>openTx(false));on('bFieldBack',back);
on('bTrim0',()=>{trims.ail=trims.ele=trims.rud=0;store.set('jgsim.trims',trims);refreshTrims();});
on('bLogClose',back);
on('bLogClear',()=>{Object.assign(logbook,{flights:0,airtime:0,landings:0,firm:0,hard:0,crashes:0,violations:0,longest:0,bestGate:null});save();showLog();});
$('trims').addEventListener('click',e=>{const t=e.target.closest('[data-trim]');if(!t)return;const k=t.dataset.trim;trims[k]=clamp(Math.round((trims[k]+0.02*(+t.dataset.d))*100)/100,-0.3,0.3);store.set('jgsim.trims',trims);refreshTrims();});
function refreshTrims(){['ail','ele','rud'].forEach(k=>{$('trim-'+k).textContent=(trims[k]>0?'+':'')+Math.round(trims[k]*50);});}
const bind=(id,key,out,fmt)=>{const el=$(id);el.value=settings[key];$(out).textContent=fmt(settings[key]);el.addEventListener('input',e=>{settings[key]=+e.target.value;$(out).textContent=fmt(settings[key]);saveSettings();});};
bind('sRates','rates','oRates',v=>v+'%');bind('sExpo','expo','oExpo',v=>v+'%');bind('sLow','low','oLow',v=>v+'%');bind('sVol','vol','oVol',v=>v+'%');bind('sWind','wind','oWind',v=>v+' m/s');bind('sWdir','wdir','oWdir',v=>v+'°');bind('sGust','gust','oGust',v=>v+'%');
$('cShadow').checked=settings.shadow;$('cHaptics').checked=settings.haptics;
$('cSticks').addEventListener('change',e=>setSticks(e.target.checked));
$('cHaptics').addEventListener('change',e=>{settings.haptics=e.target.checked;saveSettings();haptic(30);});
$('cShadow').addEventListener('change',e=>{settings.shadow=e.target.checked;renderer.shadowMap.enabled=settings.shadow;scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});saveSettings();});
on('bRotateAnyway',()=>{document.body.classList.add('portrait-ok');});
buildTx();refreshTrims();applyTelemetry();
G.kStab=num(settings.stab,MOBILE?2:0,0,2)|0;G.stab=G.kStab;applyStabLabel();
if(settings.sticks||MOBILE)setSticks(true);
