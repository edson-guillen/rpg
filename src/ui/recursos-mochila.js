/* =====================================================================
   ABA RECURSOS
   ===================================================================== */
function renderHp() {
  const s = CHAR.stats, pct = Math.round(100 * state.hp / s.hpMax);
  $('#hp-panel').innerHTML = `
    <div class="panel-h"><h2>Pontos de Vida</h2><span class="rule"></span><span class="aside">Dados de Vida: ${state.res.hd}/${RES.hd.max} d${CHAR.hitDie}</span></div>
    <div class="hp-big"><div class="hp-num num">${state.hp}<small> / ${s.hpMax}</small>${state.temp ? `<span class="tmp">+${state.temp} PV temporários</span>` : ''}</div></div>
    <div class="hpbar"><i style="width:${pct}%;background-position:${100 - pct}% 0"></i></div>
    <div class="hp-ctrl">
      <input id="hp-amt" type="number" inputmode="numeric" min="0" max="999" placeholder="Valor" aria-label="Quantidade de PV">
      <button class="btn danger" data-action="hp" data-op="dmg">Dano</button>
      <button class="btn" data-action="hp" data-op="heal" style="color:var(--ok)">Curar</button>
      <button class="btn ghost" data-action="hp" data-op="temp" style="color:var(--frost)">Temp.</button>
    </div>`;
}

function renderRes() {
  $('#res-list').innerHTML = CHAR.resources.map(r => {
    const cur = state.res[r.id];
    let gems = '';
    for (let i = 0; i < r.max; i++) gems += gem('', i >= cur, 'res-gem', { id: r.id, i }, `${r.name} ${i + 1}: ${i >= cur ? 'gasto' : 'disponível'}`);
    let act = '';
    if (r.action) {
      if (r.action.goto) act = `<button class="btn sm" data-action="goto-sp">${r.action.label}</button>`;
      else if (r.action.fx === 'innate' && state.fx.innate) act = `<button class="btn sm" data-action="fx-end" data-fx="innate">Encerrar</button>`;
      else act = `<button class="btn sm ${r.action.fx === 'innate' ? 'frost' : ''}" data-action="res-use" data-id="${r.id}" ${cur ? '' : 'disabled'}>${r.action.label}</button>`;
    }
    return `<div class="panel res ${r.c}">
      <div class="res-top"><div class="res-ic">${icon(r.icon)}</div>
        <div class="res-t"><h3>${r.name}</h3><div class="meta">${r.meta}</div></div>
        <div class="res-val num" aria-live="polite">${cur}<small>/${r.max}</small></div></div>
      <p class="res-desc">${r.desc}</p>
      <div class="res-foot"><div class="gems">${gems}</div>
        <div class="ctl"><button class="step" data-action="res-step" data-id="${r.id}" data-d="-1" ${cur ? '' : 'disabled'} aria-label="Gastar ${r.name}">−</button>
          <button class="step" data-action="res-step" data-id="${r.id}" data-d="1" ${cur < r.max ? '' : 'disabled'} aria-label="Recuperar ${r.name}">+</button>${act}</div></div></div>`;
  }).join('');
}

function renderPassives() {
  $('#passives').innerHTML = CHAR.passives.map((p, i) => `<details class="passive" ${i === 0 ? 'open' : ''}><summary>${p.t}</summary><ul>${p.items.map(x => `<li>${x}</li>`).join('')}</ul></details>`).join('');
}

/* =====================================================================
   ABA MOCHILA
   ===================================================================== */
function itemRow(it) {
  const hasQ = it.qty !== null && it.qty !== undefined, id = esc(it.id);
  const tags = [];
  const out = it.key === 'diamond' && !it.qty;
  if (it.key && !out) SPELLS.filter(sp => sp.mat?.key === it.key).forEach(sp => tags.push(`<span class="tag ${lvClass(sp.level)}" style="color:var(--c);border-color:color-mix(in srgb,var(--c) 45%,transparent)">${sp.name}</span>`));
  if (out) tags.push('<span class="tag block">Orbe Cromático bloqueada</span>');
  else if (it.cat === 'comp' && hasQ && it.qty > 0 && it.qty <= 3) tags.push('<span class="tag conc">Acabando</span>');
  else if (it.cat === 'comp' && hasQ && !it.qty) tags.push('<span class="tag block">Esgotado — use o foco</span>');
  return `<div class="item ${hasQ && !it.qty ? 'zero' : ''}">
    <button class="it" data-action="item-edit" data-id="${id}"><b>${esc(it.name)}</b>${it.note ? `<span>${esc(it.note)}</span>` : ''}${tags.length ? `<span class="tags">${tags.join('')}</span>` : ''}</button>
    ${hasQ ? `<div class="counter"><button class="step" data-action="item-step" data-id="${id}" data-d="-1" ${it.qty ? '' : 'disabled'} aria-label="Gastar ${esc(it.name)}">−</button>
      <div class="v num">${it.qty}${it.unit ? `<small>${esc(it.unit)}</small>` : ''}</div>
      <button class="step" data-action="item-step" data-id="${id}" data-d="1" aria-label="Adicionar ${esc(it.name)}">+</button></div>`
    : `<span class="chev">${icon('i-chev')}</span>`}</div>`;
}
function renderItems() {
  const html = ITEM_CATS.map(c => {
    const list = state.items.filter(i => (i.cat || 'cons') === c.id);
    if (!list.length) return '';
    return `<section class="inv-group lvG"><div class="group-h"><h3>${c.t}</h3><span class="rule"></span>${c.hint ? `<span class="aside note">${c.hint}</span>` : ''}</div>
      <div class="items">${list.map(itemRow).join('')}</div></section>`;
  }).join('');
  $('#items').innerHTML = html || '<p class="empty">Inventário vazio.</p>';
}

function render() {
  renderStats(); renderEffects(); renderFicha(); renderSlots(); renderSpHub(); renderReminders();
  renderFilters(); renderGrim(); renderHp(); renderRes(); renderItems(); renderPersonagem();
  popKey = null;
  if (modalRefresh) modalRefresh();
}

