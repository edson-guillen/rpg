/* =====================================================================
   BIBLIOTECA DE MAGIAS
   Junta o SRD (público, carregado sob demanda), a biblioteca pessoal
   (importada pelo usuário e guardada só no IndexedDB deste navegador)
   e as magias criadas ou alteradas na aba.
   ===================================================================== */
const LIB_FILTERS_DEFAULT = { q: '', level: '', school: '', cls: 'sorcerer', dmg: '', conc: '', ritual: '', time: '', src: '' };
const LIB_PAGE = 40;
const NOME_ATTR = { Força: 'FOR', Destreza: 'DES', Constituição: 'CON', Inteligência: 'INT', Sabedoria: 'SAB', Carisma: 'CAR' };
/** Talentos, antecedentes e espécies da biblioteca pessoal, no formato do catálogo. */
function privateCatalog() {
  const d = privateRaw || {};
  return {
    talentos: (d.talentos || []).map(t => ({ id: 'p-' + t.id, name: t.nome, cat: t.categoria, desc: t.texto, pre: t.prerequisito || '', src: 'pessoal' })),
    antecedentes: (d.antecedentes || []).map(b => ({ id: 'p-' + b.id, name: b.nome, attrs: (b.atributos || []).map(a => NOME_ATTR[a]).filter(Boolean), feat: 'p-' + norm(b.talento || '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), skills: b.pericias || [], tool: b.ferramenta || '', desc: b.equipamento || '', src: 'pessoal' })),
    especies: (d.especies || []).map(e => ({ id: 'p-' + e.id, name: e.nome, speed: Math.round(parseFloat(String(e.deslocamento).replace(',', '.')) / 0.3) || 30, traits: [['Traços', e.texto]], src: 'pessoal' }))
  };
}
const allFeats = () => [...FEATS.filter(f => !privateCatalog().talentos.some(p => norm(p.name) === norm(f.name))), ...privateCatalog().talentos, ...(store.library.feats || [])];
const ABIL_KEYS = Object.keys(SAVE_NAME);
const DMG_TYPES = ['Ácido', 'Contundente', 'Cortante', 'Elétrico', 'Energético', 'Fogo', 'Frio', 'Necrótico', 'Perfurante', 'Psíquico', 'Radiante', 'Trovejante', 'Veneno'];
const SCHOOLS = ['Abjuração', 'Adivinhação', 'Encantamento', 'Evocação', 'Ilusão', 'Invocação', 'Necromancia', 'Transmutação'];
const CLASS_NAMES = { artificer: 'Artífice', barbarian: 'Bárbaro', bard: 'Bardo', cleric: 'Clérigo', druid: 'Druida', fighter: 'Guerreiro', monk: 'Monge', paladin: 'Paladino', ranger: 'Patrulheiro', rogue: 'Ladino', sorcerer: 'Feiticeiro', warlock: 'Bruxo', wizard: 'Mago' };

let libFilters = { ...LIB_FILTERS_DEFAULT }, libLimit = LIB_PAGE, libStatus = 'idle', grimView = 'meu', privateSpells = [];
var privateRaw = null; // var: o motor de regras lê isto antes de este arquivo rodar

/* ---------- carregamento sob demanda ---------- */
function ensureLibrary() {
  if (window.GRIMORIO_LIBRARY) { libStatus = 'ok'; return Promise.resolve(true); }
  if (libStatus === 'loading') return libLoading;
  libStatus = 'loading';
  // Script em vez de fetch: assim a biblioteca também abre por file://.
  libLoading = new Promise(res => {
    const s = document.createElement('script');
    s.src = 'data/library.js';
    s.onload = () => { libStatus = 'ok'; res(true); };
    s.onerror = () => { libStatus = 'erro'; res(false); };
    document.head.appendChild(s);
  });
  return libLoading;
}
let libLoading = null;

/* ---------- biblioteca pessoal (IndexedDB) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('grimorio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('biblioteca');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(k) {
  const db = await idb();
  return new Promise(res => { const q = db.transaction('biblioteca').objectStore('biblioteca').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
}
async function idbSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('biblioteca', 'readwrite'); if (v === null) t.objectStore('biblioteca').delete(k); else t.objectStore('biblioteca').put(v, k); t.oncomplete = () => res(true); t.onerror = () => rej(t.error); });
}
async function loadPrivate() {
  try { privateRaw = await idbGet('pessoal'); privateSpells = (privateRaw?.magias || []).map(mapPrivate); } catch (e) { privateRaw = null; privateSpells = []; }
}

const TIME_PT = t => /^Ação Bônus/.test(t) ? '1 Ação Bônus' : /^Ação/.test(t) ? '1 Ação' : /^Reação/.test(t) ? 'Reação' : t;
function rollsFromPT(text, higher) {
  const r = [], t = text.replace(/<[^>]+>/g, ' ');
  if (/jogada de ataque/i.test(t)) r.push({ t: 'atk' });
  const nomes = { Força: 'FOR', Destreza: 'DES', Constituição: 'CON', Inteligência: 'INT', Sabedoria: 'SAB', Carisma: 'CAR' };
  [...new Set([...t.matchAll(/salvaguarda de (Força|Destreza|Constituição|Inteligência|Sabedoria|Carisma)/g)].map(m => nomes[m[1]]))].forEach(a => r.push({ t: 'save', a }));
  const metade = /metade/i.test(t), up = higher.match(/aumenta em (\d+d\d+)/)?.[1], vistos = new Set();
  for (const m of t.matchAll(/(\d+d\d+(?:\s*\+\s*\d+)?) de dano (\p{L}+)/gu)) {
    const d = m[1].replace(/\s/g, '');
    if (vistos.has(d + m[2])) continue;
    vistos.add(d + m[2]);
    r.push({ t: 'dmg', d, type: m[2], ...(metade ? { half: true } : {}) });
  }
  const dano = r.find(x => x.t === 'dmg');
  if (dano && up) dano.up = up;
  if (dano) r.filter(x => x.t === 'atk').length && (dano.crit = true);
  return r;
}
function mapPrivate(p) {
  const ps = String(p.texto || '').split(/\n+/).filter(Boolean), higher = String(p.superior || '').replace(/^[^.]*\.\s*/, '');
  const trecho = /^Aprimoramento/.test(p.superior || '') ? 'upgrade' : 'higher';
  return {
    id: 'p-' + p.id, name: p.nome, en: p.nomeEn || '', level: +p.circulo || 0, school: { abjuration: 'Abjuração', conjuration: 'Invocação', divination: 'Adivinhação', enchantment: 'Encantamento', evocation: 'Evocação', illusion: 'Ilusão', necromancy: 'Necromancia', transmutation: 'Transmutação' }[p.escola] || p.escola,
    classes: p.classes || [], time: TIME_PT(p.tempo || ''), range: p.alcance || '', comp: p.comp || '', material: p.material || '', dur: p.duracao || '',
    conc: !!p.concentracao, ritual: !!p.ritual, reaction: /^Reação/.test(p.tempo || ''), desc: ps, ...(higher ? { [trecho]: higher } : {}),
    r: rollsFromPT(ps.join(' '), p.superior || ''), src: 'pessoal', orig: p.original ? { desc: [p.original.texto], higher: p.original.superior || '' } : null, fonte: p.fonte
  };
}
function chipOf(s) {
  const d = (s.r || []).find(x => x.t === 'dmg');
  return d ? d.d : '';
}

/** Todas as magias, sem repetir: a versão pessoal completa a do SRD; alterações do usuário vêm por último. */
function libraryAll() {
  const map = new Map();
  for (const s of window.GRIMORIO_LIBRARY?.magias || []) map.set(s.id, s);
  const porEn = new Map([...map.values()].map(s => [norm(s.en), s.id]));
  for (const p of privateSpells) {
    const id = p.en ? porEn.get(norm(p.en)) : null;
    if (id) {
      const b = map.get(id);
      map.set(id, { ...b, name: p.name, desc: p.desc, higher: p.higher ?? b.higher, upgrade: p.upgrade ?? b.upgrade, material: p.material || b.material, src: 'srd+pessoal', fonte: p.fonte });
    } else map.set(p.id, p);
  }
  for (const c of store.library.custom) map.set(c.id, c);
  for (const [id, o] of Object.entries(store.library.overrides)) if (map.has(id)) map.set(id, { ...o, id, base: map.get(id) });
  return [...map.values()];
}
const libGet = id => libraryAll().find(s => s.id === id) || SPELL[id];
const inGrimoire = s => SPELLS.some(x => x.id === s.id || (s.en && norm(x.en || '') === norm(s.en)));

/* ---------- filtros ---------- */
function libMatches(s, f, q) {
  if (f.level !== '' && String(s.level) !== f.level) return false;
  if (f.school && s.school !== f.school) return false;
  if (f.cls && !(s.classes || []).includes(f.cls) && s.src !== 'minha') return false;
  if (f.dmg && !(s.r || []).some(x => x.t === 'dmg' && x.type === f.dmg) && !(s.choice || []).includes(f.dmg)) return false;
  if (f.conc && String(!!s.conc) !== f.conc) return false;
  if (f.ritual && String(!!s.ritual) !== f.ritual) return false;
  if (f.time && !String(s.time).startsWith(f.time)) return false;
  if (f.src === 'srd' && !String(s.src).startsWith('srd')) return false;
  if (f.src === 'pessoal' && !String(s.src).includes('pessoal')) return false;
  if (f.src === 'minha' && s.src !== 'minha' && !store.library.overrides[s.id]) return false;
  return !q || spellHaystack(s).includes(q);
}
const SRC_TAG = { srd: 'SRD', 'srd+pessoal': 'SRD + pessoal', pessoal: 'Pessoal', minha: 'Minha' };

function renderLibrary() {
  const box = $('#lib-view');
  if (libStatus === 'idle' || libStatus === 'loading') {
    box.innerHTML = '<p class="empty">Abrindo a biblioteca…</p>';
    ensureLibrary().then(() => { if (grimView === 'lib') renderLibrary(); });
    return;
  }
  const f = libFilters, q = norm(f.q.trim());
  const sel = (key, label, opts) => `<label class="lf"><span>${label}</span><select data-lib="${key}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${f[key] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const aviso = libStatus === 'erro' ? `<p class="note">O arquivo da biblioteca não foi encontrado. Abra pelo site ou mantenha a pasta <b>data</b> junto do <b>index.html</b>. Suas magias e a biblioteca pessoal continuam disponíveis.</p>` : '';
  const all = libraryAll(), list = all.filter(s => libMatches(s, f, q)).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'));
  box.innerHTML = `${aviso}<div class="lib-bar">
      <div class="search"><svg class="ic"><use href="#i-search"/></svg><input id="lib-q" type="search" value="${esc(f.q)}" placeholder="Buscar em português ou inglês…" autocomplete="off" aria-label="Buscar na biblioteca"></div>
      <div class="lib-filters">
        ${sel('level', 'Círculo', [['', 'Todos'], ['0', 'Truques'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), n + 'º'])])}
        ${sel('school', 'Escola', [['', 'Todas'], ...SCHOOLS.map(x => [x, x])])}
        ${sel('cls', 'Classe', [['', 'Todas'], ...Object.entries(CLASS_NAMES).filter(([k]) => k !== 'barbarian' && k !== 'fighter' && k !== 'monk' && k !== 'rogue')])}
        ${sel('dmg', 'Dano', [['', 'Todos'], ...DMG_TYPES.map(x => [x, x])])}
        ${sel('conc', 'Concentração', [['', 'Tanto faz'], ['true', 'Sim'], ['false', 'Não']])}
        ${sel('ritual', 'Ritual', [['', 'Tanto faz'], ['true', 'Sim'], ['false', 'Não']])}
        ${sel('time', 'Tempo', [['', 'Todos'], ['1 Ação', 'Ação'], ['1 Ação Bônus', 'Ação Bônus'], ['Reação', 'Reação']])}
        ${sel('src', 'Fonte', [['', 'Todas'], ['srd', 'SRD'], ['pessoal', 'Pessoal'], ['minha', 'Minhas']])}
      </div>
      <div class="lib-actions"><span class="note" id="lib-count">${list.length} de ${all.length} magias</span>
        <button class="btn sm" data-action="lib-clear">Limpar filtros</button>
        <button class="btn sm" data-action="lib-import">${icon('i-up')}Biblioteca pessoal${privateSpells.length ? ` (${privateSpells.length})` : ''}</button>
        <button class="btn sm gold" data-action="spell-new">${icon('i-plus')}Criar magia</button></div>
    </div>
    <div class="spell-list">${list.slice(0, libLimit).map(s => {
      const dano = chipOf(s), tem = inGrimoire(s);
      return `<div class="spell lib-card ${lvClass(s.level)}" data-action="lib-open" data-id="${esc(s.id)}" role="button" tabindex="0">
        <div class="s-main"><b>${esc(s.name)}</b><small>${s.level ? ORD(s.level) + ' círculo' : 'Truque'} · ${esc(s.school)}${s.en && s.en !== s.name ? ' · ' + esc(s.en) : ''}</small>
        <div class="s-tags"><span class="tag">${SRC_TAG[s.src] || s.src}</span>${dano ? `<span class="tag dmg">${esc(dano)}</span>` : ''}${s.conc ? '<span class="tag conc">Conc.</span>' : ''}${s.ritual ? '<span class="tag">Ritual</span>' : ''}${tem ? '<span class="tag new">No grimório</span>' : ''}</div></div></div>`;
    }).join('') || '<p class="empty">Nenhuma magia com esses filtros.</p>'}</div>
    ${list.length > libLimit ? `<div class="add-row"><button class="btn block" data-action="lib-more">Mostrar mais (${list.length - libLimit})</button></div>` : ''}`;
}

function setGrimView(v) {
  grimView = v;
  $('#grim-view').hidden = v !== 'meu';
  $('#lib-view').hidden = v !== 'lib';
  document.querySelectorAll('[data-action="grim-view"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
  if (v === 'lib') renderLibrary(); else renderGrim();
}

/* ---------- grimório do personagem ---------- */
function grimoireOf(c) { return c.grimoire || (c.grimoire = { added: [], removed: [] }); }
function afterGrimoire() {
  bindSheet(activeChar());
  persistStore();
  render();
  if (grimView === 'lib') renderLibrary();
  if (modalRefresh) modalRefresh();
}
function limitMessage(s) {
  const lim = CHAR.limits, n = SPELLS.filter(x => !x.draconic && (s.level ? x.level > 0 : x.level === 0)).length;
  if (s.level && !LEVELS.some(l => l >= s.level)) return `${s.name} é de ${ORD(s.level)} círculo: você ainda não tem espaços desse círculo.`;
  if (lim && !s.level && n >= lim.cantrips) return `Você já conhece ${lim.cantrips} truques. Remova um antes de adicionar outro.`;
  if (lim && s.level && n >= lim.prepared) return `Você já tem ${lim.prepared} magias preparadas. Remova uma antes de adicionar outra.`;
  return '';
}
function addToGrimoire(id) {
  const s = libGet(id), msg = limitMessage(s);
  if (msg) { toast(msg, false); return; }
  const g = grimoireOf(activeChar()), { orig, base, _hay, ...copia } = s;
  g.removed = g.removed.filter(x => x !== s.id);
  if (!SOREN_SPELLS.some(x => x.id === s.id && activeChar().template === 'soren')) g.added.push({ ...copia, orig: orig || null });
  afterGrimoire();
  toast(`${s.name} adicionada ao grimório`, true, () => removeFromGrimoire(s.id, true));
}
function removeFromGrimoire(id, silent) {
  const g = grimoireOf(activeChar()), s = SPELL[id];
  const estava = g.added.some(x => x.id === id);
  g.added = g.added.filter(x => x.id !== id);
  if (!estava) g.removed.push(id);
  if (state.conc === id) state.conc = null;
  afterGrimoire();
  if (!silent && s) toast(`${s.name} removida do grimório`, true, () => { if (estava) g.added.push(s); else g.removed = g.removed.filter(x => x !== id); afterGrimoire(); });
}

/* ---------- importador privado ---------- */
async function importPrivate(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.tipo !== 'biblioteca-pessoal' || !Array.isArray(d.magias)) throw new Error('formato');
    await idbSet('pessoal', d);
    await loadPrivate();
    store.library.privateRefs = { magias: d.magias.length, talentos: (d.talentos || []).length, importado: new Date().toISOString() };
    persistStore();
    if (grimView === 'lib') renderLibrary();
    toast(`Biblioteca pessoal importada: ${d.magias.length} magias, só neste navegador`, false);
  } catch (e) { toast('Arquivo de biblioteca inválido', false); }
}

/* ---------- editor de magias ---------- */
let draft = null;
const newRow = () => ({ d: '1d6', type: 'Fogo', half: false, up: '', cantrip: '', heal: false, choose: false });

function openEditor(id) {
  const s = id ? clone(stripSpell(libGet(id))) : { name: '', en: '', level: 1, school: 'Evocação', time: '1 Ação', range: '', comp: 'V, S', dur: 'Instantânea', conc: false, ritual: false, classes: ['sorcerer'], desc: [''], r: [], src: 'minha' };
  draft = { id: id || null, s, rows: (s.r || []).filter(x => x.t === 'dmg').map(x => ({ ...newRow(), ...x, choose: !!s.choice && x === (s.r || []).find(y => y.t === 'dmg') })), saveA: (s.r || []).find(x => x.t === 'save')?.a || '', atk: (s.r || []).some(x => x.t === 'atk'), choice: s.choice || [] };
  renderEditor();
}
function stripSpell(s) { const { _hay, base, ...r } = s; return r; }

function renderEditor() {
  const { s, rows } = draft, F = (id, label, val, extra = '') => `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(val ?? '')}" ${extra}></div>`;
  const items = state.items.map(it => `<option value="${esc(it.key || it.id)}" ${s.mat?.key === (it.key || it.id) ? 'selected' : ''}>${esc(it.name)}</option>`).join('');
  const buildRow = (r, i) => `<div class="ed-row" data-row="${i}">
      <div class="field"><label>Dados</label><input data-r="d" value="${esc(r.d)}" placeholder="8d6"></div>
      <div class="field"><label>Tipo</label><select data-r="type">${[...DMG_TYPES, 'Cura'].map(t => `<option ${r.type === t || (t === 'Cura' && r.heal) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Por círculo acima</label><input data-r="up" value="${esc(r.up || '')}" placeholder="1d6"></div>
      <div class="field"><label>Truque (5/11/17)</label><input data-r="cantrip" value="${esc(r.cantrip || '')}" placeholder="1d10"></div>
      <label class="ck"><input type="checkbox" data-r="half" ${r.half ? 'checked' : ''}>Metade se passar</label>
      <button type="button" class="btn sm ghost" data-action="ed-row-del" data-i="${i}">${icon('i-trash')}Remover</button></div>`;
  const body = () => `${mHead('Editor de magias', draft.id ? 'Alterar magia' : 'Nova magia')}
    <form id="spell-form" style="margin-top:14px" autocomplete="off">
      <div class="field-row">${F('e-name', 'Nome', s.name, 'required maxlength="80"')}${F('e-en', 'Nome em inglês', s.en, 'maxlength="80"')}</div>
      <div class="field-row"><div class="field"><label for="e-level">Círculo</label><select id="e-level">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<option value="${n}" ${s.level === n ? 'selected' : ''}>${n ? n + 'º' : 'Truque'}</option>`).join('')}</select></div>
        <div class="field"><label for="e-school">Escola</label><select id="e-school">${SCHOOLS.map(x => `<option ${s.school === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <div class="field-row">${F('e-time', 'Tempo de conjuração', s.time)}${F('e-range', 'Alcance', s.range)}</div>
      <div class="field-row">${F('e-comp', 'Componentes', s.comp)}${F('e-dur', 'Duração', s.dur)}</div>
      ${F('e-material', 'Material', s.material || '', 'maxlength="160"')}
      <div class="ck-row"><label class="ck"><input type="checkbox" id="e-conc" ${s.conc ? 'checked' : ''}>Concentração</label><label class="ck"><input type="checkbox" id="e-ritual" ${s.ritual ? 'checked' : ''}>Ritual</label><label class="ck"><input type="checkbox" id="e-atk" ${draft.atk ? 'checked' : ''}>Jogada de ataque</label></div>
      <div class="field"><label for="e-save">Salvaguarda</label><select id="e-save"><option value="">Nenhuma</option>${ABIL_KEYS.map(a => `<option ${draft.saveA === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
      <div class="field"><label for="e-desc">Descrição</label><textarea id="e-desc" rows="5" maxlength="5000">${esc((s.desc || []).join('\n\n'))}</textarea></div>
      <div class="field"><label for="e-higher">${s.level ? 'Em círculos superiores' : 'Aprimoramento de truque'}</label><textarea id="e-higher" rows="2" maxlength="800">${esc(s.level ? s.higher || '' : s.upgrade || '')}</textarea></div>
      <h4 class="ed-h">Dano e cura</h4>
      <div id="ed-rows">${rows.map(buildRow).join('')}</div>
      <button type="button" class="btn sm" data-action="ed-row-add">${icon('i-plus')}Adicionar linha</button>
      <div class="field" style="margin-top:12px"><label>Escolher o tipo ao conjurar</label><div class="ck-row">${DMG_TYPES.map(t => `<label class="ck"><input type="checkbox" data-choice="${t}" ${draft.choice.includes(t) ? 'checked' : ''}>${t}</label>`).join('')}</div></div>
      <h4 class="ed-h">Consumível vinculado</h4>
      <div class="field-row"><div class="field"><label for="e-mat">Item da mochila</label><select id="e-mat"><option value="">Nenhum</option>${items}</select></div>${F('e-mat-n', 'Quantidade por conjuração', s.mat?.n || 1, 'type="number" min="1" max="99"')}</div>
      <div class="ck-row"><label class="ck"><input type="checkbox" id="e-mat-req" ${s.mat?.required ? 'checked' : ''}>Obrigatório</label><label class="ck"><input type="checkbox" id="e-mat-con" ${s.mat?.required ? (s.mat?.consumed ? 'checked' : '') : 'checked'}>Consumido</label></div>
      <div class="m-actions">${draft.id && store.library.overrides[draft.id] ? '<button type="button" class="btn ghost" data-action="ed-restore">Restaurar original</button>' : ''}<button type="button" class="btn ghost" data-action="close">Cancelar</button><button class="btn gold">Salvar</button></div>
    </form>`;
  openModal(body);
}
function readForm() {
  const { s } = draft, v = id => $(id).value.trim(), ck = id => $(id).checked;
  Object.assign(s, { name: v('#e-name'), en: v('#e-en'), level: +v('#e-level'), school: v('#e-school'), time: v('#e-time'), range: v('#e-range'), comp: v('#e-comp'), dur: v('#e-dur'), material: v('#e-material'), conc: ck('#e-conc'), ritual: ck('#e-ritual') });
  s.desc = v('#e-desc').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
  if (s.level) { s.higher = v('#e-higher'); delete s.upgrade; } else { s.upgrade = v('#e-higher'); delete s.higher; }
  draft.atk = ck('#e-atk'); draft.saveA = v('#e-save');
  draft.choice = [...document.querySelectorAll('[data-choice]')].filter(x => x.checked).map(x => x.dataset.choice);
  draft.rows = [...document.querySelectorAll('.ed-row')].map(el => {
    const g = k => el.querySelector(`[data-r="${k}"]`), type = g('type').value;
    return { d: g('d').value.replace(/\s/g, ''), type, heal: type === 'Cura', up: g('up').value.replace(/\s/g, ''), cantrip: g('cantrip').value.replace(/\s/g, ''), half: g('half').checked };
  });
  const key = v('#e-mat');
  if (key) {
    const it = state.items.find(x => (x.key || x.id) === key);
    if (it && !it.key) it.key = key;
    const required = ck('#e-mat-req');
    s.mat = { key, n: Math.max(1, +v('#e-mat-n') || 1), ...(required ? { required: true, consumed: ck('#e-mat-con') } : {}) };
  } else delete s.mat;
}
function saveEditor() {
  readForm();
  const { s, id } = draft;
  if (!s.name) { $('#e-name').focus(); return; }
  const rolls = (s.r || []).filter(x => x.t === 'note');
  if (draft.atk) rolls.unshift({ t: 'atk' });
  if (draft.saveA) rolls.push({ t: 'save', a: draft.saveA });
  draft.rows.filter(r => /^\d+d\d+([+-]\d+)?$/.test(r.d)).forEach(r => {
    rolls.push({ t: 'dmg', d: r.d, type: r.type, ...(r.heal ? { heal: true } : {}), ...(r.half ? { half: true } : {}), ...(r.up ? { up: r.up } : {}), ...(r.cantrip ? { cantrip: r.cantrip } : {}), ...(draft.atk ? { crit: true } : {}) });
  });
  s.r = rolls;
  s.dmgChip = chipOf(s) || undefined;
  if (draft.choice.length) s.choice = draft.choice; else delete s.choice;
  delete s._hay;
  const novo = !id || String(id).startsWith('m-');
  if (novo) {
    s.id = id || newId('m-'); s.src = 'minha';
    store.library.custom = [...store.library.custom.filter(x => x.id !== s.id), s];
  } else { s.id = id; store.library.overrides[id] = s; }
  for (const c of store.characters) { const g = c.grimoire; if (g) g.added = g.added.map(x => (x.id === s.id ? s : x)); }
  save();
  closeModal();
  afterGrimoire();
  toast(`${s.name} salva`, false);
}
function restoreSpell() {
  delete store.library.overrides[draft.id];
  for (const c of store.characters) { const g = c.grimoire; if (g) g.added = g.added.map(x => (x.id === draft.id ? (libGet(draft.id) || x) : x)); }
  closeModal();
  afterGrimoire();
  toast('Magia restaurada ao original', false);
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case 'grim-view': setGrimView(b.dataset.v); break;
    case 'lib-open': spellModal(id, true); break;
    case 'lib-add': addToGrimoire(id); break;
    case 'lib-remove': removeFromGrimoire(id); break;
    case 'lib-more': libLimit += LIB_PAGE; renderLibrary(); break;
    case 'lib-clear': libFilters = { ...LIB_FILTERS_DEFAULT }; libLimit = LIB_PAGE; renderLibrary(); break;
    case 'lib-import': $('#lib-file').click(); break;
    case 'spell-new': openEditor(null); break;
    case 'spell-edit': openEditor(id); break;
    case 'spell-copy': { openEditor(id); draft.id = null; draft.s.src = 'minha'; draft.s.name += ' (cópia)'; renderEditor(); break; }
    case 'ed-row-add': readForm(); draft.rows.push(newRow()); renderEditor(); break;
    case 'ed-row-del': readForm(); draft.rows.splice(+b.dataset.i, 1); renderEditor(); break;
    case 'ed-restore': restoreSpell(); break;
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'spell-form') { e.preventDefault(); saveEditor(); } });
document.addEventListener('change', e => {
  if (e.target.dataset?.lib) { libFilters[e.target.dataset.lib] = e.target.value; libLimit = LIB_PAGE; renderLibrary(); }
  if (e.target.id === 'lib-file' && e.target.files[0]) { importPrivate(e.target.files[0]); e.target.value = ''; }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'lib-q') return;
  libFilters.q = e.target.value; libLimit = LIB_PAGE;
  clearTimeout(libTimer);
  libTimer = setTimeout(() => { const pos = e.target.selectionStart; renderLibrary(); const i = $('#lib-q'); i?.focus(); i?.setSelectionRange(pos, pos); }, 140);
});
let libTimer = null;
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('lib-card')) { e.preventDefault(); spellModal(e.target.dataset.id, true); }
});
loadPrivate().then(() => { if (privateSpells.length && grimView === 'lib') renderLibrary(); });
