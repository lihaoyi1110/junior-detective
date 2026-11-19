/* 孩子端 · 档案：星图、徽章、错题本、最近的案子 */
const { CASES, DIMS } = require('../../model/cases.js');
const Engine = require('../../utils/engine.js');
const Store = require('../../utils/store.js');
const Account = require('../../utils/account.js');
const Charts = require('../../utils/charts.js');

function dimName(k) {
  const d = DIMS.find(x => x.key === k);
  return d ? d.name : '综合';
}

/* 错题本：按案卷 + 步骤去重，只留最近一次卡壳 */
function wrongOf(all) {
  const map = {};
  all.forEach(s => {
    (s.log || []).forEach((l, i) => {
      if (!(l.fails > 0 || l.mis)) return;
      const c = CASES.find(x => x.id === s.caseId);
      if (!c || !c.steps[i]) return;
      const key = s.caseId + '#' + i;
      const prev = map[key];
      if (prev && prev.ts > s.ts) return;
      map[key] = {
        id: key,
        caseId: s.caseId,
        no: c.no,
        ts: s.ts,
        dim: dimName(c.steps[i].dim),
        tag: c.steps[i].tag,
        q: c.steps[i].q,
        said: l.said || '',
        firstWrong: l.firstWrong || null,
        fallback: (c.steps[i].say || []).join(' ')
      };
    });
  });
  return Object.keys(map).map(k => map[k]).sort((a, b) => b.ts - a.ts);
}

Page({
  data: {
    name: '',
    roleText: '',
    rank: '助手',
    next: '',
    solved: 0,
    kpis: [],
    badges: [],
    wrong: [],
    wrongN: 0,
    recent: [],
    hasData: false,
    dims: []
  },

  onShow() {
    const acc = Account.get();
    if (!acc.role || !acc.consentAt) {
      wx.reLaunch({ url: '/pages/welcome/welcome' });
      return;
    }
    /* 家长端不展示孩子的档案页，直接回到报告 */
    if (acc.role === 'parent') {
      wx.reLaunch({ url: '/pages/parent/parent' });
      return;
    }
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  refresh() {
    const all = Store.all();
    const diag = Engine.diagnose(all);
    const solvedIds = {};
    all.forEach(s => { solvedIds[s.caseId] = true; });
    const solvedN = Object.keys(solvedIds).length;

    const indep = all.reduce((a, s) => a + (s.independent || 0), 0);
    const steps = all.reduce((a, s) => a + (s.total || 0), 0);
    const daySet = {};
    all.forEach(s => { daySet[new Date(s.ts).toDateString()] = true; });

    const rank = solvedN >= CASES.length ? '首席侦探'
      : (solvedN >= 6 ? '正式侦探' : (solvedN >= 3 ? '见习侦探' : '助手'));
    const next = solvedN >= CASES.length ? '全部案卷已勘完'
      : (solvedN >= 6 ? '再破 ' + (CASES.length - solvedN) + ' 个案卷，升「首席侦探」'
        : '再破 ' + (6 - solvedN) + ' 个案卷，升「正式侦探」');

    const badges = [];
    CASES.forEach(c => {
      if (solvedIds[c.id]) c.tags.forEach(t => { if (badges.indexOf(t) < 0) badges.push(t); });
    });

    const recent = all.slice().sort((a, b) => b.ts - a.ts).slice(0, 3).map(s => {
      const c = CASES.find(x => x.id === s.caseId);
      if (!c) return null;
      return {
        caseId: c.id,
        no: c.no,
        title: c.title,
        type: c.type,
        indep: s.independent,
        total: s.total,
        full: s.independent === s.total
      };
    }).filter(Boolean);

    const wrong = wrongOf(all).slice(0, 6).map(w => {
      const fw = w.firstWrong || {};
      return {
        caseId: w.caseId,
        no: w.no,
        dim: w.dim,
        tag: w.tag,
        q: w.q,
        said: String(fw.said || w.said || '').trim(),
        reply: String(fw.reply || '').trim() || w.fallback
      };
    });

    this.setData({
      name: Account.name(),
      roleText: Account.roleName('child'),
      rank,
      next,
      solved: solvedN,
      hasData: all.length > 0,
      kpis: [
        { n: solvedN, k: '破案', s: next },
        { n: all.length ? indep + '/' + steps : '—', k: '独立步骤', s: all.length ? '没靠提示' : '完成一次后统计' },
        { n: Object.keys(daySet).length, k: '探案天数', s: all.length ? '今天也来了' : '从第一份开始' }
      ],
      badges,
      wrong,
      wrongN: wrong.length,
      recent,
      dims: diag.dims
    }, () => this.drawRadar());
  },

  drawRadar() {
    if (!this.data.hasData) return;
    Charts.draw(this, '#radar', 'radar', this.data.dims);
  },

  openCase(e) {
    wx.navigateTo({ url: '/pages/case/case?id=' + e.currentTarget.dataset.id });
  },

  retry(e) {
    this.openCase(e);
  }
});
