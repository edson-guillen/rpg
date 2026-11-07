/* =====================================================================
   MOTOR DE REGRAS — calcula a ficha a partir do nível, dos atributos e
   das escolhas, para todas as classes de D&D 2024.
   ===================================================================== */
const modScore = v => Math.floor((v - 10) / 2);
const pbOf = n => Math.ceil(n / 4) + 1;
const signed = n => (n >= 0 ? '+' : '−') + Math.abs(n);
const num = n => (n < 0 ? '−' : '') + Math.abs(n);
const spd = ft => String(ft * 0.3).replace('.', ',') + ' m';

function sorenBuild() {
  return {
    classId: 'sorcerer', subclassId: 'draconic', level: 4, speciesId: 'goliath', lineage: 'cloud', backgroundId: 'wayfarer',
    scores: Object.fromEntries(SOREN.abilities.map(a => [a.k, a.s])), hpRolls: [4, 4, 4], feats: ['lucky', 'war-caster'], metamagic: ['quick', 'subtle'], planned: {}, expertise: [], escolhas: {}, multi: [],
    skills: Object.fromEntries(SOREN.skills.filter(s => s[2]).map(s => [s[0], s[2]]))
  };
}
function blankBuild(level = 1, classId = 'sorcerer') {
  return { classId, subclassId: classId === 'sorcerer' && level >= 3 ? 'draconic' : null, level, speciesId: null, lineage: null, backgroundId: null, scores: Object.fromEntries(ATTR.map(([k]) => [k, 10])), hpRolls: [], feats: [], metamagic: [], planned: {}, skills: {}, expertise: [], escolhas: {}, multi: [] };
}
const buildOf = c => c.build || (c.build = c.template === 'soren' ? sorenBuild() : blankBuild(c.level || 1));

/** Classes do personagem, a principal primeiro. */
function classesOf(b) {
  const extras = b.multi || [], soma = extras.reduce((a, x) => a + x.level, 0);
  return [{ id: b.classId || 'sorcerer', lv: b.level - soma, sub: b.subclassId }, ...extras.map(x => ({ id: x.classId, lv: x.level, sub: x.subclassId }))];
}
const subDe = x => CLASSES[x.id]?.subs?.[x.sub] || null;
const nivelDe = (b, id) => classesOf(b).find(x => x.id === id)?.lv || 0;
const notas = n => (n >= 17 ? 4 : n >= 11 ? 3 : n >= 5 ? 2 : 1);
function scoresOf(b) {
  const s = { ...b.scores };
  if (nivelDe(b, 'barbarian') >= 20) for (const k of ['FOR', 'CON']) s[k] = Math.min(25, s[k] + 4);
  if (nivelDe(b, 'monk') >= 20) for (const k of ['DES', 'SAB']) s[k] = Math.min(25, s[k] + 4);
  return s;
}
function hpMaxOf(b, con = modScore(scoresOf(b).CON)) {
  const n = b.level, cl = classesOf(b), hd = CLASSES[cl[0].id].hd, rolls = b.hpRolls.slice(0, n - 1).reduce((a, r) => a + r + con, 0);
  const lvS = nivelDe(b, 'sorcerer'), resil = cl.some(x => x.sub === 'draconic') && lvS >= 3 ? lvS : 0, anao = b.speciesId === 'dwarf' ? n : 0, vig = b.feats.some(x => x === 'vigoroso') ? 2 * n : 0;
  return { base: hd + con, rolls, resil, anao, vig, hd, total: Math.max(1, hd + con + rolls + resil + anao + vig) };
}
function featuresOf(b) {
  return classesOf(b).flatMap(x => {
    const C = CLASSES[x.id], s = subDe(x), fim = (lista, nome, off = 0) => lista.map(f => [f[0] + off, f[1], f[2], nome]);
    return [...fim(C.feats, C.name), ...(s ? fim(s.feats, s.name) : [])];
  }).sort((x, y) => x[0] - y[0]);
}
/** Espaços de magia: classe única usa a própria tabela; multiclasse soma os níveis de conjurador. */
function conjuracaoDe(b) {
  const cl = classesOf(b).map(x => ({ ...x, caster: subDe(x)?.caster && x.lv >= 3 ? subDe(x).caster : CLASSES[x.id].caster })).filter(x => x.caster);
  const regulares = cl.filter(x => x.caster.tipo !== 'pact'), pacto = cl.find(x => x.caster.tipo === 'pact');
  const tabela = x => (x.caster.tipo === 'third' ? TERCO_SLOTS[x.lv - 1] : CLASS_LEVELS[x.id][x.lv - 1].slots);
  let base = Array(9).fill(0);
  if (regulares.length === 1) base = tabela(regulares[0]) || base;
  else if (regulares.length > 1) {
    const ef = regulares.reduce((a, x) => a + (x.caster.tipo === 'full' ? x.lv : x.caster.tipo === 'half' ? Math.ceil(x.lv / 2) : Math.floor(x.lv / 3)), 0);
    base = CLASS_LEVELS.wizard[Math.min(20, Math.max(1, ef)) - 1].slots;
  }
  const slots = Object.fromEntries(base.map((v, i) => [i + 1, v]).filter(([, v]) => v > 0)), pact = {};
  if (pacto) CLASS_LEVELS.warlock[pacto.lv - 1].slots.forEach((v, i) => { if (v) { slots[i + 1] = (slots[i + 1] || 0) + v; pact[i + 1] = v; } });
  const principal = cl[0] || null;
  const lim = cl.reduce((a, x) => {
    const L = CLASS_LEVELS[x.id][x.lv - 1];
    return { cantrips: a.cantrips + (x.caster.truques ? x.caster.truques(x.lv) : L.cantrips || 0), prepared: a.prepared + (x.caster.tipo === 'third' ? TERCO_PREP[x.lv - 1] : L.prepared || 0) };
  }, { cantrips: 0, prepared: 0 });
  return { slots, pact, attr: principal?.caster.attr || null, lista: principal ? principal.caster.lista || principal.id : null, limits: lim };
}
function caDe(b, M, cl) {
  const dex = M.DES, escudo = b.shield ? 2 : 0, arm = ARMADURAS.find(a => a[0] === b.armor);
  const opc = [{ v: 10 + dex, txt: `10 + DES ${num(dex)}` }];
  if (arm) return { v: arm[1] + (arm[2] ? Math.min(dex, arm[2]) : 0) + escudo, txt: `${arm[0]}${arm[2] ? ` + DES ${num(Math.min(dex, arm[2]))}` : ''}${escudo ? ' + Escudo 2' : ''}` };
  for (const x of cl) {
    const un = CLASSES[x.id].unarmored;
    if (un && !(CLASSES[x.id].semEscudo && b.shield)) opc.push({ v: 10 + dex + M[un], txt: `10 + DES ${num(dex)} + ${un} ${num(M[un])} (Defesa sem Armadura)` });
    if (x.sub === 'draconic' && x.lv >= 3) opc.push({ v: 10 + dex + M.CAR, txt: `10 + DES ${num(dex)} + CAR ${num(M.CAR)} (Resiliência Dracônica)` });
    if (x.sub === 'dance' && x.lv >= 3 && !b.shield) opc.push({ v: 10 + dex + M.CAR, txt: `10 + DES ${num(dex)} + CAR ${num(M.CAR)} (Ginga Fascinante)` });
  }
  const m = opc.reduce((a, o) => (o.v > a.v ? o : a));
  return { v: m.v + escudo, txt: m.txt + (escudo ? ' + Escudo 2' : '') };
}
function deslocamentoDe(b, sp, cl) {
  let ft = sp?.speed || 30;
  const pesada = ARMADURAS.find(a => a[0] === b.armor)?.[3] === 'pesada', sem = !b.armor;
  for (const x of cl) {
    if (x.id === 'barbarian' && x.lv >= 5 && !pesada) ft += 10;
    if (x.id === 'ranger' && x.lv >= 6 && !pesada) ft += 10;
    if (x.id === 'monk' && sem && !b.shield) ft += CLASS_LEVELS.monk[x.lv - 1].unarmored_movement_bonus || 0;
  }
  return ft;
}
function ataquesDe(c, b, M, pb, cl) {
  const itens = [...(c.state?.items || c.sheet?.items || [])], pegou = new Set(), monge = cl.find(x => x.id === 'monk'), pacto = (b.escolhas?.invocacoes || []).includes('Pacto da Lâmina'), desarmado = desarmadoDe(b, M, pb, cl);
  const armas = itens.flatMap(i => {
    const a = ARMAS.find(w => w[0] === i.name);
    if (!a || pegou.has(a[0])) return [];
    pegou.add(a[0]);
    const [nome, dado, tipo, props, maestria, simples, dist] = a, acu = /Acuidade/.test(props);
    let k = dist ? 'DES' : acu ? (M.DES >= M.FOR ? 'DES' : 'FOR') : 'FOR', face = dado;
    // Artes Marciais: Destreza e o dado do Monge, sem armadura nem Escudo.
    if (monge && !dist && !b.armor && !b.shield && (simples || /Leve/.test(props))) {
      if (M.DES > M[k]) k = 'DES';
      const fm = CLASS_LEVELS.monk[monge.lv - 1].martial_arts_die;
      if (fm > +String(dado).split('d')[1] || dado === '1') face = `1d${fm}`;
    }
    if (pacto && !dist && M.CAR > M[k]) k = 'CAR';
    const m = M[k];
    return [{ id: 'w-' + nome, name: nome, sub: [props, maestria && cl.some(x => CLASSES[x.id].mastery) ? 'Maestria: ' + maestria : ''].filter(Boolean).join(' · '), atk: m + pb, calc: `${k} ${num(m)} + BP ${pb}`, dmg: face === '1' ? '1d1' : face + modDe(m), type: tipo,
      attr: k, arma: true, melee: !dist, dist: !!dist, acuidade: acu, arremesso: /Arremesso/.test(props), duas: /Duas Mãos/.test(props), versatil: /Versátil \((\d+d\d+)\)/.exec(props)?.[1] || null }];
  });
  return desarmado ? [...armas, desarmado] : armas;
}
/** Linha de Ataque Desarmado para quem tem dado próprio nele. */
function desarmadoDe(b, M, pb, cl) {
  const monge = cl.find(x => x.id === 'monk'), danca = cl.find(x => x.sub === 'dance' && x.lv >= 3 && !b.armor && !b.shield), estilo = (b.escolhas?.estilos || []).includes('Combate Desarmado');
  const opc = [];
  if (monge) opc.push({ f: CLASS_LEVELS.monk[monge.lv - 1].martial_arts_die, k: M.DES > M.FOR ? 'DES' : 'FOR', txt: 'Artes Marciais' });
  if (danca) opc.push({ f: CLASS_LEVELS.bard[danca.lv - 1].bardic_inspiration_die, k: 'DES', txt: 'Ginga Fascinante' });
  if (estilo) opc.push({ f: b.shield ? 6 : 8, k: 'FOR', txt: 'Combate Desarmado' });
  if (!opc.length) return null;
  const o = opc.reduce((a, x) => (x.f + M[x.k] > a.f + M[a.k] ? x : a)), m = M[o.k];
  return { id: 'w-desarmado', name: 'Ataque Desarmado', sub: o.txt, atk: m + pb, calc: `${o.k} ${num(m)} + BP ${pb}`, dmg: `1d${o.f}${modDe(m)}`, type: 'Contundente', attr: o.k, arma: false, desarmado: true, melee: true };
}
function ataquesPorAcao(cl, b) {
  let n = 1, inv = b.escolhas?.invocacoes || [];
  if (inv.includes('Lâmina Sedenta')) n = 2;
  if (inv.includes('Lâmina Devoradora')) n = 3;
  for (const x of cl) {
    if (['barbarian', 'monk', 'paladin', 'ranger'].includes(x.id) && x.lv >= 5) n = Math.max(n, 2);
    if (x.id === 'fighter') n = Math.max(n, x.lv >= 20 ? 4 : x.lv >= 11 ? 3 : x.lv >= 5 ? 2 : 1);
    if (['armorer', 'battle-smith'].includes(x.sub) && x.lv >= 5) n = Math.max(n, 2);
    if (x.sub === 'valor' && x.lv >= 6) n = Math.max(n, 2);
  }
  return n;
}
/** Ações de classe disponíveis, já com os dados do nível. */
function acoesDe(b, M, pb) {
  return classesOf(b).flatMap(x => {
    const C = CLASSES[x.id], L = { ...CLASS_LEVELS[x.id][x.lv - 1], pb }, s = subDe(x);
    return [...(C.acoes || []), ...(s?.acoes || [])].filter(a => x.lv >= a.min).map(a => ({ ...a, classe: C.name, r: a.r ? a.r(x.lv, L, M) : [] }));
  });
}

/** Monta a ficha completa no formato que as telas usam. */
function deriveSheet(c) {
  const b = buildOf(c), base = c.template === 'soren' ? SOREN : blankSheet(), n = b.level, cl = classesOf(b), C0 = CLASSES[cl[0].id], sc = scoresOf(b);
  const mod = k => modScore(sc[k]), M = Object.fromEntries(ATTR.map(([k]) => [k, mod(k)])), pb = pbOf(n), con = M.CON, dex = M.DES;
  const lvS = nivelDe(b, 'sorcerer'), hp = hpMaxOf(b), has = id => b.feats.includes(id), sp = speciesById(b.speciesId), conj = conjuracaoDe(b), attr = conj.attr, mc = attr ? M[attr] : 0, marcial = Math.max(M.FOR, dex);
  const ca = caDe(b, M, cl), ft = deslocamentoDe(b, sp, cl), savs = C0.saves;
  const stats = { ac: ca.v, shieldBonus: 5, hpMax: hp.total, dc: 8 + pb + (attr ? mc : C0.cdAttr ? M[C0.cdAttr] : marcial), atk: pb + (attr ? mc : marcial), init: dex + (has('alert') ? pb : 0), speed: spd(ft), pb, cha: attr ? mc : M.CAR, conSave: con + (savs.includes('CON') ? pb : 0), attr };
  const res = id => base.resources?.find(r => r.id === id) || SOREN.resources.find(r => r.id === id);
  const resources = [];
  if (lvS) resources.push({ ...res('sp'), max: lvS >= 2 ? lvS : 0, desc: res('sp').desc.replace(/Máximo de \d+/, `Máximo de ${lvS >= 2 ? lvS : 0}`) }, { ...res('innate'), desc: res('innate').desc.replace(/\(fica \d+\)/, `(fica ${stats.dc + 1})`) });
  for (const x of cl) {
    const K = CLASSES[x.id], L = { ...CLASS_LEVELS[x.id][x.lv - 1], wis: M.SAB }, s = subDe(x);
    resources.push(...K.recursos(x.lv, L, M), ...(s?.recursos ? s.recursos(x.lv, L, M) : []));
  }
  if (b.speciesId === 'goliath' && b.lineage === 'cloud') resources.push({ ...res('jaunt'), max: pb });
  if (has('lucky')) resources.push({ ...res('luck'), max: pb });
  if (b.speciesId === 'goliath' && n >= 5) resources.push({ id: 'large', name: 'Forma Grande', icon: 'i-shield', c: 'lv0', max: 1, meta: 'Golias · Ação Bônus · 10 minutos · Descanso Longo', desc: 'Fica <b>Grande</b>, com Vantagem em testes de Força e <b>+3 m</b> de Deslocamento.', action: { label: 'Usar' } });
  resources.push({ ...res('hd'), max: n, meta: `d${hp.hd} · Descanso Curto para gastar`, desc: `Cada dado gasto num Descanso Curto cura <b>1d${hp.hd} ${con < 0 ? '−' : '+'} ${Math.abs(con)}</b>. Todos voltam no Descanso Longo (regra 2024).` });
  const attacks = c.template === 'soren' ? SOREN.attacks.map(a => {
    const k = a.id.startsWith('ts-') || a.id === 'natural' ? 'CAR' : a.id === 'dagger' ? 'DES' : 'FOR', m = mod(k), die = a.dmg.match(/^\d+d\d+/)[0], ts = a.id.startsWith('ts-');
    return { ...a, atk: m + pb, calc: `${k} ${num(m)} + BP ${pb}`, dmg: `${die}${m < 0 ? '-' : '+'}${Math.abs(m)}`, attr: k, arma: a.id !== 'natural', melee: true, acuidade: /dagger/.test(a.id), arremesso: /dagger|spear/.test(a.id), duas: /spear2/.test(a.id), ...(ts && n >= 5 ? { sub: `${a.sub} · +${n >= 17 ? 3 : n >= 11 ? 2 : 1}d6 Radiante` } : {}) };
  }) : ataquesDe(c, b, M, pb, cl);
  const chosen = b.metamagic.map(id => (c.template === 'soren' && SOREN.metamagic.find(m => m.id === id)) || METAMAGIC.find(m => m.id === id)).filter(Boolean);
  const lin = sp?.lineages?.[b.lineage]?.[0], carry = Math.round(sc.FOR * 7.5 * (b.speciesId === 'goliath' ? 2 : 1));
  const atq = ataquesPorAcao(cl, b);
  const passives = c.template === 'soren' ? SOREN.passives.map(p => ({
    ...p, items: p.t === 'Resiliência Dracônica' ? [`+${n} PV máximos (já incluídos nos ${hp.total}).`, `Sem armadura, CA = 10 + DES ${num(dex)} + CAR ${num(M.CAR)} = <b>${stats.ac}</b>.`]
      : p.items.map(i => i.replace(/\(\+4\)\./, `(${signed(stats.conSave)}).`).replace(/<b>120 kg<\/b>|120 kg/, m => m.replace('120', carry)))
  })) : [{ t: 'Em combate', items: [`Ataques por ação Atacar: <b>${atq}</b>.`, ...escolhasTexto(b)] }];
  const acoes = acoesDe(b, M, pb);
  return {
    ...base, stats, hitDie: hp.hd, conMod: con, slots: conj.slots, pactSlots: conj.pact, createSlotCost: lvS ? Object.fromEntries(Object.keys(conj.slots).filter(l => SLOT_COST[l]).map(l => [l, SLOT_COST[l]])) : {},
    carry: `${carry} kg`, resources, acoes, attacks, metamagic: chosen, passives, warCaster: has('war-caster'), limits: conj.limits, level: n, items: c.template === 'soren' ? SOREN.items : startingItems(c), lista: conj.lista, ataques: atq, classes: cl, bonus: regrasBonus(b, M, cl),
    abilities: ATTR.map(([k, nome]) => ({ k, n: nome, s: sc[k], ...(savs.includes(k) ? { prof: true } : {}), ...(k === 'CON' && has('war-caster') ? { note: 'Vantagem em Concentração' } : {}) })),
    skills: SKILLS.map(([nome, a]) => (b.skills[nome] ? [nome, a, b.skills[nome], ...((b.expertise || []).includes(nome) ? [true] : [])] : [nome, a])), tools: c.template === 'soren' ? SOREN.tools : (b.tools || []),
    calc: {
      ac: ca.txt,
      hp: `${hp.base} (nv 1: ${hp.hd} + CON ${num(con)})` + (n > 1 ? ` + ${hp.rolls} (${n - 1} × [${b.hpRolls.length && b.hpRolls.every(r => r === b.hpRolls[0]) ? b.hpRolls[0] : 'dado'} + CON ${num(con)}])` : '') + (hp.resil ? ` + ${hp.resil} (Resiliência Dracônica)` : '') + (hp.anao ? ` + ${hp.anao} (Tenacidade Anã)` : '') + (hp.vig ? ` + ${hp.vig} (Vigoroso)` : ''),
      dc: `8 + BP ${pb} + ${attr || C0.cdAttr || (M.FOR >= dex ? 'FOR' : 'DES')} ${num(attr ? mc : C0.cdAttr ? M[C0.cdAttr] : marcial)}`, atk: `BP ${pb} + ${attr || (M.FOR >= dex ? 'FOR' : 'DES')} ${num(attr ? mc : marcial)}`, ...(has('war-caster') ? { concNote: '<small>(V em conc.)</small>' } : {})
    },
    subText: subTextOf(b, lin)
  };
}
function escolhasTexto(b) {
  const e = b.escolhas || {}, nomes = { invocacoes: 'Invocações', manobras: 'Manobras', estilos: 'Estilos de Luta', maestrias: 'Maestrias', ordem: 'Ordem' };
  return Object.entries(nomes).filter(([k]) => e[k]?.length).map(([k, t]) => `${t}: ${[].concat(e[k]).join(', ')}.`);
}
function subTextOf(b, lin) {
  const sp = speciesById(b.speciesId), ori = sp ? (lin ? `${sp.name} (${lin})` : sp.name) + ' · ' : '';
  const nomes = classesOf(b).map(x => { const s = subDe(x), C = CLASSES[x.id]; return C.name + (s ? (s.adj ? ' ' + s.adj : ` (${s.name})`) : '') + ((b.multi || []).length ? ' ' + x.lv : ''); });
  return `${ori}${nomes.join(' / ')} · Nível ${b.level}`;
}
function startingItems(c) { return (c.sheet?.items || []); }

/* ---------- subir de nível ---------- */
/** Prévia do que muda: compara a ficha atual com a do nível seguinte. */
function levelDiff(c) {
  const antes = deriveSheet(c), futuro = clone(c);
  futuro.build.level++; futuro.level++; futuro.build.hpRolls = [...futuro.build.hpRolls, 4];
  const d = deriveSheet(futuro), n = d.level, out = [];
  if (d.stats.pb !== antes.stats.pb) out.push(`Bônus de Proficiência ${signed(antes.stats.pb)} → ${signed(d.stats.pb)}`);
  if (d.stats.dc !== antes.stats.dc) out.push(`CD de magia ${antes.stats.dc} → ${d.stats.dc}`);
  if (d.stats.atk !== antes.stats.atk) out.push(`Ataque mágico ${signed(antes.stats.atk)} → ${signed(d.stats.atk)}`);
  for (const [l, v] of Object.entries(d.slots)) if ((antes.slots[l] || 0) !== v) out.push(`Espaços de ${l}º círculo ${antes.slots[l] || 0} → ${v}`);
  for (const r of d.resources) { const a = antes.resources.find(x => x.id === r.id)?.max ?? 0; if (a !== r.max) out.push(`${r.name} ${a} → ${r.max}`); }
  if (d.limits.cantrips !== antes.limits.cantrips) out.push(`Truques conhecidos ${antes.limits.cantrips} → ${d.limits.cantrips}`);
  if (d.limits.prepared !== antes.limits.prepared) out.push(`Magias preparadas ${antes.limits.prepared} → ${d.limits.prepared}`);
  const tier = x => (x >= 17 ? 4 : x >= 11 ? 3 : x >= 5 ? 2 : 1);
  if (tier(n) !== tier(n - 1)) out.push(`Truques causam ${tier(n)} dados de dano`);
  featuresOf(d.__b || futuro.build).filter(f => f[0] === n).forEach(f => out.push(`Nova: ${f[1]}`));
  return out;
}
/** Nomes de magias de subclasse resolvidos na biblioteca. */
function magiasDeSub(s, nivel) {
  const nomes = s?.magias?.[nivel] || [];
  const achar = n => libraryAll().find(x => norm(x.name) === norm(n));
  return nomes.map(achar).filter(Boolean).map(x => x.id);
}
function levelNeeds(c, classId = null, subId = null) {
  const b = buildOf(c), id = classId || b.classId, nl = nivelDe(b, id) + 1, n = b.level + 1, C = CLASSES[id], x = classesOf(b).find(y => y.id === id) || { id, lv: 0, sub: null };
  const conjOf = (lv, sub) => {
    const cst = (CLASSES[id].subs?.[sub]?.caster && lv >= 3) ? CLASSES[id].subs[sub].caster : C.caster;
    if (!cst) return { cantrips: 0, prepared: 0 };
    const L = CLASS_LEVELS[id][lv - 1];
    return { cantrips: cst.truques ? cst.truques(lv) : L.cantrips || 0, prepared: cst.tipo === 'third' ? TERCO_PREP[lv - 1] : L.prepared || 0 };
  };
  const sub = subId || x.sub, nx = conjOf(nl, sub), cur = nl > 1 ? conjOf(nl - 1, x.sub) : { cantrips: 0, prepared: 0 }, S = C.subs?.[sub];
  const invoc = id === 'warlock' ? (CLASS_LEVELS.warlock[nl - 1].eldritch_invocations || 0) - (nl > 1 ? CLASS_LEVELS.warlock[nl - 2].eldritch_invocations || 0 : 0) : 0;
  const manobras = sub === 'battle-master' ? (nl === 3 ? 3 : [7, 10, 15].includes(nl) ? 2 : 0) : 0;
  return {
    n, nl, classId: id, novaClasse: !x.lv, asi: (C.asi || ASI_PADRAO).includes(nl), boon: nl === 19, subclass: nl >= 3 && !x.sub, subs: C.subs,
    metamagic: id === 'sorcerer' ? metamagicKnown(nl) - metamagicKnown(nl - 1) : 0, cantrips: nx.cantrips - cur.cantrips, prepared: nx.prepared - cur.prepared,
    draconic: sub === 'draconic' ? DRACONIC_SPELLS[nl] || [] : magiasDeSub(S, nl), expertise: C.expertise?.[nl] || 0, estilo: (C.style?.[nl] || 0) + (sub === 'champion' && nl === 7 ? 1 : 0), invocacoes: invoc, manobras
  };
}
/** Aplica um nível. `ch` traz o dado de PV e as escolhas do assistente. */
function applyLevel(c, ch) {
  const b = buildOf(c), g = c.grimoire || (c.grimoire = { added: [], removed: [] }), antes = deriveSheet(c), id = ch.classId || b.classId;
  (c.history || (c.history = [])).push(JSON.stringify({ build: b, grimoire: g, level: c.level, sub: c.sub, sheet: c.sheet ? 1 : 0, gain: 0 }));
  const pre = levelNeeds(c, id), escolhida = ch.subclass || (pre.subclass && id === 'sorcerer' ? 'draconic' : null), need = levelNeeds(c, id, escolhida);
  b.level = need.n; c.level = need.n; b.hpRolls = [...b.hpRolls, ch.hp];
  if (id !== b.classId) { b.multi = b.multi || []; const m = b.multi.find(x => x.classId === id); if (m) m.level++; else b.multi.push({ classId: id, level: 1, subclassId: null }); }
  if (need.subclass && escolhida) {
    if (id === b.classId) b.subclassId = escolhida; else b.multi.find(x => x.classId === id).subclassId = escolhida;
  }
  if (ch.asi) for (const [k, v] of Object.entries(ch.asi)) b.scores[k] = Math.min(20, b.scores[k] + v);
  if (ch.feat) b.feats = [...b.feats, ch.feat];
  if (ch.metamagic?.length) b.metamagic = [...b.metamagic, ...ch.metamagic];
  if (ch.expertise?.length) b.expertise = [...(b.expertise || []), ...ch.expertise];
  b.escolhas = b.escolhas || {};
  for (const k of ['invocacoes', 'manobras', 'estilos']) if (ch[k]?.length) b.escolhas[k] = [...(b.escolhas[k] || []), ...ch[k]];
  const spellsToAdd = [...(ch.spells || []), ...need.draconic.map(sid => ({ id: sid, draconic: true }))];
  for (const e of spellsToAdd) {
    const s = typeof e === 'string' ? libGet(e) : { ...libGet(e.id), draconic: e.draconic };
    if (!s?.id || g.added.some(x => x.id === s.id)) continue;
    const { base: _b, _hay, ...cp } = s;
    if (c.template !== 'soren' || !SOREN_SPELLS.some(x => x.id === s.id)) g.added.push(cp);
    g.removed = g.removed.filter(x => x !== s.id);
  }
  if (ch.swapOut) { const was = g.added.some(x => x.id === ch.swapOut); g.added = g.added.filter(x => x.id !== ch.swapOut); if (!was) g.removed.push(ch.swapOut); }
  const depois = deriveSheet(c);
  c.sub = depois.subText;
  return { antes, depois };
}
function undoLevel(c) {
  if (!c.history?.length) return false;
  const h = JSON.parse(c.history.pop());
  c.build = h.build; c.grimoire = h.grimoire; c.level = h.level; c.sub = h.sub;
  return true;
}
