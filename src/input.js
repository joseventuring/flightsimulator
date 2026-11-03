/* ---------- input system (input-systems skill): named functions, per-device bindings, per-function fallback ---------- */
const FUNCS=[
  {id:'ail',name:'Aileron',kind:'stick',dir:'Move the RIGHT stick fully RIGHT and hold',expect:'Right aileron UP, left DOWN'},
  {id:'ele',name:'Elevator',kind:'stick',dir:'Pull the RIGHT stick fully BACK (towards you) and hold',expect:'Elevator trailing edge UP'},
  {id:'thr',name:'Throttle',kind:'stick',dir:'Push the LEFT stick fully UP and hold',expect:'Throttle reads 100% at the top, 0% at the bottom'},
  {id:'rud',name:'Rudder',kind:'stick',dir:'Move the LEFT stick fully RIGHT and hold',expect:'Rudder trailing edge swings RIGHT'},
  {id:'rates',name:'Dual rates',kind:'switch',hint:'SWA',desc:'ON = low rate'},
  {id:'cut',name:'Throttle cut',kind:'switch',hint:'SWB',desc:'ON = motor disarmed'},
  {id:'stab',name:'Stabiliser',kind:'switch3',hint:'SWC or VRA',desc:'Off / Assist / Self-level'},
  {id:'flap',name:'Flaps',kind:'switch3',feature:'flaps',hint:'SWC',desc:'0 / 15 / 35°'},
  {id:'gear',name:'Landing gear',kind:'switch',feature:'gear',desc:'ON = retracted'},
  {id:'cam',name:'Camera',kind:'switch',hint:'SWD',desc:'Flip to cycle views'},
];
const FUNC=Object.fromEntries(FUNCS.map(f=>[f.id,f]));
const devices=store.get('jgsim.devices',{});
let pad=null,padAxes=[],padButtons=[],dev=null,devId=null;
function defaultMap(){const m={};FUNCS.forEach(f=>m[f.id]={src:null,inv:false,on:1});return m;}
function selectPad(){
  const gps=navigator.getGamepads?navigator.getGamepads():[];let best=null;
  for(const g of gps){if(g&&g.connected){if(!best||g.axes.length>best.axes.length)best=g;}}
  if(!best){pad=null;padAxes=[];padButtons=[];return false;}
  pad=best;padAxes=Array.from(pad.axes);padButtons=Array.from(pad.buttons).map(b=>typeof b==='object'?(b.pressed?1:(b.value||0)):(b>0.5?1:0));
  if(devId!==pad.id){devId=pad.id;dev=devices[devId];
    if(!dev||!dev.map||dev.v!==4){dev=devices[devId]={v:4,map:defaultMap(),cal:{},sticksDone:false};saveDevices();onNewDevice();}
    FUNCS.forEach(f=>{if(!dev.map[f.id])dev.map[f.id]={src:null,inv:false,on:1};});}
  padAxes.forEach((v,i)=>{const k='a'+i;let c=dev.cal[k];if(!c)c=dev.cal[k]={min:v,max:v};if(v<c.min)c.min=v;if(v>c.max)c.max=v;});
  return true;
}
function saveDevices(){store.set('jgsim.devices',devices);}
/* calibrated -1..1. Until the axis has been moved across most of its range, trust the raw value. */
function normAxis(i){const v=padAxes[i];const c=dev&&dev.cal['a'+i];if(!c)return clamp(v,-1,1);const span=c.max-c.min;if(span<1.2)return clamp(v,-1,1);return clamp((v-c.min)/span*2-1,-1,1);}
function readSrc(src){if(!pad||!src)return null;const n=+src.slice(1);if(src[0]==='a')return n<padAxes.length?normAxis(n):null;if(src[0]==='b')return n<padButtons.length?(padButtons[n]>0.5?1:-1):null;return null;}
function fnVal(id){if(!dev)return null;const m=dev.map[id];if(!m||!m.src)return null;const v=readSrc(m.src);if(v===null)return null;return m.inv?-v:v;}
/* switch state: m.on is the sign the switch reads in its ON position (captured during setup) */
function swOn(id){if(!dev)return false;const m=dev.map[id];if(!m||!m.src)return false;const v=readSrc(m.src);return v!==null&&v*m.on>0.3;}
function sw3(id){if(!dev)return -1;const m=dev.map[id];if(!m||!m.src)return -1;const v=readSrc(m.src);if(v===null)return -1;const s=v*m.on;return s<-0.4?0:s>0.4?2:1;}
function stickCount(){return dev?['ail','ele','thr','rud'].filter(k=>dev.map[k].src).length:0;}
function expo(v,e){return v*(1-e)+v*v*v*e;}
window.addEventListener('gamepadconnected',()=>{selectPad();showPad();});
window.addEventListener('gamepaddisconnected',()=>{pad=null;showPad();});
function showPad(){const el=$('txState');if(!el)return;const n=stickCount();if(pad){el.textContent=pad.id.slice(0,40)+' · '+(n===4?'4 sticks mapped':n+' of 4 sticks mapped');el.className=n===4?'ok':'no';}else{el.textContent='none. Plug in the sim cable, switch the TX on, move a stick.';el.className='no';}}

/* keyboard */
const keys={};let kThr=0;
window.addEventListener('keydown',e=>{if(e.target&&e.target.tagName==='INPUT')return;keys[e.code]=true;
  if(e.code==='KeyR')reset();if(e.code==='KeyC')cycleCam();if(e.code==='KeyL')G.kRates=!G.kRates;if(e.code==='KeyT')cycleTelemetry();if(e.code==='KeyG')G.kStab=(G.kStab+1)%3;if(e.code==='KeyP'||e.code==='Escape')togglePause();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>{keys[e.code]=false;});

/* touch sticks: left = throttle (stays where you leave it) + rudder (springs), right = aileron + elevator (springs) */
const touch={l:{x:0,y:-1,id:null},r:{x:0,y:0,id:null}};
function bindStick(el,key,springY){const nub=el.querySelector('.nub');const s=touch[key];let cx,cy,R;
  function place(){const r=el.getBoundingClientRect();R=r.width/2;nub.style.transform=`translate(${s.x*R*0.72}px,${-s.y*R*0.72}px)`;}
  function set(dx,dy){s.x=clamp(dx/(R*0.72),-1,1);s.y=clamp(-dy/(R*0.72),-1,1);place();}
  el.addEventListener('pointerdown',e=>{e.preventDefault();const r=el.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;R=r.width/2;s.id=e.pointerId;try{el.setPointerCapture(e.pointerId);}catch(_){}
    if(!springY){/* throttle: relative drag so touching does not jump the throttle */s.ox=e.clientX;s.oy=e.clientY;s.y0=s.y;}else set(e.clientX-cx,e.clientY-cy);el.classList.add('active');});
  el.addEventListener('pointermove',e=>{if(s.id!==e.pointerId)return;if(!springY){s.x=clamp((e.clientX-cx)/(R*0.72),-1,1);s.y=clamp(s.y0-(e.clientY-s.oy)/(R*0.72),-1,1);place();}else set(e.clientX-cx,e.clientY-cy);});
  const up=e=>{if(s.id!==e.pointerId)return;s.id=null;s.x=0;if(springY)s.y=0;place();el.classList.remove('active');};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  window.addEventListener('resize',place);setTimeout(place,50);s.place=place;}
bindStick($('stL'),'l',false);bindStick($('stR'),'r',true);
function setSticks(on){settings.sticks=on;document.body.classList.toggle('touch',on);$('cSticks').checked=on;saveSettings();if(on){touch.l.place&&touch.l.place();touch.r.place&&touch.r.place();}}

/* flight controller mixer (like a trainer receiver gyro): Off / Assist (rate damping) / Self-level (attitude hold, 45° bank limit) */
function stabMix(a,e,r){
  const mode=G.stab; if(mode===0||!st.airborne||st.onGround)return [a,e,r];
  const p=-st.w.z, q=st.w.x, yaw=-st.w.y;
  if(mode===1){return [clamp(a-0.06*p,-1,1),clamp(e-0.05*q,-1,1),clamp(r-0.04*yaw,-1,1)];}
  const att=attitude();const roll=-att.roll, pitch=att.pitch; // attitude().roll is +left-wing-down (ADI convention); controls use +right
  const rollT=a*0.78, pitchT=e*0.6+0.05;  // stick commands an angle, not a rate
  const ac=clamp(1.6*(rollT-roll)-0.10*p,-1,1);
  const ec=clamp(1.4*(pitchT-pitch)-0.08*q,-1,1);
  return [ac,ec,clamp(r-0.04*yaw,-1,1)];
}
const edge={cam:false};
function readInput(){
  const ex=settings.expo/100, rt=settings.rates/100;
  let a=null,e=null,r=null,t=null,src='keyboard';
  const hasPad=selectPad();
  if(hasPad&&stickCount()>0){const va=fnVal('ail'),ve=fnVal('ele'),vr=fnVal('rud'),vt=fnVal('thr');a=va;e=ve;r=vr;t=vt===null?null:(vt+1)/2;src='transmitter';}
  G.lowRate=G.kRates||swOn('rates');
  G.cut=swOn('cut');
  const s3=sw3('stab');G.stab=s3>=0?s3:G.kStab;
  if(AC.features.flaps){const f=sw3('flap');if(f>=0)G.flapPos=f;}
  if(AC.features.gear)G.gearUp=swOn('gear');
  const camOn=swOn('cam');const inFlight=$('overlay').hidden&&G.started;if(camOn!==edge.cam&&inFlight&&dev&&dev.map.cam.src)cycleCam();edge.cam=camOn;
  const touching=touch.l.id!==null||touch.r.id!==null;
  if(settings.sticks||touching){if(a===null)a=touch.r.x;if(e===null)e=-touch.r.y;if(r===null)r=touch.l.x;if(t===null)t=(touch.l.y+1)/2;if(src==='keyboard')src='touch';}
  // keyboard fills anything still unmapped
  let ka=0,ke=0,kr=0;if(keys.ArrowLeft)ka=-1;if(keys.ArrowRight)ka=1;if(keys.ArrowDown)ke=1;if(keys.ArrowUp)ke=-1;if(keys.KeyA)kr=-1;if(keys.KeyD)kr=1;
  const nowIn=performance.now(),dIn=clamp((nowIn-(readInput.t||nowIn))/1000,0,0.1);readInput.t=nowIn;if(keys.KeyW)kThr=clamp(kThr+0.7*dIn,0,1);if(keys.KeyS)kThr=clamp(kThr-0.7*dIn,0,1);
  if(a===null||ka)a=a===null?ka:a+ka; if(e===null||ke)e=e===null?ke:e+ke; if(r===null||kr)r=r===null?kr:r+kr; if(t===null)t=kThr;
  a=clamp(a,-1,1);e=clamp(e,-1,1);r=clamp(r,-1,1);
  const dead=0.04;const mag=Math.hypot(a,e);if(mag<dead){a=0;e=0;}else{const sc=Math.min((mag-dead)/(1-dead),1)/mag;a*=sc;e*=sc;}
  r=Math.abs(r)<dead?0:(r-Math.sign(r)*dead)/(1-dead);
  IN.rawAil=a;IN.rawEle=e;IN.rawRud=r;IN.rawThr=t;
  const lr=G.lowRate?settings.low/100:1;
  let ca=clamp(expo(a,ex)*rt*lr+trims.ail,-1,1), ce=clamp(expo(e,ex)*rt*lr+trims.ele,-1,1), cr=clamp(expo(r,ex)*rt*lr+trims.rud,-1,1);
  [ca,ce,cr]=stabMix(ca,ce,cr);
  IN.ail=ca;IN.ele=ce;IN.rud=cr;
  IN.thr=G.cut?0:clamp(t,0,1);IN.src=src;
  IN.flap=AC.features.flaps?[0,0.26,0.61][G.flapPos]:0;
}
