/* ==========================================================
   Cloudflare Pages Function · POST /api/stt
   把孩子的录音转成文字。浏览器自带的 SpeechRecognition 在
   Chrome 上依赖 Google 在线服务，国内网络常直接失败；这条
   服务端通道走可配置的语音服务，作为主路径，浏览器识别降级。

   部署后需要配置的环境变量（Settings → Environment variables）：
     STT_API_KEY   必填；未配置时 GET 返回 ok:false，前端自动降级
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
  if (!env.STT_API_KEY) return json({ error: '未配置 STT_API_KEY' }, 503);

  let form;
  try {
    form = await context.request.formData();
  } catch (e) {
    return json({ error: '请求体不是 multipart/form-data' }, 400);
  }
  const audio = form.get('audio');
  if (!audio || typeof audio === 'string') return json({ error: '缺少音频' }, 400);
  if (audio.size > 10 * 1024 * 1024) return json({ error: '录音太长' }, 413);

  const base = String(env.STT_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/+$/, '');
  const model = env.STT_MODEL || 'FunAudioLLM/SenseVoiceSmall';
  const out = new FormData();
  out.append('model', model);
  out.append('file', audio, audio.name || 'speech.webm');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(base + '/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.STT_API_KEY },
      body: out,
      signal: ctrl.signal
    });
    const raw = await r.text();
    if (!r.ok) return json({ error: '语音服务 HTTP ' + r.status, detail: raw.slice(0, 200) }, 502);
    let data;
    try { data = JSON.parse(raw); } catch (e) { return json({ error: '语音服务返回不是 JSON' }, 502); }
    return json({ text: String(data.text || '').trim(), model });
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? '语音服务超时' : String((e && e.message) || e);
    return json({ error: msg }, 502);
  } finally {
    clearTimeout(timer);
  }
}
