/* =====================================================================
   ANIMAÇÃO POR MAGIA
   Cada magia tem uma receita: forma (como atinge), paleta (tipo de dano
   ou escola), intensidade (círculo) e uma assinatura gerada pelo id,
   com runa, trajetória, tempos e mistura de partículas próprias.
   Desenha num canvas por cima do app; funciona com ou sem GSAP.
   ===================================================================== */
const FX_MAX_MS = 1500, FX_MAX_PARTICLES = 420;
const DMG_COLORS = {
  'Ácido': ['#b8f25a', '#5fd23a', '#e9ff9a'], 'Contundente': ['#d6b48a', '#9c7b55', '#f2dfc2'], 'Cortante': ['#e6edf5', '#9fb2c8', '#ffffff'],
  'Elétrico': ['#9fd8ff', '#5a8dff', '#ffffff'], 'Energético': ['#c9a6ff', '#7b5cff', '#f0e6ff'], 'Fogo': ['#ffb347', '#ff5a1f', '#fff1a8'],
  'Frio': ['#bfeeff', '#62c4ff', '#ffffff'], 'Necrótico': ['#8fe388', '#3c6b45', '#1b2b20'], 'Perfurante': ['#d9dfe8', '#8796a8', '#ffffff'],
  'Psíquico': ['#ff8fd8', '#b44cff', '#ffe0f6'], 'Radiante': ['#fff3b0', '#ffd24a', '#ffffff'], 'Trovejante': ['#9fb8ff', '#4d63d6', '#e6ecff'], 'Veneno': ['#a6e36b', '#4f9e3a', '#e5ffc2']
};
const SCHOOL_COLORS = {
  'Abjuração': ['#9fdcff', '#4f9de0', '#ffffff'], 'Adivinhação': ['#d8e7ff', '#8fa8ff', '#ffffff'], 'Encantamento': ['#ffb3e6', '#e05cb8', '#fff0fa'], 'Evocação': ['#ffd28a', '#ff8a3c', '#fff4d6'],
  'Ilusão': ['#d9b8ff', '#9a6cff', '#f5ecff'], 'Invocação': ['#a0f0d0', '#35b58f', '#e6fff6'], 'Necromancia': ['#9fe0a0', '#44705a', '#10201a'], 'Transmutação': ['#ffe08a', '#d4a12e', '#fff8dc']
};
const FORMS_BY_SHAPE = { Esfera: 'sphere', Cone: 'cone', Linha: 'line', Cubo: 'cube', Cilindro: 'cylinder', 'Emanação': 'emanation', Muralha: 'wall' };
const FORMS_BY_SCHOOL = { 'Abjuração': 'dome', 'Adivinhação': 'rune', 'Encantamento': 'charm', 'Evocação': 'shockwave', 'Ilusão': 'duplicates', 'Invocação': 'portal', 'Necromancia': 'fear', 'Transmutação': 'light' };

/* Receitas feitas à mão: as 16 magias do Søren e as mais conhecidas do SRD. */
const FX_RECIPES = {
  'mind-sliver': { form: 'charm', via: 'ray' }, 'sorcerous-burst': { form: 'sphere', via: 'projectile' }, 'true-strike': { form: 'ray' }, 'minor-illusion': { form: 'duplicates' }, 'mage-hand': { form: 'light' },
  'ice-knife': { form: 'sphere', via: 'projectile', burst: 'shards' }, shield: { form: 'dome' }, 'disguise-self': { form: 'mist' }, 'chromatic-orb': { form: 'sphere', via: 'projectile' }, command: { form: 'charm' },
  'mirror-image': { form: 'duplicates' }, web: { form: 'web' }, suggestion: { form: 'charm' }, 'phantasmal-force': { form: 'fear' }, 'alter-self': { form: 'mist' }, 'dragons-breath': { form: 'cone' },
  fireball: { form: 'sphere', via: 'projectile' }, 'magic-missile': { form: 'projectile', count: 3 }, 'lightning-bolt': { form: 'line' }, 'chain-lightning': { form: 'chain' }, 'burning-hands': { form: 'cone' },
  'cone-of-cold': { form: 'cone' }, thunderwave: { form: 'shockwave' }, 'ice-storm': { form: 'rain' }, 'meteor-swarm': { form: 'rain', via: 'projectile' }, 'sleet-storm': { form: 'rain' }, 'wall-of-fire': { form: 'wall' },
  'wall-of-ice': { form: 'wall' }, 'wall-of-force': { form: 'dome' }, 'wall-of-thorns': { form: 'thorns' }, 'spike-growth': { form: 'thorns' }, entangle: { form: 'thorns' }, 'cure-wounds': { form: 'heal' }, 'healing-word': { form: 'heal' },
  'mass-heal': { form: 'heal' }, heal: { form: 'heal' }, revivify: { form: 'heal', via: 'light' }, 'misty-step': { form: 'teleport' }, teleport: { form: 'teleport' }, 'dimension-door': { form: 'portal' }, gate: { form: 'portal' },
  'fog-cloud': { form: 'mist' }, cloudkill: { form: 'mist' }, darkness: { form: 'fear' }, light: { form: 'light' }, daylight: { form: 'light' }, sunbeam: { form: 'ray' }, moonbeam: { form: 'cylinder' }, 'flame-strike': { form: 'cylinder' },
  'charm-person': { form: 'charm' }, fear: { form: 'fear' }, 'hypnotic-pattern': { form: 'charm' }, 'eldritch-blast': { form: 'projectile', count: 1 }, 'fire-bolt': { form: 'projectile' }, 'ray-of-frost': { form: 'ray' }, 'scorching-ray': { form: 'projectile', count: 3 }
};

const fxHash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function fxRng(seed) { let x = seed || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }

/** Monta a receita de uma magia. `tipo` é o elemento escolhido, quando a magia deixa escolher. */
function spellRecipe(s, tipo, nivel = s.level) {
  const dano = (s.r || []).find(x => x.t === 'dmg' && !x.heal && DMG_COLORS[x.type]), cura = (s.r || []).some(x => x.heal), hand = FX_RECIPES[s.id] || FX_RECIPES[norm(s.en || '').replace(/[^a-z0-9]+/g, '-')] || {};
  const elemento = tipo || (dano && DMG_COLORS[dano.type] ? dano.type : null);
  const form = hand.form || (cura ? 'heal' : s.area && FORMS_BY_SHAPE[s.area.shape]) || ((s.r || []).some(x => x.t === 'atk') ? 'projectile' : dano ? 'ray' : FORMS_BY_SCHOOL[s.school] || 'shockwave');
  const sig = fxHash(s.id), r = fxRng(sig);
  const pal = (elemento ? DMG_COLORS[elemento] : SCHOOL_COLORS[s.school]) || SCHOOL_COLORS['Evocação'];
  return {
    id: s.id, form, via: hand.via || null, burst: hand.burst || null, count: hand.count || 1, palette: pal, elemento,
    power: 0.6 + Math.min(nivel || 0, 9) / 9 * 0.9, seed: sig,
    rune: { sides: 3 + Math.floor(r() * 7), step: 1 + Math.floor(r() * 3), inner: 0.35 + r() * 0.5, spin: (r() < 0.5 ? -1 : 1) * (0.6 + r() * 1.4), marks: 3 + Math.floor(r() * 9) },
    curve: (r() - 0.5) * 0.9, hue: Math.round((r() - 0.5) * 36), tempo: 0.8 + r() * 0.2, mix: r()
  };
}
const fxSignature = c => [c.form, c.via, c.palette[0], c.rune.sides, c.rune.step, c.rune.marks, c.hue, c.seed].join('|');

/* ---------- motor ---------- */
const fxState = { cv: null, ctx: null, runs: [], parts: [], raf: 0 };
const fxMode = () => {
  const m = store.settings.anim || 'full';
  return m === 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : m;
};
function fxCanvas() {
  if (fxState.cv) return fxState.cv;
  const c = document.createElement('canvas');
  c.id = 'spell-fx'; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9000;pointer-events:none';
  document.body.appendChild(c);
  fxState.cv = c; fxState.ctx = c.getContext('2d');
  return c;
}
function fxResize() {
  const c = fxCanvas(), dpr = Math.min(devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  fxState.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function part(o) {
  if (fxState.parts.length >= FX_MAX_PARTICLES) return;
  fxState.parts.push({ vx: 0, vy: 0, g: 0, drag: 0.98, life: 0, max: 40, size: 3, shape: 'dot', ...o });
}
function emit(x, y, n, run, o = {}) {
  const { rng, rec } = run, k = run.reduced ? 0.25 : 1;
  for (let i = 0, t = Math.ceil(n * k * rec.power); i < t; i++) {
    const a = (o.a0 ?? 0) + rng() * (o.arc ?? Math.PI * 2), v = (o.v ?? 3) * (0.3 + rng());
    part({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: rec.palette[Math.floor(rng() * 3)], size: (o.size ?? 3) * (0.5 + rng()), max: (o.life ?? 40) * (0.6 + rng() * 0.6), g: o.g ?? 0, shape: o.shape || (rec.mix > 0.66 ? 'spark' : rec.mix > 0.33 ? 'dot' : 'diamond') });
  }
}
const glow = (ctx, x, y, r, c, a = 1) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), 0, 7); ctx.fill(); ctx.globalAlpha = 1;
};
const stroke = (ctx, c, w, a = 1) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha = a; };
function drawRune(ctx, x, y, R, rec, t) {
  const { sides, step, inner, spin, marks } = rec.rune, rot = t * spin * Math.PI;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  stroke(ctx, rec.palette[0], 2, Math.sin(Math.min(1, t * 1.2) * Math.PI));
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) { const a = i * step * 2 * Math.PI / sides; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * inner, 0, 7); ctx.stroke();
  for (let i = 0; i < marks; i++) { const a = i / marks * 2 * Math.PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
}
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 3);

/* Cada forma recebe o andamento t (0 a 1). A = conjurador, B = alvo. */
const FX_FORMS = {
  projectile(c, t, run) {
    const { A, B, rec } = run;
    for (let i = 0; i < rec.count; i++) {
      const tt = Math.min(1, t * 1.25 - i * 0.06); if (tt <= 0) continue;
      const off = (i - (rec.count - 1) / 2) * 46, mx = (A.x + B.x) / 2 + rec.curve * 220 + off, my = (A.y + B.y) / 2;
      const x = (1 - tt) ** 2 * A.x + 2 * (1 - tt) * tt * mx + tt ** 2 * (B.x + off * .4), y = (1 - tt) ** 2 * A.y + 2 * (1 - tt) * tt * my + tt ** 2 * B.y;
      if (tt < 1) { glow(c, x, y, 20 * rec.power, rec.palette[0]); emit(x, y, 2, run, { v: 1, life: 22, size: 2.5 }); }
      else if (!run['hit' + i]) { run['hit' + i] = 1; emit(x, y, 26, run, { v: 5 }); }
    }
  },
  ray(c, t, run) {
    const { A, B, rec } = run, g = ease(Math.min(1, t * 2.2)), x = lerp(A.x, B.x, g), y = lerp(A.y, B.y, g), f = Math.sin(t * Math.PI);
    stroke(c, rec.palette[0], 9 * rec.power * f, .45); c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(x, y); c.stroke();
    stroke(c, rec.palette[2], 3 * f, 1); c.stroke(); c.globalAlpha = 1;
    emit(x, y, 2, run, { v: 2, life: 20 });
  },
  chain(c, t, run) {
    const { B, rec, rng } = run, pts = [run.A, { x: B.x - 90, y: B.y + 60 }, { x: B.x + 80, y: B.y + 20 }, { x: B.x - 20, y: B.y - 50 }];
    const shown = Math.min(3, Math.ceil(t * 5));
    stroke(c, rec.palette[0], 3, 1 - t * .5); c.beginPath();
    for (let i = 0; i < shown; i++) {
      const a = pts[i], b = pts[i + 1]; c.moveTo(a.x, a.y);
      for (let k = 1; k <= 6; k++) c.lineTo(lerp(a.x, b.x, k / 6) + (rng() - .5) * 26, lerp(a.y, b.y, k / 6) + (rng() - .5) * 26);
      if (i === shown - 1) emit(b.x, b.y, 2, run, { v: 3, life: 16 });
    }
    c.stroke(); c.globalAlpha = 1;
  },
  cone(c, t, run) {
    const { A, B, rec } = run, a0 = Math.atan2(B.y - A.y, B.x - A.x), arc = .9, L = Math.hypot(B.x - A.x, B.y - A.y) * 1.1 * ease(t);
    c.fillStyle = rec.palette[1]; c.globalAlpha = .3 * (1 - t); c.beginPath(); c.moveTo(A.x, A.y); c.arc(A.x, A.y, L, a0 - arc / 2, a0 + arc / 2); c.fill(); c.globalAlpha = 1;
    if (t < .7) emit(A.x, A.y, 7, run, { a0: a0 - arc / 2, arc, v: 8, life: 38, size: 4 });
  },
  sphere(c, t, run) {
    const { B, rec } = run, R = 150 * rec.power * ease(t);
    glow(c, B.x, B.y, R, rec.palette[1], .8 * (1 - t)); glow(c, B.x, B.y, R * .55, rec.palette[2], 1 - t);
    stroke(c, rec.palette[0], 3, 1 - t); c.beginPath(); c.arc(B.x, B.y, R, 0, 7); c.stroke(); c.globalAlpha = 1;
    if (!run.hit) { run.hit = 1; emit(B.x, B.y, 60, run, { v: rec.burst === 'shards' ? 9 : 6, life: 44, size: 4, shape: rec.burst === 'shards' ? 'diamond' : undefined }); }
  },
  line(c, t, run) {
    const { rec, rng } = run, y = lerp(innerHeight * .62, innerHeight * .34, rec.mix), x = innerWidth * ease(t);
    stroke(c, rec.palette[1], 14 * rec.power, .4 * (1 - t)); c.beginPath(); c.moveTo(0, y); c.lineTo(x, y + rec.curve * 60); c.stroke();
    stroke(c, rec.palette[2], 3, 1 - t); c.stroke(); c.globalAlpha = 1;
    emit(x, y + (rng() - .5) * 14, 3, run, { v: 3, life: 22 });
  },
  cube(c, t, run) {
    const { B, rec } = run, S = 170 * rec.power * ease(Math.min(1, t * 1.6));
    c.save(); c.translate(B.x, B.y); c.rotate(rec.curve + t * .4);
    c.fillStyle = rec.palette[1]; c.globalAlpha = .22 * (1 - t); c.fillRect(-S / 2, -S / 2, S, S);
    stroke(c, rec.palette[0], 3, 1 - t * .7); c.strokeRect(-S / 2, -S / 2, S, S);
    stroke(c, rec.palette[2], 1.5, .8 * (1 - t)); c.strokeRect(-S / 3, -S / 3, S / 1.5, S / 1.5); c.restore(); c.globalAlpha = 1;
  },
  cylinder(c, t, run) {
    const { B, rec } = run, W = 70 * rec.power, H = innerHeight * ease(Math.min(1, t * 1.8)), f = Math.sin(t * Math.PI);
    const g = c.createLinearGradient(B.x - W, 0, B.x + W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, rec.palette[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.globalAlpha = .85 * f; c.fillRect(B.x - W, 0, W * 2, H); c.globalAlpha = 1;
    emit(B.x, H, 4, run, { v: 4, life: 26 });
  },
  emanation(c, t, run) {
    const { A, rec } = run;
    for (let i = 0; i < 3; i++) { const p = (t * 1.3 + i * .22) % 1; stroke(c, rec.palette[i], 3, (1 - p) * .9); c.beginPath(); c.arc(A.x, A.y, 240 * rec.power * p, 0, 7); c.stroke(); }
    c.globalAlpha = 1; emit(A.x, A.y, 2, run, { v: 4, life: 30 });
  },
  shockwave(c, t, run) {
    const { B, rec } = run;
    for (let i = 0; i < 2; i++) { const p = ease(Math.max(0, t - i * .15)); stroke(c, rec.palette[i], 7 * (1 - p) + 1, 1 - p); c.beginPath(); c.arc(B.x, B.y, Math.max(innerWidth, innerHeight) * .6 * p * rec.power, 0, 7); c.stroke(); }
    c.globalAlpha = 1;
  },
  rune(c, t, run) { drawRune(c, run.B.x, run.B.y, 110 * run.rec.power, run.rec, t); glow(c, run.B.x, run.B.y, 80, run.rec.palette[0], .5 * (1 - t)); },
  dome(c, t, run) {
    const { A, rec } = run, R = 130 * rec.power * ease(Math.min(1, t * 2)), f = 1 - t * t;
    c.fillStyle = rec.palette[1]; c.globalAlpha = .18 * f; c.beginPath(); c.arc(A.x, A.y, R, Math.PI, 0); c.fill();
    stroke(c, rec.palette[0], 3, f); c.beginPath(); c.arc(A.x, A.y, R, Math.PI, 0); c.stroke();
    stroke(c, rec.palette[2], 1, f * .7);
    for (let i = 1; i < rec.rune.sides; i++) { const a = Math.PI + i / rec.rune.sides * Math.PI; c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(A.x + Math.cos(a) * R, A.y + Math.sin(a) * R); c.stroke(); }
    c.globalAlpha = 1;
  },
  duplicates(c, t, run) {
    const { B, rec } = run, n = 3 + rec.rune.sides % 3, f = Math.sin(t * Math.PI);
    for (let i = 0; i < n; i++) {
      const a = i / n * 7 + rec.curve + t * 1.5, x = B.x + Math.cos(a) * 110 * ease(t), y = B.y + Math.sin(a) * 60 * ease(t);
      c.fillStyle = rec.palette[i % 3]; c.globalAlpha = .55 * f; c.beginPath(); c.ellipse(x, y - 34, 13, 15, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(x, y + 8, 19, 32, 0, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
  },
  web(c, t, run) {
    const { B, rec } = run, g = ease(Math.min(1, t * 1.7)), n = 6 + rec.rune.sides, R = 190 * rec.power * g;
    stroke(c, rec.palette[2], 1.5, 1 - t * t);
    for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI + rec.curve; c.beginPath(); c.moveTo(B.x, B.y); c.lineTo(B.x + Math.cos(a) * R, B.y + Math.sin(a) * R); c.stroke(); }
    for (let k = 1; k <= 4; k++) { c.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * 2 * Math.PI + rec.curve, r = R * k / 4; c[i ? 'lineTo' : 'moveTo'](B.x + Math.cos(a) * r, B.y + Math.sin(a) * r); } c.stroke(); }
    c.globalAlpha = 1;
  },
  portal(c, t, run) {
    const { B, rec } = run, f = Math.sin(t * Math.PI), W = 80 * rec.power * f;
    glow(c, B.x, B.y, W * 1.8, rec.palette[1], .6 * f);
    stroke(c, rec.palette[0], 4, f); c.beginPath(); c.ellipse(B.x, B.y, W, W * 1.6, 0, 0, 7); c.stroke();
    stroke(c, rec.palette[2], 2, f); c.beginPath(); c.ellipse(B.x, B.y, W * .6, W * 1.25, t * 3, 0, 7); c.stroke(); c.globalAlpha = 1;
    emit(B.x, B.y, 2, run, { v: 2.4, life: 26 });
  },
  heal(c, t, run) {
    const { A, rng, rec } = run;
    glow(c, A.x, A.y, 120 * rec.power, DMG_COLORS['Radiante'][0], .4 * (1 - t));
    for (let i = 0; i < 2; i++) part({ x: A.x + (rng() - .5) * 150, y: A.y + 40, vy: -2.6 - rng() * 2, c: i ? '#9df0b4' : rec.palette[0], size: 7, max: 46, shape: 'plus', drag: 1 });
  },
  charm(c, t, run) {
    const { B, rec, rng } = run, f = Math.sin(t * Math.PI);
    stroke(c, rec.palette[0], 2.5, f); c.beginPath();
    for (let a = 0; a < 16; a += .25) { const r = a * 7 * rec.power * ease(t), x = B.x + Math.cos(a + t * 3) * r, y = B.y + Math.sin(a + t * 3) * r; c[a ? 'lineTo' : 'moveTo'](x, y); }
    c.stroke(); c.globalAlpha = 1;
    if (rng() < .5) part({ x: B.x + (rng() - .5) * 170, y: B.y + (rng() - .5) * 90, vy: -1.3, c: rec.palette[0], size: 8, max: 40, shape: 'heart', drag: 1 });
  },
  fear(c, t, run) {
    const { B, rec, rng } = run, f = Math.sin(t * Math.PI);
    glow(c, B.x, B.y, 200 * rec.power, '#05040a', .85 * f);
    stroke(c, rec.palette[1], 3, f); c.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * 7 + rec.curve; c.moveTo(B.x, B.y);
      for (let k = 1; k <= 5; k++) c.lineTo(B.x + Math.cos(a + k * .3) * k * 34 * ease(t) + (rng() - .5) * 6, B.y + Math.sin(a + k * .3) * k * 34 * ease(t));
    }
    c.stroke(); c.globalAlpha = 1;
  },
  teleport(c, t, run) {
    const { A, B, rec } = run, a = t < .5 ? A : B, f = t < .5 ? 1 - t * 2 : (t - .5) * 2;
    glow(c, a.x, a.y, 70 * f + 10, rec.palette[0], .9);
    if (t < .5) emit(a.x, a.y, 4, run, { v: 4, life: 22 });
    else if (!run.hit) { run.hit = 1; emit(a.x, a.y, 30, run, { v: 4 }); }
  },
  mist(c, t, run) {
    const { B, rec, rng } = run, f = Math.sin(t * Math.PI);
    for (let i = 0; i < 3; i++) glow(c, B.x + (rng() - .5) * 240, B.y + (rng() - .5) * 110, 110 * rec.power, rec.palette[i], .22 * f);
  },
  light(c, t, run) {
    const { B, rec } = run, f = Math.sin(t * Math.PI), n = 8 + rec.rune.sides, R = 260 * rec.power * ease(t);
    glow(c, B.x, B.y, R * .7, rec.palette[2], .8 * f);
    stroke(c, rec.palette[0], 3, f);
    for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI + t + rec.curve; c.beginPath(); c.moveTo(B.x + Math.cos(a) * 30, B.y + Math.sin(a) * 30); c.lineTo(B.x + Math.cos(a) * R, B.y + Math.sin(a) * R); c.stroke(); }
    c.globalAlpha = 1;
  },
  rain(c, t, run) {
    const { B, rec, rng } = run;
    if (t < .75) for (let i = 0; i < 4; i++) { const x = B.x + (rng() - .5) * innerWidth * .8; part({ x: x + 90, y: -10, vx: -3, vy: 13 + rng() * 6, c: rec.palette[Math.floor(rng() * 3)], size: 3, max: 62, shape: 'streak', drag: 1 }); }
  },
  thorns(c, t, run) {
    const { B, rec } = run, n = 9 + rec.rune.sides, g = ease(Math.min(1, t * 1.8)), f = 1 - t * t;
    c.fillStyle = rec.palette[1]; c.globalAlpha = f;
    for (let i = 0; i < n; i++) {
      const x = B.x + (i - n / 2) * 34, h = (70 + ((i * 37 + rec.rune.marks * 13) % 90)) * g, y = B.y + 90;
      c.beginPath(); c.moveTo(x - 10, y); c.quadraticCurveTo(x + rec.curve * 30, y - h * .6, x + rec.curve * 20, y - h); c.quadraticCurveTo(x + 4, y - h * .4, x + 10, y); c.fill();
    }
    c.globalAlpha = 1;
  },
  wall(c, t, run) {
    const { B, rec, rng } = run, W = Math.min(innerWidth * .8, 520), H = 180 * rec.power * ease(Math.min(1, t * 2)), f = 1 - t * t * t;
    const g = c.createLinearGradient(0, B.y + 90, 0, B.y + 90 - H); g.addColorStop(0, rec.palette[1]); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.globalAlpha = f; c.fillRect(B.x - W / 2, B.y + 90 - H, W, H); c.globalAlpha = 1;
    emit(B.x + (rng() - .5) * W, B.y + 90, 3, run, { a0: -1.9, arc: .7, v: 4, life: 30 });
  }
};
const FX_FORM_NAMES = Object.keys(FX_FORMS);

function drawPart(c, p) {
  const a = Math.max(0, 1 - p.life / p.max);
  c.globalAlpha = a; c.fillStyle = p.c; c.strokeStyle = p.c;
  switch (p.shape) {
    case 'spark': c.lineWidth = Math.max(1, p.size * .5); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); c.stroke(); break;
    case 'streak': c.lineWidth = p.size; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); c.stroke(); break;
    case 'diamond': c.beginPath(); c.moveTo(p.x, p.y - p.size); c.lineTo(p.x + p.size * .6, p.y); c.lineTo(p.x, p.y + p.size); c.lineTo(p.x - p.size * .6, p.y); c.fill(); break;
    case 'plus': c.fillRect(p.x - p.size / 2, p.y - p.size / 6, p.size, p.size / 3); c.fillRect(p.x - p.size / 6, p.y - p.size / 2, p.size / 3, p.size); break;
    case 'heart': c.beginPath(); c.arc(p.x - p.size / 4, p.y, p.size / 3, 0, 7); c.arc(p.x + p.size / 4, p.y, p.size / 3, 0, 7); c.moveTo(p.x - p.size / 2, p.y + 1); c.lineTo(p.x, p.y + p.size / 1.5); c.lineTo(p.x + p.size / 2, p.y + 1); c.fill(); break;
    default: c.beginPath(); c.arc(p.x, p.y, p.size, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
}
function fxFrame(now) {
  const c = fxState.ctx;
  c.clearRect(0, 0, innerWidth, innerHeight);
  c.globalCompositeOperation = 'lighter';
  fxState.runs = fxState.runs.filter(run => {
    const t = (now - run.start) / run.ms;
    if (t < 0) return true;
    if (t >= 1) return false;
    drawRune(c, run.A.x, run.A.y, 46 * run.rec.power, run.rec, t);
    const viaMax = run.rec.via ? .42 : 0;
    if (run.rec.via && t < viaMax) FX_FORMS[run.rec.via](c, t / viaMax, run);
    else FX_FORMS[run.rec.form](c, (t - viaMax) / (1 - viaMax), run);
    return true;
  });
  fxState.parts = fxState.parts.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.life++;
    drawPart(c, p);
    return p.life < p.max;
  });
  c.globalCompositeOperation = 'source-over';
  if (fxState.runs.length || fxState.parts.length) fxState.raf = requestAnimationFrame(fxFrame);
  else { fxState.raf = 0; c.clearRect(0, 0, innerWidth, innerHeight); }
}
/** Toca a animação da magia. Devolve a receita, ou null quando as animações estão desligadas. */
function playSpell(s, tipo, nivel, res) {
  const mode = fxMode();
  if (mode === 'off') return null;
  const rec = spellRecipe(s, tipo, nivel);
  fxResize();
  fxState.runs.push({
    rec, rng: fxRng(rec.seed ^ performance.now()), start: performance.now(), reduced: mode === 'reduced',
    ms: Math.min(FX_MAX_MS, (mode === 'reduced' ? 600 : 1500) * rec.tempo),
    A: { x: innerWidth / 2, y: innerHeight * .78 }, B: { x: innerWidth / 2 + rec.curve * 90, y: innerHeight * .32 }
  });
  if (!fxState.raf) fxState.raf = requestAnimationFrame(fxFrame);
  return rec;
}
/** Passa uma receita por todos os quadros sem esperar o relógio. Usada nos testes. */
function fxDryRun(s, tipo) {
  const rec = spellRecipe(s, tipo);
  fxResize();
  const run = { rec, rng: fxRng(rec.seed), start: 0, ms: 1000, reduced: false, A: { x: 195, y: 600 }, B: { x: 195, y: 250 } }, c = fxState.ctx;
  fxState.parts.length = 0;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12.5;
    drawRune(c, run.A.x, run.A.y, 40, rec, t);
    const via = rec.via ? .42 : 0;
    if (rec.via && t < via) FX_FORMS[rec.via](c, t / via, run); else FX_FORMS[rec.form](c, (t - via) / (1 - via), run);
  }
  fxState.parts.forEach(p => drawPart(c, p));
  fxState.parts.length = 0;
  return rec;
}
