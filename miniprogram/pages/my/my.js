/* 我的：昵称、多孩子、声明、清空、切换两端 */
const Account = require('../../utils/account.js');
const Store = require('../../utils/store.js');

function day(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
}

Page({
  data: {
    isParent: false,
    name: '',
    draftName: '',
    newKid: '',
    kids: [],
    activeId: '',
    rows: [],
    roleTag: ''
  },

  onShow() {
    const acc = Account.get();
    if (!acc.role) {
      wx.reLaunch({ url: '/pages/welcome/welcome' });
      return;
    }
    this.refresh();
  },

  refresh() {
    const acc = Account.get();
    const isParent = acc.role === 'parent';
    const kids = Account.kids();
    const all = Store.all();

    this.setData({
      isParent,
      name: Account.name(),
      draftName: Account.name(),
      kids: kids.map(k => ({ id: k.id, name: k.name || '小侦探' })),
      activeId: Account.activeId(),
      roleTag: isParent ? '家长端' : '孩子端',
      rows: [
        { k: '当前身份', v: isParent ? '家长端' : '孩子端' },
        { k: '当前孩子', v: Account.name() },
        { k: '孩子档案', v: kids.length + ' 位' },
        { k: '加入时间', v: day(acc.createdAt) },
        { k: '声明同意', v: day(acc.consentAt) },
        { k: '练习记录', v: all.length + ' 次' },
        { k: '存储位置', v: '本机存储' }
      ]
    });
  },

  onNameInput(e) {
    this.setData({ draftName: e.detail.value });
  },

  saveName() {
    const v = String(this.data.draftName || '').trim();
    if (!v) {
      wx.showToast({ title: '先取个代号', icon: 'none' });
      return;
    }
    Account.rename(v);
    this.refresh();
    wx.showToast({ title: '已保存', icon: 'success' });
  },

  onNewKidInput(e) {
    this.setData({ newKid: e.detail.value });
  },

  switchKid(e) {
    Account.switchKid(e.currentTarget.dataset.id);
    this.refresh();
  },

  addKid() {
    const v = String(this.data.newKid || '').trim();
    if (!v) {
      wx.showToast({ title: '请输入新孩子的代号', icon: 'none' });
      return;
    }
    Account.addKid(v);
    this.setData({ newKid: '' });
    this.refresh();
  },

  /* 把手机交给家长：切到家长端并打开报告 */
  toParent() {
    Account.setRole('parent');
    wx.reLaunch({ url: '/pages/parent/parent' });
  },

  toChild() {
    Account.setRole('child');
    wx.reLaunch({ url: '/pages/home/home' });
  },

  backReport() {
    wx.reLaunch({ url: '/pages/parent/parent' });
  },

  viewConsent() {
    wx.showModal({
      title: '数据与隐私',
      content: '练习记录只写在这台设备：作答文字、提示次数与理解偏差。开启外部模型判分时，仅当前这一步的作答文字、题目和最近几句对话会发到云端判分接口，不发送姓名与身份。能力报告只在家长端显示。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  clearRecords() {
    wx.showModal({
      title: '清空练习记录',
      content: '将清空当前孩子的全部练习记录，清空后无法恢复。',
      confirmText: '清空',
      confirmColor: '#A63F2B',
      success: res => {
        if (!res.confirm) return;
        Store.clear();
        this.refresh();
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  },

  signOut() {
    wx.showModal({
      title: '返回身份选择',
      content: '身份与同意记录会清除，孩子档案与练习记录仍留在这台设备。',
      success: res => {
        if (!res.confirm) return;
        Account.reset();
        wx.reLaunch({ url: '/pages/welcome/welcome' });
      }
    });
  }
});
