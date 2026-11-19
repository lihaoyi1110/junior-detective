/* 案卷大厅：筛选默认收拢成一行，点开再展开 */
const { CASES, TYPES, GRADES } = require('../../model/cases.js');
const Store = require('../../utils/store.js');
const Account = require('../../utils/account.js');

function dots(level) {
  return [1, 2, 3].map(i => i <= level);
}

function groupOf(list, solved) {
  const groups = [];
  list.forEach(c => {
    let g = groups.find(x => x.grade === c.grade);
    if (!g) { g = { grade: c.grade, items: [] }; groups.push(g); }
    g.items.push({
      id: c.id,
      no: c.no,
      title: c.title,
      stem: c.stem,
      type: c.type,
      grade: c.grade,
      level: c.level,
      minutes: c.minutes,
      steps: (c.steps || []).length,
      done: !!solved[c.id],
      dots: dots(c.level)
    });
  });
  const rank = g => {
    const i = GRADES.indexOf(g.grade);
    return i < 0 ? 99 : i;
  };
  groups.sort((a, b) => rank(a) - rank(b));
  groups.forEach(g => g.items.sort((a, b) => a.level - b.level || (a.no < b.no ? -1 : 1)));
  return groups;
}

Page({
  data: {
    ft: '全部',
    fl: 0,
    fg: '全部',
    open: false,
    total: CASES.length,
    count: CASES.length,
    solved: 0,
    summary: '三～六年级 · 全难度',
    filtering: false,
    gradeChips: ['全部'].concat(GRADES),
    typeChips: ['全部'].concat(TYPES),
    levelChips: [{ v: 0, t: '不限' }, { v: 1, t: 'L1' }, { v: 2, t: 'L2' }, { v: 3, t: 'L3' }],
    groups: []
  },

  onShow() {
    const acc = Account.get();
    if (!acc.role || !acc.consentAt) {
      wx.reLaunch({ url: '/pages/welcome/welcome' });
      return;
    }
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
    const solved = {};
    all.forEach(s => { solved[s.caseId] = true; });
    const solvedN = Object.keys(solved).length;

    const { ft, fl, fg } = this.data;
    const list = CASES.filter(c =>
      (ft === '全部' || c.type === ft) &&
      (!fl || c.level === fl) &&
      (fg === '全部' || c.grade === fg));

    const gradeText = fg === '全部' ? '三～六年级' : fg;
    const levelText = fl ? 'L' + fl : '全难度';
    const typeText = ft === '全部' ? '' : ' · ' + ft;

    this.setData({
      groups: groupOf(list, solved),
      count: list.length,
      total: CASES.length,
      solved: solvedN,
      summary: gradeText + ' · ' + levelText + typeText,
      filtering: ft !== '全部' || fl !== 0 || fg !== '全部'
    });
  },

  toggleFilter() {
    this.setData({ open: !this.data.open });
  },

  setGrade(e) {
    this.setData({ fg: e.currentTarget.dataset.v }, () => this.refresh());
  },
  setType(e) {
    this.setData({ ft: e.currentTarget.dataset.v }, () => this.refresh());
  },
  setLevel(e) {
    this.setData({ fl: Number(e.currentTarget.dataset.v) }, () => this.refresh());
  },
  clearFilter() {
    this.setData({ ft: '全部', fl: 0, fg: '全部' }, () => this.refresh());
  },

  openCase(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/case/case?id=' + id });
  }
});
