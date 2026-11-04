/* ---------- multiplayer (Supabase Realtime: presence for who is in the room, broadcast for aircraft state) ----------
   Rooms are named by a code; everyone in the same room shares the Kurianad field in freefly. Nothing is stored in a
   database: presence carries callsign, aircraft and paint; broadcast carries position, attitude and rotor or motor state
   about five times a second. Other pilots render as ghost aircraft drawn a quarter second in the past and interpolated,
   so they move smoothly between packets. Ghosts do not collide. The project key below is a publishable key; every table
   in the project is protected by row level security, and this code only uses Realtime channels. */
const MP_URL='https://iycrglutfvfnjnkljift.supabase.co',MP_KEY='sb_publishable_12bYrwR1qYXW7qKjrPTZRg_K4h_JIzG',MP_LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
const MP={on:false,status:'off',room:'',name:'',id:Math.random().toString(36).slice(2,10),client:null,ch:null,peers:new Map(),sendT:0,err:''};
const MP_DELAY=0.25,MP_RATE=0.2;
function mpLoadLib(){return new Promise((res,rej)=>{if(window.supabase&&window.supabase.createClient)return res();const s=document.createElement('script');s.src=MP_LIB;s.onload=()=>res();s.onerror=()=>rej(new Error('Could not load the realtime library. Check the connection.'));document.head.appendChild(s);});}
function mpSanitize(t,n){return String(t||'').replace(/[^A-Za-z0-9 _-]/g,'').trim().slice(0,n);}
async function mpJoin(room,name){room=mpSanitize(room,16).toUpperCase()||'KURIANAD';name=mpSanitize(name,14)||'Pilot';if(MP.on)await mpLeave();
  MP.room=room;MP.name=name;MP.status='connecting';MP.err='';renderMulti();store.set('jgsim.mp',{room,name});
  try{await mpLoadLib();if(!MP.client)MP.client=window.supabase.createClient(MP_URL,MP_KEY,{realtime:{params:{eventsPerSecond:12}}});
    const ch=MP.client.channel('jg-room-'+room,{config:{broadcast:{self:false,ack:false},presence:{key:MP.id}}});MP.ch=ch;
    ch.on('broadcast',{event:'s'},({payload})=>mpOnState(payload));
    ch.on('presence',{event:'sync'},()=>mpSync(ch.presenceState()));
    ch.subscribe(async status=>{if(status==='SUBSCRIBED'){MP.on=true;MP.status='in';await ch.track(mpMe());say('Joined room '+room+' as '+name+'.','good');renderMulti();}
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){MP.status='error';MP.err='The room did not answer ('+status.toLowerCase().replace('_',' ')+').';renderMulti();}
      else if(status==='CLOSED'){MP.on=false;if(MP.status!=='off')MP.status='off';renderMulti();}});
  }catch(e){MP.status='error';MP.err=e.message||String(e);renderMulti();}}
async function mpLeave(){const ch=MP.ch;MP.on=false;MP.status='off';MP.ch=null;MP.peers.forEach(mpDropPeer);MP.peers.clear();if(ch){try{await ch.untrack();}catch(e){}try{await MP.client.removeChannel(ch);}catch(e){}}renderMulti();}
function mpMe(){return {name:MP.name,ac:career.selected,paint:paintOf(career.selected),v:1};}
/* presence: who is here, flying what; builds or rebuilds a ghost when someone changes aircraft or paint */
function mpSync(state){const seen=new Set();
  for(const [key,metas] of Object.entries(state)){if(key===MP.id||!metas||!metas.length)continue;const m=metas[metas.length-1];if(!AIRCRAFT[m.ac])continue;seen.add(key);
    let P=MP.peers.get(key);const sig=m.ac+JSON.stringify(m.paint||{});
    if(!P){P={id:key,buf:[],last:0};MP.peers.set(key,P);}
    P.name=mpSanitize(m.name,14)||'Pilot';if(P.sig!==sig){mpDropPeer(P);P.sig=sig;P.ac=m.ac;P.craft=mpBuild(m.ac,Object.assign({},AIRCRAFT[m.ac].paint,m.paint||{}));P.craft.root.visible=false;scene.add(P.craft.root);P.tag=mpTag(P.name);scene.add(P.tag);}
    else if(P.tag&&P.tag.userData.name!==P.name){scene.remove(P.tag);P.tag=mpTag(P.name);scene.add(P.tag);}}
  for(const [key,P] of MP.peers){if(!seen.has(key)){mpDropPeer(P);MP.peers.delete(key);}}renderMulti();}
function mpBuild(ac,paint){const A=AIRCRAFT[ac];if(A.kind==='heli')return buildHeli(A,paint);if(A.kind==='quad')return buildQuad(A,paint);
  const w=(A.phys.wheels||AC_BASE.wheels).map(x=>({p:x.p.clone(),r:x.r,steer:x.steer}));return buildAircraft(A,paint,w);}
function mpDropPeer(P){if(P.craft){scene.remove(P.craft.root);disposeTree(P.craft.root);P.craft=null;}if(P.tag){scene.remove(P.tag);P.tag.material.map.dispose();P.tag.material.dispose();P.tag=null;}}
/* callsign tag: a sprite kept at a constant size on screen */
function mpTag(name){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');g.font='600 30px Rajdhani, sans-serif';const w=Math.min(250,g.measureText(name).width+24);
  g.fillStyle='rgba(27,34,43,.78)';g.fillRect((256-w)/2,10,w,44);g.fillStyle='#6FA8DC';g.fillRect((256-w)/2,10,4,44);g.fillStyle='#F7F4EE';g.textAlign='center';g.textBaseline='middle';g.fillText(name,128,33);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true,fog:false}));sp.renderOrder=11;sp.userData.name=name;sp.visible=false;return sp;}
/* state packets: compact arrays, rounded; the receiver keeps a short time-stamped buffer */
const r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
function mpSend(){if(!MP.on||!MP.ch)return;const live=G.flying&&!G.crashed;
  MP.ch.send({type:'broadcast',event:'s',payload:{i:MP.id,a:career.selected,t:Date.now(),l:live?1:0,p:[r2(st.pos.x),r2(st.pos.y),r2(st.pos.z)],q:[r3(st.q.x),r3(st.q.y),r3(st.q.z),r3(st.q.w)],v:[r2(st.vel.x),r2(st.vel.y),r2(st.vel.z)],
    m:r2(AC.kind==='heli'?(st.rotorW||0)/AC.headspeed:st.thr||0),g:r2(st.gearPos||0)}});}
function mpOnState(s){if(!s||s.i===MP.id)return;const P=MP.peers.get(s.i);if(!P)return;if(!Array.isArray(s.p)||!Array.isArray(s.q))return;
  const now=performance.now()/1000;P.buf.push({t:now,p:new THREE.Vector3(+s.p[0]||0,+s.p[1]||0,+s.p[2]||0),q:new THREE.Quaternion(+s.q[0]||0,+s.q[1]||0,+s.q[2]||0,+s.q[3]||1).normalize(),v:new THREE.Vector3(...(s.v||[0,0,0]).map(x=>+x||0)),live:!!s.l,m:+s.m||0});
  if(P.buf.length>12)P.buf.shift();P.last=now;}
const _mpq=new THREE.Quaternion(),_mpp=new THREE.Vector3();
function updateMulti(dt){if(!MP.on)return;
  /* send on wall-clock time: frame dt is capped, so a slow phone would otherwise send far less often */
  const now=performance.now()/1000,rt=now-MP_DELAY;if(now-MP.sendT>=MP_RATE){MP.sendT=now;mpSend();}
  MP.peers.forEach(P=>{const C=P.craft;if(!C)return;const b=P.buf;const stale=now-P.last>5;
    if(!b.length||stale||!b[b.length-1].live){C.root.visible=false;if(P.tag)P.tag.visible=false;return;}
    /* find the two packets around the render time; past the newest one, extrapolate briefly along the velocity */
    let a=b[0],c=b[b.length-1];for(let i=0;i<b.length-1;i++){if(b[i].t<=rt&&b[i+1].t>=rt){a=b[i];c=b[i+1];break;}}
    if(rt>=c.t){_mpp.copy(c.p).addScaledVector(c.v,Math.min(rt-c.t,0.5));_mpq.copy(c.q);}
    else if(rt<=a.t){_mpp.copy(a.p);_mpq.copy(a.q);}
    else{const k=(rt-a.t)/Math.max(c.t-a.t,1e-3);_mpp.lerpVectors(a.p,c.p,k);_mpq.copy(a.q).slerp(c.q,k);}
    C.root.position.copy(_mpp);C.root.quaternion.copy(_mpq);C.root.visible=G.view!=='hangar';
    if(C.propDisc&&C.propDisc.material)C.propDisc.material.opacity=clamp(c.m*0.5,0,0.4);
    if(C.heli){C.heli.spinG.rotation.y-=c.m*3.5;C.heli.blades.forEach(x=>x.visible=c.m<0.35);C.heli.disc.material.opacity=clamp((c.m-0.2)*0.8,0,0.42);}
    if(C.props)C.props.forEach(pp=>{pp.g.rotation.y+=pp.dir*c.m*4;pp.blades.forEach(x=>x.visible=c.m<0.35);pp.disc.material.opacity=clamp((c.m-0.2)*0.9,0,0.38);});
    if(P.tag){const d=camera.position.distanceTo(_mpp);const vh=2*d*Math.tan(camera.fov*Math.PI/360);const sz=vh*(MOBILE?0.05:0.04);P.tag.scale.set(sz*4,sz,1);P.tag.position.copy(_mpp);P.tag.position.y+=sz*0.9+0.3;P.tag.visible=C.root.visible;}});
  if((updateMulti.t=(updateMulti.t||0)+dt)>1){updateMulti.t=0;const n=$('mpCount');if(n)n.textContent=MP.peers.size+1;}}
/* room card */
function renderMulti(){const st0=$('mpState');if(!st0)return;
  st0.textContent=MP.status==='in'?'In room '+MP.room+' · '+(MP.peers.size+1)+' flying':MP.status==='connecting'?'Connecting…':MP.status==='error'?'Not connected. '+MP.err:'Not in a room';
  st0.className=MP.status==='in'?'ok':MP.status==='error'?'no':'';
  $('bMpJoin').textContent=MP.on?'Leave room':'Join room';
  const list=[`<li><b>${MP.name||'You'}</b> <span>${AIRCRAFT[career.selected].name} · you</span></li>`].concat([...MP.peers.values()].map(P=>`<li><b>${P.name}</b> <span>${AIRCRAFT[P.ac]?AIRCRAFT[P.ac].name:''}</span></li>`));
  $('mpList').innerHTML=MP.on?list.join(''):'';
  document.querySelectorAll('[data-mp]').forEach(b=>{b.hidden=!MP.on;b.textContent=MP.on?'Room '+MP.room+' · '+(MP.peers.size+1):'';});
  const sub=$('mpSub');if(sub)sub.textContent=MP.on?'In '+MP.room+', '+(MP.peers.size+1)+' flying':'Fly with friends, live';}
function showMulti(){const saved=store.get('jgsim.mp',{});$('mpName').value=MP.name||saved.name||'';$('mpRoom').value=MP.room||saved.room||'KURIANAD';renderMulti();show('mpCard');}
