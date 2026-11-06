/* =====================================================================
   ATOS — os verbos das cenas. Cada um recebe o andamento q (0 a 1) e
   as opções da cena. A = conjurador, B = alvo, C = centro da tela.
   Opções comuns: art (silhueta), em (A, B, C ou [x, y] em frações da
   tela), s (tamanho relativo), t ([início, fim] dentro do ato).
   ===================================================================== */
const posDe = (run, em, def = 'B') => {
  const e = em ?? def;
  if (Array.isArray(e)) return { x: run.w * e[0], y: run.h * e[1] };
  return run[e] || run.B;
};
const corDe = (run, o, i = 0) => { const p = PALETAS[o.cor] || DMG_COLORS[o.cor]; return p ? p[i] : o.cor !== undefined ? o.cor : run.pal[i]; };
const uma = (run, i, nome, fn) => { const k = `${i}:${nome}`; if (!run.f[k]) { run.f[k] = 1; fn(); } };
const tam = (run, o, def = .4) => (o.s ?? def) * run.U * (o.fixo ? 1 : Math.sqrt(run.K));
function zigue(c, a, b, passos, amp, rng) {
  c.moveTo(a.x, a.y);
  for (let k = 1; k <= passos; k++) {
    const t = k / passos, j = k === passos ? 0 : amp;
    c.lineTo(lerp(a.x, b.x, t) + (rng() - .5) * j, lerp(a.y, b.y, t) + (rng() - .5) * j);
  }
}
const ATOS = {
  /** Uma silhueta entra, respira e sai. giro, s0 (escala inicial), s1 (final), bob. */
  aparecer(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), T = tam(run, o), g = lerp(o.s0 ?? .4, o.s1 ?? 1, o.s0 !== undefined ? ease(q) : easeBack(clamp01(q * 3)));
    glow(c, p.x, p.y, T * .9 * g, corDe(run, o, 1), .5 * fadeIO(q));
    desenhaArte(c, o.art, p.x, p.y + Math.sin(q * 9) * (o.bob ?? 5), T * g, corDe(run, o), { a: fadeIO(q), rot: (o.giro || 0) * q * 6.28 + (o.rot || 0) });
  },
  /** Silhuetas vêm da borda da tela até o ponto, com um leve exagero. de: baixo, cima, esq, dir. n: quantas. */
  surgir(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), n = o.n || 1, T = tam(run, o), de = o.de || 'baixo', ab = o.abre ?? .34;
    for (let i = 0; i < n; i++) {
      const lado = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2 || 1) : 0, d = easeBack(clamp01(q * 2.2 - i * .12)), x = de === 'esq' || de === 'dir' ? p.x : p.x + lado * run.U * ab, y = de === 'esq' || de === 'dir' ? p.y + lado * run.U * ab : p.y;
      const fora = { baixo: [x, run.h + T], cima: [x, -T], esq: [-T, y], dir: [run.w + T, y] }[de], px = lerp(fora[0], x, d), py = lerp(fora[1], y, d);
      const rot = { baixo: 0, cima: Math.PI, esq: Math.PI / 2, dir: -Math.PI / 2 }[de] + lado * .3 + (o.rot || 0);
      glow(c, px, py, T * .8, corDe(run, o, 1), .45 * fadeIO(q));
      desenhaArte(c, o.art, px, py, T, corDe(run, o, i % 3 === 2 ? 2 : 0), { a: Math.min(1, (1 - q) * 6), rot, sx: i >= n / 2 && o.espelha ? -1 : 1 });
    }
  },
  /** Projétil do conjurador ao alvo. n: número, ou 'inst' para um por dado/ataque. Trata erro e saltos. */
  lancar(c, q, run, o, i) {
    const res = run.rec.res, lista = o.n === 'inst' ? res?.inst.filter(x => !x.salto) : null, n = lista?.length || (typeof o.n === 'number' ? o.n : 1);
    const A = posDe(run, o.de, 'A'), R = (o.s ?? .06) * run.U * Math.sqrt(run.K), voo = o.voo ?? (run.rec.res?.saltos ? .55 : .8);
    for (let k = 0; k < n; k++) {
      const tt = clamp01((q - k * .05) / voo), off = (k - (n - 1) / 2) * Math.min(46, run.U * .4 / n), info = lista?.[k], erra = info ? !info.hit : run.erro;
      const B = { x: run.B.x + off * 1.5 + (erra ? run.w * .45 : 0), y: run.B.y + (erra ? -run.h * .3 : 0) }, mx = (A.x + B.x) / 2 + (o.curva ?? (k % 2 ? 1 : -1)) * run.U * .28, my = (A.y + B.y) / 2;
      if (tt < 1) {
        const u = 1 - tt, x = u * u * A.x + 2 * u * tt * mx + tt * tt * B.x, y = u * u * A.y + 2 * u * tt * my + tt * tt * B.y;
        glow(c, x, y, R * 3.4, corDe(run, o, 1), .85); glow(c, x, y, R * 1.5, corDe(run, o, 2), 1);
        if (o.art) desenhaArte(c, o.art, x, y, R * 3.4, corDe(run, o), { rot: Math.atan2(B.y - A.y, B.x - A.x) + Math.PI / 2 + (o.artRot ?? 0) + (o.giro ? q * 30 : 0) });
        emit(x, y, 2, run, { v: 1, life: 20, size: 2.6, fixo: 1 });
      } else uma(run, i, `h${k}`, () => {
        if (erra) { emit(B.x, B.y, 8, run, { v: 2, life: 22, fixo: 1 }); return; }
        impactar(run, B.x, B.y, n > 1 ? .55 : 1);
        if (info && n > 1) part({ x: B.x, y: B.y - 12, vy: -1.4, c: '#fff', size: 26, max: 70, shape: 'txt', txt: info.total, drag: 1 });
      });
    }
    // Saltos do Orbe: arcos até novos alvos, um por salto.
    const sal = res?.saltos || 0;
    if (sal && o.salta) for (let k = 0; k < sal; k++) {
      const w0 = voo + k * ((1 - voo) / sal), tt = clamp01((q - w0) / ((1 - voo) / sal)), a = k ? { x: run.w * (k % 2 ? .78 : .22), y: run.h * .3 } : run.B, b = { x: run.w * (k % 2 ? .22 : .78), y: run.h * .3 };
      if (tt <= 0) continue;
      if (tt < 1) { const x = lerp(a.x, b.x, tt), y = lerp(a.y, b.y, tt) - sino(tt) * run.h * .16; glow(c, x, y, R * 3, corDe(run, o, 1), .9); glow(c, x, y, R * 1.3, corDe(run, o, 2), 1); }
      else uma(run, i, `s${k}`, () => { run.hitOrb = run.hit = run.now; impactar(run, b.x, b.y, .9); });
    }
  },
  /** Explosão no ponto. art opcional para a forma da explosão. */
  explodir(c, q, run, o, i) {
    const p = posDe(run, o.em), R = tam(run, o, .55) * ease(q), f = 1 - q;
    uma(run, i, 'h', () => impactar(run, p.x, p.y, o.e ?? 1));
    glow(c, p.x, p.y, R * 1.3, corDe(run, o, 1), .9 * f); glow(c, p.x, p.y, R * .75, corDe(run, o, 2), f);
    for (let k = 0; k < 2; k++) { const t = ease(clamp01(q * 1.3 - k * .18)); stroke(c, corDe(run, o, k), (7 - 4 * t) * Math.sqrt(run.K), 1 - t); c.beginPath(); c.arc(p.x, p.y, R * t * 1.2, 0, 7); c.stroke(); }
    c.globalAlpha = 1;
    if (o.art) desenhaArte(c, o.art, p.x, p.y, R * 1.4, corDe(run, o, 2), { a: f, rot: q * 1.2 });
  },
  /** Cone que abre do conjurador. */
  cone(c, q, run, o) {
    const A = posDe(run, o.de, 'A'), B = posDe(run, o.em), a0 = Math.atan2(B.y - A.y, B.x - A.x), arc = o.arco ?? .95, L = Math.hypot(B.x - A.x, B.y - A.y) * 1.55 * Math.sqrt(run.K) * ease(clamp01(q * 1.6)), f = fadeIO(q);
    const g = c.createRadialGradient(A.x, A.y, 0, A.x, A.y, Math.max(1, L));
    g.addColorStop(0, corDe(run, o, 2)); g.addColorStop(.5, corDe(run, o, 0)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.globalAlpha = .75 * f;
    c.beginPath(); c.moveTo(A.x, A.y); c.arc(A.x, A.y, L, a0 - arc / 2, a0 + arc / 2); c.closePath(); c.fill();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (q < .7) emit(A.x, A.y, 8, run, { a0: a0 - arc / 2, arc, v: 12, life: 34, size: 3.6, shape: o.part || 'dot', fixo: 1 });
  },
  /** Feixe reto. de: A, cima ou esq. larg: espessura. */
  feixe(c, q, run, o, i) {
    const B = posDe(run, o.em), A = o.de === 'cima' ? { x: B.x + (o.dx || 0), y: -20 } : o.de === 'esq' ? { x: -20, y: B.y } : posDe(run, o.de, 'A'), g = ease(clamp01(q * 2.4)), x = lerp(A.x, B.x, g), y = lerp(A.y, B.y, g), f = fadeIO(q), W = (o.larg ?? 14) * Math.sqrt(run.K);
    c.globalCompositeOperation = 'lighter';
    stroke(c, corDe(run, o, 1), W * 2.2, .45 * f); c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(x, y); c.stroke();
    stroke(c, corDe(run, o, 0), W, .8 * f); c.stroke();
    stroke(c, corDe(run, o, 2), W * .32, f); c.stroke();
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    glow(c, x, y, W * 3.4, corDe(run, o, 2), f);
    if (g > .98) { uma(run, i, 'h', () => impactar(run, B.x, B.y)); emit(B.x, B.y, 3, run, { v: 4, life: 22, fixo: 1 }); }
  },
  /** Relâmpago que cai do céu. n: quantos. */
  raio(c, q, run, o, i) {
    const n = o.n || 1;
    for (let k = 0; k < n; k++) {
      const tt = clamp01(q * n * .9 - k * .8), B = n > 1 ? { x: run.w * (.2 + .6 * ((k * 37 % n) + .5) / n), y: run.h * (.42 + (k % 2) * .1) } : posDe(run, o.em);
      if (tt <= 0 || tt >= 1) continue;
      const a = { x: B.x + (run.rng() - .5) * 120, y: -10 }, f = 1 - tt;
      c.globalCompositeOperation = 'lighter';
      stroke(c, corDe(run, o, 1), 12, .5 * f); c.beginPath(); zigue(c, a, B, 11, 62, run.rng); c.stroke();
      stroke(c, corDe(run, o, 2), 3.4, f); c.stroke();
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      uma(run, i, `h${k}`, () => impactar(run, B.x, B.y, n > 1 ? .6 : 1));
      glow(c, B.x, B.y, 90, corDe(run, o, 2), f);
    }
  },
  /** Corrente de energia que salta de alvo em alvo. n: elos. */
  cadeia(c, q, run, o, i) {
    const n = o.n || 3, pts = [run.A];
    for (let k = 0; k < n; k++) pts.push({ x: run.w * (k % 2 ? .24 + k * .04 : .76 - k * .04), y: run.h * (.5 - k * .09) });
    const vis = Math.min(n, Math.ceil(q * (n + 1)));
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < vis; k++) {
      stroke(c, corDe(run, o, 1), 9, .55); c.beginPath(); zigue(c, pts[k], pts[k + 1], 9, 44, run.rng); c.stroke();
      stroke(c, corDe(run, o, 2), 2.8, 1); c.stroke();
      glow(c, pts[k + 1].x, pts[k + 1].y, 54, corDe(run, o, 2), .8);
      uma(run, i, `h${k}`, () => impactar(run, pts[k + 1].x, pts[k + 1].y, .7));
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  },
  /** Cai do alto: gota, neve, brasa, pena, folha, areia, lamina, pedra, meteoro ou art. */
  chover(c, q, run, o) {
    const { rng, w } = run, forma = o.forma || 'gota', d = (o.d ?? 3) * (o.fixo ? 1 : run.K), ang = o.vento ?? -2;
    if (q > (o.ate ?? .82)) return;
    for (let k = 0; k < d; k++) {
      if (rng() > .9) continue;
      const x = rng() * (w + 120), cor = corDe(run, o, Math.floor(rng() * 3));
      if (o.art) part({ x, y: -30, vx: ang, vy: o.v ?? 6, c: cor, size: tam(run, o, .1), max: 90, shape: 'art', art: o.art, gira: .03, drag: 1 });
      else if (forma === 'gota') part({ x, y: -12, vx: ang, vy: 15 + rng() * 6, c: cor, size: 2, max: 62, shape: 'streak', drag: 1 });
      else if (forma === 'neve') part({ x, y: -8, vx: ang * .5 + (rng() - .5), vy: 2 + rng() * 3, c: cor, size: 2.6, max: 120, drag: 1 });
      else if (forma === 'brasa') part({ x, y: -8, vx: ang, vy: 5 + rng() * 5, c: cor, size: 3, max: 110, shape: 'spark', drag: 1 });
      else if (forma === 'pena') part({ x, y: -14, vx: Math.sin(x) * 1.2, vy: 1.6 + rng(), c: cor, size: 8, max: 150, shape: 'pena', drag: 1 });
      else if (forma === 'folha') part({ x, y: -10, vx: ang * .6 + rng(), vy: 2.6 + rng() * 2, c: cor, size: 6, max: 130, shape: 'folha', drag: 1 });
      else if (forma === 'areia') part({ x: run.B.x + (rng() - .5) * run.U * .9, y: -6, vy: 4 + rng() * 2, c: cor, size: 1.6, max: 100, drag: 1 });
      else if (forma === 'lamina') part({ x, y: -10, vx: ang, vy: 16 + rng() * 5, c: cor, size: 5, max: 56, shape: 'diamond', drag: 1 });
      else if (forma === 'pedra') part({ x, y: -14, vx: ang, vy: 12 + rng() * 6, c: cor, size: 7, max: 60, shape: 'diamond', g: .3, drag: 1 });
    }
  },
  /** Muralha que sobe do chão. estilo: fogo, gelo, pedra, vento, espinho, forca, laminas. */
  muralha(c, q, run, o) {
    const est = o.estilo || 'forca', p = posDe(run, o.em, [.5, .62]), W = o.larg ? run.w * o.larg : run.w + 40, H = (o.alto ?? .62) * run.U * Math.sqrt(run.K) * ease(clamp01(q * 2)) + run.h - (p.y + run.U * .12), f = fadeIO(q), base = run.h + 4;
    const g = c.createLinearGradient(0, base, 0, base - H);
    g.addColorStop(0, corDe(run, o, 1)); g.addColorStop(.7, corDe(run, o, 0)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.globalAlpha = (est === 'vento' || est === 'forca' ? .42 : .9) * f;
    c.beginPath(); c.moveTo(p.x - W / 2, base);
    const n = est === 'espinho' ? 16 : est === 'gelo' ? 12 : est === 'pedra' ? 7 : 20;
    for (let k = 0; k <= n; k++) {
      const x = p.x - W / 2 + W * k / n, onda = est === 'fogo' ? Math.sin(k * 1.7 + q * 22) * .24 : est === 'vento' ? Math.sin(k + q * 15) * .1 : (k * 37 % 7) / 7 * .3;
      c.lineTo(x, base - H * (1 - onda - (est === 'espinho' || est === 'gelo' ? (k % 2) * .34 : 0)));
    }
    c.lineTo(p.x + W / 2, base); c.closePath(); c.fill(); c.globalAlpha = 1;
    if (est === 'fogo') emit(p.x + (run.rng() - .5) * W, base - H * .6, 4, run, { a0: -1.9, arc: .7, v: 5, life: 26, fixo: 1 });
    if (est === 'vento') { stroke(c, corDe(run, o, 2), 1.5, .6 * f); for (let k = 0; k < 7; k++) { c.beginPath(); const y = base - H * (k + .5) / 7, x0 = p.x - W / 2 + ((q * 3 + k * .3) % 1) * W; c.moveTo(x0, y); c.quadraticCurveTo(x0 + 40, y - 12, x0 + 80, y); c.stroke(); } c.globalAlpha = 1; }
    if (est === 'laminas') { for (let k = 0; k < 9; k++) { const x = p.x - W / 2 + ((k / 9 + q * 1.6) % 1) * W; desenhaArte(c, o.art || 'spinning-blades', x, base - H * .5 + Math.sin(k + q * 10) * H * .3, 44, corDe(run, o, 2), { rot: q * 30 + k, a: f }); } }
    if (est === 'forca' || est === 'gelo') { stroke(c, corDe(run, o, 2), 2, .8 * f); c.beginPath(); c.moveTo(p.x - W / 2, base - H); c.lineTo(p.x + W / 2, base - H); c.stroke(); c.globalAlpha = 1; }
  },
  /** Cúpula ou esfera protetora. cheia: esfera inteira. */
  cupula(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), R = tam(run, o, .42) * easeBack(clamp01(q * 2.2)), f = Math.min(1, (1 - q) * 5), ini = o.cheia ? 0 : Math.PI;
    glow(c, p.x, p.y, R * 1.3, corDe(run, o, 1), .4 * f);
    c.fillStyle = corDe(run, o, 1); c.globalAlpha = .2 * f; c.beginPath(); c.arc(p.x, p.y, R, ini, ini + (o.cheia ? 7 : Math.PI)); c.fill();
    stroke(c, corDe(run, o, 0), 3, f); c.beginPath(); c.arc(p.x, p.y, R, ini, ini + (o.cheia ? 7 : Math.PI)); c.stroke();
    stroke(c, corDe(run, o, 2), 1.2, .7 * f);
    for (let k = 1; k < 5; k++) { c.beginPath(); c.ellipse(p.x, p.y, R, R * k / 5, 0, ini, ini + (o.cheia ? 7 : Math.PI)); c.stroke(); c.beginPath(); c.ellipse(p.x, p.y, R * k / 5, R, 0, ini, ini + (o.cheia ? 7 : Math.PI)); c.stroke(); }
    c.globalAlpha = 1;
    const a = q * 14; if (q > .1) glow(c, p.x + Math.cos(a) * R, p.y - Math.abs(Math.sin(a)) * R, 26, corDe(run, o, 2), f);
  },
  /** Círculo mágico no chão, em perspectiva. */
  circulo(c, q, run, o) {
    const p = posDe(run, o.em, [.5, .66]), R = tam(run, o, .46) * ease(clamp01(q * 2.4)), f = fadeIO(q), lados = o.lados || 6, rot = q * 3 * (o.giro ?? 1);
    c.save(); c.translate(p.x, p.y); c.scale(1, o.plano ?? .38);
    glow(c, 0, 0, R * 1.3, corDe(run, o, 1), .55 * f);
    stroke(c, corDe(run, o, 0), 3, f);
    c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke(); c.beginPath(); c.arc(0, 0, R * .8, 0, 7); c.stroke();
    c.rotate(rot); c.beginPath();
    for (let k = 0; k <= lados; k++) { const a = k * (lados % 2 ? 2 : 1) * 2 * Math.PI / lados; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * R * .8, Math.sin(a) * R * .8); }
    c.stroke();
    c.font = `${R * .16}px serif`; c.textAlign = 'center'; c.fillStyle = corDe(run, o, 2);
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; c.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'[k], Math.cos(a) * R * .9, Math.sin(a) * R * .9); }
    c.restore(); c.globalAlpha = 1;
    if (o.art) desenhaArte(c, o.art, p.x, p.y - R * .36, R * .9, corDe(run, o, 2), { a: sino(q) });
    emit(p.x + (run.rng() - .5) * R * 1.6, p.y, 1, run, { a0: -1.7, arc: .3, v: 3, life: 34, fixo: 1 });
  },
  /** Correntes que vêm das bordas e prendem o ponto. */
  correntes(c, q, run, o) {
    const p = posDe(run, o.em), n = o.n || 4, g = ease(clamp01(q * 1.8)), f = fadeIO(q);
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.28 + .6, ini = { x: p.x + Math.cos(a) * run.U, y: p.y + Math.sin(a) * run.U }, fim = { x: lerp(ini.x, p.x, g), y: lerp(ini.y, p.y, g) }, elos = 12;
      for (let e = 0; e < elos; e++) {
        const t = e / elos, x = lerp(ini.x, fim.x, t), y = lerp(ini.y, fim.y, t);
        stroke(c, corDe(run, o, e % 2 ? 1 : 0), 3, f); c.beginPath(); c.ellipse(x, y, 11, 6, a + (e % 2 ? 1.5 : 0), 0, 7); c.stroke();
      }
    }
    c.globalAlpha = 1;
    if (o.art) desenhaArte(c, o.art, p.x, p.y, tam(run, o, .24), corDe(run, o, 2), { a: f });
  },
  /** Bando que cruza a tela: morcegos, insetos, espíritos. art e n. */
  revoada(c, q, run, o, i) {
    const n = o.n || 12, T = tam(run, o, .12);
    if (!run.f[`rv${i}`]) run.f[`rv${i}`] = Array.from({ length: n }, () => ({ y: run.rng(), a: run.rng() * 6, v: .7 + run.rng() * .6, d: run.rng() * .3 }));
    run.f[`rv${i}`].forEach(b => {
      const t = clamp01((q - b.d) / (1 - b.d) * b.v * 1.3), ida = o.dir === -1 ? 1 - t : t, x = lerp(-T, run.w + T, ida), y = run.h * (.18 + b.y * .6) + Math.sin(t * 9 + b.a) * 34;
      if (t > 0 && t < 1) desenhaArte(c, o.art, x, y, T * (.7 + b.v * .4), corDe(run, o, 0), { sx: o.dir === -1 ? -1 : 1, brilho: .6, a: .95 });
    });
  },
  /** Vinhas que sobem do chão e se enroscam. */
  vinhas(c, q, run, o) {
    const n = o.n || 7, g = ease(clamp01(q * 1.8)), f = Math.min(1, (1 - q) * 5), B = posDe(run, o.em, 'C');
    for (let k = 0; k < n; k++) {
      const x0 = run.w * (k + .5) / n, cor = corDe(run, o, k % 2 ? 1 : 0);
      stroke(c, cor, 7 - k % 3, f); c.beginPath(); c.moveTo(x0, run.h + 10);
      let px = x0, py = run.h;
      for (let s = 1; s <= 24 * g; s++) {
        const t = s / 24, nx = lerp(x0, B.x + (k - n / 2) * 12, t * t) + Math.sin(t * 8 + k) * 34, ny = lerp(run.h, B.y, t);
        c.lineTo(nx, ny);
        if (s % 5 === 0) { c.stroke(); c.fillStyle = corDe(run, o, 0); c.beginPath(); c.ellipse(nx + 8, ny, 9, 4, k + s, 0, 7); c.fill(); c.beginPath(); c.moveTo(nx, ny); }
        px = nx; py = ny;
      }
      c.stroke();
      if (o.flor) desenhaArte(c, o.flor, px, py, 26, corDe(run, o, 2), { a: f });
    }
    c.globalAlpha = 1;
  },
  /** Tentáculos grossos que ondulam. */
  tentaculos(c, q, run, o) {
    const n = o.n || 6, g = ease(clamp01(q * 1.7)), f = Math.min(1, (1 - q) * 5), B = posDe(run, o.em, 'C');
    for (let k = 0; k < n; k++) {
      const x0 = run.w * (k + .5) / n, passos = 34;
      for (let s = 0; s < passos * g; s++) {
        const t = s / passos, x = lerp(x0, B.x, t * .85) + Math.sin(t * 7 + q * 9 + k * 2) * 46 * t, y = lerp(run.h + 20, B.y, t);
        c.fillStyle = corDe(run, o, s % 7 ? 1 : 0); c.globalAlpha = f; c.beginPath(); c.arc(x, y, (24 - 18 * t) * Math.sqrt(run.K), 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
  },
  /** Ondas concêntricas: som, pulso, vibração. */
  ondas(c, q, run, o) {
    const p = posDe(run, o.em), n = o.n || 4, R = tam(run, o, .9);
    for (let k = 0; k < n; k++) { const t = (q * 1.4 + k / n) % 1; stroke(c, corDe(run, o, k % 3), 6 * (1 - t) + 1, (1 - t) * fadeIO(q)); c.beginPath(); c.arc(p.x, p.y, R * t, o.ini ?? 0, o.fim ?? 7); c.stroke(); }
    c.globalAlpha = 1;
  },
  /** Onda gigante que varre a tela. */
  mare(c, q, run, o, i) {
    const x = lerp(-run.w * .5, run.w * 1.3, ease(q)), topo = run.h * (1 - (o.alto ?? .78)), f = Math.min(1, (1 - q) * 6);
    c.beginPath(); c.moveTo(-10, run.h);
    for (let px = -10; px <= x; px += 16) { const crista = Math.exp(-Math.pow((px - x + 70) / 120, 2)); c.lineTo(px, run.h - (run.h - topo) * (.55 + .45 * crista) + Math.sin(px * .03 + q * 14) * 14); }
    c.lineTo(x + 20, run.h); c.closePath();
    const g = c.createLinearGradient(0, topo, 0, run.h); g.addColorStop(0, corDe(run, o, 0)); g.addColorStop(1, corDe(run, o, 1));
    c.fillStyle = g; c.globalAlpha = .92 * f; c.fill(); c.globalAlpha = 1;
    emit(x, topo + 30, 6, run, { a0: -2.4, arc: 1.4, v: 7, life: 30, c: corDe(run, o, 2), fixo: 1 });
    if (q > .4) uma(run, i, 'h', () => impactar(run, run.w / 2, run.h * .5));
  },
  /** Coluna de vento em espiral. */
  tornado(c, q, run, o) {
    const p = posDe(run, o.em, [.5, .78]), H = run.h * .7 * ease(clamp01(q * 1.8)), f = fadeIO(q);
    for (let k = 0; k < 26; k++) {
      const t = k / 26, r = (12 + t * run.U * .3) * Math.sqrt(run.K), y = p.y - H * t, a = q * 34 + k * .7;
      stroke(c, corDe(run, o, k % 3), 3, f * .75); c.beginPath(); c.ellipse(p.x + Math.sin(t * 5 + q * 8) * 18, y, r, r * .26, 0, a, a + 4.2); c.stroke();
    }
    c.globalAlpha = 1;
    emit(p.x + (run.rng() - .5) * 200, p.y - run.rng() * H, 2, run, { v: 6, life: 24, fixo: 1 });
  },
  /** Rachaduras que correm pela tela. */
  fendas(c, q, run, o, i) {
    const p = posDe(run, o.em, [.5, .7]), n = o.n || 7, g = ease(clamp01(q * 2));
    if (!run.f[`fd${i}`]) run.f[`fd${i}`] = Array.from({ length: n }, (_, k) => { let a = k / n * 6.28 + run.rng(), x = p.x, y = p.y; const pts = [[x, y]]; for (let s = 0; s < 9; s++) { a += (run.rng() - .5) * .9; const d = run.U * .12 * (.6 + run.rng()); x += Math.cos(a) * d; y += Math.sin(a) * d * .7; pts.push([x, y]); } return pts; });
    uma(run, i, 'h', () => impactar(run, p.x, p.y, o.e ?? 1));
    const f = Math.min(1, (1 - q) * 5);
    run.f[`fd${i}`].forEach(pts => {
      const vis = Math.ceil(pts.length * g);
      stroke(c, '#000', 7, f); c.beginPath(); pts.slice(0, vis).forEach((pt, k) => c[k ? 'lineTo' : 'moveTo'](pt[0], pt[1])); c.stroke();
      stroke(c, corDe(run, o, 0), 2.4, f); c.stroke();
    });
    c.globalAlpha = 1;
  },
  /** Nuvem que incha. largo: ocupa a tela. */
  nuvem(c, q, run, o, i) {
    const p = posDe(run, o.em), S = tam(run, o, .42), f = fadeIO(q), n = o.n || 12;
    if (!run.f[`nv${i}`]) run.f[`nv${i}`] = Array.from({ length: n }, () => ({ x: (run.rng() - .5) * (o.largo ? run.w * 1.2 : S * 2), y: (run.rng() - .5) * S, r: S * (.5 + run.rng() * .6) }));
    const op = c.globalCompositeOperation;
    run.f[`nv${i}`].forEach((b, k) => {
      const r = b.r * ease(clamp01(q * 1.6 + k * .02)), x = p.x + b.x + Math.sin(q * 5 + k) * 12, y = p.y + b.y;
      const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, r)); g.addColorStop(0, corDe(run, o, k % 2)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.globalAlpha = (o.op ?? .42) * f; c.beginPath(); c.arc(x, y, Math.max(1, r), 0, 7); c.fill();
    });
    c.globalAlpha = 1; c.globalCompositeOperation = op;
  },
  /** Cópias da silhueta que se abrem em leque. */
  espelhos(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), n = o.n || 3, T = tam(run, o, .34), g = ease(clamp01(q * 1.8)), f = fadeIO(q);
    for (let k = n; k >= -n; k--) {
      const x = p.x + k * T * .55 * g + Math.sin(q * 8 + k) * 5, real = k === 0;
      desenhaArte(c, o.art, x, p.y, T, corDe(run, o, real ? 2 : k % 2 ? 0 : 1), { a: f * (real ? 1 : .55), sx: k < 0 ? -1 : 1 });
    }
  },
  /** A silhueta se parte em cacos. */
  quebrar(c, q, run, o, i) {
    const p = posDe(run, o.em, 'C'), T = tam(run, o, .4);
    if (q < .4) { const t = sino(q * 2.5 * .4 + .1); desenhaArte(c, o.art, p.x + (run.rng() - .5) * q * 18, p.y, T, corDe(run, o), { a: 1 }); }
    else uma(run, i, 'h', () => { impactar(run, p.x, p.y, o.e ?? .7); emit(p.x, p.y, 50, run, { v: 8, life: 42, size: 7, shape: 'diamond', g: .16, fixo: 1 }); });
  },
  /** Portal oval com redemoinho. */
  portal(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), f = sino(q), W = tam(run, o, .24) * f;
    glow(c, p.x, p.y, W * 2.2, corDe(run, o, 1), .85 * f);
    for (let k = 0; k < 5; k++) { stroke(c, corDe(run, o, k % 3), 3.4 - k * .4, f); c.beginPath(); c.ellipse(p.x, p.y, W * (1 - k * .16), W * 1.65 * (1 - k * .16), q * 3 * (k % 2 ? 1 : -1), 0, 7); c.stroke(); }
    c.globalAlpha = 1;
    if (o.art) desenhaArte(c, o.art, p.x, p.y, W * 1.3, corDe(run, o, 2), { a: f });
    emit(p.x, p.y, 2, run, { v: 3, life: 26, fixo: 1 });
  },
  /** Uma silhueta vira outra. de e para. */
  transformar(c, q, run, o, i) {
    const p = posDe(run, o.em, 'C'), T = tam(run, o, .42), meio = .5, t = (q - meio) * 8, a = clamp01(.5 - t), b = clamp01(.5 + t);
    desenhaArte(c, o.de, p.x, p.y, T * (1 - clamp01(q / meio) * .1), corDe(run, o, 0), { a: a * Math.min(1, q * 6), sx: 1 - clamp01(t + .6) * .6 });
    desenhaArte(c, o.para, p.x, p.y, T * easeBack(clamp01((q - meio) * 2.4)), corDe(run, o, 2), { a: b * Math.min(1, (1 - q) * 6), sx: 1 });
    glow(c, p.x, p.y, T * sino(q), corDe(run, o, 2), .8 * Math.exp(-t * t));
    if (q > meio) uma(run, i, 'p', () => emit(p.x, p.y, 36, run, { v: 6, life: 34, shape: 'spark', fixo: 1 }));
  },
  /** Palavra grande na tela. */
  palavra(c, q, run, o) {
    const p = posDe(run, o.em, [.5, .44]), t = easeBack(clamp01(q * 3.4)), f = fadeIO(q), px = (o.s ?? .17) * run.U;
    c.save(); c.translate(p.x + (run.rng() - .5) * (o.treme || 0), p.y); c.scale(t, t);
    c.font = `700 ${px}px ${run.fonte}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.globalAlpha = f; c.lineWidth = 7; c.strokeStyle = corDe(run, o, 1); c.strokeText(o.txt, 0, 0); c.fillStyle = corDe(run, o, 2); c.fillText(o.txt, 0, 0);
    c.restore(); c.globalAlpha = 1;
  },
  /** Silhuetas ou letras sobem devagar. art ou txt. */
  subir(c, q, run, o) {
    const p = posDe(run, o.em, [.5, .7]), { rng } = run;
    if (q < .8 && rng() < (o.d ?? .4)) {
      const x = p.x + (rng() - .5) * run.U * (o.l ?? .8), s = (o.tam ?? .1) * run.U * (.7 + rng() * .6), cor = corDe(run, o, Math.floor(rng() * 3));
      if (o.txt) part({ x, y: p.y, vy: -(o.v ?? 1.6), c: cor, size: s * .8, max: 70, shape: 'txt', txt: o.txt, drag: 1 });
      else part({ x, y: p.y, vy: -(o.v ?? 1.8), vx: (rng() - .5), c: cor, size: s, max: 72, shape: 'art', art: o.art, gira: .006, drag: 1 });
    }
  },
  /** Silhuetas orbitam o ponto. */
  orbitar(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), n = o.n || 5, R = tam(run, o, .36) * ease(clamp01(q * 2)), T = (o.tam ?? .13) * run.U, f = fadeIO(q);
    for (let k = 0; k < n; k++) { const a = k / n * 6.28 + q * (o.giro ?? 7), z = Math.sin(a); desenhaArte(c, o.art, p.x + Math.cos(a) * R, p.y + z * R * (o.plano ?? .42), T * (.8 + z * .25), corDe(run, o, k % 3), { a: f * (.65 + z * .35), rot: o.gira ? a : 0 }); }
  },
  /** Aura que sobe em volta do ponto. */
  aura(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), R = tam(run, o, .3), f = sino(q);
    glow(c, p.x, p.y, R * 1.8, corDe(run, o, 1), .55 * f); glow(c, p.x, p.y, R * .9, corDe(run, o, 2), .5 * f);
    for (let k = 0; k < 3; k++) { const t = (q * 1.6 + k / 3) % 1; stroke(c, corDe(run, o, k), 2.4, (1 - t) * f); c.beginPath(); c.ellipse(p.x, p.y + R * .9 - t * R * 2, R * (1 - t * .5), R * .28 * (1 - t * .5), 0, 0, 7); c.stroke(); }
    c.globalAlpha = 1;
    emit(p.x + (run.rng() - .5) * R * 1.8, p.y + R * .6, 2, run, { a0: -1.7, arc: .3, v: 3.2, life: 34, size: 2.2, fixo: 1 });
  },
  /** A escuridão fecha sobre a tela. */
  trevas(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), R = Math.max(run.w, run.h) * lerp(1.1, o.ate ?? .16, ease(clamp01(q * 1.5))), f = Math.min(1, (1 - q) * 5), g = c.createRadialGradient(p.x, p.y, R * .3, p.x, p.y, R);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(2,1,6,${(o.op ?? .97) * f})`);
    c.fillStyle = g; c.fillRect(-40, -40, run.w + 80, run.h + 80);
  },
  /** Luz que irrompe, com raios. */
  clarao(c, q, run, o, i) {
    const p = posDe(run, o.em, 'C'), f = sino(q), n = o.n || 14, R = Math.max(run.w, run.h) * (o.s ?? .75) * ease(q) * Math.sqrt(run.K);
    glow(c, p.x, p.y, R * .8, corDe(run, o, 2), .9 * f); glow(c, p.x, p.y, R * .36, '#fff', f);
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.28 + q * .7; stroke(c, corDe(run, o, 0), k % 2 ? 7 : 3, .7 * f);
      c.beginPath(); c.moveTo(p.x + Math.cos(a) * R * .2, p.y + Math.sin(a) * R * .2); c.lineTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); c.stroke();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (o.bate !== 0) uma(run, i, 'h', () => impactar(run, p.x, p.y, o.e ?? 1));
  },
  /** Pontos que cintilam em volta. */
  brilhos(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), R = tam(run, o, .5), { rng } = run, n = o.n ?? 2;
    for (let k = 0; k < n; k++) if (rng() < .7) {
      const x = p.x + (rng() - .5) * R * 2, y = p.y + (rng() - .5) * R * 2, s = 5 + rng() * 9;
      part({ x, y, c: corDe(run, o, Math.floor(rng() * 3)), size: s, max: 26, shape: 'estrela', drag: 1 });
    }
  },
  /** Criatura alvo e como ela reage: treme, flutua, cai, dorme, congela, some, encolhe, cresce, foge. */
  alvo(c, q, run, o) {
    const p = posDe(run, o.em), T = tam(run, o, .36), r = o.reage || 'treme', cor = o.cor !== undefined ? corDe(run, o) : '#c9ccd6', f = Math.min(1, q * 7, (1 - q) * 7);
    let x = p.x, y = p.y, rot = 0, esc = 1, a = f;
    if (r === 'treme') x += Math.sin(q * 70) * 7;
    if (r === 'flutua') y -= sino(Math.min(1, q * 1.2) * .5) * T * .7 + Math.sin(q * 12) * 5;
    if (r === 'cai') { rot = ease(clamp01(q * 1.8 - .5)) * 1.5; y += ease(clamp01(q * 1.8 - .5)) * T * .3; }
    if (r === 'dorme') { rot = ease(clamp01(q * 2 - .3)) * 1.45; y += ease(clamp01(q * 2 - .3)) * T * .3; a *= 1 - clamp01(q - .8) * 3; }
    if (r === 'some') a *= 1 - clamp01(q * 1.6 - .3);
    if (r === 'encolhe') esc = lerp(1, .3, ease(clamp01(q * 1.6)));
    if (r === 'cresce') esc = lerp(.7, 1.7, ease(clamp01(q * 1.6)));
    if (r === 'foge') x += easeIn(clamp01(q * 1.3)) * run.w * .7;
    desenhaArte(c, o.art || 'person', x, y, T * esc, cor, { a, rot, brilho: o.brilho ?? .4 });
    if (r === 'congela') { const g = clamp01(q * 2); c.fillStyle = corDe(run, o, 0); c.globalAlpha = .36 * g * f; c.fillRect(x - T * .4, y + T * .5 - T * g, T * .8, T * g); stroke(c, corDe(run, o, 2), 2, .9 * g * f); c.strokeRect(x - T * .4, y + T * .5 - T * g, T * .8, T * g); c.globalAlpha = 1; }
  },
  /** Runas que giram em volta do ponto. */
  runas(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), R = tam(run, o, .34) * ease(clamp01(q * 2)), f = fadeIO(q), n = o.n || 9;
    c.font = `${(o.tam ?? .06) * run.U * 1.2}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = corDe(run, o, 2);
    for (let k = 0; k < n; k++) { const a = k / n * 6.28 + q * 4; c.globalAlpha = f; c.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'[k % 12], p.x + Math.cos(a) * R, p.y + Math.sin(a) * R * (o.plano ?? 1)); }
    c.globalAlpha = 1;
    stroke(c, corDe(run, o, 0), 2, f * .7); c.beginPath(); c.ellipse(p.x, p.y, R * .8, R * .8 * (o.plano ?? 1), 0, 0, 7); c.stroke(); c.globalAlpha = 1;
  },
  /** Algo pesado cai do céu e bate. art, n. */
  cair(c, q, run, o, i) {
    const n = o.n || 1, T = tam(run, o, .3);
    for (let k = 0; k < n; k++) {
      const tt = clamp01((q - k * (.6 / n)) / (o.voo ?? .36)), B = n > 1 ? { x: run.w * (.12 + .76 * (((k * 7) % n) + .5) / n), y: run.h * (.4 + ((k * 3) % 4) * .08) } : posDe(run, o.em), de = { x: B.x + (o.dx ?? 130), y: -T };
      if (tt > 0 && tt < 1) {
        const t = easeIn(tt), x = lerp(de.x, B.x, t), y = lerp(de.y, B.y, t);
        glow(c, x, y, T * .9, corDe(run, o, 1), .9); glow(c, x, y, T * .45, corDe(run, o, 2), 1);
        if (o.art) desenhaArte(c, o.art, x, y, T, corDe(run, o, 0), { rot: o.gira ? q * 12 : 0 });
        emit(x, y, 3, run, { v: 2, life: 26, size: 3, fixo: 1 });
      } else if (tt >= 1) {
        uma(run, i, `h${k}`, () => impactar(run, B.x, B.y, n > 1 ? .65 : 1));
        const u = clamp01(q - (o.voo ?? .36) - k * (.6 / n)) * 3;
        if (u < 1) { glow(c, B.x, B.y, T * 1.6 * ease(u), corDe(run, o, 1), 1 - u); stroke(c, corDe(run, o, 2), 4, 1 - u); c.beginPath(); c.arc(B.x, B.y, T * 1.5 * ease(u), 0, 7); c.stroke(); c.globalAlpha = 1; }
      }
    }
  },
  /** Silhueta girando no lugar: lâminas, serras, moinhos. */
  girar(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), T = tam(run, o, .4);
    desenhaArte(c, o.art, p.x, p.y, T * easeBack(clamp01(q * 2.4)), corDe(run, o), { a: fadeIO(q), rot: q * (o.v ?? 16) });
    glow(c, p.x, p.y, T * .7, corDe(run, o, 1), .5 * fadeIO(q));
  },
  /** Golpes em arco sobre o ponto, com arma opcional. n cortes. */
  golpe(c, q, run, o, i) {
    const p = posDe(run, o.em), n = o.n || 1, R = tam(run, o, .5);
    for (let k = 0; k < n; k++) {
      const tt = clamp01(q * n * 1.1 - k), a0 = (k % 2 ? 2.4 : .7) + k * .4;
      if (tt <= 0 || tt >= 1) continue;
      const a = a0 + tt * 2.4 * (k % 2 ? -1 : 1);
      if (o.art) desenhaArte(c, o.art, p.x + Math.cos(a) * R * .3, p.y + Math.sin(a) * R * .3, R, corDe(run, o, 0), { rot: a + 1.57, a: 1 - tt * .4 });
      c.globalCompositeOperation = 'lighter'; stroke(c, corDe(run, o, 2), 9 * (1 - tt), 1 - tt);
      c.beginPath(); c.arc(p.x, p.y, R * .62, a0, a, !!(k % 2)); c.stroke(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (tt > .4) uma(run, i, `h${k}`, () => impactar(run, p.x, p.y, n > 1 ? .6 : 1));
    }
  },
  /** Espiral hipnótica. */
  espiral(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), f = fadeIO(q), R = tam(run, o, .85);
    for (let v = 0; v < (o.n || 2); v++) {
      stroke(c, corDe(run, o, v), 4, f); c.beginPath();
      for (let a = 0; a < 26; a += .25) { const r = a / 26 * R * ease(clamp01(q * 1.8)), ang = a + q * 12 + v * Math.PI, x = p.x + Math.cos(ang) * r, y = p.y + Math.sin(ang) * r; c[a ? 'lineTo' : 'moveTo'](x, y); }
      c.stroke();
    }
    c.globalAlpha = 1;
  },
  /** Grade de barras: jaula, prisão. */
  grade(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), L = tam(run, o, .7), g = ease(clamp01(q * 2)), f = fadeIO(q), n = o.n || 7, topo = p.y - L / 2;
    stroke(c, corDe(run, o, 0), 6, f);
    for (let k = 0; k <= n; k++) { const x = p.x - L / 2 + L * k / n; c.beginPath(); c.moveTo(x, topo); c.lineTo(x, topo + L * g); c.stroke(); }
    stroke(c, corDe(run, o, 2), 7, f); c.beginPath(); c.moveTo(p.x - L / 2, topo); c.lineTo(p.x + L / 2, topo); c.moveTo(p.x - L / 2, topo + L * g); c.lineTo(p.x + L / 2, topo + L * g); c.stroke(); c.globalAlpha = 1;
  },
  /** Desfaz no ponto A e refaz em B. */
  teleporte(c, q, run, o, i) {
    const A = posDe(run, o.de, 'A'), B = posDe(run, o.em), T = tam(run, o, .3), ida = q < .5, p = ida ? A : B, t = ida ? 1 - q * 2 : (q - .5) * 2;
    desenhaArte(c, o.art || 'person', p.x, p.y, T, corDe(run, o, 2), { a: t, sx: t, brilho: 1.4 });
    glow(c, p.x, p.y, T * .9 * (1.2 - t), corDe(run, o, 1), .9);
    if (ida) emit(p.x, p.y, 4, run, { v: 5, life: 22, fixo: 1 }); else uma(run, i, 'p', () => emit(p.x, p.y, 40, run, { v: 6, life: 30, fixo: 1 }));
  },
  /** Olho que abre e fita. */
  olho(c, q, run, o) {
    const p = posDe(run, o.em, 'C'), W = tam(run, o, .5), ab = sino(q) * W * .34, f = Math.min(1, q * 6, (1 - q) * 6);
    c.beginPath(); c.moveTo(p.x - W, p.y); c.quadraticCurveTo(p.x, p.y - ab * 2, p.x + W, p.y); c.quadraticCurveTo(p.x, p.y + ab * 2, p.x - W, p.y); c.closePath();
    c.fillStyle = 'rgba(245,245,255,.92)'; c.globalAlpha = f; c.fill();
    c.save(); c.clip();
    const px = Math.sin(q * 7) * W * .18;
    c.fillStyle = corDe(run, o, 1); c.beginPath(); c.arc(p.x + px, p.y, W * .3, 0, 7); c.fill();
    c.fillStyle = '#000'; c.beginPath(); c.arc(p.x + px, p.y, W * .14, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x + px + W * .07, p.y - W * .07, W * .05, 0, 7); c.fill();
    c.restore();
    stroke(c, corDe(run, o, 0), 3, f); c.stroke(); c.globalAlpha = 1;
  },
  /** Mão fechando no centro (agarrar). */
  fechar(c, q, run, o, i) {
    const p = posDe(run, o.em), g = ease(clamp01(q * 1.9)), T = tam(run, o, .34), L = run.U * .55 * (1 - g);
    [-1, 1].forEach(l => desenhaArte(c, o.art, p.x + l * (T * .34 + L), p.y, T, corDe(run, o), { a: fadeIO(q), sx: l }));
    if (g > .96) uma(run, i, 'h', () => impactar(run, p.x, p.y, o.e ?? .8));
  },
  /** Fica parado. Para silhuetas de apoio no fundo da cena. */
  fixo(c, q, run, o) {
    const p = posDe(run, o.em, 'C');
    desenhaArte(c, o.art, p.x, p.y, tam(run, o, .3), corDe(run, o, o.tom ?? 1), { a: (o.a ?? .7) * fadeIO(q), brilho: .5, sx: o.sx, rot: o.rot });
  }
};
