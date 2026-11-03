/* ---------- scene ---------- */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
let pixelRatio=Math.min(devicePixelRatio||1,1.5);renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled=settings.shadow; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
// adaptive resolution (performance-optimization): measured frame time, 0.25 steps, cooldown, recovery threshold
let perfAcc=0,perfN=0,perfCool=0;
function adaptResolution(dt){perfAcc+=dt*1000;perfN++;perfCool-=dt;if(perfN<180)return;const avg=perfAcc/perfN;perfAcc=0;perfN=0;G.frameMs=avg;if(perfCool>0)return;const devMax=Math.min(devicePixelRatio||1,1.5);if(avg>24&&pixelRatio>0.75){pixelRatio=Math.max(0.75,pixelRatio-0.25);renderer.setPixelRatio(pixelRatio);perfCool=6;}else if(avg<12&&pixelRatio<devMax){pixelRatio=Math.min(devMax,pixelRatio+0.25);renderer.setPixelRatio(pixelRatio);perfCool=10;}}
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xC4D3E0);
scene.fog=new THREE.Fog(0xC4D3E0,220,1100);
const camera=new THREE.PerspectiveCamera(50,1,0.1,2500);
scene.add(new THREE.HemisphereLight(0xdfe9f3,0x4a5a3a,0.95));
const sun=new THREE.DirectionalLight(0xfff1dc,1.5); sun.position.set(-60,90,-40); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-70,right:70,top:70,bottom:-70,far:320}); sun.shadow.bias=-0.0008;
scene.add(sun); scene.add(sun.target);
function grassTex(){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#5f7f3d';g.fillRect(0,0,256,256);for(let i=0;i<3200;i++){g.fillStyle=`hsl(${86+Math.random()*22},${40+Math.random()*25}%,${28+Math.random()*18}%)`;g.fillRect(Math.random()*256,Math.random()*256,2,2+Math.random()*4);}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(240,240);t.anisotropy=4;t.encoding=THREE.sRGBEncoding;return t;}
const lam=c=>new THREE.MeshLambertMaterial({color:c});
const pbr=(c,r)=>new THREE.MeshStandardMaterial({color:c,roughness:r===undefined?0.55:r,metalness:0});
const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color(0x6F9BC4)},hor:{value:new THREE.Color(0xC4D3E0)}},vertexShader:'varying vec3 vW;void main(){vW=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 top;uniform vec3 hor;varying vec3 vW;void main(){float h=clamp(normalize(vW).y,0.0,1.0);gl_FragColor=vec4(mix(hor,top,pow(h,0.55)),1.0);}'}));
sky.renderOrder=-1;scene.add(sky);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),new THREE.MeshLambertMaterial({map:grassTex()}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const runway=new THREE.Mesh(new THREE.PlaneGeometry(7,90),lam(0x8a7a5e));runway.rotation.x=-Math.PI/2;runway.position.set(0,0.01,-25);runway.receiveShadow=true;scene.add(runway);
for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(0.4,3),lam(0xF7F4EE));m.rotation.x=-Math.PI/2;m.position.set(0,0.02,-62+i*10);scene.add(m);}
// runway numbers 00 at the near threshold
function numTex(txt){const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d');g.fillStyle='#F7F4EE';g.font='bold 200px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,64,128);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
const rwyNum=new THREE.Mesh(new THREE.PlaneGeometry(2.2,4.4),new THREE.MeshLambertMaterial({map:numTex('00'),transparent:true}));rwyNum.rotation.x=-Math.PI/2;rwyNum.position.set(0,0.025,14);scene.add(rwyNum);
// flight line and pilot box
const line=new THREE.Mesh(new THREE.BoxGeometry(44,0.02,0.08),lam(0xF7F4EE));line.position.set(0,0.4,2);scene.add(line);
for(const x of [-22,-12,-3,9,20]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.8,6),lam(0xF26522));p.position.set(x,0.4,2);scene.add(p);}
const box=new THREE.Mesh(new THREE.PlaneGeometry(3,3),lam(0xd9d1c0));box.rotation.x=-Math.PI/2;box.position.set(2.5,0.015,4.5);scene.add(box);
// trees, hangar, car (pits)
const trees=[];
const trunkM=lam(0x5a3f28), leafM=lam(0x2f6b3a), leafM2=lam(0x3f7f3f);
function tree(x,z,h){const g=new THREE.Group();const t=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.4,h*0.45,7),trunkM);t.position.y=h*0.22;g.add(t);const c=new THREE.Mesh(new THREE.ConeGeometry(h*0.35,h*0.7,8),Math.random()<0.5?leafM:leafM2);c.position.y=h*0.8;g.add(c);g.position.set(x,0,z);g.traverse(o=>{o.castShadow=true;o.receiveShadow=true});scene.add(g);trees.push({x,z,r:h*0.35,h});}
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
for(let i=0;i<80;i++){const a=rnd()*Math.PI*2,d=70+rnd()*180;const x=Math.cos(a)*d,z=Math.sin(a)*d;if(Math.abs(x)<12&&z>-80&&z<30)continue;tree(x,z,5+rnd()*7);}
for(let i=0;i<14;i++)tree(-30+rnd()*4,-80+i*9,4+rnd()*4);
const hangar=new THREE.Mesh(new THREE.BoxGeometry(10,4,8),lam(0x2A3440));hangar.position.set(18,2,10);hangar.castShadow=hangar.receiveShadow=true;scene.add(hangar);
const roof=new THREE.Mesh(new THREE.BoxGeometry(10.6,0.3,8.6),lam(0xF26522));roof.position.set(18,4.1,10);roof.castShadow=true;scene.add(roof);
const car=new THREE.Mesh(new THREE.BoxGeometry(4.4,1.4,1.8),lam(0xF7F4EE));car.position.set(12,0.75,15);car.castShadow=true;scene.add(car);
// pilot
const pilot=new THREE.Group();const pBody=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.2,1.4,8),lam(0x2A3440));pBody.position.y=0.7;pilot.add(pBody);const pHead=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,8),lam(0xd9a77a));pHead.position.y=1.55;pilot.add(pHead);pilot.position.set(2.5,0,4.5);pilot.traverse(o=>o.castShadow=true);scene.add(pilot);
const PILOT_EYE=new THREE.Vector3(2.5,1.65,4.5);
// windsock
const sock=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,5,6),lam(0xF7F4EE));pole.position.y=2.5;sock.add(pole);
const cone=new THREE.Mesh(new THREE.ConeGeometry(0.28,1.6,10,1,true),new THREE.MeshLambertMaterial({color:0xF26522,side:THREE.DoubleSide}));cone.rotation.z=-Math.PI/2;cone.position.set(0.8,5,0);const sockArm=new THREE.Group();sockArm.position.y=0;sockArm.add(cone);sock.add(sockArm);sock.position.set(-8,0,-6);sock.traverse(o=>o.castShadow=true);scene.add(sock);

