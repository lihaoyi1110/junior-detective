/* ==========================================================
   真实模型接入层
   默认走同源 /api/judge（由 server.py 或 Cloudflare Pages 代理，
   密钥只留在服务端；家长可以在界面上填自己的 Key，保存在这台设备的
   localStorage，每次请求附带发送，服务器优先用这个 Key，否则回退
   部署环境的默认 Key）。

   没有配置或调用失败时静默降级到本地规则引擎。
   ========================================================== */
(function(){
  /* 两套配置槽位：
     - cfgServer：来自部署端 /api/judge 环境变量的默认值（GET /api/judge 返回）
     - cfgParent：家长在界面上保存的、只存在这台设备的覆盖配置（localStorage）
     最终合并时：cfgParent > cfgServer */
  const LS_PARENT = 'detective_model_parent';
  let cfgServer = null;   /* 运行期拉一次 /api/judge 填 */

  function readParent(){
    try{ return JSON.parse(localStorage.getItem(LS_PARENT)||'null'); }catch(e){ return null; }
  }
  function writeParent(o){
    if(!o) { localStorage.removeItem(LS_PARENT); return; }
    localStorage.setItem(LS_PARENT, JSON.stringify(o));
  }

  /* 当前生效的合并配置 */
  function effective(){
    const p = readParent() || {};
    const s = cfgServer || {};
    const parent = {
      base: (p.base||'').trim(),
      model: (p.model||'').trim(),
      key: (p.key||'').trim()
    };
    const server = {
      base: s.base || '',
      model: s.model || '',
      configured: !!s.ok || !!s.configured
    };
    const endpoint = '/api/judge';
    return {
      endpoint,
      base: parent.base || server.base,
      model: parent.model || server.model,
      key: parent.key || '',
      parent: !!parent.key,     /* 是否由家长配置 */
      timeout: 12000,
      serverConfigured: server.configured
    };
  }

  /* 只有至少一端有 Key 才算「已配置外部模型」 */
  function enabled(){
    const c = effective();
    return !!(c.endpoint && (c.key || c.serverConfigured));
  }

  /* 把家长配置塞进每次 /api/judge 请求体的 config 字段，
     服务端会优先用它，没有再回退 Pages 环境变量 */
  function injectPayload(payload){
    const p = readParent();
    if(p && (p.base || p.model || p.key)){
      payload = Object.assign({}, payload, {
        config: {
          base: (p.base||'').trim(),
          model: (p.model||'').trim(),
          key: (p.key||'').trim()
        }
      });
    }
    return payload;
  }

  async function judge(payload){
    const c = effective();
    const ctrl = new AbortController();
    const ms = Number(c.timeout) || 12000;
    const timer = setTimeout(()=>ctrl.abort(), ms);
    try{
      const r = await fetch(c.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(injectPayload(payload)),
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
     两种都试一次，避免线上把「已连接」误报成本地规则。 */
  async function ping(){
    const c = effective();
    const endpoint = c.endpoint || '/api/judge';
    const health = endpoint.replace(/\/judge$/,'/health');
    const urls = health===endpoint ? [endpoint] : [health, endpoint];
    for(const url of urls){
      try{
        const r = await fetch(url, {cache:'no-store'});
        if(!r.ok) continue;
        const d = await r.json();
        /* 记住服务器端的默认 base/model/ok，让 effective() 合并用 */
        cfgServer = d;
        if(d && d.ok){
          const parentKey = c.parent ? '（家长 Key）' : '';
          return {ok:true, label:'已连接 · '+(d.model||c.model||'模型')+parentKey};
        }
      }catch(e){}
    }
    cfgServer = { ok:false };
    return {ok:false, label:'本地规则'};
  }

  /* 家长端用到的公开接口 */
  window.Model = {
    cfg(){ return effective(); },
    enabled, judge, ping,
    parent(){ return readParent() || null; },
    setParent(o){ writeParent(o); },
    clearParent(){ writeParent(null); },
    setConfig(c){ /* 旧接口：合并进家长槽位 */ writeParent(c); },
    clearConfig(){ writeParent(null); }
  };
})();
