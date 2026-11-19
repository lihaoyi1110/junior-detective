/* ==========================================================
   轻量图表（纯 SVG，无外部依赖）
   ========================================================== */
(function(){
  const ink = 'var(--ink)', muted = 'var(--muted)', lineCol = 'var(--line)',
        green = 'var(--green)', brass = 'var(--brass)', brick = 'var(--brick)',
        paper = 'var(--paper)';

  function radar(dims){
    const cx=160, cy=122, R=76, n=dims.length;
    const ang = i => -Math.PI/2 + i*2*Math.PI/n;
    const pt = (i,r) => [cx + Math.cos(ang(i))*r, cy + Math.sin(ang(i))*r];
    let grid='';
    [0.34,0.67,1].forEach(f=>{
      const p = dims.map((_,i)=>pt(i,R*f).map(v=>v.toFixed(1)).join(',')).join(' ');
      grid += `<polygon points="${p}" fill="none" stroke="${lineCol}" stroke-width="1"/>`;
    });
    dims.forEach((_,i)=>{
      const [x,y]=pt(i,R);
      grid += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${lineCol}" stroke-width="1"/>`;
    });
    const pts = dims.map((d,i)=>{
      const v = d.score==null ? 0 : d.score/100;
      const [x,y]=pt(i,Math.max(6,R*v));
      return [x,y];
    });
    const poly = pts.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
    let dots='', labels='';
    dims.forEach((d,i)=>{
      const [x,y]=pts[i];
      dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${brass}" stroke="${paper}" stroke-width="1.5"/>`;
      const [lx,ly]=pt(i,R+20);
      const anchor = Math.abs(lx-cx) < 8 ? 'middle' : (lx>cx?'start':'end');
      labels += `<text x="${lx.toFixed(1)}" y="${(ly+3).toFixed(1)}" text-anchor="${anchor}"
        font-size="11" fill="${muted}" font-family="var(--sans)">${d.name}</text>`;
      labels += `<text x="${lx.toFixed(1)}" y="${(ly+15).toFixed(1)}" text-anchor="${anchor}"
        font-size="10.5" fill="${ink}" font-family="var(--mono)">${d.score==null?'—':d.score}</text>`;
    });
    return `<svg viewBox="0 0 320 250" width="100%" height="auto" role="img" aria-label="五维能力雷达图">
      ${grid}
      <polygon points="${poly}" fill="rgba(18,58,46,.16)" stroke="${green}" stroke-width="1.6" stroke-linejoin="round"/>
      ${dots}${labels}
    </svg>`;
  }

  function bars(items){
    const h = Math.max(60, items.length*26 + 10);
    let s='';
    items.forEach((it,i)=>{
      const y = 12 + i*26;
      const w = Math.max(2, Math.round(it.value/Math.max(1,it.max)*128));
      s += `<text x="0" y="${y+9}" font-size="11.5" fill="${muted}" font-family="var(--sans)">${it.label}</text>`;
      s += `<rect x="74" y="${y}" width="128" height="10" fill="rgba(32,32,27,.07)"/>`;
      s += `<rect x="74" y="${y}" width="${w}" height="10" fill="${it.hot?brick:green}"/>`;
      s += `<text x="208" y="${y+9}" font-size="10.5" fill="${ink}" font-family="var(--mono)">${it.text||it.value}</text>`;
    });
    return `<svg viewBox="0 0 240 ${h}" width="100%" height="auto" role="img" aria-label="题型掌握度">${s}</svg>`;
  }

  function line(data){
    const W=330,H=132,padL=22,padB=22,padT=14;
    const max = 100, min = 0;
    const xs = i => padL + i*(W-padL-8)/Math.max(1,data.length-1);
    const ys = v => padT + (H-padT-padB)*(1-(v-min)/(max-min));
    let grid='';
    [0,50,100].forEach(v=>{
      grid += `<line x1="${padL}" y1="${ys(v)}" x2="${W-8}" y2="${ys(v)}" stroke="${lineCol}" stroke-dasharray="3 3"/>`;
      grid += `<text x="0" y="${ys(v)+3}" font-size="9" fill="${muted}" font-family="var(--mono)">${v}</text>`;
    });
    const pts = data.map((d,i)=>[xs(i),ys(d.v)]);
    const path = pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area = path + ` L${xs(data.length-1).toFixed(1)} ${ys(0)} L${xs(0).toFixed(1)} ${ys(0)} Z`;
    let dots='', labs='';
    pts.forEach((p,i)=>{
      dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="${green}"/>`;
      labs += `<text x="${p[0].toFixed(1)}" y="${H-6}" font-size="9" fill="${muted}" text-anchor="middle" font-family="var(--mono)">${data[i].d}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" role="img" aria-label="近七日独立完成率">
      <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(18,58,46,.22)"/><stop offset="100%" stop-color="rgba(18,58,46,0)"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#g1)"/>
      <path d="${path}" fill="none" stroke="${green}" stroke-width="1.8" stroke-linejoin="round"/>
      ${dots}${labs}
    </svg>`;
  }

  window.Charts = {radar, bars, line};
})();
