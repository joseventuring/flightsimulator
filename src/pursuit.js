/* ---------- pursuit (game-ai skill: steering with turn-rate limits, perception by line of sight, a small state machine) ----------
   The Coast Wardens are a fictional patrol squadron. Their aircraft are flown by a kinematic pilot model: pure pursuit with lead,
   a bank-limited turn rate, a terrain floor. They are faster than the Cub and slower to turn, so speed and agility both matter.
   Rules, borrowed from NFS Most Wanted: a BUST meter fills while a Warden is close and can see you; a COOLDOWN meter fills while
   none can; if one spots you during cooldown it resets. HEAT rises the longer you run and brings faster Wardens, then a second one. */
const CHAPTERS=[
  {name:'Rookie at Kurianad',heat:1,goal:'escape',reward:400,brief:'A Coast Warden has your tail number. Lose it: break line of sight behind the palms or the ridge, or get more than 140 m away, and hold it until cooldown completes.'},
  {name:'Monsoon run',heat:2,goal:'survive',time:90,reward:700,brief:'Two minutes of rain-season patrol. Survive 90 seconds without being busted, then escape. Heat 2 Wardens fly at 94 km/h.'},
  {name:'Ridge line',heat:3,goal:'escape',reward:1200,brief:'Two Wardens at heat 3. The hills to the north are your best cover. The Kestrel or the Talon will help here.'},
  {name:'Most wanted',heat:1,goal:'endless',reward:0,brief:'Free pursuit. Heat climbs every minute. Bank your bounty by escaping before you get busted.'},
];
const HEAT=[null,{v:22,turn:0.95,n:1},{v:26,turn:1.1,n:1},{v:30,turn:1.25,n:2}];
const pursuit={active:false,chapter:0,heat:1,bust:0,cool:0,bounty:0,t:0,result:null,seen:false};
const wardens=[];
function spawnWarden(i){const spec=WARDEN;const c=buildAircraft(spec,spec.paint,[]);scene.add(c.root);
  const a=Math.random()*Math.PI*2;const pos=st.pos.clone().add(new THREE.Vector3(Math.cos(a)*160,30+i*10,Math.sin(a)*160));pos.y=Math.max(pos.y,terrainH(pos.x,pos.z)+25);
  const dir=st.pos.clone().sub(pos).normalize();const W={craft:c,pos,dir,speed:HEAT[pursuit.heat].v,bank:0,inp:{ail:0,ele:0,rud:0,flap:0},prop:0};wardens.push(W);return W;}
function clearWardens(){wardens.forEach(W=>{scene.remove(W.craft.root);disposeTree(W.craft.root);});wardens.length=0;}
/* line of sight: terrain samples along the segment plus tree trunks and crowns near it */
function lineOfSight(a,b){const n=14;for(let i=1;i<n;i++){const t=i/n;const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,z=a.z+(b.z-a.z)*t;if(y<terrainH(x,z)+1.5)return false;}
  const ab=_los.copy(b).sub(a);const L2=ab.lengthSq();for(const T of trees){const tx=T.x-a.x,tz=T.z-a.z;const s=clamp((tx*ab.x+tz*ab.z)/Math.max(ab.x*ab.x+ab.z*ab.z,1e-6),0,1);const px=a.x+ab.x*s-T.x,pz=a.z+ab.z*s-T.z,py=a.y+ab.y*s;if(px*px+pz*pz<T.r*T.r*0.8&&py<T.h)return false;}return true;}
const _los=new THREE.Vector3(),_want=new THREE.Vector3(),_tmpq=new THREE.Quaternion(),_up=new THREE.Vector3(0,1,0),_m4=new THREE.Matrix4();
function startPursuit(ch){pursuit.active=true;pursuit.chapter=ch;pursuit.heat=CHAPTERS[ch].heat;pursuit.bust=0;pursuit.cool=0;pursuit.bounty=0;pursuit.t=0;pursuit.result=null;pursuit.started=false;clearWardens();}
function stopPursuit(){pursuit.active=false;clearWardens();}
function updatePursuit(dt){
  if(!pursuit.active||!G.flying||G.paused)return;
  if(!pursuit.started){pursuit.air=(st.airborne&&!st.onGround)?(pursuit.air||0)+dt:0;if(pursuit.air>2){pursuit.started=true;const H=HEAT[pursuit.heat];for(let i=0;i<H.n;i++)spawnWarden(i);say('Coast Warden inbound. Heat '+pursuit.heat+'.','bad');haptic([40,30,40]);}return;}
  pursuit.t+=dt;const ch=CHAPTERS[pursuit.chapter];
  if(ch.goal==='endless'&&pursuit.heat<3&&pursuit.t>60*pursuit.heat){pursuit.heat++;say('Heat '+pursuit.heat+'. Wardens are faster now.','bad');if(HEAT[pursuit.heat].n>wardens.length)spawnWarden(wardens.length);}
  const H=HEAT[pursuit.heat];let anySee=false,close=false;
  /* Wardens scale to the aircraft you fly: never slower than the heat level, and at least 90% of your top speed, so a jet still has to out-turn them */
  const vW=Math.max(H.v,0.9*statsOf(career.selected).vmax/3.6);wardens.forEach(W=>{W.speed+=(vW-W.speed)*dt*0.5;
    const d=W.pos.distanceTo(st.pos);const lead=clamp(d/Math.max(W.speed,1),0,1.6);
    _want.copy(st.pos).addScaledVector(st.vel,lead).sub(W.pos);
    const floor=terrainH(W.pos.x,W.pos.z)+(d>60?14:4);if(W.pos.y<floor+6)_want.y=Math.max(_want.y,(floor+6-W.pos.y)*4);
    _want.normalize();
    const ang=Math.acos(clamp(W.dir.dot(_want),-1,1));const maxT=H.turn*dt;const k=ang>1e-4?Math.min(1,maxT/ang):1;
    const prev=W.dir.clone();W.dir.lerp(_want,k).normalize();
    const yawRate=(Math.atan2(W.dir.x,-W.dir.z)-Math.atan2(prev.x,-prev.z));const yr=Math.atan2(Math.sin(yawRate),Math.cos(yawRate))/Math.max(dt,1e-3);
    W.bank+=(clamp(-yr*0.6,-1.1,1.1)-W.bank)*Math.min(1,dt*3);
    W.pos.addScaledVector(W.dir,W.speed*dt);W.pos.y=Math.max(W.pos.y,terrainH(W.pos.x,W.pos.z)+3);
    _m4.lookAt(W.pos,W.pos.clone().add(W.dir),_up);W.craft.root.quaternion.setFromRotationMatrix(_m4);_tmpq.setFromAxisAngle(new THREE.Vector3(0,0,1),W.bank);W.craft.root.quaternion.multiply(_tmpq);
    W.craft.root.position.copy(W.pos);W.prop+=dt*60;W.craft.propHub.rotation.z=W.prop;W.craft.propDisc.material.opacity=0.35;W.craft.propHub.children.forEach(b=>b.visible=false);
    W.inp.ail=clamp(-W.bank,-1,1);W.inp.rud=clamp(-yr*0.3,-1,1);animateCraft(W.craft,W.inp);
    const sees=d<260&&lineOfSight(W.pos,st.pos);W.sees=sees;if(sees)anySee=true;if(sees&&d<20)close=true;
    if(d<1.6&&st.airborne){endPursuit('crash','Mid-air with a Warden.');}});
  if(!pursuit.active)return;
  pursuit.bounty+=dt*10*pursuit.heat;
  if(close){pursuit.bust=Math.min(1,pursuit.bust+dt/(st.onGround?1.2:3));}else pursuit.bust=Math.max(0,pursuit.bust-dt*0.35);
  if(anySee){if(pursuit.cool>0.15)say('Spotted. Cooldown reset.','warn','spotted',4);pursuit.cool=0;}else{pursuit.cool=Math.min(1,pursuit.cool+dt/(6+2*pursuit.heat));}
  if(pursuit.bust>=1)return endPursuit('busted');
  const survived=ch.goal!=='survive'||pursuit.t>=ch.time;
  if(pursuit.cool>=1&&survived)return endPursuit('escaped');
  if(ch.goal==='survive'&&pursuit.t>=ch.time&&!pursuit.saidSurv){pursuit.saidSurv=true;say('90 seconds. Now lose them.','good');}
}
function endPursuit(kind,why){const ch=CHAPTERS[pursuit.chapter];pursuit.result=kind;let earned=0;
  if(kind==='escaped'){earned=Math.round(pursuit.bounty+250*pursuit.heat+(career.chapter===pursuit.chapter?ch.reward:0));career.credits+=earned;career.escapes++;if(career.chapter===pursuit.chapter&&career.chapter<CHAPTERS.length-1)career.chapter++;haptic([30,40,30,40,120]);chime();}
  else{career.busts++;haptic(kind==='busted'?[200,60,200]:[60,40,140]);}
  saveCareer();pursuit.active=false;
  $('purTitle').textContent=kind==='escaped'?'Escaped':kind==='busted'?'Busted':'Crashed';$('purTitle').className=kind==='escaped'?'':'bad-t';
  $('purWhy').textContent=kind==='escaped'?'Cooldown complete. Bounty banked.':kind==='busted'?'A Warden held you in sight at close range. Bounty lost.':(why||'Crashed during the pursuit. Bounty lost.');
  $('purTime').textContent=fmtTime(pursuit.t);$('purBounty').textContent=Math.round(pursuit.bounty);$('purEarned').textContent=earned;$('purCredits').textContent=career.credits;
  G.flying=false;if(kind==='crash'){G.crashed=true;feedback('large',st.pos.x,Math.max(st.pos.y,0.05),st.pos.z);}
  setTimeout(()=>show('purCard'),kind==='crash'?700:200);}
function drawPursuitHud(){const box=$('purHud');const on=pursuit.active&&pursuit.started;document.body.classList.toggle('pursuing',on);if(!on){box.hidden=true;return;}box.hidden=false;
  $('purHeat').textContent='★'.repeat(pursuit.heat)+'☆'.repeat(3-pursuit.heat);$('purBust').style.width=(pursuit.bust*100)+'%';$('purCool').style.width=(pursuit.cool*100)+'%';
  $('purB').textContent=Math.round(pursuit.bounty);const ch=CHAPTERS[pursuit.chapter];$('purGoal').textContent=ch.goal==='survive'&&pursuit.t<ch.time?'Survive '+Math.ceil(ch.time-pursuit.t)+' s':wardens.some(W=>W.sees)?'Break line of sight':'Hold it';}
