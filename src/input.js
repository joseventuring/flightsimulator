/* ---------- input system (input-systems skill): named functions, per-device bindings, calibration ---------- */
const FUNCS=[
  {id:'ail',name:'Aileron',kind:'stick',need:true,dir:'Move the RIGHT stick fully to the RIGHT',verify:'Hold the stick RIGHT and watch the wing: the RIGHT aileron should go UP, the left one DOWN.'},
  {id:'ele',name:'Elevator',kind:'stick',need:true,dir:'Pull the RIGHT stick fully BACK (towards you)',verify:'Hold the stick BACK and watch the tail: the elevator trailing edge should go UP.'},
  {id:'thr',name:'Throttle',kind:'stick',need:true,dir:'Push the LEFT stick fully UP (full throttle), then bring it all the way down',verify:'With the stick fully DOWN the throttle bar should read 0%. Push it up slowly: the prop should spin up.'},
  {id:'rud',name:'Rudder',kind:'stick',need:true,dir:'Move the LEFT stick fully to the RIGHT',verify:'Hold the stick RIGHT and watch the fin: the rudder should swing to the RIGHT (its right side).'},
  {id:'rates',name:'Dual rates',kind:'switch',hint:'usually SWA',desc:'Low rate softens all three axes'},
  {id:'cut',name:'Throttle cut',kind:'switch',hint:'usually SWB',desc:'Arms and disarms the motor'},
  {id:'flap',name:'Flaps',kind:'switch3',feature:'flaps',hint:'SWC (3 position)',desc:'0 / 15 / 35 degrees'},
  {id:'gear',name:'Landing gear',kind:'switch',feature:'gear',desc:'Retract and extend'},
  {id:'cam',name:'Camera',kind:'button',hint:'any switch or button',desc:'Cycle pilot, chase, FPV'},
  {id:'reset',name:'Reset',kind:'button',hint:'any switch or button',desc:'Back on the strip'},
];
const FUNC=Object.fromEntries(FUNCS.map(f=>[f.id,f]));
const devices=store.get('jgsim.devices',{});   // {deviceId:{map:{fn:{src:'a0'|'b2'|null,inv:false}},cal:{a0:{min,max}},done:bool}}
let pad=null,padAxes=[],padButtons=[],dev=null,devId=null;
function defaultMap(){const m={};FUNCS.forEach(f=>m[f.id]={src:null,inv:false});return m;}
function legacyImport(){const old=store.get('jgsim.map',null);if(!old)return null;const m=defaultMap();['ail','ele','thr','rud'].forEach(k=>{if(old[k]&&old[k].axis>=0)m[k]={src:'a'+old[k].axis,inv:!!old[k].inv};});if(old.sw&&old.sw.axis>=0)m.rates={src:'a'+old.sw.axis,inv:false};return m;}
function selectPad(){
  const gps=navigator.getGamepads?navigator.getGamepads():[];let best=null;
  for(const g of gps){if(g&&g.connected){if(!best||g.axes.length>best.axes.length)best=g;}}
  if(!best){pad=null;padAxes=[];padButtons=[];return false;}
  pad=best;padAxes=Array.from(pad.axes);padButtons=Array.from(pad.buttons).map(b=>typeof b==='object'?(b.pressed?1:b.value||0):(b>0.5?1:0));
  if(devId!==pad.id){devId=pad.id;dev=devices[devId];if(!dev){const legacy=legacyImport();dev=devices[devId]={map:legacy||defaultMap(),cal:{},done:!!legacy};devices[devId]=dev;saveDevices();onNewDevice(!legacy);}}
  padAxes.forEach((v,i)=>{let c=dev.cal['a'+i];if(!c)c=dev.cal['a'+i]={min:v,max:v};if(v<c.min)c.min=v;if(v>c.max)c.max=v;});
  return true;
}
let devSaveT=0;function saveDevices(){store.set('jgsim.devices',devices);}
function normAxis(i){const v=padAxes[i],c=dev&&dev.cal['a'+i];if(c===undefined||!c)return clamp(v,-1,1);const span=c.max-c.min;if(span<1.2)return clamp(v,-1,1);return clamp((v-c.min)/span*2-1,-1,1);}
function readSrc(src){if(!pad||!src)return null;const n=+src.slice(1);if(src[0]==='a'){if(n>=padAxes.length)return null;return normAxis(n);}if(src[0]==='b'){if(n>=padButtons.length)return null;return padButtons[n]>0.5?1:-1;}return null;}
function fnVal(id){if(!dev)return null;const m=dev.map[id];if(!m||!m.src)return null;let v=readSrc(m.src);if(v===null)return null;return m.inv?-v:v;}
function expo(v,e){return v*(1-e)+v*v*v*e;}
window.addEventListener('gamepadconnected',()=>{selectPad();showPad();});
window.addEventListener('gamepaddisconnected',()=>{pad=null;showPad();});
function showPad(){const el=$('txState');if(!el)return;if(pad){el.textContent=pad.id.slice(0,44)+(dev&&dev.done?' · mapped':' · needs setup');el.className=dev&&dev.done?'ok':'no';}else{el.textContent='not detected. Plug in the sim cable, switch the TX on, move a stick.';el.className='no';}}
function mappedSticks(){return dev&&['ail','ele','thr','rud'].every(k=>dev.map[k].src);}

/* keyboard */
const keys={};let kThr=0;
window.addEventListener('keydown',e=>{keys[e.code]=true;
  if(e.code==='KeyR')reset();if(e.code==='KeyC')cycleCam();if(e.code==='KeyL')G.lowRate=!G.lowRate;if(e.code==='KeyT')cycleTelemetry();if(e.code==='KeyF')G.flapPos=(G.flapPos+1)%3;if(e.code==='KeyP'||e.code==='Escape')togglePause();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();});
window.addEventListener('keyup',e=>{keys[e.code]=false;});

/* touch sticks */
const touch={l:{x:0,y:-1,id:null},r:{x:0,y:0,id:null}};
function bindStick(el,key,springY){const nub=el.querySelector('.nub');const s=touch[key];let cx,cy,R;function set(dx,dy){s.x=clamp(dx/R,-1,1);s.y=clamp(-dy/R,-1,1);nub.style.transform=`translate(${s.x*R*0.75}px,${-s.y*R*0.75}px)`;}
el.addEventListener('pointerdown',e=>{const r=el.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;R=r.width/2;s.id=e.pointerId;el.setPointerCapture(e.pointerId);set(e.clientX-cx,e.clientY-cy);});
el.addEventListener('pointermove',e=>{if(s.id!==e.pointerId)return;set(e.clientX-cx,e.clientY-cy);});
const up=e=>{if(s.id!==e.pointerId)return;s.id=null;s.x=0;if(springY)s.y=0;nub.style.transform=`translate(0px,${-s.y*(R||48)*0.75}px)`;};
el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);}
bindStick($('stL'),'l',false);bindStick($('stR'),'r',true);
$('stL').querySelector('.nub').style.transform='translate(0px,48px)';
function setSticks(on){settings.sticks=on;$('sticks').classList.toggle('show',on);$('cSticks').checked=on;saveSettings();}

/* edge detectors for button-type functions */
const edge={cam:false,reset:false,gear:false};
function readInput(){
  const ex=settings.expo/100, rt=settings.rates/100;
  let a=0,e=0,r=0,t=null,src='keyboard';
  if(selectPad()&&mappedSticks()){const va=fnVal('ail'),ve=fnVal('ele'),vr=fnVal('rud'),vt=fnVal('thr');if(va!==null)a=va;if(ve!==null)e=ve;if(vr!==null)r=vr;if(vt!==null)t=(vt+1)/2;src='transmitter';
    const sw=fnVal('rates');if(sw!==null)G.lowRate=sw>0.3;
    const cut=fnVal('cut');G.cut=cut!==null&&cut>0.3;
    const fl=fnVal('flap');if(fl!==null&&AC.features.flaps)G.flapPos=fl<-0.3?0:fl>0.3?2:1;
    const inFlight=$('overlay').hidden&&G.started;['cam','reset','gear'].forEach(k=>{const v=fnVal(k);const on=v!==null&&v>0.3;if(on&&!edge[k]&&inFlight){if(k==='cam')cycleCam();else if(k==='reset')reset();else G.gearUp=!G.gearUp;}edge[k]=on;});
    if(++devSaveT>240){devSaveT=0;saveDevices();}
  } else G.cut=false;
  const touching=touch.l.id!==null||touch.r.id!==null;
  if(touching){a=touch.r.x;e=-touch.r.y;r=touch.l.x;t=(touch.l.y+1)/2;src='touch';}
  else if(src==='keyboard'){
    if(keys.ArrowLeft)a=-1;if(keys.ArrowRight)a=1;if(keys.ArrowDown)e=1;if(keys.ArrowUp)e=-1;if(keys.KeyA)r=-1;if(keys.KeyD)r=1;
    if(keys.KeyW){kThr=clamp(kThr+0.015,0,1);touch.l.y=kThr*2-1;}if(keys.KeyS){kThr=clamp(kThr-0.015,0,1);touch.l.y=kThr*2-1;}
    t=settings.sticks?(touch.l.y+1)/2:kThr;
  }
  if(t===null)t=kThr;
  const dead=0.04;const mag=Math.hypot(a,e);if(mag<dead){a=0;e=0;}else{const sc=Math.min((mag-dead)/(1-dead),1)/mag;a*=sc;e*=sc;}
  r=Math.abs(r)<dead?0:(r-Math.sign(r)*dead)/(1-dead);
  IN.rawAil=a;IN.rawEle=e;IN.rawRud=r;IN.rawThr=t;
  const lr=G.lowRate?settings.low/100:1;
  IN.ail=clamp(expo(a,ex)*rt*lr+trims.ail,-1,1);IN.ele=clamp(expo(e,ex)*rt*lr+trims.ele,-1,1);IN.rud=clamp(expo(r,ex)*rt*lr+trims.rud,-1,1);
  IN.thr=G.cut?0:clamp(t,0,1);IN.src=src;
  IN.flap=AC.features.flaps?[0,0.26,0.61][G.flapPos]:0;
}
