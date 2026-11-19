/* ==========================================================
   孩子端 · 答题（华生陪你一句一句往前推）
   有模型时走模型，没有模型时静默使用本地规则
   ========================================================== */
(function(){
  const PRAISE = ['对。','没错。','就是这样。','很好。'];
  const VLABEL = {
    ok:'理解正确', partial:'方向对了，再具体一点',
    confuse:'发现一个理解偏差', idk:'需要搭把手', off:'这次没有对上问题'
  };
  let V = null;
  let seq = 0;

  function dimName(k){ const d = DIMS.find(x=>x.key===k); return d?d.name:'综合'; }
  function current(){ return V.c.steps[V.i]; }
  function esc(s){
    return String(s||'').replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  }

  /* ---------- 未结案卷：本机保存进度，下次接着答 ---------- */
  function resumeKey(){
    try{ return Store.key + '_resume_' + Store.id(); }catch(e){ return 'detective_v3_resume_k0'; }
  }
  function readResume(){
    try{
      const o = JSON.parse(localStorage.getItem(resumeKey()) || 'null');
      return (o && typeof o === 'object') ? o : {};
    }catch(e){ return {}; }
  }
  function writeResume(all){
    try{ localStorage.setItem(resumeKey(), JSON.stringify(all)); }catch(e){}
  }
  function savedResume(id){
    const s = readResume()[id];
    if(!s || !Array.isArray(s.msgs) || s.msgs.length <= 2 || !Array.isArray(s.log)) return null;
    const c = CASES.find(x=>x.id===id);
    if(!c || !(s.i >= 0) || s.i >= c.steps.length) return null;
    return s;
  }
  function dropResume(id){
    try{ const all = readResume(); delete all[id]; writeResume(all); }catch(e){}
  }
  function saveResume(){
    if(!V || V.done || V.review) return;
    V.spent = (V.spent || 0) + Math.max(0, (Date.now() - V.t0) / 1000);
    V.t0 = Date.now();
    try{
      const all = readResume();
      all[V.c.id] = {
        caseId: V.c.id, i: V.i, fails: V.fails, mis: V.mis, hints: V.hints,
        partials: V.partials, stepWrong: V.stepWrong, log: V.log,
        voice: V.voice||0, pad: !!V.pad,
        msgs: V.msgs.filter(m=>!m.typing), spent: V.spent, ts: Date.now()
      };
      /* 只留最近 8 份，避免本机存储无限增长 */
      Object.keys(all)
        .sort((a,b)=>((all[b] && all[b].ts) || 0) - ((all[a] && all[a].ts) || 0))
        .slice(8)
        .forEach(k=>{ delete all[k]; });
      writeResume(all);
    }catch(e){}
  }

  /* 错题本要保存“当时那句话”，落库前先去掉标签，避免把样式带进档案 */
  function plain(s){
    return String(s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
  }
  /* 判定为 ok 时，模型有时会自己编一个下一步的问题；
     这里把它末尾的问句去掉，交给系统统一追加这一步之后的问题，避免重复提问 */
  function dropAsk(s){
    return String(s||'').replace(/[^。！？!?]*[？?]\s*$/,'').trim();
  }
  /* 下一步的问题原文有时自带“对，是……”这类承接语；
     前面已经肯定过一句时就去掉，避免连着说两个“对” */
  function stripAck(s){
    return String(s||'').replace(/^(对|没错|很准|是的|很好|就是这样)[^。！？]{0,10}[。，,]\s*/, '');
  }

  /* ---------- 语音作答：说得出，就不必先学会打字 ---------- */
  const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="9" y="3.2" width="6" height="11" rx="3"/>'
    + '<path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>';
  let rec = null, recTimer = null, netFails = 0;
  let recorder = null, recStream = null, recChunks = [], recTimer2 = null;
  let sttState = null, recDiscard = false, sending = false, srFallback = false;

  function canListen(){
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  function canRecord(){
    return !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
  /* 服务端识别是主路径：先问一次后端有没有配置 STT_API_KEY */
  async function hasServerStt(){
    if(sttState !== null) return sttState;
    try{
      const ctrl = new AbortController();
      const t = setTimeout(()=>ctrl.abort(), 1600);
      const r = await fetch('/api/stt', {cache:'no-store', signal:ctrl.signal});
      clearTimeout(t);
      if(!r.ok){ sttState = false; return false; }
      const d = await r.json();
      sttState = !!(d && d.ok);
    }catch(e){ sttState = false; }
    return sttState;
  }
  /* 浏览器只在安全上下文里放行麦克风：局域网 http 上点了会静默失败，必须提前说清 */
  function secureOk(){
    return window.isSecureContext === true
      || location.protocol === 'https:'
      || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }
  function placeholder(input, text){
    if(input) input.setAttribute('placeholder', text);
  }
  function stopListen(){
    if(recTimer){ clearTimeout(recTimer); recTimer = null; }
    if(!rec) return;
    const r = rec;
    rec = null;
    try{ r.stop(); }catch(e){}
  }
  function stopRecord(discard){
    if(discard) recDiscard = true;
    if(recTimer2){ clearTimeout(recTimer2); recTimer2 = null; }
    if(recorder){ try{ recorder.stop(); }catch(e){} }
  }
  function stopVoice(discard){ stopListen(); stopRecord(discard); }
  function say(msg){ if(window.UI) UI.toast(msg); }
  function voiceTip(){
    try{
      if(!localStorage.getItem('detective_voice_tip_v1')){
        localStorage.setItem('detective_voice_tip_v1','1');
        say('说完可以改字，确认没问题再点发送');
      }
    }catch(e){}
  }
  function fillVoice(input, text){
    const t = String(text||'').replace(/\s+/g,'').trim();
    if(!t) return false;
    input.value = (input.value + t).slice(0,240);
    if(V) V.voiceDraft = true;
    voiceTip();
    return true;
  }

  /* 录音 → 上传 /api/stt：不依赖 Google 的在线识别，国内网络也能用 */
  async function recordAndSend(input, btn){
    if(!canRecord()){ say('这台设备不能录音，先用键盘写吧'); return; }
    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
    catch(err){
      const n = (err && err.name) || '';
      say(n==='NotAllowedError' ? '需要允许麦克风才能语音作答'
        : (n==='NotFoundError' ? '这台设备没有可用的麦克风' : '麦克风打不开，先用键盘写一句'));
      return;
    }

    const mime = (()=>{
      const list = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
      try{ return list.find(m=>window.MediaRecorder.isTypeSupported(m)) || ''; }catch(e){ return ''; }
    })();
    let mr;
    try{ mr = mime ? new MediaRecorder(stream, {mimeType:mime}) : new MediaRecorder(stream); }
    catch(e){
      try{ stream.getTracks().forEach(t=>t.stop()); }catch(x){}
      say('录音没有启动，可以再用键盘');
      return;
    }

    recStream = stream;
    recChunks = [];
    recorder = mr;
    btn.classList.add('on');
    placeholder(input,'正在录音…说完再点一次麦克风');

    mr.ondataavailable = e=>{ if(e.data && e.data.size) recChunks.push(e.data); };
    mr.onstop = async ()=>{
      if(recTimer2){ clearTimeout(recTimer2); recTimer2 = null; }
      btn.classList.remove('on');
      try{ if(recStream) recStream.getTracks().forEach(t=>t.stop()); }catch(e){}
      const discard = recDiscard;
      recDiscard = false;
      const blob = new Blob(recChunks, {type: mr.mimeType || mime || 'audio/webm'});
      recorder = null; recStream = null; recChunks = [];
      if(discard){ placeholder(input,'用你自己的话说…'); return; }
      if(blob.size < 1500){
        placeholder(input,'用你自己的话说…');
        say('这次没录到声音，靠近一点再试');
        return;
      }
      placeholder(input,'正在识别…');
      sending = true;
      try{
        const fd = new FormData();
        const ext = /mp4|aac/.test(blob.type) ? 'mp4' : (/ogg/.test(blob.type) ? 'ogg' : 'webm');
        fd.append('audio', blob, 'speech.'+ext);
        const r = await fetch('/api/stt', {method:'POST', body:fd});
        const d = await r.json().catch(()=>({}));
        if(!r.ok || !d.text) throw new Error(d.error || ('HTTP '+r.status));
        fillVoice(input, d.text);
      }catch(e){
        sttState = false;
        if(canListen()){
          say('在线识别没接通，改用本机识别');
          listen(input, btn, {browser:true});
        }else{
          say('语音识别暂时不通：可以先用键盘，或让家长配置 STT_API_KEY');
        }
      }finally{
        sending = false;
        placeholder(input,'用你自己的话说…');
      }
    };
    mr.start();
    /* 孩子可能一直不说话：12 秒自动收尾，把已经录到的内容送出去 */
    recTimer2 = setTimeout(()=>{ if(recorder){ try{ recorder.stop(); }catch(e){} } }, 12000);
  }

  async function listen(input, btn, opt){
    if(!V || V.done || V.busy) return;
    if(sending) return;
    if(rec || recorder){
      const wasRec = !!recorder;
      if(rec) stopListen();
      if(recorder) stopRecord(false);
      btn.classList.remove('on');
      if(!wasRec) placeholder(input,'用你自己的话说…');
      return;
    }
    if(!secureOk()){ say('手机的语音输入需要 https 地址；换成 https 打开本页就能用'); return; }
    srFallback = false;

    /* 手机上本机识别通常更快，也不经过网络：能用就先用它；不支持的浏览器再走服务端录音 */
    if(!(opt && opt.browser) && !canListen() && canRecord()){
      /* 探测后端需要一点时间，先给一句反馈，避免看起来像“点了没反应” */
      placeholder(input,'正在准备麦克风…');
      const srv = await hasServerStt();
      if(srv) return recordAndSend(input, btn);
      placeholder(input,'用你自己的话说…');
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ say('这台浏览器不支持语音输入，先用键盘写吧'); return; }

    const start = ()=>{
      let r = null;
      try{ r = new SR(); }catch(e){ say('这台浏览器的语音输入不可用'); return; }
      r.lang = 'zh-CN';
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      const base = input.value;

      r.onstart = ()=>placeholder(input,'正在听…说完会自动写进框里');
      r.onresult = e=>{
        let t = '';
        for(let i=0;i<e.results.length;i++) t += e.results[i][0].transcript;
        if(!t) return;
        input.value = (base + t).replace(/\s+/g,'').slice(0,240);
        if(V) V.voiceDraft = true;
        voiceTip();
      };
      r.onerror = e=>{
        const err = (e && e.error) || 'unknown';
        if(err==='aborted') return;
        if(err==='network'){
          /* 本机识别连不上时，自动改走服务端录音，不让这一句白说 */
          if(canRecord() && !srFallback){
            srFallback = true;
            say('本机识别没接通，改用服务端识别');
            setTimeout(()=>recordAndSend(input, btn), 250);
            return;
          }
          netFails++;
          say('这台浏览器连不上语音服务；可以换一个浏览器试试，或让家长配置 STT_API_KEY');
          /* 连续失败就不再让孩子反复点，按钮置灰并留一句说明 */
          if(netFails>=2){
            if(V) V.micDead = true;
            btn.disabled = true;
            btn.classList.add('dead');
            btn.setAttribute('title','本机语音识别服务不可用，请用键盘');
          }
        }else if(err==='not-allowed' || err==='service-not-allowed'){
          say('没有麦克风权限：请在浏览器设置里允许麦克风后再试');
        }else if(err==='no-speech'){
          say('没听到声音，靠近一点再说一次');
        }else if(err==='audio-capture'){
          say('没有找到可用的麦克风');
        }else if(err==='language-not-supported'){
          say('这台设备不支持中文识别');
        }else{
          say('这次没识别成功，可以再用键盘补一句');
        }
      };
      r.onend = ()=>{
        if(recTimer){ clearTimeout(recTimer); recTimer = null; }
        rec = null;
        btn.classList.remove('on');
        placeholder(input,'用你自己的话说…');
      };

      rec = r;
      btn.classList.add('on');
      try{ r.start(); }catch(e){
        rec = null;
        btn.classList.remove('on');
        say('语音识别没有启动，可以再用键盘');
        return;
      }
      /* 孩子可能一直不说话：12 秒自动收尾，留着已经识别出的字 */
      recTimer = setTimeout(()=>{ if(rec){ try{ rec.stop(); }catch(e){} } }, 12000);
    };

    /* 先要一次麦克风权限：被拒时立刻说明原因，不让按钮点了没反应 */
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia({audio:true})
        .then(s=>{
          try{ s.getTracks().forEach(t=>t.stop()); }catch(e){}
          start();
        })
        .catch(err=>{
          const n = (err && err.name) || '';
          say(n==='NotAllowedError' ? '需要允许麦克风才能语音作答'
            : (n==='NotFoundError' ? '这台设备没有可用的麦克风' : '麦克风打不开，先用键盘写一句'));
        });
    }else{
      start();
    }
  }

  /* ---------- 草稿纸：在手机上也能画线段、列竖式 ---------- */
  function closePad(){
    const el = document.querySelector('.pad-mask');
    if(el) el.remove();
  }
  function padGrid(ctx, w, h){
    ctx.save();
    ctx.strokeStyle = 'rgba(32,32,27,.09)';
    ctx.lineWidth = 1;
    for(let x=20;x<w;x+=20){ ctx.beginPath(); ctx.moveTo(x+.5,0); ctx.lineTo(x+.5,h); ctx.stroke(); }
    for(let y=20;y<h;y+=20){ ctx.beginPath(); ctx.moveTo(0,y+.5); ctx.lineTo(w,y+.5); ctx.stroke(); }
    ctx.restore();
  }
  function openPad(){
    if(!V || V.done) return;
    closePad();
    const mask = document.createElement('div');
    mask.className = 'pad-mask';
    mask.innerHTML = '<div class="pad"><div class="pad-h">'
      + '<b>草稿纸</b><span class="mono">第 '+(V.i+1)+' 步 · 随手画</span>'
      + '<button class="linkbtn" data-pad-clear>清空</button>'
      + '<button class="linkbtn" data-pad-close>收起</button></div>'
      + '<canvas class="pad-canvas"></canvas>'
      + '<p class="pad-note">用手指直接画；画歪了不用擦，点「清空」重来。'
      + '草稿只跟着这一步，退出案卷就清空；不进档案，也不会发给判分模型。</p></div>';
    document.body.appendChild(mask);

    const cv = mask.querySelector('.pad-canvas');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.min(340, window.innerWidth - 56);
    const h = Math.max(240, Math.min(400, window.innerHeight * 0.44));
    cv.style.width = w+'px'; cv.style.height = h+'px';
    cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    padGrid(ctx, w, h);

    const saved = V.sketches && V.sketches[V.i];
    if(saved){
      const img = new Image();
      img.onload = ()=>ctx.drawImage(img, 0, 0, w, h);
      img.src = saved;
    }

    let drawing = false, last = null;
    const pos = e=>{
      const r = cv.getBoundingClientRect();
      return {x: e.clientX-r.left, y: e.clientY-r.top};
    };
    cv.addEventListener('pointerdown', e=>{
      drawing = true; last = pos(e);
      try{ cv.setPointerCapture(e.pointerId); }catch(err){}
    });
    cv.addEventListener('pointermove', e=>{
      if(!drawing) return;
      const p = pos(e);
      ctx.strokeStyle = '#24352D';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
    });
    const end = ()=>{
      if(!drawing) return;
      drawing = false;
      if(V) V.pad = true;
      try{ V.sketches[V.i] = cv.toDataURL('image/png'); }catch(e){}
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);

    mask.querySelector('[data-pad-clear]').onclick = ()=>{
      ctx.clearRect(0, 0, w, h);
      padGrid(ctx, w, h);
      if(V && V.sketches) delete V.sketches[V.i];
    };
    mask.querySelector('[data-pad-close]').onclick = ()=>{
      try{ V.sketches[V.i] = cv.toDataURL('image/png'); }catch(e){}
      closePad();
    };
    mask.addEventListener('click', e=>{ if(e.target === mask) closePad(); });
  }

  /* 侦探助手 · 华生的开场白：第一次把规则讲全，之后只留一句提醒 */
  function opening(c){
    const seen = (()=>{ try{ return Store.all().length > 0; }catch(e){ return false; } })();
    if(seen){
      return '我是华生。这桩案子的关键线索是「'+c.tags[0]+'」——先说你看到的，卡住了就点「给我一条线索」。';
    }
    return '我是华生，你的侦探助手。这桩案子的关键线索是「'+c.tags[0]+'」。'
      + '我不替你算，只在你卡住的时候提醒你看哪儿——先说你看到的，再说你算到的。'
      + '<span class="rule">随时可以点「给我一条线索」，我会退半步把台阶铺好。</span>';
  }

  /* 第一次进案卷：把这一版新增的三个入口一起讲清楚，只出现一次 */
  function coach(){
    try{ if(localStorage.getItem('detective_coach_v2')) return; }catch(e){}
    const items = ['<li><b>直接说</b> · 把想法写进下面的框，发出去就好</li>'];
    items.push('<li><b>麦克风</b> · '+(secureOk()
      ? '点一下开始说，说完再点一下，识别出来的字还能改'
      : '手机语音需要 https 地址；现在是 http，可先用键盘或草稿纸')+'</li>');
    items.push('<li><b>草稿纸</b> · 要画线段、列竖式，点快捷行里的「草稿纸」</li>');
    items.push('<li><b>给我一条线索</b> · 卡住时点，我只退半步，不给答案</li>');

    const el = document.createElement('div');
    el.className = 'coach';
    el.innerHTML = '<div class="coach-card">'
      + '<div class="coach-k">第一次探案 · 先认认这几处</div>'
      + '<p>不用先学会打字，也不用一次说对。想不起来的时候，我能再讲一遍。</p>'
      + '<ul>'+items.join('')+'</ul>'
      + '<p class="coach-foot">草稿和语音只用来帮你想，不会写进给家长的报告。</p>'
      + '<button class="btn sm" data-coach-ok>知道了，开始</button>'
      + '</div>';
    document.body.appendChild(el);
    el.querySelector('[data-coach-ok]').onclick = ()=>{
      try{ localStorage.setItem('detective_coach_v2', '1'); }catch(e){}
      el.remove();
    };
  }

  /* 从案卷大厅进入答题、或接着上次答，都做一次品牌过渡 */
  function enterAnim(){
    if(window.PageVeil){ window.PageVeil(300); return; }
    const el = document.getElementById('app');
    if(!el) return;
    el.classList.remove('screen-in');
    void el.offsetWidth;
    el.classList.add('screen-in');
  }

  function start(c){
    V = { c, i:0, fails:0, mis:'', hints:0, partials:0, log:[], done:false,
          stepWrong:null, busy:false, t0:Date.now(), spent:0, token:++seq, sketches:{},
          voice:0, pad:false, stemOpen:false,
          msgs:[{who:'ai', intro:true, text:opening(c)}, {who:'ai', text:c.steps[0].q}] };
    paint();
    coach();
    enterAnim();
  }

  function open(id){
    const c = CASES.find(x=>x.id===id);
    if(!c) return;
    stopVoice(true); closePad();
    const saved = savedResume(id);
    if(!saved){ start(c); return; }
    /* 有存档就直接接着答，顶上留一个「重来」；重来才会丢掉这半卷的进度 */
    V = { c, i:saved.i, fails:saved.fails||0, mis:saved.mis||'',
          hints:saved.hints||0, partials:saved.partials||0,
          log:saved.log||[], done:false, stepWrong:saved.stepWrong||null,
          busy:false, t0:Date.now(), spent:saved.spent||0, token:++seq, sketches:{},
          voice:saved.voice||0, pad:!!saved.pad, stemOpen:false,
          resumed:true, msgs:saved.msgs.filter(m=>!m.typing) };
    paint();
    enterAnim();
    coach();
    if(window.UI) UI.toast('已接着上次，停在第 '+(V.i+1)+' 问');
  }

  function msg(m){
    if(m.typing){
      return '<div class="msg ai typing"><div class="who">华生</div>'
        + '<div class="dots3"><i></i><i></i><i></i></div>'
        + (m.slow ? '<div class="waitnote">还在想，网络有点慢…</div>' : '')
        + '</div>';
    }
    if(m.who==='ai'){
      return '<div class="msg ai'+(m.intro?' intro':'')+'"><div class="who">华生'
        + (m.intro?'<span class="role">侦探助手</span>':'')+'</div>'
        + '<div class="body">'+m.text+'</div></div>';
    }
    /* 判定放在气泡外，做成一句小注脚：不打断阅读，也不像贴在答案上的标签 */
    return '<div class="msg kid"><div class="who">你</div>'
      + '<div class="body">'+esc(m.text)+'</div>'
      + (m.verdict ? '<div class="vnote'+(m.warn?' warn':'')+'">'+m.verdict+'</div>' : '')
      + '</div>';
  }

  function dotsInner(){
    const n = V.c.steps.length;
    let s = '';
    for(let k=0;k<n;k++){
      s += '<i class="'+(k<V.i?'done':(k===V.i?'now':''))+'"></i>';
      if(k<n-1) s += '<b></b>';
    }
    return s;
  }
  function dots(){
    return '<div class="dots" id="dots">'+dotsInner()+'</div>';
  }

  function view(){
    const c = V.c;
    const bar = V.review
      ? '<div class="casebar">'
        + '<button class="linkbtn" data-back>← 案卷</button>'
        + '<span class="mono dim case-meta">卡点重审</span>'
        + '<span class="mono" id="stepno">重审 '+(V.review.pos+1)+'/'+V.review.total+'</span></div>'
      : '<div class="casebar">'
        + '<button class="linkbtn" data-back>← 案卷</button>'
        + '<span class="mono dim case-meta">'+c.no+' · '+c.type+' · L'+c.level+'</span>'
        + (V.resumed ? '<button class="linkbtn" data-restart>重来</button>' : '')
        + '<span class="mono" id="stepno">'+(V.i+1)+'/'+c.steps.length+'</span></div>';
    return bar
      + (V.review ? '' : dots())
      + '<div class="stem-box'+(V.stemOpen?'':' clamp')+'">'
      + '<span class="mono">案卷原文 · '+c.grade+'</span>'
      + '<div class="stem-text">'+c.stem+'</div>'
      + '<button class="stem-more" data-stem-toggle>'+(V.stemOpen?'收起原文 ↑':'展开全文 ↓')+'</button>'
      + '</div>'
      + '<div class="chat" id="chat">'+V.msgs.map(msg).join('')+'</div>'
      + '<div class="composer">'
      + '<div class="sugg"><button class="primary" data-help>给我一条线索</button>'
      + '<button data-say="不知道">我卡住了</button>'
      + '<button data-sketch>草稿纸</button>'
      + '<button data-reread>重读案卷</button></div>'
      + '<div class="inputrow"><input id="ans" maxlength="240" placeholder="用你自己的话说…" autocomplete="off">'
      + (!V.micDead ? '<button class="mic" data-mic aria-label="语音输入">'
          + '<span class="mic-ico">'+ICON_MIC+'</span><span class="mic-txt">语音</span></button>' : '')
      + '<button class="send" data-send'+(V.busy?' disabled':'')+'>发送</button></div>'
      + '</div>';
  }

  /* 键盘弹出时输入条被抬高了 --kb，滚动要把它补上，最后一条回复才不会被压住 */
  function scrollBottom(){
    const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0;
    window.scrollTo(0, document.body.scrollHeight + kb);
  }

  /* 答题过程中只重绘对话区：输入框不重建，手机键盘和已输入的文字都保得住 */
  function paint(){
    const app = document.getElementById('app');
    const chat = app.querySelector('#chat');
    if(chat && V && !V.done){
      chat.innerHTML = V.msgs.map(msg).join('');
      const d = app.querySelector('#dots');
      if(d) d.innerHTML = dotsInner();
      const no = app.querySelector('#stepno');
      if(no) no.textContent = V.review
        ? '重审 '+(V.review.pos+1)+'/'+V.review.total
        : (V.i+1)+'/'+V.c.steps.length;
      const send = app.querySelector('[data-send]');
      if(send) send.disabled = !!V.busy;
      scrollBottom();
      return;
    }
    if(V.done && V.anim){
      app.className = '';
      app.innerHTML = closingAnim();
      bind();
      window.scrollTo(0, 0);
      return;
    }
    app.className = '';
    app.innerHTML = V.done ? (V.reviewDone ? closingReview() : closing()) : view();
    bind();
    if(V.done) window.scrollTo(0, 0);
    else scrollBottom();
  }

  /* 结案单独一屏：印章落下、案卷归档，动画结束才把成绩交出来 */
  function closingAnim(){
    return '<div class="closing-anim" data-skip-closing>'
      + '<div class="ca-seal"><span>结</span><span>案</span></div>'
      + '<div class="ca-line"></div>'
      + '<p class="mono dim">正在把这一卷收进档案 …</p>'
      + '<p class="ca-skip">轻点屏幕可跳过</p>'
      + '</div>';
  }

  function closing(){
    const c = V.c, n = c.steps.length;
    /* 口径与家长报告的“无提示完成率”一致：既没答错，也没点过线索 */
    const helped = l => (l.fails||0) > 0 || (l.hint||0) > 0;
    const indep = V.log.filter(l=>!helped(l)).length;
    const min = Math.max(1, Math.round((V.dur||0)/60));
    const failed = V.log.map((l,i)=>({l, st:c.steps[i]})).filter(x=>helped(x.l));

    const card = failed.length
      ? failed.map(x=>'<div class="advice"><b>'+dimName(x.st.dim)+' · '+x.st.tag+'</b>'
          + '<p>'+x.st.say[0]+' '+x.st.say[1]+'</p></div>').join('')
      : '<div class="advice"><b>没有明显卡点</b><p>'+c.independentSay[0]+' '+c.independentSay[1]+'</p></div>';

    const tags = Array.from(new Set(failed.map(x=>x.st.tag))).map(t=>'<span class="mini">'+t+'</span>').join('');

    return '<div class="closed">'
      + '<div class="stamp"><span>结案</span><span>CLOSED</span></div>'
      + '<div class="eyebrow" style="justify-content:center">'+c.no+' · '+c.type+'</div>'
      + '<h1 class="title">'+c.title+'</h1>'
      + '<p class="lead">'+(failed.length ? '有几处我搭了把手；每一步的答案，仍是你自己写下的。' : '全程自己推完，这个案子是你破的。')+'</p>'
      + '<div class="medal-row">'
      + '<div class="medal"><b>'+n+'</b><span>提问</span></div>'
      + '<div class="medal"><b>'+indep+'/'+n+'</b><span>独立完成</span></div>'
      + '<div class="medal"><b>'+min+'′</b><span>用时</span></div></div>'
      + '<div class="card" style="text-align:left"><div class="card-h"><h3>搭档批注</h3><span class="hint">给家长看</span></div>'+card
      + '<p class="pnote">这些批注按这一步的作答与提示情况整理，是观察线索，不是对孩子的定论。</p></div>'
      + '<div class="card" style="text-align:left"><div class="card-h"><h3>这道题留下的线索</h3><span class="hint">下一步练什么</span></div>'
      + '<div class="chips-row">'+(tags||'<span class="mini on">全程独立</span>')+'</div>'
      + '<p class="pnote">'+c.independentSay[1]+'</p></div>'
      + (failed.length ? '<button class="btn brass" data-review>只重答卡住的 '+failed.length+' 步</button>'
          + '<p class="reviewnote">只重走这几处，确认是不是真的弄懂了。不影响上面的分数，重审结果会单独记一条。</p>' : '')
      + '<button class="btn" data-back>再挑一个案子</button>'
      + '<button class="btn ghost" data-parent>把报告给家长看</button>'
      + '</div>';
  }

  /* ---------- 卡点重审：只把搭过手的那几步再走一遍，不写档案 ---------- */
  function review(queue){
    if(!V || !V.done || V.reviewDone || !queue || !queue.length) return;
    stopVoice(true); closePad();
    const c = V.c;
    V.review = { queue:queue.slice(), pos:0, ok:0, total:queue.length, t0:Date.now() };
    V.reviewDone = false;
    V.done = false;
    V.i = queue[0];
    V.fails = 0; V.mis = ''; V.hints = 0; V.partials = 0; V.stepWrong = null; V.busy = false;
    V.sketches = {}; V.voice = 0; V.pad = false; V.stemOpen = false;
    V.msgs = [
      {who:'ai', text:'刚才这一卷里有 '+queue.length+' 处我搭了把手。这次只走这几处，我不提醒，你自己来。'},
      {who:'ai', text:stripAck(c.steps[queue[0]].q)}
    ];
    paint();
  }

  function reviewFinish(){
    if(!V || !V.review) return;
    stopVoice(true); closePad();
    V.review.dur = (Date.now() - V.review.t0) / 1000;
    V.reviewDone = true;
    V.done = true;
    /* 重审不改原判定，只在同一份练习上附一条“后来重走过”的记录，家长端可见 */
    try{
      const a = Store.all();
      const idx = a.findIndex(s=>s.caseId===V.c.id);
      if(idx > -1){
        a[idx].review = { total:V.review.total, ok:V.review.ok, ts:Date.now() };
        Store.save(a);
      }
    }catch(e){}
    paint();
  }

  function closingReview(){
    const r = V.review, c = V.c;
    const min = Math.max(1, Math.round((r.dur||0)/60));
    const all = r.ok >= r.total;
    return '<div class="closed">'
      + '<div class="stamp"><span>复审</span><span>REVIEW</span></div>'
      + '<div class="eyebrow" style="justify-content:center">'+c.no+' · 卡点重审</div>'
      + '<h1 class="title">'+c.title+'</h1>'
      + '<p class="lead">'+(all
          ? '刚才卡住的 '+r.total+' 处，这次都是你自己走完的。'
          : '刚才卡住的 '+r.total+' 处，这次你重新走通了 '+r.ok+' 处。剩下的那个卡点，下次可以再来看一眼。')+'</p>'
      + '<div class="medal-row">'
      + '<div class="medal"><b>'+r.total+'</b><span>重审步骤</span></div>'
      + '<div class="medal"><b>'+r.ok+'/'+r.total+'</b><span>这次走通</span></div>'
      + '<div class="medal"><b>'+min+'′</b><span>用时</span></div></div>'
      + '<div class="card" style="text-align:left"><div class="card-h"><h3>关于这次重审</h3><span class="hint">不改变原分数</span></div>'
      + '<p class="pnote">重审只用来确认卡点是不是真的弄懂了。原来这一卷的判定与分数不变，'
      + '这次结果会作为一条单独记录，附在家长端的练习记录里。</p></div>'
      + '<button class="btn" data-closing>回到结案页</button>'
      + '<button class="btn ghost" data-back>再挑一个案子</button>'
      + '</div>';
  }

  function payload(text){
    const step = current(), nx = V.c.steps[V.i+1];
    return {
      case:{title:V.c.title, stem:V.c.stem, type:V.c.type, level:V.c.level, grade:V.c.grade},
      step:{q:step.q, probe:step.probe, expect:step.expect.label,
            keys:(step.expect.keys||[]).slice(0,10),
            index:V.i+1, total:V.c.steps.length,
            confuse:(step.confuse||[]).map(r=>r.label), tag:step.tag},
      next: nx ? nx.q : '',
      /* 最后一条是孩子刚说的这句，单独放在 answer 里，避免重复出现 */
      history: V.msgs.filter(m=>!m.typing).slice(-7,-1).map(m=>({who:m.who, text:String(m.text||'').replace(/<[^>]+>/g,'')})),
      answer: text
    };
  }

  function localResult(text){
    const step = current();
    const a = Engine.analyze(text, step);
    return {
      kind: a.kind,
      reply: a.kind==='ok' ? '' : Engine.buildReply(a, step, text),
      mis: a.kind==='confuse' ? a.rule.label : '',
      label: a.label || ''
    };
  }

  async function answer(text, via){
    if(!V || V.done || V.busy) return;
    text = String(text||'').trim();
    if(!text) return;

    const step = current();
    if(via==='voice') V.voice = (V.voice||0) + 1;
    V.voiceDraft = false;
    V.msgs.push({who:'kid', text, via});
    const kid = V.msgs[V.msgs.length-1];

    /* 本地先判：判对就立即通过，不必等模型。
       只要本地判成“还没说对”，且孩子说了半句以上的话，就请模型判断他到底卡在哪。 */
    const local = localResult(text);
    let r = null;
    const ask = Engine.normalize(text);
    const escalate = local.kind!=='ok' && ask.length>=4;
    if(window.Model && Model.enabled() && escalate){
      V.busy = true;
      V.msgs.push({who:'ai', typing:true});
      paint();
      const token = V.token;
      /* 等模型超过 4 秒就在三个点下面加一句，别让孩子以为卡死了 */
      const slow = setTimeout(()=>{
        if(!V || V.token !== token) return;
        const t = V.msgs.filter(m=>m.typing)[0];
        if(t && !t.slow){ t.slow = true; paint(); }
      }, 4000);
      r = await Model.judge(payload(text));
      clearTimeout(slow);
      if(!V || V.token !== token) return;
      V.msgs = V.msgs.filter(m=>!m.typing);
      V.busy = false;
    }
    const timedOut = !!(r && r.error === 'timeout');
    if(!r || !r.verdict){
      r = {verdict:local.kind, reply:local.reply, misconception:local.mis, label:local.label, local:true};
    }
    if(timedOut && window.UI) UI.toast('网络有点慢，这句先按本机规则判断');
    const remote = !r.local;
    const replyOf = s => remote ? esc(s) : s;

    const kind = r.verdict;
    kid.verdict = VLABEL[kind] || VLABEL.off;
    kid.warn = (kind!=='ok' && kind!=='partial');

    if(window.Fx){
      if(kind==='ok') Fx.ok();
      else if(kind==='partial') Fx.tap();
      else Fx.soft();
    }

    if(kind==='ok'){
      /* 重审模式：答对就跳到队列里的下一个卡点，不写档案 */
      if(V.review){
        V.review.ok++;
        V.review.pos++;
        if(V.review.pos >= V.review.queue.length){ reviewFinish(); return; }
        V.i = V.review.queue[V.review.pos];
        V.fails = 0; V.mis = ''; V.hints = 0; V.partials = 0; V.stepWrong = null;
        const praiseR = PRAISE[V.review.pos % PRAISE.length];
        V.msgs.push({who:'ai', text:praiseR + ' 接着这一处：' + stripAck(current().q)});
        paint();
        return;
      }
      V.log.push({fails:V.fails, hint:V.hints, said:text, ok:true, mis:V.mis,
        firstWrong:V.stepWrong, via:via||''});
      if(V.i >= V.c.steps.length-1){ finish(); return; }
      const praise = PRAISE[V.i % PRAISE.length];
      V.i++; V.fails = 0; V.mis = ''; V.hints = 0; V.partials = 0; V.stepWrong = null;
      const nx = current().q;
      let said = (r.reply && r.reply.trim()) ? replyOf(r.reply) : praise;
      if(remote){
        const kept = dropAsk(r.reply);
        said = kept ? esc(kept) : praise;
      }
      const ask = stripAck(nx);
      V.msgs.push({who:'ai', text: said + (said.indexOf(ask)>=0 ? '' : ' ' + ask)});
    }else if(kind==='partial'){
      V.partials++;
      const said = (r.reply && r.reply.trim())
        ? replyOf(r.reply)
        : '你抓到的是“'+(r.label||'这个方向')+'”，方向没跑偏。我还想听更具体的一句：'+step.q;
      V.msgs.push({who:'ai', text:said});
    }else{
      V.fails++;
      if(kind==='confuse') V.mis = r.misconception || r.mis || '理解偏差';
      let reply = (r.reply && r.reply.trim()) ? replyOf(r.reply) : '没关系，我们退回到这一步：'+step.q;
      /* 错题本只留这一步的第一次卡壳：孩子当时怎么答、华生当时怎么回 */
      if(!V.stepWrong) V.stepWrong = {said:text, reply:plain(reply), kind};
      if(V.fails>=2 && step.hint && String(reply).indexOf(step.hint)<0)
        reply += '<div class="hintline">提示：'+step.hint+'</div>';
      V.msgs.push({who:'ai', text:reply});
    }
    saveResume();
    paint();
  }

  function hint(){
    if(!V || V.done || V.busy) return;
    const step = current();
    const ladder = [
      '我递来一张便笺：'+step.hint,
      '再退半步——'+step.l4,
      '我直接把这一步的结论写给你：'+step.expect.label+'。'
    ];
    const t = ladder[Math.min(V.hints, 2)];
    if(V.hints < 3) V.hints++;
    if(window.Fx) Fx.tap();
    V.msgs.push({who:'ai', text:t});
    saveResume();
    paint();
  }

  function reread(){
    if(!V || V.done || V.busy) return;
    V.msgs.push({who:'ai', text:'我们再把案卷读一遍。'+current().idk});
    saveResume();
    paint();
  }

  function finish(){
    const c = V.c;
    stopVoice(true); closePad();
    V.done = true;
    V.dur = (V.spent || 0) + (Date.now()-V.t0)/1000;
    dropResume(c.id);
    const indep = V.log.filter(l=>l.fails===0 && !(l.hint||0)).length;
    Store.add({
      caseId:c.id, ts:Date.now(), duration:Math.round(V.dur),
      rounds: V.log.length + V.log.reduce((s,l)=>s+(l.fails||0),0),
      independent:indep, total:c.steps.length, log:V.log,
      voice: V.voice||0, pad: V.pad?1:0
    });
    /* 先放结案动画，动画结束后再显示完整结果 */
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    V.anim = true;
    paint();
    V.animTimer = setTimeout(()=>{
      if(!V || !V.anim) return;
      V.anim = false;
      paint();
    }, reduced ? 500 : 1900);
  }

  function bind(){
    const app = document.getElementById('app');
    const skipAnim = app.querySelector('[data-skip-closing]');
    if(skipAnim) skipAnim.onclick = ()=>{
      if(!V || !V.anim) return;
      clearTimeout(V.animTimer);
      V.anim = false;
      paint();
    };
    app.querySelectorAll('[data-back]').forEach(b=>b.onclick = ()=>{
      const leave = ()=>{
        stopVoice(true); closePad();
        /* 只存真的答过东西的进度，刚打开就退出不留空壳；重审不写续答 */
        if(V && !V.done && !V.review && V.msgs.length > 2) saveResume();
        V = null;
        window.App.render();
      };
      /* 结案页或还没开口：直接离开；答到一半先问一句，进度会留在本机 */
      const started = V && !V.done && !V.review && (V.log.length > 0 || V.msgs.length > 2);
      if(!started){ leave(); return; }
      UI.confirm({kicker:'离开案卷', title:'先离开一会？',
        body:'进度已经存下，下次打开这张案卷可以接着答。', okText:'离开'})
        .then(ok=>{ if(ok) leave(); });
    });

    const restart = app.querySelector('[data-restart]');
    if(restart) restart.onclick = ()=>{
      if(!V || V.done || V.busy) return;
      const c = V.c;
      UI.confirm({kicker:'重新开始', title:'这一卷从头再答？',
        body:'已经答过的内容会清空，刚才的进度不再保留。',
        okText:'重新开始', danger:true})
        .then(ok=>{
          if(!ok) return;
          dropResume(c.id);
          stopVoice(true); closePad();
          start(c);
        });
    };

    /* 结案页：只把搭过手的那几步挑出来重答 */
    const rev = app.querySelector('[data-review]');
    if(rev) rev.onclick = ()=>{
      if(!V || !V.done || V.reviewDone) return;
      const queue = V.log.map((l,i)=>((l.fails||0)>0 || (l.hint||0)>0 ? i : -1)).filter(i=>i>=0);
      if(!queue.length) return;
      review(queue);
    };
    const backCl = app.querySelector('[data-closing]');
    if(backCl) backCl.onclick = ()=>{
      if(!V || !V.reviewDone) return;
      V.reviewDone = false;
      paint();
    };

    const send = app.querySelector('[data-send]');
    const input = app.querySelector('#ans');
    if(send){
      /* 模型判定期间不再清空输入框：既保住孩子刚打的字，也避免静默丢答 */
      send.onclick = ()=>{
        if(!V || V.done || V.busy) return;
        const v = input.value;
        if(!String(v).trim()) return;
        stopVoice(true);
        const via = V.voiceDraft ? 'voice' : '';
        input.value = '';
        answer(v, via);
        if(!('ontouchstart' in window)) setTimeout(()=>{ try{ input.focus(); }catch(e){} }, 0);
      };
      input.onkeydown = e=>{
        if(e.key==='Enter' && !e.isComposing){
          if(!V || V.done || V.busy) return;
          const v = input.value;
          if(!String(v).trim()) return;
          stopVoice(true);
          const via = V.voiceDraft ? 'voice' : '';
          input.value = '';
          answer(v, via);
        }
      };
      /* 手机上自动聚焦会弹出键盘挡住输入框，只在非触屏设备上自动聚焦 */
      if(!('ontouchstart' in window)) setTimeout(()=>{ try{ input.focus(); }catch(e){} }, 80);
      /* 触屏上手动点开输入框后，等键盘动画结束再对齐到底部 */
      input.addEventListener('focus', ()=>{ setTimeout(scrollBottom, 320); });
    }
    app.querySelectorAll('[data-say]').forEach(b=>{
      b.onclick = ()=>answer(b.getAttribute('data-say'));
    });
    const help = app.querySelector('[data-help]');
    if(help) help.onclick = hint;
    const re = app.querySelector('[data-reread]');
    if(re) re.onclick = reread;

    /* 说得出就不用先学会打字：语音只写进输入框，孩子还能改 */
    const mic = app.querySelector('[data-mic]');
    if(mic) mic.onclick = ()=>{
      if(!V || V.done || V.busy) return;
      listen(input, mic);
    };
    /* 草稿纸：画在本题旁边，不进档案 */
    const pad = app.querySelector('[data-sketch]');
    if(pad) pad.onclick = ()=>{
      if(!V || V.done) return;
      stopVoice(true);
      if(mic) mic.classList.remove('on');
      openPad();
      try{
        if(!localStorage.getItem('detective_pad_tip_v1')){
          localStorage.setItem('detective_pad_tip_v1','1');
          UI.toast('画完点「收起」；草稿不进档案，退出案卷就清空');
        }
      }catch(e){}
    };

    const stemToggle = app.querySelector('[data-stem-toggle]');
    if(stemToggle) stemToggle.onclick = ()=>{
      if(!V) return;
      V.stemOpen = !V.stemOpen;
      const box = stemToggle.closest('.stem-box');
      if(box) box.classList.toggle('clamp', !V.stemOpen);
      stemToggle.textContent = V.stemOpen ? '收起原文 ↑' : '展开全文 ↓';
    };

    const par = app.querySelector('[data-parent]');
    if(par) par.onclick = ()=>window.App.askParent();
  }

  window.CaseView = {open};
})();
