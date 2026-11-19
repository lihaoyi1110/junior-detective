/* ==========================================================
   轻量图表（Canvas 2D）
   小程序不渲染 SVG，这里按同样的几何关系重画三张图：
   五维雷达、题型条形、近六次折线。
   ========================================================== */

const C = {
  ink: '#20201B',
  muted: '#8B836E',
  line: 'rgba(32,32,27,.16)',
  green: '#123A2E',
  brass: '#B98C3C',
  brick: '#A63F2B',
  paper: '#FFFDF6'
};

/* 按设备像素比放大画布，返回已经缩放好的 2d 上下文 */
function setup(canvas, width, height, dpr) {
  const ratio = dpr || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

function font(ctx, size, family, color) {
  ctx.font = size + 'px ' + family;
  ctx.fillStyle = color;
}

const SERIF = '"Songti SC", Georgia, serif';
const SANS = '"PingFang SC", sans-serif';
const MONO = 'Menlo, Consolas, monospace';

function radar(ctx, w, h, dims) {
  const cx = w / 2;
  const cy = h / 2 + 2;
  const R = Math.min(w, h) / 2 - 34;
  const n = dims.length;
  const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];

  /* 网格 */
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  [0.34, 0.67, 1].forEach(f => {
    ctx.beginPath();
    dims.forEach((_, i) => {
      const p = pt(i, R * f);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.stroke();
  });
  dims.forEach((_, i) => {
    const p = pt(i, R);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p[0], p[1]);
    ctx.stroke();
  });

  /* 数据面 */
  const pts = dims.map((d, i) => {
    const v = d.score == null ? 0 : d.score / 100;
    return pt(i, Math.max(6, R * v));
  });
  ctx.beginPath();
  pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
  ctx.closePath();
  ctx.fillStyle = 'rgba(18,58,46,.16)';
  ctx.fill();
  ctx.strokeStyle = C.green;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  /* 顶点与标签 */
  dims.forEach((d, i) => {
    const p = pts[i];
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
    ctx.fillStyle = C.brass;
    ctx.fill();
    ctx.strokeStyle = C.paper;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const lp = pt(i, R + 20);
    const align = Math.abs(lp[0] - cx) < 8 ? 'center' : (lp[0] > cx ? 'left' : 'right');
    ctx.textAlign = align;
    font(ctx, 11, SANS, C.muted);
    ctx.fillText(d.name, lp[0], lp[1] + 4);
    font(ctx, 11, MONO, C.ink);
    ctx.fillText(d.score == null ? '—' : String(d.score), lp[0], lp[1] + 17);
  });
}

function bars(ctx, w, items) {
  const rowH = 30;
  items.forEach((it, i) => {
    const y = 10 + i * rowH;
    const barX = 82;
    const barW = Math.max(20, w - barX - 46);
    font(ctx, 11, SANS, C.muted);
    ctx.textAlign = 'left';
    ctx.fillText(it.label, 0, y + 13);

    ctx.fillStyle = 'rgba(32,32,27,.07)';
    ctx.fillRect(barX, y + 4, barW, 11);

    const val = Math.max(2, Math.round(barW * (it.value / Math.max(1, it.max))));
    ctx.fillStyle = it.hot ? C.brick : C.green;
    ctx.fillRect(barX, y + 4, val, 11);

    font(ctx, 11, MONO, C.ink);
    ctx.textAlign = 'left';
    ctx.fillText(it.text || String(it.value), barX + barW + 8, y + 14);
  });
}

function line(ctx, w, h, data) {
  const padL = 26, padB = 24, padT = 14;
  const xs = i => padL + i * (w - padL - 8) / Math.max(1, data.length - 1);
  const ys = v => padT + (h - padT - padB) * (1 - v / 100);

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  [0, 50, 100].forEach(v => {
    ctx.beginPath();
    ctx.moveTo(padL, ys(v));
    ctx.lineTo(w - 8, ys(v));
    ctx.stroke();
    font(ctx, 9, MONO, C.muted);
    ctx.textAlign = 'right';
    ctx.fillText(String(v), padL - 6, ys(v) + 3);
  });
  ctx.setLineDash([]);

  if (!data.length) return;

  /* 面积 */
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xs(i), y = ys(d.v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  const lastX = xs(data.length - 1);
  ctx.lineTo(lastX, ys(0));
  ctx.lineTo(xs(0), ys(0));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, padT, 0, ys(0));
  grad.addColorStop(0, 'rgba(18,58,46,.22)');
  grad.addColorStop(1, 'rgba(18,58,46,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  /* 折线 */
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xs(i), y = ys(d.v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = C.green;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  data.forEach((d, i) => {
    const x = xs(i), y = ys(d.v);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = C.green;
    ctx.fill();
    font(ctx, 9, MONO, C.muted);
    ctx.textAlign = 'center';
    ctx.fillText(d.d, x, h - 6);
  });
}

/* 在页面里取到 canvas 节点后调用；
   selector 需在 wxml 里给 canvas 一个固定高度 */
function draw(page, selector, kind, payload) {
  const query = page.createSelectorQuery();
  query.select(selector)
    .fields({ node: true, size: true })
    .exec(res => {
      const box = res && res[0];
      if (!box || !box.node) return;
      const canvas = box.node;
      const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2;
      const w = box.width;
      const h = box.height;
      if (!w || !h) return;
      const ctx = setup(canvas, w, h, dpr);
      if (kind === 'radar') radar(ctx, w, h, payload);
      else if (kind === 'bars') bars(ctx, w, payload);
      else if (kind === 'line') line(ctx, w, h, payload);
    });
}

module.exports = { draw, radar, bars, line };
