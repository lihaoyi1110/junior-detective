/* 身份选择 → 声明 → 进入对应一端 */
const { CASES, TYPES, GRADES } = require('../../model/cases.js');
const Account = require('../../utils/account.js');

Page({
  data: {
    top: 24,
    step: 'role',
    role: 'child',
    agreed: false,
    caseCount: CASES.length,
    typeCount: TYPES.length,
    gradeText: '三～六年级',
    consentDay: ''
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ top: (info.statusBarHeight || 20) + 8 });

    const acc = Account.get();
    if (acc.role && acc.consentAt) this.enter(acc.role);
  },

  choose(e) {
    const role = e.currentTarget.dataset.role;
    Account.sign(role);
    this.setData({ role, step: 'consent', agreed: false });
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  confirm() {
    if (!this.data.agreed) return;
    Account.consent();
    this.enter(this.data.role);
  },

  /* 声明没有同意也可以回退，避免卡死在一页 */
  backRole() {
    this.setData({ step: 'role', agreed: false });
  },

  enter(role) {
    if (role === 'parent') {
      wx.reLaunch({ url: '/pages/parent/parent' });
    } else {
      wx.reLaunch({ url: '/pages/home/home' });
    }
  }
});
