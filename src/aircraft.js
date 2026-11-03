/* ---------- aircraft catalogue: geometry for the builder, physics overrides for the sim, price for the career ---------- */
const AC_BASE=JSON.parse(JSON.stringify(AC,(k,v)=>v&&v.isVector3?{__v3:[v.x,v.y,v.z]}:v),(k,v)=>v&&v.__v3?new THREE.Vector3(...v.__v3):v);
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const CUB_FUS=[[-0.318,0.064,0.070,0.000],[-0.300,0.078,0.086,0.002],[-0.250,0.084,0.096,0.006],[-0.200,0.086,0.104,0.010],[-0.130,0.086,0.118,0.020],[-0.040,0.084,0.112,0.018],[0.050,0.074,0.094,0.016],[0.140,0.058,0.074,0.018],[0.230,0.040,0.054,0.022],[0.300,0.024,0.036,0.028],[0.335,0.012,0.022,0.032]];
const SPORT_FUS=[[-0.330,0.050,0.060,0.004],[-0.300,0.072,0.078,0.006],[-0.230,0.080,0.090,0.008],[-0.150,0.080,0.092,0.010],[-0.060,0.076,0.088,0.010],[0.050,0.064,0.074,0.012],[0.150,0.048,0.058,0.016],[0.250,0.032,0.042,0.022],[0.330,0.018,0.026,0.028],[0.360,0.010,0.016,0.030]];
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
};
const WARDEN={id:'warden',name:'Coast Warden',geom:Object.assign({},AIRCRAFT.kestrel.geom,{k:1.3,tip:0.5,decal:'WARDEN'}),paint:{primary:'#F2EFE8',secondary:'#16365C',accent:'#F26522'}};
const UPGRADES={
  motor:[{name:'Stock',cost:0,T:1,I:1,Vp:1},{name:'Sport',cost:600,T:1.18,I:1.15,Vp:1.08},{name:'Race',cost:1500,T:1.35,I:1.32,Vp:1.15}],
  battery:[{name:'3S 2200',cost:0,cap:2.2,dm:0},{name:'3S 3000',cost:500,cap:3.0,dm:0.06}],
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
function applyAircraftPhysics(id){const A=AIRCRAFT[id],u=upOf(id);const keep=['wheels','crashPts','wingPos','tailPos','finPos'];
  for(const k in AC_BASE){if(keep.includes(k))continue;AC[k]=AC_BASE[k];}
  AC.wheels=AC_BASE.wheels.map(w=>({p:w.p.clone(),r:w.r,steer:w.steer}));
  Object.assign(AC,JSON.parse(JSON.stringify(A.phys,(k,v)=>k==='wheels'?undefined:v)));
  if(A.phys.wheels)AC.wheels=A.phys.wheels.map(w=>({p:w.p.clone(),r:w.r,steer:w.steer}));
  const m=UPGRADES.motor[u.motor],b=UPGRADES.battery[u.battery],p=UPGRADES.prop[u.prop];
  AC.Tmax*=m.T*p.T;AC.Imax*=m.I;AC.Vpitch*=m.Vp*p.Vp;AC.capAh=b.cap;AC.mass+=b.dm;
  const sc=A.phys.span/0.8;
  AC.crashPts=AC_BASE.crashPts.map(([n,p])=>[n,new THREE.Vector3(p.x*sc,p.y,p.z*A.geom.k)]);
  AC.features={flaps:false,gear:false};}
/* stats for the hangar bars, from the physics itself so they cannot drift from how the plane flies */
function statsOf(id){const A=AIRCRAFT[id],u=upOf(id);const P=Object.assign({},AC_BASE,A.phys);const m=UPGRADES.motor[u.motor],b=UPGRADES.battery[u.battery],p=UPGRADES.prop[u.prop];
  const T=P.Tmax*m.T*p.T,Vp=P.Vpitch*m.Vp*p.Vp,mass=P.mass+b.dm,CL=(P.CL0||0.25)+(P.CLa||4.3)*(P.aStall||0.245);
  const vs=Math.sqrt(2*mass*9.81/(1.18*P.S*CL))*3.6;
  let v=10;for(let i=0;i<60;i++){const thrust=T*Math.max(0,1-v/Vp);const D=0.5*1.18*v*v*P.S*(P.CD0+0.015);v+=(thrust-D)*0.4;v=Math.max(5,v);}
  const vmax=v*3.6,climb=(T/(mass*9.81)),roll=(P.Clda||0.06)/(P.Iroll||0.01)/6,endur=b.cap/(P.Imax*m.I*0.45)*60;
  return {vmax,vs,climb,roll,endur};}
