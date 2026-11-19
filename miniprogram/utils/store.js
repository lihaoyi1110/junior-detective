/* ==========================================================
   本地档案 · 按孩子分槽存放
   记录形状与 Web 端一致，方便两端共用同一套诊断逻辑。
   ========================================================== */
const Account = require('./account.js');

const KEY = 'detective_v3';

function read(k) {
  let a = null;
  try {
    a = wx.getStorageSync(k);
  } catch (e) {
    a = null;
  }
  return Array.isArray(a) ? a : null;
}

const Store = {
  key: KEY,

  id() {
    try { return Account.activeId() || 'k0'; } catch (e) { return 'k0'; }
  },
  slot() { return KEY + '_' + this.id(); },

  /* 没有记录就返回空数组：新用户看到的是空档案，不是编造的练习 */
  all() {
    const k = this.slot();
    let a = read(k);
    if (!a) {
      const legacy = read(KEY);
      if (legacy && legacy.length) {
        a = legacy;
        wx.setStorageSync(k, a);
        wx.removeStorageSync(KEY);
      } else {
        a = [];
      }
    }
    /* 早期版本写入过演示数据，读到就丢掉，不参与任何统计 */
    return a.filter(s => !s.demo);
  },

  save(a) { wx.setStorageSync(this.slot(), a.slice(0, 80)); },
  add(s) { const a = this.all(); a.unshift(s); this.save(a); },
  clear() { wx.removeStorageSync(this.slot()); }
};

module.exports = Store;
