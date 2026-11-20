/* ==========================================================
   家长端 · 学习观察报告
   措辞原则：给证据、给范围、给建议，不下定论
   ========================================================== */
(function(){
  const ADVICE = {
    reading:{t:'先让孩子把题目讲给你听',
      p:'不急着问“懂了吗”，请孩子用自己的话说明：题目在问什么、已知什么。讲不清的那一句，通常就是需要停一下的地方。',
      d:'审题'},
    relation:{t:'把数量关系画出来',
      p:'用线段图或小方块把关系摆出来：谁是谁的几倍、谁比谁多多少。关系可视化之后，列式往往更顺。',
      d:'关系'},
    model:{t:'动笔前先问“第一步求什么”',
      p:'建模卡住时，缺的常常是起手式。可以先问孩子：要得到答案，必须先知道什么？',
      d:'建模'},
    calc:{t:'把计算拆成两行写',
      p:'每一步单独写一行，并保留验算。这样既能减少跳步，也方便回看是哪一步出了问题。',
      d:'计算'},
    transfer:{t:'答案对了，再换一个条件',
      p:'把题里的一个条件换掉，再问孩子会不会变、为什么。这一步有助于判断是记住了做法，还是理解了关系。',
      d:'迁移'}
  };

  const fmt = ts => { const d=new Date(ts); return (d.getMonth()+1)+'月'+d.getDate()+'日'; };
  const md  = ts => { const d=new Date(ts); return (d.getMonth()+1)+'/'+d.getDate(); };
  const days = ts => Math.floor((Date.now()-ts)/86400000);
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  /* 卡片标题的细线图标：黄铜色，16px，与档案语言一致 */
  const PICO = {
    cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 9.5h17M8 3v3.2M16 3.2v3.3"/></svg>',
    radar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 4l7 5.1-3 8.9H8l-3-8.9z"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
    bars:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 19.5v-5M9.6 19.5V6.5M14.7 19.5v-8M19.8 19.5V9"/></svg>',
    trend:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17.5 9.5 12l4 3.5L20 8.5"/><path d="M20 13V8.5h-4.5"/></svg>',
    book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17z"/><path d="M8.5 9h5M8.5 12.5h4"/></svg>',
    quote:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6h14v9.5H10.5L5 19z"/><path d="M8.5 10h7M8.5 12.8h4.5"/></svg>'
  };
  const pico = k => '<span class="pico" aria-hidden="true">'+(PICO[k]||'')+'</span>';

  /* ---------- 导出：按“步骤”而不是按“次”，方便老师看过程 ---------- */
  const pad2 = n => (n<10?'0':'')+n;
  function stamp(ts){
    const d = new Date(ts);
    return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())
      +' '+pad2(d.getHours())+':'+pad2(d.getMinutes());
  }
  const cell = v => '"'+String(v==null?'':v).replace(/"/g,'""')+'"';

  function exportCsv(all){
    const head = ['日期时间','案卷编号','案卷','年级','题型','难度','第几步','维度','这一步考什么',
      '是否独立通过','提示次数','答错次数','方向对但不具体','理解偏差','作答方式','通过时的作答','首次卡住时的作答'];
    const lines = [head.map(cell).join(',')];
    all.slice().sort((a,b)=>a.ts-b.ts).forEach(s=>{
      const c = CASES.find(x=>x.id===s.caseId);
      if(!c) return;
      (s.log||[]).forEach((l,i)=>{
        const st = c.steps[i] || {};
        const dn = (window.DIMS||[]).find(d=>d.key===st.dim);
        lines.push([
          stamp(s.ts), c.no, c.title, c.grade||'', c.type, 'L'+c.level,
          (i+1)+'/'+c.steps.length, dn?dn.name:(st.dim||''), st.tag||'',
          /* 与家长端口径一致：答过错或点过提示都不算独立 */
          (((l.fails||0)===0 && !(l.hint||0)) ? '是' : '否'), l.hint||0, l.fails||0, l.partial||0,
          l.mis||'', (l.via==='voice' ? '语音' : (l.via==='quick' ? '快捷选项' : '键盘')),
          l.said||'', (l.firstWrong && l.firstWrong.said) || ''
        ].map(cell).join(','));
      });
    });
    const blob = new Blob(['\ufeff'+lines.join('\r\n')], {type:'text/csv;charset=utf-8'});
    const d = new Date();
    const name = '侦探档案_'+(Account.name()||'小侦探')+'_'
      + d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate())+'.csv';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
    if(window.UI) UI.toast('已导出 '+name);
  }

  /* 每个维度的“稳定 / 不稳定”分别对应什么行为，避免只给分数不给解释 */
  const DIM_DIAG = {
    reading:{hi:'能自己说清题目在问什么、哪些是已知条件。',
             lo:'容易把已知条件当成问题，或漏掉“还要”“至少”这类限定词。'},
    relation:{hi:'能主动找出量之间的关系，并说得出来。',
              lo:'要提示才能看出谁比谁多、谁是谁的几倍。'},
    model:{hi:'动笔前说得出第一步该求什么。',
           lo:'缺少起手式，常直接列式试算。'},
    calc:{hi:'步骤分得清，计算过程稳定。',
          lo:'一步跨太多，容易出现跳步错误。'},
    transfer:{hi:'换个条件仍能解释答案为什么变。',
              lo:'记住了做法，但换条件后难以迁移。'}
  };

  /* 少于 3 个作答步骤时只记“观察中”：一两次作答撑不起“稳定/不稳定”这种判断 */
  function dimLevel(v, n){
    if(v==null) return {name:'样本不足', cls:''};
    if((n||0) < 3) return {name:'观察中', cls:''};
    if(v>=85) return {name:'稳定', cls:'ok'};
    if(v>=70) return {name:'基本形成', cls:''};
    if(v>=55) return {name:'不稳定', cls:'bad'};
    return {name:'尚未建立', cls:'bad'};
  }

  function stats(all){
    const sum = all.reduce((a,s)=>a+(s.total||0),0);
    const ind = all.reduce((a,s)=>a+(s.independent||0),0);
    return { n:all.length, week:all.filter(s=>days(s.ts)<7).length,
             rate: sum ? Math.round(ind/sum*100) : 0, steps:sum, ind };
  }

  function mastery(all){
    const m = {};
    all.forEach(s=>{
      const c = CASES.find(x=>x.id===s.caseId);
      if(!c) return;
      const o = m[c.type] || (m[c.type]={ok:0,total:0,n:0});
      o.ok += s.independent||0;
      o.total += s.total||0;
      o.n++;
    });
    return TYPES.map(t=>{
      const o = m[t];
      const pct = o && o.total ? Math.round(o.ok/o.total*100) : 0;
      return {label:t, value:pct, max:100, text: o&&o.total ? pct+'%' : '未练',
              hot: o&&o.total && pct<60, n:o?o.n:0};
    });
  }

  function trend(all){
    return all.slice().sort((a,b)=>a.ts-b.ts).slice(-6).map(s=>({
      d: md(s.ts), v: s.total ? Math.round((s.independent||0)/s.total*100) : 0
    }));
  }

  /* 结论区：先给事实，再给判断，最后给三个可核对的数字 */
  function verdict(all, diag, compact){
    const st = stats(all);
    /* 判断只用样本足够的维度；n<3 的维度仍会显示，但不参与结论 */
    const dims = diag.dims.filter(d=>d.score!=null && d.n>=3);
    const byScore = dims.slice().sort((a,b)=>b.score-a.score);
    const best = byScore[0], worst = byScore[byScore.length-1];
    const band = st.rate>=85 ? '已经能独立把题推完'
      : (st.rate>=70 ? '大体能独立，个别步骤要提示'
        : (st.rate>=50 ? '需要提示才能往下走' : '目前比较依赖提示'));

    let judge;
    if(!dims.length){
      judge = '还没有足够的作答步骤，先完成 2–3 次练习，这份报告才具备判断依据。';
    }else if(best && worst && best.key!==worst.key && best.score-worst.score>=10){
      judge = '孩子目前'+band+'。五项里「'+best.name+'」最稳（'+best.score+'），「'+worst.name
        + '」相对靠后（'+worst.score+'，'+worst.n+' 个步骤）——下一步优先补这一项，不必急着加新题型。';
    }else{
      judge = '孩子目前'+band+'。五项之间差异不大（'+worst.score+'–'+best.score
        + '），暂无突出短板，可以保持题型轮换、每周两到三次短练习。';
    }
    /* 样本少时先把话说小：报告宁可保守，也不给一个看起来确定的结论 */
    if(dims.length && (st.n < 2 || st.steps < 10)){
      judge = '目前只有 '+st.n+' 次、'+st.steps+' 个作答步骤，以下先作观察：'+judge;
    }

    if(compact) return '<div class="card verdict"><p class="vjudge">'+judge+'</p></div>';

    const fact = '最近 7 天 <b>'+st.week+'</b> 次练习，累计 <b>'+st.n+'</b> 次、<b>'+st.steps
      + '</b> 个作答步骤；其中 <b>'+st.ind+'</b> 个没有用到提示，独立率 <b>'+st.rate+'%</b>。';
    const weakN = dims.filter(d=>d.score<70).length;

    return '<div class="card taped verdict">'
      + '<p class="vfact">'+fact+'</p>'
      + '<p class="vjudge">'+judge+'</p>'
      + '<div class="vstats">'
      + '<div><b>'+st.rate+'%</b><span>无提示完成率</span></div>'
      + '<div><b>'+weakN+'</b><span>低于 70 分的维度</span></div>'
      + '<div><b>'+st.n+'</b><span>累计练习次数</span></div>'
      + '</div>'
      + '<p class="vsrc">以上每个数字都能在「练习记录」里逐条核对；分数只反映本应用内的提示依赖程度。</p></div>';
  }

  /* 五维逐条诊断：分数 + 等级 + 行为描述 + 样本量 */
  function diagRows(diag){
    const rows = diag.dims.map(d=>{
      const lv = dimLevel(d.score, d.n);
      const txt = d.score==null ? '这一项还没有足够的作答步骤，暂时不下判断。'
        : (d.n<3 ? '目前只有 '+d.n+' 个作答步骤，先记录，不下判断。'
          : (d.score>=70 ? DIM_DIAG[d.key].hi : DIM_DIAG[d.key].lo));
      return '<div class="diagrow"><div class="dh"><b>'+d.name+'</b>'
        + '<span class="score">'+(d.score==null?'—':d.score)+'</span>'
        + '<span class="pill '+(lv.cls||'')+'">'+lv.name+'</span>'
        + '<span class="n">n='+d.n+'</span></div>'
        + '<p>'+txt+'</p>'
        + (d.n>0 ? '<button class="linkbtn dimmore" data-dim="'+d.key+'">查看依据 · '+d.n+' 个作答步骤</button>' : '')
        + '</div>';
    }).join('');
    return '<div class="diaglist">'+rows+'</div>';
  }

  function advices(all, diag){
    const out = [];
    /* 只对样本足够的维度给建议：一两个步骤的分数不足以支撑一条行动建议 */
    const weak = diag.dims.filter(d=>d.score!=null && d.n>=3 && d.score<85)
      .sort((a,b)=>a.score-b.score);
    weak.slice(0,2).forEach(d=>{
      const a = ADVICE[d.key];
      if(a) out.push({t:a.t, p:a.p, d:a.d,
        why:'依据：该维度最近 '+d.n+' 个作答步骤的平均分为 '+d.score+'，在五项中相对靠后。'});
    });
    const conf = Object.entries(diag.confusions).sort((a,b)=>b[1]-a[1])[0];
    if(conf && conf[1]>=2){
      out.push({t:'陪孩子把“'+conf[0]+'”说清楚',
        p:'这个理解偏差在记录中出现过，可以请孩子先解释自己的想法，再举一个相反的例子，帮助孩子把概念分清。',
        d:null, why:'依据：同一处偏差在记录中出现 '+conf[1]+' 次，建议继续观察，暂不下结论。'});
    }
    /* 数据未必能撑满三条：缺口用低成本的日常做法补齐，保证家长拿到的是完整的一组动作 */
    const extra = [
      {t:'让孩子把思路讲给你听',
       p:'做完一道题后，请孩子用自己的话讲一遍“先求什么、再求什么”。你只需要点头和追问，不要替孩子补。',
       d:'建模', why: diag.steps < 10
         ? '依据：目前只有 '+diag.steps+' 个作答步骤，先用讲题观察思路，再决定重点练什么。'
         : '依据：五项当前较均衡，讲题能同时检验审题与建模，是成本最低的日常练习。'},
      {t:'每周固定两到三次短练习',
       p:'每次十分钟左右，做完就停。频率比单次时长更重要，避免把练习变成长时间刷题。',
       d:null, why:'依据：现有 '+diag.sessions+' 次练习的间隔与单次时长，固定节奏更容易看出趋势。'},
      {t:'做完再追一句“换个条件呢”',
       p:'每道题收尾时加一句“如果这个条件变了呢”，让孩子不只会算这一道。',
       d:'迁移', why:'依据：迁移应用最容易被忽略，日常只需一句追问。'}
    ];
    extra.forEach(e=>{ if(out.length < 3) out.push(e); });
    return out.slice(0,3);
  }

  /* 一键复制纯文字摘要：家长可以直接发给家人或老师，不用截图 */
  function summaryText(all, diag){
    const st = stats(all);
    const name = (window.Account && Account.name()) || '孩子';
    const dims = diag.dims.map(d=>{
      const lv = dimLevel(d.score, d.n);
      return d.name+' '+(d.score==null?'—':d.score)+'（'+lv.name+'）';
    }).join('；');
    const weak = diag.dims.filter(d=>d.score!=null && d.n>=3).sort((a,b)=>a.score-b.score)[0];
    const adv = advices(all, diag).map((a,i)=>(i+1)+'. '+a.t).join('；');
    return [
      '少年侦探社 · 学习观察摘要',
      name+' · 生成于 '+md(Date.now()),
      '样本：'+st.n+' 次练习、'+st.steps+' 个作答步骤，无提示完成率 '+st.rate+'%。',
      '五维：'+dims+'。',
      weak ? '相对靠后：'+weak.name+'（'+weak.score+'，依据 '+weak.n+' 个作答步骤）。' : '样本还不足，先观察。',
      '本周建议：'+adv+'。',
      '说明：分数反映本应用内的提示依赖程度，不等同于考试成绩；每一步的明细可在家长端「练习记录」里逐条核对。'
    ].join('\n');
  }
  function fallbackCopy(t){
    const ta = document.createElement('textarea');
    ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
    ta.remove(); return ok;
  }
  function copyText(t){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(t).then(()=>true, ()=>fallbackCopy(t));
    }
    return Promise.resolve(fallbackCopy(t));
  }

  /* 近 7 天：家长最想先知道“这周练了没有、卡在哪、下一步做什么” */
  function weekCard(all){
    const recent = all.filter(s=>days(s.ts)<7);
    const st = stats(recent);
    const mins = Math.round(recent.reduce((a,s)=>a+(s.duration||0),0)/60);
    const latest = all.slice().sort((a,b)=>b.ts-a.ts)[0];
    const gap = latest ? Math.max(0, days(latest.ts)) : null;

    /* 卡点只统计“答错过或点过线索”的步骤，取出现最多的那一处 */
    const cnt = {};
    recent.forEach(s=>(s.log||[]).forEach(l=>{
      if(!((l.fails||0) > 0 || (l.hint||0) > 0)) return;
      const k = (l.mis && l.mis!=='—') ? l.mis : '需要搭把手';
      cnt[k] = (cnt[k]||0) + 1;
    }));
    const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];

    let tip;
    if(!recent.length){
      tip = gap==null
        ? '还没有练习记录。挑一份十分钟的短案卷开始，比攒到周末做一大轮更容易坚持。'
        : '这周还没有练习（上次在 '+gap+' 天前）。先挑一份练过的题型热热身，不必一上来挑最难的。';
    }else if(st.rate>=80){
      tip = '这周独立率不错。可以换一个没练过的题型，看看孩子是不是能把方法迁移过去。';
    }else if(st.rate<55){
      tip = '这周有几步比较依赖提示。建议陪孩子把卡住的那一步讲一遍，而不是把整卷重做。';
    }else{
      tip = '节奏稳定，保持每周两到三次、每次十分钟即可，重点看连续三次的走向。';
    }

    return '<div class="card weekcard">'
      + '<div class="card-h"><h3>'+pico('cal')+'本周回顾</h3><span class="hint">最近 7 天</span></div>'
      + '<div class="vstats">'
      + '<div><b>'+(recent.length||'—')+'</b><span>练习次数</span></div>'
      + '<div><b>'+(mins||'—')+'</b><span>累计分钟</span></div>'
      + '<div><b>'+(recent.length?st.rate+'%':'—')+'</b><span>无提示完成</span></div>'
      + '</div>'
      + '<p class="wkline"><b>最常见卡点</b>'
      + (top ? '「'+esc(top[0])+'」出现 '+top[1]+' 次' : '这周没有记录到明显的理解偏差')+'</p>'
      + '<p class="wkline"><b>上次练习</b>'
      + (gap==null ? '还没有记录' : (gap===0 ? '今天' : gap+' 天前'))+'</p>'
      + '<p class="wktip">'+tip+'</p></div>';
  }

  function dataNote(all, diag){
    return '<div class="datanote"><b>数据说明</b>'
      + '<span>样本：'+diag.sessions+' 次练习、'+diag.steps+' 个作答步骤，均来自本机记录。</span>'
      + '<span>分数反映在本应用内的提示依赖程度，不等同于考试成绩或能力测评。</span>'
      + '<span>练习次数少于 3 次的题型，建议只作观察，不急着判断掌握情况。</span>'
      + '<details class="glossary"><summary>报告里几个词的意思</summary>'
      + '<p><b>无提示完成率</b>：一个步骤里，孩子没有点「给我一条线索」、也没有重复作答就通过的比例。它衡量的是“自己能不能走”，不是“算得快不快”。</p>'
      + '<p><b>理解偏差</b>：答案背后有一个稳定的错误理解，比如把“多多少”当成“一共”。系统记下它，是为了让你知道该从哪里聊起。</p>'
      + '<p><b>卡点</b>：需要提示、或反复几次才通过的那一步。卡点越靠前，通常越值得回看。</p>'
      + '<p><b>重审</b>：结案后只把卡住的几步重走一遍。它只是“后来弄懂了吗”的补充记录，不改变原来的分数。</p>'
      + '</details></div>';
  }

  /* 没有记录时不下判断：报告宁可空着，也不给一个看起来精确的假分数 */
  function emptyPanel(){
    return '<div class="pwrap">'
      + '<div class="psec"><i>一</i><b>整体判断</b><span>先看结论</span></div>'
      + '<div class="card taped empty-state"><b>还没有可以判断的记录</b>'
      + '<p class="pnote">这份报告只用孩子在这台设备上完成的练习来生成。完成第一份案卷（五到六问）后，'
      + '这里会出现整体判断、五维证据与本周建议。</p></div>'
      + '<div class="psec"><i>二</i><b>能力证据</b><span>暂无样本</span></div>'
      + '<div class="card empty-state"><b>五项能力都还没有样本</b>'
      + '<p class="pnote">少于 3 个作答步骤时不下判断，这是刻意的：宁可空着，也不给一个看起来精确的假分数。</p></div>'
      + '<div class="psec"><i>三</i><b>最近练习</b><span>时间线</span></div>'
      + '<div class="card empty-state"><b>还没有练习记录</b>'
      + '<p class="pnote">把手机交回孩子端，挑一份案卷开始。</p></div>'
      + '<p class="footnote">记录只保存在这台设备 · 作答文字仅用于判分</p>'
      + '<button class="linkbtn" data-kid>← 回到孩子端</button></div>';
  }

  function dashboard(all, diag){
    const m = mastery(all), t = trend(all);
    const practiced = m.filter(x=>x.n>0).sort((a,b)=>b.value-a.value);
    const untouched = m.filter(x=>x.n===0).map(x=>x.label);
    const weakType = practiced.filter(x=>x.n>=2)[0] || practiced[0];

    let tl = all.slice().sort((a,b)=>b.ts-a.ts).slice(0,5).map(s=>{
      const c = CASES.find(x=>x.id===s.caseId); if(!c) return '';
      const pct = s.total ? Math.round((s.independent||0)/s.total*100) : 0;
      return '<div class="item'+(pct<60?' warn':'')+'">'
        + '<div class="t">'+fmt(s.ts)+' · '+c.type+' · 无提示 '+pct+'%</div>'
        + '<div class="d">'+c.title+'（'+s.independent+'/'+s.total+' 步独立完成）</div></div>';
    }).join('');

    const typeBody = practiced.length
      ? Charts.bars(practiced)
        + '<p class="pnote">条形越短，说明该题型在本应用内更依赖提示。'
        + (weakType ? '「'+weakType.label+'」练了 '+weakType.n+' 次、无提示完成 '+weakType.value
            + '%，可以作为近期练习的参考。' : '') + '</p>'
        + (untouched.length ? '<p class="pnote">还没练过：'+untouched.join('、')+'。</p>' : '')
      : '<p class="pnote">完成一次练习后，这里会出现题型之间的对比。</p>';

    return '<div class="pwrap">'
      + '<div class="psec"><i>一</i><b>整体判断</b><span>先看结论</span></div>'
      + verdict(all, diag)
      + '<div style="text-align:center;margin:-4px 0 6px"><button class="linkbtn" data-copy-report>复制文字版报告 · 可发给家人或老师</button></div>'
      + weekCard(all)
      + '<div class="psec"><i>二</i><b>能力证据</b><span>结论的依据</span></div>'
      + '<div class="card"><div class="card-h"><h3>'+pico('radar')+'五维诊断</h3><span class="hint">本应用内 · 越靠外越稳</span></div>'
      + Charts.radar(diag.dims)
      + diagRows(diag)
      + '<p class="pnote">分数按“这一步是否用到提示”折算；n 是该维度累计的作答步骤数，少于 3 步时只作观察。</p></div>'
      + '<div class="card"><div class="card-h"><h3>'+pico('bars')+'题型熟练度</h3><span class="hint">无提示完成占比</span></div>'
      + typeBody + '</div>'
      + '<div class="card"><div class="card-h"><h3>'+pico('trend')+'近六次趋势</h3><span class="hint">无提示完成率</span></div>'
      + Charts.line(t)
      + '<p class="pnote">单次起伏属于正常现象，建议看连续三次以上的走向，而不是某一次的分数。</p></div>'
      + '<div class="psec"><i>三</i><b>最近练习</b><span>时间线</span></div>'
      + '<div class="card"><div class="tl">'+tl+'</div>'
      + '<button class="linkbtn" data-ptab="advice">看下一步该怎么练 →</button></div>'
      + dataNote(all,diag)
      + '<p class="footnote">记录只保存在这台设备 · 作答文字仅用于判分</p>'
      + '<button class="linkbtn" data-kid>← 回到孩子端</button></div>';
  }

  function advicePage(all, diag){
    const m = mastery(all);
    const list = advices(all, diag);
    const practiced = m.filter(x=>x.n>0).sort((a,b)=>a.value-b.value);
    const weakType = practiced.filter(x=>x.n>=2)[0] || practiced[0];
    const rec = weakType ? CASES.filter(c=>c.type===weakType.label).slice(0,2) : CASES.slice(0,2);
    const PRI = ['现在做','接着做','长期保持'];

    let body = list.map((a,i)=>'<div class="advice">'
      + '<div class="ateam"><span class="pri">'+(PRI[i]||'可尝试')+'</span><b>'+a.t+'</b></div>'
      + '<p>'+a.p+'</p>'
      + '<div class="evidence">'+a.why+'</div>'
      + (a.d && SAY[a.d] ? '<div class="say">可以这样说：「'+SAY[a.d]+'」</div>' : '')
      + '</div>').join('');

    let recHtml = rec.map(c=>'<div class="recrow" data-open="'+c.id+'">'
      + '<span class="mono dim">'+c.no+'</span>'
      + '<div><b>'+c.title+'</b><span>'+c.type+' · L'+c.level+' · 约 '+c.minutes+' 分钟</span></div>'
      + '<span class="pill">去练</span></div>').join('');

    return '<div class="pwrap">'
      + '<div class="psec"><i>一</i><b>整体判断</b><span>先看结论</span></div>'
      + verdict(all, diag, true)
      + '<div class="psec"><i>二</i><b>本周可以做的三件事</b><span>按优先级</span></div>'
      + '<div class="card">'+body+'</div>'
      + '<div class="psec"><i>三</i><b>陪练与提问</b><span>照着说就行</span></div>'
      + '<div class="card"><div class="card-h"><h3>'+pico('book')+'可以陪孩子练这两道</h3><span class="hint">按当前记录推荐</span></div>'
      + recHtml
      + (weakType?'<p class="pnote">选择依据：「'+weakType.label+'」目前无提示完成率为 '+weakType.value
          + '%，已练习 '+weakType.n+' 次。</p>':'<p class="pnote">还没有练习记录，先按顺序各做一道即可。</p>')
      + '</div>'
      + '<div class="card"><div class="card-h"><h3>'+pico('quote')+'今晚可以试着这样问</h3><span class="hint">三个问题</span></div>'
      + '<div class="script"><p><i>1</i>“这题你先别算，告诉我它在问什么。”</p>'
      + '<p><i>2</i>“你觉得第一步先求出什么？为什么？”</p>'
      + '<p><i>3</i>“如果我把这个条件换掉，答案会怎么变？”</p></div>'
      + '<p class="pnote">三个问题分别对应审题、建模和迁移，孩子答不上来也没关系，重点是让孩子把想法说出来。</p></div>'
      + '<p class="footnote">建议根据本机记录生成，供参考，不替代老师的观察与判断。</p>'
      + '<button class="linkbtn" data-kid>← 回到孩子端</button></div>';
  }

  function logPage(all, diag){
    /* 手机上五列表格太挤：改为逐条记录卡，一行看结论，一行看细节 */
    const st = stats(all);
    const df = dimFilter ? (window.DIMS||[]).find(d=>d.key===dimFilter) : null;
    let rows, scope;
    if(dimFilter && df){
      /* 从能力看板点进来：只摆这个维度的作答步骤，家长可以逐条核对分数是怎么来的 */
      const list = [];
      all.slice().sort((a,b)=>b.ts-a.ts).forEach(s=>{
        const c = CASES.find(x=>x.id===s.caseId); if(!c) return;
        (s.log||[]).forEach((l,i)=>{
          const stp = c.steps[i] || {};
          if(stp.dim === dimFilter) list.push({s:s, c:c, l:l, i:i, stp:stp});
        });
      });
      scope = '只看'+df.name+' · '+list.length+' 步';
      rows = list.length ? list.map(o=>{
        const clean = (o.l.fails||0)===0 && !(o.l.hint||0);
        return '<div class="logrow"><div class="logtop">'
          + '<span class="date">'+md(o.s.ts)+'</span><b>'+o.c.title+'</b>'
          + '<span class="pill '+(clean?'ok':'bad')+'">'+(clean?'独立通过':'用到提示')+'</span></div>'
          + '<div class="logmeta"><span class="mini">第 '+(o.i+1)+'/'+o.c.steps.length+' 步</span>'
          + '<span>'+(o.stp.tag||'这一步')+'</span>'
          + (o.l.hint ? '<span>提示 '+o.l.hint+' 次</span>' : '')
          + (o.l.fails ? '<span>答错 '+o.l.fails+' 次</span>' : '')
          + (o.l.partial ? '<span>方向对 '+o.l.partial+' 次</span>' : '')
          + (o.l.mis ? '<span class="dim">'+o.l.mis+'</span>' : '')
          + '<span>'+((o.l.via==='voice')?'语音作答':(o.l.via==='quick'?'快捷选项':'键盘作答'))+'</span>'
          + '</div></div>';
      }).join('') : '<p class="pnote">这个维度还没有作答记录。</p>';
    }else{
      scope = '共 '+all.length+' 次';
      rows = all.slice().sort((a,b)=>b.ts-a.ts).map(s=>{
        const c = CASES.find(x=>x.id===s.caseId); if(!c) return '';
        const pct = s.total ? Math.round((s.independent||0)/s.total*100) : 0;
        const bad = (s.log||[]).filter(l=>l.fails>0 || (l.hint||0)>0);
        const tag = bad.length ? (bad[0].mis || '使用过提示') : '—';
        return '<div class="logrow"><div class="logtop">'
          + '<span class="date">'+md(s.ts)+'</span><b>'+c.title+'</b>'
          + '<span class="pill '+(pct>=80?'ok':(pct<60?'bad':''))+'">'+pct+'%</span></div>'
          + '<div class="logmeta"><span class="mini">'+c.type+'</span>'
          + '<span>独立 '+s.independent+'/'+s.total+' 步</span>'
          + (s.voice ? '<span>语音作答 '+s.voice+' 次</span>' : '')
          + (s.pad ? '<span>用过草稿纸</span>' : '')
          + '<span class="dim">卡点：'+tag+'</span>'
          + (s.review ? '<span class="dim">事后重审 '+s.review.ok+'/'+s.review.total+' 走通</span>' : '')
          + '</div></div>';
      }).join('');
    }

    /* 只把“出现过两次以上”的偏差当作线索；单次出现先记录，不急着下判断 */
    const confsAll = Object.entries(diag.confusions).sort((a,b)=>b[1]-a[1]);
    const repeated = confsAll.filter(c=>c[1]>=2).slice(0,5);
    const once = confsAll.filter(c=>c[1]<2).map(c=>c[0]);
    const confHtml = repeated.length
      ? repeated.map(c=>'<div class="recrow"><div><b>'+c[0]+'</b><span>记录中出现 '+c[1]+' 次</span></div><span class="pill">继续观察</span></div>').join('')
      : (once.length
          ? '<p class="pnote">目前每处偏差都只出现 1 次（如「'+once.slice(0,3).join('」「')+'」），还不足以判断成稳定模式，先记录、不急着纠正。</p>'
          : '<p class="pnote">目前还没有记录到理解偏差。</p>');

    return '<div class="pwrap">'
      + '<div class="psec"><i>一</i><b>练习记录</b><span>'+scope+'</span></div>'
      + '<div class="card">'
      + '<p class="psum">累计 <b>'+st.steps+'</b> 个作答步骤，其中 <b>'+st.ind+'</b> 个没有用到提示，独立率 <b>'+st.rate+'%</b>。</p>'
      + (dimFilter ? '<div class="dimstep"><span>当前只看「'+((df&&df.name)||'该维度')+'」，下面每一条都是这一步的原始作答。</span>'
          + '<button class="linkbtn" data-dim-clear="1">显示全部记录</button></div>' : '')
      + '<div class="loglist">'+rows+'</div>'
      + '<div class="csvrow"><button class="linkbtn" data-csv>导出 CSV · 含逐步作答</button></div></div>'
      + '<div class="psec"><i>二</i><b>重复出现的理解偏差</b><span>仅作观察线索</span></div>'
      + '<div class="card">'+confHtml
      + '<p class="pnote">出现次数少时可能只是偶发，建议结合下一次练习再判断。</p></div>'
      + '<div class="psec"><i>三</i><b>模型接入</b><span>仅存本机</span></div>'
      + '<div class="card">'
      + '<div class="modrow"><div><b>语音识别</b><span data-stt>正在检测…</span></div><span class="pill" data-stt-pill>检测中</span></div>'
      + '<div class="modrow"><div><b>搭档模型</b><span data-model>正在检测…</span></div><span class="pill" data-model-pill>检测中</span></div>'
      + '<p class="pnote">语音识别优先走服务端（配置 STT_API_KEY）；未配置时回退到浏览器识别。'
      + '默认使用本机预置的模型。家长也可以换成自己的 API：Key 只写入这台电脑的服务端，不进浏览器、不进练习记录。</p>'
      + '<label class="field"><span>接口地址</span><input id="mc-base" spellcheck="false" placeholder="https://api.deepseek.com/v1"></label>'
      + '<label class="field"><span>模型名</span><input id="mc-model" spellcheck="false" placeholder="deepseek-chat"></label>'
      + '<label class="field"><span>API Key</span><input id="mc-key" type="password" autocomplete="off" placeholder="留空则保持不变"></label>'
      + '<div class="mc-actions"><button class="btn sm ghost" data-mc-test>测试连接</button>'
      + '<button class="btn sm" data-mc-save>保存配置</button></div>'
      + '<p class="pnote" data-mc-note></p>'
      + '<button class="linkbtn danger" data-clear>清空本机练习记录</button>'
      + '<p class="pnote">清空后档案归零，无法恢复。</p></div>'
      + dataNote(all,diag)
      + '<p class="footnote">记录只保存在这台设备 · 作答文字仅用于判分</p>'
      + '<button class="linkbtn" data-kid>← 回到孩子端</button></div>';
  }

  let lastTab = 'dash';
  let dimFilter = null;

  function render(tab){
    tab = tab || lastTab;
    const same = tab === lastTab;
    const keepY = window.pageYOffset || document.documentElement.scrollTop || 0;
    lastTab = tab;
    const all = Store.all();
    const diag = Engine.diagnose(all);
    const app = document.getElementById('app');
    app.className = 'parent';
    const body = !all.length ? emptyPanel()
      : (tab==='advice' ? advicePage(all,diag) : (tab==='log' ? logPage(all,diag) : dashboard(all,diag)));

    app.innerHTML =
      '<div class="pmast"><div class="row">'
      + '<div><h1>学习观察报告</h1>'
      + '<div class="date">'+esc(Account.name())+' · '+fmt(Date.now())+' · 基于本机练习记录</div></div>'
      + '<div class="pmast-right"><span class="tag">家长模式</span>'
      + '<div class="prow">'
      + '<button class="pback" data-account>账号</button>'
      + '<button class="pback" data-kid>← 孩子端</button>'
      + '</div></div>'
      + '</div></div>'
      + (Account.kids().length>1
        ? '<div class="pkids"><span class="mono dim">当前孩子</span>'
          + Account.kids().map(k=>'<button class="mini'+(k.id===Account.activeId()?' on':'')+'" data-pkid="'
            + k.id+'">'+esc(k.name||'小侦探')+'</button>').join('')
          + '</div>'
        : '')
      + '<div class="pnav">'
      + '<button data-ptab="dash" class="'+(tab==='dash'?'on':'')+'">能力看板</button>'
      + '<button data-ptab="advice" class="'+(tab==='advice'?'on':'')+'">行动建议</button>'
      + '<button data-ptab="log" class="'+(tab==='log'?'on':'')+'">练习记录</button>'
      + '</div>'
      + body;

    app.querySelectorAll('[data-ptab]').forEach(b=>{
      b.onclick = ()=>render(b.getAttribute('data-ptab'));
    });
    app.querySelectorAll('[data-kid]').forEach(b=>{
      b.onclick = ()=>window.App.goChild();
    });
    app.querySelectorAll('[data-account]').forEach(b=>{
      b.onclick = ()=>window.App.goMy();
    });
    app.querySelectorAll('[data-open]').forEach(el=>{
      el.onclick = ()=>window.CaseView.open(el.getAttribute('data-open'));
    });
    app.querySelectorAll('[data-pkid]').forEach(b=>{
      b.onclick = ()=>{ Account.switchKid(b.getAttribute('data-pkid')); dimFilter = null; render(tab); };
    });
    /* 能力看板的“查看依据”：跳到练习记录，并只看这一维度 */
    app.querySelectorAll('[data-dim]').forEach(b=>{
      b.onclick = ()=>{ dimFilter = b.getAttribute('data-dim'); render('log'); };
    });
    app.querySelectorAll('[data-dim-clear]').forEach(b=>{
      b.onclick = ()=>{ dimFilter = null; render('log'); };
    });
    const csvBtn = app.querySelector('[data-csv]');
    if(csvBtn) csvBtn.onclick = ()=>exportCsv(Store.all());
    /* 复制文字版报告：给家长一个能直接转发出去的摘要 */
    const cp = app.querySelector('[data-copy-report]');
    if(cp) cp.onclick = ()=>{
      copyText(summaryText(all, diag)).then(ok=>{
        if(window.UI) UI.toast(ok ? '已复制，可以粘贴给家人或老师' : '复制失败，请改用导出 CSV');
      });
    };

    const clr = app.querySelector('[data-clear]');    if(clr) clr.onclick = ()=>{
      UI.confirm({kicker:'清空记录', title:'清空当前孩子的全部练习记录？',
        body:'清空后家长报告、能力诊断与错题本都会归零，无法恢复。',
        okText:'清空', danger:true}).then(ok=>{
        if(!ok) return;
        Store.clear();
        render(tab);
        UI.toast('已清空当前孩子的记录');
      });
    };

    const mEl = app.querySelector('[data-model]'), mPill = app.querySelector('[data-model-pill]');
    if(mEl && window.Model){
      Model.ping().then(r=>{
        mEl.textContent = r.ok ? r.label : '本地规则（未连接外部模型）';
        if(mPill){ mPill.textContent = r.ok ? '已连接' : '本地'; mPill.className = 'pill '+(r.ok?'ok':''); }
      });
    }else if(mEl){
      mEl.textContent = '本地规则';
    }

    /* 语音识别通道：有服务端就显示已连接，没有就如实说明是浏览器降级 */
    const sEl = app.querySelector('[data-stt]'), sPill = app.querySelector('[data-stt-pill]');
    fetch('/api/stt', {cache:'no-store'})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(d=>{
        if(sEl) sEl.textContent = d.ok ? ('服务端识别 · '+(d.model||'已配置')) : '浏览器识别（可能依赖在线服务）';
        if(sPill){
          sPill.textContent = d.ok ? '已连接' : '降级';
          sPill.className = 'pill '+(d.ok?'ok':'');
        }
      })
      .catch(()=>{
        if(sEl) sEl.textContent = '浏览器识别（未检测到服务端）';
        if(sPill){ sPill.textContent = '降级'; sPill.className = 'pill'; }
      });

    /* 模型接入：读的是本机服务端配置，Key 只回传掩码 */
    const note = app.querySelector('[data-mc-note]');
    const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const fillConf = d=>{
      if(!d) return;
      const b = document.getElementById('mc-base'), m = document.getElementById('mc-model');
      if(b && !b.value) b.value = d.base || '';
      if(m && !m.value) m.value = d.model || '';
      if(note) note.textContent = d.configured
        ? '当前：'+(d.model||'模型')+' · Key '+(d.key||'已配置')
          +(d.source==='local' ? '（家长配置）' : '（本机预置）')
        : '当前未配置外部模型，判分使用本地规则。';
    };
    /* 本机预览有 server.py 提供的配置接口；线上 Pages 没有，Key 由部署环境统一配置 */
    const host = location.hostname;
    const isLocal = !host || host==='localhost' || host==='127.0.0.1'
      || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    fetch('/api/model-config', {cache:'no-store'})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(fillConf)
      .catch(()=>{
        if(note) note.textContent = isLocal
          ? '没有连上本机服务，判分使用本地规则；用 python server.py 启动后可在此配置。'
          : '线上版由部署环境统一配置模型（环境变量 LLM_API_KEY），这里不用填 Key；模型不可用时自动回退本地规则。';
        if(!isLocal){
          app.querySelectorAll('#mc-base,#mc-model,#mc-key,[data-mc-test],[data-mc-save]')
            .forEach(el=>{ el.disabled = true; });
        }
      });

    const collect = ()=>({base:val('mc-base'), model:val('mc-model'), key:val('mc-key')});
    const save = app.querySelector('[data-mc-save]');
    if(save) save.onclick = async()=>{
      save.disabled = true;
      try{
        const r = await fetch('/api/model-config', {method:'POST',
          headers:{'Content-Type':'application/json'}, body:JSON.stringify(collect())});
        const d = await r.json();
        if(!r.ok) throw new Error(d.error || ('HTTP '+r.status));
        const k = document.getElementById('mc-key'); if(k) k.value = '';
        fillConf(d);
        if(note) note.textContent = '已保存。下一次作答就会使用这个模型。';
        if(mPill){ mPill.textContent = '已连接'; mPill.className = 'pill ok'; }
      }catch(e){
        if(note) note.textContent = '保存失败：'+e.message;
      }finally{ save.disabled = false; }
    };
    const test = app.querySelector('[data-mc-test]');
    if(test) test.onclick = async()=>{
      test.disabled = true;
      if(note) note.textContent = '正在连接…';
      try{
        const r = await fetch('/api/model-test', {method:'POST',
          headers:{'Content-Type':'application/json'}, body:JSON.stringify(collect())});
        const d = await r.json();
        if(!r.ok || !d.ok) throw new Error(d.error || ('HTTP '+r.status));
        if(note) note.textContent = '连接成功：'+(d.model||'模型')+' · '+d.ms+'ms · 回复「'+(d.reply||'')+'」';
      }catch(e){
        if(note) note.textContent = '连接失败：'+e.message;
      }finally{ test.disabled = false; }
    };
    /* 标签切换不再盖品牌页，避免每次都闪一下 */
    window.scrollTo(0, same ? keepY : 0);
  }

  window.ParentView = {render};
})();
