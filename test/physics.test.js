const THREE=require('three');
const Sim=require('../sim.js');
const {AC}=Sim;
const DT=1/240;
function env(wx,wz){return {wind:new THREE.Vector3(wx||0,0,wz||0),rho:1.18,surfaceAt:(x,z)=>(Math.abs(x)<3.5&&z<20&&z>-70)?'strip':'grass'};}
function att(st){const f=new THREE.Vector3(0,0,-1).applyQuaternion(st.q),up=new THREE.Vector3(0,1,0).applyQuaternion(st.q),rt=new THREE.Vector3(1,0,0).applyQuaternion(st.q);return {pitch:Math.asin(f.y)*180/Math.PI,roll:Math.atan2(rt.y,up.y)*180/Math.PI,hdg:(Math.atan2(f.x,-f.z)*180/Math.PI+360)%360};}
function run(name,st,ctrl,secs,e,every){e=e||env();every=every||1;let out=[];for(let t=0;t<secs;t+=DT){const inp=ctrl(t,st);const c=Sim.step(st,inp,DT,e);if(c){out.push(`${name} CRASH ${t.toFixed(1)}s: ${c}`);console.log(out.join('\n'));return 'crash';}if(Math.abs(t/every-Math.round(t/every))<DT/2){const a=att(st);out.push(`${name} ${t.toFixed(0).padStart(3)}s V=${(st.V*3.6).toFixed(0).padStart(3)}km/h alt=${st.pos.y.toFixed(1).padStart(5)} x=${st.pos.x.toFixed(1).padStart(6)} pitch=${a.pitch.toFixed(0).padStart(4)} roll=${a.roll.toFixed(0).padStart(4)} hdg=${a.hdg.toFixed(0).padStart(3)} nz=${st.nz.toFixed(1)} V=${st.volt.toFixed(1)}V${st.dbg?' Nfin='+st.dbg.Nfin.toFixed(3)+' Nsw='+st.dbg.Nswirl.toFixed(3)+' Nrate='+st.dbg.Nrate.toFixed(3)+' wN='+st.dbg.wN.map(x=>x.toFixed(1)).join('/')+' bf='+(st.dbg.bf*57.3).toFixed(1):''}`);}}console.log(out.join('\n'));return 'ok';}
function fly(alt,v,thr){const st=Sim.create();st.pos.set(0,alt,0);st.vel.set(0,0,-v);st.q.identity();st.airborne=true;st.onGround=false;st.thr=thr;st.time=1;return st;}
const test=process.argv[2]||'all';
if(test==='all'||test==='rest'){const st=Sim.create();run('REST',st,()=>({ail:0,ele:0,rud:0,thr:0}),3);}
function hold(s,target){let h=att(s).hdg;let err=((h-target+540)%360)-180;return Sim.clamp(-err/12,-1,1);}
function lvl(s){const rt=new THREE.Vector3(1,0,0).applyQuaternion(s.q),up=new THREE.Vector3(0,1,0).applyQuaternion(s.q);return Sim.clamp(1.5*Math.atan2(rt.y,up.y),-1,1);}
if(test==='all'||test==='to'){let st=Sim.create();run('TO0',st,(t)=>({ail:0,ele:0,rud:0,thr:t>1?1:0}),4);
 st=Sim.create();let lift=null;run('TO ',st,(t,s)=>{if(!lift&&s.airborne)lift={t,z:s.pos.z,V:s.V*3.6};return {ail:lvl(s),ele:lift?Sim.clamp(0.02*(s.V*3.6-45),-0.3,0.3):(t>2.5?0.15:0),rud:hold(s,0),thr:lift&&t>lift.t+3?0.6:(t>1?1:0)};},12);console.log('liftoff',lift);}
if(test==='all'||test==='taxi'){const st=Sim.create();run('TAXI',st,(t)=>({ail:0,ele:0,rud:t>2?0.5:0,thr:0.25}),5);}
if(test==='all'||test==='trim'){const st=fly(40,13,0.5);run('TRIM',st,()=>({ail:0,ele:0,rud:0,thr:0.5}),20,env(),2);}
if(test==='all'||test==='roll'){const st=fly(40,13,0.6);const a0=att(st).roll;run('ROLL',st,()=>({ail:1,ele:0,rud:0,thr:0.6}),0.5,env(),0.25);console.log('roll rate deg/s',((att(st).roll-a0)/0.5).toFixed(0));}
if(test==='all'||test==='rud'){const st=fly(40,13,0.6);const h0=att(st).hdg;run('RUD ',st,()=>({ail:0,ele:0,rud:0.5,thr:0.6}),1.5,env(),0.5);console.log('yaw after 1.5s half rudder',(att(st).hdg-h0).toFixed(0),'deg, roll',att(st).roll.toFixed(0));}
if(test==='all'||test==='stall'){const st=fly(60,13,0);run('STAL',st,(t)=>({ail:0,ele:0.7,rud:0,thr:0}),8,env(),0.5);}
if(test==='all'||test==='glide'){const st=fly(80,9.5,0);const y0=80;let z10=0,y10=0;run('GLID',st,(t,s)=>{if(Math.abs(t-10)<DT/2){z10=s.pos.z;y10=s.pos.y;}return {ail:lvl(s),ele:Sim.clamp(0.06*(s.V*3.6-34),-0.5,0.5),rud:0,thr:0};},30,env(),5);console.log('glide ratio 10-30s',(Math.abs(st.pos.z-z10)/(y10-st.pos.y)).toFixed(1));}
if(test==='all'||test==='loop'){const st=fly(60,19,1);run('LOOP',st,(t,s)=>{const rt=new THREE.Vector3(1,0,0).applyQuaternion(s.q),up=new THREE.Vector3(0,1,0).applyQuaternion(s.q);return {ail:-0.8*Math.atan2(rt.y,up.y)*0,ele:0.55,rud:0,thr:1};},4,env(),0.25);}
if(test==='all'||test==='land'){const st=fly(6,10,0.3);st.pos.z=40;const r=run('LAND',st,(t,s)=>{const rt=new THREE.Vector3(1,0,0).applyQuaternion(s.q),up=new THREE.Vector3(0,1,0).applyQuaternion(s.q);const roll=Math.atan2(rt.y,up.y);const flare=s.pos.y<0.7;const ele=flare?0.3:Sim.clamp(0.03*(s.V*3.6-36),-0.4,0.4);const thr=flare?0:Sim.clamp(0.25+0.2*(-1.2-s.vel.y),0,0.6);return {ail:Sim.clamp(1.5*roll,-1,1),ele,rud:0,thr};},14,env(),0.5);console.log('touchdown',st.touchdown);}
if(test==='all'||test==='hard'){const st=fly(3,10,0);st.vel.y=-2.8;run('HARD',st,()=>({ail:0,ele:0,rud:0,thr:0}),3,env(),0.5);}
if(test==='all'||test==='xwind'){const st=Sim.create();run('XWND',st,(t,s)=>({ail:lvl(s),ele:t>2.5?0.15:0,rud:hold(s,0),thr:t>1?1:0}),6,env(3,0),1);}
if(test==='all'||test==='batt'){const st=fly(40,13,1);for(let t=0;t<600;t+=DT){Sim.step(st,{ail:0,ele:0.02,rud:0,thr:1},DT,env());if(st.volt<10.8){console.log('alarm after',(t/60).toFixed(1),'min at full throttle, used',(st.usedAh*1000).toFixed(0),'mAh');break;}}}
