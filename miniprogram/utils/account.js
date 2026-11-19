/* ==========================================================
   账号 · 身份、孩子档案与声明（小程序本机存储）
   一台设备可以有多位孩子：监护人同意一次，档案与记录各自独立。
   换设备不会同步；需要跨设备时接微信登录 + 云数据库。
   ========================================================== */
const KEY = 'detective_account_v1';
const KIDS = 'detective_kids_v1';
const ROLE_NAME = { child: '孩子端', parent: '家长端' };

function blank() {
  return { role: null, name: '', consentAt: 0, createdAt: 0 };
}

function get() {
  let o = null;
  try {
    o = wx.getStorageSync(KEY);
  } catch (e) {
    o = null;
  }
  if (!o || typeof o !== 'object') return blank();
  return {
    role: (o.role === 'child' || o.role === 'parent') ? o.role : null,
    name: typeof o.name === 'string' ? o.name : '',
    consentAt: Number(o.consentAt) || 0,
    createdAt: Number(o.createdAt) || 0
  };
}

function patch(p) {
  const o = Object.assign(get(), p);
  if (!o.createdAt) o.createdAt = Date.now();
  wx.setStorageSync(KEY, o);
  return o;
}

function readKids() {
  let o = null;
  try {
    o = wx.getStorageSync(KIDS);
  } catch (e) {
    o = null;
  }
  if (!o || !Array.isArray(o.list)) return null;
  const list = o.list
    .filter(k => k && typeof k.id === 'string')
    .map(k => ({ id: k.id, name: typeof k.name === 'string' ? k.name : '', createdAt: Number(k.createdAt) || 0 }));
  if (!list.length) return null;
  const active = list.some(k => k.id === o.active) ? o.active : list[0].id;
  return { active, list };
}

function writeKids(o) {
  wx.setStorageSync(KIDS, o);
}

function newId() {
  return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

/* 旧版本只有一份身份与一个昵称：升级时自动变成第一位孩子 */
function ensureKids() {
  const o = readKids();
  if (o) return o;
  const acc = get();
  const id = newId();
  const next = { active: id, list: [{ id, name: acc.name || '', createdAt: acc.createdAt || Date.now() }] };
  writeKids(next);
  return next;
}

function activeKid() {
  const o = ensureKids();
  return o.list.find(k => k.id === o.active) || o.list[0];
}

function renameKid(name) {
  const v = String(name || '').trim().slice(0, 12);
  const o = ensureKids();
  const kid = o.list.find(k => k.id === o.active);
  if (kid) kid.name = v;
  writeKids(o);
  patch({ name: v });
  return v;
}

const Account = {
  KEY, ROLE_NAME, get,

  sign(role, name) {
    const cur = get();
    ensureKids();
    if (name != null && String(name).trim()) renameKid(name);
    return patch({ role, createdAt: cur.createdAt || Date.now() });
  },
  setRole(role) { return patch({ role }); },
  consent() { return patch({ consentAt: Date.now() }); },
  rename(name) { return renameKid(name); },

  kids() { return ensureKids().list.slice(); },
  activeId() { return ensureKids().active; },
  activeKid,
  addKid(name) {
    const v = String(name || '').trim().slice(0, 12);
    const o = ensureKids();
    const id = newId();
    o.list.push({ id, name: v, createdAt: Date.now() });
    o.active = id;
    writeKids(o);
    patch({ name: v });
    return id;
  },
  switchKid(id) {
    const o = ensureKids();
    if (!o.list.some(k => k.id === id)) return false;
    o.active = id;
    writeKids(o);
    const kid = o.list.find(k => k.id === id);
    patch({ name: kid ? kid.name : '' });
    return true;
  },

  needsConsent() { return !get().consentAt; },
  name() { return activeKid().name || '小侦探'; },
  roleName(role) { return ROLE_NAME[role || get().role] || ''; },

  /* 退出账号：身份与同意记录清掉，孩子档案与练习记录保留 */
  reset() {
    try { wx.removeStorageSync(KEY); } catch (e) { /* 忽略 */ }
  }
};

module.exports = Account;
