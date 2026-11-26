/* ==========================================================
   Cloudflare Pages Function · POST /api/stt
   把孩子的录音转成文字。浏览器自带的 SpeechRecognition 在
   Chrome 上依赖 Google 在线服务，国内网络常直接失败；这条
   服务端通道走可配置的语音服务，作为主路径，浏览器识别降级。

   配置优先级：
     1) 请求表单里的 base / model / key（家长自己填的，只保存在浏览器 localStorage）
     2) Pages 环境变量 STT_API_KEY / STT_BASE_URL / STT_MODEL

   部署后需要配置的环境变量（Settings → Environment variables）：
     STT_API_KEY   选填；未配置时家长可以自己填 Key，也会回退浏览器识别
     STT_BASE_URL  选填，默认 https://api.siliconflow.cn/v1
     STT_MODEL     选填，默认 FunAudioLLM/SenseVoiceSmall

   请求：multipart/form-data，字段 audio = 音频文件（webm/mp4/ogg）
   返回：{"text":"识别出的中文"}
   ========================================================== */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)
  });
}

/* 合并配置：请求表单里的 base/model/key 优先，其次才是 Pages 环境变量 */
function resolveConfig(form, env) {
  const env_ = env || {};
  const fbase = form && form.get ? (form.get('base') || '').trim() : '';
  const fmodel = form && form.get ? (form.get('model') || '').trim() : '';
  const fkey = form && form.get ? (form.get('key') || '').trim() : '';
  const base = String(fbase || env_.STT_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
  const model = fmodel || env_.STT_MODEL || 'FunAudioLLM/SenseVoiceSmall';
  const key = fkey || env_.STT_API_KEY || '';
  return { base, model, key, fromParent: !!(fkey) };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  return json({
    ok: !!env.STT_API_KEY,
    model: env.STT_MODEL || 'FunAudioLLM/SenseVoiceSmall',
    base: env.STT_BASE_URL || 'https://api.siliconflow.cn/v1'
  });
}

export async function onRequestPost(context) {
  const env = context.env || {};

  let form;
  try {
    form = await context.request.formData();
  } catch (e) {
    return json({ error: '请求体不是 multipart/form-data' }, 400);
  }

  const audio = form.get('audio');
  if (!audio || typeof audio === 'string') return json({ error: '缺少音频' }, 400);
  if (audio.size > 10 * 1024 * 1024) return json({ error: '录音太长' }, 413);

  const cfg = resolveConfig(form, env);
  if (!cfg.key) return json({ error: '未配置 STT API Key（服务端或家长端均未提供）' }, 503);

  const out = new FormData();
  out.append('model', cfg.model);
  out.append('file', audio, audio.name || 'speech.webm');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(cfg.base + '/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + cfg.key },
      body: out,
      signal: ctrl.signal
    });
    const raw = await r.text();
    if (!r.ok) return json({ error: '语音服务 HTTP ' + r.status, detail: raw.slice(0, 200) }, 502);
    let data;
    try { data = JSON.parse(raw); } catch (e) { return json({ error: '语音服务返回不是 JSON' }, 502); }
    return json({ text: String(data.text || '').trim(), model: cfg.model, source: cfg.fromParent ? 'parent' : 'server' });
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? '语音服务超时' : String((e && e.message) || e);
    return json({ error: msg }, 502);
  } finally {
    clearTimeout(timer);
  }
}
