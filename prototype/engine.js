/* ==========================================================
   语义判定层 · v0.3
   1) 不只判断“对/错”，还识别“部分理解”
   2) 所有回话都经过语气层：先接住孩子，再往前走一步
   3) 真实模型接入后，这里退化为离线兜底
   ========================================================== */
(function(){
  const FULL = {'，':',','。':'.','！':'!','？':'?','：':':','；':';','（':'(','）':')','“':'"','”':'"','‘':'"','’':'"'};

  /* 常见“量”的领域词：孩子只说领域、没说到具体对象时，算部分理解 */
  const DOMAINS = [
    {name:'时间', keys:['时间','多久','几分钟','几小时','几天','年份','年数']},
    {name:'路程', keys:['路程','距离','多远','千米','米数']},
    {name:'速度', keys:['速度','每分钟','每小时','快慢']},
    {name:'数量', keys:['只数','数量','多少个','多少只','多少棵','多少人','人数','棵数']},
    {name:'脚数', keys:['脚','腿']},
    {name:'倍数', keys:['倍数','几倍','几份']},
    {name:'效率', keys:['效率','每天做','每小时做','工作量']},
    {name:'产量', keys:['产量','零件数','加工多少']},
    {name:'年龄', keys:['年龄','岁数','几岁']}
  ];

  /* 语气层：把生硬的判断换成可继续对话的说法 */
  const SOFT = [
    [/不对/g,'还差半步'],
    [/差一点/g,'很接近了'],
    [/你算错了/g,'这一步的计算我们再核对一下'],
    [/算错了/g,'这一步我们再核对一下'],
    [/除错了/g,'除法这一步再看看'],
    [/搞混了/g,'容易混在一起'],
    [/还没除/g,'还差最后一步除法'],
    [/不行/g,'暂时走不通'],
    [/不是这题问的/g,'还不是这题要的'],
    [/没回答/g,'还没有正面回答']
  ];

  function normalize(s){
    return String(s||'')
      .replace(/[\uFF01-\uFF5E]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
      .replace(/[，。！？、：；""'']/g,'')
      .replace(/\s+/g,'')
      .toLowerCase();
  }

  function matches(t, key){
    const k = normalize(key);
    if(!k) return false;
    if(/^\d+(\.\d+)?$/.test(k)){
      const esc = k.replace('.', '\\.');
      try{ return new RegExp('(?<![\\d.])'+esc+'(?![\\d.])').test(t); }catch(e){ return t.includes(k); }
    }
    return t.indexOf(k) > -1;
  }

  /* 孩子常换词：把常见同义说法换成本应用里的词，再比对一次。
     只做保守替换，避免把「一共」之类拆成无意义的片段。 */
  const SYN = [
    [/平均分|均分|平分/g, '平均'],
    [/总共|一共|合计|共计|总计/g, '共'],
    [/剩下|剩余|还剩|余下/g, '剩'],
    [/相差|多多少|少多少/g, '差'],
    [/几倍|多少倍/g, '倍'],
    [/公里/g, '千米'],
    [/公斤/g, '千克'],
    [/块钱|元钱/g, '元']
  ];

  function alt(t){
    let out = t;
    SYN.forEach(p=>{ out = out.replace(p[0], p[1]); });
    return cn2num(out);
  }

  /* 孩子常把数字写成汉字（三天、五盆、十二人）。
     只在后面紧跟量词时转换，避免把“一共”“一样”改成数字。 */
  const CN_NUM = {零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  const UNIT = '(分钟|小时|千米|千克|公斤|秒钟|吨|克|米|元|岁|天|人|个|只|条|棵|盆|张|本|瓶|次|组|段|层|辆|台|件|箱|袋|枚|面|堆|份|倍|页|道|题|楼)';

  function cnValue(s){
    if(s === '十') return 10;
    if(s.length === 1) return CN_NUM[s];
    if(s[0] === '十') return 10 + (CN_NUM[s[1]] || 0);
    if(s[1] === '十') return (CN_NUM[s[0]] || 0) * 10 + (s[2] ? (CN_NUM[s[2]] || 0) : 0);
    return CN_NUM[s[0]];
  }

  function cn2num(t){
    const re = new RegExp('([一二两三四五六七八九十]{1,3})(?=' + UNIT + ')', 'g');
    return t.replace(re, s=>{
      const v = cnValue(s);
      return v == null ? s : String(v);
    });
  }

  /* 长词允许被拆开说：如「先求总人数」也能在「先求出总人数是多少」里命中。
     只在 3～12 字的概念词上启用，数字与短词仍走严格匹配。 */
  function covers(t, key){
    const k = normalize(key);
    if(k.length < 3 || k.length > 12) return false;
    if(/^\d+(\.\d+)?$/.test(k)) return false;
    let i = 0;
    for(const ch of t){
      if(ch === k[i]){
        i++;
        if(i >= k.length) return true;
      }
    }
    return false;
  }

  const isNumKey = k => /^\d+(\.\d+)?$/.test(normalize(k));

  /* 孩子写的是更完整的表达（如 1/12、36/5），里面恰好含混淆词的片段（12、5）时，
     不该被这个片段否掉——否则写对反被判成“混淆” */
  function swallows(expHit, conf){
    const e = normalize(expHit), c = normalize(conf.hit);
    return !!c && e !== c && e.indexOf(c) > -1;
  }

  function soften(s){
    let out = String(s||'');
    SOFT.forEach(p=>{ out = out.replace(p[0], p[1]); });
    return out;
  }

  function quote(raw){
    const s = String(raw||'').trim().replace(/^["“]|["”]$/g,'');
    return s.length > 18 ? s.slice(0,18) + '…' : s;
  }

  /* 每一句回话都要落到一个具体问题上，避免“说完了但没下一步” */
  function ensureAsk(s, step){
    if(/[？?]/.test(s)) return s;
    return s + ' 我们回到这一步：' + step.q;
  }

  function findDomain(t){
    for(const d of DOMAINS){
      if(d.keys.some(k=>t.indexOf(normalize(k))>-1)) return d.name;
    }
    return null;
  }

  /* ---------- 判定 ---------- */
  function analyze(text, step){
    const t = normalize(text);
    if(!t) return {kind:'empty', confidence:0};
    const t2 = alt(t);

    /* 先严格命中，再试同义替换，最后允许长词被拆开说 */
    const expHit = step.expect.keys.find(k=>matches(t,k) || matches(t2,k) || covers(t,k));
    let conf = null;
    for(const rule of (step.confuse||[])){
      const hit = rule.keys.find(k=>matches(t,k));
      if(hit){ conf = {rule, hit}; break; }
    }

    if(expHit && (!conf || isNumKey(expHit) || swallows(expHit, conf)))
      return {kind:'ok', label:step.expect.label, confidence:.92};
    if(conf)
      return {kind:'confuse', rule:conf.rule, hit:conf.hit, confidence:.78};

    /* 部分理解：说对了领域，但没落到这一步要的对象 */
    for(const rule of (step.partial||[])){
      const hit = rule.keys.find(k=>matches(t,k));
      if(hit) return {kind:'partial', rule, hit, label:rule.label, confidence:.66};
    }
    const domain = findDomain(t);
    const meta = /(问题|关于|求|问|考|属于|算是|有关)/.test(t);
    if(domain && (meta || t.length <= 6))
      return {kind:'partial', domain, label:domain, confidence:.55};

    if(t.length <= 2 || /(不知道|不会做|不会|不懂|没学过|没学|忘了|想不出|随便|嗯|啊|哦)/.test(t))
      return {kind:'idk', confidence:.6};

    return {kind:'off', confidence:.4};
  }

  /* ---------- 回话（华生口吻：先接住，再追问） ---------- */
  /* 本地兜底也要“接住孩子原话 → 点出缺口 → 只问更小的一步”，
     不能每句都像模板；probe 是这一步真正的训练点。 */
  function expectLine(step){
    return (step.expect && step.expect.label) ? '这一步要的是“'+step.expect.label+'”。' : '';
  }
  function probeLine(step){
    return step.probe ? '先想清楚「'+step.probe+'」这一件事。' : '';
  }

  function buildReply(a, step, raw){
    if(a.kind==='confuse'){
      const shown = a.hit && a.hit.length >= 2 ? a.hit : quote(raw);
      const core = String(a.rule.reply||'').replace('{hit}', shown);
      /* 孩子原话里没有出现混淆词时，先复述他的原话，再接上华生的判断 */
      const lead = (shown && core.indexOf(shown) > -1) ? '' : '你写的是“'+quote(raw)+'”。';
      return soften(ensureAsk(lead + core, step));
    }
    if(a.kind==='partial'){
      if(a.rule && a.rule.reply) return soften(ensureAsk(a.rule.reply, step));
      return soften(ensureAsk('你提到“'+(a.hit||a.domain||'这个方向')+'”，方向没有跑偏。'
        + expectLine(step) + probeLine(step) + '只说这一小步：' + step.q, step));
    }
    if(a.kind==='idk'){
      const lead = /^(没关系|没事|不要紧)/.test(step.idk||'') ? '' : '没关系，我们把问题拆小一点。';
      return soften(ensureAsk(lead + (step.idk||''), step));
    }
    if(a.kind==='off'){
      let s = soften(step.off || '我听到的是“{hit}”，不过它还没有回答我问的这句。');
      s = s.replace('{hit}', quote(raw));
      /* 题库里写好的 off 已经点明缺口；只有缺省句才补 expect 与 probe */
      if(!step.off){
        s += expectLine(step);
        if(step.probe) s += '只做一件事：' + step.probe + '。';
      }
      return ensureAsk(s, step);
    }
    return soften(step.retry || step.q);
  }

  function tagOf(a, step){
    if(a.kind==='confuse' && a.rule.tag) return a.rule.tag;
    return step.tag;
  }

  function nextAction(a, step){
    if(a.kind==='ok') return {action:'advance'};
    if(a.kind==='partial') return {action:'narrow', target:a.label};
    if(a.kind==='confuse') return {action:'repair', target:a.rule.label};
    if(a.kind==='idk') return {action:'scaffold', level:1};
    return {action:'reanchor'};
  }

  /* ---------- 诊断汇总 ---------- */
  function diagnose(sessions){
    const dimAgg = {};
    DIMS.forEach(d=>{ dimAgg[d.key] = {sum:0, n:0}; });
    const tags = {}, confusions = {};
    let steps = 0;

    sessions.forEach(s=>{
      (s.log||[]).forEach((l,i)=>{
        const c = CASES.find(x=>x.id===s.caseId);
        if(!c || !c.steps[i]) return;
        const step = c.steps[i];
        const d = dimAgg[step.dim];
        if(d){
          /* 分值区间与家长端四档描述对齐：100 / 75 / 55 / 40 */
          const penalty = l.fails===0 ? 0 : (l.fails===1 ? 25 : (l.fails===2 ? 45 : 60));
          d.sum += (100 - penalty);
          d.n++; steps++;
        }
        if(l.fails>0){
          tags[step.tag] = (tags[step.tag]||0) + 1;
          if(l.mis) confusions[l.mis] = (confusions[l.mis]||0) + 1;
        }
      });
    });

    const dims = DIMS.map(d=>({
      key:d.key, name:d.name,
      score: dimAgg[d.key].n ? Math.round(dimAgg[d.key].sum/dimAgg[d.key].n) : null,
      n: dimAgg[d.key].n
    }));

    return {dims, tags, confusions, steps, sessions:sessions.length};
  }

  window.Engine = {normalize, matches, analyze, buildReply, tagOf, diagnose, nextAction, quote, soften};
})();
