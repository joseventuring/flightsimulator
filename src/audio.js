/* ---------- sound (audio-design skill): buses master <- motor, wind, warden, alerts. Slider squared before gain. ----------
   Motor model: rpm = KV x pack voltage x throttle x load factor. The tone you hear from an electric RC plane is the
   blade-pass frequency (rpm/60 x 2 blades) plus the brushless whine at the electrical frequency (7 pole pairs).
   In pilot view the sound falls off with distance and loses its top end, the way it does at the field. */
let audio=null,beepT=0;
function masterGain(){const s=settings.vol/100;return s*s;}
function initAudio(){try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const master=ctx.createGain();master.gain.value=masterGain();master.connect(ctx.destination);
  const pan=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();pan.connect(master);
  const motor=ctx.createGain();motor.gain.value=0;const air=ctx.createBiquadFilter();air.type='lowpass';air.frequency.value=4000;motor.connect(air);air.connect(pan);
  const blade=ctx.createOscillator();blade.type='sawtooth';const bladeG=ctx.createGain();bladeG.gain.value=0.55;blade.connect(bladeG);bladeG.connect(motor);
  const sub=ctx.createOscillator();sub.type='square';sub.detune.value=9;const subG=ctx.createGain();subG.gain.value=0.22;sub.connect(subG);subG.connect(motor);
  const whine=ctx.createOscillator();whine.type='sine';const whineG=ctx.createGain();whineG.gain.value=0.07;whine.connect(whineG);whineG.connect(motor);
  [blade,sub,whine].forEach(o=>o.start());
  const windG=ctx.createGain();windG.gain.value=0;windG.connect(master);const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const ns=ctx.createBufferSource();ns.buffer=nb;ns.loop=true;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=600;bp.Q.value=0.6;ns.connect(bp);bp.connect(windG);ns.start();
  /* ducted fan: broadband rush through the duct, shaped by a band that rises with fan speed; it rides the motor bus so it pans and fades with the model */
  const jet=ctx.createGain();jet.gain.value=0;const jbp=ctx.createBiquadFilter();jbp.type='bandpass';jbp.Q.value=0.9;const js=ctx.createBufferSource();js.buffer=nb;js.loop=true;js.connect(jbp);jbp.connect(jet);jet.connect(motor);js.start();
  const warden=ctx.createGain();warden.gain.value=0;const wPan=ctx.createStereoPanner?ctx.createStereoPanner():ctx.createGain();warden.connect(wPan);wPan.connect(master);
  const wo=ctx.createOscillator();wo.type='sawtooth';wo.frequency.value=520;const wf=ctx.createBiquadFilter();wf.type='lowpass';wf.frequency.value=1400;wo.connect(wf);wf.connect(warden);wo.start();
  const siren=ctx.createOscillator();siren.type='triangle';const sirenG=ctx.createGain();sirenG.gain.value=0;siren.connect(sirenG);sirenG.connect(wPan);siren.start();
  const alerts=ctx.createGain();alerts.gain.value=0.9;alerts.connect(master);
  audio={ctx,master,pan,motor,air,blade,sub,whine,jet,jbp,bladeG,subG,whineG,wind:windG,windF:bp,alerts,warden,wPan,wo,siren,sirenG};}catch(e){audio=null;}}
function tone(freq,dur,type,vol,bus){if(!audio)return;const o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type=type||'square';o.frequency.value=freq*(1+(Math.random()-0.5)*0.06);g.gain.value=vol;g.gain.setTargetAtTime(0,audio.ctx.currentTime+dur*0.6,dur*0.2);o.connect(g);g.connect(bus||audio.alerts);o.start();o.stop(audio.ctx.currentTime+dur);}
function beep(){if(G.sound)tone(2200,0.12,'square',0.05);}
function chime(){if(G.sound){tone(880,0.18,'sine',0.06);setTimeout(()=>tone(1320,0.22,'sine',0.05),90);}}
function thud(k){if(G.sound)tone(70+40*k,0.25,'triangle',0.12*k);}
const _ap=new THREE.Vector3(),_ar=new THREE.Vector3();
function panFor(pos){_ap.copy(pos).sub(camera.position);const d=_ap.length();_ar.set(1,0,0).applyQuaternion(camera.quaternion);return {d,pan:d>0.01?clamp(_ap.dot(_ar)/d,-1,1)*0.8:0};}
function updateAudio(dt){if(!audio)return;const on=G.sound&&!G.crashed&&!G.landed&&!G.paused&&G.view==='fly';const now=audio.ctx.currentTime;
  const rpm=AC.KV*Math.max(st.volt,0)*st.thr*0.78;const rot=rpm/60;const edf=!!AC.edf;
  /* a prop is heard at blade-pass (2 blades); a 12-blade fan's blade-pass is far up, so the ear gets the shaft tone, the whine and the rush */
  const bp=Math.max(edf?rot:rot*AC.blades,30);
  audio.blade.frequency.setTargetAtTime(bp,now,0.04);audio.sub.frequency.setTargetAtTime(bp*0.5,now,0.04);audio.whine.frequency.setTargetAtTime(Math.max(edf?rot*AC.blades:rot*7,60),now,0.04);
  audio.bladeG.gain.setTargetAtTime(edf?0.12:0.55,now,0.1);audio.subG.gain.setTargetAtTime(edf?0.05:0.22,now,0.1);audio.whineG.gain.setTargetAtTime(edf?0.05:0.07,now,0.1);
  audio.jet.gain.setTargetAtTime(edf?0.9*st.thr:0,now,0.08);audio.jbp.frequency.setTargetAtTime(500+rot*3,now,0.08);
  const fp=panFor(st.pos);const far=G.cam==='pilot'?1/(1+fp.d/18):1;const lvl=(0.015+st.thr*0.09)*far;
  audio.motor.gain.setTargetAtTime(on?lvl:0,now,0.05);audio.air.frequency.setTargetAtTime(G.cam==='pilot'?clamp(9000/(1+fp.d/25),700,9000):6000,now,0.1);
  if(audio.pan.pan)audio.pan.pan.setTargetAtTime(G.cam==='pilot'?fp.pan:0,now,0.05);
  const w=clamp((st.V-6)/22,0,1);audio.wind.gain.setTargetAtTime(on?w*w*(G.cam==='fpv'?0.25:G.cam==='chase'?0.12:0.03):0,now,0.1);audio.windF.frequency.setTargetAtTime(300+st.V*40,now,0.1);
  // wardens: engine drone and, while a pursuit is hot, a two-tone siren
  let wl=0,ws=0,wp=0;if(typeof wardens!=='undefined'&&wardens.length&&pursuit.active){let best=1e9;wardens.forEach(W=>{const r=panFor(W.pos);if(r.d<best){best=r.d;wp=r.pan;}});wl=0.05/(1+best/30);ws=pursuit.heat>0?0.035/(1+best/40):0;}
  audio.warden.gain.setTargetAtTime(on?wl:0,now,0.1);audio.sirenG.gain.setTargetAtTime(on?ws:0,now,0.1);audio.siren.frequency.setValueAtTime(Math.floor(now*1.6)%2?960:720,now);if(audio.wPan.pan)audio.wPan.pan.setTargetAtTime(wp,now,0.05);
  audio.master.gain.setTargetAtTime(masterGain(),now,0.05);
  if(G.sound&&on&&st.volt<AC.cells*AC.alarmV&&st.amp>3){beepT+=dt;if(beepT>0.8){beepT=0;beep();}}}
