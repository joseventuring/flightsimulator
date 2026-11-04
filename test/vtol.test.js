/* VTOL test: Hoverwing V-14 from the shipped catalogue in the shipped physics.
   Vertical take-off, hover, transition to plane mode, cruise, back-transition, vertical landing. */
const THREE=require('three');const path=require('path'),fs=require('fs');
const Sim=require(path.join(__dirname,'..','sim.js'));const AC=Sim.AC,clamp=Sim.clamp;
const src=fs.readFileSync(path.join(__dirname,'..','src','aircraft.js'),'utf8');
const store={get:(k,d)=>d,set(){}};const num=(v,d,a,b)=>typeof v==='number'&&isFinite(v)?clamp(v,a,b):d;
const M=new Function('THREE','AC','Sim','store','num','clamp',src+';return {AIRCRAFT,applyAircraftPhysics,statsOf};')(THREE,AC,Sim,store,num,clamp);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);const env={wind:V(0,0,0),rho:1.18,surfaceAt:()=>'strip'};const DT=1/240;
const id=process.argv[2]||'hoverwing';M.applyAircraftPhysics(id);const S=M.statsOf(id);const fail=[];const res={stats:{vmax:+S.vmax.toFixed(0),vs:+S.vs.toFixed(0)}};
const att=st=>{const f=V(0,0,-1).applyQuaternion(st.q),up=V(0,1,0).applyQuaternion(st.q),rt=V(1,0,0).applyQuaternion(st.q);return {pitch:Math.asin(clamp(f.y,-1,1))*57.3,roll:Math.atan2(rt.y,up.y)*57.3,tilt:Math.acos(clamp(up.y,-1,1))*57.3};};
const hov=Math.pow(AC.mass*AC.g/AC.liftTmax,1/AC.thrExp);const hThr=(st,y)=>clamp(hov+0.1*(y-st.pos.y)-0.15*st.vel.y,0,1);
let st=Sim.create(),c=null;
// 1. rest, then vertical take-off to 15 m and hover 8 s
for(let t=0;t<1.5;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:0,vtol:0},DT,env);if(c)break;}res.rest={crash:c,pitch:+att(st).pitch.toFixed(1)};if(c)fail.push('rest');
let maxTilt=0,thrS=0,n=0;
for(let t=0;t<14&&!c;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:hThr(st,15),vtol:0},DT,env);if(t>6){maxTilt=Math.max(maxTilt,att(st).tilt);thrS+=hThr(st,15);n++;}}
res.hover={crash:c,alt:+st.pos.y.toFixed(1),drift:+Math.hypot(st.pos.x,st.pos.z).toFixed(2),tilt:+maxTilt.toFixed(1),thr:+(thrS/n).toFixed(2)};if(c||Math.abs(st.pos.y-15)>1||maxTilt>4)fail.push('hover');
// 2. plane mode, full cruise throttle, hands off: transition must complete without losing more than 5 m
const y0=st.pos.y;let tDone=null,minY=1e9,maxY=-1e9;
for(let t=0;t<25&&!c;t+=DT){const a=att(st);c=Sim.step(st,{ail:clamp(1.2*a.roll/57.3,-1,1)*0,ele:st.trans===2?clamp(0.04*(2-a.pitch)-0.1*st.vel.y-0.1*st.w.x,-0.6,0.6):0,rud:0,thr:1,vtol:1},DT,env);
  minY=Math.min(minY,st.pos.y);maxY=Math.max(maxY,st.pos.y);if(tDone===null&&st.trans===2)tDone=t;if(tDone!==null&&t>tDone+10)break;}
res.transition={crash:c,seconds:tDone&&+tDone.toFixed(1),kmhAtEnd:+(st.V*3.6).toFixed(0),altLost:+(y0-minY).toFixed(1),altGain:+(maxY-y0).toFixed(1),liftAfter:+st.lift.toFixed(2)};
if(c||tDone===null||y0-minY>5||st.lift>0.01)fail.push('transition');
// 3. cruise in plane mode (lift motors off): speed at 70%
for(let t=0;t<15&&!c;t+=DT){const a=att(st);c=Sim.step(st,{ail:clamp(1.5*a.roll/57.3,-1,1),ele:clamp(0.04*(1-a.pitch)-0.1*st.vel.y-0.1*st.w.x,-0.6,0.6),rud:0,thr:0.7,vtol:1},DT,env);}
res.cruise={crash:c,kmh:+(st.V*3.6).toFixed(0),alt:+st.pos.y.toFixed(0),amps:+st.amp.toFixed(1)};if(c)fail.push('cruise');
// 4. back to hover: lift motors take over, it must stop and hold height
const yb=st.pos.y;let stopT=null,minB=1e9;
for(let t=0;t<20&&!c;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:hThr(st,yb),vtol:0},DT,env);minB=Math.min(minB,st.pos.y);if(stopT===null&&st.V<1.5)stopT=t;}
res.backTransition={crash:c,stoppedIn:stopT&&+stopT.toFixed(1),altLost:+(yb-minB).toFixed(1),tilt:+att(st).tilt.toFixed(1),drift:+st.V.toFixed(2)};if(c||stopT===null||yb-minB>6)fail.push('back');
// 5. vertical landing at 0.8 m/s
let td=null;for(let t=0;t<60&&!c;t+=DT){const thr=st.onGround?0:clamp(hov-0.15*(st.vel.y+(st.pos.y>3?1.5:0.6)),0,1);c=Sim.step(st,{ail:0,ele:0,rud:0,thr,vtol:0},DT,env);if(st.touchdown&&!td)td={sink:+st.touchdown.sink.toFixed(2)};if(td&&st.V<0.3&&t>2)break;}
res.landing=c||td||'no touchdown';if(c||!td)fail.push('landing');
// 6. lift battery draw in hover
st=Sim.create();for(let t=0;t<6;t+=DT)Sim.step(st,{ail:0,ele:0,rud:0,thr:hThr(st,10),vtol:0},DT,env);res.hoverAmps=+st.amp.toFixed(0);res.hoverMinutes=+(AC.capAh*0.8/st.amp*60).toFixed(1);
console.log(id,JSON.stringify(res,null,1));console.log(fail.length?'FAIL '+fail.join(','):'ALL PASS');process.exitCode=fail.length?1:0;
