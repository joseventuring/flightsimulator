/* ---------- aircraft data sheet (shown in the Hangar) ---------- */
const SHEET=[
  ['Aircraft','CraycleCub V2 (Craycle, 3D printed)'],['Wingspan','800 mm'],['Mean chord','190 mm'],['Wing area','15.2 dm²'],['All-up weight','620 g'],
  ['Wing loading','40.8 g/dm²'],['Motor','2205 2300KV brushless'],['ESC','30 A, Roboduino'],['Prop','6 x 4 in'],['Battery','3S 2200 mAh 35C LiPo'],
  ['Static thrust','about 720 g'],['Thrust to weight','1.16'],['Stall speed','26 km/h (clean)'],['Best glide','about 34 km/h, L/D 6'],['Cruise at 50%','about 60 km/h'],
  ['Gear','fixed tail-dragger, steerable tailwheel'],['Flaps','not fitted'],['Receiver','FlySky FS-iA6B, 6 ch'],['Channels','1 ail, 2 ele, 3 thr, 4 rud, 5 SWA, 6 SWB'],
  ['Battery alarm','3.6 V per cell'],['CG','20% MAC, static margin 16%'],['Print','PLA Pro+ airframe, PETG mounts, TPU tyres'],
];

/* ---------- aircraft mesh, hinged control surfaces ---------- */
const black=pbr(0x1d2126,0.5), white=pbr(0xF7F4EE,0.45), ice=pbr(0x9ccfe8,0.2), orange=pbr(0xF26522,0.5);
const plane=new THREE.Group();
function part(geo,m,x,y,z,parent){const b=new THREE.Mesh(geo,m);b.position.set(x,y,z);b.castShadow=true;(parent||plane).add(b);return b;}
const bx=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
/* hinge(): a Group at the hinge line; the surface mesh hangs aft of it, so rotation about the group is a real hinge */
function hinge(w,h,d,m,x,y,zHinge,parent){const g=new THREE.Group();g.position.set(x,y,zHinge);const mesh=new THREE.Mesh(bx(w,h,d),m);mesh.position.set(0,0,d/2);mesh.castShadow=true;g.add(mesh);(parent||plane).add(g);return g;}
part(bx(0.075,0.085,0.46),black,0,0,0.02);           // fuselage
part(bx(0.08,0.09,0.12),white,0,0,-0.26);            // nose
part(bx(0.06,0.05,0.12),ice,0,0.065,-0.08);          // canopy
const wingL=new THREE.Group(),wingR=new THREE.Group();wingL.position.set(-0.03,0.045,-0.04);wingR.position.set(0.03,0.045,-0.04);wingL.rotation.z=0.05;wingR.rotation.z=-0.05;plane.add(wingL,wingR);
part(bx(0.29,0.014,0.14),black,-0.16,0,-0.025,wingL);part(bx(0.09,0.015,0.19),white,-0.35,0,0,wingL);
part(bx(0.29,0.014,0.14),black,0.16,0,-0.025,wingR);part(bx(0.09,0.015,0.19),white,0.35,0,0,wingR);
const ailL=hinge(0.2,0.01,0.05,orange,-0.21,0,0.045,wingL), ailR=hinge(0.2,0.01,0.05,orange,0.21,0,0.045,wingR);
const flapL=hinge(0.09,0.01,0.05,black,-0.065,0,0.045,wingL), flapR=hinge(0.09,0.01,0.05,black,0.065,0,0.045,wingR);
[-1,1].forEach(s=>{const strut=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.21,5),white);strut.position.set(s*0.14,-0.02,-0.03);strut.rotation.z=s*1.0;strut.rotation.x=0.1;plane.add(strut);});
part(bx(0.3,0.008,0.085),white,0,0.01,0.26);         // stabiliser
const elev=hinge(0.3,0.008,0.045,orange,0,0.01,0.303); // elevator, hinge at the stab trailing edge
part(bx(0.008,0.13,0.1),white,0,0.07,0.26);          // fin
const rudd=hinge(0.008,0.1,0.04,orange,0,0.07,0.31);  // rudder, hinge at the fin trailing edge
const prop=new THREE.Mesh(new THREE.CylinderGeometry(0.076,0.076,0.004,24),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0.3}));prop.rotation.x=Math.PI/2;prop.position.set(0,0,-0.325);plane.add(prop);
const propBlade=part(bx(0.152,0.012,0.004),black,0,0,-0.325);
AC.wheels.forEach(W=>{const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,0.07,5),black);leg.position.set(W.p.x,W.p.y+0.04,W.p.z);plane.add(leg);const wh=new THREE.Mesh(new THREE.CylinderGeometry(W.r,W.r,0.012,12),black);wh.rotation.z=Math.PI/2;wh.position.copy(W.p);plane.add(wh);});
scene.add(plane);
const surf={ailL,ailR,elev,rudd,flapL,flapR};
/* Sign conventions (verified against the hinge geometry): trailing edge sits at local +z of each hinge group.
   rotation.x > 0 moves the trailing edge DOWN; rotation.y > 0 moves it to the RIGHT (+x).
   Pull (IN.ele > 0) = elevator trailing edge UP. Right stick (IN.ail > 0) = right aileron UP, left DOWN. Right rudder = trailing edge RIGHT. */
function animateSurfaces(IN){
  surf.ailL.rotation.x=IN.ail*0.45; surf.ailR.rotation.x=-IN.ail*0.45;
  surf.elev.rotation.x=-IN.ele*0.45;
  surf.rudd.rotation.y=IN.rud*0.5;
  surf.flapL.rotation.x=surf.flapR.rotation.x=IN.flap;
}
// threejs-gltf-loading: assets/craycle-cub.glb (exported from the Craycle STLs) replaces the box model if present.
// Name the hinge nodes ailL, ailR, elev, rudd, flapL, flapR in the GLB and they animate. Fails silently otherwise.
(function tryGLB(){if(!/^https?:/.test(location.protocol))return;const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';s.onload=()=>{try{new THREE.GLTFLoader().load('assets/craycle-cub.glb',g=>{const m=g.scene;m.traverse(o=>{if(o.isMesh)o.castShadow=true;});plane.children.slice().forEach(c=>{if(c!==propBlade&&c!==prop)plane.remove(c);});plane.add(m);['ailL','ailR','elev','rudd','flapL','flapR'].forEach(n=>{const o=m.getObjectByName(n);if(o)surf[n]=o;});},undefined,()=>{});}catch(e){}};s.onerror=()=>{};document.head.appendChild(s);})();
