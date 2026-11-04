/* fresh-pack sag at full power for every aircraft: the alarm must not fire on a full battery */
const THREE=require('three');const Sim=require(require('path').join(__dirname,'..','sim.js'));const AC=Sim.AC,clamp=Sim.clamp;const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','src','aircraft.js'),'utf8');const store={get:(k,d)=>d,set(){}};const num=(v,d)=>d;
const M=new Function('THREE','AC','Sim','store','num','clamp',src+';return {AIRCRAFT,applyAircraftPhysics,statsOf};')(THREE,AC,Sim,store,num,clamp);
const env={wind:new THREE.Vector3(),rho:1.18,surfaceAt:()=>'strip'};
for(const id of Object.keys(M.AIRCRAFT)){M.applyAircraftPhysics(id);const st=Sim.create();st.pos.y+=30;st.airborne=true;st.time=1;
 for(let t=0;t<3;t+=1/240)Sim.step(st,{ail:0,ele:0,rud:0,thr:1,mode:2,vtol:0},1/240,env);
 const perCell=st.volt/AC.cells;console.log(id.padEnd(9),'full power',st.amp.toFixed(0)+' A','per cell',perCell.toFixed(2),'V, alarm at',AC.alarmV,perCell<AC.alarmV?'FALSE ALARM':'ok');if(perCell<AC.alarmV)process.exitCode=1;}
