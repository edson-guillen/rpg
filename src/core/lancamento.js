/* =====================================================================
   LANÇAMENTO
   Diz o que uma conjuração permite rolar e fecha o resultado. Aqui ficam
   só as regras: `diceSpec` lê a magia, `novoLance` guarda o que foi
   rolado e `resolveLance` devolve total, crítico, saltos e sorte.
   ===================================================================== */
const mesaRows = (s, modo) => (s.r || []).filter(x => (x.t === 'dmg' || x.t === 'aux') && (modo === 'livre' || !x.depois));
const mesaAlts = (s, modo = 'cast') => [...new Set(mesaRows(s, modo).filter(x => x.alt).map(x => x.alt))];

/** Dados da linha para um círculo: tabela, escalonamento, truque, modificador e somas fixas. */
function rowExpr(s, x, lv) {
  const base = baseDice(x), acima = Math.max(0, lv - s.level);
  const e = x.table?.[lv] ? x.table[lv] + modExpr(x) : x.up && acima ? addDice(base, x.up, acima) : base;
  const p = parseDice(e);
  return { n: p.n, f: p.f, mod: p.mod + (x.addSlot ? lv : 0) + (x.upMod || 0) * acima };
}
const instCount = (s, lv) => {
  const i = s.inst;
  if (!i) return 1;
  return i.truque ? i.n + cantripTier() - 1 : i.n + (i.up || 0) * Math.max(0, lv - s.level);
};

function diceSpec(s, lv = s.level, ctx = {}) {
  const modo = ctx.modo || 'cast', alts = mesaAlts(s, modo), alt = alts.includes(ctx.alt) ? ctx.alt : alts[0] || null;
  const temAtk = (s.r || []).some(x => x.t === 'atk'), temSave = (s.r || []).some(x => x.t === 'save');
  const atk = (s.r || []).find(x => x.t === 'atk');
  const gateDe = x => {
    if (x.heal || x.t === 'aux' || x.gate === 'none') return null;
    if (x.gate) return x.gate;
    if (x.crit && temAtk) return 'atk';
    if (x.half && temSave) return 'save';
    return temAtk ? 'atk' : temSave ? 'save' : null;
  };
  const grupos = mesaRows(s, modo).filter(x => !x.alt || x.alt === alt).map((x, i) => {
    const e = rowExpr(s, x, lv), nat = rowExpr(s, { ...x, table: null, up: null, cantrip: null, tiers: null, upMod: 0, addMod: false, addSlot: false }, s.level);
    const escolhido = s.choice?.length && ctx.tipo && !x.heal && x.t !== 'aux';
    return { id: `g${i}`, ...e, nBase: Math.min(e.n, nat.n), aux: x.t === 'aux', label: x.label || x.alt || '', type: x.t === 'aux' ? '' : escolhido ? ctx.tipo : x.type, heal: !!x.heal,
      crit: !!x.crit, half: !!x.half, gate: gateDe(x), missHalf: !!x.missHalf, orb: !!x.orb, acumula: x.acumula || null,
      explode: x.explode ? { v: +x.explode, max: x.maxMod ? Math.max(0, CHAR.stats.cha) : +x.max || 0 } : null };
  }).filter(g => g.n > 0 && g.f > 0);
  const danos = grupos.filter(g => !g.aux), comAtk = danos.some(g => g.gate === 'atk'), golpe = String(s.id).startsWith('cl-') && atk?.spell === false;
  const usados = [], somados = [];
  let B = null;
  if (golpe && danos.length) {
    const fm = modScore(abil('FOR').s), dm = modScore(abil('DES').s);
    B = bonusDeAtaque({ attr: fm >= dm || state.fx.rage ? 'FOR' : 'DES', melee: true, desarmado: true });
    danos[0].mod += B.mod;
    B.dados.forEach((x, j) => grupos.push({ id: `b${j}`, n: x.n, f: x.f, mod: x.mod, nBase: x.n, aux: false, label: x.nome, type: x.tipo || danos[0].type, heal: false, crit: true, half: false, gate: 'atk', missHalf: false, orb: false, acumula: null, explode: null }));
    usados.push(...B.lista);
    B.lista.filter(r => r.mod).forEach(r => somados.push(`${r.nome} ${sign(r.mod)}`));
  } else if (danos.length && !golpe) {
    for (const r of bonusDeMagia(s, g => g.type || '')) {
      const g = danos.find(r.casa);
      if (!g || !r.mod) continue;
      if (r.cadaAlvo) g.mod += r.mod; else g.modUma = (g.modUma || 0) + r.mod;
      somados.push(`${r.nome} ${sign(r.mod)}`);
    }
  }
  return {
    id: s.id, nome: s.name, lv, modo, alts, alt, tipo: ctx.tipo || null, grupos, inst: danos.length ? instCount(s, lv) : 1, rotulo: s.inst?.rotulo || '',
    atk: comAtk ? { bonus: (atk?.bonus ?? CHAR.stats.atk) + (B?.atk || 0), adv: (atk?.spell !== false && !!state.fx.innate) || !!B?.adv, crit: B?.crit || 20 } : null, usados, somados,
    save: danos.some(g => g.gate === 'save'), saltos: danos.some(g => g.orb) ? Math.max(1, lv) : 0
  };
}

const cellKey = (i, g) => `${i}:${g.id}`;
const validoDado = (f, v) => Number.isInteger(v) && v >= 1 && v <= f;
function novoLance(spec) {
  return { spec, dados: {}, extras: {}, totais: {}, d20: {}, erro: {}, save: 'falhou', stack: 0, refeitos: 0 };
}
/** Resultado natural do d20 da instância; com Vantagem, vale o maior. */
function natural(L, i) {
  const [a, b] = L.d20[i] || [];
  return L.spec.atk?.adv ? Math.max(a || 0, b || 0) : a || 0;
}
const isCrit = (L, i) => { const n = natural(L, i); return n === 20 || (!!n && n >= (L.spec.atk?.crit || 20)); };
const isMiss = (L, i) => natural(L, i) === 1 || (!isCrit(L, i) && !!L.erro[i]);
function dicePorGrupo(L, g, i) {
  const n = g.n + (g.acumula ? L.stack * parseDice(g.acumula).n : 0);
  return g.crit && L.spec.atk && isCrit(L, i) ? n * 2 : n;
}
/** Quantos dados extras a explosão já abriu nesta casa. */
function extrasAbertos(L, g, i) {
  if (!g.explode) return 0;
  const k = cellKey(i, g), base = (L.dados[k] || []).filter(v => v === g.explode.v).length, ex = L.extras[k] || [];
  let abertos = Math.min(base, g.explode.max);
  for (let j = 0; j < abertos && j < ex.length; j++) if (ex[j] === g.explode.v && abertos < g.explode.max) abertos++;
  return abertos;
}
const repetidos = vals => { const c = {}; vals.forEach(v => { c[v] = (c[v] || 0) + 1; }); return Object.keys(c).filter(v => v && c[v] > 1).map(Number); };
/** Instâncias da conjuração: dardos e raios fixos, mais os saltos que os dados repetidos abrirem. */
function instanciasDe(L) {
  const sp = L.spec, orb = sp.grupos.find(g => g.orb);
  let n = sp.inst;
  if (orb) for (let i = 0, lim = sp.saltos; i < lim && i === n - 1; i++) {
    if (isMiss(L, i)) break;
    const vals = (L.dados[cellKey(i, orb)] || []).filter(Boolean);
    if (L.totais[cellKey(i, orb)] == null && vals.length === dicePorGrupo(L, orb, i) && repetidos(vals).length) n++;
  }
  return n;
}
const faixaGrupo = (L, g, i) => { const n = dicePorGrupo(L, g, i) + extrasAbertos(L, g, i); return { min: n + g.mod, max: n * g.f + g.mod, n }; };
/** Reparte um total entre os dados, para desenhá-los quando só o total foi informado. */
function partir(total, n, f) {
  const vals = Array(n).fill(1);
  let resto = total - n;
  const ordem = vals.map((_, i) => i).sort(() => Math.random() - .5);
  ordem.forEach(i => { const v = Math.min(f - 1, resto); vals[i] += v; resto -= v; });
  return vals;
}
/** Preenche o que faltar, como se o app rolasse. Usado por "Rolar no app" e nas casas vazias. */
function completarLance(L) {
  const sp = L.spec;
  for (let i = 0; i < instanciasDe(L); i++) {
    if (sp.atk) { const d20 = L.d20[i] = L.d20[i] || []; if (!d20[0]) d20[0] = d(20); if (sp.atk.adv && !d20[1]) d20[1] = d(20); }
    sp.grupos.forEach(g => {
      const k = cellKey(i, g);
      if (L.totais[k] != null) return;
      const vals = L.dados[k] = L.dados[k] || [], n = dicePorGrupo(L, g, i);
      for (let j = 0; j < n; j++) if (!vals[j]) vals[j] = d(g.f);
      vals.length = n;
      if (g.explode) {
        const ex = L.extras[k] = L.extras[k] || [];
        for (let j = 0; j < extrasAbertos(L, g, i); j++) if (!ex[j]) ex[j] = d(g.f);
      }
    });
  }
  return L;
}
function resolveLance(L) {
  const sp = L.spec, n = instanciasDe(L), inst = [], aux = [], tipos = new Set();
  let total = 0, bruto = 0, min = 0, max = 0, curaPura = true;
  for (let i = 0; i < n; i++) {
    const hit = !sp.atk || !isMiss(L, i), crit = !!sp.atk && isCrit(L, i), passou = sp.save && L.save === 'passou';
    let soma = 0;
    const dados = [], tiposI = [];
    sp.grupos.forEach(g => {
      const k = cellKey(i, g), f = faixaGrupo(L, g, i), informado = L.totais[k];
      const vals = informado != null ? partir(informado - g.mod, f.n, g.f) : [...(L.dados[k] || []).slice(0, dicePorGrupo(L, g, i)), ...(L.extras[k] || []).slice(0, extrasAbertos(L, g, i))].filter(Boolean);
      const baseN = dicePorGrupo(L, g, i), rep = g.orb ? repetidos(vals.slice(0, baseN)) : [], um = i === 0 ? g.modUma || 0 : 0, valor = (informado ?? vals.reduce((a, b) => a + b, 0) + g.mod) + um;
      if (g.aux) { if (i === 0) aux.push({ label: g.label, f: g.f, mod: g.mod, vals, total: valor }); return; }
      vals.forEach((v, j) => dados.push({ v, f: g.f, tipo: g.type, extra: j >= baseN ? 'exp' : rep.includes(v) ? 'rep' : crit && g.crit && j >= baseN / 2 ? 'crit' : j >= g.nBase ? 'up' : null }));
      let parte = Math.max(0, valor);
      const antes = parte;
      if (g.gate === 'atk' && !hit) parte = g.missHalf ? Math.floor(parte / 2) : 0;
      if (g.gate === 'save' && passou) parte = g.half ? Math.floor(parte / 2) : 0;
      soma += parte; bruto += antes; min += f.min + um; max += f.max + um;
      if (!g.heal) curaPura = false;
      tiposI.push(g.type); tipos.add(g.type);
    });
    total += soma;
    inst.push({ i, hit, crit, nat: natural(L, i), d20: L.d20[i] || null, total: soma, dados, tipos: tiposI, salto: i >= sp.inst });
  }
  const temDano = sp.grupos.some(g => !g.aux), semAcerto = !!sp.atk && inst.every(x => !x.hit);
  return {
    id: sp.id, nome: sp.nome, lv: sp.lv, tipo: sp.tipo, alt: sp.alt, total, bruto, min, max, sorte: max > min ? Math.min(1, Math.max(0, (bruto - min) / (max - min))) : .5,
    crit: inst.some(x => x.crit), erro: semAcerto, passou: sp.save && L.save === 'passou', varios: sp.save && L.save === 'varios', cura: temDano && curaPura,
    inst, aux, tipos: [...tipos], temDano, saltos: Math.max(0, n - sp.inst)
  };
}
/** Tamanho vem do dano absoluto; força vem da sorte na rolagem. */
function impacto(res, nivel = 0) {
  if (!res || !res.temDano) return { tamanho: .75 + Math.min(nivel, 9) / 9 * .75, forca: .35 + Math.min(nivel, 9) / 18, erro: false, crit: false, cura: false };
  return { tamanho: res.erro ? .4 : Math.min(2.2, .6 + Math.sqrt(res.total / 42) * .95), forca: res.erro ? 0 : Math.min(1, .15 + res.sorte * .75 + (res.crit ? .25 : 0)) * (res.passou ? .55 : 1), erro: res.erro, crit: res.crit, cura: res.cura };
}
