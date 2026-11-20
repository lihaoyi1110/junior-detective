/* ==========================================================
   应用外壳 · 登录 / 声明 / 孩子端 / 我的
   孩子端与家长端是同一份记录的两个视角：路由由 Account 决定。
   ========================================================== */
(function(){
  const S = {tab:'home', gate:null, ft:'全部', fl:0, fg:'全部', fopen:false, gopen:{}};

  /* 社徽：盾形徽章里放一副算盘的局部——上梁下框、三根竖档、三颗珠。
     珠子从左下往右上错开一格，就是“把题拆成一小步一小步往上走”；
     用算盘而不是放大镜，避免所有侦探产品都长一个样。
     黄铜渐变让徽章在深绿底上有金属感；竖档与内轮廓只在 40px 以上看得清，
     28px 时留下的是盾、梁与三颗珠。 */
  const LOGO_MARK = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">'
    + '<defs><linearGradient id="jd-brass" x1="12%" y1="6%" x2="88%" y2="94%">'
    + '<stop offset="0" stop-color="#F4E2B4"/><stop offset=".46" stop-color="#D8B063"/>'
    + '<stop offset="1" stop-color="#8E6522"/></linearGradient></defs>'
    + '<path d="M32 6.4 50.9 12.4V31.9C50.9 43.1 42.9 51.9 32 56.9 21.1 51.9 13.1 43.1 13.1 31.9V12.4Z"'
    + ' fill="rgba(216,176,99,.05)" stroke="url(#jd-brass)" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M32 11 46.8 15.7V31.6C46.8 40.6 40.4 48 32 52.2 23.6 48 17.2 40.6 17.2 31.6V15.7Z"'
    + ' fill="none" stroke="#F0DCA9" stroke-width=".7" opacity=".34" stroke-linejoin="round"/>'
    + '<path d="M22.6 25.5h18.8M22.6 41.5h18.8" stroke="url(#jd-brass)" stroke-width="1.2"'
    + ' stroke-linecap="round"/>'
    + '<path d="M25.6 25.5v16M32 25.5v16M38.4 25.5v16" stroke="#E8CD93" stroke-width=".7"'
    + ' opacity=".42" stroke-linecap="round"/>'
    + '<circle cx="25.6" cy="36.6" r="2.6" fill="url(#jd-brass)"/>'
    + '<circle cx="32" cy="32.6" r="2.6" fill="url(#jd-brass)"/>'
    + '<circle cx="38.4" cy="28.6" r="2.6" fill="url(#jd-brass)"/>'
    + '</svg>';

  /* 登录页两张身份卡：换成同一套细线图标，避免文字符号基线不齐 */
  const ICON_CHILD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M7 3.5h7l3.5 3.5V20a.9.9 0 0 1-.9.9H7A.9.9 0 0 1 6.1 20V4.4A.9.9 0 0 1 7 3.5Z"/>'
    + '<path d="M13.8 3.6V7.3h3.6M9 12.5h6M9 16h4"/></svg>';
  const ICON_PARENT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
    + ' stroke-linecap="round" aria-hidden="true">'
    + '<path d="M4 19.5v-5.5M9.3 19.5V5.5M14.6 19.5v-8M19.9 19.5V8.5"/></svg>';
  const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>';

  const SOLVED = () => new Set(Store.all().map(s=>s.caseId));

  function esc(s){
    return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function day(ts){
    const d = new Date(ts || Date.now());
    return d.getFullYear()+' 年 '+(d.getMonth()+1)+' 月 '+d.getDate()+' 日';
  }
  function kv(k, v){
    return '<div class="kv"><span>'+k+'</span><b>'+v+'</b></div>';
  }

  const dimName = k => { const d = DIMS.find(x=>x.key===k); return d ? d.name : '综合'; };

  /* 错题本：把每次卡住或判偏的那一步按案卷+步骤去重，只留最近一次 */
  function wrongOf(all){
    const map = new Map();
    all.forEach(s=>{
      (s.log||[]).forEach((l,i)=>{
        if(!(l.fails>0 || l.mis)) return;
        const c = CASES.find(x=>x.id===s.caseId);
        if(!c || !c.steps[i]) return;
        const key = s.caseId + '#' + i;
        const prev = map.get(key);
        if(prev && prev.ts > s.ts) return;
        map.set(key, {c, step:c.steps[i], ts:s.ts, fails:l.fails||0, mis:l.mis||'',
          said:l.said||'', firstWrong:l.firstWrong||null});
      });
    });
    return Array.from(map.values()).sort((a,b)=>b.ts-a.ts);
  }

  function levelDots(l){
    let s = '<span class="level">';
    for(let i=1;i<=3;i++) s += '<i class="'+(i<=l?'on':'')+'"></i>';
    return s + '</span>';
  }

  function mast(title, sub, right, rs){
    return '<div class="masthead"><div class="mast-row">'
      + '<div class="crest">'+LOGO_MARK+'</div>'
      + '<div><div class="mast-title">'+title+'</div><div class="mast-sub">'+sub+'</div></div>'
      + (right != null ? '<div class="mast-right"><b>'+right+'</b><span>'+rs+'</span></div>' : '')
      + '</div></div><div class="tartan thin"></div>';
  }

  /* 只在页头下方承担“我在哪 / 有多少卷”的说明 */
  function dualbar(left, right){
    return '<div class="dualbar"><span class="mono dim">'+left+'</span>'
      + '<span class="mono dim">'+right+'</span></div>';
  }

  /* 底部图标用细线 SVG：字符图标在手机上又小又难认 */
  const TAB_ICO = {
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.6"/><path d="M15.4 15.4 20.5 20.5"/></svg>',
    profile:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.8l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.1-4 5.7-.8z"/></svg>',
    my:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20c.7-3.5 3.7-5.8 7.2-5.8s6.5 2.3 7.2 5.8"/></svg>'
  };
  function tabbar(on){
    const t = (k,label)=>'<button data-tab="'+k+'" class="'+(on===k?'on':'')+'">'
      + '<span class="ico">'+TAB_ICO[k]+'</span>'+label+'</button>';
    return '<nav class="tabbar">'+t('home','案卷')+t('profile','档案')+t('my','我的')+'</nav>';
  }

  /* ---------------- 一 · 登录：先确定这台设备给谁用 ---------------- */
  function login(){
    const g = GRADES.length
      ? GRADES[0].replace('年级','')+'～'+GRADES[GRADES.length-1].replace('年级','')+'年级'
      : '三～六年级';
    return '<div class="wel login">'
      + '<div class="wel-cover">'
      + '<div class="wel-brand">'
      + '<span class="brand-mark">'+LOGO_MARK+'</span>'
      + '<div class="wel-brandtext">'
      + '<div class="wel-kicker">JUNIOR DETECTIVE BUREAU</div>'
      + '<h1 class="wel-title">少年侦探社</h1>'
      + '</div></div>'
      + '<p class="wel-manifesto">不给答案，<br>只问对下一个问题。</p>'
      + '<p class="wel-lead">数学题不会做，往往是卡在某一句。华生不替你算，只把题拆成一个个能回答的小问题，答案由你自己走到。</p>'
      + '<div class="wel-steps">'
      + '<span><b>01</b>挑一卷案卷</span>'
      + '<span><b>02</b>说出你的想法</span>'
      + '<span><b>03</b>自己走到答案</span>'
      + '</div>'
      + '<div class="wel-stats">'
      + '<span><b>'+CASES.length+'</b>份案卷</span>'
      + '<span><b>'+TYPES.length+'</b>种题型</span>'
      + '<span><b>'+g+'</b></span>'
      + '</div></div>'

      + '<div class="wel-panel">'
      + '<div class="wel-panelhead"><span>从这里开始</span><span>两端共用一份记录</span></div>'
      + '<button class="rolecard" data-sign="child">'
      + '<span class="rc-ico">'+ICON_CHILD+'</span>'
      + '<span class="rc-main"><b>我是小侦探</b><span>挑案卷 · 答题 · 收徽章</span></span>'
      + '<span class="rc-arrow">'+ICON_ARROW+'</span></button>'
      + '<button class="rolecard parent" data-sign="parent">'
      + '<span class="rc-ico">'+ICON_PARENT+'</span>'
      + '<span class="rc-main"><b>我是家长</b><span>看能力报告 · 拿陪练建议</span></span>'
      + '<span class="rc-arrow">'+ICON_ARROW+'</span></button>'
      + '<p class="wel-legal">练习记录只保存在这台设备，不同步云端<br>'
      + '未满 14 周岁，请由监护人阅读声明后代为同意</p>'
      + '</div>'
      + '</div>';
  }

  /* ---------------- 二 · 声明：同意前把边界讲清楚 ---------------- */
  function consent(acc, readonly){
    const child = acc.role!=='parent';
    const items = [
      ['记录什么',
       '每一道题里，<b>你写的那句回答</b>、有没有点提示、要不要重来，以及你选了哪一类理解偏差。不录音、不录像，也不读取设备里的其他内容。'],
      ['存在哪里',
       '全部写在这台设备的浏览器本地存储里。换设备、清理浏览器数据或卸载都会丢；<b>当前版本不同步到云端，服务器不保存练习记录</b>。'],
      ['判分时会发出什么',
       '开启外部模型判分时，只有<b>当前这一步的作答文字</b>、题目本身和最近几句对话会发到本应用的判分接口，用来判断理解是否正确；不发送姓名与身份。模型不可用时，全部在本机按规则判断。'],
      ['谁能看到',
       '孩子端只能看到自己的档案；<b>能力报告与陪练建议只在家长端</b>，需要从「我的」里交给家长打开。']
    ];

    const body = items.map((x,i)=>'<div class="citem"><span class="cnum">'+['一','二','三','四'][i]+'</span>'
      + '<div><b>'+x[0]+'</b><p>'+x[1]+'</p></div></div>').join('');

    const agreed = readonly || !!acc.consentAt;

    return '<div class="wel">'
      + '<div class="wel-top">'
      + '<div class="wel-crest">'+LOGO_MARK+'</div>'
      + '<div class="wel-kicker">'+(child ? 'GUARDIAN NOTICE' : 'DATA & PRIVACY')+'</div>'
      + '<h1 class="wel-title">开始前，先说清楚</h1>'
      + '<p class="wel-sub">'+(child
          ? '这几条请由监护人阅读。同意之后才会开始记录。'
          : '以下是这份报告背后的数据来源与边界。')+'</p>'
      + body
      + '</div>'
      + '<button class="agree'+(agreed?' on':'')+'"'+(readonly?' disabled':' data-agree')+'>'
      + '<i></i><span>'+(child
          ? '我已阅读上述说明，并同意按此方式记录；若使用者未满 14 周岁，本同意由监护人作出。'
          : '我已阅读上述说明，并同意按此方式查看与使用这些记录。')+'</span></button>'
      + (readonly
          ? '<button class="btn" data-back>知道了，返回</button>'
          : '<button class="btn" data-consent disabled>同意并继续</button>'
            + '<button class="btn ghost" data-signout>换一个身份</button>')
      + '<p class="wel-foot">'+(readonly ? '声明 · 已同意于 '+day(acc.consentAt)
          : (child ? '孩子端 · 待同意' : '家长端 · 待确认'))+'</p>'
      + '</div>';
  }

  /* ---------------- 三 · 家长入口：给孩子端一个明确的交接动作 ---------------- */
  function gate(acc){
    const n = Store.all().length;
    return '<div class="wel">'
      + '<div class="wel-top">'
      + '<div class="wel-crest">'+ICON_PARENT+'</div>'
      + '<div class="wel-kicker">PARENT ACCESS</div>'
      + '<h1 class="wel-title">接下来是给家长看的</h1>'
      + '<p class="wel-sub">这一页是孩子的能力判断与陪练建议，孩子端不显示。交接时不改变任何作答记录。</p>'
      + '<div class="citem"><span class="cnum">·</span><div><b>基于本机记录</b>'
      + '<p>共 <b>'+n+'</b> 次练习，全部来自这台设备。</p></div></div>'
      + '<div class="citem"><span class="cnum">·</span><div><b>先看范围，再看分数</b>'
      + '<p>分数反映在本应用里的提示依赖程度，不等同于考试成绩，也不构成能力测评。</p></div></div>'
      + '</div>'
      + '<button class="btn" data-open-parent>我是家长，进入 →</button>'
      + '<button class="btn ghost" data-back>返回孩子端</button>'
      + '<p class="wel-foot">家长端 · '+esc(Account.name())+' 的记录</p>'
      + '</div>';
  }

  /* 未结案卷的本机进度：只在票根上标一句“答到第几问”，点开就会自动续答 */
  function resumeMap(){
    try{
      const o = JSON.parse(localStorage.getItem(Store.key + '_resume_' + Store.id()) || 'null');
      return (o && typeof o === 'object') ? o : {};
    }catch(e){ return {}; }
  }

  /* ---------------- 案卷大厅 ---------------- */
  function card(c, solved, resumes){
    const done = solved.has(c.id);
    const r = resumes && resumes[c.id];
    const pending = !done && r && r.caseId === c.id && (r.i > 0 || (r.msgs && r.msgs.length > 2));
    return '<article class="ticket" data-case="'+c.id+'">'
      + '<div class="ticket-top"><span class="mono dim">'+c.no+'</span>'+levelDots(c.level)+'</div>'
      + '<h2>'+c.title+'</h2>'
      + '<p class="stem">'+c.stem+'</p>'
      + '<div class="chips-row"><span class="mini on">'+c.type+'</span>'
      + c.tags.slice(0,2).map(t=>'<span class="mini">'+t+'</span>').join('')+'</div>'
      + '<div class="ticket-foot"><span class="mono dim">'+c.grade+' · '+c.steps.length+' 问 · 约 '+c.minutes+' 分钟</span>'
      + (done ? '<span class="pill ok">已勘</span>'
              : (pending ? '<span class="pill">答到 '+(r.i+1)+'/'+c.steps.length+'</span>'
                         : '<span class="pill">未勘</span>'))
      + '</div></article>';
  }

  /* 按年级分组，组内按难度、编号排序；没有年级的兜底归入“其他” */
  function groupByGrade(list){
    const keyOf = c => GRADES.indexOf(c.grade) > -1 ? c.grade : '其他';
    const groups = [];
    list.forEach(c=>{
      let g = groups.find(x=>x.grade===keyOf(c));
      if(!g){ g = {grade:keyOf(c), items:[]}; groups.push(g); }
      g.items.push(c);
    });
    const rank = g => g==='其他' ? 99 : GRADES.indexOf(g);
    groups.sort((a,b)=>rank(a.grade)-rank(b.grade));
    groups.forEach(g=>g.items.sort((a,b)=>a.level-b.level || (a.no<b.no?-1:1)));
    return groups;
  }

  function home(){
    const solved = SOLVED();
    const resumes = resumeMap();
    const list = CASES.filter(c => (S.ft==='全部' || c.type===S.ft)
      && (!S.fl || c.level===S.fl)
      && (S.fg==='全部' || c.grade===S.fg));
    const types = ['全部'].concat(TYPES);

    const chips = types.map(t=>'<button class="mini'+(S.ft===t?' on':'')+'" data-ft="'+t+'">'+t+'</button>').join('');
    const lv = [0,1,2,3].map(l=>'<button class="mini'+(S.fl===l?' on':'')+'" data-fl="'+l+'">'
      + (l?'L'+l:'不限')+'</button>').join('');
    const grades = ['全部'].concat(GRADES);
    const gr = grades.map(g=>'<button class="mini'+(S.fg===g?' on':'')+'" data-fg="'+g+'">'+g+'</button>').join('');
    const filtering = S.ft!=='全部' || S.fl!==0 || S.fg!=='全部';
    /* 默认收起：首屏先看见案卷；一旦有筛选条件就自动展开，摘要留在标题行 */
    const opened = S.fopen || filtering;
    const active = [S.fg!=='全部'?S.fg:'', S.ft!=='全部'?S.ft:'', S.fl?'L'+S.fl:'']
      .filter(Boolean).join(' · ');

    /* 每组先摆 3 卷：46 张票根一次铺满会让首屏失去重点，其余按需展开 */
    const GROUP_SHOW = 3;
    const tickets = groupByGrade(list).map(g=>{
      const unfolded = !!S.gopen[g.grade];
      const open = unfolded || filtering;
      const show = open ? g.items : g.items.slice(0, GROUP_SHOW);
      const rest = g.items.length - show.length;
      return '<div class="grade-head" data-fg="'+g.grade+'">'
        + '<span class="gh-name">'+g.grade+'</span><span class="gh-line"></span>'
        + '<span class="mono dim">'+g.items.length+' 卷</span></div>'
        + show.map(c=>card(c, solved, resumes)).join('')
        + (rest>0 ? '<button class="grade-more" data-grade="'+g.grade+'">展开本组其余 '+rest+' 卷 ↓</button>' : '')
        + (unfolded && !filtering ? '<button class="grade-more" data-grade="'+g.grade+'">收起本组 ↑</button>' : '');
    }).join('');

    /* 有半卷没答完时，先给一个“接着上次”的入口：不必在 46 张票根里找 */
    const pending = Object.keys(resumes)
      .map(id=>({id, r:resumes[id], c:CASES.find(x=>x.id===id)}))
      .filter(x=>x.c && !solved.has(x.id) && x.r && x.r.caseId===x.id
        && (x.r.i > 0 || (x.r.msgs && x.r.msgs.length > 2)))
      .sort((a,b)=>((b.r.ts)||0)-((a.r.ts)||0))[0];
    const cont = pending
      ? '<button class="cont-card" data-case="'+pending.c.id+'">'
        + '<span class="cont-k">接着上次</span>'
        + '<span class="cont-main"><b>'+pending.c.title+'</b>'
        + '<span>停在第 '+(pending.r.i+1)+' / '+pending.c.steps.length+' 问 · 进度还在</span></span>'
        + '<span class="cont-go">接着答 →</span></button>'
      : '';

    return mast('少年侦探社','JUNIOR DETECTIVE BUREAU', solved.size, '已破案卷')
      + dualbar('孩子端 · 案卷大厅', '按年级分组 · 每卷 5–6 问')
      + '<div class="page">'
      + '<div class="eyebrow">今日委托 · 数学疑案</div>'
      + '<h1 class="title">案卷都在桌上，<br>挑一个开始。</h1>'
      + '<p class="lead">我是华生：不给答案，只问对下一个问题。挑一卷，从你看到的说起。</p>'
      + cont
      + '<div class="filters'+(opened?'':' closed')+'">'
      + '<div class="filters-head"'+(filtering?'':' data-fopen role="button" tabindex="0"')+'>'
      + '<span class="mono">'+(filtering ? '筛选 · '+active : '筛选 · 年级 / 题型 / 难度')+'</span>'
      + (filtering
          ? '<button class="linkbtn danger" data-clear-filter>清除筛选</button>'
          : '<span class="filters-toggle">'+(opened?'收起 ▴':'展开 ▾')+'</span>')
      + '</div>'
      + (opened
          ? '<div class="lvrow"><span class="mono dim">年级</span>'
            + '<div class="chips-row">'+gr+'</div></div>'
            + '<div class="lvrow"><span class="mono dim">题型</span>'
            + '<div class="chips-row typechips">'+chips+'</div></div>'
            + '<div class="lvrow"><span class="mono dim">难度</span>'
            + '<div class="chips-row">'+lv+'</div></div>'
          : '')
      + '</div>'
      + (tickets || '<div class="empty"><b>这个抽屉是空的</b>换个年级、题型或难度看看。</div>')
      + '<p class="footnote">三～六年级 · L1 入门 / L2 进阶 / L3 挑战 · 每卷 5–6 问</p>'
      + '</div>'
      + tabbar('home');
  }

  /* ---------------- 我的档案 ---------------- */
  function profile(){
    const all = Store.all();
    const diag = Engine.diagnose(all);
    const indep = all.reduce((a,s)=>a+(s.independent||0),0);
    const steps = all.reduce((a,s)=>a+(s.total||0),0);
    const daySet = new Set(all.map(s=>new Date(s.ts).toDateString()));
    const solved = SOLVED();
    /* “破案”按不同案卷计，不把重复练习算成新案子 */
    const solvedN = solved.size;

    const rank = solvedN>=CASES.length ? '首席侦探'
      : (solvedN>=6 ? '正式侦探' : (solvedN>=3 ? '见习侦探' : '助手'));
    const next = solvedN>=CASES.length ? '全部案卷已勘完'
      : (solvedN>=6 ? '再破 '+(CASES.length-solvedN)+' 个案卷，升「首席侦探」'
        : '再破 '+(6-solvedN)+' 个案卷，升「正式侦探」');

    const badges = [];
    CASES.forEach(c=>{ if(solved.has(c.id)) c.tags.forEach(t=>{ if(badges.indexOf(t)<0) badges.push(t); }); });
    const badgeHtml = badges.length
      ? badges.map(t=>'<span class="mini on">'+t+'</span>').join('')
      : '<p class="pnote">破第一个案子，就能拿到第一枚徽章。</p>';

    const recent = all.slice().sort((a,b)=>b.ts-a.ts).slice(0,3).map(s=>{
      const c = CASES.find(x=>x.id===s.caseId); if(!c) return '';
      return '<div class="recrow" data-case="'+c.id+'"><span class="mono dim">'+c.no+'</span>'
        + '<div><b>'+c.title+'</b><span>'+c.type+' · 独立 '+s.independent+'/'+s.total+'</span></div>'
        + '<span class="pill '+(s.independent===s.total?'ok':'')+'">'+(s.independent===s.total?'满分':'再看')+'</span></div>';
    }).join('');

    const wrong = wrongOf(all);
    const wrongHtml = wrong.length
      ? wrong.slice(0,4).map(w=>{
          const fw = w.firstWrong || {};
          const said = String(fw.said || w.said || '').trim();
          const reply = String(fw.reply || '').trim() || (w.step.say || []).join(' ');
          return '<article class="wcard" data-case="'+w.c.id+'">'
            + '<div class="wcard-top"><span class="mono dim">'+w.c.no+' · '+dimName(w.step.dim)
            + ' · '+w.step.tag+'</span><span class="pill">重练 →</span></div>'
            + '<div class="wline ask"><span class="mono">华生问</span><div class="txt">'+w.step.q+'</div></div>'
            + (said ? '<div class="wline said"><span class="mono">你答</span><div class="txt">'+esc(said)+'</div></div>' : '')
            + (reply ? '<div class="wline back"><span class="mono">华生说</span><div class="txt">'+reply+'</div></div>' : '')
            + '</article>';
        }).join('')
      : '<p class="pnote">这几次练习里没有卡住的步骤。想再往上走，可以挑 L3 的案卷。</p>';

    const empty = all.length === 0;
    const lead = empty
      ? '还没有勘过案卷。第一份委托在案卷大厅等着。'
      : rank+' · 已经和搭档华生一起破了 '+solvedN+' 个案卷。';

    return mast('我的侦探档案','MY DETECTIVE FILE', solvedN, '已破案卷')
      + dualbar('孩子端 · 侦探档案', '记录仅存本机')
      + '<div class="page">'
      + '<div class="eyebrow">档案 · DETECTIVE FILE</div>'
      + '<h1 class="title">'+esc(Account.name())+'</h1>'
      + '<p class="lead">'+lead+'</p>'
      + '<div class="orn"><i></i></div>'
      + '<div class="kpis">'
      + '<div class="kpi"><b>'+solvedN+'</b><span>破案</span><small>'+next+'</small></div>'
      + '<div class="kpi"><b>'+(empty?'—':indep+'/'+steps)+'</b><span>独立步骤</span><small>'
      + (empty?'完成一次后统计':'没靠提示')+'</small></div>'
      + '<div class="kpi"><b>'+daySet.size+'</b><span>探案天数</span><small>'
      + (empty?'从第一份开始':'今天也来了')+'</small></div>'
      + '</div>'
      + (empty
        ? '<div class="card taped empty-state"><div class="card-h"><h3>档案还是空的</h3>'
          + '<span class="hint">0 次练习</span></div>'
          + '<p class="pnote">完成一份案卷（五到六问），这里就会出现能力星图、第一枚徽章和最近的案子。</p>'
          + '<p class="pnote">星图回答的是「哪一步需要提示」，不是排名或分数。</p></div>'
        : '<div class="card taped"><div class="card-h"><h3>能力星图</h3><span class="hint">越靠外越稳</span></div>'
          + Charts.radar(diag.dims)
          + '<p class="pnote">短的那一角，就是下一个要练的地方。</p></div>'
          + '<div class="card"><div class="card-h"><h3>侦探徽章</h3><span class="hint">'+badges.length+' 枚</span></div>'
          + '<div class="chips-row">'+badgeHtml+'</div></div>'
          + '<div class="card"><div class="card-h"><h3>错题本</h3><span class="hint">'
          + (wrong.length ? wrong.length+' 处待复习' : '暂无')+'</span></div>'+wrongHtml+'</div>'
          + '<div class="card"><div class="card-h"><h3>最近的案子</h3><span class="hint">点开重看</span></div>'
          + recent + '</div>')
      + '<p class="footnote">更细的能力报告，在「我的」里交给家长查看</p>'
      + '</div>'
      + tabbar('profile');
  }

  /* ---------------- 我的：账号、切换端、数据 ---------------- */
  function my(acc){
    const isParent = acc.role==='parent';
    const all = Store.all();
    const mode = (window.Theme && Theme.mode()) || 'auto';
    const fxOn = !window.Fx || Fx.enabled();

    const head = isParent
      ? '<div class="pmast"><div class="row"><div><h1>账号与数据</h1>'
        + '<div class="date">家长端 · 本机账号 · 不被同步</div></div>'
        + '<div class="pmast-right"><span class="tag">家长模式</span>'
        + '<div class="prow"><button class="pback" data-pback>← 返回报告</button></div>'
        + '</div></div></div>'
      : mast('我的','ACCOUNT & DATA')
        + dualbar('孩子端 · 账号与数据', '记录存在本机');

    return head
      + '<div class="page">'
      + '<div class="eyebrow">账号 · ACCOUNT</div>'
      + '<h1 class="title">'+esc(Account.name())+'</h1>'
      + '<p class="lead">'+(isParent?'家长端':'孩子端')+' · 已加入 '+day(acc.createdAt)+'</p>'
      + '<div class="orn"><i></i></div>'

      + '<div class="card"><div class="card-h"><h3>昵称</h3><span class="hint">只存在这台设备</span></div>'
      + '<div class="namerow"><input id="acc-name" maxlength="12" value="'+esc(Account.name())+'" placeholder="给孩子取个代号">'
      + '<button class="btn sm" data-rename>保存</button></div>'
      + '<p class="pnote">报告抬头用的是这个昵称，不必填真名。</p></div>'

      + '<div class="card"><div class="card-h"><h3>这台设备上的孩子</h3><span class="hint">'
      + Account.kids().length+' 位</span></div>'
      + '<div class="chips-row">'+Account.kids().map(k=>'<button class="mini'
        + (k.id===Account.activeId()?' on':'')+'" data-kid-switch="'+k.id+'">'
        + esc(k.name||'小侦探')+'</button>').join('')+'</div>'
      + '<div class="namerow"><input id="new-kid" maxlength="12" placeholder="新孩子的代号">'
      + '<button class="btn sm" data-add-kid>添加</button></div>'
      + '<p class="pnote">每位孩子的档案、星图与练习记录分开保存；切换后，报告也会跟着切换。</p></div>'

      + '<div class="card"><div class="card-h"><h3>界面与反馈</h3><span class="hint">只影响这台设备</span></div>'
      + kv('夜间模式', '<span class="seg">'
          + '<button data-theme-set="auto" class="'+(mode==='auto'?'on':'')+'">跟随系统</button>'
          + '<button data-theme-set="light" class="'+(mode==='light'?'on':'')+'">日间</button>'
          + '<button data-theme-set="dark" class="'+(mode==='dark'?'on':'')+'">夜间</button></span>')
      + kv('答题音效与震动', '<button class="mini" data-fx>'+(fxOn?'已开启':'已关闭')+'</button>')
      + '</div>'

      + '<div class="card"><div class="card-h"><h3>档案备份</h3><span class="hint">换手机时用</span></div>'
      + '<p class="pnote">导出一个 JSON 文件，包含这台设备上全部孩子的练习记录与代号；在新设备导入即可合并，不会上传云端。</p>'
      + '<div class="mc-actions"><button class="btn sm ghost" data-export>导出档案</button>'
      + '<button class="btn sm" data-import>导入档案</button></div>'
      + '<input type="file" id="import-file" accept="application/json,.json" hidden>'
      + '<p class="pnote">导入按时间合并、自动跳过重复记录，不会删除本机已有内容。</p></div>'

      + '<div class="card"><div class="card-h"><h3>账号状态</h3><span class="hint">本机账号</span></div>'
      + kv('当前身份', isParent ? '家长端' : '孩子端')
      + kv('当前孩子', esc(Account.name()))
      + kv('孩子档案', Account.kids().length+' 位')
      + kv('加入时间', day(acc.createdAt))
      + kv('声明同意', day(acc.consentAt))
      + kv('练习记录', all.length+' 次')
      + kv('存储位置', '本机浏览器')
      + '</div>'

      + '<div class="card"><div class="card-h"><h3>另一端</h3><span class="hint">'
      + (isParent?'把手机还给孩子':'给家长')+'</span></div>'
      + (isParent
        ? '<p class="pnote">孩子端能看到案卷、档案与徽章，看不到这份报告。</p>'
          + '<button class="btn ghost" data-kid>回到孩子端 →</button>'
        : '<p class="pnote">家长端是能力报告与陪练建议。孩子端看不到这部分内容，也需要家长在那边打开。</p>'
          + '<button class="btn ghost" data-gate>把手机交给家长 →</button>')
      + '</div>'

      + '<div class="card"><div class="card-h"><h3>数据与隐私</h3><span class="hint">随时可查</span></div>'
      + '<button class="linkbtn" data-consent-view>重看声明（同意于 '+day(acc.consentAt)+'）</button>'
      + '<button class="linkbtn danger" data-clear>清空当前孩子的练习记录</button>'
      + '<button class="linkbtn danger" data-signout>退出账号</button>'
      + '<p class="pnote">退出只清除身份与同意记录，孩子档案与练习记录留在本机；清空记录只影响当前孩子，无法恢复。</p>'
      + '</div>'

      + '<p class="footnote">账号与记录都只在这台设备 · 换设备不会同步</p>'
      + '</div>'
      + (isParent ? '' : tabbar('my'));
  }

  /* ---------------- 绑定 ---------------- */
  function bind(){
    const app = document.getElementById('app');

    app.querySelectorAll('[data-tab]').forEach(b=>{
      b.onclick = ()=>{ S.tab = b.getAttribute('data-tab'); S.gate = null; render(); };
    });

    app.querySelectorAll('[data-sign]').forEach(b=>{
      b.onclick = ()=>{
        Account.sign(b.getAttribute('data-sign'));
        S.tab = 'home'; S.gate = null;
        render();
      };
    });

    const ag = app.querySelector('[data-agree]');
    if(ag){
      ag.onclick = ()=>{
        const on = ag.classList.toggle('on');
        const go = app.querySelector('[data-consent]');
        if(go) go.disabled = !on;
      };
    }
    const cs = app.querySelector('[data-consent]');
    if(cs) cs.onclick = ()=>{
      Account.consent();
      S.tab = 'home'; S.gate = null;
      render();
    };

    app.querySelectorAll('[data-signout]').forEach(b=>{
      b.onclick = ()=>{
        UI.confirm({kicker:'退出账号', title:'返回身份选择？',
          body:'身份与同意记录会清除，孩子档案与练习记录仍留在本机。',
          okText:'退出', danger:true}).then(ok=>{
          if(!ok) return;
          Account.reset();
          S.tab = 'home'; S.gate = null;
          render();
        });
      };
    });

    app.querySelectorAll('[data-back]').forEach(b=>{
      b.onclick = ()=>{ S.gate = null; render(); };
    });

    /* 家长端「我的」回到报告：不能停在 tab=my，否则会原地重渲染 */
    app.querySelectorAll('[data-pback]').forEach(b=>{
      b.onclick = ()=>{ S.gate = null; S.tab = 'home'; render(); };
    });

    const gt = app.querySelector('[data-gate]');
    if(gt) gt.onclick = ()=>{ S.gate = 'gate'; render(); };

    app.querySelectorAll('[data-open-parent]').forEach(b=>{
      b.onclick = ()=>{
        Account.setRole('parent');
        S.tab = 'home'; S.gate = null;
        render();
      };
    });

    app.querySelectorAll('[data-kid]').forEach(b=>{
      b.onclick = ()=>{ App.goChild(); };
    });

    const cv = app.querySelector('[data-consent-view]');
    if(cv) cv.onclick = ()=>{ S.gate = 'consent'; render(); };

    const rn = app.querySelector('[data-rename]');
    if(rn) rn.onclick = ()=>{
      const el = document.getElementById('acc-name');
      const v = (el && el.value || '').trim().slice(0,12);
      if(!v){ if(el){ el.focus(); } return; }
      Account.rename(v);
      render();
    };

    app.querySelectorAll('[data-kid-switch]').forEach(b=>{
      b.onclick = ()=>{
        Account.switchKid(b.getAttribute('data-kid-switch'));
        render();
      };
    });
    const addKid = app.querySelector('[data-add-kid]');
    if(addKid) addKid.onclick = ()=>{
      const el = document.getElementById('new-kid');
      const v = (el && el.value || '').trim().slice(0,12);
      if(!v){ if(el) el.focus(); return; }
      Account.addKid(v);
      render();
    };

    const clr = app.querySelector('[data-clear]');
    if(clr) clr.onclick = ()=>{
      UI.confirm({kicker:'清空记录', title:'清空当前孩子的练习记录？',
        body:'清空后档案、错误本与报告都会归零，无法恢复。',
        okText:'清空', danger:true}).then(ok=>{
        if(!ok) return;
        Store.clear();
        render();
        UI.toast('已清空当前孩子的记录');
      });
    };

    /* 夜间模式：跟随系统 / 日间 / 夜间 */
    app.querySelectorAll('[data-theme-set]').forEach(b=>{
      b.onclick = ()=>{
        const v = b.getAttribute('data-theme-set');
        if(window.Theme) Theme.set(v);
        render({keep:true});
      };
    });
    const fxBtn = app.querySelector('[data-fx]');
    if(fxBtn) fxBtn.onclick = ()=>{
      const on = !(window.Fx && Fx.enabled());
      if(window.Fx){ Fx.set(on); if(on) Fx.tap(); }
      render({keep:true});
      UI.toast(on ? '已开启音效与震动' : '已关闭音效与震动');
    };

    /* 档案备份：导出整个设备，导入时按时间合并 */
    const exp = app.querySelector('[data-export]');
    if(exp) exp.onclick = ()=>{
      const obj = archive();
      const d = new Date();
      const name = '少年侦探社-档案-' + d.getFullYear()
        + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0') + '.json';
      if(downloadJson(name, obj)) UI.toast('已导出 ' + name);
      else UI.toast('导出失败，请检查浏览器下载权限');
    };
    const imp = app.querySelector('[data-import]');
    const file = document.getElementById('import-file');
    if(imp && file){
      imp.onclick = ()=>file.click();
      file.onchange = ()=>{
        const f = file.files && file.files[0];
        if(!f) return;
        const reader = new FileReader();
        reader.onload = ()=>{
          let obj = null;
          try{ obj = JSON.parse(String(reader.result || '')); }catch(e){ obj = null; }
          if(!obj || obj.app !== 'junior-detective'){
            UI.toast('这个文件不是本应用的档案');
            file.value = '';
            return;
          }
          const n = Object.keys(obj.records || {})
            .reduce((s,k)=>s + ((Array.isArray(obj.records[k]) ? obj.records[k].length : 0)), 0);
          UI.confirm({kicker:'导入档案', title:'合并 ' + n + ' 次练习记录？',
            body:'按时间合并，自动跳过重复记录，不会删除本机已有内容。',
            okText:'合并导入'}).then(ok=>{
            if(!ok){ file.value = ''; return; }
            try{
              const r = mergeArchive(obj);
              UI.toast('已合并 ' + r.added + ' 次记录' + (r.dup ? '，跳过重复 ' + r.dup + ' 次' : ''));
              render();
            }catch(err){
              UI.toast(err.message || '导入失败');
            }
            file.value = '';
          });
        };
        reader.readAsText(f);
      };
    }
  }

  function bindChild(app){
    app.querySelectorAll('[data-ft]').forEach(b=>{
      b.onclick = ()=>{ S.ft = b.getAttribute('data-ft'); render(); };
    });
    app.querySelectorAll('[data-fl]').forEach(b=>{
      b.onclick = ()=>{ S.fl = parseInt(b.getAttribute('data-fl'),10); render(); };
    });
    app.querySelectorAll('[data-fg]').forEach(b=>{
      b.onclick = ()=>{ S.fg = b.getAttribute('data-fg'); render(); };
    });
    const ft = app.querySelector('[data-fopen]');
    if(ft){
      const toggle = ()=>{ S.fopen = !S.fopen; render(); };
      ft.onclick = toggle;
      ft.onkeydown = e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); toggle(); } };
    }
    app.querySelectorAll('[data-clear-filter]').forEach(cf=>{
      cf.onclick = ()=>{ S.ft = '全部'; S.fl = 0; S.fg = '全部'; render(); };
    });
    app.querySelectorAll('[data-grade]').forEach(b=>{
      b.onclick = ()=>{
        const g = b.getAttribute('data-grade');
        S.gopen[g] = !S.gopen[g];
        render();
      };
    });
    app.querySelectorAll('[data-case]').forEach(el=>{
      el.onclick = ()=>window.CaseView.open(el.getAttribute('data-case'));
    });
  }

  /* ---------------- 路由 ---------------- */
  /* 记录上一次停留的页面：同一页里的按钮切换保留滚动位置，换页才回到顶部 */
  let lastRoute = '';
  let lastStage = null;
  /* 品牌过渡只在“换身份/换端”时出现：启动、登录 → 首页、孩子端 ↔ 家长端。
     普通换页只做一次轻淡入，不再盖 Logo，避免每点一下就闪一次。 */
  let veilT = null;
  function veil(ms){
    const b = document.getElementById('boot');
    if(b){
      b.classList.remove('off');
      clearTimeout(veilT);
      veilT = setTimeout(()=>b.classList.add('off'), ms == null ? 300 : ms);
    }
    fade();
  }
  function fade(){
    const app = document.getElementById('app');
    if(!app) return;
    app.classList.remove('screen-in');
    void app.offsetWidth;
    app.classList.add('screen-in');
  }
  window.PageVeil = veil;
  window.PageFade = fade;

  function render(opt){
    const app = document.getElementById('app');
    const acc = Account.get();
    const route = [acc.role||'', acc.consentAt?1:0, S.gate||'', S.tab||''].join('|');
    const stay = (opt && opt.keep) || route === lastRoute;
    lastRoute = route;
    const stage = !acc.role ? 'login'
      : (!acc.consentAt ? 'consent' : (acc.role==='parent' ? 'parent' : 'kid'));
    const major = lastStage === null || stage !== lastStage;
    lastStage = stage;
    const keepY = stay
      ? (window.pageYOffset || document.documentElement.scrollTop || 0) : null;
    const settle = ()=>{
      if(!stay){ if(major) veil(320); else fade(); }
      window.scrollTo(0, keepY == null ? 0 : keepY);
    };

    /* 没有身份，或已退出：停在登录页 */
    if(!acc.role){
      app.className = 'welcome';
      app.innerHTML = login();
      bind(); settle(); return;
    }
    /* 有身份但没同意：卡在声明页，不进任何一端 */
    if(!acc.consentAt){
      app.className = 'welcome';
      app.innerHTML = consent(acc, false);
      bind(); settle(); return;
    }
    if(S.gate==='consent'){
      app.className = 'welcome';
      app.innerHTML = consent(acc, true);
      bind(); settle(); return;
    }
    if(S.gate==='gate'){
      app.className = 'welcome';
      app.innerHTML = gate(acc);
      bind(); settle(); return;
    }

    app.className = acc.role==='parent' ? 'parent' : '';

    if(S.tab==='my'){
      app.innerHTML = my(acc);
      bind(); settle(); return;
    }
    if(acc.role==='parent'){
      window.ParentView.render();
      return;
    }

    app.innerHTML = S.tab==='profile' ? profile() : home();
    bind();
    bindChild(app);
    settle();
  }

  const App = {
    render, S,
    /* 结案页的「把报告给家长看」：先过交接页，不直接切端 */
    askParent(){ S.gate = 'gate'; render(); },
    /* 家长端页头的「账号」：复用同一页账号中心 */
    goMy(){ S.tab = 'my'; S.gate = null; render(); },
    goChild(){
      Account.setRole('child');
      S.tab = 'home'; S.gate = null;
      render();
    }
  };
  window.App = App;

  /* ---------------- 通用弹层：确认 / 轻提示 ---------------- */
  let dlgWrap = null;

  function closeDialog(v){
    if(!dlgWrap) return;
    const cb = dlgWrap.cb, el = dlgWrap.el;
    dlgWrap = null;
    el.classList.remove('on');
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 170);
    if(cb) cb(v);
  }

  function confirmDialog(opt){
    opt = opt || {};
    if(dlgWrap) closeDialog(false);
    return new Promise(resolve=>{
      const el = document.createElement('div');
      el.className = 'dlg-mask';
      el.innerHTML = '<div class="dlg" role="dialog" aria-modal="true">'
        + '<div class="dlg-k">'+esc(opt.kicker || '请确认')+'</div>'
        + '<h3>'+esc(opt.title || '')+'</h3>'
        + (opt.body ? '<p>'+esc(opt.body)+'</p>' : '')
        + '<div class="dlg-actions">'
        + '<button class="btn ghost" data-no>'+esc(opt.cancelText || '取消')+'</button>'
        + '<button class="btn'+(opt.danger ? ' danger' : '')+'" data-yes>'+esc(opt.okText || '确定')+'</button>'
        + '</div></div>';
      document.body.appendChild(el);
      dlgWrap = {el, cb:resolve};
      el.querySelector('[data-no]').onclick = ()=>closeDialog(false);
      el.querySelector('[data-yes]').onclick = ()=>closeDialog(true);
      el.onclick = e=>{ if(e.target === el) closeDialog(false); };
      requestAnimationFrame(()=>el.classList.add('on'));
      setTimeout(()=>{ const y = el.querySelector('[data-yes]'); if(y) y.focus(); }, 60);
    });
  }

  function toast(text){
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('on'));
    setTimeout(()=>{
      el.classList.remove('on');
      setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 230);
    }, 1900);
  }

  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && dlgWrap) closeDialog(false);
  });

  window.UI = {confirm:confirmDialog, toast};

  /* ---------------- 档案备份：导出 / 导入 ---------------- */
  function archive(){
    const kids = Account.kids();
    const records = {};
    kids.forEach(k=>{ records[k.id] = Store.read(Store.key + '_' + k.id) || []; });
    /* 极老版本的单份记录也一起带上（按时间戳去重，避免同一份记录出现两次） */
    const legacy = Store.read(Store.key);
    if(legacy && legacy.length){
      const id = Account.activeId();
      const cur = records[id] || [];
      const seen = new Set(cur.map(r=>r && r.ts));
      records[id] = cur.concat(legacy.filter(r=>r && r.ts && !seen.has(r.ts)));
    }
    return {app:'junior-detective', version:1, exportedAt:Date.now(),
            activeId:Account.activeId(), kids, records};
  }

  function downloadJson(name, obj){
    try{
      const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(e){} }, 1500);
      return true;
    }catch(e){ return false; }
  }

  /* 合并而不是覆盖：按 ts 去重，保留本机已有记录 */
  function mergeArchive(obj){
    const records = obj && obj.records && typeof obj.records === 'object' ? obj.records : null;
    if(!records) throw new Error('文件里没有可用的练习记录');
    Account.importKids(obj.kids || [], obj.activeId);
    let added = 0, dup = 0;
    Object.keys(records).forEach(id=>{
      const incoming = Array.isArray(records[id]) ? records[id] : [];
      const key = Store.key + '_' + id;
      const cur = Store.read(key) || [];
      const seen = new Set(cur.map(r=>r && r.ts));
      const fresh = incoming.filter(r=>r && r.ts && !seen.has(r.ts));
      dup += incoming.length - fresh.length;
      if(!fresh.length) return;
      added += fresh.length;
      const merged = cur.concat(fresh).sort((a,b)=>b.ts - a.ts).slice(0,80);
      localStorage.setItem(key, JSON.stringify(merged));
    });
    return {added, dup};
  }

  document.addEventListener('DOMContentLoaded', render);
})();
