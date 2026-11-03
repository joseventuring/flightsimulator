/* ---------- aircraft data sheet ---------- */
const SHEET=[
  ['Aircraft','CraycleCub V2, 3D printed'],['Wingspan','800 mm'],['Mean chord','190 mm, Clark Y 11.7%'],['Wing area','15.2 dm²'],['All-up weight','620 g'],
  ['Wing loading','40.8 g/dm²'],['Motor','2205 2300KV brushless'],['ESC','30 A'],['Prop','6 x 4 in'],['Battery','3S 2200 mAh 35C LiPo'],
  ['Static thrust','about 720 g'],['Thrust to weight','1.16'],['Stall','26 km/h clean'],['Best glide','34 km/h, L/D about 6'],['Cruise at half throttle','60 km/h'],
  ['Gear','fixed tail-dragger, steerable tailwheel'],['Flaps','not fitted'],['Receiver','FlySky FS-iA6B, 6 ch'],['Throws','ail ±26°, ele ±22°, rud ±29°'],
  ['Battery alarm','3.6 V per cell'],['CG','20% MAC, static margin 16%'],['Print','PLA Pro+ airframe, PETG mounts, TPU tyres'],
];

/* ---------- procedural aircraft builder. Local frame: x right, y up, nose toward -z ---------- */
const matGlass=new THREE.MeshStandardMaterial({color:0x1d3446,roughness:0.15,metalness:0.1}), matTyre=pbr(0x15171a,0.9), matMetal=new THREE.MeshStandardMaterial({color:0x9aa3ad,roughness:0.35,metalness:0.7});
const sh=m=>{m.castShadow=true;m.receiveShadow=true;return m;};
/* loft: sections [z, width, height, yCentre], superellipse cross-section (n=3.2 reads as a rounded box, like a printed fuselage) */
function loft(secs,N,n){const pos=[],idx=[];secs.forEach(([z,w,h,yc])=>{for(let k=0;k<N;k++){const t=k/N*Math.PI*2,c=Math.cos(t),s=Math.sin(t);pos.push(Math.sign(c)*Math.pow(Math.abs(c),2/n)*w/2, yc+Math.sign(s)*Math.pow(Math.abs(s),2/n)*h/2, z);}});
  for(let i=0;i<secs.length-1;i++)for(let k=0;k<N;k++){const a=i*N+k,b=i*N+(k+1)%N,c=(i+1)*N+k,d=(i+1)*N+(k+1)%N;idx.push(a,c,b,b,c,d);}
  const capF=pos.length/3;pos.push(0,secs[0][3],secs[0][0]);for(let k=0;k<N;k++)idx.push(capF,k,(k+1)%N);
  const L=secs.length-1,capB=pos.length/3;pos.push(0,secs[L][3],secs[L][0]);for(let k=0;k<N;k++)idx.push(capB,L*N+(k+1)%N,L*N+k);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
/* Clark Y airfoil, normalised. Upper and lower surfaces as (x/c, y/c). */
const CY_U=[[0,0],[0.0125,0.0315],[0.025,0.042],[0.05,0.056],[0.1,0.073],[0.2,0.0915],[0.3,0.0965],[0.4,0.095],[0.5,0.087],[0.6,0.075],[0.7,0.06],[0.8,0.0425],[0.9,0.023],[1,0.0012]];
const CY_L=[[0,0],[0.0125,-0.012],[0.025,-0.017],[0.05,-0.0205],[0.1,-0.022],[0.2,-0.02],[0.3,-0.017],[0.5,-0.011],[0.7,-0.006],[0.9,-0.002],[1,0]];
function yAt(tab,x){for(let i=1;i<tab.length;i++){if(x<=tab[i][0]){const [x0,y0]=tab[i-1],[x1,y1]=tab[i];return y0+(y1-y0)*(x-x0)/(x1-x0);}}return tab[tab.length-1][1];}
/* section of the airfoil between x0..x1 (fractions of chord), chord c, span along +x from 0..span.
   hinge: chord fraction that sits at local z=0 (so a hinged part rotates about its real hinge line). */
function wingPart(c,x0,x1,span,hinge){const st=[];for(let i=0;i<=16;i++){const x=x0+(x1-x0)*i/16;st.push(x);}
  const shape=new THREE.Shape();const P=[];st.forEach(x=>P.push([x,yAt(CY_U,x)]));st.slice().reverse().forEach(x=>P.push([x,yAt(CY_L,x)]));
  P.forEach(([x,y],i)=>{const sx=-(x-hinge)*c, sy=y*c;if(i===0)shape.moveTo(sx,sy);else shape.lineTo(sx,sy);});
  const g=new THREE.ExtrudeGeometry(shape,{depth:span,bevelEnabled:false,steps:1});
  g.applyMatrix4(new THREE.Matrix4().set(0,0,1,0, 0,1,0,0, -1,0,0,0, 0,0,0,1)); // shape x -> -z (so chord runs aft), extrude -> +x
  g.computeVertexNormals();return g;}
function plateGeo(points,thick){const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));const g=new THREE.ExtrudeGeometry(s,{depth:thick,bevelEnabled:true,bevelThickness:thick*0.35,bevelSize:thick*0.35,bevelSegments:1});g.rotateX(Math.PI/2);g.translate(0,thick/2,0);g.computeVertexNormals();return g;}
function hingeGroup(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function rodTo(parent,a,b,r,m){const v=new THREE.Vector3().subVectors(b,a);const o=sh(new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),6),m));o.position.copy(a).add(b).multiplyScalar(0.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());parent.add(o);return o;}
function decalTex(text,color){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle=color;g.font='700 '+(text.length>3?78:96)+'px Rajdhani, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,70);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
/* buildAircraft(spec, paint, wheels): returns the airframe and its moving parts.
   Sign conventions, checked against the hinge geometry (trailing edge at +z of each hinge group):
   rotation.x > 0 moves a trailing edge DOWN; rotation.y > 0 moves it RIGHT. The left wing group is mirrored in x,
   which leaves rotation about x unchanged. */
function buildAircraft(spec,paint,wheels){
  const G0=spec.geom,k=G0.k,root=new THREE.Group();
  const mP=pbr(new THREE.Color(paint.primary).getHex(),0.6),mS=pbr(new THREE.Color(paint.secondary).getHex(),0.55),mA=pbr(new THREE.Color(paint.accent).getHex(),0.55);
  const FUS=G0.fus.map(([z,w,h,y])=>[z*k,w*k,h*k,y*k]);
  root.add(sh(new THREE.Mesh(loft(FUS.slice(0,G0.cowl),24,3.2),mS)));
  root.add(sh(new THREE.Mesh(loft(FUS.slice(G0.cowl-1),24,3.2),mP)));
  const noseZ=FUS[0][0];const spinner=sh(new THREE.Mesh(new THREE.ConeGeometry(G0.spin,0.05,20),mS));spinner.rotation.x=-Math.PI/2;spinner.position.set(0,FUS[0][3],noseZ-0.025);root.add(spinner);
  if(G0.cabin==='side'){[-1,1].forEach(s=>{const w=sh(new THREE.Mesh(new THREE.PlaneGeometry(0.10*k,0.032*k),matGlass));w.position.set(s*0.0435*k,0.042*k,-0.105*k);w.rotation.y=s*Math.PI/2;root.add(w);});
    const ws=new THREE.Mesh(new THREE.PlaneGeometry(0.07*k,0.04*k),matGlass);ws.position.set(0,0.052*k,-0.168*k);ws.rotation.x=-0.75;root.add(ws);}
  else{const b=sh(new THREE.Mesh(new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2),matGlass));b.scale.set(0.034*k,0.042*k,0.11*k);b.position.set(0,0.036*k,-0.11*k);root.add(b);}
  const C=G0.C,HINGE=0.75,[A0,A1]=G0.ail,TIP=G0.tip,half=0.043*k;
  function wing(side){const w=new THREE.Group();w.position.set(0,G0.wingY,G0.LE);w.rotation.z=side*G0.dih;w.scale.x=side;root.add(w);
    const inner=sh(new THREE.Mesh(wingPart(C,0,1,A0-half,0),mP));inner.position.x=half;w.add(inner);
    const mid=sh(new THREE.Mesh(wingPart(C,0,HINGE,A1-A0,0),mP));mid.position.x=A0;w.add(mid);
    const tip=sh(new THREE.Mesh(wingPart(C,0,1,TIP-A1,0),mS));tip.position.x=A1;w.add(tip);
    const hg=new THREE.Group();hg.position.set(A0+0.002,0,HINGE*C);w.add(hg);hg.add(sh(new THREE.Mesh(wingPart(C,HINGE,1,A1-A0-0.004,HINGE),mA)));
    const fg=new THREE.Group();fg.position.set(half,0,HINGE*C);fg.visible=false;w.add(fg);
    if(side>0){const d=new THREE.Mesh(new THREE.PlaneGeometry(0.16,0.04),new THREE.MeshStandardMaterial({map:decalTex(G0.decal||'JG',paint.accent),transparent:true,roughness:0.6}));d.rotation.x=-Math.PI/2;d.position.set((A0+A1)/2,0.0195*C/0.19,0.065*C/0.19);w.add(d);}
    return {hinge:hg,flap:fg};}
  const wL=wing(-1),wR=wing(1);
  if(G0.struts){[-1,1].forEach(s=>{rodTo(root,new THREE.Vector3(s*0.042*k,-0.035*k,-0.07),new THREE.Vector3(s*0.20,G0.wingY-0.012,-0.07),0.0035,mS);rodTo(root,new THREE.Vector3(s*0.042*k,-0.035*k,-0.05),new THREE.Vector3(s*0.20,G0.wingY-0.012,0),0.0035,mS);});}
  const tk=G0.tail,sz=G0.stabZ*k;
  const stab=sh(new THREE.Mesh(plateGeo([[-0.03,0],[0.03,0],[0.15,0.015],[0.155,0.04],[0.15,0.06],[-0.15,0.06],[-0.155,0.04],[-0.15,0.015]].map(([x,z])=>[x*tk,z*tk]),0.004),mS));stab.position.set(0,FUS[FUS.length-3][3]+0.008,sz);root.add(stab);
  const elev=new THREE.Group();elev.position.set(0,stab.position.y+0.002,sz+0.06*tk);root.add(elev);const em=sh(new THREE.Mesh(plateGeo([[-0.145,0],[0.145,0],[0.14,0.04],[0.02,0.045],[0,0.035],[-0.02,0.045],[-0.14,0.04]].map(([x,z])=>[x*tk,z*tk]),0.0035),mA));em.position.y=-0.002;elev.add(em);
  const finS=new THREE.Shape();[[0,0],[0.062,0],[0.058,0.10],[0.03,0.12],[0.0,0.115],[-0.02,0.05],[-0.06,0.0]].forEach(([z,y],i)=>i?finS.lineTo(z*tk,y*tk):finS.moveTo(z*tk,y*tk));
  const finG=new THREE.ExtrudeGeometry(finS,{depth:0.004,bevelEnabled:false});finG.rotateY(-Math.PI/2);finG.translate(0.002,0,0);finG.computeVertexNormals();
  const fin=sh(new THREE.Mesh(finG,mS));fin.position.set(0,stab.position.y,sz);root.add(fin);
  const rud=new THREE.Group();rud.position.set(0,stab.position.y,sz+0.062*tk);root.add(rud);
  const rS=new THREE.Shape();[[0,0],[0.04,0],[0.042,0.07],[0.025,0.112],[0,0.10]].forEach(([z,y],i)=>i?rS.lineTo(z*tk,y*tk):rS.moveTo(z*tk,y*tk));const rG=new THREE.ExtrudeGeometry(rS,{depth:0.0035,bevelEnabled:false});rG.rotateY(-Math.PI/2);rG.translate(0.00175,0,0);rG.computeVertexNormals();rud.add(sh(new THREE.Mesh(rG,mA)));
  const propHub=new THREE.Group();propHub.position.set(0,FUS[0][3],noseZ-0.012);root.add(propHub);
  const bladeShape=new THREE.Shape();bladeShape.moveTo(0,-0.006);bladeShape.quadraticCurveTo(0.04,-0.012,0.074,-0.004);bladeShape.quadraticCurveTo(0.078,0,0.074,0.004);bladeShape.quadraticCurveTo(0.04,0.01,0,0.006);
  [0,Math.PI].forEach(a=>{const b=new THREE.Mesh(new THREE.ShapeGeometry(bladeShape),new THREE.MeshStandardMaterial({color:0x111214,roughness:0.5,side:THREE.DoubleSide}));b.rotation.z=a;b.rotation.x=0.25;propHub.add(b);});
  const propDisc=new THREE.Mesh(new THREE.CircleGeometry(0.076,32),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));propDisc.position.set(0,FUS[0][3],noseZ-0.014);root.add(propDisc);
  const steer=new THREE.Group();
  (wheels||[]).forEach((W,i)=>{const hub=new THREE.Group();hub.position.copy(W.p);
    const tyre=sh(new THREE.Mesh(new THREE.TorusGeometry(W.r-W.r*0.32,W.r*0.32,8,20),matTyre));tyre.rotation.y=Math.PI/2;hub.add(tyre);
    const disc=sh(new THREE.Mesh(new THREE.CylinderGeometry(W.r*0.62,W.r*0.62,W.r*0.45,14),mS));disc.rotation.z=Math.PI/2;hub.add(disc);
    if(i<2){root.add(hub);rodTo(root,new THREE.Vector3(Math.sign(W.p.x)*0.02,-0.045,W.p.z),W.p.clone(),0.0028,matMetal);rodTo(root,new THREE.Vector3(Math.sign(W.p.x)*0.02,-0.04,W.p.z+0.05),W.p.clone(),0.0024,matMetal);}
    else{steer.position.set(W.p.x,0,W.p.z);hub.position.set(0,W.p.y,0);steer.add(hub);root.add(steer);rodTo(root,new THREE.Vector3(0,0.02,W.p.z-0.01),new THREE.Vector3(0,W.p.y,W.p.z),0.002,matMetal);}});
  return {root,propHub,propDisc,steer,surf:{ailL:wL.hinge,ailR:wR.hinge,elev,rudd:rud,flapL:wL.flap,flapR:wR.flap}};}
const THROW={ail:0.45,ele:0.38,rud:0.5};
function animateCraft(c,inp){c.surf.ailL.rotation.x=inp.ail*THROW.ail;c.surf.ailR.rotation.x=-inp.ail*THROW.ail;c.surf.elev.rotation.x=-inp.ele*THROW.ele;c.surf.rudd.rotation.y=inp.rud*THROW.rud;c.steer.rotation.y=-inp.rud*0.35;c.surf.flapL.rotation.x=c.surf.flapR.rotation.x=inp.flap||0;}
/* the player's aircraft lives in a fixed container; changing plane or paint rebuilds what is inside it */
const plane=new THREE.Group();scene.add(plane);
let craft=null,surf=null,propHub=null,propDisc=null;
function disposeTree(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});}
function loadPlayerAircraft(id){applyAircraftPhysics(id);if(craft){plane.remove(craft.root);disposeTree(craft.root);}craft=buildAircraft(AIRCRAFT[id],paintOf(id),AC.wheels);plane.add(craft.root);surf=craft.surf;propHub=craft.propHub;propDisc=craft.propDisc;st=Sim.create();}
function animateSurfaces(IN){animateCraft(craft,IN);}
loadPlayerAircraft(career.selected);
