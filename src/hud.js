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
  if((hudTick++&1)===0){drawADI(a);if(!MOBILE||settings.tele==='full')drawMap(a);}
}
let lastStab=-1;

