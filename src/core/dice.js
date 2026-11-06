/* =====================================================================
   DADOS (rolagens)
   ===================================================================== */
function parseDice(expr) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, '').replace('−', '-'));
  return m ? { n: +m[1], f: +m[2], mod: +(m[3] || 0) } : { n: 0, f: 0, mod: 0 };
}
const avgOf = expr => { const p = parseDice(expr); return p.n * (p.f + 1) / 2 + p.mod; };
const showDice = expr => String(expr).replace(/([+-])(\d+)$/, (m, sg, n) => ` ${sg === '-' ? '−' : '+'} ${n}`);
function addDice(expr, extra, times) {
  const p = parseDice(expr), e = parseDice(extra);
  return `${p.n + e.n * times}d${p.f}${p.mod ? (p.mod > 0 ? '+' : '') + p.mod : ''}`;
}
function rollDice(expr, o = {}) {
  const p = parseDice(expr), count = o.crit ? p.n * 2 : p.n, dice = [], extra = [];
  for (let i = 0; i < count; i++) dice.push(d(p.f));
  if (o.explode) {
    let k = dice.filter(x => x === o.explode).length;
    while (k > 0 && extra.length < (o.max || 0)) { const r = d(p.f); extra.push(r); k--; if (r === o.explode) k++; }
  }
  return { dice, extra, mod: p.mod, total: Math.max(0, dice.concat(extra).reduce((a, b) => a + b, 0) + p.mod) };
}
let critSrc = null, rollTimer;
function showRoll(label, total, detail, extra = '', cls = '') {
  const el = $('#roll');
  el.className = 'rollpop show ' + cls;
  el.innerHTML = `<div class="rp-l">${label}</div><div class="rp-t num">${total}</div><div class="rp-b">${detail}</div>${extra ? `<div class="rp-x">${extra}</div>` : ''}`;
  clearTimeout(rollTimer); rollTimer = setTimeout(() => el.classList.remove('show'), 8000);
}
function doRoll(ds) {
  if (ds.kind === 'd20') {
    const bonus = +ds.bonus, adv = ds.adv === 'spell' && state.fx.innate, isAtk = ds.atk === '1';
    const a = d(20), b = adv ? d(20) : 0, k = adv ? Math.max(a, b) : a;
    let extra = '', cls = '';
    if (isAtk) critSrc = k === 20 ? ds.src : null;
    if (k === 20) { cls = 'crit'; extra = isAtk ? '20 natural — CRÍTICO! A próxima rolagem de dano desta arma/magia dobra os dados.' : '20 natural!'; }
    else if (k === 1) { cls = 'fail'; extra = isAtk ? '1 natural — erro automático.' : '1 natural.'; }
    showRoll(esc(ds.label), k + bonus, `🎲 ${adv ? `${a} e ${b} → <b>${k}</b> (Vantagem)` : a} ${sign(bonus)}`, extra, cls);
  } else {
    const crit = ds.crit === '1' && !!critSrc && critSrc === ds.src;
    const r = rollDice(ds.expr, { crit, explode: +ds.explode || 0, max: +ds.max || 0 });
    if (crit) critSrc = null;
    const detail = `🎲 ${crit ? 'crítico · ' : ''}[${r.dice.join(', ')}]${r.extra.length ? ` + explosão [${r.extra.join(', ')}]` : ''}${r.mod ? ` ${sign(r.mod)}` : ''}`;
    const extras = [];
    if (ds.half === '1') extras.push(`Quem passar na salvaguarda sofre <b>${Math.floor(r.total / 2)}</b>.`);
    if (ds.orb === '1' && new Set(r.dice).size < r.dice.length) extras.push('Dados iguais: o orbe <b>salta</b> para outro alvo a até 9 m!');
    showRoll(esc(ds.label) + (ds.type ? ` · ${esc(ds.type)}` : ''), r.total, detail, extras.join(' '), crit ? 'crit' : '');
  }
}
/** Botão que rola dados. o = {kind:'d20'|'dmg', bonus, expr, label, src, atk, adv, crit, explode, max, half, orb, type} */
function rollBtn(o, inner, cls = 'rb') {
  const data = Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `data-${k}="${esc(v === true ? '1' : v)}"`).join(' ');
  return `<button class="${cls}" data-action="roll" ${data}>${inner}</button>`;
}

let toastTimer, toastUndo = null;
/** Aviso no rodapé. onUndo: desfazer próprio (ex.: anotações); sem ele, usa o desfazer da ficha. */
function toast(msg, undoable = true, onUndo = null) {
  const t = $('#toast');
  toastUndo = onUndo;
  $('.msg', t).textContent = msg;
  $('button', t).hidden = !undoable || (!onUndo && !undoStack.length);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), undoable ? 5000 : 2200);
}

function gem(cls, spent, action, data = {}, label = '') {
  const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  const key = `${action}:${Object.values(data).join(':')}`;
  return `<button class="gem ${cls} ${spent ? 'spent' : ''} ${popKey === key ? 'pop' : ''}" data-action="${action}" ${attrs}
    aria-label="${esc(label)}" aria-pressed="${spent}"><i></i></button>`;
}

