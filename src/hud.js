/* ---------- HUD ---------- */
const adi=$('adi').getContext('2d'), mapc=$('map').getContext('2d');
const UP=new THREE.Vector3(0,1,0),RIGHT=new THREE.Vector3(1,0,0);
function attitude(){const f=FWD.clone().applyQuaternion(st.q),up=UP.clone().applyQuaternion(st.q),rt=RIGHT.clone().applyQuaternion(st.q);return {pitch:Math.asin(clamp(f.y,-1,1)),roll:Math.atan2(rt.y,up.y),hdg:(Math.atan2(f.x,-f.z)*180/Math.PI+360)%360};}
function drawADI(a){const W=110,H=110,cx=55,cy=55;adi.clearRect(0,0,W,H);adi.save();adi.beginPath();adi.arc(cx,cy,50,0,Math.PI*2);adi.clip();adi.translate(cx,cy);adi.rotate(a.roll);const py=a.pitch*180/Math.PI*2.2;adi.translate(0,py);adi.fillStyle='#B9CBDB';adi.fillRect(-120,-200,240,200);adi.fillStyle='#6E5A3E';adi.fillRect(-120,0,240,200);adi.strokeStyle='#F7F4EE';adi.lineWidth=1.5;adi.beginPath();adi.moveTo(-120,0);adi.lineTo(120,0);adi.stroke();adi.font='9px IBM Plex Mono,monospace';adi.fillStyle='#F7F4EE';adi.textAlign='center';for(let d=-60;d<=60;d+=10){if(d===0)continue;const y=-d*2.2;const w=d%20===0?18:9;adi.beginPath();adi.moveTo(-w,y);adi.lineTo(w,y);adi.stroke();if(d%20===0)adi.fillText(Math.abs(d),w+10,y+3);}adi.restore();
  adi.strokeStyle='#F26522';adi.lineWidth=2.5;adi.beginPath();adi.moveTo(cx-22,cy);adi.lineTo(cx-8,cy);adi.lineTo(cx-4,cy+5);adi.lineTo(cx,cy);adi.lineTo(cx+4,cy+5);adi.lineTo(cx+8,cy);adi.lineTo(cx+22,cy);adi.stroke();
  adi.save();adi.translate(cx,cy);adi.rotate(a.roll);adi.fillStyle='#F26522';adi.beginPath();adi.moveTo(0,-48);adi.lineTo(-4,-41);adi.lineTo(4,-41);adi.fill();adi.restore();
  adi.strokeStyle='#A3AEBA';adi.lineWidth=1;[-60,-30,-20,-10,10,20,30,60].forEach(d=>{const r=d*Math.PI/180;adi.beginPath();adi.moveTo(cx+Math.sin(r)*47,cy-Math.cos(r)*47);adi.lineTo(cx+Math.sin(r)*(Math.abs(d)%30===0?41:44),cy-Math.cos(r)*(Math.abs(d)%30===0?41:44));adi.stroke();});
  adi.beginPath();adi.arc(cx,cy,50,0,Math.PI*2);adi.stroke();}
/* the real roads, water and roofs round the field, drawn once at 1 px per metre for the map inset */
const MINI=(()=>{if(typeof FEAT==='undefined'||!FEAT)return null;const R=460,c=document.createElement('canvas');c.width=c.height=R*2;const g=c.getContext('2d');g.translate(R,R);g.lineCap=g.lineJoin='round';
  const poly=(p,close)=>{g.beginPath();g.moveTo(p[0],p[1]);for(let j=2;j<p.length;j+=2)g.lineTo(p[j],p[j+1]);if(close)g.closePath();};
  g.fillStyle='rgba(80,140,170,.55)';FEAT.wp.forEach(l=>{poly(l.p,true);g.fill();});
  g.strokeStyle='rgba(80,140,170,.6)';FEAT.wl.forEach(l=>{g.lineWidth=Math.max(2,WL_W[l.c]);poly(l.p);g.stroke();});
  g.strokeStyle='rgba(205,200,190,.55)';FEAT.roads.forEach(l=>{g.lineWidth=Math.max(2.5,ROAD_W[l.c]*0.8);poly(l.p);g.stroke();});
  g.fillStyle='rgba(230,214,190,.42)';if(FEAT.blds)FEAT.blds.forEach(b=>{if(Math.abs(b.x)>R||Math.abs(b.z)>R)return;g.save();g.translate(b.x,b.z);g.rotate(b.a);g.fillRect(-b.l/2,-b.w/2,b.l,b.w);g.restore();});
  return {c,R};})();
function drawMap(a){const W=130,H=110,cx=65,cy=60;mapc.clearRect(0,0,W,H);const d=Math.hypot(st.pos.x-2.5,st.pos.z-4.5);const scale=Math.max(0.38,Math.min(1.2,45/Math.max(d,40)));const X=x=>cx+x*scale, Y=z=>cy+z*scale*0.85-10;
  if(MINI){mapc.save();mapc.setTransform(scale,0,0,scale*0.85,cx,cy-10);mapc.drawImage(MINI.c,-MINI.R,-MINI.R);mapc.restore();}
  if(MAP.home){mapc.fillStyle='#F5C542';mapc.beginPath();mapc.arc(X(MAP.home[0]),Y(MAP.home[1]),3,0,Math.PI*2);mapc.fill();}
  mapc.fillStyle='rgba(242,101,34,.14)';mapc.fillRect(X(6),Y(-2),26*scale,24*scale*0.85);
  mapc.fillStyle='rgba(242,101,34,.08)';mapc.fillRect(X(-80),Y(2),160*scale,60*scale*0.85);
  mapc.fillStyle='#8a7a5e';mapc.fillRect(X(-3.5),Y(-70),7*scale,90*scale*0.85);
  mapc.strokeStyle='#F7F4EE';mapc.lineWidth=1;mapc.beginPath();mapc.moveTo(X(-22),Y(2));mapc.lineTo(X(22),Y(2));mapc.stroke();
  mapc.strokeStyle='rgba(163,174,186,.35)';[100,200,300].forEach(r=>{mapc.beginPath();mapc.ellipse(X(2.5),Y(4.5),r*scale,r*scale*0.85,0,0,Math.PI*2);mapc.stroke();});
  if(G.mode==='gates'){gateObjs.forEach((g,i)=>{mapc.fillStyle=i<gate.i?'#5FD38D':i===gate.i?'#F26522':'#7a5a4a';mapc.beginPath();mapc.arc(X(g.pos.x),Y(g.pos.z),3,0,Math.PI*2);mapc.fill();});}
  mapc.fillStyle='#F7F4EE';mapc.beginPath();mapc.arc(X(2.5),Y(4.5),2,0,Math.PI*2);mapc.fill();
  if(typeof MP!=='undefined'&&MP.on)MP.peers.forEach(P=>{if(!P.craft||!P.craft.root.visible)return;const q=P.craft.root.position;mapc.fillStyle='#6FA8DC';mapc.beginPath();mapc.arc(X(q.x),Y(q.z),3,0,Math.PI*2);mapc.fill();});
  if(typeof wardens!=='undefined')wardens.forEach(W=>{mapc.fillStyle=W.sees?'#E8503A':'#6FA8DC';mapc.beginPath();mapc.arc(X(W.pos.x),Y(W.pos.z),3.5,0,Math.PI*2);mapc.fill();});
  mapc.save();mapc.translate(X(st.pos.x),Y(st.pos.z));mapc.rotate(a.hdg*Math.PI/180);mapc.fillStyle='#F26522';mapc.beginPath();mapc.moveTo(0,-7);mapc.lineTo(-5,5);mapc.lineTo(0,3);mapc.lineTo(5,5);mapc.fill();mapc.restore();
  const th=settings.wdir*Math.PI/180;mapc.save();mapc.translate(W-16,16);mapc.rotate(th+Math.PI);mapc.strokeStyle='#F5C542';mapc.lineWidth=2;mapc.beginPath();mapc.moveTo(0,8);mapc.lineTo(0,-8);mapc.moveTo(-4,-4);mapc.lineTo(0,-8);mapc.lineTo(4,-4);mapc.stroke();mapc.restore();
  mapc.fillStyle='#A3AEBA';mapc.font='9px IBM Plex Mono,monospace';mapc.textAlign='left';mapc.fillText('N',4,11);mapc.fillText(Math.round(d)+' m',4,H-5);}
let hudTick=0;
function updateHUD(dt){
  const a=attitude();
  $('hAir').textContent=Math.round(st.V*3.6);
  const alt=Math.max(0,st.pos.y-0.11);$('hAlt').textContent=alt.toFixed(alt<10?1:0);
  const altEl=$('hAlt');altEl.className='v'+(alt>=120?' bad':alt>=100?' warn':'');
  $('hVsi').textContent=(st.vsi>=0?'+':'')+st.vsi.toFixed(1);
  $('hHdg').textContent=String(Math.round(a.hdg)%360).padStart(3,'0');
  $('hG').textContent=st.nz.toFixed(1);$('hG').className='v'+(Math.abs(st.nz)>5?' warn':'');
  $('hThr').style.width=Math.round(st.thr*100)+'%';$('hThrV').textContent=G.cut?'CUT':Math.round(IN.thr*100)+'%';$('hThrV').className=G.cut?'bad-t':'';
  $('hTime').textContent=fmtTime(st.airborne?st.time-G.flightStart:0);
  const vEl=$('hVolt');vEl.textContent=st.volt.toFixed(1)+' V';vEl.className='big'+(st.volt<AC.cells*AC.alarmV?' bad-t':st.volt<11.1?' no':'');
  $('hAmp').textContent=st.amp.toFixed(1)+' A';$('hMah').textContent=Math.round(st.usedAh*1000)+' mAh';
  const left=Math.max(0,(AC.capAh*0.8-st.usedAh))/Math.max(st.amp,0.4)*60;$('hLeft').textContent=(left>99?'99+':left.toFixed(0))+' min';
  $('hWind').textContent=settings.wdir+'° '+settings.wind+' m/s';
  $('sInput').textContent=IN.src;$('sRate').textContent=G.lowRate?'low rate':'high rate';$('sFps').textContent=Math.round(1000/Math.max(G.frameMs,1))+' fps'+(pixelRatio<1?' ·'+pixelRatio+'x':'');
  if(G.mode==='gates'){$('gNum').textContent=Math.min(gate.i+1,gateObjs.length);$('gTot').textContent=gateObjs.length;$('gTime').textContent=(gate.running?(st.time-gate.t0):0).toFixed(2)+'s';$('gBest').textContent=logbook.bestGate!==null?'best '+logbook.bestGate.toFixed(2)+'s':'';}
  $('hBat').textContent=st.volt.toFixed(1);$('hBat').className='v'+(st.volt<AC.cells*AC.alarmV?' bad':st.volt<11.1?' warn':'');
  $('banner').hidden=!(G.cut&&G.flying);
  if(G.stab!==lastStab){lastStab=G.stab;applyStabLabel();}
  $('mThr').textContent=G.cut?'CUT':Math.round(IN.thr*100)+'%';$('mRate').hidden=!G.lowRate;
  if(BIG.open&&(hudTick&3)===0)drawBigMap();
  if((hudTick++&1)===0){drawADI(a);if(!MOBILE||settings.tele==='full')drawMap(a);}
}
let lastStab=-1;

/* ---------- full map: the whole flying area with real roads, water, buildings, land cover, the field, you and the radio range ---------- */
const RADIO_R=Math.round(Math.max(1500,Math.min(MAP.size/2-400,3000)));
const BIG={open:false,base:null,A:RADIO_R+450,wasPaused:false};
function bigBase(){if(BIG.base)return BIG.base;const N=1024,A=BIG.A,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  const P=v=>(v+A)/(2*A)*N,S=N/(2*A);
  /* land cover with hill shading from the real terrain */
  const LCC=DECCAN?['#8a7d4f','#5d6a35','#7a7342','#9a8c55','#8f9450','#a39a8a','#ab977c','#000','#3f6d80','#6f8150','#3b6a40']:['#5e8a3c','#3f6a2e','#5f7a38','#86a052','#9bbd58','#97907e','#a8896a','#000','#3f6d80','#668a4c','#30603a'];
  const B=8;for(let j=0;j<N;j+=B)for(let i=0;i<N;i+=B){const x=(i+B/2)/S-A,z=(j+B/2)/S-A;const k=FEAT?lcAt(x,z):0;
    const h=groundH(x,z),gx=groundH(x+30,z)-h,gz=groundH(x,z+30)-h;const sh=clamp(1+(-gx*0.7-gz*0.4)/18,0.62,1.3);
    const c0=new THREE.Color(LCC[k===7?0:k]);c0.multiplyScalar(sh);g.fillStyle='#'+c0.getHexString();g.fillRect(i,j,B,B);}
  const poly=(p,close)=>{g.beginPath();g.moveTo(P(p[0]),P(p[1]));for(let q=2;q<p.length;q+=2)g.lineTo(P(p[q]),P(p[q+1]));if(close)g.closePath();};
  g.lineCap=g.lineJoin='round';
  if(FEAT){g.fillStyle='#4f8fa8';FEAT.wp.forEach(l=>{poly(l.p,true);g.fill();});g.strokeStyle='#4f8fa8';FEAT.wl.forEach(l=>{g.lineWidth=Math.max(1.2,WL_W[l.c]*S);poly(l.p);g.stroke();});}
  else{const n=MAP.n,s=MAP.size,cs=s/(n-1);g.fillStyle='#4f8fa8';for(let jj=0;jj<n;jj++)for(let ii=0;ii<n;ii++)if(MAP.W[jj*n+ii]){const x=-s/2+ii*cs,z=-s/2+jj*cs;g.fillRect(P(x-cs/2),P(z-cs/2),cs*S+1,cs*S+1);}}
  if(FEAT){[8,7,6,5,4,3,2,1].forEach(cl=>{g.strokeStyle=cl<=3?'#efe6d2':cl===8?'#b39b78':'#cfc8bb';g.lineWidth=Math.max(cl<=3?2.2:cl<=5?1.6:1,ROAD_W[cl]*S);FEAT.roads.forEach(l=>{if(l.c===cl){poly(l.p);g.stroke();}});});
    g.fillStyle='#e6d6be';if(FEAT.blds)FEAT.blds.forEach(b=>{if(Math.abs(b.x)>A||Math.abs(b.z)>A)return;g.save();g.translate(P(b.x),P(b.z));g.rotate(b.a);g.fillRect(-Math.max(1,b.l*S)/2,-Math.max(1,b.w*S)/2,Math.max(1,b.l*S),Math.max(1,b.w*S));g.restore();});}
  /* the field and strip */
  g.fillStyle='rgba(242,101,34,.35)';g.fillRect(P(-75),P(-130),150*S,210*S);g.fillStyle='#F26522';g.fillRect(P(-3.5),P(-70),Math.max(2,7*S),90*S);
  /* radio range and scale */
  g.setLineDash([8,6]);g.strokeStyle='#6FA8DC';g.lineWidth=2;g.beginPath();g.arc(P(PILOT_EYE.x),P(PILOT_EYE.z),RADIO_R*S,0,Math.PI*2);g.stroke();
  g.strokeStyle='rgba(247,244,238,.35)';g.lineWidth=1;g.beginPath();g.arc(P(PILOT_EYE.x),P(PILOT_EYE.z),450*S,0,Math.PI*2);g.stroke();g.setLineDash([]);
  g.fillStyle='rgba(247,244,238,.7)';g.font='600 16px IBM Plex Mono,monospace';g.fillText('450 m: visual line of sight',P(PILOT_EYE.x)+6,P(PILOT_EYE.z-450)-6);
  g.fillText('radio range '+(RADIO_R/1000).toFixed(1)+' km',P(PILOT_EYE.x)+6,P(PILOT_EYE.z-RADIO_R)+18);
  g.fillStyle='rgba(27,34,43,.75)';g.fillRect(16,N-46,260,32);g.fillStyle='#F7F4EE';g.fillRect(28,N-26,1000*S,4);g.font='600 15px IBM Plex Mono,monospace';g.fillText('1 km',36+1000*S,N-20);
  g.beginPath();g.moveTo(N-34,22);g.lineTo(N-44,48);g.lineTo(N-34,42);g.lineTo(N-24,48);g.closePath();g.fill();g.fillText('N',N-39,70);
  if(MAP.home){g.fillStyle='#F5C542';g.strokeStyle='#1B222B';g.lineWidth=2;g.beginPath();g.arc(P(MAP.home[0]),P(MAP.home[1]),7,0,Math.PI*2);g.fill();g.stroke();g.fillStyle='#F7F4EE';g.fillText('Home',P(MAP.home[0])+10,P(MAP.home[1])+5);}
  BIG.base=c;return c;}
function drawBigMap(){if(!BIG.open)return;const cv=$('bmC'),g=cv.getContext('2d'),N=cv.width,A=BIG.A,P=v=>(v+A)/(2*A)*N;g.drawImage(bigBase(),0,0);
  if(typeof MP!=='undefined'&&MP.on)MP.peers.forEach(Q=>{if(!Q.craft||!Q.craft.root.visible)return;const q=Q.craft.root.position;g.fillStyle='#6FA8DC';g.beginPath();g.arc(P(q.x),P(q.z),7,0,Math.PI*2);g.fill();});
  if(typeof wardens!=='undefined')wardens.forEach(W=>{g.fillStyle=W.sees?'#E8503A':'#6FA8DC';g.beginPath();g.arc(P(W.pos.x),P(W.pos.z),8,0,Math.PI*2);g.fill();});
  const a=attitude();g.save();g.translate(P(st.pos.x),P(st.pos.z));g.rotate(a.hdg*Math.PI/180);g.fillStyle='#F5C542';g.strokeStyle='#1B222B';g.lineWidth=2;g.beginPath();g.moveTo(0,-16);g.lineTo(-11,12);g.lineTo(0,6);g.lineTo(11,12);g.closePath();g.fill();g.stroke();g.restore();
  const d=Math.hypot(st.pos.x-PILOT_EYE.x,st.pos.z-PILOT_EYE.z);$('bmInfo').textContent=(d<1000?Math.round(d)+' m':(d/1000).toFixed(2)+' km')+' from you · alt '+Math.max(0,st.pos.y).toFixed(0)+' m'+(G.failsafe?' · LINK LOST':'');}
function toggleBigMap(){BIG.open=!BIG.open;$('bigMap').hidden=!BIG.open;$('bmTitle').textContent=(MAP.name||'Map')+' · '+(MAP.air?MAP.air.zone.toUpperCase()+' zone':'');
  if(BIG.open){BIG.wasPaused=G.paused;if(G.flying&&!G.crashed&&!G.landed)G.paused=true;drawBigMap();}
  else if(!BIG.wasPaused&&G.flying&&!G.crashed&&!G.landed&&$('overlay').hidden){G.paused=false;last=performance.now();}}
