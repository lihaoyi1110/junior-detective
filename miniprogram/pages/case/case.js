/* ==========================================================
   孩子端 · 答题
   华生只追问，不直接给答案；判对走本地规则，判不准才请模型。
   ========================================================== */
const { CASES, DIMS } = require('../../model/cases.js');
const Engine = require('../../utils/engine.js');
const Store = require('../../utils/store.js');
const Model = require('../../utils/model.js');

const PRAISE = ['对。', '没错。', '就是这样。', '很好。'];
const VLABEL = {
  ok: '理解正确',
  partial: '方向对了，再具体一点',
  confuse: '发现一个理解偏差',
  idk: '需要搭把手',
  off: '这次没有对上问题'
};

function dimName(k) {
  const d = DIMS.find(x => x.key === k);
  return d ? d.name : '综合';
}
function plain(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
/* 只保留强调用的标签，其余尖括号内容一律去掉，避免把外部文字当富文本渲染 */
function safeHtml(s) {
  return String(s || '')
    .replace(/<(?!\/?(b|i|br|span)\b)[^>]*>/g, '')
    .replace(/&(?!(amp|lt|gt|quot|nbsp);)/g, '&amp;');
}
function dropAsk(s) {
  return String(s || '').replace(/[^。！？!?]*[？?]\s*$/, '').trim();
}
function stripAck(s) {
  return String(s || '').replace(/^(对|没错|很准|是的|很好|就是这样)[^。！？]{0,10}[。，,]\s*/, '');
}

Page({
  data: {
    ready: false,
    done: false,
    busy: false,
    draft: '',
    idx: 0,
    total: 0,
    dots: [],
    msgs: [],
    meta: {},
    closing: null
  },

  onLoad(query) {
    const c = CASES.find(x => x.id === query.id);
    if (!c) {
      wx.showToast({ title: '没有找到这份案卷', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.V = {
      c,
      i: 0,
      fails: 0,
      mis: '',
      hints: 0,
      stepWrong: null,
      busy: false,
      done: false,
      log: [],
      t0: Date.now(),
      token: 0,
      seq: 0,
      msgs: [
        { who: 'ai', intro: true, text: this.opening(c) },
        { who: 'ai', text: c.steps[0].q }
      ]
    };
    this.V.msgs.forEach(m => { m.id = 'm' + (++this.V.seq); });
    wx.setNavigationBarTitle({ title: c.no + ' · ' + c.type });
    this.paint(true);
  },

  /* 答题中途退出时让在途的模型请求失效，避免往已销毁的页面写数据 */
  onUnload() {
    if (this.V) this.V.token++;
  },

  /* 华生的开场白：说清这桩案子怎么查，不抢题干的注意力 */
  opening(c) {
    return '我是华生，你的侦探助手。这桩案子的关键线索是「' + c.tags[0] + '」。'
      + '我不替你算，只在你卡住的时候提醒你看哪儿——先说你看到的，再说你算到的。'
      + ' 随时可以点「给我一条线索」，我会退半步把台阶铺好。';
  },

  paint(scroll) {
    const V = this.V;
    const c = V.c;
    const dots = [];
    for (let k = 0; k < c.steps.length; k++) {
      dots.push(k < V.i ? 'done' : (k === V.i ? 'now' : ''));
    }
    this.setData({
      ready: true,
      done: V.done,
      busy: V.busy,
      idx: V.i,
      total: c.steps.length,
      dots,
      msgs: V.msgs,
      meta: {
        no: c.no,
        type: c.type,
        level: c.level,
        grade: c.grade,
        title: c.title,
        stem: c.stem
      }
    }, () => {
      if (scroll) wx.pageScrollTo({ scrollTop: 99999, duration: 160 });
    });
  },

  onInput(e) {
    this.setData({ draft: e.detail.value });
  },

  onConfirm() {
    this.send();
  },

  send() {
    const text = String(this.data.draft || '').trim();
    if (!text || this.V.busy || this.V.done) return;
    this.setData({ draft: '' });
    this.answer(text);
  },

  quick(e) {
    if (this.V.busy || this.V.done) return;
    const t = e.currentTarget.dataset.t;
    if (t === 'hint') this.hint();
    else if (t === 'reread') this.reread();
    else this.answer(t);
  },

  payload(text) {
    const V = this.V;
    const step = V.c.steps[V.i];
    const nx = V.c.steps[V.i + 1];
    return {
      case: { title: V.c.title, stem: V.c.stem, type: V.c.type, level: V.c.level, grade: V.c.grade },
      step: {
        q: step.q,
        probe: step.probe,
        expect: step.expect.label,
        keys: (step.expect.keys || []).slice(0, 10),
        index: V.i + 1,
        total: V.c.steps.length,
        confuse: (step.confuse || []).map(r => r.label),
        tag: step.tag
      },
      next: nx ? nx.q : '',
      history: V.msgs.filter(m => !m.typing).slice(-7, -1).map(m => ({ who: m.who, text: plain(m.text) })),
      answer: text
    };
  },

  /* 每条消息带一个稳定 id，避免列表复用时错位 */
  pushMsg(o) {
    o.id = 'm' + (++this.V.seq);
    this.V.msgs.push(o);
    return o;
  },

  async answer(text) {
    const V = this.V;
    const step = V.c.steps[V.i];

    const kid = this.pushMsg({ who: 'kid', text, verdict: '' });

    const local = (() => {
      const a = Engine.analyze(text, step);
      return {
        kind: a.kind,
        reply: a.kind === 'ok' ? '' : safeHtml(Engine.buildReply(a, step, text)),
        mis: a.kind === 'confuse' ? a.rule.label : '',
        label: a.label || ''
      };
    })();

    /* 本地判成“还没说对”、且孩子说了半句以上，才请模型判断卡在哪 */
    let r = null;
    const escalate = local.kind !== 'ok' && Engine.normalize(text).length >= 4;
    if (escalate && Model.enabled()) {
      V.busy = true;
      this.pushMsg({ who: 'ai', typing: true, text: '' });
      this.paint(true);
      const token = V.token;
      r = await Model.judge(this.payload(text));
      if (V.token !== token) return;
      V.msgs = V.msgs.filter(m => !m.typing);
      V.busy = false;
    }

    if (!r || !r.verdict) {
      r = { verdict: local.kind, reply: local.reply, misconception: local.mis, label: local.label, local: true };
    }

    const remote = !r.local;
    const replyOf = s => (remote ? safeHtml(s) : s);
    const kind = r.verdict;

    kid.verdict = VLABEL[kind] || VLABEL.off;
    kid.warn = (kind !== 'ok' && kind !== 'partial');

    if (kind === 'ok') {
      V.log.push({
        fails: V.fails, hint: V.hints, said: text, ok: true, mis: V.mis,
        firstWrong: V.stepWrong
      });
      if (V.i >= V.c.steps.length - 1) {
        this.finish();
        return;
      }
      const praise = PRAISE[V.i % PRAISE.length];
      V.i++; V.fails = 0; V.mis = ''; V.hints = 0; V.stepWrong = null;
      const nx = stripAck(V.c.steps[V.i].q);
      let said = (r.reply && String(r.reply).trim()) ? replyOf(r.reply) : praise;
      if (remote) {
        const kept = dropAsk(r.reply);
        said = kept ? safeHtml(kept) : praise;
      }
      V.msgs.push({ who: 'ai', id: 'm' + (++V.seq), text: said + (plain(said).indexOf(plain(nx)) >= 0 ? '' : ' ' + safeHtml(nx)) });
    } else if (kind === 'partial') {
      const said = (r.reply && String(r.reply).trim())
        ? replyOf(r.reply)
        : '你抓到的是“' + (r.label || '这个方向') + '”，方向没跑偏。我还想听更具体的一句：' + step.q;
      this.pushMsg({ who: 'ai', text: said });
    } else {
      V.fails++;
      if (kind === 'confuse') V.mis = r.misconception || r.mis || '理解偏差';
      let reply = (r.reply && String(r.reply).trim()) ? replyOf(r.reply) : '没关系，我们退回到这一步：' + step.q;
      /* 错题本只留这一步的第一次卡壳：孩子当时怎么答、华生当时怎么回 */
      if (!V.stepWrong) V.stepWrong = { said: text, reply: plain(reply), kind };
      if (V.fails >= 2 && step.hint && plain(reply).indexOf(step.hint) < 0) {
        reply += '<br/><span style="color:#4E4A3F">提示：' + safeHtml(step.hint) + '</span>';
      }
      this.pushMsg({ who: 'ai', text: reply });
    }
    this.paint(true);
  },

  hint() {
    const V = this.V;
    if (!V || V.done || V.busy) return;
    const step = V.c.steps[V.i];
    const ladder = [
      '我递来一张便笺：' + step.hint,
      '再退半步——' + step.l4,
      '我直接把这一步的结论写给你：' + step.expect.label + '。'
    ];
    const t = ladder[Math.min(V.hints, 2)];
    if (V.hints < 3) V.hints++;
    this.pushMsg({ who: 'ai', text: safeHtml(t) });
    this.paint(true);
  },

  reread() {
    const V = this.V;
    if (!V || V.done || V.busy) return;
    this.pushMsg({ who: 'ai', text: '我们再把案卷读一遍。<br/><br/>' + safeHtml(V.c.stem) });
    this.paint(true);
  },

  finish() {
    const V = this.V;
    const c = V.c;
    V.done = true;
    const dur = Math.round((Date.now() - V.t0) / 1000);
    const indep = V.log.filter(l => l.fails === 0).length;

    Store.add({
      caseId: c.id,
      ts: Date.now(),
      duration: dur,
      rounds: V.log.length + V.log.reduce((s, l) => s + (l.fails || 0), 0),
      independent: indep,
      total: c.steps.length,
      log: V.log
    });

    const failed = V.log.map((l, i) => ({ l, st: c.steps[i] })).filter(x => x.l.fails > 0);
    const advice = failed.length
      ? failed.map((x, i) => ({ id: 'ad' + i, dim: dimName(x.st.dim), tag: x.st.tag, say: (x.st.say || []).join(' ') }))
      : [{ id: 'ad0', dim: '全程独立', tag: '', say: (c.independentSay || []).join(' ') }];
    const tags = [];
    failed.forEach(x => { if (x.st.tag && tags.indexOf(x.st.tag) < 0) tags.push(x.st.tag); });

    this.setData({
      done: true,
      closing: {
        title: c.title,
        no: c.no,
        type: c.type,
        total: c.steps.length,
        indep,
        minutes: Math.max(1, Math.round(dur / 60)),
        advice,
        tags,
        lead: failed.length ? '有几处我搭了把手，但结论是你自己走到的。' : '全程自己推完，这个案子是你破的。'
      }
    }, () => wx.pageScrollTo({ scrollTop: 0, duration: 120 }));
  },

  backHome() {
    wx.navigateBack({
      fail() { wx.reLaunch({ url: '/pages/home/home' }); }
    });
  },

  toParent() {
    wx.navigateTo({ url: '/pages/parent/parent' });
  }
});
