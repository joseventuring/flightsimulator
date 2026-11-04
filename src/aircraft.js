/* ---------- aircraft catalogue: geometry for the builder, physics overrides for the sim, price for the career ---------- */
const AC_BASE=JSON.parse(JSON.stringify(AC,(k,v)=>v&&v.isVector3?{__v3:[v.x,v.y,v.z]}:v),(k,v)=>v&&v.__v3?new THREE.Vector3(...v.__v3):v);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const CUB_FUS=[[-0.318,0.064,0.070,0.000],[-0.300,0.078,0.086,0.002],[-0.250,0.084,0.096,0.006],[-0.200,0.086,0.104,0.010],[-0.130,0.086,0.118,0.020],[-0.040,0.084,0.112,0.018],[0.050,0.074,0.094,0.016],[0.140,0.058,0.074,0.018],[0.230,0.040,0.054,0.022],[0.300,0.024,0.036,0.028],[0.335,0.012,0.022,0.032]];
const SPORT_FUS=[[-0.330,0.050,0.060,0.004],[-0.300,0.072,0.078,0.006],[-0.230,0.080,0.090,0.008],[-0.150,0.080,0.092,0.010],[-0.060,0.076,0.088,0.010],[0.050,0.064,0.074,0.012],[0.150,0.048,0.058,0.016],[0.250,0.032,0.042,0.022],[0.330,0.018,0.026,0.028],[0.360,0.010,0.016,0.030]];
/* jet fuselage: pointed radome, 70 mm fan duct inside, exhaust at the tail */
const JET_FUS=[[-0.430,0.010,0.010,0.000],[-0.400,0.040,0.036,0.000],[-0.350,0.062,0.060,0.004],[-0.280,0.078,0.078,0.010],[-0.200,0.086,0.090,0.012],[-0.100,0.090,0.094,0.012],[0.000,0.088,0.090,0.010],[0.120,0.080,0.080,0.010],[0.240,0.070,0.068,0.012],[0.340,0.064,0.060,0.014],[0.400,0.062,0.056,0.014]];
/* 3D profile fuselage: a single flat side outline, the way EPP 3D planes are built */
const PROFILE_FUS=[[-0.400,0.008,0.070,0.000],[-0.330,0.008,0.110,0.000],[-0.200,0.008,0.160,0.010],[-0.080,0.008,0.150,0.010],[0.050,0.008,0.110,0.010],[0.200,0.008,0.070,0.010],[0.350,0.008,0.050,0.012],[0.470,0.008,0.040,0.014]];
/* tail sized from tail-volume coefficients, so a bigger aircraft keeps the stability the small ones were tuned to.
   VH = St*lt/(S*c), VV = Sf*lf/(S*b). Tail arm comes from where the builder puts the stabiliser. */
function tailFrom(g,ph,VH,VV){const lt=g.stabZ*g.k+0.055*g.tail;const yS=g.fus[g.fus.length-3][3]*g.k+0.008;
  return {tailPos:{x:0,y:yS,z:lt},finPos:{x:0,y:yS+0.05*g.tail,z:lt-0.01},St:VH*ph.S*ph.chord/lt,Sf:VV*ph.S*ph.span/lt};}
/* crash points from the geometry: wingtips, the prop (or nose), the fin top and the belly */
function crashFrom(g,propR){const k=g.k,F=g.fus,sw=g.sweep||0,tr=g.taper||1,tx=g.tip*Math.cos(sw),tz=g.LE+g.tip*Math.sin(sw)+(g.hinge||0.75)*g.C*(1-tr)+g.C*tr*0.5,ty=g.wingY+tx*Math.sin(g.dih||0);
  const yS=F[F.length-3][3]*k+0.008;let belly=0;F.forEach(([z,w,h,y])=>{if(Math.abs(z*k)<0.18)belly=Math.min(belly,(y-h/2)*k);});
  const nose=g.edf?['nose',{x:0,y:(F[1][3]-F[1][2]/2)*k,z:F[0][0]*k}]:['prop',{x:0,y:F[0][3]*k-propR,z:F[0][0]*k-0.02}];
  return [['left wingtip',{x:-tx,y:ty,z:tz}],['right wingtip',{x:tx,y:ty,z:tz}],nose,['fin',{x:0,y:yS+0.115*g.tail,z:g.stabZ*k+0.03*g.tail}],['belly',{x:0,y:belly,z:0.02}]];}
const AIRCRAFT={
  cub:{id:'cub',name:'CraycleCub V2',role:'Trainer',price:0,blurb:'Your real plane. High wing, forgiving, slow to stall.',
    geom:{fus:CUB_FUS,cowl:4,k:1,wingY:0.066,LE:-0.135,C:0.19,tip:0.40,ail:[0.11,0.31],dih:0.05,struts:true,cabin:'side',stabZ:0.245,tail:1,spin:0.026},
    phys:{name:'CraycleCub V2',mass:0.62,span:0.8,chord:0.19,S:0.152,AR:4.2,Tmax:7.2,Vpitch:30,CD0:0.055,Clb:-0.025,Clda:0.06,Ipitch:0.012,Iroll:0.010,Iyaw:0.018,capAh:2.2,Imax:22},
    paint:{primary:'#202429',secondary:'#F2EFE8',accent:'#F26522'}},
  kestrel:{id:'kestrel',name:'Kestrel 900',role:'Sport',price:1500,blurb:'Low wing, about 90 km/h, rolls crisply. Less self-righting than the Cub.',
    geom:{fus:SPORT_FUS,cowl:3,k:1.06,wingY:-0.028,LE:-0.125,C:0.20,tip:0.45,ail:[0.14,0.40],dih:0.03,struts:false,cabin:'bubble',stabZ:0.27,tail:1.05,spin:0.028},
    phys:{name:'Kestrel 900',mass:0.78,span:0.9,chord:0.20,S:0.18,AR:4.5,Tmax:10.5,Vpitch:40,CD0:0.042,Clb:-0.015,kTorque:0.0032,kSwirl:0.0035,Clda:0.07,Cm_a:-0.85,Ipitch:0.016,Iroll:0.016,Iyaw:0.024,capAh:2.2,Imax:30,
      wheels:[{p:V(-0.13,-0.10,-0.08),r:0.028,steer:0},{p:V(0.13,-0.10,-0.08),r:0.028,steer:0},{p:V(0,-0.04,0.34),r:0.013,steer:0.25}]},
    paint:{primary:'#1F4E79',secondary:'#F2EFE8',accent:'#F5C542'}},
  talon:{id:'talon',name:'Talon 760',role:'Racer',price:4000,blurb:'Clipped wings, big motor, about 124 km/h flat out. Lands hot and needs flying all the time.',
    geom:{fus:SPORT_FUS,cowl:3,k:0.95,wingY:0.0,LE:-0.095,C:0.17,tip:0.38,ail:[0.10,0.35],dih:0.0,struts:false,cabin:'bubble',stabZ:0.25,tail:0.9,spin:0.027},
    phys:{name:'Talon 760',mass:0.70,span:0.76,chord:0.17,S:0.13,AR:4.4,Tmax:12,Vpitch:52,CD0:0.030,aStall:0.22,CL0:0.16,incidence:0.01,Clb:-0.02,kTorque:0.0022,kSwirl:0.0025,Clda:0.06,Cm_a:-0.70,Ipitch:0.011,Iroll:0.011,Iyaw:0.015,capAh:2.2,Imax:38,
      wheels:[{p:V(-0.12,-0.095,-0.06),r:0.025,steer:0},{p:V(0.12,-0.095,-0.06),r:0.025,steer:0},{p:V(0,-0.04,0.31),r:0.012,steer:0.25}]},
    paint:{primary:'#E8503A',secondary:'#1B222B',accent:'#F7F4EE'}},
  arrow:{id:'arrow',name:'Arrow S-05',role:'Sport',price:2500,blurb:'1.2 m low wing, 2826 motor on 4S, about 100 km/h. Three-position flaps, a smooth cruise and honest manners. The step up from the Kestrel.',
    geom:{fus:SPORT_FUS,cowl:3,k:1.38,wingY:-0.04,LE:-0.086,C:0.25,tip:0.60,taper:0.8,ail:[0.30,0.55],dih:0.035,flaps:true,struts:false,cabin:'bubble',stabZ:0.29,tail:1.45,spin:0.034,propR:0.14,gearTop:-0.045},
    phys:{name:'Arrow S-05',mass:1.30,span:1.20,chord:0.226,S:0.27,AR:5.3,Tmax:20,Vpitch:42,CD0:0.036,CL0:0.22,Clb:-0.018,Clda:0.07,Cm_a:-0.8,kTorque:0.0045,kSwirl:0.005,propD:0.279,
      Ipitch:0.045,Iroll:0.042,Iyaw:0.07,cells:4,capAh:2.2,Imax:40,KV:1000,features:{flaps:true,gear:false},
      wheels:[{p:V(-0.17,-0.14,-0.13),r:0.035,steer:0},{p:V(0.17,-0.14,-0.13),r:0.035,steer:0},{p:V(0,-0.03,0.47),r:0.018,steer:0.25}]},
    tail:[0.40,0.030],paint:{primary:'#F5C542',secondary:'#1B222B',accent:'#E8503A'}},
  vortex:{id:'vortex',name:'Vortex X-06',role:'3D',price:3000,blurb:'Light EPP profile, huge surfaces, more than twice as much thrust as weight. It hangs on the prop at about half throttle and flies at walking pace. Torque rolls it in a hover, so keep flying the ailerons. Take off on low rate: full throw at take-off speed tumbles it.',
    geom:{fus:PROFILE_FUS,profile:true,cowl:2,k:1,wingY:0.0,LE:-0.093,C:0.30,tip:0.50,taper:0.75,hinge:0.62,airfoil:'sym',ail:[0.07,0.48],dih:0,struts:false,cabin:'none',stabZ:0.35,tail:1.86,spin:0.022,propR:0.127,gearTop:-0.06},
    phys:{name:'Vortex X-06',mass:0.40,span:1.0,chord:0.264,S:0.26,AR:3.85,Tmax:8.5,Vpitch:24,CD0:0.065,CL0:0,CLa:4.0,incidence:0,Cm0:0,aStall:0.24,stallW:0.05,Clb:-0.008,Clda:0.11,
      deMax:0.70,drMax:0.70,tauE:0.6,tauR:0.6,aStallT:0.35,tailInc:-0.022,tailWash:0.75,finWash:0.75,ailWash:0.35,kTorque:0.006,kSwirl:0.006,spool:0.08,propD:0.254,
      Ipitch:0.010,Iroll:0.008,Iyaw:0.015,cells:3,capAh:1.0,Imax:18,KV:1400,features:{flaps:false,gear:false},
      wheels:[{p:V(-0.13,-0.15,-0.07),r:0.035,steer:0},{p:V(0.13,-0.15,-0.07),r:0.035,steer:0},{p:V(0,-0.012,0.43),r:0.015,steer:0.25}]},
    tail:[0.55,0.06],paint:{primary:'#2F6B3A',secondary:'#F2EFE8',accent:'#F26522'}},
  comet:{id:'comet',name:'Comet J-09',role:'Jet',price:6000,blurb:'70 mm ducted fan on 6S, swept wing, retracts and flaps. The fan lags the stick and has little shove at low speed, then it is the fastest thing on the field, near 150 km/h. Lower the gear before you land.',
    geom:{fus:JET_FUS,edf:true,cowl:3,k:1.33,wingY:-0.025,LE:-0.218,C:0.30,tip:0.68,taper:0.55,sweep:0.40,hinge:0.72,ail:[0.34,0.63],dih:0.02,flaps:true,struts:false,cabin:'bubble',stabZ:0.32,tail:1.25,spin:0.02,propR:0,gearTop:-0.035},
    phys:{name:'Comet J-09',mass:1.50,span:1.20,chord:0.239,S:0.279,AR:5.2,Tmax:21,Vpitch:55,edf:true,CD0:0.024,CL0:0.12,incidence:0.005,aStall:0.21,Cm0:-0.02,Clb:-0.02,Clda:0.06,Cm_a:-0.8,
      tailWash:0,finWash:0,kTorque:0.0004,kSwirl:0,spool:0.35,propD:0.07,gearCD:0.012,
      Ipitch:0.06,Iroll:0.04,Iyaw:0.09,cells:6,capAh:3.3,Imax:65,KV:1950,rCell:0.004,blades:12,features:{flaps:true,gear:true},
      wheels:[{p:V(-0.15,-0.14,0.06),r:0.03,steer:0},{p:V(0.15,-0.14,0.06),r:0.03,steer:0},{p:V(0,-0.145,-0.30),r:0.025,steer:-0.25}]},
    tail:[0.40,0.035],paint:{primary:'#F2EFE8',secondary:'#1B222B',accent:'#1F4E79'}},
  hoverwing:{id:'hoverwing',name:'Hoverwing V-14',role:'VTOL',price:5000,blurb:'1.6 m QuadPlane: four lift motors on booms and a separate cruise prop. Takes off straight up in Hover mode, then flip to Plane mode and it transitions to wing-borne flight on its own. Flip back to Hover and it brakes itself to a stop so you can land on a spot. About 7 minutes hovering, over 20 in plane mode.',
    geom:{fus:SPORT_FUS,cowl:3,k:1.5,wingY:0.055,LE:-0.10,C:0.27,tip:0.80,taper:0.75,ail:[0.45,0.76],dih:0.03,struts:false,cabin:'bubble',stabZ:0.30,tail:1.5,spin:0.03,propR:0.115,gearTop:-0.05,
      vtol:{x:0.32,z:0.29,y:0.09,R:0.127}},
    phys:{name:'Hoverwing V-14',kind:'vtol',mass:2.4,span:1.6,chord:0.236,S:0.38,AR:6.7,Tmax:18,Vpitch:32,CD0:0.048,CL0:0.25,Clb:-0.02,Clda:0.07,kTorque:0.004,kSwirl:0.004,propD:0.254,
      Ipitch:0.13,Iroll:0.19,Iyaw:0.30,cells:6,capAh:6.0,Imax:35,KV:900,rCell:0.003,alarmV:3.5,
      liftTmax:58,liftVpitch:30,liftX:0.32,liftZ:0.29,liftY:0.09,liftImax:150,thrExp:1.6,motorTau:0.06,kQ:0.016,maxAngle:30,kAngle:4,rateMax:180,yawMax:60,kP:10,kPy:6,kI:4,kD:0.15,vTrans:12.5,
      features:{flaps:false,gear:false,vtol:true},
      wheels:[{p:V(-0.15,-0.14,0.05),r:0.03,steer:0},{p:V(0.15,-0.14,0.05),r:0.03,steer:0},{p:V(0,-0.145,-0.36),r:0.025,steer:-0.25}]},
    tail:[0.45,0.035],paint:{primary:'#F2EFE8',secondary:'#2F6B3A',accent:'#F26522'}},
  rotor:{id:'rotor',name:'Rotor R-20',role:'Helicopter',kind:'heli',price:8000,blurb:'700 class collective-pitch 3D helicopter on 12S, 1.58 m rotor, governed at 2100 rpm. The throttle stick is collective pitch, the tail is on a heading-hold gyro. Wait for spool-up before lifting. Throttle hold (H, or the cut switch) cuts the motor: lower the collective, let it autorotate, flare at the bottom.',
    geom:{heli:true,k:1,R:0.79},
    phys:{name:'Rotor R-20',kind:'heli',mass:5.0,span:1.58,rotorR:0.79,headspeed:220,sigma:0.052,cla:5.7,cd0:0.009,collMin:-6,collMax:12,spoolTime:5,Irotor:0.08,govP:8,govI:4,Pmax:5000,motorEff:0.88,
      tailL:0.95,tailTmax:40,hubK:80,hubH:0.25,flapback:0.0015,flapTau:0.035,rotDamp:0.8,cyclicMax:10,kH:0.004,CdA:[0.08,0.18,0.05],
      Ipitch:0.55,Iroll:0.22,Iyaw:0.5,rateC:180,rateMax:380,yawMax:500,maxAngle:35,kAngle:5,kP:14,kPy:12,kI:6,cells:12,capAh:5.0,rCell:0.003,alarmV:3.5,KV:500,blades:2,kWheel:6000,cWheel:60,spawnY:0.303,
      contacts:[{x:-0.13,y:-0.30,z:-0.25},{x:0.13,y:-0.30,z:-0.25},{x:-0.13,y:-0.30,z:0.20},{x:0.13,y:-0.30,z:0.20},{x:0,y:-0.08,z:1.15},{x:0,y:-0.16,z:1.12},{x:0,y:-0.12,z:-0.42},{x:0,y:0.30,z:0},{x:-0.12,y:0.05,z:0},{x:0.12,y:0.05,z:0}],features:{flaps:false,gear:false}},
    paint:{primary:'#F5C542',secondary:'#1B222B',accent:'#E8503A'}},
  sprint:{id:'sprint',name:'Sprint Q-16',role:'FPV quad',kind:'quad',price:3500,blurb:'5 inch freestyle quad, 650 g on 6S, eight times more thrust than weight. Acro by default like a real FPV quad: the sticks set rotation rates and nothing levels it for you. Horizon and Angle are on the stabiliser button.',
    geom:{quad:true,k:1,arm:0.0795,propR:0.0635},
    phys:{name:'Sprint Q-16',kind:'quad',mass:0.65,span:0.225,arm:0.0795,Tmax:54,thrExp:1.6,Vpitch:48,motorTau:0.03,kQ:0.016,kH:0.006,CdA:[0.010,0.020,0.008],
      Ipitch:0.0016,Iroll:0.0013,Iyaw:0.0026,rateC:200,rateMax:720,yawMax:450,maxAngle:55,kAngle:7,kP:60,kPy:30,kI:15,kD:1.2,
      cells:6,capAh:1.1,Imax:120,Iidle:0.6,rCell:0.005,KV:1750,blades:3,propD:0.127,kWheel:2500,cWheel:20,alarmV:3.4,spawnY:0.022,
      contacts:[{x:-0.0795,y:-0.02,z:-0.0795},{x:0.0795,y:-0.02,z:-0.0795},{x:-0.0795,y:-0.02,z:0.0795},{x:0.0795,y:-0.02,z:0.0795},{x:0,y:0.075,z:0},{x:0,y:0.0,z:-0.075},{x:0,y:0.0,z:0.08},
        {x:-0.0795,y:0.03,z:-0.0795},{x:0.0795,y:0.03,z:-0.0795},{x:-0.0795,y:0.03,z:0.0795},{x:0.0795,y:0.03,z:0.0795}],features:{flaps:false,gear:false}},
    paint:{primary:'#E8503A',secondary:'#1B222B',accent:'#F5C542'}},
};
/* gear springs scale with weight so every aircraft sits and rebounds like the 620 g Cub they were tuned on */
['arrow','vortex','comet','hoverwing'].forEach(id=>{const A=AIRCRAFT[id],m=A.phys.mass/0.62;Object.assign(A.phys,tailFrom(A.geom,A.phys,A.tail[0],A.tail[1]),{crashPts:crashFrom(A.geom,A.geom.propR),kWheel:600*m,cWheel:12*Math.sqrt(m)});});
const WARDEN={id:'warden',name:'Coast Warden',geom:Object.assign({},AIRCRAFT.kestrel.geom,{k:1.3,tip:0.5,decal:'WARDEN'}),paint:{primary:'#F2EFE8',secondary:'#16365C',accent:'#F26522'}};
const UPGRADES={
  motor:[{name:'Stock',cost:0,T:1,I:1,Vp:1},{name:'Sport',cost:600,T:1.18,I:1.15,Vp:1.08},{name:'Race',cost:1500,T:1.35,I:1.32,Vp:1.15}],
  battery:[{name:'Stock pack',cost:0,cap:1,dm:0},{name:'Big pack',cost:500,cap:1.36,dm:0.08}],
  prop:[{name:'Standard',cost:0,Vp:1,T:1},{name:'High pitch',cost:400,Vp:1.15,T:0.94}],
};
const PAINTS=['#202429','#F2EFE8','#F26522','#1F4E79','#E8503A','#2F6B3A','#F5C542','#7A4FA0','#5A6676','#16365C'];
/* career save (save-systems skill: versioned, validated) */
const career=Object.assign({credits:500,owned:['cub'],selected:'cub',paint:{},up:{},chapter:0,bounty:0,busts:0,escapes:0},store.get('jgsim.career',{}));
career.credits=num(career.credits,500,0,1e7);if(!Array.isArray(career.owned)||!career.owned.includes('cub'))career.owned=['cub'];if(!AIRCRAFT[career.selected]||!career.owned.includes(career.selected))career.selected='cub';
['paint','up'].forEach(k=>{if(!career[k]||typeof career[k]!=='object')career[k]={};});
function saveCareer(){store.set('jgsim.career',career);}
function upOf(id){return Object.assign({motor:0,battery:0,prop:0},career.up[id]||{});}
function paintOf(id){return Object.assign({},AIRCRAFT[id].paint,career.paint[id]||{});}
/* apply an aircraft and its upgrades to the live flight model */
const toV=o=>new THREE.Vector3(o.x,o.y,o.z);
function applyAircraftPhysics(id){const A=AIRCRAFT[id],u=upOf(id);const vec=['wheels','crashPts','wingPos','tailPos','finPos','features','contacts'];
  for(const k in AC){if(!(k in AC_BASE))delete AC[k];} // a quad's fields must not leak into the next plane
  for(const k in AC_BASE){if(vec.includes(k))continue;AC[k]=AC_BASE[k];}
  ['wingPos','tailPos','finPos'].forEach(k=>AC[k]=toV(A.phys[k]||AC_BASE[k]));
  AC.wheels=(A.phys.wheels||AC_BASE.wheels).map(w=>({p:w.p.clone(),r:w.r,steer:w.steer}));
  Object.assign(AC,JSON.parse(JSON.stringify(A.phys,(k,v)=>vec.includes(k)?undefined:v)));
  const m=UPGRADES.motor[u.motor],b=UPGRADES.battery[u.battery],p=UPGRADES.prop[u.prop];
  AC.Tmax*=m.T*p.T;AC.Imax*=m.I;AC.Vpitch*=m.Vp*p.Vp;AC.capAh*=b.cap;AC.mass*=1+b.dm;
  const sc=A.phys.span/0.8;
  AC.crashPts=A.phys.crashPts?A.phys.crashPts.map(([n,p])=>[n,toV(p)]):AC_BASE.crashPts.map(([n,p])=>[n,new THREE.Vector3(p.x*sc,p.y,p.z*A.geom.k)]);
  AC.features=Object.assign({flaps:false,gear:false},A.phys.features||{});
  if(AC.kind==='quad'||AC.kind==='heli'){AC.contacts=A.phys.contacts.map(toV);AC.wheels=[];AC.crashPts=[];AC.spawnPitch=0;AC.spawnY=A.phys.spawnY;return;}
  /* resting attitude: the angle that puts the main wheels and the third wheel on the ground together */
  const W=AC.wheels,ym=W[0].p.y-W[0].r,yt=W[2].p.y-W[2].r,th=Math.atan((ym-yt)/(W[0].p.z-W[2].p.z));
  AC.spawnPitch=th;AC.spawnY=-(ym*Math.cos(th)-W[0].p.z*Math.sin(th))+0.002;}
/* stats for the hangar bars, from the physics itself so they cannot drift from how the plane flies */
/* the pack a battery upgrade gives this aircraft, e.g. 4S 3000 */
function packName(id,i){const P=Object.assign({},AC_BASE,AIRCRAFT[id].phys);return P.cells+'S '+Math.round(P.capAh*UPGRADES.battery[i].cap*10)*100;}
function statsOf(id){const A=AIRCRAFT[id],u=upOf(id);const P=Object.assign({},AC_BASE,A.phys);const m=UPGRADES.motor[u.motor],b=UPGRADES.battery[u.battery],p=UPGRADES.prop[u.prop];
  if(P.kind==='heli'){/* hover collective from blade-element + momentum; top speed where power required meets 90% of motor power */
    const R=P.rotorR,A=Math.PI*R*R,OR=P.headspeed*R,r=1.18,mass=P.mass*(1+b.dm),W=mass*9.81,Pa=P.Pmax*m.T*0.9;
    const ctH=W/(r*A*OR*OR),thH=(ctH/(P.sigma*P.cla/4*0.95)+Math.sqrt(ctH/2))*1.5;const hov=(thH*57.3-P.collMin)/(P.collMax-P.collMin);
    const P0=v=>P.sigma*P.cd0/8*r*A*OR*OR*OR*(1+4.6*(v/OR)**2);let vmax=0;
    /* same forces as the sim: for each speed, the forward tilt that holds height, then the rotor power that needs */
    for(let v=1;v<80;v+=0.5){let ok=false;for(let th=0.02;th<1.2;th+=0.01){const vy=v*Math.sin(th),vz=v*Math.cos(th),Dy=0.5*r*P.CdA[1]*v*vy,Dz=0.5*r*P.CdA[2]*v*vz;
        /* thrust needed along the disc so the vertical balance closes, then check the forward balance */
        const T=(W+Dy*Math.cos(th)-Dz*Math.sin(th))/(Math.cos(th)-P.kH*vz*Math.sin(th));if(T<=0)continue;const fw=T*Math.sin(th)-Dy*Math.sin(th)-(P.kH*T*vz+Dz)*Math.cos(th);if(fw<0)continue;
        let vi=Math.sqrt(T/(2*r*A));for(let k=0;k<20;k++)vi=T/(2*r*A*Math.sqrt(vz*vz+(vy+vi)*(vy+vi)));if(T*(vy+vi)*1.15+P0(vz)<=Pa){ok=true;break;}}
      if(!ok)break;vmax=v;}
    const thM=P.collMax/57.3;let ct=0.004;for(let k=0;k<30;k++)ct=P.sigma*P.cla/4*0.95*(2/3*thM-Math.sqrt(Math.max(ct,0)/2));
    const Ph=W*Math.sqrt(W/(2*r*A))*1.15+P0(0),Ih=Ph/P.motorEff/(P.cells*3.8);
    return {quad:true,vmax:vmax*3.6,vs:hov*100,climb:Math.min(ct*r*A*OR*OR,Pa/Math.sqrt(W/(2*r*A))/1.15)/W,roll:P.rateMax,endur:P.capAh*b.cap*0.75/Ih*60};}
  if(P.kind==='quad'){/* top speed: full power, tilted until thrust only just holds height; rotor and body drag balance what is left */
    const T=P.Tmax*m.T*p.T,Vp=P.Vpitch*m.Vp*p.Vp,mass=P.mass*(1+b.dm),W=mass*9.81;let vmax=0;
    /* same terms as the sim: inflow through the tilted disc, sag at full current, body drag on both axes, rotor drag.
       For each speed find the tilt that holds height, then check there is still forward force left. */
    const sag=Math.pow((4.1-P.Imax*m.I*P.rCell)/4.2,2),r=0.5*1.18;
    const net=(v,th)=>{const vy=v*Math.sin(th),vz=v*Math.cos(th),Te=T*sag*Math.max(0,1-vy/Vp);const Fy=Te-r*P.CdA[1]*v*vy,Ff=-(P.kH*Te*vz+r*P.CdA[2]*v*vz);
      return [Fy*Math.cos(th)-Ff*Math.sin(th)-W,Fy*Math.sin(th)+Ff*Math.cos(th)];};
    for(let v=1;v<90;v+=0.5){let ok=false;for(let th=0.02;th<1.55;th+=0.01){const [up,fw]=net(v,th);if(up<0)break;if(fw>0)ok=true;}if(!ok)break;vmax=v;}
    const hov=Math.pow(W/T,1/P.thrExp),Ih=P.Iidle+P.Imax*m.I*Math.pow(W/T,1.5);
    return {quad:true,vmax:vmax*3.6,vs:hov*100,climb:T/W,roll:P.rateMax,endur:P.capAh*b.cap*0.72/Ih*60};}
  const T=P.Tmax*m.T*p.T,Vp=P.Vpitch*m.Vp*p.Vp,mass=P.mass*(1+b.dm),CL=P.CL0+P.CLa*P.aStall;
  const vs=Math.sqrt(2*mass*9.81/(1.18*P.S*CL))*3.6;
  let v=10;for(let i=0;i<80;i++){const thrust=T*Math.max(0,Sim.thrustFactor({edf:P.edf,Vpitch:Vp},v));const D=0.5*1.18*v*v*P.S*(P.CD0+0.015);v+=(thrust-D)*0.4;v=Math.max(5,v);}
  /* steady roll rate at 60% of top speed: p = (Clda/-Clp) * 2V/b */
  const vmax=v*3.6,climb=(T/(mass*9.81)),roll=P.Clda/(-P.Clp)*2*(0.6*v)/P.span*57.3,endur=P.capAh*b.cap/(P.Imax*m.I*0.45)*60;
  return {vmax,vs,climb,roll,endur};}
