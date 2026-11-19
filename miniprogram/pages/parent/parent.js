/* ==========================================================
   家长端 · 学习观察报告
   先结论、再证据、最后三件事；所有分数都标注样本量。
   ========================================================== */
const { CASES, TYPES, SAY } = require('../../model/cases.js');
const Engine = require('../../utils/engine.js');
const Store = require('../../utils/store.js');
const Account = require('../../utils/account.js');
const Charts = require('../../utils/charts.js');
const Model = require('../../utils/model.js');

const ADVICE = {
  reading: {
    t: '先让他把题目讲给你听',
    p: '不急着问“懂了吗”，请他用自己的话说明：题目在问什么、已知什么。讲不清的那一句，通常就是需要停一下的地方。',
    d: '审题'
  },
  relation: {
    t: '把数量关系画出来',
    p: '用线段图或小方块把关系摆出来：谁是谁的几倍、谁比谁多多少。关系可视化之后，列式往往更顺。',
    d: '关系'
  },
  model: {
    t: '动笔前先问“第一步求什么”',
    p: '建模卡住时，缺的常常是起手式。可以先问他：要得到答案，必须先知道什么？',
    d: '建模'
  },
  calc: {
    t: '把计算拆成两行写',
    p: '每一步单独写一行，并保留验算。这样既能减少跳步，也方便回看是哪一步出了问题。',
    d: '计算'
  },
  transfer: {
    t: '答案对了，再换一个条件',
    p: '把题里的一个条件换掉，再问他会不会变、为什么。这一步有助于判断是记住了做法，还是理解了关系。',
    d: '迁移'
  }
};

const DIM_DIAG = {
  reading: { hi: '能自己说清题目在问什么、哪些是已知条件。', lo: '容易把已知条件当成问题，或漏掉“还要”“至少”这类限定词。' },
  relation: { hi: '能主动找出量之间的关系，并说得出来。', lo: '要提示才能看出谁比谁多、谁是谁的几倍。' },
  model: { hi: '动笔前说得出第一步该求什么。', lo: '缺少起手式，常直接列式试算。' },
  calc: { hi: '步骤分得清，计算过程稳定。', lo: '一步跨太多，容易出现跳步错误。' },
  transfer: { hi: '换个条件仍能解释答案为什么变。', lo: '记住了做法，但换条件后难以迁移。' }
};

const PRI = ['现在做', '接着做', '长期保持'];
const fmt = ts => { const d = new Date(ts); return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日'; };
const md = ts => { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate(); };
const days = ts => Math.floor((Date.now() - ts) / 86400000);

function dimLevel(v) {
  if (v == null) return { name: '样本不足', cls: '' };
  if (v >= 85) return { name: '稳定', cls: 'ok' };
  if (v >= 70) return { name: '基本形成', cls: '' };
  if (v >= 55) return { name: '不稳定', cls: 'bad' };
  return { name: '尚未建立', cls: 'bad' };
}

function statsOf(all) {
  const sum = all.reduce((a, s) => a + (s.total || 0), 0);
  const ind = all.reduce((a, s) => a + (s.independent || 0), 0);
  return {
    n: all.length,
    week: all.filter(s => days(s.ts) < 7).length,
    rate: sum ? Math.round(ind / sum * 100) : 0,
    steps: sum,
    ind
  };
}

function masteryOf(all) {
  const m = {};
  all.forEach(s => {
    const c = CASES.find(x => x.id === s.caseId);
    if (!c) return;
    const o = m[c.type] || (m[c.type] = { ok: 0, total: 0, n: 0 });
    o.ok += s.independent || 0;
    o.total += s.total || 0;
    o.n++;
  });
  return TYPES.map(t => {
    const o = m[t];
    const pct = o && o.total ? Math.round(o.ok / o.total * 100) : 0;
    return {
      label: t,
      value: pct,
      max: 100,
      text: o && o.total ? pct + '%' : '未练',
      hot: !!(o && o.total && pct < 60),
      n: o ? o.n : 0
    };
  });
}

function trendOf(all) {
  return all.slice().sort((a, b) => a.ts - b.ts).slice(-6).map(s => ({
    d: md(s.ts),
    v: s.total ? Math.round((s.independent || 0) / s.total * 100) : 0
  }));
}

/* 按最弱的那一维挑案卷：不是按题型堆量，而是补当前缺口 */
function recByDim(all, weakDim) {
  const solved = {};
  all.forEach(s => { solved[s.caseId] = true; });
  if (!weakDim) return CASES.slice(0, 2);
  const scored = CASES.map(c => {
    const hit = (c.steps || []).filter(s => s.dim === weakDim.key).length;
    return { c, hit, done: !!solved[c.id] };
  }).filter(x => x.hit > 0);
  scored.sort((a, b) => (a.done - b.done) || (b.hit - a.hit) || (a.c.level - b.c.level));
  return scored.slice(0, 2).map(x => x.c);
}

/* 回写：上一轮之后，最弱那一维有没有变化 */
function followUpOf(all, weakDim) {
  if (!weakDim) return '';
  const sorted = all.slice().sort((a, b) => a.ts - b.ts);
  if (sorted.length < 4) return '';
  const earlier = sorted.slice(0, sorted.length - 3);
  const recent = sorted.slice(-3);
  const pick = list => {
    const d = Engine.diagnose(list).dims.find(x => x.key === weakDim.key);
    return d ? d.score : null;
  };
  const a = pick(earlier), b = pick(recent);
  if (a == null || b == null) return '';
  const diff = b - a;
  const head = '「' + weakDim.name + '」最近三次为 ' + b + ' 分，之前是 ' + a + ' 分';
  if (diff >= 5) return head + '（+' + diff + '），说明这条建议正在见效，继续保持。';
  if (diff <= -5) return head + '（' + diff + '），近期有所回落，先把练习时长缩短、频率放稳。';
  return head + '（' + (diff > 0 ? '+' : '') + diff + '），变化在正常起伏内，建议再看两三次。';
}

function verdictOf(all, diag) {
  const st = statsOf(all);
  const dims = diag.dims.filter(d => d.score != null);
  const byScore = dims.slice().sort((a, b) => b.score - a.score);
  const best = byScore[0], worst = byScore[byScore.length - 1];
  const band = st.rate >= 85 ? '已经能独立把题推完'
    : (st.rate >= 70 ? '大体能独立，个别步骤要提示'
      : (st.rate >= 50 ? '需要提示才能往下走' : '目前比较依赖提示'));

  let judge;
  if (!dims.length) {
    judge = '还没有足够的作答步骤，先完成 2–3 次练习，这份报告才具备判断依据。';
  } else if (best && worst && best.key !== worst.key && best.score - worst.score >= 10) {
    judge = '他目前' + band + '。五项里「' + best.name + '」最稳（' + best.score + '），「' + worst.name
      + '」相对靠后（' + worst.score + '，' + worst.n + ' 个步骤）——下一步优先补这一项，不必急着加新题型。';
  } else {
    judge = '他目前' + band + '。五项之间差异不大（' + worst.score + '–' + best.score
      + '），暂无突出短板，可以保持题型轮换、每周两到三次短练习。';
  }

  return {
    fact: '最近 7 天 ' + st.week + ' 次练习，累计 ' + st.n + ' 次、' + st.steps
      + ' 个作答步骤；其中 ' + st.ind + ' 个没有用到提示，独立率 ' + st.rate + '%。',
    judge,
    rate: st.rate,
    weakN: dims.filter(d => d.score < 70).length,
    n: st.n
  };
}

function diagRowsOf(diag) {
  return diag.dims.map(d => {
    const lv = dimLevel(d.score);
    const txt = d.score == null ? '这一项还没有足够的作答步骤，暂时不下判断。'
      : (d.score >= 70 ? DIM_DIAG[d.key].hi : DIM_DIAG[d.key].lo);
    return {
      name: d.name,
      score: d.score == null ? '—' : d.score,
      level: lv.name,
      cls: lv.cls,
      n: d.n,
      txt
    };
  });
}

function advicesOf(all, diag) {
  const out = [];
  const weak = diag.dims.filter(d => d.score != null && d.score < 85).sort((a, b) => a.score - b.score);
  weak.slice(0, 2).forEach(d => {
    const a = ADVICE[d.key];
    if (a) {
      out.push({
        t: a.t, p: a.p, d: a.d,
        why: '依据：该维度最近 ' + d.n + ' 个作答步骤的平均分为 ' + d.score + '，在五项中相对靠后。'
      });
    }
  });
  const conf = Object.keys(diag.confusions).map(k => [k, diag.confusions[k]])
    .sort((a, b) => b[1] - a[1])[0];
  if (conf && conf[1] >= 2) {
    out.push({
      t: '陪他把“' + conf[0] + '”说清楚',
      p: '这个理解偏差在记录中出现过，可以请他先解释自己的想法，再举一个相反的例子，帮助他把概念分清。',
      d: null,
      why: '依据：同一处偏差在记录中出现 ' + conf[1] + ' 次，建议继续观察，暂不下结论。'
    });
  }

  const extra = [
    {
      t: '让他把思路讲给你听',
      p: '做完一道题后，请他用自己的话讲一遍“先求什么、再求什么”。你只需要点头和追问，不要替他补。',
      d: '建模', why: '依据：五项当前较均衡，讲题能同时检验审题与建模，是成本最低的日常练习。'
    },
    {
      t: '每周固定两到三次短练习',
      p: '每次十分钟左右，做完就停。频率比单次时长更重要，避免把练习变成长时间刷题。',
      d: null, why: '依据：现有 ' + diag.sessions + ' 次练习的间隔与单次时长，固定节奏更容易看出趋势。'
    },
    {
      t: '做完再追一句“换个条件呢”',
      p: '每道题收尾时加一句“如果这个条件变了呢”，让他不只会算这一道。',
      d: '迁移', why: '依据：迁移应用最容易被忽略，日常只需一句追问。'
    }
  ];
  extra.forEach(e => { if (out.length < 3) out.push(e); });

  return out.slice(0, 3).map((x, i) => ({
    id: 'a' + i,
    pri: PRI[i] || '可尝试',
    t: x.t,
    p: x.p,
    why: x.why,
    say: x.d && SAY[x.d] ? SAY[x.d] : ''
  }));
}

Page({
  data: {
    tab: 'dash',
    name: '',
    dateText: '',
    kids: [],
    activeId: '',
    hasData: false,
    verdict: null,
    diagRows: [],
    practiced: [],
    untouched: '',
    weakTypeText: '',
    trend: [],
    advices: [],
    recs: [],
    recNote: '',
    adviceFollow: '',
    logs: [],
    logSum: '',
    confText: '',
    statsRows: [],
    model: { status: '', pill: '检测中', note: '', base: '', model: '', key: '' }
  },

  onShow() {
    const acc = Account.get();
    if (!acc.role) {
      wx.reLaunch({ url: '/pages/welcome/welcome' });
      return;
    }
    this.refresh();
    this.loadModel();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab }, () => {
      this.drawCharts();
      wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    });
  },

  switchKid(e) {
    Account.switchKid(e.currentTarget.dataset.id);
    this.refresh();
  },

  refresh() {
    const all = Store.all();
    const diag = Engine.diagnose(all);
    const st = statsOf(all);
    const m = masteryOf(all);
    const practiced = m.filter(x => x.n > 0).sort((a, b) => b.value - a.value);
    const untouched = m.filter(x => x.n === 0).map(x => x.label);
    const weakType = practiced.slice().filter(x => x.n >= 2).sort((a, b) => a.value - b.value)[0]
      || practiced[practiced.length - 1];
    const weakDim = diag.dims.filter(d => d.score != null).sort((a, b) => a.score - b.score)[0];
    const rec = recByDim(all, weakDim);

    const logs = all.slice().sort((a, b) => b.ts - a.ts).map((s, i) => {
      const c = CASES.find(x => x.id === s.caseId);
      if (!c) return null;
      const pct = s.total ? Math.round((s.independent || 0) / s.total * 100) : 0;
      const bad = (s.log || []).filter(l => l.fails > 0);
      return {
        id: 'l' + i,
        date: md(s.ts),
        title: c.title,
        type: c.type,
        pct,
        cls: pct >= 80 ? 'ok' : (pct < 60 ? 'bad' : ''),
        indep: s.independent,
        total: s.total,
        tag: bad.length ? (bad[0].mis || '使用过提示') : '—'
      };
    }).filter(Boolean);

    const confsAll = Object.keys(diag.confusions).map(k => [k, diag.confusions[k]])
      .sort((a, b) => b[1] - a[1]);
    const repeated = confsAll.filter(c => c[1] >= 2).slice(0, 5);
    const once = confsAll.filter(c => c[1] < 2).map(c => c[0]);
    const confText = repeated.length
      ? repeated.map(c => '「' + c[0] + '」在记录中出现 ' + c[1] + ' 次').join('；')
      : (once.length
        ? '目前每处偏差都只出现 1 次（如「' + once.slice(0, 3).join('」「') + '」），还不足以判断成稳定模式，先记录、不急着纠正。'
        : '目前还没有记录到理解偏差。');

    this.setData({
      name: Account.name(),
      dateText: fmt(Date.now()) + ' · 基于本机练习记录',
      kids: Account.kids().map(k => ({ id: k.id, name: k.name || '小侦探' })),
      activeId: Account.activeId(),
      hasData: all.length > 0,
      verdict: all.length ? verdictOf(all, diag) : null,
      diagRows: diagRowsOf(diag),
      practiced,
      untouched: untouched.join('、'),
      weakTypeText: weakType
        ? '「' + weakType.label + '」目前无提示完成率为 ' + weakType.value + '%，已练习 ' + weakType.n + ' 次。'
        : '还没有练习记录，先按顺序各做一道即可。',
      recNote: weakDim
        ? '按「' + weakDim.name + '」这一项（当前 ' + weakDim.score + ' 分，' + weakDim.n + ' 个步骤）挑的：这两卷里该维度出现的步骤最多。'
        : '记录还少，先各类型各做一卷，再按维度给出针对性推荐。',
      adviceFollow: followUpOf(all, weakDim),
      trend: trendOf(all),
      advices: all.length ? advicesOf(all, diag) : [],
      recs: rec.map(c => ({
        id: c.id, no: c.no, title: c.title, type: c.type, level: c.level, minutes: c.minutes
      })),
      logs,
      logSum: '累计 ' + st.steps + ' 个作答步骤，其中 ' + st.ind + ' 个没有用到提示，独立率 ' + st.rate + '%。',
      confText
    }, () => this.drawCharts());
  },

  drawCharts() {
    if (!this.data.hasData) return;
    const tab = this.data.tab;
    if (tab !== 'dash') return;
    /* 等这一帧的 canvas 真正挂载后再取节点 */
    setTimeout(() => {
      Charts.draw(this, '#p-radar', 'radar', Engine.diagnose(Store.all()).dims);
      Charts.draw(this, '#p-bars', 'bars', this.data.practiced);
      Charts.draw(this, '#p-line', 'line', this.data.trend);
    }, 80);
  },

  openCase(e) {
    wx.navigateTo({ url: '/pages/case/case?id=' + e.currentTarget.dataset.id });
  },

  /* ---------- 模型接入 ---------- */
  async loadModel() {
    const cfg = await Model.config();
    if (!cfg) {
      this.setData({
        'model.status': '云函数未连接',
        'model.pill': '本地',
        'model.note': '没有连上云端判分函数，当前按本地规则判断。部署 cloudfunctions/judge 后即可在此接入模型。'
      });
      return;
    }
    this.setData({
      'model.status': cfg.configured ? ((cfg.model || '模型') + ' · Key ' + (cfg.key || '已配置')) : '未配置外部模型',
      'model.pill': cfg.configured ? '已连接' : '本地',
      'model.note': cfg.configured
        ? '当前：' + (cfg.model || '模型') + ' · Key ' + (cfg.key || '已配置')
        : '当前未配置外部模型，判分使用本地规则。'
    });
  },

  onBase(e) { this.setData({ 'model.base': e.detail.value }); },
  onModelName(e) { this.setData({ 'model.model': e.detail.value }); },
  onKey(e) { this.setData({ 'model.key': e.detail.value }); },

  async saveModel() {
    try {
      const d = await Model.save({
        base: this.data.model.base,
        model: this.data.model.model,
        key: this.data.model.key
      });
      this.setData({ 'model.key': '', 'model.pill': '已连接' });
      this.loadModel();
      wx.showToast({ title: '已保存', icon: 'success' });
      if (d && d.error) wx.showToast({ title: d.error, icon: 'none' });
    } catch (e) {
      wx.showModal({ title: '保存失败', content: e.message || '请检查网络后重试', showCancel: false });
    }
  },

  async testModel() {
    wx.showLoading({ title: '正在连接…' });
    try {
      const d = await Model.test({
        base: this.data.model.base,
        model: this.data.model.model,
        key: this.data.model.key
      });
      this.setData({ 'model.note': '连接成功：' + (d.model || '模型') + ' · ' + d.ms + 'ms · 回复「' + (d.reply || '') + '」' });
    } catch (e) {
      this.setData({ 'model.note': '连接失败：' + (e.message || '未知错误') });
    } finally {
      wx.hideLoading();
    }
  },

  /* ---------- 跳转 ---------- */
  toChild() {
    Account.setRole('child');
    wx.reLaunch({ url: '/pages/home/home' });
  },

  toAccount() {
    wx.reLaunch({ url: '/pages/my/my' });
  }
});
