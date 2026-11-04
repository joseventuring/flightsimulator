/* helicopter test: Rotor R-20 from the shipped catalogue in the shipped physics */
const THREE=require('three');const path=require('path'),fs=require('fs');
const Sim=require(path.join(__dirname,'..','sim.js'));const AC=Sim.AC,clamp=Sim.clamp;
const src=fs.readFileSync(path.join(__dirname,'..','src','aircraft.js'),'utf8');
const store={get:(k,d)=>d,set(){}};const num=(v,d,a,b)=>typeof v==='number'&&isFinite(v)?clamp(v,a,b):d;
const M=new Function('THREE','AC','Sim','store','num','clamp',src+';return {AIRCRAFT,applyAircraftPhysics,statsOf};')(THREE,AC,Sim,store,num,clamp);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);const env={wind:V(0,0,0),rho:1.18};const DT=1/240;
const id=process.argv[2]||'rotor';M.applyAircraftPhysics(id);const S=M.statsOf(id);const W0=AC.headspeed,rpm=w=>Math.round(w*60/6.2832);
const res={stats:{vmax:+S.vmax.toFixed(0),hoverStick:+S.vs.toFixed(0),tw:+S.climb.toFixed(1),endur:+S.endur.toFixed(1)}};const fail=[];
const tilt=st=>Math.acos(clamp(V(0,1,0).applyQuaternion(st.q).y,-1,1))*57.3;
/* stick position that gives a collective angle in degrees */
const stick=deg=>clamp((deg-AC.collMin)/(AC.collMax-AC.collMin),0,1);
function flying(y){const st=Sim.create();st.pos.set(0,y,0);st.airborne=true;st.onGround=false;st.time=2;st.spool=1;st.rotorW=W0;st.vi=3.2;return st;}
// 1. sit, spool up with low collective: stays on the skids, reaches headspeed
{const st=Sim.create();let c=null,t95=null;for(let t=0;t<8;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:stick(-2),mode:2},DT,env);if(c)break;if(t95===null&&st.rotorW>0.95*W0)t95=t;}
  res.spool={crash:c,secondsTo95:t95&&+t95.toFixed(1),rpm:rpm(st.rotorW),yawDrift:+(st.w.y*57.3).toFixed(1),alt:+st.pos.y.toFixed(3)};if(c||t95===null||st.pos.y>0.4)fail.push('spool');}
// 2. lift off and hover at 10 m in Angle mode: collective hold on height
{const st=Sim.create();let c=null,sumC=0,n=0,maxT=0,minW=1e9;for(let t=0;t<22;t+=DT){const lift=t>6;const deg=lift?clamp(3+4*(10-st.pos.y)-4*st.vel.y,-6,12):-2;
  c=Sim.step(st,{ail:0,ele:0,rud:0,thr:stick(deg),mode:2},DT,env);if(c)break;if(t>14){sumC+=deg;n++;maxT=Math.max(maxT,tilt(st));minW=Math.min(minW,st.rotorW);}}
  res.hover={crash:c,alt:+st.pos.y.toFixed(1),collectiveDeg:+(sumC/n).toFixed(1),stick:+stick(sumC/n).toFixed(2),tilt:+maxT.toFixed(1),drift:+Math.hypot(st.pos.x,st.pos.z).toFixed(1),heading:+(st.w.y*57.3).toFixed(1),rpm:rpm(minW),watts:Math.round(st.Pm),amps:+st.amp.toFixed(0)};
  if(c||Math.abs(st.pos.y-10)>1||maxT>9||Math.hypot(st.pos.x,st.pos.z)>15)fail.push('hover'); /* tilt includes the one-skid-low trim against tail-rotor thrust */}
// 3. acro rates
{const st=flying(60);let pk=0;for(let t=0;t<0.6;t+=DT){Sim.step(st,{ail:1,ele:0,rud:0,thr:stick(4),mode:0},DT,env);pk=Math.max(pk,-st.w.z*57.3);}res.rollDegS=+pk.toFixed(0);if(pk<300)fail.push('roll');}
{const st=flying(60);let pk=0;for(let t=0;t<0.6;t+=DT){Sim.step(st,{ail:0,ele:0,rud:1,thr:stick(4),mode:0},DT,env);pk=Math.max(pk,-st.w.y*57.3);}res.yawDegS=+pk.toFixed(0);if(pk<300)fail.push('yaw');}
// 4. level top speed: Angle mode with the limit raised, collective holds height
{let best=0;for(let th=8;th<=64;th+=4){M.applyAircraftPhysics(id);AC.maxAngle=th;const st=flying(200);let c=null;for(let t=0;t<14;t+=DT){const deg=clamp(4+3*(200-st.pos.y)-3*st.vel.y,-6,12);c=Sim.step(st,{ail:0,ele:-1,rud:0,thr:stick(deg),mode:2},DT,env);if(c)break;}
  if(!c&&Math.abs(st.pos.y-200)<5)best=Math.max(best,Math.hypot(st.vel.x,st.vel.z)*3.6);}M.applyAircraftPhysics(id);res.topKmh=+best.toFixed(0);if(best<60)fail.push('top');}
// 5. autorotation: throttle hold at 60 m, collective -4 deg to keep the rotor up, then a metered flare: sink target shrinks with height
{const st=flying(60);let c=null,minW=1e9,td=null,maxSink=0;for(let t=0;t<40;t+=DT){const h=st.pos.y;let deg;
    if(h>12)deg=-4;else{const vT=-(0.4+0.75*h);deg=clamp(-1+6*(vT-st.vel.y),-4,12);}
    c=Sim.step(st,{ail:0,ele:0,rud:0,thr:stick(deg),mode:2,arm:false},DT,env);if(c){c='autorotation: '+c;break;}
    if(t>2&&h>12){minW=Math.min(minW,st.rotorW);maxSink=Math.max(maxSink,-st.vel.y);}if(st.touchdown&&!td)td={sink:+st.touchdown.sink.toFixed(2),rpmAtTouch:rpm(st.rotorW)};if(td&&t>2)break;}
  res.autorotation=c||{descentRpmMin:rpm(minW),descentMs:+maxSink.toFixed(1),...td};if(c||!td||minW<0.7*W0)fail.push('autorotation');}
// 6. power off with collective left up: headspeed decays and it falls (the classic mistake)
{const st=flying(40);let c=null,t70=null;for(let t=0;t<20;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:stick(6),mode:2,arm:false},DT,env);if(t70===null&&st.rotorW<0.7*W0)t70=t;if(c)break;}
  res.holdWithCollectiveUp={rpmDecayTo70pct:t70&&+t70.toFixed(1),ends:c};if(!c)fail.push('hold-decay');}
// 7. tip over on the ground with the rotor turning
{const st=Sim.create();st.spool=1;st.rotorW=W0;st.q.setFromAxisAngle(V(0,0,1),1.0);st.pos.y=0.5;st.time=2;st.airborne=true;let c=null;for(let t=0;t<3;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:stick(-2),mode:0},DT,env);if(c)break;}res.tipOver=c;if(!c||!/Blade strike/.test(c))fail.push('tip');}
console.log(id,JSON.stringify(res,null,1));console.log(fail.length?'FAIL '+fail.join(','):'ALL PASS');process.exitCode=fail.length?1:0;
