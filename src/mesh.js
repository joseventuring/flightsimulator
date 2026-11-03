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
function wingPart(c,x0,x1,span,hinge,foil){const [FU,FL]=foil||[CY_U,CY_L];const st=[];for(let i=0;i<=16;i++){const x=x0+(x1-x0)*i/16;st.push(x);}
  const shape=new THREE.Shape();const P=[];st.forEach(x=>P.push([x,yAt(FU,x)]));st.slice().reverse().forEach(x=>P.push([x,yAt(FL,x)]));
  P.forEach(([x,y],i)=>{const sx=-(x-hinge)*c, sy=y*c;if(i===0)shape.moveTo(sx,sy);else shape.lineTo(sx,sy);});
  const g=new THREE.ExtrudeGeometry(shape,{depth:span,bevelEnabled:false,steps:1});
  g.applyMatrix4(new THREE.Matrix4().set(0,0,1,0, 0,1,0,0, -1,0,0,0, 0,0,0,1)); // shape x -> -z (so chord runs aft), extrude -> +x
  g.computeVertexNormals();return g;}
function plateGeo(points,thick){const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));const g=new THREE.ExtrudeGeometry(s,{depth:thick,bevelEnabled:true,bevelThickness:thick*0.35,bevelSize:thick*0.35,bevelSegments:1});g.rotateX(Math.PI/2);g.translate(0,thick/2,0);g.computeVertexNormals();return g;}
function hingeGroup(parent,x,y,z){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function rodTo(parent,a,b,r,m){const v=new THREE.Vector3().subVectors(b,a);const o=sh(new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),6),m));o.position.copy(a).add(b).multiplyScalar(0.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());parent.add(o);return o;}
function decalTex(text,color){const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle=color;g.font='700 '+(text.length>3?78:96)+'px Rajdhani, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,256,70);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
/* symmetric 3D section (NACA 0008-like): flat, equal camber both sides, flies the same upright and inverted */
const SYM_U=[[0,0],[0.0125,0.0126],[0.025,0.0174],[0.05,0.0237],[0.1,0.0312],[0.2,0.0384],[0.3,0.04],[0.4,0.0387],[0.5,0.0353],[0.6,0.0306],[0.7,0.0247],[0.8,0.0177],[0.9,0.0097],[1,0.0008]];
const SYM_L=SYM_U.map(([x,y])=>[x,-y]);
/* taper about the hinge line: the hinge stays straight (so surfaces rotate about their real axis), the leading edge sweeps back,
   the trailing edge comes forward, thickness scales with chord. offX/offZ place the part inside the wing group. */
function taperGeo(g,offX,offZ,Hz,tip,tr){if(tr>=1)return g;const P=g.attributes.position;for(let i=0;i<P.count;i++){const xg=offX+P.getX(i),s=1-(1-tr)*clamp(xg/tip,0,1);
  const zg=offZ+P.getZ(i);P.setZ(i,Hz+(zg-Hz)*s-offZ);P.setY(i,P.getY(i)*s);}P.needsUpdate=true;g.computeVertexNormals();return g;}
/* buildAircraft(spec, paint, wheels): returns the airframe and its moving parts.
   Sign conventions, checked against the hinge geometry (trailing edge at +z of each hinge group):
   rotation.x > 0 moves a trailing edge DOWN; rotation.y > 0 moves it RIGHT. The left wing group is mirrored in x,
   which leaves rotation about x unchanged. */
function buildAircraft(spec,paint,wheels){
  const G0=spec.geom,k=G0.k,root=new THREE.Group();
  const mP=pbr(new THREE.Color(paint.primary).getHex(),0.6),mS=pbr(new THREE.Color(paint.secondary).getHex(),0.55),mA=pbr(new THREE.Color(paint.accent).getHex(),0.55),mDark=pbr(0x0d0f12,0.8);
  const FUS=G0.fus.map(([z,w,h,y])=>[z*k,w*k,h*k,y*k]);
  if(G0.profile){/* flat side outline, 6 mm EPP */
    const S=new THREE.Shape();FUS.forEach(([z,w,h,y],i)=>i?S.lineTo(z,y+h/2):S.moveTo(z,y+h/2));FUS.slice().reverse().forEach(([z,w,h,y])=>S.lineTo(z,y-h/2));
    const g=new THREE.ExtrudeGeometry(S,{depth:0.006,bevelEnabled:false});g.rotateY(-Math.PI/2);g.translate(0.003,0,0);g.computeVertexNormals();root.add(sh(new THREE.Mesh(g,mP)));
    const box=sh(new THREE.Mesh(new THREE.BoxGeometry(0.03,0.05,0.05),mS));box.position.set(0,FUS[0][3],FUS[0][0]+0.03);root.add(box);
    const stripe=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.012),mA);stripe.rotation.y=Math.PI/2;stripe.position.set(0.0032,FUS[2][3]+0.035,0.05);root.add(stripe);const s2=stripe.clone();s2.rotation.y=-Math.PI/2;s2.position.x=-0.0032;root.add(s2);}
  else{root.add(sh(new THREE.Mesh(loft(FUS.slice(0,G0.cowl),24,G0.edf?2.4:3.2),mS)));root.add(sh(new THREE.Mesh(loft(FUS.slice(G0.cowl-1),24,G0.edf?2.4:3.2),mP)));}
  const noseZ=FUS[0][0];
  if(!G0.edf){const spinner=sh(new THREE.Mesh(new THREE.ConeGeometry(G0.spin,0.05,20),mS));spinner.rotation.x=-Math.PI/2;spinner.position.set(0,FUS[0][3],noseZ-0.025);root.add(spinner);}
  else{/* cheek intakes feeding the fan, and the exhaust nozzle */
    const L=FUS[FUS.length-1];const noz=sh(new THREE.Mesh(new THREE.CylinderGeometry(L[1]*0.42,L[1]*0.46,0.05,20,1,true),matMetal));noz.rotation.x=Math.PI/2;noz.position.set(0,L[3],L[0]+0.02);root.add(noz);
    const hole=new THREE.Mesh(new THREE.CircleGeometry(L[1]*0.42,20),mDark);hole.position.set(0,L[3],L[0]+0.044);root.add(hole);
    const fi=FUS.findIndex(f=>f[0]>-0.2*k);const F=FUS[fi];[-1,1].forEach(sd=>{const ik=sh(new THREE.Mesh(new THREE.CylinderGeometry(0.022*k,0.026*k,0.16*k,14,1,true),mS));ik.rotation.x=Math.PI/2;ik.position.set(sd*(F[1]/2+0.012*k),F[3]-0.01*k,F[0]+0.05*k);root.add(ik);
      const lip=new THREE.Mesh(new THREE.CircleGeometry(0.021*k,14),mDark);lip.position.set(ik.position.x,ik.position.y,ik.position.z-0.08*k+0.002);lip.rotation.y=Math.PI;root.add(lip);});}
  if(G0.cabin==='side'){[-1,1].forEach(s=>{const w=sh(new THREE.Mesh(new THREE.PlaneGeometry(0.10*k,0.032*k),matGlass));w.position.set(s*0.0435*k,0.042*k,-0.105*k);w.rotation.y=s*Math.PI/2;root.add(w);});
    const ws=new THREE.Mesh(new THREE.PlaneGeometry(0.07*k,0.04*k),matGlass);ws.position.set(0,0.052*k,-0.168*k);ws.rotation.x=-0.75;root.add(ws);}
  else if(G0.cabin==='bubble'){const b=sh(new THREE.Mesh(new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2),matGlass));b.scale.set(0.034*k,0.042*k,0.11*k);b.position.set(0,(G0.edf?0.045:0.036)*k,(G0.edf?-0.2:-0.11)*k);root.add(b);}
  const C=G0.C,HINGE=G0.hinge||0.75,[A0,A1]=G0.ail,TIP=G0.tip,half=(G0.profile?0.004:0.043*k),TR=G0.taper||1,Hz=HINGE*C,SW=G0.sweep||0;
  const foil=G0.airfoil==='sym'?[SYM_U,SYM_L]:[CY_U,CY_L];
  const part=(x0,x1,span,hinge,offX,offZ)=>taperGeo(wingPart(C,x0,x1,span,hinge,foil),offX,offZ,Hz,TIP,TR);
  function wing(side){const w=new THREE.Group();w.position.set(0,G0.wingY,G0.LE);w.rotation.z=side*(G0.dih||0);w.rotation.y=-side*SW;w.scale.x=side;root.add(w);
    const fg=new THREE.Group();fg.position.set(half,0,Hz);w.add(fg);
    if(G0.flaps){const inner=sh(new THREE.Mesh(part(0,HINGE,A0-half,0,half,0),mP));inner.position.x=half;w.add(inner);
      fg.add(sh(new THREE.Mesh(part(HINGE,1,A0-half-0.004,HINGE,half,Hz),mS)));}
    else{const inner=sh(new THREE.Mesh(part(0,1,A0-half,0,half,0),mP));inner.position.x=half;w.add(inner);fg.visible=false;}
    const mid=sh(new THREE.Mesh(part(0,HINGE,A1-A0,0,A0,0),mP));mid.position.x=A0;w.add(mid);
    const tip=sh(new THREE.Mesh(part(0,1,TIP-A1,0,A1,0),mS));tip.position.x=A1;w.add(tip);
    const hg=new THREE.Group();hg.position.set(A0+0.002,0,Hz);w.add(hg);hg.add(sh(new THREE.Mesh(part(HINGE,1,A1-A0-0.004,HINGE,A0+0.002,Hz),mA)));
    if(side>0){const xm=(A0+A1)/2,sm=1-(1-TR)*clamp(xm/TIP,0,1);const d=new THREE.Mesh(new THREE.PlaneGeometry(0.16*C/0.19*sm,0.04*C/0.19*sm),new THREE.MeshStandardMaterial({map:decalTex(G0.decal||'JG',paint.accent),transparent:true,roughness:0.6}));d.rotation.x=-Math.PI/2;d.position.set(xm,(G0.airfoil==='sym'?0.041:0.0195/0.19)*C*sm+0.0008,Hz-(Hz-0.065*C/0.19)*sm);w.add(d);}
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
  const pr=(G0.propR||0.074)/0.074;
  const bladeShape=new THREE.Shape();bladeShape.moveTo(0,-0.006*pr);bladeShape.quadraticCurveTo(0.04*pr,-0.012*pr,0.074*pr,-0.004*pr);bladeShape.quadraticCurveTo(0.078*pr,0,0.074*pr,0.004*pr);bladeShape.quadraticCurveTo(0.04*pr,0.01*pr,0,0.006*pr);
  [0,Math.PI].forEach(a=>{const b=new THREE.Mesh(new THREE.ShapeGeometry(bladeShape),new THREE.MeshStandardMaterial({color:0x111214,roughness:0.5,side:THREE.DoubleSide}));b.rotation.z=a;b.rotation.x=0.25;propHub.add(b);});
  const propDisc=new THREE.Mesh(new THREE.CircleGeometry(0.076*pr,32),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));propDisc.position.set(0,FUS[0][3],noseZ-0.014);root.add(propDisc);
  if(G0.edf){propHub.visible=false;propDisc.visible=false;}
  /* landing gear: each leg hangs from a pivot so retracts fold the way real ones do (mains inward, nose leg aft) */
  const steer=new THREE.Group(),legs=[];const top=G0.gearTop||-0.045;
  (wheels||[]).forEach((W,i)=>{const leg=new THREE.Group();const main=i<2,px=main?Math.sign(W.p.x)*Math.max(0.02,Math.abs(W.p.x)*(G0.edf?1:0.15)):0;
    leg.position.set(px,top,W.p.z);root.add(leg);const holder=main?leg:steer;if(!main){steer.position.set(0,0,0);leg.add(steer);}
    const hub=new THREE.Group();hub.position.set(W.p.x-px,W.p.y-top,0);holder.add(hub);
    const tyre=sh(new THREE.Mesh(new THREE.TorusGeometry(W.r-W.r*0.32,W.r*0.32,8,20),matTyre));tyre.rotation.y=Math.PI/2;hub.add(tyre);
    const disc=sh(new THREE.Mesh(new THREE.CylinderGeometry(W.r*0.62,W.r*0.62,W.r*0.45,14),mS));disc.rotation.z=Math.PI/2;hub.add(disc);
    rodTo(holder,new THREE.Vector3(0,0,0),hub.position.clone(),main?0.0028*Math.max(1,k*0.8):0.002*Math.max(1,k*0.8),matMetal);
    if(main&&!G0.edf)rodTo(holder,new THREE.Vector3(0,0.005,0.05),hub.position.clone(),0.0024,matMetal);
    legs.push({g:leg,main,side:Math.sign(W.p.x)||1,sgn:Math.sign(W.steer||1)});});
  return {root,propHub,propDisc,steer,legs,retracts:!!(spec.phys&&spec.phys.features&&spec.phys.features.gear),surf:{ailL:wL.hinge,ailR:wR.hinge,elev,rudd:rud,flapL:wL.flap,flapR:wR.flap}};}

/* ---------- 5 inch FPV quad: carbon X frame, stack, battery on top, tilted camera, 2306 motors, triblade props ---------- */
function buildQuad(spec,paint){const g=spec.geom,a=g.arm,R=g.propR,root=new THREE.Group();
  const carbon=new THREE.MeshStandardMaterial({color:0x17191c,roughness:0.45,metalness:0.25}),mP=pbr(new THREE.Color(paint.primary).getHex(),0.55),mS=pbr(new THREE.Color(paint.secondary).getHex(),0.6),mA=new THREE.Color(paint.accent).getHex();
  [-1,1].forEach(s=>{const arm=sh(new THREE.Mesh(new THREE.BoxGeometry(0.017,0.005,Math.SQRT2*a*2+0.02),carbon));arm.rotation.y=s*Math.PI/4;arm.position.y=0.002;root.add(arm);});
  const bot=sh(new THREE.Mesh(new THREE.BoxGeometry(0.042,0.004,0.11),carbon));bot.position.y=0.004;root.add(bot);
  const top=sh(new THREE.Mesh(new THREE.BoxGeometry(0.04,0.003,0.09),carbon));top.position.y=0.034;root.add(top);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([x,z])=>{const so=sh(new THREE.Mesh(new THREE.CylinderGeometry(0.0025,0.0025,0.03,6),matMetal));so.position.set(x*0.016,0.019,z*0.04);root.add(so);});
  const stack=sh(new THREE.Mesh(new THREE.BoxGeometry(0.03,0.016,0.03),pbr(0x1d5a3a,0.6)));stack.position.set(0,0.016,0.005);root.add(stack);
  const batt=sh(new THREE.Mesh(new THREE.BoxGeometry(0.035,0.032,0.072),mS));batt.position.set(0,0.053,0.004);root.add(batt);
  const strap=sh(new THREE.Mesh(new THREE.BoxGeometry(0.038,0.035,0.012),mP));strap.position.set(0,0.053,0.004);root.add(strap);
  const camG=new THREE.Group();camG.position.set(0,0.019,-0.05);camG.rotation.x=25*Math.PI/180;root.add(camG);
  const cam=sh(new THREE.Mesh(new THREE.BoxGeometry(0.019,0.019,0.02),pbr(0x101214,0.5)));camG.add(cam);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.008,0.01,14),matGlass);lens.rotation.x=Math.PI/2;lens.position.z=-0.014;camG.add(lens);
  [-1,1].forEach(s=>{const side=sh(new THREE.Mesh(new THREE.BoxGeometry(0.004,0.03,0.035),mP));side.position.set(s*0.017,0.019,-0.045);root.add(side);});
  rodTo(root,new THREE.Vector3(0,0.03,0.05),new THREE.Vector3(0,0.075,0.085),0.0012,pbr(0x111111,0.6));
  const ant=new THREE.Mesh(new THREE.SphereGeometry(0.004,8,6),mP);ant.position.set(0,0.077,0.087);root.add(ant);
  const props=[],M=[[-1,-1,-1],[1,-1,1],[-1,1,1],[1,1,-1]];
  const bladeS=new THREE.Shape();bladeS.moveTo(0,-0.004);bladeS.quadraticCurveTo(R*0.45,-0.011,R,-0.004);bladeS.quadraticCurveTo(R*1.03,0,R,0.003);bladeS.quadraticCurveTo(R*0.5,0.008,0,0.004);
  const bladeG=new THREE.ShapeGeometry(bladeS);bladeG.rotateX(-Math.PI/2);
  M.forEach(([sx,sz,dir])=>{const x=sx*a,z=sz*a;
    const bell=sh(new THREE.Mesh(new THREE.CylinderGeometry(0.0145,0.0145,0.012,16),matMetal));bell.position.set(x,0.014,z);root.add(bell);
    const base=sh(new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,0.006,16),carbon));base.position.set(x,0.006,z);root.add(base);
    const pg=new THREE.Group();pg.position.set(x,0.024,z);root.add(pg);
    const bm=new THREE.MeshStandardMaterial({color:mA,roughness:0.4,transparent:true,opacity:0.92,side:THREE.DoubleSide});const blades=[];
    for(let k=0;k<3;k++){const b=new THREE.Mesh(bladeG,bm);b.rotation.y=k*Math.PI*2/3;b.rotation.z=dir*0.12;pg.add(b);blades.push(b);}
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.008,10),bm);pg.add(hub);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(R,32),new THREE.MeshBasicMaterial({color:mA,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));disc.rotation.x=-Math.PI/2;pg.add(disc);
    props.push({g:pg,dir,blades,disc});});
  const dummy=()=>{const o=new THREE.Group();root.add(o);return o;};
  const propHub=dummy(),propDisc=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({visible:false}));root.add(propDisc);
  return {root,propHub,propDisc,steer:dummy(),legs:[],retracts:false,props,surf:{ailL:dummy(),ailR:dummy(),elev:dummy(),rudd:dummy(),flapL:dummy(),flapR:dummy()}};}
const THROW={ail:0.45,ele:0.38,rud:0.5};
function animateCraft(c,inp,gp){
  if(c.props){/* props spin with each motor's own speed; past a third of full speed the blades blur into a disc */
    c.props.forEach((P,i)=>{const m=(typeof st!=='undefined'&&st.motor)?st.motor[i]:0;P.g.rotation.y+=P.dir*(m*4.2+(m>0.01?0.6:0));P.blades.forEach(b=>b.visible=m<0.35);P.disc.material.opacity=clamp((m-0.2)*0.9,0,0.38);});return;}c.surf.ailL.rotation.x=inp.ail*THROW.ail;c.surf.ailR.rotation.x=-inp.ail*THROW.ail;c.surf.elev.rotation.x=-inp.ele*THROW.ele;c.surf.rudd.rotation.y=inp.rud*THROW.rud;c.surf.flapL.rotation.x=c.surf.flapR.rotation.x=inp.flap||0;
  /* the steerable wheel turns through the same angle the physics uses: tailwheels follow the rudder, nosewheels turn against it */
  const sw=(c.legs&&c.legs[2])?c.legs[2].sgn:1;c.steer.rotation.y=sw*inp.rud*0.35;
  if(c.retracts){gp=gp||0;c.legs.forEach(L=>{if(L.main)L.g.rotation.z=-L.side*gp*1.5;else L.g.rotation.x=-gp*1.55;L.g.visible=gp<0.97;});}}
/* the player's aircraft lives in a fixed container; changing plane or paint rebuilds what is inside it */
const plane=new THREE.Group();scene.add(plane);
let craft=null,surf=null,propHub=null,propDisc=null,loadedId=null;
function disposeTree(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();if(n.material){(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});}
function loadPlayerAircraft(id){loadedId=id;applyAircraftPhysics(id);const sn=document.getElementById('sName');if(sn)sn.textContent=AIRCRAFT[id].name;if(typeof syncFeatureButtons==='function')syncFeatureButtons();if(craft){plane.remove(craft.root);disposeTree(craft.root);}craft=AIRCRAFT[id].kind==='quad'?buildQuad(AIRCRAFT[id],paintOf(id)):buildAircraft(AIRCRAFT[id],paintOf(id),AC.wheels);if(typeof applyStabLabel==='function')applyStabLabel();plane.add(craft.root);surf=craft.surf;propHub=craft.propHub;propDisc=craft.propDisc;st=Sim.create();}
function animateSurfaces(IN){animateCraft(craft,IN,st.gearPos);}
loadPlayerAircraft(career.selected);
