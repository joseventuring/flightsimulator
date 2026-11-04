/* ---------- gates ---------- */
const GATES=[[0,10,-120,0],[60,14,-140,Math.PI/2],[95,12,-70,Math.PI*0.75],[55,16,-10,Math.PI],[-55,11,-20,Math.PI*1.3],[-85,14,-90,Math.PI*1.6]];
const gateMeshes=[],gateObjs=[];
const gateM=lam(0xF26522), gateDim=lam(0x7a5a4a), gateDone=lam(0x5FD38D);
GATES.forEach(g=>{const grp=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(3.5,0.15,10,36),gateDim);ring.castShadow=true;grp.add(ring);const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,g[1]-3.5,6),lam(0x202429));pole.position.y=-(g[1]-3.5)/2-3.5;grp.add(pole);grp.position.set(g[0],g[1],g[2]);grp.rotation.y=g[3];grp.visible=false;scene.add(grp);gateMeshes.push(ring);const n=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),g[3]);gateObjs.push({pos:new THREE.Vector3(g[0],g[1],g[2]),n,grp});});
const gate={i:0,t0:0,running:false,lastD:0};

/* ---------- environment ---------- */
const wind={gx:0,gy:0,gz:0,vec:new THREE.Vector3(),mean:new THREE.Vector3()};
function randn(){let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function updateWind(dt){
  const s=settings.wind, th=settings.wdir*Math.PI/180, gi=settings.gust/100;
  wind.mean.set(-Math.sin(th)*s,0,Math.cos(th)*s);
  const tau=2.0, sig=0.35*s*gi, k=Math.exp(-dt/tau), n=sig*Math.sqrt(1-k*k);
  wind.gx=wind.gx*k+n*randn(); wind.gz=wind.gz*k+n*randn(); wind.gy=wind.gy*k+0.4*n*randn();
  const h=Math.max(st.pos.y,0.1);
  const f=clamp(Math.log(h/0.03)/Math.log(10/0.03),0.2,1.15);
  wind.vec.set((wind.mean.x+wind.gx)*f,wind.gy*f,(wind.mean.z+wind.gz)*f);
}
const env={wind:wind.vec,rho:1.18,ground:(x,z)=>terrainH(x,z),surfaceAt:(x,z)=>(Math.abs(x)<3.5&&z<20&&z>-70)?'strip':'grass'};

/* ---------- field marshal ---------- */
const MSG=[];const cool={};
function say(text,kind,key,cd){const now=st.time;if(key){if(cool[key]&&now-cool[key]<(cd||10))return;cool[key]=now;}MSG.push({t:now,text,kind:kind||''});if(MSG.length>3)MSG.shift();renderMarshal();}
/* messages fade after a few seconds so the sky stays clear (sooner on a phone screen) */
function ageMarshal(){const life=MOBILE?6:12;const n=MSG.length;while(MSG.length&&st.time-MSG[0].t>life)MSG.shift();if(MSG.length!==n)renderMarshal();}
function renderMarshal(){$('marshal').innerHTML=MSG.map(m=>`<div class="m ${m.kind}"><b>${fmtTime(m.t)}</b> ${m.text}</div>`).join('');}
function violation(text,key){if(cool['v'+key]&&st.time-cool['v'+key]<8)return;cool['v'+key]=st.time;G.viol++;logbook.violations++;save();say(text,'bad');}
function marshal(){
  if(!st.airborne)return;
  /* height above the ground under the aircraft, against this site's green-zone ceiling (120 m, or 60 m within 8 to 12 km of an airport) */
  const alt=st.pos.y-Math.max(0,terrainH(st.pos.x,st.pos.z)), d=Math.hypot(st.pos.x-PILOT_EYE.x,st.pos.z-PILOT_EYE.z), ceil=MAP.air.ceil||120;
  if(alt>=ceil)violation('Above the '+ceil+' m green-zone ceiling here. Descend now.','ceil');
  else if(alt>=ceil-20)say('Altitude '+Math.round(alt)+' m. Ceiling here is '+ceil+' m above ground.','warn','alt',15);
  if(st.pos.z>2&&Math.abs(st.pos.x)<80&&alt>0.5&&!st.onGround)violation('Behind the flight line. Turn out, now.','line');
  if(st.pos.x>6&&st.pos.x<32&&st.pos.z>-2&&st.pos.z<22&&alt<30&&!st.onGround)violation('Over the pits. Never overfly people or cars.','pits');
  if(d>450)violation('Lost visual at '+Math.round(d)+' m. Bring it back inside 300 m.','los');
  else if(d>300)say('Losing visual at '+Math.round(d)+' m. Turn back.','warn','far',8);
  if(st.volt<AC.cells*AC.alarmV&&st.amp>3)say('Battery alarm, '+st.volt.toFixed(1)+' V. Land now.','bad','batt',12);
  if(st.stall>0.5&&st.V>2&&!st.onGround&&!(st.liftAuth>0))say('Stall.','warn','stall',4);
}

