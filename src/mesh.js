/* ---------- aircraft data sheet ---------- */
const SHEET=[
  ['Aircraft','CraycleCub V2, 3D printed'],['Wingspan','800 mm'],['Mean chord','190 mm, Clark Y 11.7%'],['Wing area','15.2 dm²'],['All-up weight','620 g'],
  ['Wing loading','40.8 g/dm²'],['Motor','2205 2300KV brushless'],['ESC','30 A'],['Prop','6 x 4 in'],['Battery','3S 2200 mAh 35C LiPo'],
  ['Static thrust','about 720 g'],['Thrust to weight','1.16'],['Stall','26 km/h clean'],['Best glide','34 km/h, L/D about 6'],['Cruise at half throttle','60 km/h'],
  ['Gear','fixed tail-dragger, steerable tailwheel'],['Flaps','not fitted'],['Receiver','FlySky FS-iA6B, 6 ch'],['Throws','ail ±26°, ele ±22°, rud ±29°'],
  ['Battery alarm','3.6 V per cell'],['CG','20% MAC, static margin 16%'],['Print','PLA Pro+ airframe, PETG mounts, TPU tyres'],
];

/* ---------- procedural aircraft (CraycleCub V2). Local frame: x right, y up, nose toward -z ---------- */
const matBlack=pbr(0x202429,0.62), matWhite=pbr(0xF2EFE8,0.55), matOrange=pbr(0xF26522,0.55), matGlass=new THREE.MeshStandardMaterial({color:0x1d3446,roughness:0.15,metalness:0.1}), matTyre=pbr(0x15171a,0.9), matMetal=new THREE.MeshStandardMaterial({color:0x9aa3ad,roughness:0.35,metalness:0.7});
const plane=new THREE.Group();
const sh=m=>{m.castShadow=true;m.receiveShadow=true;return m;};
/* loft: sections [z, width, height, yCentre], superellipse cross-section (n=3.2 reads as a rounded box, like a printed fuselage) */
function loft(secs,N,n){const pos=[],idx=[];secs.forEach(([z,w,h,yc])=>{for(let k=0;k<N;k++){const t=k/N*Math.PI*2,c=Math.cos(t),s=Math.sin(t);pos.push(Math.sign(c)*Math.pow(Math.abs(c),2/n)*w/2, yc+Math.sign(s)*Math.pow(Math.abs(s),2/n)*h/2, z);}});
  for(let i=0;i<secs.length-1;i++)for(let k=0;k<N;k++){const a=i*N+k,b=i*N+(k+1)%N,c=(i+1)*N+k,d=(i+1)*N+(k+1)%N;idx.push(a,c,b,b,c,d);}
  const capF=pos.length/3;pos.push(0,secs[0][3],secs[0][0]);for(let k=0;k<N;k++)idx.push(capF,k,(k+1)%N);
  const L=secs.length-1,capB=pos.length/3;pos.push(0,secs[L][3],secs[L][0]);for(let k=0;k<N;k++)idx.push(capB,L*N+(k+1)%N,L*N+k);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
const FUS=[[-0.318,0.064,0.070,0.000],[-0.300,0.078,0.086,0.002],[-0.250,0.084,0.096,0.006],[-0.200,0.086,0.104,0.010],[-0.130,0.086,0.118,0.020],[-0.040,0.084,0.112,0.018],[0.050,0.074,0.094,0.016],[0.140,0.058,0.074,0.018],[0.230,0.040,0.054,0.022],[0.300,0.024,0.036,0.028],[0.335,0.012,0.022,0.032]];
plane.add(sh(new THREE.Mesh(loft(FUS.slice(0,4),24,3.2),matWhite)));        // cowl, white as per the colour plan
plane.add(sh(new THREE.Mesh(loft(FUS.slice(3),24,3.2),matBlack)));          // fuselage
const spinner=sh(new THREE.Mesh(new THREE.ConeGeometry(0.026,0.05,20),matWhite));spinner.rotation.x=-Math.PI/2;spinner.position.set(0,0,-0.343);plane.add(spinner);
// cabin glazing
[-1,1].forEach(s=>{const w=sh(new THREE.Mesh(new THREE.PlaneGeometry(0.10,0.032),matGlass));w.position.set(s*0.0435,0.042,-0.105);w.rotation.y=s*Math.PI/2;plane.add(w);});
const wsGeo=new THREE.PlaneGeometry(0.07,0.04);const ws=new THREE.Mesh(wsGeo,matGlass);ws.position.set(0,0.052,-0.168);ws.rotation.x=-0.75;plane.add(ws);

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
const C=0.19, LE=-0.135, WY=0.066, AIL0=0.11, AIL1=0.31, TIP=0.40, HINGE=0.75;
function buildWing(side){ // side +1 right, -1 left; left built mirrored (three flips the face winding for negative scale)
  const w=new THREE.Group();w.position.set(0,WY,LE);w.rotation.z=side*0.05;w.scale.x=side;plane.add(w); /* dihedral: tips up on both sides */
  const inner=sh(new THREE.Mesh(wingPart(C,0,1,AIL0-0.043,0),matBlack));inner.position.x=0.043;w.add(inner);
  const midFwd=sh(new THREE.Mesh(wingPart(C,0,HINGE,AIL1-AIL0,0),matBlack));midFwd.position.x=AIL0;w.add(midFwd);
  const tip=sh(new THREE.Mesh(wingPart(C,0,1,TIP-AIL1,0),matWhite));tip.position.x=AIL1;w.add(tip);
  const hg=hingeGroup(w,AIL0+0.002,0,HINGE*C);const ail=sh(new THREE.Mesh(wingPart(C,HINGE,1,AIL1-AIL0-0.004,HINGE),matOrange));hg.add(ail);
  const fg=hingeGroup(w,0.045,0,HINGE*C);fg.visible=false;  // flap hinge, used only by aircraft with flaps
  // JG mark on the top of the right wing
  if(side>0){const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');g.fillStyle='#F26522';g.font='700 92px Rajdhani, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('JG',128,68);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;
    const d=new THREE.Mesh(new THREE.PlaneGeometry(0.12,0.06),new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:0.6}));d.rotation.x=-Math.PI/2;d.position.set(0.21,0.0195,0.06);w.add(d);}
  return {hinge:hg,flap:fg};}
const wL=buildWing(-1), wR=buildWing(1);
// struts: fuselage lower longeron to the wing at 50% semispan
function rod(a,b,r,m){const v=new THREE.Vector3().subVectors(b,a);const g=new THREE.CylinderGeometry(r,r,v.length(),6);const o=sh(new THREE.Mesh(g,m));o.position.copy(a).add(b).multiplyScalar(0.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());plane.add(o);return o;}
[-1,1].forEach(s=>{rod(new THREE.Vector3(s*0.042,-0.035,-0.07),new THREE.Vector3(s*0.20,WY-0.012,-0.07),0.0035,matWhite);rod(new THREE.Vector3(s*0.042,-0.035,-0.05),new THREE.Vector3(s*0.20,WY-0.012,-0.0),0.0035,matWhite);});
// tail: stabiliser (white) with elevator hinged at its trailing edge, fin with rudder
const stab=sh(new THREE.Mesh(plateGeo([[-0.03,0],[0.03,0],[0.15,0.015],[0.155,0.04],[0.15,0.06],[-0.15,0.06],[-0.155,0.04],[-0.15,0.015]],0.004),matWhite));stab.position.set(0,0.03,0.245);plane.add(stab);
const elevH=hingeGroup(plane,0,0.032,0.305);const elevM=sh(new THREE.Mesh(plateGeo([[-0.145,0],[0.145,0],[0.14,0.04],[0.02,0.045],[0,0.035],[-0.02,0.045],[-0.14,0.04]],0.0035),matOrange));elevM.position.y=-0.002;elevH.add(elevM);
const finGeo=(()=>{const s=new THREE.Shape();[[0,0],[0.062,0],[0.058,0.10],[0.03,0.12],[0.0,0.115],[-0.02,0.05],[-0.06,0.0]].forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));const g=new THREE.ExtrudeGeometry(s,{depth:0.004,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(0.002,0,0);g.computeVertexNormals();return g;})();
const fin=sh(new THREE.Mesh(finGeo,matWhite));fin.position.set(0,0.03,0.245);plane.add(fin);
const rudH=hingeGroup(plane,0,0.03,0.307);const rudGeo=(()=>{const s=new THREE.Shape();[[0,0],[0.04,0],[0.042,0.07],[0.025,0.112],[0,0.10]].forEach(([z,y],i)=>i?s.lineTo(z,y):s.moveTo(z,y));const g=new THREE.ExtrudeGeometry(s,{depth:0.0035,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(0.00175,0,0);g.computeVertexNormals();return g;})();
const rudM=sh(new THREE.Mesh(rudGeo,matOrange));rudH.add(rudM);
// propeller: two twisted blades plus a blur disc that fades in with rpm
const propHub=new THREE.Group();propHub.position.set(0,0,-0.33);plane.add(propHub);
const bladeShape=new THREE.Shape();bladeShape.moveTo(0,-0.006);bladeShape.quadraticCurveTo(0.04,-0.012,0.074,-0.004);bladeShape.quadraticCurveTo(0.078,0,0.074,0.004);bladeShape.quadraticCurveTo(0.04,0.01,0,0.006);
[0,Math.PI].forEach(a=>{const b=new THREE.Mesh(new THREE.ShapeGeometry(bladeShape),new THREE.MeshStandardMaterial({color:0x111214,roughness:0.5,side:THREE.DoubleSide}));b.rotation.z=a;b.rotation.x=0.25;propHub.add(b);});
const propDisc=new THREE.Mesh(new THREE.CircleGeometry(0.076,32),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));propDisc.position.set(0,0,-0.332);plane.add(propDisc);
// landing gear: wire legs, TPU tyres on hubs, steerable tailwheel
const steer=new THREE.Group();
AC.wheels.forEach((W,i)=>{const hub=new THREE.Group();hub.position.copy(W.p);
  const tyre=sh(new THREE.Mesh(new THREE.TorusGeometry(W.r-W.r*0.32,W.r*0.32,8,20),matTyre));tyre.rotation.y=Math.PI/2;hub.add(tyre);
  const disc=sh(new THREE.Mesh(new THREE.CylinderGeometry(W.r*0.62,W.r*0.62,W.r*0.45,14),matWhite));disc.rotation.z=Math.PI/2;hub.add(disc);
  if(i<2){plane.add(hub);rod(new THREE.Vector3(Math.sign(W.p.x)*0.02,-0.045,W.p.z),new THREE.Vector3(W.p.x,W.p.y,W.p.z),0.0028,matMetal);rod(new THREE.Vector3(Math.sign(W.p.x)*0.02,-0.04,W.p.z+0.05),new THREE.Vector3(W.p.x,W.p.y,W.p.z),0.0024,matMetal);}
  else{steer.position.set(W.p.x,0,W.p.z);hub.position.set(0,W.p.y,0);steer.add(hub);plane.add(steer);rod(new THREE.Vector3(0,0.02,W.p.z-0.01),new THREE.Vector3(0,W.p.y,W.p.z),0.002,matMetal);}});
scene.add(plane);
const surf={ailL:wL.hinge,ailR:wR.hinge,elev:elevH,rudd:rudH,flapL:wL.flap,flapR:wR.flap};
/* Sign conventions, checked against the hinge geometry (trailing edge at +z of each hinge group):
   rotation.x > 0 moves a trailing edge DOWN; rotation.y > 0 moves it RIGHT.
   Right stick: left aileron down, right aileron up. Pull: elevator trailing edge up. Right rudder: trailing edge right.
   The left wing group is mirrored in x; rotation about x is unaffected by that mirror. */
const THROW={ail:0.45,ele:0.38,rud:0.5};
function animateSurfaces(IN){
  surf.ailL.rotation.x=IN.ail*THROW.ail; surf.ailR.rotation.x=-IN.ail*THROW.ail;
  surf.elev.rotation.x=-IN.ele*THROW.ele;
  surf.rudd.rotation.y=IN.rud*THROW.rud; steer.rotation.y=-IN.rud*0.35;
  surf.flapL.rotation.x=surf.flapR.rotation.x=IN.flap;
}
// threejs-gltf-loading: assets/craycle-cub.glb replaces the procedural airframe when present; hinge nodes named ailL, ailR, elev, rudd animate.
(function tryGLB(){if(!/^https?:/.test(location.protocol))return;const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';s.onload=()=>{try{new THREE.GLTFLoader().load('assets/craycle-cub.glb',g=>{const m=g.scene;m.traverse(o=>{if(o.isMesh)o.castShadow=true;});plane.children.slice().forEach(c=>{if(c!==propHub&&c!==propDisc)plane.remove(c);});plane.add(m);['ailL','ailR','elev','rudd','flapL','flapR'].forEach(n=>{const o=m.getObjectByName(n);if(o)surf[n]=o;});},undefined,()=>{});}catch(e){}};s.onerror=()=>{};document.head.appendChild(s);})();
