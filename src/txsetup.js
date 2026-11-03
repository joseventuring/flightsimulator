/* ---------- transmitter setup screen: autodetect, guided wizard with live verification, free mapping ---------- */
const wiz={on:false,i:0,phase:'detect',base:null,baseB:null,t:0,steps:[]};
function fnAvailable(f){return !f.feature||AC.features[f.feature];}
function usedSrcs(exceptId){const u=new Set();if(!dev)return u;for(const k in dev.map){if(k!==exceptId&&dev.map[k].src)u.add(dev.map[k].src);}return u;}
function srcLabel(src){if(!src)return 'not set';return (src[0]==='a'?'Axis ':'Button ')+src.slice(1);}
function buildTx(){
  const rows=FUNCS.map(f=>{const av=fnAvailable(f);return `<div class="fnrow${av?'':' off'}" data-fn="${f.id}"><span class="fnname">${f.name}<small>${av?(f.desc||''):'not fitted on this aircraft'}</small></span><div class="bar"><i id="fb-${f.id}"></i></div><button class="btn mini" data-assign="${f.id}"${av?'':' disabled'}>${srcLabel(null)}</button><button class="btn mini" data-inv="${f.id}"${av?'':' disabled'}>Rev</button><button class="btn mini" data-clear="${f.id}"${av?'':' disabled'} title="Clear">×</button></div>`;}).join('');
  $('fnTable').innerHTML=rows;
  $('txCard').addEventListener('click',e=>{const a=e.target.closest('[data-assign]'),i=e.target.closest('[data-inv]'),c=e.target.closest('[data-clear]');
    if(a&&dev){startAssign(a.dataset.assign);}
    if(i&&dev){dev.map[i.dataset.inv].inv=!dev.map[i.dataset.inv].inv;saveDevices();refreshTx();}
    if(c&&dev){dev.map[c.dataset.clear]={src:null,inv:false};saveDevices();refreshTx();}});
}
let assignFn=null,assignBase=null,assignBaseB=null,assignT=0;
function startAssign(id){if(!pad){$('txHint').textContent='No transmitter detected. Move a stick first.';return;}assignFn=id;assignBase=padAxes.slice();assignBaseB=padButtons.slice();assignT=performance.now();refreshTx();}
function detectChange(base,baseB,minA,skip){skip=skip||new Set();let best=null,bd=minA||0.5,sign=0;padAxes.forEach((v,i)=>{if(skip.has('a'+i))return;const d=v-base[i];if(Math.abs(d)>bd){bd=Math.abs(d);best='a'+i;sign=Math.sign(d);}});padButtons.forEach((v,i)=>{if(skip.has('b'+i))return;if(Math.abs(v-baseB[i])>0.5){best='b'+i;sign=v>baseB[i]?1:-1;}});return best?{src:best,sign}:null;}
function refreshTx(){
  if($('txCard').hidden||!dev)return;
  FUNCS.forEach(f=>{const m=dev.map[f.id];const b=$('txCard').querySelector(`[data-assign="${f.id}"]`);if(b)b.textContent=assignFn===f.id?'Move it now…':srcLabel(m.src);const inv=$('txCard').querySelector(`[data-inv="${f.id}"]`);if(inv)inv.classList.toggle('on',!!m.inv);const bar=$('fb-'+f.id);if(bar){let v=fnVal(f.id);if(v===null)v=-1;bar.style.width=(((v+1)/2)*100).toFixed(0)+'%';}});
  $('txDevice').textContent=pad?pad.id.slice(0,64):'No transmitter detected';
  $('txMeta').textContent=pad?padAxes.length+' axes · '+padButtons.length+' buttons · '+(dev.done?'setup complete':'setup pending'):'Plug in the sim cable, switch the transmitter on and move a stick. Chrome on the Mac.';
  const ax=$('txAxes');const n=padAxes.length+padButtons.length;if(ax.childElementCount!==n){ax.innerHTML=padAxes.map((v,i)=>`<div><span>A${i}</span><div class="bar"><i id="rawa${i}"></i></div><b id="rawv${i}">0.00</b></div>`).join('')+padButtons.map((v,i)=>`<div><span>B${i}</span><div class="bar"><i id="rawb${i}"></i></div><b></b></div>`).join('');}
  padAxes.forEach((v,i)=>{const e=$('rawa'+i);if(e)e.style.width=((normAxis(i)+1)/2*100).toFixed(0)+'%';const t=$('rawv'+i);if(t)t.textContent=v.toFixed(2);});
  padButtons.forEach((v,i)=>{const e=$('rawb'+i);if(e)e.style.width=v>0.5?'100%':'0%';});
}
function updateTx(){
  if($('txCard').hidden)return;
  selectPad();refreshTx();
  if(assignFn&&pad){const d=detectChange(assignBase,assignBaseB,0.5,usedSrcs(assignFn));if(d){dev.map[assignFn]={src:d.src,inv:false};saveDevices();assignFn=null;$('txHint').textContent=FUNC[assignFn]?'':'Assigned. Use Rev if it runs backwards.';refreshTx();}else if(performance.now()-assignT>8000){assignFn=null;refreshTx();}}
  if(wiz.on)wizTick();
}
/* wizard */
function startWizard(){if(!pad){$('txHint').textContent='No transmitter detected yet. Move a stick on the transmitter, then try again.';return;}
  wiz.steps=FUNCS.filter(f=>fnAvailable(f));wiz.on=true;wiz.i=0;wiz.phase='release';wiz.base=padAxes.slice();wiz.baseB=padButtons.slice();wiz.t=performance.now();
  ['ail','ele','thr','rud'].forEach(k=>dev.map[k]={src:null,inv:false});
  $('wiz').hidden=false;$('fnTable').classList.add('dim');wizRender();}
function wizRender(){const f=wiz.steps[wiz.i];if(!f){return;}
  $('wizStep').textContent='Step '+(wiz.i+1)+' of '+wiz.steps.length;$('wizTitle').textContent=f.name;
  const kind=f.kind;
  if(wiz.phase==='release'){$('wizText').textContent='Let go of all sticks and leave the switches as they are.';$('wizBtns').innerHTML='';}
  else if(wiz.phase==='detect'){$('wizText').textContent=kind==='stick'?f.dir+'.':'Flip the switch or press the button you want for '+f.name+(f.hint?' ('+f.hint+')':'')+'. '+(f.desc||'');$('wizBtns').innerHTML=kind==='stick'?'':'<button class="btn mini" id="wizSkip">Skip, not on my TX</button>';}
  else if(wiz.phase==='verify'){$('wizText').textContent='Detected '+srcLabel(dev.map[f.id].src)+'. '+f.verify;$('wizBtns').innerHTML='<button class="btn mini primary" id="wizOk">Looks right</button><button class="btn mini" id="wizFlip">It is reversed</button><button class="btn mini" id="wizRedo">Detect again</button>';}
  else if(wiz.phase==='sw'){$('wizText').textContent='Detected '+srcLabel(dev.map[f.id].src)+'. Flip it again and watch the bar in the table. For a switch the bar should be full when the function is ON.';$('wizBtns').innerHTML='<button class="btn mini primary" id="wizOk">Looks right</button><button class="btn mini" id="wizFlip">Reverse it</button><button class="btn mini" id="wizRedo">Detect again</button>';}
  const ok=$('wizOk'),fl=$('wizFlip'),rd=$('wizRedo'),sk=$('wizSkip');
  if(ok)ok.onclick=()=>wizNext();if(fl)fl.onclick=()=>{dev.map[f.id].inv=!dev.map[f.id].inv;saveDevices();refreshTx();};if(rd)rd.onclick=()=>{dev.map[f.id]={src:null,inv:false};wiz.phase='release';wiz.t=performance.now();wizRender();};if(sk)sk.onclick=()=>{dev.map[f.id]={src:null,inv:false};wizNext();};
}
function wizNext(){wiz.i++;if(wiz.i>=wiz.steps.length){wiz.on=false;$('wiz').hidden=true;$('fnTable').classList.remove('dim');dev.done=true;saveDevices();showPad();$('txHint').textContent='Setup complete. Everything below is live: move each control and watch the plane.';return;}wiz.phase='release';wiz.t=performance.now();wizRender();}
function wizTick(){const f=wiz.steps[wiz.i];if(!f||!pad)return;
  if(wiz.phase==='release'){const used=usedSrcs(null);const back=padAxes.every((v,i)=>used.has('a'+i)||Math.abs(v-wiz.base[i])<0.3)&&padButtons.every((v,i)=>used.has('b'+i)||v===wiz.baseB[i]);if((back&&performance.now()-wiz.t>400)||performance.now()-wiz.t>2500){wiz.base=padAxes.slice();wiz.baseB=padButtons.slice();wiz.phase='detect';wizRender();}return;}
  if(wiz.phase==='detect'){const used=usedSrcs(f.id);let d=detectChange(wiz.base,wiz.baseB,f.kind==='stick'?0.5:0.4,used);if(d){
      if(f.kind==='stick'){dev.map[f.id]={src:d.src,inv:d.sign<0};}else{dev.map[f.id]={src:d.src,inv:d.src[0]==='a'?d.sign<0:false};}
      saveDevices();wiz.phase=f.kind==='stick'?'verify':'sw';wizRender();refreshTx();}
    return;}
}
function axisOf(id){const m=dev&&dev.map[id];return m&&m.src&&m.src[0]==='a'?+m.src.slice(1):-1;}
function onNewDevice(fresh){if(fresh){if(G.flying){say('New transmitter detected. Open Transmitter to set it up.','warn');}else{openTx(true);}}}
function openTx(auto){G.view='hangar';show('txCard');refreshTx();if(auto&&pad&&!dev.done)startWizard();}
