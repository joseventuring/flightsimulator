/* fleet test: loads the shipped catalogue (src/aircraft.js) into the shipped physics (sim.js) */
const THREE=require('three');const Sim=require(require('path').join(__dirname,'..','sim.js'));const AC=Sim.AC,clamp=Sim.clamp;const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','src','aircraft.js'),'utf8');
const store={get:(k,d)=>d,set(){}};const num=(v,d,a,b)=>typeof v==='number'&&isFinite(v)?clamp(v,a,b):d;
const M=new Function('THREE','AC','Sim','store','num','clamp',src+';return {AIRCRAFT,applyAircraftPhysics,statsOf};')(THREE,AC,Sim,store,num,clamp);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);const env={wind:V(0,0,0),rho:1.18,surfaceAt:()=>'strip'};const DT=1/240;
function att(st){const f=V(0,0,-1).applyQuaternion(st.q),up=V(0,1,0).applyQuaternion(st.q),rt=V(1,0,0).applyQuaternion(st.q);return {pitch:Math.asin(clamp(f.y,-1,1))*57.3,roll:Math.atan2(rt.y,up.y)*57.3,hdg:(Math.atan2(f.x,-f.z)*57.3+360)%360};}
function air(st,y,v,thr,q){st.pos.set(0,y,0);st.q.copy(q||new THREE.Quaternion());st.vel.set(0,0,-v).applyQuaternion(st.q);st.airborne=true;st.onGround=false;st.thr=thr;st.time=1;st.gearPos=AC.features.gear?1:0;}
const ids=process.argv[2]?process.argv[2].split(','):Object.keys(M.AIRCRAFT).filter(k=>!['quad','vtol','heli'].includes(M.AIRCRAFT[k].kind));const out={};
for(const id of ids){M.applyAircraftPhysics(id);const S=M.statsOf(id);const vs=S.vs/3.6;const r={stats:{vmax:+S.vmax.toFixed(0),vs:+S.vs.toFixed(0),tw:+S.climb.toFixed(2),roll:+S.roll.toFixed(0),endur:+S.endur.toFixed(1)}};
  // 0. sits on its wheels
  let st=Sim.create();let c=null;for(let t=0;t<2;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:0},DT,env);if(c)break;}r.rest={crash:c,pitch:+att(st).pitch.toFixed(1),y:+st.pos.y.toFixed(3),bounce:+st.vel.length().toFixed(3)};
  // 1. taxi steering: right rudder at walking pace must yaw right
  st=Sim.create();for(let t=0;t<4;t+=DT){Sim.step(st,{ail:0,ele:0,rud:t>1.5?1:0,thr:0.35*(AC.edf?1.4:1)},DT,env);}r.taxi={hdg:+(((att(st).hdg+180)%360)-180).toFixed(0)};
  // 2. takeoff: hold heading on the rudder, wings level, rotate at 1.3 Vs (flaps T/O where fitted)
  st=Sim.create();let lift=null;c=null;const flap=AC.features.flaps?0.26:0;
  for(let t=0;t<25;t+=DT){const a=att(st);const err=((a.hdg+180)%360)-180;const rot=st.V>1.3*vs;
    const inp={ail:clamp(1.5*a.roll/57.3-0.3*st.w.z,-1,1),ele:lift?clamp(0.04*(10-a.pitch)-0.1*st.w.x,-0.5,0.5):(rot?0.45:(AC.wheels[2].p.z>0?-0.15:0)),rud:clamp(-err/10,-1,1),thr:1,flap,gear:0};
    c=Sim.step(st,inp,DT,env);if(c){c='takeoff: '+c+' t='+t.toFixed(1)+' V='+(st.V*3.6).toFixed(0);break;}if(!lift&&st.airborne)lift={t:+t.toFixed(1),kmh:+(st.V*3.6).toFixed(0),run:+(-st.pos.z).toFixed(0)};if(lift&&t>+lift.t+4)break;}
  r.takeoff=c||lift||'no liftoff in 25 s';
  // 3. level top speed
  st=Sim.create();air(st,60,15,1);let vmax=0;c=null;for(let t=0;t<30;t+=DT){const a=att(st);c=Sim.step(st,{ail:clamp(1.5*a.roll/57.3,-1,1),ele:clamp(0.04*(1-a.pitch)-0.1*st.vel.y-0.15*st.w.x,-0.5,0.5),rud:0,thr:1,gear:1},DT,env);if(c)break;if(t>24)vmax=Math.max(vmax,st.V*3.6);}r.top=c||+vmax.toFixed(0);
  // 4. hands-off from a 10 degree bank at 55% throttle, cruise speed
  st=Sim.create();air(st,120,0.6*S.vmax/3.6,0.55,new THREE.Quaternion().setFromAxisAngle(V(0,0,1),-0.17));let mr=0,mp=0,ma=1e9;c=null;
  for(let t=0;t<20;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:0.55,gear:1},DT,env);if(c)break;const a=att(st);mr=Math.max(mr,Math.abs(a.roll));mp=Math.max(mp,Math.abs(a.pitch));ma=Math.min(ma,st.pos.y);}
  r.handsoff=c||{maxBank:+mr.toFixed(0),maxPitch:+mp.toFixed(0),altLost:+(120-ma).toFixed(0)};
  // 5. roll rate, full aileron at 60% of top speed
  st=Sim.create();air(st,120,0.6*S.vmax/3.6,0.7);for(let t=0;t<0.6;t+=DT)Sim.step(st,{ail:1,ele:0,rud:0,thr:0.7,gear:1},DT,env);r.roll=+(Math.abs(st.w.z)*57.3).toFixed(0);
  // 6. power-off approach and flare to touchdown, gear down, landing flap where fitted
  st=Sim.create();air(st,25,1.5*vs,0,new THREE.Quaternion().setFromAxisAngle(V(1,0,0),-0.05));st.gearPos=0;c=null;let td=null;const lf=AC.features.flaps?0.61:0;
  for(let t=0;t<40;t+=DT){const a=att(st);const h=st.pos.y;const glideV=1.4*vs;let ele;if(h>3){ele=clamp(0.05*(clamp(-2-3*(glideV-st.V),-12,6)-a.pitch)-0.12*st.w.x,-1,1);}else{const vyT=-(0.25+0.45*h);ele=clamp(0.35*(vyT-st.vel.y)+0.04*(Math.max(a.pitch,-2)-a.pitch)-0.1*st.w.x+0.15,-1,1);}
    c=Sim.step(st,{ail:clamp(1.5*a.roll/57.3,-1,1),ele,rud:0,thr:0,flap:lf,gear:0},DT,env);if(c){c='landing: '+c;break;}if(st.touchdown&&!td)td={sink:+st.touchdown.sink.toFixed(2),kmh:+(st.touchdown.speed*3.6).toFixed(0)};if(td&&st.V<1)break;}
  r.landing=c||td||'no touchdown';
  out[id]=r;console.log(id.padEnd(7),JSON.stringify(r));}
/* pass/fail: every aircraft must rest without crashing, lift off, land power-off, and steer the right way on the ground */
let fail=0;for(const [id,r] of Object.entries(out)){const bad=[];if(r.rest.crash)bad.push('rest');if(typeof r.takeoff==='string')bad.push('takeoff');if(typeof r.landing==='string')bad.push('landing');if(typeof r.handsoff==='string')bad.push('handsoff');if(typeof r.top==='string')bad.push('top');if(bad.length){fail++;console.log('FAIL',id,bad.join(','));}}
console.log(fail?fail+' aircraft failed':'ALL PASS');process.exitCode=fail?1:0;
/* abuse: full throttle and full up elevator from the start of the take-off run must not break the gear */
let abuse=0;for(const id of ids){M.applyAircraftPhysics(id);const st=Sim.create();let c=null;for(let t=0;t<6;t+=DT){c=Sim.step(st,{ail:0,ele:1,rud:0,thr:1,gear:0,flap:0},DT,env);if(c||st.pos.y>8)break;}
  if(c&&/Gear collapsed/.test(c)){abuse++;console.log('FAIL abuse',id,c);}else console.log('abuse',id.padEnd(7),c?'ends: '+c:'climbs away, alt '+st.pos.y.toFixed(1));}
if(abuse){process.exitCode=1;}
