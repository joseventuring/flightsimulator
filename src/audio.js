/* ---------- sound ---------- */
/* buses (audio-design): master <- motor, wind, alerts. Slider squared before gain. */
let audio=null,beepT=0;
function masterGain(){const s=settings.vol/100;return s*s;}
function initAudio(){try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const master=ctx.createGain();master.gain.value=masterGain();master.connect(ctx.destination);
  const motor=ctx.createGain();motor.gain.value=0;motor.connect(master);const o1=ctx.createOscillator(),o2=ctx.createOscillator(),o3=ctx.createOscillator();o1.type='sawtooth';o2.type='square';o2.detune.value=7;o3.type='triangle';const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;o1.connect(f);o2.connect(f);o3.connect(f);f.connect(motor);o1.start();o2.start();o3.start();
  const windG=ctx.createGain();windG.gain.value=0;windG.connect(master);const nb=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const ns=ctx.createBufferSource();ns.buffer=nb;ns.loop=true;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=600;bp.Q.value=0.6;ns.connect(bp);bp.connect(windG);ns.start();
  const alerts=ctx.createGain();alerts.gain.value=0.9;alerts.connect(master);
  audio={ctx,master,motor,o1,o2,o3,wind:windG,windF:bp,alerts};}catch(e){audio=null;}}
function tone(freq,dur,type,vol,bus){if(!audio)return;const o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type=type||'square';o.frequency.value=freq*(1+(Math.random()-0.5)*0.06);g.gain.value=vol;g.gain.setTargetAtTime(0,audio.ctx.currentTime+dur*0.6,dur*0.2);o.connect(g);g.connect(bus||audio.alerts);o.start();o.stop(audio.ctx.currentTime+dur);}
function beep(){if(G.sound)tone(2200,0.12,'square',0.05);}
function chime(){if(G.sound){tone(880,0.18,'sine',0.06);setTimeout(()=>tone(1320,0.22,'sine',0.05),90);}}
function thud(k){if(G.sound)tone(70+40*k,0.25,'triangle',0.12*k);}
function updateAudio(dt){if(!audio)return;const on=G.sound&&!G.crashed&&!G.landed&&!G.paused;const rpm=st.thr*(st.volt/12.6)*2300*12.6/60;const f=40+rpm*0.09+st.V*1.5;const now=audio.ctx.currentTime;audio.o1.frequency.setTargetAtTime(f,now,0.05);audio.o2.frequency.setTargetAtTime(f*0.5,now,0.05);audio.o3.frequency.setTargetAtTime(f*2.01,now,0.05);audio.motor.gain.setTargetAtTime(on?0.02+st.thr*0.08:0,now,0.05);
  const w=clamp((st.V-6)/22,0,1);audio.wind.gain.setTargetAtTime(on?w*w*(G.cam==='fpv'?0.25:0.07):0,now,0.1);audio.windF.frequency.setTargetAtTime(300+st.V*40,now,0.1);
  audio.master.gain.setTargetAtTime(masterGain(),now,0.05);
  if(G.sound&&on&&st.volt<AC.cells*AC.alarmV&&st.amp>3){beepT+=dt;if(beepT>0.8){beepT=0;beep();}}}

