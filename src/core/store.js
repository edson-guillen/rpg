'use strict';
/* =====================================================================
   BIBLIOTECA DE PERSONAGENS (store v3)
   Guarda todos os personagens, as notas de campanha e a biblioteca.
   Na primeira abertura, copia os dados antigos do Søren para cá. As
   chaves antigas não são alteradas e continuam como cópia de segurança.
   ===================================================================== */
const STORE_KEY = 'grimorio-v3';
const LEGACY_KEY = 'soren-frostgaard-nv4';
const LEGACY_NOTES_KEY = LEGACY_KEY + '-notas';

const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

function sorenCharacter(st = null, nt = null) {
  return {
    id: 'soren', name: 'Søren Frostgaard', sub: 'Golias (Gigante das Nuvens) · Feiticeiro Dracônico · Nível 4',
    template: 'soren', classId: 'sorcerer', subclassId: 'draconic', level: 4, state: st, notes: nt
  };
}

/** Ficha mínima de Feiticeiro nível 1, usada até existir o assistente de criação. */
function blankSheet() {
  const base = clone(SOREN), res = id => base.resources.find(r => r.id === id);
  return {
    ...base,
    stats: { ac: 10, shieldBonus: 5, hpMax: 6, dc: 10, atk: 2, init: 0, speed: '9 m', pb: 2, cha: 0, conSave: 2 },
    conMod: 0, carry: '', calc: {},
    abilities: base.abilities.map(({ k, n, prof }) => ({ k, n, s: 10, ...(prof ? { prof } : {}) })),
    skills: base.skills.map(([n, a]) => [n, a]),
    tools: [], attacks: [], slots: { 1: 2 }, createSlotCost: { 1: 2 }, metamagic: [], passives: [], items: [], limits: { cantrips: 4, prepared: 2 },
    resources: [
      { ...res('sp'), max: 0, desc: 'Pontos de Feitiçaria chegam no nível 2 do Feiticeiro.' },
      { ...res('innate'), desc: '<b>+1 na CD</b> e <b>Vantagem</b> nas jogadas de ataque de magias de Feiticeiro.' },
      { ...res('hd'), max: 1, desc: 'Cada dado gasto num Descanso Curto cura <b>1d6 + CON</b>. Voltam no Descanso Longo.' }
    ]
  };
}

function newCharacter(name, build = null) {
  return {
    id: newId('c'), name, sub: 'Feiticeiro · Nível 1', template: 'blank', classId: 'sorcerer', subclassId: null, level: build?.level || 1,
    sheet: blankSheet(), spells: [], state: null, notes: null, build: build || blankBuild(1), identity: {}, grimoire: { added: [], removed: [] }
  };
}

function emptyStore() {
  return { v: 3, characters: [], activeId: null, campaignNotes: null, library: { custom: [], overrides: {}, privateRefs: [] }, settings: { notesScope: 'char' } };
}

function sanitizeCharacter(c) {
  if (!c || typeof c !== 'object' || typeof c.name !== 'string') return null;
  const template = c.template === 'soren' ? 'soren' : 'blank';
  if (template === 'blank' && (!c.sheet || typeof c.sheet !== 'object')) return null;
  return { ...c, id: String(c.id || newId('c')), name: c.name.slice(0, 60) || 'Sem nome', sub: String(c.sub || '').slice(0, 120), template, spells: Array.isArray(c.spells) ? c.spells : [] };
}

/* Nomes antigos guardados no navegador, trocados pelos do Livro do Jogador 2024. */
const TIPOS_ANTIGOS = { Fogo: 'Ígneo', Frio: 'Gélido', Veneno: 'Venenoso' };
const ITENS_ANTIGOS = [['Kit de Masmorra', 'Kit de Explorador de Masmorras'], ['Frascos de Óleo', 'Potes de Óleo'], ['Pederneira', 'Caixa para Fogo']];
function atualizaTermos(s) {
  const tipo = v => TIPOS_ANTIGOS[v] || v;
  const magias = l => (Array.isArray(l) ? l : []).forEach(m => {
    if (m?.choice) m.choice = m.choice.map(tipo);
    (m?.r || []).forEach(x => { if (x.type) x.type = tipo(x.type); });
  });
  s.characters.forEach(c => {
    if (c.lastElement) c.lastElement = tipo(c.lastElement);
    if (c.choices) c.choices = Object.fromEntries(Object.entries(c.choices).map(([k, v]) => [k, tipo(v)]));
    magias(c.spells); magias(c.grimoire?.added);
    [...(c.state?.items || []), ...(c.sheet?.items || [])].forEach(i => ITENS_ANTIGOS.forEach(([a, b]) => { for (const k of ['name', 'note']) if (typeof i[k] === 'string') i[k] = i[k].split(a).join(b); }));
  });
  magias(s.library.custom); magias(Object.values(s.library.overrides || {}));
  return s;
}

function sanitizeStore(raw) {
  const s = emptyStore();
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.characters)) return null;
  const seen = new Set();
  s.characters = raw.characters.map(sanitizeCharacter).filter(c => c && !seen.has(c.id) && seen.add(c.id));
  if (!s.characters.length) return null;
  s.activeId = seen.has(raw.activeId) ? raw.activeId : s.characters[0].id;
  s.campaignNotes = raw.campaignNotes || null;
  s.library = { ...s.library, ...raw.library };
  s.settings = { ...s.settings, ...raw.settings };
  return atualizaTermos(s);
}

function migrateStore() {
  const s = emptyStore();
  s.characters.push(sorenCharacter(readJSON(LEGACY_KEY), readJSON(LEGACY_NOTES_KEY)));
  s.activeId = 'soren';
  return s;
}

function persistStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
  catch (e) { return false; }
}

let store = sanitizeStore(readJSON(STORE_KEY));
if (!store) { store = migrateStore(); persistStore(); }

const activeChar = () => store.characters.find(c => c.id === store.activeId);

/** Magias do personagem: as da ficha, mais as adicionadas, menos as removidas, com as alterações do usuário. */
function composeSpells(c) {
  const g = c.grimoire || { added: [], removed: [] }, ov = store.library.overrides;
  const base = (c.template === 'soren' ? SOREN_SPELLS : c.spells).filter(s => !g.removed.includes(s.id));
  return [...base, ...g.added.filter(s => !base.some(b => b.id === s.id))].map(s => (ov[s.id] ? { ...s, ...ov[s.id] } : s));
}

/* Valores da ficha ativa. Todo o app lê daqui; trocar de personagem só reaponta estas variáveis. */
let CHAR, SPELLS, LEVELS, RES, SPELL, META;
function bindSheet(c) {
  CHAR = deriveSheet(c);
  SPELLS = composeSpells(c);
  LEVELS = Object.keys(CHAR.slots).map(Number);
  RES = Object.fromEntries(CHAR.resources.map(r => [r.id, r]));
  SPELL = Object.fromEntries(SPELLS.map(s => [s.id, s]));
  META = Object.fromEntries(CHAR.metamagic.map(m => [m.id, m]));
}
bindSheet(activeChar());
