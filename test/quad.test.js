/* quad test: the shipped catalogue (src/aircraft.js) in the shipped physics (sim.js), Sprint Q-16 */
const THREE=require('three');const path=require('path'),fs=require('fs');
const Sim=require(path.join(__dirname,'..','sim.js'));const AC=Sim.AC,clamp=Sim.clamp;
const src=fs.readFileSync(path.join(__dirname,'..','src','aircraft.js'),'utf8');
const store={get:(k,d)=>d,set(){}};const num=(v,d,a,b)=>typeof v==='number'&&isFinite(v)?clamp(v,a,b):d;
const M=new Function('THREE','AC','Sim','store','num','clamp',src+';return {AIRCRAFT,applyAircraftPhysics,statsOf};')(THREE,AC,Sim,store,num,clamp);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);const env={wind:V(0,0,0),rho:1.18};const DT=1/240;
const id=process.argv[2]||'sprint';M.applyAircraftPhysics(id);const S=M.statsOf(id);
const tilt=st=>Math.acos(clamp(V(0,1,0).applyQuaternion(st.q).y,-1,1))*57.3;
const res={stats:{vmax:+S.vmax.toFixed(0),hover:+S.vs.toFixed(0),tw:+S.climb.toFixed(1),endur:+S.endur.toFixed(1)}};let fail=[];
function air(y){const st=Sim.create();st.pos.set(0,y,0);st.airborne=true;st.onGround=false;st.air=true;st.time=2;const Tm=AC.Tmax/4,h=AC.mass*AC.g/4;st.mT=[h,h,h,h];return st;}
function hoverThr(st,yT){return clamp(Math.pow(AC.mass*AC.g/AC.Tmax,1/AC.thrExp)+0.08*(yT-st.pos.y)-0.12*st.vel.y,0,1);}
// 1. sits on the ground
{const st=Sim.create();let c=null;for(let t=0;t<2;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:0,mode:2},DT,env);if(c)break;}res.rest={crash:c,y:+st.pos.y.toFixed(3),tilt:+tilt(st).toFixed(1)};if(c)fail.push('rest');}
// 2. take off and hover at 10 m in Angle mode
{const st=Sim.create();let c=null,maxT=0,thrSum=0,n=0;for(let t=0;t<12;t+=DT){const thr=t<0.5?0:hoverThr(st,10);c=Sim.step(st,{ail:0,ele:0,rud:0,thr,mode:2},DT,env);if(c)break;if(t>6){maxT=Math.max(maxT,tilt(st));thrSum+=thr;n++;}}
  res.hover={crash:c,alt:+st.pos.y.toFixed(1),drift:+Math.hypot(st.pos.x,st.pos.z).toFixed(2),tilt:+maxT.toFixed(1),thr:+(thrSum/n).toFixed(2)};if(c||Math.abs(st.pos.y-10)>0.5||maxT>3)fail.push('hover');}
// 3. acro: full right roll for 0.5 s, then centre; rate, rotation and how well it stops
{const st=air(40);let peak=0,rot=0,after=0;for(let t=0;t<1.2;t+=DT){const ail=t<0.5?1:0;Sim.step(st,{ail,ele:0,rud:0,thr:0.4,mode:0},DT,env);const r=-st.w.z*57.3;if(t<0.5){peak=Math.max(peak,r);rot+=r*DT;}if(t>0.7)after=Math.max(after,Math.abs(r));}
  res.roll={peakDegS:+peak.toFixed(0),turnedDeg:+rot.toFixed(0),residualDegS:+after.toFixed(0)};if(peak<600||after>20)fail.push('roll');}
// 4. pitch flip (full pull) and yaw
{const st=air(40);let peak=0;for(let t=0;t<0.5;t+=DT){Sim.step(st,{ail:0,ele:1,rud:0,thr:0.4,mode:0},DT,env);peak=Math.max(peak,st.w.x*57.3);}res.pitch={peakDegS:+peak.toFixed(0)};if(peak<600)fail.push('pitch');}
{const st=air(40);let peak=0;for(let t=0;t<0.8;t+=DT){Sim.step(st,{ail:0,ele:0,rud:1,thr:hoverThr(st,40),mode:0},DT,env);peak=Math.max(peak,-st.w.y*57.3);}res.yaw={peakDegS:+peak.toFixed(0)};if(peak<300)fail.push('yaw');}
// 5. airmode: zero throttle mid-air still gives full roll authority
{const st=air(60);let peak=0;for(let t=0;t<0.4;t+=DT){Sim.step(st,{ail:1,ele:0,rud:0,thr:0,mode:0},DT,env);peak=Math.max(peak,-st.w.z*57.3);}res.airmode={peakDegS:+peak.toFixed(0)};if(peak<500)fail.push('airmode');}
// 6. Angle mode: full right stick holds the 55 deg limit and comes back level
{const st=air(40);let tl=0;for(let t=0;t<2;t+=DT){Sim.step(st,{ail:t<1.2?1:0,ele:0,rud:0,thr:hoverThr(st,40),mode:2},DT,env);if(Math.abs(t-1.1)<DT/2)tl=tilt(st);}res.angle={heldDeg:+tl.toFixed(0),afterDeg:+tilt(st).toFixed(1)};if(Math.abs(tl-AC.maxAngle)>5||tilt(st)>5)fail.push('angle');}
// 7. level top speed: full power at fixed tilts (Angle mode, limit raised), fastest tilt that still holds height
{let best=0;for(let th=36;th<=66;th+=3){M.applyAircraftPhysics(id);AC.maxAngle=th;const st=air(200);for(let t=0;t<7;t+=DT)Sim.step(st,{ail:0,ele:-1,rud:0,thr:1,mode:2},DT,env);if(st.vel.y>-0.5)best=Math.max(best,Math.hypot(st.vel.x,st.vel.z)*3.6);}
  M.applyAircraftPhysics(id);res.top={levelKmh:+best.toFixed(0)};if(best<100||Math.abs(best-S.vmax)/S.vmax>0.15)fail.push('top');}
// 8. gentle landing in Angle mode: descend at 0.8 m/s, cut at touchdown
{const st=air(6);let c=null,td=null;for(let t=0;t<15;t+=DT){const thr=st.onGround?0:clamp(Math.pow(AC.mass*AC.g/AC.Tmax,1/AC.thrExp)-0.15*(st.vel.y+0.8),0,1);c=Sim.step(st,{ail:0,ele:0,rud:0,thr,mode:2},DT,env);if(c)break;if(st.touchdown&&!td)td={sink:+st.touchdown.sink.toFixed(2)};}
  res.land=c||td;if(c||!td)fail.push('land');}
// 9. dropped from 10 m disarmed: must crash; 10. upside down on the ground: turtled
{const st=air(10);st.mT=[0,0,0,0];let c=null;for(let t=0;t<4;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:0,mode:0,arm:false},DT,env);if(c)break;}res.drop=c;if(!c||!/Hit the ground/.test(c))fail.push('drop');}
{const st=Sim.create();st.q.setFromAxisAngle(V(0,0,1),Math.PI);st.pos.y=0.09;st.time=1;st.airborne=true;let c=null;for(let t=0;t<3;t+=DT){c=Sim.step(st,{ail:0,ele:0,rud:0,thr:0,mode:0,arm:false},DT,env);if(c)break;}res.turtle=c;if(!c||!/Turtled/.test(c))fail.push('turtle');}
// 11. hover endurance to the 3.5 V per cell alarm
{const st=air(20);let t=0;for(;t<900;t+=DT*4){Sim.step(st,{ail:0,ele:0,rud:0,thr:hoverThr(st,20),mode:2},DT*4>0.02?DT:DT*4,env);if(st.volt<AC.cells*AC.alarmV)break;}res.hoverEndurance=+(t/60).toFixed(1)+' min';}
console.log(id,JSON.stringify(res,null,1));console.log(fail.length?'FAIL '+fail.join(','):'ALL PASS');process.exitCode=fail.length?1:0;
