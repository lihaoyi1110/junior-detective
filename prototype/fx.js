/* ==========================================================
   答题反馈 · 轻音效与震动
   不依赖音频文件：用 WebAudio 现场合成两个短音。
   默认开启，可在「我的 → 声音与震动」里关掉。
   ========================================================== */
(function(){
  const KEY = 'detective_fx_v1';
  let ctx = null;

  function enabled(){
    try{
      const v = localStorage.getItem(KEY);
      return v == null ? true : v === '1';
    }catch(e){ return true; }
  }

  function set(on){
    try{ localStorage.setItem(KEY, on ? '1' : '0'); }catch(e){}
  }

  function audio(){
    if(!enabled()) return null;
    try{
      const C = window.AudioContext || window.webkitAudioContext;
      if(!C) return null;
      ctx = ctx || new C();
      if(ctx.state === 'suspended') ctx.resume();
      return ctx;
    }catch(e){ return null; }
  }

  /* 一个很短的包络音：手机上听感接近“纸页轻响” */
  function tone(freq, dur, type, gain){
    const c = audio();
    if(!c) return;
    try{
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      o.connect(g); g.connect(c.destination);
      const t = c.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.02);
    }catch(e){}
  }

  function buzz(pattern){
    if(!enabled()) return;
    try{ if(navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
  }

  function tap(){
    tone(520, 0.06, 'triangle', 0.03);
    buzz(8);
  }

  function ok(){
    tone(660, 0.12, 'sine', 0.045);
    setTimeout(()=>tone(884, 0.16, 'sine', 0.04), 105);
    buzz([16, 40, 16]);
  }

  function soft(){
    tone(320, 0.15, 'triangle', 0.032);
    buzz(12);
  }

  window.Fx = {enabled, set, tap, ok, soft};

  /* iOS 要求音频在用户手势里解锁：第一次点屏幕时把 AudioContext 打开 */
  document.addEventListener('pointerdown', function once(){
    audio();
    document.removeEventListener('pointerdown', once);
  }, {passive:true});
})();
