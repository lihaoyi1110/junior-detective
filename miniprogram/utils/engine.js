/* ==========================================================
   语义判定层（小程序版）
   把 prototype/engine.js 里的判定逻辑原样搬过来：
   只去掉 window，依赖改为 require 题库模块。
   ========================================================== */
const { CASES, DIMS } = require('../model/cases.js');

/* 常见“量”的领域词：孩子只说领域、没说到具体对象时，算部分理解 */
const DOMAINS = [
  { name: '时间', keys: ['时间', '多久', '几分钟', '几小时', '几天', '年份', '年数'] },
  { name: '路程', keys: ['路程', '距离', '多远', '千米', '米数'] },
  { name: '速度', keys: ['速度', '每分钟', '每小时', '快慢'] },
  { name: '数量', keys: ['只数', '数量', '多少个', '多少只', '多少棵', '多少人', '人数', '棵数'] },
  { name: '脚数', keys: ['脚', '腿'] },
  { name: '倍数', keys: ['倍数', '几倍', '几份'] },
  { name: '效率', keys: ['效率', '每天做', '每小时做', '工作量'] },
  { name: '产量', keys: ['产量', '零件数', '加工多少'] },
  { name: '年龄', keys: ['年龄', '岁数', '几岁'] }
];

/* 语气层：把生硬的判断换成可继续对话的说法 */
const SOFT = [
  [/不对/g, '还差半步'],
  [/差一点/g, '很接近了'],
  [/你算错了/g, '这一步的计算我们再核对一下'],
  [/算错了/g, '这一步我们再核对一下'],
  [/除错了/g, '除法这一步再看看'],
  [/搞混了/g, '容易混在一起'],
  [/还没除/g, '还差最后一步除法'],
  [/不行/g, '暂时走不通'],
  [/不是这题问的/g, '还不是这题要的'],
  [/没回答/g, '还没有正面回答']
];

function normalize(s) {
  return String(s || '')
    .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[，。！？、：；""'']/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function matches(t, key) {
  const k = normalize(key);
  if (!k) return false;
  if (/^\d+(\.\d+)?$/.test(k)) {
    const esc = k.replace('.', '\\.');
    try {
      return new RegExp('(?<![\\d.])' + esc + '(?![\\d.])').test(t);
    } catch (e) {
      return t.indexOf(k) > -1;
    }
  }
  return t.indexOf(k) > -1;
}

/* 孩子常换词：把常见同义说法换成本应用里的词，再比对一次 */
const SYN = [
  [/平均分|均分|平分/g, '平均'],
  [/总共|一共|合计|共计|总计/g, '共'],
  [/剩下|剩余|还剩|余下/g, '剩'],
  [/相差|多多少|少多少/g, '差'],
  [/几倍|多少倍/g, '倍'],
  [/公里/g, '千米'],
  [/公斤/g, '千克'],
  [/块钱|元钱/g, '元']
];

const CN_NUM = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNIT = '(分钟|小时|千米|千克|公斤|秒钟|吨|克|米|元|岁|天|人|个|只|条|棵|盆|张|本|瓶|次|组|段|层|辆|台|件|箱|袋|枚|面|堆|份|倍|页|道|题|楼)';

function cnValue(s) {
  if (s === '十') return 10;
  if (s.length === 1) return CN_NUM[s];
  if (s[0] === '十') return 10 + (CN_NUM[s[1]] || 0);
  if (s[1] === '十') return (CN_NUM[s[0]] || 0) * 10 + (s[2] ? (CN_NUM[s[2]] || 0) : 0);
  return CN_NUM[s[0]];
}

function cn2num(t) {
  const re = new RegExp('([一二两三四五六七八九十]{1,3})(?=' + UNIT + ')', 'g');
  return t.replace(re, s => {
    const v = cnValue(s);
    return v == null ? s : String(v);
  });
}

function alt(t) {
  let out = t;
  SYN.forEach(p => { out = out.replace(p[0], p[1]); });
  return cn2num(out);
}

function covers(t, key) {
  const k = normalize(key);
  if (k.length < 3 || k.length > 12) return false;
  if (/^\d+(\.\d+)?$/.test(k)) return false;
  let i = 0;
  for (const ch of t) {
    if (ch === k[i]) {
      i++;
      if (i >= k.length) return true;
    }
  }
  return false;
}

const isNumKey = k => /^\d+(\.\d+)?$/.test(normalize(k));

function swallows(expHit, conf) {
  const e = normalize(expHit), c = normalize(conf.hit);
  return !!c && e !== c && e.indexOf(c) > -1;
}

function soften(s) {
  let out = String(s || '');
  SOFT.forEach(p => { out = out.replace(p[0], p[1]); });
  return out;
}

function quote(raw) {
  const s = String(raw || '').trim().replace(/^["“]|["”]$/g, '');
  return s.length > 18 ? s.slice(0, 18) + '…' : s;
}

function ensureAsk(s, step) {
  if (/[？?]/.test(s)) return s;
  return s + ' 我们回到这一步：' + step.q;
}

function findDomain(t) {
  for (const d of DOMAINS) {
    if (d.keys.some(k => t.indexOf(normalize(k)) > -1)) return d.name;
  }
  return null;
}

/* ---------- 判定 ---------- */
function analyze(text, step) {
  const t = normalize(text);
  if (!t) return { kind: 'empty', confidence: 0 };
  const t2 = alt(t);

  const expHit = (step.expect.keys || []).find(k => matches(t, k) || matches(t2, k) || covers(t, k));
  /* 孩子直接把答案说成“这一步要的那个词”（如“学生人数”“不是小明吃的”）也算说中 */
  const expLabel = normalize(step.expect.label || '');
  const labelHit = expLabel.length >= 2 && t.indexOf(expLabel) > -1;

  let conf = null;
  for (const rule of (step.confuse || [])) {
    const hit = (rule.keys || []).find(k => matches(t, k));
    if (hit) { conf = { rule, hit }; break; }
  }

  if (labelHit || (expHit && (!conf || isNumKey(expHit) || swallows(expHit, conf))))
    return { kind: 'ok', label: step.expect.label, confidence: .92 };
  if (conf)
    return { kind: 'confuse', rule: conf.rule, hit: conf.hit, confidence: .78 };

  for (const rule of (step.partial || [])) {
    const hit = (rule.keys || []).find(k => matches(t, k));
    if (hit) return { kind: 'partial', rule, hit, label: rule.label, confidence: .66 };
  }
  const domain = findDomain(t);
  const meta = /(问题|关于|求|问|考|属于|算是|有关)/.test(t);
  if (domain && (meta || t.length <= 6))
    return { kind: 'partial', domain, label: domain, confidence: .55 };

  if (t.length <= 2 || /(不知道|不会做|不会|不懂|没学过|没学|忘了|想不出|随便|嗯|啊|哦)/.test(t))
    return { kind: 'idk', confidence: .6 };

  return { kind: 'off', confidence: .4 };
}

/* ---------- 回话 ---------- */
function expectLine(step) {
  return (step.expect && step.expect.label) ? '这一步要的是“' + step.expect.label + '”。' : '';
}
function probeLine(step) {
  return step.probe ? '先想清楚「' + step.probe + '」这一件事。' : '';
}

function buildReply(a, step, raw) {
  if (a.kind === 'confuse') {
    const shown = a.hit && a.hit.length >= 2 ? a.hit : quote(raw);
    const core = String(a.rule.reply || '').replace('{hit}', shown);
    const lead = (shown && core.indexOf(shown) > -1) ? '' : '你写的是“' + quote(raw) + '”。';
    return soften(ensureAsk(lead + core, step));
  }
  if (a.kind === 'partial') {
    if (a.rule && a.rule.reply) return soften(ensureAsk(a.rule.reply, step));
    return soften(ensureAsk('你提到“' + (a.hit || a.domain || '这个方向') + '”，方向没有跑偏。'
      + expectLine(step) + probeLine(step) + '只说这一小步：' + step.q, step));
  }
  if (a.kind === 'idk') {
    const lead = /^(没关系|没事|不要紧)/.test(step.idk || '') ? '' : '没关系，我们把问题拆小一点。';
    return soften(ensureAsk(lead + (step.idk || ''), step));
  }
  if (a.kind === 'off') {
    let s = soften(step.off || '我听到的是“{hit}”，不过它还没有回答我问的这句。');
    s = s.replace('{hit}', quote(raw));
    if (!step.off) {
      s += expectLine(step);
      if (step.probe) s += '只做一件事：' + step.probe + '。';
    }
    return ensureAsk(s, step);
  }
  return soften(step.retry || step.q);
}

function tagOf(a, step) {
  if (a.kind === 'confuse' && a.rule.tag) return a.rule.tag;
  return step.tag;
}

function nextAction(a, step) {
  if (a.kind === 'ok') return { action: 'advance' };
  if (a.kind === 'partial') return { action: 'narrow', target: a.label };
  if (a.kind === 'confuse') return { action: 'repair', target: a.rule.label };
  if (a.kind === 'idk') return { action: 'scaffold', level: 1 };
  return { action: 'reanchor' };
}

/* ---------- 诊断汇总 ---------- */
function diagnose(sessions) {
  const dimAgg = {};
  DIMS.forEach(d => { dimAgg[d.key] = { sum: 0, n: 0 }; });
  const tags = {}, confusions = {};
  let steps = 0;

  sessions.forEach(s => {
    (s.log || []).forEach((l, i) => {
      const c = CASES.find(x => x.id === s.caseId);
      if (!c || !c.steps[i]) return;
      const step = c.steps[i];
      const d = dimAgg[step.dim];
      if (d) {
        const penalty = l.fails === 0 ? 0 : (l.fails === 1 ? 25 : (l.fails === 2 ? 45 : 60));
        d.sum += (100 - penalty);
        d.n++; steps++;
      }
      if (l.fails > 0) {
        tags[step.tag] = (tags[step.tag] || 0) + 1;
        if (l.mis) confusions[l.mis] = (confusions[l.mis] || 0) + 1;
      }
    });
  });

  const dims = DIMS.map(d => ({
    key: d.key,
    name: d.name,
    score: dimAgg[d.key].n ? Math.round(dimAgg[d.key].sum / dimAgg[d.key].n) : null,
    n: dimAgg[d.key].n
  }));

  return { dims, tags, confusions, steps, sessions: sessions.length };
}

module.exports = {
  normalize, matches, analyze, buildReply, tagOf, diagnose, nextAction, quote, soften
};
