/* ---------- feedback: pooled dust particles, flash, trauma (game-feel) ---------- */
const PN=240;const pPos=new Float32Array(PN*3),pVel=new Float32Array(PN*3),pAge=new Float32Array(PN);let pNext=0;
const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3));
function dotTex(){const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');const r=g.createRadialGradient(16,16,2,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.5,'rgba(255,255,255,.45)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);}
const pMat=new THREE.PointsMaterial({color:0xC9B48A,size:0.09,map:dotTex(),transparent:true,opacity:0.7,depthWrite:false,alphaTest:0.02});
const pts=new THREE.Points(pGeo,pMat);pts.frustumCulled=false;scene.add(pts);
for(let i=0;i<PN;i++){pPos[i*3+1]=-50;pAge[i]=9;}
function burst(x,y,z,n,spread,up){if(reduceMotion)n=Math.min(n,6);for(let k=0;k<n;k++){const i=pNext;pNext=(pNext+1)%PN;pPos[i*3]=x;pPos[i*3+1]=y;pPos[i*3+2]=z;pVel[i*3]=(Math.random()-0.5)*spread;pVel[i*3+1]=Math.random()*up;pVel[i*3+2]=(Math.random()-0.5)*spread;pAge[i]=0;}}
function updateParticles(dt){let any=false;for(let i=0;i<PN;i++){if(pAge[i]>1.4)continue;any=true;pAge[i]+=dt;pVel[i*3+1]-=3*dt;pPos[i*3]+=pVel[i*3]*dt;pPos[i*3+1]=Math.max(0.02,pPos[i*3+1]+pVel[i*3+1]*dt);pPos[i*3+2]+=pVel[i*3+2]*dt;if(pAge[i]>1.4)pPos[i*3+1]=-50;}if(any)pGeo.attributes.position.needsUpdate=true;}
function flash(){if(reduceMotion)return;const f=$('flash');f.classList.add('on');requestAnimationFrame(()=>requestAnimationFrame(()=>f.classList.remove('on')));}
function feedback(tier,x,y,z){if(tier==='small'){burst(x,y,z,10,1.5,1.2);}else if(tier==='medium'){burst(x,y,z,24,2.5,2.5);G.trauma=Math.min(1,G.trauma+0.35);}else{burst(x,y,z,70,4,4);G.trauma=1;flash();}}
const tweens=[];function tween(obj,from,to,dur,ease){tweens.push({obj,from,to,dur,t:0,ease});}
const easeOutBack=t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
function updateTweens(dt){for(let i=tweens.length-1;i>=0;i--){const w=tweens[i];w.t+=dt;const k=Math.min(1,w.t/w.dur);const e=w.ease(k);w.obj.scale.setScalar(w.from+(w.to-w.from)*e);if(k>=1)tweens.splice(i,1);}}

