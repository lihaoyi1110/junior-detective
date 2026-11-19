/* ==========================================================
   真实模型接入层
   默认走同源 /api/judge（由 server.py 代理，密钥只留在服务端）。
   没有配置或调用失败时静默降级到本地规则引擎。
   ========================================================== */
(function(){
  const KEY = 'detective_model_cfg';

  function cfg(){
    let local = null;
    try{ local = JSON.parse(localStorage.getItem(KEY)||'null'); }catch(e){ local = null; }
    return local || window.MODEL_CONFIG || null;
  }

  function enabled(){
    const c = cfg();
    return !!(c && c.endpoint);
  }

  async function judge(payload){
    const c = cfg();
    if(!c || !c.endpoint) return null;
    const ctrl = new AbortController();
    /* 孩子等不了太久：默认 12 秒没有结果就回退本机规则，页面会提示一句 */
    const ms = Number(c.timeout) || 12000;
    const timer = setTimeout(()=>ctrl.abort(), ms);
    try{
      const r = await fetch(c.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      const d = await r.json();
      if(!d || !d.verdict) throw new Error('返回格式不对');
      return d;
    }catch(e){
      const timeout = e && e.name === 'AbortError';
      console.warn('[model] 降级到本地规则：', timeout ? ('超时 ' + ms + 'ms') : e.message);
      return timeout ? {error:'timeout'} : null;
    }finally{
      clearTimeout(timer);
    }
  }

  /* 健康检查：本机服务是 /api/health，Pages Function 把 GET /api/judge 当健康检查。
     两种都试一次，避免线上把“已连接”误报成本地规则。 */
  async function ping(){
    const c = cfg();
    if(!c || !c.endpoint) return {ok:false, label:'本地规则'};
    const health = c.endpoint.replace(/\/judge$/,'/health');
    const urls = health===c.endpoint ? [c.endpoint] : [health, c.endpoint];
    for(const url of urls){
      try{
        const r = await fetch(url, {cache:'no-store'});
        if(!r.ok) continue;
        const d = await r.json();
        if(d && d.ok) return {ok:true, label:'已连接 · '+(d.model||'模型')};
      }catch(e){}
    }
    return {ok:false, label:'本地规则'};
  }

  window.Model = {
    cfg, enabled, judge, ping,
    setConfig(c){ localStorage.setItem(KEY, JSON.stringify(c)); },
    clearConfig(){ localStorage.removeItem(KEY); }
  };
})();
