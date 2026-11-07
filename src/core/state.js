/* =====================================================================
   ESTADO, PERSISTÊNCIA E DESFAZER
   ===================================================================== */
const ORD = n => n + 'º';
const TABS = ['mesas', 'ficha', 'personagem', 'magia', 'grimorio', 'recursos', 'mochila', 'notas', 'sugestoes'];

function defaultState() {
  return {
    v: 2,
    used:  Object.fromEntries(LEVELS.map(l => [l, 0])),
    extra: Object.fromEntries(LEVELS.map(l => [l, 0])),
    res:   Object.fromEntries(CHAR.resources.map(r => [r.id, r.max])),
    hp: CHAR.stats.hpMax, temp: 0,
    conc: null,
    fx: { innate: false, shield: false, mirror: 0, rage: false, on: {}, usado: {} },
    morte: { s: 0, f: 0, estavel: false, morto: false, causa: '' },
    spLog: [],
    items: CHAR.items.map((it, i) => ({ id: 'it' + i, ...it })),
    ui: { tab: 'magia', filter: 'all' }
  };
}

function sanitize(raw) {
  const d = defaultState();
  if (!raw || typeof raw !== 'object') return d;
  const int = (v, lo, hi, def) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : def;
  for (const l of LEVELS) {
    d.used[l]  = int(raw.used?.[l], 0, CHAR.slots[l], 0);
    d.extra[l] = int(raw.extra?.[l], 0, 9, 0);
  }
  for (const r of CHAR.resources) d.res[r.id] = int(raw.res?.[r.id], 0, r.max, r.max);
  d.hp = int(raw.hp, 0, CHAR.stats.hpMax, CHAR.stats.hpMax);
  d.temp = int(raw.temp, 0, 999, 0);
  if (raw.morte) d.morte = { s: int(raw.morte.s, 0, 2, 0), f: int(raw.morte.f, 0, 3, 0), estavel: !!raw.morte.estavel, morto: !!raw.morte.morto, causa: String(raw.morte.causa || '').slice(0, 300) };
  if (d.morte.morto) d.hp = 0;
  d.conc = SPELL[raw.conc]?.conc ? raw.conc : null;
  if (Array.isArray(raw.spLog)) d.spLog = raw.spLog.filter(e => e && typeof e.txt === 'string').slice(0, 8)
    .map(e => ({ t: String(e.t || '').slice(0, 5), d: int(e.d, -99, 99, 0), txt: e.txt.slice(0, 160), sp: int(e.sp, 0, RES.sp?.max ?? 0, 0) }));
  d.fx.rage = !!raw.fx?.rage; d.fx.innate = !!raw.fx?.innate; d.fx.shield = !!raw.fx?.shield; d.fx.mirror = int(raw.fx?.mirror, 0, 3, 0);
  for (const k of ['on', 'usado']) if (raw.fx?.[k] && typeof raw.fx[k] === 'object') for (const [id, v] of Object.entries(raw.fx[k])) if (typeof v === 'boolean' || typeof v === 'string') d.fx[k][id] = v;
  // v1 tinha um inventário genérico: a partir da v2 usa-se o inventário exato da ficha.
  if ((raw.v || 1) >= 2 && Array.isArray(raw.items)) {
    const cats = ITEM_CATS.map(c => c.id);
    d.items = raw.items.filter(it => it && typeof it.name === 'string').map((it, i) => ({
      id: String(it.id || 'it' + Date.now() + i), name: it.name.slice(0, 80), note: String(it.note || '').slice(0, 160),
      qty: it.qty === null || it.qty === undefined || it.qty === '' ? null : int(it.qty, 0, 999999, 0),
      cat: cats.includes(it.cat) ? it.cat : 'cons', unit: String(it.unit || '').slice(0, 12),
      ...(it.key ? { key: String(it.key) } : {})
    }));
  }
  if (TABS.includes(raw.ui?.tab) && (NUVEM_CFG || !['mesas', 'sugestoes'].includes(raw.ui.tab))) d.ui.tab = raw.ui.tab;
  if (typeof raw.ui?.filter === 'string') d.ui.filter = raw.ui.filter;
  return d;
}

function load() {
  try { return sanitize(activeChar().state); }
  catch (e) { return defaultState(); }
}
function save() {
  activeChar().state = state;
  persistStore();
}

let state = load();
const undoStack = [];
let popKey = null;

/** Aplica uma mudança com suporte a desfazer, salva e redesenha. */
function commit(label, fn, opts = {}) {
  const snap = JSON.stringify(state), sp0 = state.res.sp;
  const res = fn(state);
  if (res === false) return false;
  if (state.morte.morto) state.hp = 0;
  else if (state.hp > 0 && (state.morte.s || state.morte.f || state.morte.estavel)) state.morte = { s: 0, f: 0, estavel: false, morto: false, causa: '' };
  if (state.res.sp !== sp0) {
    const t = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    state.spLog = [{ t, d: state.res.sp - sp0, txt: label || 'Ajuste manual', sp: state.res.sp }, ...(state.spLog || [])].slice(0, 8);
  }
  undoStack.push(snap);
  if (undoStack.length > 40) undoStack.shift();
  save(); render();
  if (label) toast(label, opts.undo !== false);
  return true;
}
function undo() {
  const snap = undoStack.pop();
  if (!snap) return;
  const ui = state.ui;
  state = sanitize(JSON.parse(snap)); state.ui = ui;
  save(); render(); toast('Ação desfeita', false);
}
function setUI(key, val) { state.ui[key] = val; save(); }

