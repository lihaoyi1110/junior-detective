/* 少年侦探社 · 小程序入口 */
App({
  globalData: {
    cloudReady: false,
    launchError: ''
  },

  onLaunch() {
    if (!wx.cloud) {
      this.globalData.launchError = '当前基础库不支持云开发，判分将使用本地规则';
      return;
    }
    try {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true
      });
      this.globalData.cloudReady = true;
    } catch (e) {
      this.globalData.launchError = '云开发未初始化：' + (e.message || e);
    }
  }
});
