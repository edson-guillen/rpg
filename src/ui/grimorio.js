/* =====================================================================
   ABA GRIMÓRIO
   ===================================================================== */
const filterList = () => [
  { id: 'all', label: 'Todas' }, ...(SPELLS.some(s => !s.level) ? [{ id: '0', label: 'Truques' }] : []),
  ...[...new Set(SPELLS.filter(s => s.level).map(s => s.level))].sort((a, b) => a - b).map(l => ({ id: String(l), label: ORD(l) + ' Círculo' })),
  { id: 'conc', label: 'Concentração' }, { id: 'noconc', label: 'Sem concentração' },
  ...(SPELLS.some(s => s.draconic) ? [{ id: 'drac', label: 'Dracônicas' }] : [])
];
const GROUP_NAME = { 0: 'Truques' };
let query = '';

function highlight(text, q) {
  if (!q) return esc(text);
  const i = norm(text).indexOf(q);
  if (i < 0) return esc(text);
  const chars = [...text];
  return esc(chars.slice(0, i).join('')) + '<mark>' + esc(chars.slice(i, i + q.length).join('')) + '</mark>' + esc(chars.slice(i + q.length).join(''));
}
function matchFilter(s, f) {
  if (f === 'all') return true;
  if (f === 'conc') return !!s.conc;
  if (f === 'noconc') return !s.conc && s.level > 0;
  if (f === 'drac') return !!s.draconic;
  return String(s.level) === f;
}
function spellHaystack(s) {
  return s._hay || (s._hay = norm([s.name, s.en, s.school, s.sum, s.time, s.range, s.dur, ...(s.desc || []), ...(s.orig?.desc || []), ...(s.list || []), ...(s.desc2 || []), s.conc ? 'concentracao' : '', s.draconic ? 'draconica' : ''].map(strip).join(' ')));
}

function renderFilters() {
  $('#filters').innerHTML = filterList().map(f => `<button class="filter" data-action="filter" data-f="${f.id}" aria-pressed="${state.ui.filter === f.id}">${f.label}</button>`).join('');
}

function spellCard(s, q) {
  const tags = [], rr = s.r || [], atk = rr.find(x => x.t === 'atk');
  if (atk) tags.push(`<span class="tag atk">ATQ ${sign(atk.bonus ?? CHAR.stats.atk)}</span>`);
  rr.filter(x => x.t === 'save').forEach(x => tags.push(`<span class="tag save">CD ${dc()} · ${x.a}</span>`));
  const dano = (s.r || []).find(x => x.t === 'dmg');
  if (s.dmgChip) tags.push(`<span class="tag dmg">${esc(dano?.cantrip ? baseDice(dano) : s.dmgChip)}</span>`);
  if (blocked(s)) tags.push('<span class="tag block">Bloqueada</span>');
  if (s.time !== '1 Ação') tags.push(`<span class="tag ${s.reaction ? 'react' : ''}">${s.reaction ? 'Reação' : esc(s.time)}</span>`);
  tags.push(`<span class="tag">${esc(s.range.replace(/ \(.*\)/, ''))}</span>`);
  if (s.conc) tags.push('<span class="tag conc">Concentração</span>');
  if (s.draconic) tags.push('<span class="tag drac">Dracônica</span>');
  if (s.isNew) tags.push('<span class="tag new">Nova</span>');
  return `<button class="spell ${lvClass(s.level)} ${state.conc === s.id ? 'conc-on' : ''}" data-action="spell" data-id="${s.id}">
    <span class="rune">${icon(SCHOOL_ICON[s.school] || 'i-spark')}</span>
    <span class="t"><span class="name">${highlight(s.name, q)}<span class="en">${highlight(s.en, q)}</span></span>
      <span class="sum">${highlight(fmt(s.sum || summaryOf(s)), q)}</span><span class="tags">${tags.join('')}</span></span>
    <span class="chev">${icon('i-chev')}</span></button>`;
}

function renderGrim() {
  const q = norm(query.trim()), f = state.ui.filter;
  const list = SPELLS.filter(s => matchFilter(s, f) && (!q || spellHaystack(s).includes(q)));
  if (!list.length) { $('#grim').innerHTML = `<p class="empty">Nenhuma magia encontrada${query ? ` para “${esc(query)}”` : ''}.</p>`; return; }
  const levels = [...new Set(list.map(s => s.level))].sort();
  $('#grim').innerHTML = levels.map(l => {
    const spells = list.filter(s => s.level === l);
    const mini = l > 0 ? `<span class="mini-gems" aria-label="${totalAvail(l)} espaços disponíveis">${Array.from({ length: CHAR.slots[l] + state.extra[l] }, (_, i) => `<i class="${i < totalAvail(l) ? '' : 'off'}"></i>`).join('')}</span>` : '<span class="aside note">à vontade</span>';
    return `<section class="spell-group ${lvClass(l)}"><div class="group-h"><h3>${GROUP_NAME[l] || ORD(l) + ' Círculo'}</h3><span class="rule"></span>${mini}</div>
      <div class="spell-list">${spells.map(s => spellCard(s, q)).join('')}</div></section>`;
  }).join('');
}


/** Resumo curto para magias vindas da biblioteca, que não têm um escrito à mão. */
function summaryOf(s) {
  const r = s.r || [], dano = r.find(x => x.t === 'dmg'), partes = [];
  if (r.some(x => x.t === 'atk')) partes.push('Ataque');
  const sv = r.find(x => x.t === 'save');
  if (sv) partes.push('Salv. ' + sv.a);
  if (dano) partes.push(baseDice(dano) + ' ' + dano.type);
  return (partes.join(' · ') || s.time + ' · ' + s.range);
}
