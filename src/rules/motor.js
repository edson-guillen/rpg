/* =====================================================================
   MOTOR DE REGRAS — calcula a ficha a partir do nível, dos atributos e
   das escolhas. Por enquanto cobre o Feiticeiro de D&D 2024.
   ===================================================================== */
const modScore = v => Math.floor((v - 10) / 2);
const pbOf = n => Math.ceil(n / 4) + 1;
const signed = n => (n >= 0 ? '+' : '−') + Math.abs(n);
const num = n => (n < 0 ? '−' : '') + Math.abs(n);
const spd = ft => String(ft * 0.3).replace('.', ',') + ' m';

function sorenBuild() {
  return {
    classId: 'sorcerer', subclassId: 'draconic', level: 4, speciesId: 'goliath', lineage: 'cloud', backgroundId: 'wayfarer',
    scores: Object.fromEntries(SOREN.abilities.map(a => [a.k, a.s])), hpRolls: [4, 4, 4], feats: ['lucky', 'war-caster'], metamagic: ['quick', 'subtle'], planned: {},
    skills: Object.fromEntries(SOREN.skills.filter(s => s[2]).map(s => [s[0], s[2]]))
  };
}
function blankBuild(level = 1) {
  return { classId: 'sorcerer', subclassId: level >= 3 ? 'draconic' : null, level, speciesId: null, lineage: null, backgroundId: null, scores: Object.fromEntries(ATTR.map(([k]) => [k, 10])), hpRolls: [], feats: [], metamagic: [], planned: {}, skills: {} };
}
const buildOf = c => c.build || (c.build = c.template === 'soren' ? sorenBuild() : blankBuild(c.level || 1));

function hpMaxOf(b, con = modScore(b.scores.CON)) {
  const n = b.level, rolls = b.hpRolls.slice(0, n - 1).reduce((a, r) => a + r + con, 0);
  return { base: 6 + con, rolls, resil: b.subclassId === 'draconic' && n >= 3 ? n : 0, total: Math.max(1, 6 + con + rolls + (b.subclassId === 'draconic' && n >= 3 ? n : 0)) };
}
function featuresOf(b) {
  const sub = b.subclassId === 'draconic' ? DRACONIC_FEATURES : [];
  return [...SORCERER_FEATURES.map(f => [...f, 'Feiticeiro']), ...sub.map(f => [...f, 'Feitiçaria Dracônica'])].sort((x, y) => x[0] - y[0]);
}

/** Monta a ficha completa no formato que as telas usam. */
function deriveSheet(c) {
  const b = buildOf(c), base = c.template === 'soren' ? SOREN : blankSheet(), n = b.level, L = SORCERER_LEVELS[n - 1];
  const mod = k => modScore(b.scores[k]), pb = L.pb, cha = mod('CAR'), con = mod('CON'), dex = mod('DES'), str = mod('FOR');
  const drac = b.subclassId === 'draconic' && n >= 3, hp = hpMaxOf(b), has = id => b.feats.includes(id), sp = speciesById(b.speciesId);
  const stats = { ac: 10 + dex + (drac ? cha : 0), shieldBonus: 5, hpMax: hp.total, dc: 8 + pb + cha, atk: pb + cha, init: dex + (has('alert') ? pb : 0), speed: spd(sp?.speed || 30), pb, cha, conSave: con + pb };
  const slots = Object.fromEntries(L.slots.map((v, i) => [i + 1, v]).filter(([, v]) => v > 0));
  const res = id => base.resources?.find(r => r.id === id) || SOREN.resources.find(r => r.id === id);
  const resources = [{ ...res('sp'), max: n >= 2 ? n : 0, desc: res('sp').desc.replace(/Máximo de \d+/, `Máximo de ${n >= 2 ? n : 0}`) }, { ...res('innate'), desc: res('innate').desc.replace(/\(fica \d+\)/, `(fica ${stats.dc + 1})`) }];
  if (b.speciesId === 'goliath' && b.lineage === 'cloud') resources.push({ ...res('jaunt'), max: pb });
  if (has('lucky')) resources.push({ ...res('luck'), max: pb });
  if (b.speciesId === 'goliath' && n >= 5) resources.push({ id: 'large', name: 'Forma Grande', icon: 'i-shield', c: 'lv0', max: 1, meta: 'Golias · Ação Bônus · 10 minutos · Descanso Longo', desc: 'Fica <b>Grande</b>, com Vantagem em testes de Força e <b>+3 m</b> de Deslocamento.' });
  resources.push({ ...res('hd'), max: n, meta: 'd6 · Descanso Curto para gastar', desc: `Cada dado gasto num Descanso Curto cura <b>1d6 ${con < 0 ? '−' : '+'} ${Math.abs(con)}</b>. Todos voltam no Descanso Longo (regra 2024).` });
  const attacks = (c.template === 'soren' ? SOREN.attacks : []).map(a => {
    const k = a.id.startsWith('ts-') || a.id === 'natural' ? 'CAR' : a.id === 'dagger' ? 'DES' : 'FOR', m = mod(k), die = a.dmg.match(/^\d+d\d+/)[0], ts = a.id.startsWith('ts-');
    return { ...a, atk: m + pb, calc: `${k} ${num(m)} + BP ${pb}`, dmg: `${die}${m < 0 ? '-' : '+'}${Math.abs(m)}`, ...(ts && n >= 5 ? { sub: `${a.sub} · +${n >= 17 ? 3 : n >= 11 ? 2 : 1}d6 Radiante` } : {}) };
  });
  const chosen = b.metamagic.map(id => (c.template === 'soren' && SOREN.metamagic.find(m => m.id === id)) || METAMAGIC.find(m => m.id === id)).filter(Boolean);
  const lin = sp?.lineages?.[b.lineage]?.[0], carry = Math.round(b.scores.FOR * 7.5 * (b.speciesId === 'goliath' ? 2 : 1));
  const passives = (c.template === 'soren' ? SOREN.passives : []).map(p => ({
    ...p, items: p.t === 'Resiliência Dracônica' ? [`+${n} PV máximos (já incluídos nos ${hp.total}).`, `Sem armadura, CA = 10 + DES ${num(dex)} + CAR ${num(cha)} = <b>${stats.ac}</b>.`]
      : p.items.map(i => i.replace(/\(\+4\)\./, `(${signed(stats.conSave)}).`).replace(/<b>120 kg<\/b>|120 kg/, m => m.replace('120', carry)))
  }));
  return {
    ...base, stats, hitDie: 6, conMod: con, slots, createSlotCost: Object.fromEntries(Object.keys(slots).filter(l => SLOT_COST[l]).map(l => [l, SLOT_COST[l]])),
    carry: `${carry} kg`, resources, attacks, metamagic: chosen, passives, warCaster: has('war-caster'), limits: { cantrips: L.cantrips, prepared: L.prepared }, level: n, items: c.template === 'soren' ? SOREN.items : startingItems(c),
    abilities: ATTR.map(([k, nome]) => ({ k, n: nome, s: b.scores[k], ...(k === 'CON' || k === 'CAR' ? { prof: true } : {}), ...(k === 'CON' && has('war-caster') ? { note: 'Vantagem em Concentração' } : {}) })),
    skills: SKILLS.map(([nome, a]) => (b.skills[nome] ? [nome, a, b.skills[nome]] : [nome, a])), tools: c.template === 'soren' ? SOREN.tools : (b.tools || []),
    calc: {
      ac: drac ? `10 + DES ${num(dex)} + CAR ${num(cha)} (Resiliência Dracônica)` : `10 + DES ${num(dex)}`,
      hp: `${hp.base} (nv 1: 6 + CON ${num(con)})` + (n > 1 ? ` + ${hp.rolls} (${n - 1} × [${b.hpRolls.length && b.hpRolls.every(r => r === b.hpRolls[0]) ? b.hpRolls[0] : 'dado'} + CON ${num(con)}])` : '') + (hp.resil ? ` + ${hp.resil} (Resiliência Dracônica)` : ''),
      dc: `8 + BP ${pb} + CAR ${num(cha)}`, atk: `BP ${pb} + CAR ${num(cha)}`, ...(has('war-caster') ? { concNote: '<small>(V em conc.)</small>' } : {})
    },
    subText: subTextOf(b, lin)
  };
}
function subTextOf(b, lin) {
  const sp = speciesById(b.speciesId), ori = sp ? (lin ? `${sp.name} (${lin})` : sp.name) + ' · ' : '';
  return `${ori}Feiticeiro${b.subclassId === 'draconic' ? ' Dracônico' : ''} · Nível ${b.level}`;
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
function levelNeeds(c) {
  const b = buildOf(c), n = b.level + 1, cur = SORCERER_LEVELS[n - 2], nx = SORCERER_LEVELS[n - 1];
  return {
    n, asi: ASI_LEVELS.includes(n), boon: n === 19, subclass: n === 3 && !b.subclassId,
    metamagic: metamagicKnown(n) - metamagicKnown(n - 1), cantrips: nx.cantrips - cur.cantrips, prepared: nx.prepared - cur.prepared, draconic: b.subclassId === 'draconic' || n === 3 ? DRACONIC_SPELLS[n] || [] : []
  };
}
/** Aplica um nível. `ch` traz o dado de PV e as escolhas do assistente. */
function applyLevel(c, ch) {
  const b = buildOf(c), g = c.grimoire || (c.grimoire = { added: [], removed: [] }), antes = deriveSheet(c);
  (c.history || (c.history = [])).push(JSON.stringify({ build: b, grimoire: g, level: c.level, sub: c.sub, sheet: c.sheet ? 1 : 0, gain: 0 }));
  const need = levelNeeds(c);
  b.level = need.n; c.level = need.n; b.hpRolls = [...b.hpRolls, ch.hp];
  if (need.subclass) b.subclassId = 'draconic';
  if (ch.asi) for (const [k, v] of Object.entries(ch.asi)) b.scores[k] = Math.min(20, b.scores[k] + v);
  if (ch.feat) b.feats = [...b.feats, ch.feat];
  if (ch.metamagic?.length) b.metamagic = [...b.metamagic, ...ch.metamagic];
  const spellsToAdd = [...(ch.spells || []), ...need.draconic.map(id => ({ id, draconic: true }))];
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
