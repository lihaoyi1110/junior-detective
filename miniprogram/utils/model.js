/* ==========================================================
   模型接入层（小程序）
   客户端不持有任何密钥：只调用云函数 judge，
   Key 与模型地址保存在云函数环境变量或云数据库（按 openid）。
   云函数不可用时静默降级到本地规则。
   ========================================================== */
const TIMEOUT = 12000;

/* 云开发是否真的可用：初始化失败时不再逐次尝试，避免每次答错都等超时 */
function ready() {
  if (!wx.cloud) return false;
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData && app.globalData.cloudReady === false) return false;
  } catch (e) { /* 取不到 app 时按可用处理 */ }
  return true;
}

function call(data, timeout) {
  return new Promise((resolve, reject) => {
    if (!ready()) { reject(new Error('云开发不可用')); return; }
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('超时'));
    }, timeout || TIMEOUT);

    wx.cloud.callFunction({
      name: 'judge',
      data,
      success(res) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(res.result || {});
      },
      fail(err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

const Model = {
  /* 有云开发就尝试模型；具体能不能用由云函数决定 */
  enabled() {
    return ready();
  },

  async judge(payload) {
    if (!ready()) return null;
    try {
      const d = await call({ action: 'judge', payload });
      if (!d || !d.verdict) throw new Error('返回格式不对');
      return d;
    } catch (e) {
      return null;
    }
  },

  /* 家长端：查看当前配置（只回传掩码） */
  async config() {
    try {
      const d = await call({ action: 'config-get' }, 6000);
      return d || null;
    } catch (e) {
      return null;
    }
  },

  /* 家长端：保存配置。key 留空表示不改动已有密钥 */
  async save(cfg) {
    const d = await call({ action: 'config-save', config: cfg }, 8000);
    if (!d || !d.ok) throw new Error((d && d.error) || '保存失败');
    return d;
  },

  /* 家长端：用当前配置发一条测试，返回耗时与回复 */
  async test(cfg) {
    const d = await call({ action: 'test', config: cfg }, 15000);
    if (!d || !d.ok) throw new Error((d && d.error) || '连接失败');
    return d;
  }
};

module.exports = Model;
