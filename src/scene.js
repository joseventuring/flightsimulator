/* ---------- renderer (threejs-scene-setup, performance-optimization) ---------- */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!MOBILE,powerPreference:'high-performance',logarithmicDepthBuffer:true}); // the real maps span 14 km: log depth stops the field overlays flickering
const PR_MAX=MOBILE?Math.min(devicePixelRatio||1,1.75):Math.min(devicePixelRatio||1,1.5);let pixelRatio=MOBILE?Math.min(1.25,PR_MAX):PR_MAX;renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled=settings.shadow; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
let perfAcc=0,perfN=0,perfCool=0;
function adaptResolution(dt){perfAcc+=dt*1000;perfN++;perfCool-=dt;if(perfN<180)return;const avg=perfAcc/perfN;perfAcc=0;perfN=0;G.frameMs=avg;if(perfCool>0)return;const devMax=PR_MAX;if(avg>24&&pixelRatio>0.75){pixelRatio=Math.max(0.75,pixelRatio-0.25);renderer.setPixelRatio(pixelRatio);perfCool=6;}else if(avg<12&&pixelRatio<devMax){pixelRatio=Math.min(devMax,pixelRatio+0.25);renderer.setPixelRatio(pixelRatio);perfCool=10;}}
const scene=new THREE.Scene();
const HAZE=new THREE.Color(0xC9D6DF);
scene.background=HAZE.clone();
scene.fog=new THREE.FogExp2(HAZE.getHex(),MOBILE?0.00045:0.00038); // about 4 to 5 km of visibility: lakes and ridges on the real maps read
const camera=new THREE.PerspectiveCamera(50,1,0.08,9000);
const lam=c=>new THREE.MeshLambertMaterial({color:c});
const pbr=(c,r)=>new THREE.MeshStandardMaterial({color:c,roughness:r===undefined?0.55:r,metalness:0});
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};

/* ---------- sky: gradient atmosphere with a sun disc and glow, sun direction shared with the light ---------- */
const SUN_DIR=new THREE.Vector3(-0.45,0.62,-0.64).normalize();   // late morning, sun to the south-west of RWY 00
const sky=new THREE.Mesh(new THREE.SphereGeometry(3000,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{zen:{value:new THREE.Color(0x3F78B5)},hor:{value:HAZE.clone()},gnd:{value:new THREE.Color(0x9AAA9A)},sun:{value:SUN_DIR}},
  vertexShader:'varying vec3 vD;void main(){vD=normalize((modelMatrix*vec4(position,1.0)).xyz-cameraPosition);vec4 p=projectionMatrix*viewMatrix*vec4((modelMatrix*vec4(position,1.0)).xyz,1.0);gl_Position=p.xyww;}',
  fragmentShader:'uniform vec3 zen,hor,gnd,sun;varying vec3 vD;void main(){vec3 d=normalize(vD);float h=d.y;vec3 c=h>0.0?mix(hor,zen,pow(clamp(h,0.0,1.0),0.5)):mix(hor,gnd,clamp(-h*6.0,0.0,1.0));float s=max(dot(d,sun),0.0);c+=vec3(1.0,0.86,0.62)*(pow(s,8.0)*0.25+pow(s,64.0)*0.5)+vec3(1.0,0.97,0.9)*smoothstep(0.9993,0.9997,s)*3.0;gl_FragColor=vec4(c,1.0);}'}));
sky.renderOrder=-10;sky.frustumCulled=false;scene.add(sky);
scene.add(new THREE.HemisphereLight(0xD6E4F0,0x4E5E3A,0.85));
const sun=new THREE.DirectionalLight(0xFFF0D8,1.65);sun.castShadow=true;
sun.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:400});sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.02;
scene.add(sun);scene.add(sun.target);

/* ---------- terrain: flat field inside 380 m, rolling foothills, Western Ghats ridges beyond ---------- */
function hash(x,z){const s=Math.sin(x*127.1+z*311.7)*43758.5453;return s-Math.floor(s);}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,z){let s=0,a=0.5,f=1;for(let i=0;i<5;i++){s+=a*vnoise(x*f,z*f);f*=2.03;a*=0.5;}return s;}
const FIELD_C={x:0,z:-20};
const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
/* real terrain: the field is levelled out to 250 m, then blends into the elevation data by 520 m; lake beds sit under the water */
function terrainH(x,z){const r=Math.hypot(x-FIELD_C.x,z-FIELD_C.z);if(r<250)return 0;const k=smooth(250,520,r);let h=k*demH(x,z);
  const wc=waterCell(x,z);if(wc>=0)h=Math.min(h,MAP.L[wc]-1.5);return h;}
const DECCAN=MAP.theme==='deccan';
function detailTex(base,spots,n,size){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.fillStyle=base;g.fillRect(0,0,size,size);for(let i=0;i<n;i++){g.fillStyle=spots[(Math.random()*spots.length)|0];const w=1+Math.random()*2,h=2+Math.random()*5;g.globalAlpha=0.35+Math.random()*0.5;g.fillRect(Math.random()*size,Math.random()*size,w,h);}g.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=MOBILE?2:8;t.encoding=THREE.sRGBEncoding;return t;}
/* real textures (Poly Haven, CC0) load over the procedural ones; if they fail, the procedural ones stay */
const texLoader=new THREE.TextureLoader();
function upgradeMap(mat,url,repeat){texLoader.load(url,t=>{t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.copy(repeat);t.anisotropy=MOBILE?4:8;mat.map=t;mat.needsUpdate=true;},undefined,()=>{});}
const grassMap=detailTex('#7f9a5a',['#6b8a46','#8fae63','#5f7d3e','#9cb56f','#74924f'],9000,256);grassMap.repeat.set(420,420);
{const S=MAP.size,N=MOBILE?160:260;const geo=new THREE.PlaneGeometry(S,S,N,N);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;const col=new Float32Array(pos.count*3);
  /* Kerala: wet greens, darker on the rubber hills. Deccan: dry khaki grass, olive scrub, pink-grey granite on the slopes */
  const cA=new THREE.Color(DECCAN?0x7d7040:0x5a8436),cB=new THREE.Color(DECCAN?0x5c5a2c:0x3f6228),cC=new THREE.Color(DECCAN?0x6e5c4a:0x34502a),cD=new THREE.Color(DECCAN?0x4f5e2c:0x7a8d4c),tmp=new THREE.Color();
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const h=terrainH(x,z);pos.setY(i,h);const n=fbm(x*0.01,z*0.01);tmp.copy(cA).lerp(cB,n);
    const sl=Math.min(1,Math.hypot(terrainH(x+20,z)-h,terrainH(x,z+20)-h)/9);
    if(DECCAN){tmp.lerp(cC,clamp(sl*1.2,0,0.85));if(waterCell(x,z)>=0||waterCell(x+40,z)>=0||waterCell(x,z+40)>=0)tmp.lerp(cD,0.7);}
    else{if(h>40)tmp.lerp(cC,clamp((h-40)/120,0,0.8));if(h<0.5&&Math.hypot(x,z+20)>200)tmp.lerp(cD,0.25*fbm(x*0.03,z*0.03));tmp.lerp(cC,sl*0.35);}
    /* baked hillshade: slopes facing a low western sun lighten, the far sides darken, so the real ridges and valleys read from the field */
    {const gx=(terrainH(x+30,z)-terrainH(x-30,z))/60,gz=(terrainH(x,z+30)-terrainH(x,z-30))/60;const nl=Math.hypot(gx,1,gz);const sh=(-gx*-0.72+1*0.5+-gz*-0.1)/(nl*Math.hypot(0.72,0.5,0.1));tmp.multiplyScalar(0.62+0.55*clamp(sh,0,1.1));}
    col[i*3]=tmp.r;col[i*3+1]=tmp.g;col[i*3+2]=tmp.b;}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
  const gMat=new THREE.MeshLambertMaterial({map:grassMap,vertexColors:true});
  /* two-scale ground shading: the fine grass detail is softened so its tiling never reads as a grid, and a large noise
     texture (about 600 m per repeat) breaks the ground into fields, scrub and bare patches */
  const macro=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const im=g.createImageData(256,256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){const v=fbm(x/26,y/26)*0.75+fbm(x/7+40,y/7)*0.25;const k=(0.72+v*0.5)*255;const i=(y*256+x)*4;im.data[i]=k;im.data[i+1]=k*(0.97+0.06*fbm(x/40,y/40+9));im.data[i+2]=k*0.95;im.data[i+3]=255;}
    g.putImageData(im,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;})();
  gMat.onBeforeCompile=sh=>{sh.uniforms.macroMap={value:macro};sh.fragmentShader='uniform sampler2D macroMap;\n'+sh.fragmentShader.replace('#include <map_fragment>',
    '#ifdef USE_MAP\n vec4 texelColor=texture2D(map,vUv);texelColor=mapTexelToLinear(texelColor);diffuseColor.rgb*=mix(vec3(0.8),texelColor.rgb*1.25,0.45);\n diffuseColor.rgb*=texture2D(macroMap,vUv*0.0019).rgb*1.05;\n#endif');};upgradeMap(gMat,'assets/grass_detail_512.jpg',new THREE.Vector2(600,600));const ground=new THREE.Mesh(geo,gMat);ground.receiveShadow=true;scene.add(ground);}
/* lakes: one quad per water cell at that lake's level, merged into a single mesh */
{const n=MAP.n,s=MAP.size,c=s/(n-1);const P=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i;if(!MAP.W[k])continue;const L=MAP.L[k],x=-s/2+i*c,z=-s/2+j*c,h=c*0.55;
    P.push(x-h,L,z-h, x-h,L,z+h, x+h,L,z+h, x-h,L,z-h, x+h,L,z+h, x+h,L,z-h);}
  if(P.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.computeVertexNormals();
    const water=new THREE.Mesh(g,new THREE.MeshPhongMaterial({color:0x2c5363,specular:0x6f8fa0,shininess:90,transparent:true,opacity:0.92}));water.receiveShadow=true;scene.add(water);}}
// mowed field with stripes, then the strip
{const c=document.createElement('canvas');c.width=64;c.height=512;const g=c.getContext('2d');for(let i=0;i<8;i++){g.fillStyle=i%2?'#86a95e':'#7a9c53';g.fillRect(0,i*64,64,64);}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,3);
  const fMat=new THREE.MeshLambertMaterial({color:0x8fae63});upgradeMap(fMat,'assets/field_grass_512.jpg',new THREE.Vector2(30,42));const base=new THREE.Mesh(new THREE.PlaneGeometry(150,210),fMat);base.rotation.x=-Math.PI/2;base.position.set(0,0.004,-25);base.receiveShadow=true;scene.add(base);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(150,210),new THREE.MeshLambertMaterial({map:t,transparent:true,opacity:0.32,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(0,0.006,-25);scene.add(m);}
function stripTex(){const c=document.createElement('canvas');c.width=128;c.height=1024;const g=c.getContext('2d');g.fillStyle='#9a8466';g.fillRect(0,0,128,1024);for(let i=0;i<9000;i++){const v=110+Math.random()*70|0;g.fillStyle=`rgba(${v},${v-14},${v-34},${0.35+Math.random()*0.4})`;g.fillRect(Math.random()*128,Math.random()*1024,1+Math.random()*2,1+Math.random()*2);}
  g.fillStyle='rgba(70,58,44,.28)';[36,44,84,92].forEach(x=>g.fillRect(x,0,5,1024));g.fillStyle='rgba(122,150,82,.55)';for(let i=0;i<40;i++)g.fillRect(Math.random()<0.5?0:118,Math.random()*1024,10,30+Math.random()*60);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=MOBILE?2:8;return t;}
const rwMat=new THREE.MeshLambertMaterial({map:stripTex()});upgradeMap(rwMat,'assets/laterite_512.jpg',new THREE.Vector2(1.4,18));const runway=new THREE.Mesh(new THREE.PlaneGeometry(7,90),rwMat);runway.rotation.x=-Math.PI/2;runway.position.set(0,0.012,-25);runway.receiveShadow=true;scene.add(runway);
{const c=document.createElement('canvas');c.width=128;c.height=1024;const g=c.getContext('2d');g.fillStyle='rgba(60,32,22,.35)';[36,44,84,92].forEach(x=>g.fillRect(x,0,5,1024));g.fillStyle='rgba(110,140,70,.6)';for(let i=0;i<50;i++)g.fillRect(Math.random()<0.5?0:116,Math.random()*1024,12,20+Math.random()*60);const t=new THREE.CanvasTexture(c);const ov=new THREE.Mesh(new THREE.PlaneGeometry(7,90),new THREE.MeshLambertMaterial({map:t,transparent:true,depthWrite:false}));ov.rotation.x=-Math.PI/2;ov.position.set(0,0.014,-25);scene.add(ov);}
for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(0.35,2.6),lam(0xEDE8DC));m.rotation.x=-Math.PI/2;m.position.set(0,0.02,-62+i*10);m.receiveShadow=true;scene.add(m);}
function numTex(txt){const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d');g.fillStyle='#EDE8DC';g.font='bold 200px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(txt,64,128);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
const rwyNum=new THREE.Mesh(new THREE.PlaneGeometry(2.2,4.4),new THREE.MeshLambertMaterial({map:numTex('00'),transparent:true}));rwyNum.rotation.x=-Math.PI/2;rwyNum.position.set(0,0.025,14);scene.add(rwyNum);

/* ---------- vegetation, instanced: coconut palms and rubber trees near the field, plantation rows on the hills ---------- */
const trees=[];const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_e=new THREE.Euler(),_c=new THREE.Color();
function frondTex(){const c=document.createElement('canvas');c.width=256;c.height=64;const g=c.getContext('2d');
  // solid leaf silhouette so alpha survives mipmapping at distance, leaflet lines drawn on top for close views
  g.fillStyle='#5a7c31';g.beginPath();g.moveTo(0,32);g.quadraticCurveTo(110,-6,256,30);g.lineTo(256,34);g.quadraticCurveTo(110,70,0,32);g.fill();
  g.strokeStyle='rgba(38,58,20,.75)';g.lineWidth=1.4;for(let x=10;x<246;x+=6){const L=28*Math.sin(Math.PI*x/256);g.beginPath();g.moveTo(x,32);g.lineTo(x+9,32-L);g.moveTo(x,32);g.lineTo(x+9,32+L);g.stroke();}
  g.strokeStyle='#6f5b3a';g.lineWidth=3;g.beginPath();g.moveTo(0,32);g.lineTo(256,32);g.stroke();
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
const palms=[],rubbers=[];
function okSpot(x,z){if(Math.abs(x)<14&&z>-85&&z<35)return false;if(x>-26&&x<36&&z>-6&&z<28)return false;if(z>-2&&z<12&&Math.abs(x)<30)return false;return true;}
for(let i=0;i<(MOBILE?70:110);i++){const a=rnd()*Math.PI*2,d=55+rnd()*260;const x=Math.cos(a)*d,z=-20+Math.sin(a)*d;if(!okSpot(x,z))continue;(rnd()<(DECCAN?0.25:0.55)?palms:rubbers).push({x,z,h:rnd()});}
for(let i=0;i<12;i++)palms.push({x:-32+rnd()*5,z:-90+i*10,h:rnd()});   // palm row along the west boundary, the one to clear on takeoff
for(let i=0;i<6;i++)palms.push({x:30+rnd()*6,z:22+rnd()*12,h:rnd()});
{ // palms
  const trunkGeo=new THREE.CylinderGeometry(0.15,0.22,1,7,1);trunkGeo.translate(0,0.5,0);
  const frGeo=new THREE.PlaneGeometry(3.2,0.8,8,1);frGeo.translate(1.6,0,0);{const p=frGeo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,y);p.setY(i,-0.09*x*x+0.3*x);}frGeo.computeVertexNormals();}
  const frMat=new THREE.MeshLambertMaterial({map:frondTex(),alphaTest:0.35,side:THREE.DoubleSide});
  const trunks=new THREE.InstancedMesh(trunkGeo,lam(0x6b5a45),palms.length);const fronds=new THREE.InstancedMesh(frGeo,frMat,palms.length*10);
  palms.forEach((P,i)=>{const g0=terrainH(P.x,P.z),h=(DECCAN?10:8)+P.h*7,tx=(rnd()-0.5)*0.25,tz=(rnd()-0.5)*0.25;_e.set(tx,0,tz);_q.setFromEuler(_e);_m.compose(_p.set(P.x,g0,P.z),_q,_s.set(1,h,1));trunks.setMatrixAt(i,_m);
    const top=new THREE.Vector3(0,h,0).applyQuaternion(_q).add(_p.set(P.x,g0,P.z));
    for(let k=0;k<10;k++){_e.set(0,k/10*Math.PI*2+rnd()*0.4,(rnd()-0.3)*0.5,'YZX');_q.setFromEuler(_e);_m.compose(top,_q,_s.setScalar(1.25+rnd()*0.45));fronds.setMatrixAt(i*10+k,_m);}
    trees.push({x:P.x,z:P.z,r:2.2,h:g0+h+1});});
  trunks.castShadow=fronds.castShadow=true;fronds.receiveShadow=true;scene.add(trunks,fronds);}
{ // rubber trees: tall thin trunk, dense rounded crown
  const tg=new THREE.CylinderGeometry(0.14,0.22,1,6);tg.translate(0,0.5,0);const cg=new THREE.IcosahedronGeometry(1,1);
  const trunks=new THREE.InstancedMesh(tg,lam(0x6a5a48),rubbers.length);const crowns=new THREE.InstancedMesh(cg,lam(0xffffff),rubbers.length*3);
  rubbers.forEach((R,i)=>{const g0=terrainH(R.x,R.z),h=(DECCAN?6:9)+R.h*(DECCAN?4:6);_m.compose(_p.set(R.x,g0,R.z),_q.identity(),_s.set(1,h*0.7,1));trunks.setMatrixAt(i,_m);
    for(let k=0;k<3;k++){const ox=(rnd()-0.5)*2.4,oz=(rnd()-0.5)*2.4,oy=g0+h*(DECCAN?0.7:0.62)+k*(DECCAN?0.7:1.2)+rnd();_m.compose(_p.set(R.x+ox,oy,R.z+oz),_q.setFromEuler(_e.set(rnd(),rnd(),0)),_s.set((DECCAN?3.2:2.4)+rnd(),(DECCAN?1.6:1.8)+rnd()*0.8,(DECCAN?3.2:2.4)+rnd()));crowns.setMatrixAt(i*3+k,_m);crowns.setColorAt(i*3+k,DECCAN?_c.setHSL(0.21+rnd()*0.04,0.36,0.2+rnd()*0.06):_c.setHSL(0.26+rnd()*0.05,0.42,0.22+rnd()*0.08));}
    trees.push({x:R.x,z:R.z,r:DECCAN?3.6:3,h:g0+h+2});});
  trunks.castShadow=crowns.castShadow=true;crowns.receiveShadow=true;scene.add(trunks,crowns);}
{ // plantation rows on the hills: cheap, no shadows, fade into the haze
  const N=DECCAN?(MOBILE?900:1800):(MOBILE?2200:4200);const g=new THREE.IcosahedronGeometry(1,0);const im=new THREE.InstancedMesh(g,lam(0xffffff),N);let n=0;
  for(let t=0;t<N*4&&n<N;t++){const a=rnd()*Math.PI*2,d=DECCAN?420+rnd()*1100:340+Math.pow(rnd(),0.8)*2400;let x=Math.cos(a)*d,z=-20+Math.sin(a)*d;if(!DECCAN){x=Math.round(x/9)*9;z=Math.round(z/9)*9;}const h=terrainH(x,z);if((!DECCAN&&h<-2&&rnd()<0.7)||waterCell(x,z)>=0)continue;
    _m.compose(_p.set(x+rnd(),h+(DECCAN?2.4:4),z+rnd()),_q.identity(),DECCAN?_s.set(2.6+rnd()*1.5,2+rnd()*1.2,2.6+rnd()*1.5):_s.set(3.2,3.6+rnd()*1.5,3.2));im.setMatrixAt(n,_m);im.setColorAt(n,DECCAN?_c.setHSL(0.19,0.3,0.2+rnd()*0.07):_c.setHSL(0.27,0.38,0.17+rnd()*0.06));n++;}
  im.count=n;scene.add(im);}

/* Deccan granite: boulder clusters on the rises, the landform the Hyderabad plateau is known for */
if(DECCAN){const N=MOBILE?260:520;const g=new THREE.DodecahedronGeometry(1,0);const im=new THREE.InstancedMesh(g,lam(0xffffff),N);let n=0;
  for(let t=0;t<N*6&&n<N;t++){const a=rnd()*Math.PI*2,d=330+rnd()*1600;const cx=Math.cos(a)*d,cz=-20+Math.sin(a)*d;const h0=terrainH(cx,cz);if(waterCell(cx,cz)>=0)continue;
    const sl=Math.hypot(terrainH(cx+20,cz)-h0,terrainH(cx,cz+20)-h0);if(sl<1.2&&rnd()<0.75)continue;
    const k=2+Math.floor(rnd()*4);for(let b=0;b<k&&n<N;b++){const x=cx+(rnd()-0.5)*14,z=cz+(rnd()-0.5)*14,sc=1.5+rnd()*4.5;const y=terrainH(x,z)+sc*0.45;
      _m.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(rnd()*3,rnd()*3,rnd()*3)),_s.set(sc*(1+rnd()*0.5),sc*(0.7+rnd()*0.4),sc*(1+rnd()*0.4)));im.setMatrixAt(n,_m);im.setColorAt(n,_c.setHSL(0.05+rnd()*0.04,0.1+rnd()*0.08,0.27+rnd()*0.1));
      trees.push({x,z,r:sc,h:y+sc*0.6});n++;}}
  im.count=n;im.castShadow=true;im.receiveShadow=true;scene.add(im);}
/* ---------- field furniture: flight line, pilot box, shed, canopy, car, pilot, windsock ---------- */
const line=new THREE.Mesh(new THREE.BoxGeometry(44,0.02,0.06),lam(0xEDE8DC));line.position.set(0,0.4,2);scene.add(line);
for(const x of [-22,-12,-3,9,20]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.8,6),lam(0xF26522));p.position.set(x,0.4,2);scene.add(p);}
const box=new THREE.Mesh(new THREE.PlaneGeometry(3,3),lam(0xcfc6b2));box.rotation.x=-Math.PI/2;box.position.set(2.5,0.015,4.5);scene.add(box);
const hangar=new THREE.Group();{const walls=new THREE.Mesh(new THREE.BoxGeometry(10,3.6,8),lam(0x2A3440));walls.position.y=1.8;const roofG=new THREE.CylinderGeometry(5.6,5.6,8.4,3,1,false);const roofM=new THREE.Mesh(roofG,lam(0xF26522));roofM.rotation.x=Math.PI/2;roofM.rotation.y=Math.PI/2;roofM.scale.set(1,1,0.32);roofM.position.y=3.6+0.9;
  const door=new THREE.Mesh(new THREE.PlaneGeometry(6,3),lam(0x1d242c));door.position.set(0,1.5,-4.01);door.rotation.y=Math.PI;hangar.add(walls,roofM,door);}
hangar.position.set(18,0,10);hangar.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});scene.add(hangar);
const tent=new THREE.Group();{const top=new THREE.Mesh(new THREE.ConeGeometry(2.6,0.9,4),lam(0xEDE8DC));top.position.y=2.6;top.rotation.y=Math.PI/4;tent.add(top);[[-1.7,-1.7],[1.7,-1.7],[-1.7,1.7],[1.7,1.7]].forEach(([x,z])=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.2,5),lam(0x8a9099));l.position.set(x,1.1,z);tent.add(l);});
  const table=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.05,0.7),lam(0xcfc6b2));table.position.set(0,0.75,0);tent.add(table);}
tent.position.set(9,0,8);tent.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(tent);
const car=new THREE.Group();{const body=new THREE.Mesh(new THREE.BoxGeometry(4.4,0.8,1.8),pbr(0xE9E6E0,0.35));body.position.y=0.65;const cab=new THREE.Mesh(new THREE.BoxGeometry(2.4,0.6,1.6),pbr(0x26313d,0.15));cab.position.set(-0.2,1.3,0);car.add(body,cab);[[-1.4,0.9],[1.4,0.9],[-1.4,-0.9],[1.4,-0.9]].forEach(([x,z])=>{const w=new THREE.Mesh(new THREE.CylinderGeometry(0.33,0.33,0.22,14),lam(0x15171a));w.rotation.x=Math.PI/2;w.position.set(x,0.33,z);car.add(w);});}
car.position.set(13,0,16);car.rotation.y=0.3;car.traverse(o=>{if(o.isMesh)o.castShadow=true;});scene.add(car);
const pilot=new THREE.Group();const pBody=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.2,1.4,8),lam(0x2A3440));pBody.position.y=0.7;pilot.add(pBody);const pHead=new THREE.Mesh(new THREE.SphereGeometry(0.13,10,8),lam(0xc99872));pHead.position.y=1.55;pilot.add(pHead);pilot.position.set(2.5,0,4.5);pilot.traverse(o=>o.castShadow=true);scene.add(pilot);
const PILOT_EYE=new THREE.Vector3(2.5,1.65,4.5);
const sock=new THREE.Group();const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.05,5,6),lam(0xEDE8DC));pole.position.y=2.5;sock.add(pole);
const cone=new THREE.Mesh(new THREE.ConeGeometry(0.28,1.6,10,1,true),new THREE.MeshLambertMaterial({color:0xF26522,side:THREE.DoubleSide}));cone.rotation.z=-Math.PI/2;cone.position.set(0.8,5,0);const sockArm=new THREE.Group();sockArm.add(cone);sock.add(sockArm);sock.position.set(16,0,-30); /* off the right side of the strip, clear of the pilot's view of low passes */sock.traverse(o=>o.castShadow=true);scene.add(sock);

/* ---------- clouds: clustered billboards drifting with the wind ---------- */
const clouds=[];{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');for(let i=0;i<16;i++){const x=22+Math.random()*84,y=48+Math.random()*34,r=16+Math.random()*28;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.85)');gr.addColorStop(0.6,'rgba(244,246,248,.4)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);}
  const tex=new THREE.CanvasTexture(c);const n=MOBILE?12:22;for(let i=0;i<n;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0.9,depthWrite:false,fog:false}));const s=140+Math.random()*200;m.scale.set(s,s*0.42,1);m.position.set((Math.random()-0.5)*2400,260+Math.random()*160,(Math.random()-0.5)*2400);scene.add(m);clouds.push(m);}}
function updateClouds(dt){clouds.forEach(c=>{c.position.x+=wind.mean.x*dt*1.5;c.position.z+=wind.mean.z*dt*1.5;if(c.position.x>1200)c.position.x-=2400;if(c.position.x<-1200)c.position.x+=2400;if(c.position.z>1200)c.position.z-=2400;if(c.position.z<-1200)c.position.z+=2400;});}
function placeSun(target){sun.target.position.copy(target);sun.position.copy(target).addScaledVector(SUN_DIR,150);}
