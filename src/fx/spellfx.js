/* =====================================================================
   CENA DE MAGIA
   Toda magia toma a tela, como o amanhecer do Descanso Longo: entra o
   fundo, os dados pulam, o ato principal acontece, o impacto responde
   ao dano rolado, aparece o total e a cena sai. A cena de cada magia
   fica em cenas.js; os verbos que ela usa, em cena-atos.js.
   Desenha num canvas por cima do app; funciona com ou sem GSAP.
   ===================================================================== */
const FX_MAX_PARTICLES = 380, FX_ENTRA = 320, FX_DADOS = 900, FX_ATO = 1650, FX_SAI = 420;
const DMG_COLORS = {
  'Ácido': ['#b8f25a', '#5fd23a', '#e9ff9a'], 'Contundente': ['#d6b48a', '#9c7b55', '#f2dfc2'], 'Cortante': ['#e6edf5', '#9fb2c8', '#ffffff'],
  'Elétrico': ['#9fd8ff', '#5a8dff', '#ffffff'], 'Energético': ['#c9a6ff', '#7b5cff', '#f0e6ff'], 'Ígneo': ['#ffb347', '#ff5a1f', '#fff1a8'],
  'Gélido': ['#bfeeff', '#62c4ff', '#ffffff'], 'Necrótico': ['#8fe388', '#3c6b45', '#d8ffd0'], 'Perfurante': ['#d9dfe8', '#8796a8', '#ffffff'],
  'Psíquico': ['#ff8fd8', '#b44cff', '#ffe0f6'], 'Radiante': ['#fff3b0', '#ffd24a', '#ffffff'], 'Trovejante': ['#9fb8ff', '#4d63d6', '#e6ecff'], 'Venenoso': ['#a6e36b', '#4f9e3a', '#e5ffc2']
};
const SCHOOL_COLORS = {
  'Abjuração': ['#9fdcff', '#4f9de0', '#ffffff'], 'Adivinhação': ['#d8e7ff', '#8fa8ff', '#ffffff'], 'Encantamento': ['#ffb3e6', '#e05cb8', '#fff0fa'], 'Evocação': ['#ffd28a', '#ff8a3c', '#fff4d6'],
  'Ilusão': ['#d9b8ff', '#9a6cff', '#f5ecff'], 'Invocação': ['#a0f0d0', '#35b58f', '#e6fff6'], 'Necromancia': ['#9fe0a0', '#44705a', '#d8ffe0'], 'Transmutação': ['#ffe08a', '#d4a12e', '#fff8dc']
};
/* Paletas de cena, para o que não tem tipo de dano. */
const PALETAS = {
  luz: ['#fff3b0', '#ffd24a', '#ffffff'], ouro: ['#ffe08a', '#d4a12e', '#fff8dc'], lua: ['#dfe9ff', '#8fa8ff', '#ffffff'], prata: ['#e6edf5', '#9fb2c8', '#ffffff'], sombra: ['#9a8cc2', '#3d2f66', '#d9d0f5'],
  sangue: ['#ff8a8a', '#b3202a', '#ffd6d6'], natureza: ['#a9e87a', '#3f9e4a', '#e9ffc9'], agua: ['#8fd8ff', '#2f7fd6', '#e0f6ff'], terra: ['#d6b48a', '#7d5a3a', '#f2dfc2'], vento: ['#d8f0ee', '#7fb8b8', '#ffffff'],
  sonho: ['#ffb3e6', '#8f5cff', '#fff0fa'], cura: ['#9df0b4', '#3fbf7a', '#eafff0'], fogo: DMG_COLORS['Ígneo'], gelo: DMG_COLORS['Gélido'], veneno: DMG_COLORS['Venenoso'], arcano: DMG_COLORS['Energético'], morte: ['#b9c9b5', '#3a4a40', '#e6f2e0']
};
/* Céu de cada fundo: topo, meio, base e o detalhe que anima. */
const FUNDOS = {
  noite: ['#050814', '#0d1630', '#1b2547', 'estrelas'], arcano: ['#0b0620', '#1c1045', '#33205f', 'runas'], amanhecer: ['#1a2348', '#a85a6a', '#ffc27a', 'sol'], tempestade: ['#07090f', '#161c2b', '#2a3142', 'chuva'],
  floresta: ['#04100a', '#0d2a1a', '#1d4a2a', 'folhas'], cripta: ['#050805', '#101a14', '#1c2a20', 'nevoa'], oceano: ['#02101f', '#0a2f52', '#125a7a', 'bolhas'], ceu: ['#16386e', '#3f74ac', '#8ab6d0', 'nuvens'],
  vazio: ['#000', '#04030a', '#0a0716', 'estrelas'], fogo: ['#140403', '#3a0d06', '#7a2308', 'brasas'], gelo: ['#07131f', '#16344f', '#3a6a8a', 'neve'], caverna: ['#070605', '#15110d', '#2a2118', 'poeira'],
  templo: ['#1a1206', '#4a3412', '#8a6a2a', 'poeira'], sonho: ['#10061f', '#3a1450', '#7a2f7a', 'estrelas'], pantano: ['#060a05', '#142012', '#2c3a1a', 'nevoa'], astral: ['#080522', '#1a1a5a', '#3a2f8a', 'estrelas'], lua: ['#04081a', '#101f45', '#27386a', 'lua'], dia: ['#23558e', '#5a94bc', '#a9d0c8', 'sol2']
};

const fxHash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function fxRng(seed) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }
const clamp01 = t => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const easeBack = t => { const s = 1.70158, u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const sino = t => Math.sin(clamp01(t) * Math.PI);
const fadeIO = t => Math.min(1, t * 6, (1 - t) * 6);

/** Monta a receita de uma magia. `tipo` é o elemento escolhido, quando a magia deixa escolher. */
function spellRecipe(s, tipo, nivel = s.level, res = null) {
  const dano = (s.r || []).find(x => x.t === 'dmg' && !x.heal && !x.depois && DMG_COLORS[x.type]);
  const elemento = DMG_COLORS[tipo] ? tipo : dano ? dano.type : null, cena = cenaDe(s), [fundo, cor] = String(cena[0]).split(':');
  const palette = (elemento && DMG_COLORS[elemento]) || PALETAS[cor] || DMG_COLORS[cor] || SCHOOL_COLORS[s.school] || SCHOOL_COLORS['Evocação'];
  return { id: s.id, nome: s.name, cena, fundo: FUNDOS[fundo] ? fundo : 'arcano', palette, elemento, nivel: nivel || 0, res, seed: fxHash(s.id) };
}
const fxSignature = c => JSON.stringify([c.cena[0], c.cena.slice(2)]);

/* ---------- motor ---------- */
const fxState = { cv: null, ctx: null, run: null, parts: [], raf: 0 };
const fxMode = () => {
  const m = store.settings.anim || 'full';
  return m === 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : m;
};
function fxCanvas() {
  if (fxState.cv) return fxState.cv;
  const c = document.createElement('canvas');
  c.id = 'spell-fx'; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9000;pointer-events:none;opacity:0;touch-action:none';
  document.body.appendChild(c);
  c.addEventListener('pointerdown', fxPular);
  addEventListener('keydown', e => { if (e.key === 'Escape' && fxState.run) fxPular(); });
  fxState.cv = c; fxState.ctx = c.getContext('2d');
  return c;
}
function fxResize() {
  const c = fxCanvas(), dpr = fxState.leve ? 1 : Math.min(devicePixelRatio || 1, 1.5);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  fxState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function part(o) {
  if (fxState.parts.length >= FX_MAX_PARTICLES) return;
  fxState.parts.push({ vx: 0, vy: 0, g: 0, drag: .985, life: 0, max: 40, size: 3, shape: 'dot', ...o });
}
function emit(x, y, n, run, o = {}) {
  if (run.reduced) return;
  const { rng, pal } = run;
  for (let i = 0, t = Math.ceil(n * (o.fixo ? 1 : .6 + run.F * .9) * (fxState.leve ? .5 : 1)); i < t; i++) {
    const a = (o.a0 ?? 0) + rng() * (o.arc ?? Math.PI * 2), v = (o.v ?? 3) * (.3 + rng());
    part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: o.c || pal[Math.floor(rng() * 3)], size: (o.size ?? 3) * (.5 + rng()), max: (o.life ?? 40) * (.6 + rng() * .6), g: o.g ?? 0, shape: o.shape || 'dot', rot: rng() * 6, art: o.art, txt: o.txt });
  }
}
function glow(ctx, x, y, r, c, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp01(a); ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, 7); ctx.fill();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = op;
}
const stroke = (ctx, c, w, a = 1) => { ctx.strokeStyle = c; ctx.lineWidth = Math.max(.5, w); ctx.globalAlpha = clamp01(a); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; };

/* Silhuetas: vêm de data/fx-art.js, carregado sob demanda, e viram sprites com brilho. */
const fxArtes = { path: {}, sprite: new Map(), carregando: false };
function ensureArt() {
  if (window.GRIMORIO_ART || fxArtes.carregando) return;
  fxArtes.carregando = true;
  const s = document.createElement('script');
  s.src = 'data/fx-art.js'; s.onerror = () => { fxArtes.carregando = false; };
  document.head.appendChild(s);
}
function artPath(nome) {
  const n = String(nome).replace(/^@/, ''), d = window.GRIMORIO_ART?.[n];
  if (!d) return null;
  return fxArtes.path[n] || (fxArtes.path[n] = new Path2D(d));
}
function sprite(nome, cor, tam, brilho = 1) {
  const q = Math.max(16, Math.ceil(tam / 24) * 24), k = `${nome}|${cor}|${q}|${brilho}`;
  let s = fxArtes.sprite.get(k);
  if (s) return s;
  const p = artPath(nome), m = Math.ceil(q * .3), cv = document.createElement('canvas');
  cv.width = cv.height = q + m * 2;
  if (!p) return cv;
  const c = cv.getContext('2d');
  c.translate(m, m); c.scale(q / 512, q / 512);
  if (brilho) { c.shadowColor = cor; c.shadowBlur = q * .16 * brilho; }
  c.fillStyle = cor; c.fill(p);
  if (brilho) c.fill(p);
  if (fxArtes.sprite.size > 90) fxArtes.sprite.clear();
  fxArtes.sprite.set(k, cv);
  return cv;
}
/** Desenha uma silhueta centrada. o: rot, a, sx, sy, brilho. */
function desenhaArte(c, nome, x, y, tam, cor, o = {}) {
  const s = sprite(nome, cor, tam, o.brilho ?? 1), q0 = Math.max(16, Math.ceil(tam / 24) * 24), q = tam * s.width / q0;
  c.save(); c.translate(x, y); if (o.rot) c.rotate(o.rot); c.scale(o.sx ?? 1, o.sy ?? 1);
  c.globalAlpha = clamp01(o.a ?? 1); c.drawImage(s, -q / 2, -q / 2, q, q);
  c.restore();
}

/* Impacto: o dano rolado decide tremor, clarão e partículas. */
function impactar(run, x, y, e = 1) {
  if (run.erro) { emit(x, y, 8, run, { v: 2, life: 24, size: 2.4, fixo: 1 }); run.hit = run.hit || run.now; return; }
  const { F, K } = run, cura = run.imp.cura;
  run.shake = Math.max(run.shake, run.reduced || cura ? 0 : (3 + 30 * F) * Math.min(1.4, K) * e);
  run.flash = Math.max(run.flash, (cura ? .12 : .1 + .55 * F) * e);
  run.hit = run.hit || run.now;
  emit(x, y, (30 + 90 * K) * e, run, { v: (3 + 6 * F) * Math.sqrt(K), life: 42, size: 3.4 * Math.sqrt(K) });
}

function fxMontaDados(run) {
  const res = run.rec.res;
  if (!res) return;
  const lista = [...res.inst.flatMap(x => x.dados), ...res.aux.flatMap(a => a.vals.map(v => ({ v, f: a.f, extra: null })))], n = Math.min(lista.length, 24), r = run.rng;
  if (!n) return;
  const tam = n <= 8 ? 40 : n <= 14 ? 32 : 26, por = Math.min(n, Math.floor((run.w - 24) / (tam + 8))), linhas = Math.ceil(n / por);
  run.dados = lista.slice(0, n).map((q, i) => {
    const l = Math.floor(i / por), col = i % por, naLinha = l < linhas - 1 ? por : n - por * (linhas - 1);
    return { ...q, x: run.w / 2 + (col - (naLinha - 1) / 2) * (tam + 8), y: run.h - 34 - (linhas - 1 - l) * (tam + 8), x0: run.w * r(), tam, ini: i * 34 + (q.extra ? 280 : 0), H: (q.extra ? 300 : 190) + r() * 70, gira: (r() < .5 ? -1 : 1) * (5 + r() * 6) };
  });
  run.resto = lista.length - n;
}
const DIE_LADOS = { 4: 3, 6: 4, 8: 4, 10: 5, 12: 6, 20: 6, 100: 8 };
const DIE_EXTRA = { up: '#9fd8ff', crit: '#ffd24a', exp: '#ff9a5a', rep: '#ffffff' };
function desenhaDado(c, q, x, y, rot, run, valor) {
  const lados = DIE_LADOS[q.f] || 6, R = q.tam * .62, cor = DIE_EXTRA[q.extra] || run.pal[0];
  c.save(); c.translate(x, y); c.rotate(rot + (q.f === 6 ? Math.PI / 4 : -Math.PI / 2));
  c.beginPath();
  for (let i = 0; i < lados; i++) { const a = i / lados * Math.PI * 2; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R, Math.sin(a) * R); }
  c.closePath(); c.fillStyle = 'rgba(12,14,24,.92)'; c.fill();
  stroke(c, cor, q.extra ? 3 : 2); c.stroke(); c.globalAlpha = 1;
  c.restore();
  if (q.extra) glow(c, x, y, q.tam * 1.1, cor, .35);
  c.fillStyle = '#fff'; c.font = `700 ${Math.round(q.tam * .46)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(valor, x, y + 1);
}
function desenhaDados(c, run, T) {
  const lim = FX_DADOS - 260;
  (run.dados || []).forEach(q => {
    const t = run.fix ? 1 : clamp01((T - q.ini) / Math.max(320, lim - q.ini));
    if (t <= 0) return;
    const u = 1 - t, salto = q.H * u * u * Math.abs(Math.cos(t * Math.PI * 2.5));
    // Os dados a mais continuam pulando depois de pousar, e todos saltam no impacto.
    const hop = run.fix ? 0 : (q.extra ? Math.abs(Math.sin(T / 150 + q.x)) * 16 : 0) + (run.hit ? Math.max(0, 1 - (run.now - run.hit) / 420) * Math.abs(Math.sin((run.now - run.hit) / 60)) * 24 * run.F : 0);
    desenhaDado(c, q, lerp(q.x0, q.x, ease(t)), q.y - salto - hop, q.gira * u * u, run, t < .72 ? 1 + Math.floor(run.rng() * q.f) : q.v);
  });
  if (run.resto) { c.fillStyle = '#fff'; c.font = '600 14px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText(`+${run.resto} dados`, run.w / 2, run.h - 8); }
}
function desenhaFundo(c, run, T) {
  const { w, h, rec, pal } = run, [a, b, d, det] = FUNDOS[rec.fundo], g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, a); g.addColorStop(.6, b); g.addColorStop(1, d);
  c.fillStyle = g; c.globalAlpha = .96; c.fillRect(-40, -40, w + 80, h + 80); c.globalAlpha = 1;
  glow(c, run.B.x, run.B.y, Math.max(w, h) * .6, pal[1], .22 + .22 * run.F);
  const r = run.bgp, tt = T / 1000;
  switch (det) {
    case 'estrelas': r.forEach(p => { c.globalAlpha = .3 + .7 * Math.abs(Math.sin(tt * p.v * 2 + p.f)); c.fillStyle = '#fff'; c.fillRect(p.x * w, p.y * h, 1 + p.s, 1 + p.s); }); break;
    case 'runas': c.font = '16px serif'; c.textAlign = 'center'; r.forEach((p, i) => { c.globalAlpha = .1 + .2 * Math.abs(Math.sin(tt + p.f)); c.fillStyle = pal[0]; c.fillText('ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ'[i % 16], p.x * w, ((p.y - tt * .03 * p.v) % 1 + 1) % 1 * h); }); break;
    case 'chuva': stroke(c, '#9fb8d8', 1, .28); c.beginPath(); r.forEach(p => { const y = ((p.y + tt * p.v * 1.4) % 1) * h, x = p.x * w; c.moveTo(x, y); c.lineTo(x - 4, y + 18); }); c.stroke(); break;
    case 'folhas': r.forEach(p => { c.globalAlpha = .4; c.fillStyle = '#6fbf62'; c.beginPath(); c.ellipse((p.x + Math.sin(tt + p.f) * .04) * w, ((p.y + tt * .08 * p.v) % 1) * h, 4, 2, tt + p.f, 0, 7); c.fill(); }); break;
    case 'nevoa': r.slice(0, 6).forEach(p => glow(c, ((p.x + tt * .03 * p.v) % 1) * w, h * (.6 + p.y * .4), 170, '#7f9a88', .08)); break;
    case 'bolhas': r.forEach(p => { stroke(c, '#bfe8ff', 1, .3); c.beginPath(); c.arc(p.x * w + Math.sin(tt * 2 + p.f) * 6, h - ((p.y + tt * .12 * p.v) % 1) * h, 1.5 + p.s * 2, 0, 7); c.stroke(); }); break;
    case 'nuvens': r.slice(0, 7).forEach(p => glow(c, ((p.x + tt * .02) % 1) * w, p.y * h * .6, 120, '#ffffff', .14)); break;
    case 'brasas': r.forEach(p => { c.globalAlpha = .7; c.fillStyle = '#ffb347'; c.fillRect((p.x + Math.sin(tt * 2 + p.f) * .02) * w, h - ((p.y + tt * .16 * p.v) % 1) * h, 2, 2); }); break;
    case 'neve': r.forEach(p => { c.globalAlpha = .7; c.fillStyle = '#fff'; c.beginPath(); c.arc((p.x + Math.sin(tt + p.f) * .02) * w, ((p.y + tt * .1 * p.v) % 1) * h, 1 + p.s, 0, 7); c.fill(); }); break;
    case 'poeira': r.forEach(p => { c.globalAlpha = .25; c.fillStyle = '#e8d6a8'; c.fillRect(p.x * w, ((p.y - tt * .03 * p.v) % 1 + 1) % 1 * h, 1.5, 1.5); }); break;
    case 'sol': { const y = h * (.86 - clamp01(T / 1500) * .14); glow(c, w / 2, y, h * .5, '#ffcf8a', .7); glow(c, w / 2, y, 90, '#fff8e4', 1); break; }
    case 'sol2': glow(c, w * .78, h * .14, 180, '#fff4c8', .9); break;
    case 'lua': glow(c, w * .72, h * .16, 120, '#dfe9ff', .55); c.fillStyle = '#eef3ff'; c.globalAlpha = .9; c.beginPath(); c.arc(w * .72, h * .16, 38, 0, 7); c.fill(); r.forEach(p => { c.globalAlpha = .4 + .5 * Math.abs(Math.sin(tt * p.v + p.f)); c.fillStyle = '#fff'; c.fillRect(p.x * w, p.y * h, 1, 1); }); break;
  }
  c.globalAlpha = 1;
}
function desenhaTitulo(c, run, T) {
  const { w, h, rec } = run, a = clamp01((T - 90) / 420), y = h * .085 + 12;
  c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fcebc8';
  const nome = String(rec.nome).toUpperCase();
  let px = 21;
  c.font = `600 ${px}px ${run.fonte}`;
  while (c.measureText(nome).width > w - 60 && px > 12) { px--; c.font = `600 ${px}px ${run.fonte}`; }
  c.lineJoin = 'round'; c.strokeStyle = 'rgba(8,8,16,.72)'; c.lineWidth = 4;
  c.strokeText(nome, w / 2, y); c.fillText(nome, w / 2, y);
  c.fillStyle = 'rgba(252,235,200,.92)'; c.font = `400 16px ${run.corpo}`; c.lineWidth = 3.5;
  c.strokeText(rec.cena[1] || '', w / 2, y + 25, w - 30); c.fillText(rec.cena[1] || '', w / 2, y + 25, w - 30);
  c.globalAlpha = 1;
}
function desenhaTotal(c, run) {
  const { w, h, rec } = run, res = rec.res;
  if (!res || !run.hit) return;
  const dt = (run.now - run.hit) / 520, q = run.fix ? 1 : easeBack(clamp01(dt)), base = Math.min(92, 46 + run.K * 26), y = h * .66;
  const dano = res.temDano ? (res.erro ? 'Errou' : (res.cura ? '+' : '') + res.total) : String(res.aux[0]?.total ?? '');
  if (!dano) return;
  c.save(); c.translate(w / 2, y); c.scale(q, q);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${res.erro ? 42 : base}px ${run.fonte}`;
  c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineJoin = 'round'; c.strokeText(dano, 0, 0);
  c.fillStyle = res.crit ? '#ffd24a' : res.erro ? '#c8ccd6' : run.pal[2]; c.fillText(dano, 0, 0);
  const sub = res.crit ? 'Crítico!' : res.saltos ? `Saltou ${res.saltos}×` : res.passou ? 'Passou na salvaguarda' : res.temDano && !res.erro ? (rec.elemento || (res.cura ? 'Cura' : '')) : '';
  if (sub) { c.font = `500 16px ${run.corpo}`; c.lineWidth = 4; c.strokeText(sub, 0, base * .62); c.fillStyle = '#fff'; c.fillText(sub, 0, base * .62); }
  c.restore();
}
function drawPart(c, p, run) {
  const a = Math.max(0, 1 - p.life / p.max);
  c.globalAlpha = a; c.fillStyle = p.c; c.strokeStyle = p.c;
  switch (p.shape) {
    case 'spark': c.lineWidth = Math.max(1, p.size * .5); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); c.stroke(); break;
    case 'streak': c.lineWidth = p.size; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); c.stroke(); break;
    case 'diamond': c.beginPath(); c.moveTo(p.x, p.y - p.size * 1.4); c.lineTo(p.x + p.size * .7, p.y); c.lineTo(p.x, p.y + p.size * 1.4); c.lineTo(p.x - p.size * .7, p.y); c.fill(); break;
    case 'estrela': { const s = p.size * (1 - Math.abs(p.life / p.max - .5) * 2); c.beginPath(); c.moveTo(p.x, p.y - s); c.lineTo(p.x + s * .18, p.y - s * .18); c.lineTo(p.x + s, p.y); c.lineTo(p.x + s * .18, p.y + s * .18); c.lineTo(p.x, p.y + s); c.lineTo(p.x - s * .18, p.y + s * .18); c.lineTo(p.x - s, p.y); c.lineTo(p.x - s * .18, p.y - s * .18); c.fill(); break; }
    case 'folha': c.beginPath(); c.ellipse(p.x, p.y, p.size * 1.4, p.size * .6, p.rot + p.life * .08, 0, 7); c.fill(); break;
    case 'pena': c.lineWidth = 1.5; c.beginPath(); c.ellipse(p.x, p.y, p.size * .5, p.size * 1.7, Math.sin(p.life * .06) * .8, 0, 7); c.fill(); break;
    case 'txt': c.font = `600 ${p.size}px ${run?.fonte || 'serif'}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.txt, p.x, p.y); break;
    case 'art': desenhaArte(c, p.art, p.x, p.y, p.size, p.c, { a, rot: p.rot + p.life * (p.gira || 0) }); break;
    default: c.beginPath(); c.arc(p.x, p.y, p.size, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
}
function fxPartes(c, run, dt) {
  run.acum = (run.acum || 0) + dt;
  const passos = Math.min(4, Math.floor(run.acum / 16.7));
  run.acum = passos === 4 ? 0 : run.acum - passos * 16.7;
  fxState.parts = fxState.parts.filter(p => {
    for (let i = 0; i < passos; i++) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.life++; }
    drawPart(c, p, run);
    return p.life < p.max;
  });
}
/** Passa pelos atos da cena no andamento p, de 0 a 1. */
function fxAtos(c, run, p) {
  const atos = run.rec.cena.slice(2);
  for (let i = 0; i < atos.length; i++) {
    const [verbo, o = {}] = atos[i], [a, b] = o.t || [0, 1];
    if (p < a) continue;
    const q = (p - a) / (b - a);
    if (q > 1) continue;
    ATOS[verbo](c, clamp01(q), run, o, i);
  }
  if (!run.hit && p >= .62 && run.rec.res) impactar(run, run.B.x, run.B.y, .7);
}
function novoRun(s, tipo, nivel, res, mode) {
  const rec = spellRecipe(s, tipo, nivel, res), w = innerWidth, h = innerHeight, imp = impacto(res, nivel || 0), r = fxRng((rec.seed ^ Math.floor(performance.now())) || 1);
  const css = getComputedStyle(document.documentElement);
  const run = {
    rec, pal: rec.palette, rng: r, reduced: mode === 'reduced', w, h, imp, K: imp.tamanho, F: imp.forca, erro: !!imp.erro, U: Math.min(w, h * .62), now: 0, shake: 0, flash: 0, hit: 0, f: {},
    A: { x: w / 2, y: h * .8 }, B: { x: w / 2, y: h * .36 }, C: { x: w / 2, y: h * .46 }, fonte: css.getPropertyValue('--f-display') || 'serif', corpo: css.getPropertyValue('--f-body') || 'serif',
    bgp: Array.from({ length: 46 }, () => ({ x: r(), y: r(), v: .4 + r(), f: r() * 6, s: r() * 1.6 }))
  };
  fxMontaDados(run);
  run.dadosMs = run.dados && !run.reduced ? FX_DADOS : 0;
  run.total = run.reduced ? 1100 : FX_ENTRA + run.dadosMs + FX_ATO + FX_SAI;
  if (run.reduced) run.fix = .62;
  return run;
}
function fxQuadro(c, run, T) {
  const dt = T - (run.ultimo ?? T);
  run.ultimo = T;
  run.now = run.start + T;
  c.clearRect(0, 0, run.w, run.h);
  c.save();
  if (run.shake > .4) { c.translate((run.rng() - .5) * run.shake, (run.rng() - .5) * run.shake); run.shake *= .9; }
  desenhaFundo(c, run, T);
  if (run.fix) fxAtos(c, run, run.fix);
  else {
    const p = (T - FX_ENTRA - run.dadosMs) / FX_ATO;
    if (p >= 0) fxAtos(c, run, Math.min(p, .999));
  }
  fxPartes(c, run, dt);
  desenhaDados(c, run, T);
  c.restore();
  desenhaTitulo(c, run, run.fix ? 900 : T);
  desenhaTotal(c, run);
  if (run.flash > .01) { c.fillStyle = run.pal[2]; c.globalAlpha = run.flash; c.fillRect(0, 0, run.w, run.h); c.globalAlpha = 1; run.flash *= .86; }
}
function fxFrame(now) {
  const run = fxState.run, cv = fxState.cv;
  if (!run) return;
  const T = now - run.start;
  if (T >= run.total) { fxFim(); return; }
  // Aparelho lento: baixa a resolução e corta partículas, nesta cena e nas próximas.
  if (!fxState.leve && run.quadro) { run.qn = (run.qn || 0) + 1; run.qs = (run.qs || 0) + now - run.quadro; if (run.qn === 10) { if (run.qs / 10 > 34) { fxState.leve = true; fxResize(); } run.qn = run.qs = 0; } }
  run.quadro = now;
  const sai = run.reduced ? 240 : FX_SAI, entra = run.reduced ? 200 : FX_ENTRA;
  cv.style.opacity = Math.min(clamp01(T / entra), clamp01((run.total - T) / sai));
  fxQuadro(fxState.ctx, run, T);
  fxState.raf = requestAnimationFrame(fxFrame);
}
function fxFim() {
  cancelAnimationFrame(fxState.raf);
  fxState.raf = 0; fxState.run = null; fxState.parts = [];
  if (fxState.cv) { fxState.cv.style.opacity = 0; fxState.cv.style.pointerEvents = 'none'; fxState.ctx.clearRect(0, 0, innerWidth, innerHeight); }
}
/** Um toque pula para o fim da cena. */
function fxPular() {
  const run = fxState.run;
  if (!run) return;
  const sai = run.reduced ? 240 : FX_SAI, T = performance.now() - run.start;
  if (T < run.total - sai) run.start = performance.now() - (run.total - sai);
}
/** Toca a cena da magia. Devolve a receita, ou null quando as animações estão desligadas. */
function playSpell(s, tipo, nivel, res) {
  const mode = fxMode();
  if (mode === 'off') return null;
  ensureArt();
  fxResize();
  fxState.parts = [];
  const run = novoRun(s, tipo, nivel, res, mode);
  run.start = performance.now();
  fxState.run = run;
  fxState.cv.style.pointerEvents = 'auto';
  if (!fxState.raf) fxState.raf = requestAnimationFrame(fxFrame);
  return run.rec;
}
/** Mostra a cena sem gastar nada. forca: 0 para o menor resultado, 1 para o maior. */
function fxPreview(s, forca = .6) {
  const tipo = castType || s.choice?.[0] || null, sp = diceSpec(s, s.level, { tipo }), L = novoLance(sp);
  if (!sp.grupos.length) return playSpell(s, tipo, s.level);
  for (let i = 0; i < sp.inst; i++) {
    if (sp.atk) L.d20[i] = [15];
    sp.grupos.forEach(g => { L.dados[cellKey(i, g)] = Array.from({ length: g.n }, (_, j) => Math.max(1, Math.round(1 + forca * (g.f - 1)) - (g.f > 2 && j % 2 && forca < 1 && forca > 0 ? 1 : 0))); });
  }
  return playSpell(s, tipo, s.level, resolveLance(L));
}
/** Roda a cena inteira sem esperar o relógio. Usada nos testes e nas folhas de revisão. */
function fxDryRun(s, tipo, res = null, ate = 1) {
  fxResize();
  const run = novoRun(s, tipo, s.level, res, 'full'), c = fxState.ctx, fim = FX_ENTRA + run.dadosMs + FX_ATO * ate;
  fxState.parts = [];
  run.start = 0;
  for (let T = 0; T <= fim; T += 33) fxQuadro(c, run, T);
  fxState.parts = [];
  return run.rec;
}
