/*SIM-BEGIN*/
/* JG RoveaRange physics. Aero convention inside: X forward, Y right, Z down; L roll right+, M nose up+, N nose right+.
   Three.js body frame: x right, y up, z aft. Converted at the end of each step. */
const Sim=(function(THREE){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const V3=THREE.Vector3;
const AC={
  name:'CraycleCub V2', mass:0.62, features:{flaps:false,gear:false}, flapCL:0.9, flapCD:0.06, flapCm:-0.08, span:0.80, chord:0.19, S:0.152, AR:4.2, e:0.80,
  wingPos:new V3(0,0.03,0.004), incidence:0.026, CL0:0.25, CLa:4.3, aStall:0.245, stallW:0.035, CD0:0.055, Cm0:-0.035,
  St:0.026, tailPos:new V3(0,0.01,0.30), CLat:3.4, tauE:0.55, deMax:0.38, dEps:0.35, aStallT:0.30, tailWash:0.4, tailInc:-0.012,
  Sf:0.014, finPos:new V3(0,0.07,0.28), CLaf:2.6, tauR:0.55, drMax:0.52, finWash:0.4,
  CYb:-0.25, Clb:-0.025, Clp:-0.5, Clr:0.04, Cnp:-0.03, Cnr:-0.05, Clda:0.06, Cnda:-0.012,
  Tmax:7.2, Vpitch:30, propD:0.152, kTorque:0.005, kSwirl:0.005, spool:0.12, edf:false, ailWash:0, gearCD:0.010, gearTime:1.6, KV:2300, blades:2,
  Ipitch:0.012, Iyaw:0.018, Iroll:0.010,
  wheels:[{p:new V3(-0.12,-0.095,-0.07),r:0.025,steer:0},{p:new V3(0.12,-0.095,-0.07),r:0.025,steer:0},{p:new V3(0,-0.05,0.31),r:0.012,steer:0.25}],
  kWheel:600, cWheel:12, muLat:0.9, muRollStrip:0.035, muRollGrass:0.13,
  crashPts:[['left wingtip',new V3(-0.40,0.04,-0.04)],['right wingtip',new V3(0.40,0.04,-0.04)],['prop',new V3(0,-0.075,-0.33)],['fin',new V3(0,0.15,0.29)],['belly',new V3(0,-0.05,0.02)]],
  cells:3, capAh:2.2, rCell:0.008, Imax:22, Iidle:0.4, alarmV:3.6, g:9.81
};
const OCV=[[0,3.30],[0.08,3.55],[0.2,3.70],[0.5,3.80],[0.8,3.95],[1,4.20]];
function ocv(soc){soc=clamp(soc,0,1);for(let i=1;i<OCV.length;i++){if(soc<=OCV[i][0]){const s0=OCV[i-1][0],v0=OCV[i-1][1],s1=OCV[i][0],v1=OCV[i][1];return v0+(v1-v0)*(soc-s0)/(s1-s0);}}return 4.2;}
/* thrust as a fraction of static thrust at forward airspeed u.
   Propeller: falls roughly linearly to zero at the pitch speed.
   Ducted fan: momentum theory with a fixed fan pressure rise, Ve^2 = u^2 + Ve0^2, so T/T0 = s(s - x) with s = sqrt(1+x^2), x = u/Ve0,
   less inlet and duct losses that grow with speed. Much flatter than a prop: weak at the start of the take-off run, strong at speed. */
function thrustFactor(P,u){if(P.edf){const x=Math.max(u,0)/P.Vpitch,s=Math.sqrt(1+x*x);return clamp(s*(s-x)*(1-0.25*Math.min(x,1.5)),0,1);}
  return clamp(1-u/P.Vpitch,-0.15,1);}
function create(){
  return {pos:new V3(0,AC.spawnY||0.11,0),gearPos:0,vel:new V3(),q:new THREE.Quaternion().setFromAxisAngle(new V3(1,0,0),AC.spawnPitch===undefined?0.15:AC.spawnPitch),w:new V3(),
    thr:0,T:0,time:0,usedAh:0,volt:AC.cells*4.2,amp:0,soc:1,onGround:true,airborne:false,alpha:0,beta:0,V:0,nz:1,stall:0,
    touchdown:null,maxV:0,maxAlt:0,wheelN:[0,0,0],propAngle:0,stallSeed:Math.random()*6.28,surf:'strip',vsi:0};
}
// scratch
const _qi=new THREE.Quaternion(),_va=new V3(),_vb=new V3(),_F=new V3(),_tq=new V3(),_pw=new V3(),_ww=new V3(),_rw=new V3(),_vw=new V3(),
      _axle=new V3(),_roll=new V3(),_Fw=new V3(),_Fb=new V3(),_rxF=new V3(),_up=new V3(0,1,0),_dq=new THREE.Quaternion(),_ax=new V3(),_Iw=new V3(),_gy=new V3();
/* inp: {ail,ele,rud:-1..1, thr:0..1}; env: {wind:V3 world, rho, surfaceAt(x,z)->'strip'|'grass'} ; returns crash reason or null */
function step(st,inp,dt,env){
  st.time+=dt;
  const rho=env.rho||1.18;
  _qi.copy(st.q).invert();
  _va.copy(st.vel).sub(env.wind);
  _vb.copy(_va).applyQuaternion(_qi);
  const u=-_vb.z, v=_vb.x, wv=-_vb.y;
  const V=_vb.length();
  const p=-st.w.z, q=st.w.x, r=-st.w.y;
  // motor and battery
  const battF=Math.pow(st.volt/(AC.cells*4.2),2);
  st.thr+=(inp.thr-st.thr)*(1-Math.exp(-dt/AC.spool));
  let T=AC.Tmax*st.thr*battF*thrustFactor(AC,u);
  if(st.thr<0.02)T=0;
  st.T=T;
  const Ap=Math.PI*(AC.propD/2)*(AC.propD/2);
  const slip2=Math.max(T,0)*2/(rho*Ap);
  st.amp=AC.Iidle+AC.Imax*Math.pow(st.thr,1.7)*battF;
  st.usedAh+=st.amp*dt/3600; st.soc=1-st.usedAh/AC.capAh;
  st.volt=AC.cells*(ocv(st.soc)-st.amp*AC.rCell);
  // retractable gear: travels in gearTime seconds; the ESC-style weight-on-wheels lock stops it folding on the ground
  if(AC.features&&AC.features.gear){const want=inp.gear&&!st.onGround?1:0;st.gearPos=clamp(st.gearPos+clamp(want-st.gearPos,-dt/AC.gearTime,dt/AC.gearTime),0,1);}else st.gearPos=0;
  const gearDown=1-st.gearPos;
  // flow angles
  let alpha=0,beta=0,ex=1,ey=0,ez=0;
  if(V>0.3){alpha=Math.atan2(wv,Math.max(u,0.05*V));beta=Math.asin(clamp(v/V,-1,1));ex=u/V;ey=v/V;ez=wv/V;}
  const n=Math.hypot(ex,ez)||1; const lx=ez/n, lz=-ex/n; // lift direction (perp to flow, in symmetry plane)
  const qd=0.5*rho*V*V;
  // wing
  const df=inp.flap||0; // flap deflection, rad
  const aw=alpha+AC.incidence;
  const sig=1/(1+Math.exp(-(Math.abs(aw)-AC.aStall)/AC.stallW));
  const hb=clamp((st.pos.y-0.1)/AC.span,0,10), ge=Math.exp(-4*hb);
  let CL=((1-sig)*(AC.CL0+AC.flapCL*df+AC.CLa*aw)+sig*Math.sin(2*aw))*(1+0.06*ge);
  const CD=AC.CD0+AC.flapCD*df*df*6+CL*CL/(Math.PI*AC.AR*AC.e)*(1-0.55*ge)+sig*1.4*Math.sin(aw)*Math.sin(aw)+(st.thr<0.05&&!AC.edf?0.012:0)+(AC.features&&AC.features.gear?AC.gearCD*gearDown:0);
  const L=qd*AC.S*CL, D=qd*AC.S*CD;
  let FX=L*lx-D*ex, FY=-D*ey+qd*AC.S*AC.CYb*beta, FZ=L*lz-D*ez;
  let Lm=0,Mm=0,Nm=0;
  { const rx=-AC.wingPos.z, ry=AC.wingPos.x, rz=-AC.wingPos.y;
    Lm+=ry*FZ-rz*FY; Mm+=rz*FX-rx*FZ; Nm+=rx*FY-ry*FX; }
  Mm+=qd*AC.S*AC.chord*(AC.Cm0+AC.flapCm*df);
  // horizontal tail (in slipstream)
  const uT=Math.sqrt(Math.max(u,0)*Math.max(u,0)+AC.tailWash*slip2), Vt2=uT*uT+v*v+wv*wv, Vt=Math.sqrt(Vt2), lt=AC.tailPos.z;
  let at=(Vt>0.5?Math.atan2(wv*(1-AC.dEps),Math.max(uT,0.1)):0)+AC.tailInc-AC.tauE*inp.ele*AC.deMax+(Vt>1?q*lt/Vt:0);
  const sigT=1/(1+Math.exp(-(Math.abs(at)-AC.aStallT)/0.04));
  const CLt=(1-sigT)*AC.CLat*at+sigT*Math.sin(2*at);
  const qt=0.5*rho*Vt2;
  const Lt=qt*AC.St*CLt, Dt=qt*AC.St*(0.012+CLt*CLt/(Math.PI*3.5*0.8));
  const FXt=Lt*lx-Dt*ex, FZt=Lt*lz-Dt*ez;
  FX+=FXt; FZ+=FZt;
  { const rx=-lt, rz=-AC.tailPos.y; Mm+=rz*FXt-rx*FZt; }
  // fin (in slipstream)
  const uF=Math.sqrt(Math.max(u,0)*Math.max(u,0)+AC.finWash*slip2), Vf2=uF*uF+v*v+wv*wv, Vf=Math.sqrt(Vf2), lf=AC.finPos.z, hf=AC.finPos.y;
  const bf=(Vf>0.5?Math.atan2(v,Math.max(uF,0.1)):0)-(Vf>1?r*lf/Vf:0)+AC.tauR*inp.rud*AC.drMax;
  const FYf=0.5*rho*Vf2*AC.Sf*(-AC.CLaf*clamp(bf,-0.35,0.35));
  FY+=FYf; Lm+=hf*FYf; Nm+=-lf*FYf;
  // rate and control derivatives
  const b=AC.span;
  if(V>1){ const ph=p*b/(2*V), rh=r*b/(2*V), ailEff=1-0.8*sig;
    Lm+=qd*AC.S*b*(AC.Clb*beta+AC.Clp*ph+AC.Clr*rh+AC.Clda*inp.ail*ailEff+sig*0.03*Math.sin(st.time*1.7+st.stallSeed));
    Nm+=qd*AC.S*b*(AC.Cnp*ph+AC.Cnr*rh+AC.Cnda*inp.ail);
  } else { Lm+=-0.004*p; Nm+=-0.004*r; Mm+=-0.004*q; }
  // ailerons inside the slipstream: on a 3D airframe this is what holds the wings level in a prop hang
  if(AC.ailWash>0){const qs=0.5*rho*slip2*AC.ailWash;Lm+=qs*AC.S*b*AC.Clda*inp.ail-qs*AC.S*b*0.25*p*b/(2*Math.sqrt(slip2+V*V+1));}
  // propeller
  FX+=T;
  const slowF=clamp(1-V/18,0,1);
  Lm+=-AC.kTorque*T; Nm+=-AC.kSwirl*T*slowF;
  // to three body, then world
  _F.set(FY,-FZ,-FX).applyQuaternion(st.q);
  _F.y-=AC.mass*AC.g;
  _tq.set(Mm,-Nm,-Lm);
  st.nz=(-FZ)/(AC.mass*AC.g);
  // wheels
  let contact=false, maxN=0, crash=null, hit=0;
  for(let i=0;i<3;i++){
    const W=AC.wheels[i];
    if(st.gearPos>0.5)break;
    _pw.copy(W.p).applyQuaternion(st.q).add(st.pos);
    const pen=W.r-_pw.y; st.wheelN[i]=0;
    if(pen<=0)continue;
    _ww.copy(st.w).applyQuaternion(st.q); _rw.copy(W.p).applyQuaternion(st.q);
    _vw.copy(_ww).cross(_rw).add(st.vel);
    let N=AC.kWheel*pen-AC.cWheel*_vw.y; if(N<0)N=0;
    let steer=W.steer*inp.rud;
    /* nosewheel: throw limited so the turn never pulls more than 0.35 g sideways (tan d = a L / V^2); a narrow-track trike rolls over not far above that */
    if(W.steer<0){const L=Math.abs(W.p.z-AC.wheels[0].p.z),lim=Math.atan(0.35*AC.g*L/(V*V+1e-3));steer=clamp(steer,-lim,lim);}
    _axle.set(Math.cos(steer),0,-Math.sin(steer)).applyQuaternion(st.q); _axle.y=0; if(_axle.lengthSq()<1e-6)_axle.set(1,0,0); _axle.normalize();
    _roll.copy(_up).cross(_axle);
    const vlat=_vw.dot(_axle), vrol=_vw.dot(_roll);
    const surf=env.surfaceAt?env.surfaceAt(_pw.x,_pw.z):'strip'; if(i===0)st.surf=surf;
    const muR=surf==='strip'?AC.muRollStrip:AC.muRollGrass;
    _Fw.set(0,N,0).addScaledVector(_axle,-AC.muLat*N*clamp(vlat/0.12,-1,1)).addScaledVector(_roll,-muR*N*clamp(vrol/0.1,-1,1));
    _F.add(_Fw);
    _Fb.copy(_Fw).applyQuaternion(_qi); _tq.add(_rxF.copy(W.p).cross(_Fb));
    st.wheelN[i]=N; contact=true; if(N>maxN)maxN=N; if(-_vw.y>hit)hit=-_vw.y; _tq.y-=0.02*st.w.y;
  }
  st.nz+=maxN>0?(st.wheelN[0]+st.wheelN[1]+st.wheelN[2])/(AC.mass*AC.g):0;
  if(contact&&!st.onGround&&st.airborne){ st.touchdown={sink:-st.vel.y,speed:V,t:st.time}; if(-st.vel.y>2.6)crash='Hard landing at '+(-st.vel.y).toFixed(1)+' m/s down. Flare later and hold the nose up.'; }
  /* gear failure needs an impact: a high load alone can be the tail pressed down by the elevator in prop wash */
  if(contact&&st.time>0.5&&maxN>AC.mass*AC.g*7&&hit>1.2)crash=crash||'Gear collapsed. That was more than 7 g on the wheels.';
  st.onGround=contact;
  if(!contact&&st.pos.y>0.4)st.airborne=true;
  // integrate
  st.vel.addScaledVector(_F,dt/AC.mass);
  st.pos.addScaledVector(st.vel,dt);
  _Iw.set(AC.Ipitch*st.w.x,AC.Iyaw*st.w.y,AC.Iroll*st.w.z);
  _gy.copy(st.w).cross(_Iw);
  st.w.x+=(_tq.x-_gy.x)/AC.Ipitch*dt; st.w.y+=(_tq.y-_gy.y)/AC.Iyaw*dt; st.w.z+=(_tq.z-_gy.z)/AC.Iroll*dt;
  st.w.clampLength(0,25);
  const ang=st.w.length()*dt;
  if(ang>0){_dq.setFromAxisAngle(_ax.copy(st.w).normalize(),ang);st.q.multiply(_dq).normalize();}
  // crash points
  if(st.time>0.5&&!crash){
    for(const cp of AC.crashPts){_pw.copy(cp[1]).applyQuaternion(st.q).add(st.pos);
      if(_pw.y<0){if(st.gearPos>0.5&&(cp[0]==='nose'||cp[0]==='belly'||cp[0]==='prop')){crash='Landed with the gear up. Lower it on the downwind leg.';break;}crash=cp[0]==='prop'?(st.airborne&&!st.onGround?'Nosed in. Too much sink with the nose down.':st.thr>0.1?'Prop strike. The nose went over with power on.':'Nosed over.'):cp[0]==='fin'?'Went in inverted.':cp[0]==='belly'?(st.gearPos>0.5?'Landed with the gear up.':'Belly hit the ground.'):'Dragged the '+cp[0]+'.';break;}
    }
  }
  if(st.dbg){st.dbg.Nfin=-lf*FYf;st.dbg.Nswirl=-AC.kSwirl*T*slowF;st.dbg.Nrate=V>1?qd*AC.S*b*(AC.Cnp*(-st.w.z)*b/(2*V)+AC.Cnr*r*b/(2*V)):0;st.dbg.wN=st.wheelN.slice();st.dbg.bf=bf;}
  st.V=V; st.alpha=alpha; st.beta=beta; st.stall=sig; st.vsi=st.vel.y;
  if(V>st.maxV)st.maxV=V; if(st.pos.y>st.maxAlt)st.maxAlt=st.pos.y;
  st.propAngle+=(st.thr*AC.KV*AC.cells*4.2/60*6.28*0.02+V*2)*dt;
  return crash;
}
return {AC,create,step,ocv,clamp,thrustFactor};
})(typeof THREE!=='undefined'?THREE:require('three'));
/*SIM-END*/
if(typeof module!=='undefined')module.exports=Sim;
