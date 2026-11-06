/* =====================================================================
   MODAIS
   ===================================================================== */
let modalRefresh = null, lastFocus = null;
function openModal(build) {
  lastFocus = document.activeElement;
  const sh = $('#sheet');
  modalRefresh = () => { const st = sh.scrollTop; sh.innerHTML = '<div class="grab"></div>' + build(); sh.scrollTop = st; };
  modalRefresh();
  $('#modal').hidden = false; document.body.style.overflow = 'hidden'; sh.scrollTop = 0;
  setTimeout(() => ($('[autofocus]', sh) || $('.m-close', sh))?.focus({ preventScroll: true }), 40);
}
function closeModal() {
  if ($('#modal').hidden) return;
  $('#modal').hidden = true; modalRefresh = null; document.body.style.overflow = '';
  lastFocus?.focus?.({ preventScroll: true });
}
const mHead = (kicker, title, sub = '') => `<div class="m-head"><div class="t"><div class="m-kicker">${kicker}</div>
  <h2 class="m-title" id="m-title">${title}</h2>${sub ? `<div class="m-en">${sub}</div>` : ''}</div>
  <button class="m-close" data-action="close" aria-label="Fechar">${icon('i-x')}</button></div>`;
const box = (h, body, cls = '') => `<div class="box ${cls}"><h5>${h}</h5>${body}</div>`;

/* ---------- Magia ---------- */
let castMeta = new Set();
const metaCost = () => [...castMeta].reduce((a, id) => a + META[id].cost, 0);

let castMat = true;
/** Dados de uma linha, já com o escalonamento de truque pelo nível e o modificador de conjuração. */
const cantripTier = () => { const n = activeChar().level; return n >= 17 ? 4 : n >= 11 ? 3 : n >= 5 ? 2 : 1; };
const modExpr = x => (x.addMod ? sign(CHAR.stats.cha).replace('−', '-') : '');
function baseDice(x) {
  const d = x.cantrip ? addDice(x.d, x.cantrip, cantripTier() - 1) : x.d;
  return x.addMod ? d + modExpr(x) : d;
}
function rollsSection(s) {
  if (!s.r || !s.r.length) return '';
  const rows = s.r.map(x => {
    if (x.t === 'atk') {
      const bonus = x.bonus ?? CHAR.stats.atk, spell = x.spell !== false, adv = spell && state.fx.innate;
      return `<div class="rr"><span class="rk atk">ATQ</span><div class="rt"><b>${x.label || 'Ataque mágico'} ${sign(bonus)}</b>
        <span>d20 + ${bonus} (${CHAR.calc.atk})${adv ? ' · <b>Vantagem</b> (Feitiçaria Inata)' : ''}</span></div>
        ${rollBtn({ kind: 'd20', bonus, atk: 1, src: s.id, adv: spell ? 'spell' : null, label: `${s.name} · ataque` }, `${icon('i-d20')}<b class="num">${sign(bonus)}</b>`)}</div>`;
    }
    if (x.t === 'save') return `<div class="rr"><span class="rk save">CD ${dc()}</span><div class="rt"><b>Salvaguarda de ${SAVE_NAME[x.a]}</b><span>${x.txt || 'O alvo rola contra a sua CD'}</span></div></div>`;
    if (x.t === 'dc') return `<div class="rr"><span class="rk save">CD ${dc()}</span><div class="rt"><b>${x.txt}</b></div></div>`;
    if (x.t === 'note') return `<div class="rr"><span class="rk note">NOTA</span><div class="rt"><span>${x.txt}</span></div></div>`;
    const base = baseDice(x), variants = [[base, s.level]];
    if (x.table) LEVELS.filter(l => l > s.level && x.table[l]).forEach(l => variants.push([x.table[l] + modExpr(x), l]));
    else if (x.up) LEVELS.filter(l => l > s.level).forEach(l => variants.push([addDice(base, x.up, l - s.level), l]));
    const btns = variants.map(([e, l]) => rollBtn({ kind: 'dmg', expr: e, src: s.id, crit: x.crit, explode: x.explode, max: x.max, half: x.half, orb: x.orb, type: s.choice?.length && castType && !x.heal ? castType : x.type,
      label: s.name + (l > s.level ? ` (${ORD(l)} círc.)` : '') }, `${icon('i-die')}<b class="num">${showDice(e)}</b>${l > s.level ? `<small>${ORD(l)}</small>` : ''}`)).join('');
    const tipo = s.choice?.length && castType && !x.heal ? castType : x.type;
    return `<div class="rr"><span class="rk dmg">${x.heal ? 'CURA' : 'DANO'}</span><div class="rt"><b>${showDice(base)} ${tipo}</b>
      <span>${x.label ? x.label + ' · ' : ''}média ${decimal(avgOf(base))}${x.half ? ' · metade se passar' : ''}${x.up ? ` · +${x.up} por círculo acima` : ''}${x.cantrip ? ' · cresce nos níveis 5, 11 e 17' : ''}</span></div><div class="rbs">${btns}</div></div>`;
  }).join('');
  return `<div class="rolls-box"><h4>Números e rolagens</h4>${rows}</div>`;
}

function castSection(s) {
  const spent = metaCost(), blk = blocked(s);
  const subtle = castMeta.has('subtle');
  const metas = CHAR.metamagic.map(m => {
    const on = castMeta.has(m.id), okType = m.id !== 'quick' || s.time === '1 Ação';
    const can = okType && (on || state.res.sp >= m.cost);
    return `<button class="mt" data-action="meta-toggle" data-id="${m.id}" aria-pressed="${on}" ${can ? '' : 'disabled'}>${icon(m.icon)}${m.name} · ${m.cost} PF</button>`;
  }).join('');
  let matBtn = '', matNote = '';
  if (s.mat) {
    const it = matItem(s.mat.key), q = it?.qty ?? 0, name = it ? it.name : s.mat.key, n = s.mat.n || 1;
    if (s.mat.required) {
      if (subtle && !blk) matNote = `<p class="mat-line">${icon('i-gem')}Magia Sutil não dispensa o ${esc(name)} (tem custo em PO).</p>`;
      else matNote = blk
        ? box('Bloqueada', `Requer <b>${esc(name)}</b> e você tem <b>0</b>. Quando conseguir um, ajuste a quantidade na Mochila.`, 'warn')
        : `<p class="mat-line">${icon('i-gem')}${esc(name)}: <b>${q}</b> no inventário — ${s.mat.consumed ? `necessário, gasta ${n} por conjuração` : 'necessário, não é consumido'}.</p>`;
    } else if (subtle) {
      matNote = `<p class="mat-line">${icon('i-hush')}Magia Sutil: sem componentes — o estoque de <b>${esc(name)}</b> não é usado.</p>`;
    } else {
      const can = q >= n, on = castMat && can;
      matBtn = `<button class="mt" data-action="mat-toggle" aria-pressed="${on}" ${can ? '' : 'disabled'}>${icon('i-bag')}Gastar ${n}${it?.unit === 'cm' ? ' cm de' : ' ×'} ${esc(name)} · resta ${q}</button>`;
      matNote = `<p class="mat-line">${icon('i-gem')}${can ? 'Pelas regras de 2024 o foco arcano (cetro) substitui este componente — desmarque para não descontar.' : `Sem ${esc(name)} no inventário: conjure usando o foco arcano (cetro).`}</p>`;
    }
  }
  const btns = s.level === 0
    ? `<button class="btn frost" data-action="cast" data-id="${s.id}" data-lv="0">${icon('i-spark')}Conjurar truque${spent ? ` (−${spent} PF)` : ''}</button>`
    : LEVELS.filter(l => l >= s.level).map(l => {
        const n = totalAvail(l);
        return `<button class="btn ${l === s.level ? 'frost' : ''}" data-action="cast" data-id="${s.id}" data-lv="${l}" ${n && !blk ? '' : 'disabled'}>
          Conjurar no ${ORD(l)}${l > s.level ? ' (ampliada)' : ''} <small style="opacity:.75;font-weight:400">· ${n ? n + (n > 1 ? ' restam' : ' resta') : 'sem espaços'}</small></button>`;
      }).join('');
  const notes = [];
  if (s.level === 0) notes.push('Truques são à vontade — não gastam espaços.');
  if (castMeta.has('quick')) notes.push('<b>Acelerada:</b> conjurada como Ação Bônus. Neste turno, sua Ação só pode lançar <b>truques</b>.');
  if (s.conc && state.conc && state.conc !== s.id) notes.push(`⚠ Conjurar encerra a concentração em <b>${esc(SPELL[state.conc].name)}</b>.`);
  if (s.level && !blk && !LEVELS.some(l => l >= s.level && totalAvail(l))) notes.push('Sem espaços disponíveis. Use a <b>Fonte de Magia</b> para criar um ou faça um Descanso Longo.');
  if (s.choice?.length && !castType) notes.unshift('Escolha o elemento acima antes de conjurar.');
  return `${typeSection(s)}<div class="cast"><h4>Conjurar</h4><div class="mt-group" role="group" aria-label="Metamagia">${metas}
      <p class="note">Metamagia: uma por magia · você tem <b>${state.res.sp} PF</b></p></div>${matBtn ? `<div class="meta-toggles">${matBtn}</div>` : ''}
    <div class="cast-row">${btns}</div>${matNote}${notes.map(n => `<p class="note" style="margin-top:8px">${n}</p>`).join('')}</div>`;
}

let showOriginal = false, castType = null;
const chosenFor = s => activeChar().choices?.[s.id] || null;
function typeSection(s) {
  if (!s.choice?.length) return '';
  const chips = s.choice.map(t => `<button class="mt" data-action="cast-type" data-t="${esc(t)}" aria-pressed="${castType === t}">${esc(t)}</button>`).join('');
  return `<div class="cast-types"><h4>Escolha o elemento</h4><div class="mt-group" role="group" aria-label="Elemento">${chips}</div></div>`;
}
function spellTools(s) {
  return `<div class="m-actions"><button class="btn sm ghost" data-action="spell-edit" data-id="${esc(s.id)}">Editar magia</button><button class="btn sm ghost" data-action="lib-remove" data-id="${esc(s.id)}">Remover do grimório</button></div>`;
}
function libActions(s) {
  const tem = inGrimoire(s), id = esc(s.id);
  return `<div class="m-actions">${tem ? `<button class="btn ghost" data-action="lib-remove" data-id="${id}">Remover do grimório</button>` : `<button class="btn gold" data-action="lib-add" data-id="${id}">${icon('i-plus')}Adicionar ao grimório</button>`}
    <button class="btn" data-action="spell-copy" data-id="${id}">Duplicar e editar</button><button class="btn" data-action="spell-edit" data-id="${id}">Editar</button></div>`;
}
function spellModal(id, fromLib = false) {
  const s = fromLib ? libGet(id) : SPELL[id]; castMeta = new Set(); castMat = true; showOriginal = false; castType = s ? chosenFor(s) : null;
  openModal(() => {
    const tags = [`<span class="tag">${esc(s.school)}</span>`];
    if (s.conc) tags.push('<span class="tag conc">Concentração</span>');
    if (s.reaction) tags.push('<span class="tag react">Reação</span>');
    if (s.draconic) tags.push('<span class="tag drac">Dracônica · sempre preparada</span>');
    if (s.isNew) tags.push('<span class="tag new">Nova no nível 4</span>');
    if (blocked(s)) tags.push('<span class="tag block">Bloqueada — falta componente</span>');
    if (state.conc === s.id) tags.push('<span class="tag conc">● Concentrando agora</span>');
    const prop = (k, v) => `<div class="prop"><dt>${k}</dt><dd>${esc(v)}</dd></div>`;
    const P = t => `<p>${fmt(t)}</p>`;
    return `<div class="${lvClass(s.level)}">${mHead(s.level ? `${ORD(s.level)} Círculo · ${s.school}` : `Truque · ${s.school}`, esc(s.name), esc(s.en))}
      <div class="m-tags">${tags.join('')}</div>
      <dl class="props">${prop('Tempo de Conjuração', s.time)}${prop('Alcance', s.range)}${prop('Componentes', s.comp + (s.material ? ` (${s.material})` : ''))}${prop('Duração', s.dur)}${s.area ? prop('Área', s.area.text) : ''}${s.ritual ? prop('Ritual', 'Pode ser conjurada como ritual') : ''}</dl>
      ${rollsSection(s)}
      ${s.orig ? `<div class="m-tags"><button class="btn sm ghost" data-action="spell-orig" aria-pressed="${showOriginal}">${showOriginal ? 'Ver em português' : 'Ver original'}</button></div>` : ''}
      ${showOriginal && s.orig ? `<div class="m-body" lang="en">${s.orig.desc.map(P).join('')}</div>${s.orig.upgrade ? box('Cantrip Upgrade', fmt(s.orig.upgrade)) : ''}${s.orig.higher ? box('Using a Higher-Level Spell Slot', fmt(s.orig.higher)) : ''}` : `<div class="m-body">${s.desc.map(P).join('')}${s.list ? `<ul>${s.list.map(li => `<li>${fmt(li)}</li>`).join('')}</ul>` : ''}${(s.desc2 || []).map(P).join('')}</div>
      ${s.upgrade ? box('Aprimoramento de Truque', fmt(s.upgrade)) : ''}${s.higher ? box('Em círculos superiores', fmt(s.higher)) : ''}`}
      ${s.warn ? box('Atenção', fmt(s.warn), 'warn') : ''}${s.tactic ? box(`Tática de ${esc(activeChar().name.split(' ')[0])}`, fmt(s.tactic), 'tactic') : ''}
      ${fromLib ? libActions(s) : castSection(s) + spellTools(s)}</div>`;
  });
}

function doCast(id, lv) {
  const s = SPELL[id], cost = metaCost(), prev = state.conc;
  if (s.choice?.length && !castType) { toast('Escolha o elemento antes de conjurar', false); return; }
  if (blocked(s)) { toast(`${s.name} bloqueada: falta ${matItem(s.mat.key)?.name || 'componente'}`, false); return; }
  const gasta = s.mat && (!s.mat.required || s.mat.consumed);
  const it = gasta ? matItem(s.mat.key) : null, n = s.mat?.n || 1;
  const useMat = !!(it && (s.mat.required || (castMat && !castMeta.has('subtle'))) && (it.qty ?? 0) >= n);
  const metaTxt = [...castMeta].map(m => META[m].name).join(' + ');
  let label = `${s.name} conjurada${lv ? ` (${ORD(lv)})` : ''}${metaTxt ? ` · ${metaTxt} (−${cost} PF)` : ''}`;
  if (useMat) label += ` · −${n}${it.unit === 'cm' ? ' cm' : ''} ${it.name} (resta ${it.qty - n})`;
  if (s.conc && prev && prev !== id) label += ` · fim da concentração em ${SPELL[prev].name}`;
  const ok = commit(label, st => {
    if (st.res.sp < cost) return false;
    if (lv > 0) {
      if (st.used[lv] < CHAR.slots[lv]) st.used[lv]++;
      else if (st.extra[lv] > 0) st.extra[lv]--;
      else return false;
    }
    st.res.sp -= cost;
    if (useMat) { const x = st.items.find(i => i.key === s.mat.key); if (x && x.qty >= n) x.qty -= n; }
    if (s.conc) st.conc = s.id;
    if (s.effect === 'shield') st.fx.shield = true;
    if (s.effect === 'mirror') st.fx.mirror = 3;
  });
  if (ok) {
    const c = activeChar();
    if (castType) { c.choices = { ...c.choices, [s.id]: castType }; c.lastElement = castType; persistStore(); }
    closeModal();
    playSpell(s, castType, lv || s.level);
  } else toast('Recursos insuficientes', false);
}

/* ---------- Descansos ---------- */
let restRolls = [];
function shortRestModal() {
  restRolls = [];
  openModal(() => {
    const hd = state.res.hd, full = state.hp >= CHAR.stats.hpMax, can = hd > 0 && !full;
    const gems = Array.from({ length: RES.hd.max }, (_, i) => `<span class="gem ${i < hd ? '' : 'spent'}"><i></i></span>`).join('');
    return `${mHead('Descanso Curto · 1 hora', 'Recuperar o fôlego')}
      <p class="note" style="margin-top:10px">Gaste Dados de Vida para curar: cada dado cura <b>1d${CHAR.hitDie} + ${CHAR.conMod}</b> (CON).</p>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px">
        <div class="gems lvR" aria-label="${hd} Dados de Vida">${gems}</div>
        <div class="hp-num num" style="font-size:30px">${state.hp}<small> / ${CHAR.stats.hpMax} PV</small></div></div>
      <div class="rolls">${restRolls.map(r => `<span class="roll">🎲 ${r.die} + ${CHAR.conMod} = +${r.heal} PV</span>`).join('')}</div>
      <button class="btn frost block" data-action="hd-roll" ${can ? '' : 'disabled'}>${icon('i-die')}${full ? 'PV já estão no máximo' : hd ? 'Rolar e gastar 1 Dado de Vida' : 'Sem Dados de Vida'}</button>
      <p class="note" style="margin:12px 0 6px">Rolou um d${CHAR.hitDie} físico? Toque no resultado:</p>
      <div class="fom-btns">${Array.from({ length: CHAR.hitDie }, (_, i) => `<button class="chipbtn" style="min-width:46px;justify-content:center" data-action="hd-roll" data-v="${i + 1}" ${can ? '' : 'disabled'}><b>${i + 1}</b></button>`).join('')}</div>
      ${box('Feiticeiro nível 4', 'Nenhum recurso de classe volta no Descanso Curto. A <b>Restauração Feiticeira</b> (recuperar PF no descanso curto) chega no nível 5.', 'warn')}
      <div class="m-actions"><button class="btn gold" data-action="close">Concluir descanso</button></div>`;
  });
}
function spendHitDie(v) {
  const die = v || d(CHAR.hitDie), heal = Math.max(1, die + CHAR.conMod);
  restRolls.push({ die, heal });
  if (!commit(`Dado de Vida: ${die} + ${CHAR.conMod} = +${heal} PV`, st => {
    if (!st.res.hd || st.hp >= CHAR.stats.hpMax) return false;
    st.res.hd--; st.hp = Math.min(CHAR.stats.hpMax, st.hp + heal);
  })) restRolls.pop();
}

function longRestModal() {
  openModal(() => {
    const rows = LEVELS.map(l => [`Espaços de ${ORD(l)} círculo`, avail(l), CHAR.slots[l]])
      .concat(CHAR.resources.map(r => [r.name, state.res[r.id], r.max]), [['Pontos de Vida', state.hp, CHAR.stats.hpMax]]);
    const extras = LEVELS.reduce((a, l) => a + state.extra[l], 0), f = state.fx;
    const notes = [];
    if (extras) notes.push(`${extras} espaço(s) criado(s) pela Fonte de Magia desaparece(m).`);
    if (state.temp) notes.push('PV temporários são perdidos.');
    if (state.conc || f.innate || f.shield || f.mirror) notes.push('Efeitos ativos e concentração são encerrados.');
    return `${mHead('Descanso Longo · 8 horas', 'Descansar até o amanhecer')}
      <ul class="restore-list">${rows.map(([n, c, m]) => `<li class="${c < m ? 'up' : ''}"><span>${n}</span><span class="num">${c < m ? `${c} → ${m}` : `${m}/${m} ✓`}</span></li>`).join('')}</ul>
      ${notes.map(n => `<p class="note">${n}</p>`).join('')}
      <div class="m-actions"><button class="btn ghost" data-action="close">Cancelar</button><button class="btn gold" data-action="long-rest-go" autofocus>${icon('i-moon')}Descansar</button></div>`;
  });
}
function longRest() {
  commit('Descanso Longo concluído — tudo recuperado', st => {
    LEVELS.forEach(l => { st.used[l] = 0; st.extra[l] = 0; });
    CHAR.resources.forEach(r => { st.res[r.id] = r.max; });
    st.hp = CHAR.stats.hpMax; st.temp = 0; st.conc = null;
    st.fx = { innate: false, shield: false, mirror: 0 };
  });
  closeModal();
}

/* ---------- Concentração ---------- */
let concDmg = 0, concRoll = null;
const concDC = () => Math.min(30, Math.max(10, Math.floor(concDmg / 2)));
function concModal(dmg = 0) {
  if (!state.conc) return;
  concDmg = dmg; concRoll = null;
  openModal(() => {
    const r = concRoll;
    const roll = r ? `<span class="roll" style="${r.ok ? '' : 'color:var(--danger);border-color:rgba(240,124,108,.45);background:rgba(240,124,108,.1)'}">🎲 ${r.a} e ${r.b} → ${Math.max(r.a, r.b)} + ${CHAR.stats.conSave} = <b>${r.total}</b> · ${r.ok ? 'Mantida ✓' : 'Falhou ✗'}</span>` : '';
    return `${mHead('Concentração · ' + esc(SPELL[state.conc]?.name || ''), 'Teste de Concentração')}
      <div class="field" style="margin-top:14px"><label for="conc-dmg">Dano sofrido</label>
        <input id="conc-dmg" type="number" inputmode="numeric" min="0" value="${concDmg || ''}" placeholder="0"></div>
      <div class="dc-big num" id="conc-dc">CD ${concDC()}</div>
      <p class="note" style="text-align:center">Salvaguarda de Constituição <b>${sign(CHAR.stats.conSave)}</b> com <b>Vantagem</b> (Conjurador Bélico)</p>
      <div class="rolls" style="justify-content:center">${roll}</div>
      <button class="btn frost block" data-action="conc-roll">${icon('i-d20')}Rolar ${CHAR.warCaster ? '2d20 (maior)' : '1d20'} ${sign(CHAR.stats.conSave)}</button>
      <div class="m-actions"><button class="btn danger" data-action="conc-lost">Perdi a concentração</button><button class="btn gold" data-action="close">Mantive</button></div>`;
  });
}

/* ---------- Itens ---------- */
let editingItem = null;
function itemModal(id) {
  const it = id ? state.items.find(x => x.id === id) : null;
  editingItem = it ? it.id : null;
  const linked = it?.key ? SPELLS.filter(sp => sp.mat?.key === it.key).map(sp => sp.name) : [];
  openModal(() => `${mHead(it ? 'Inventário · editar' : 'Inventário · novo item', it ? esc(it.name) : 'Adicionar item')}
    <form id="item-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="f-name">Nome</label><input id="f-name" required maxlength="80" value="${it ? esc(it.name) : ''}" placeholder="Ex.: Flechas" ${it ? '' : 'autofocus'}></div>
      <div class="field"><label for="f-note">Observação (opcional)</label><input id="f-note" maxlength="160" value="${it ? esc(it.note) : ''}" placeholder="Ex.: 1d8 perfurante"></div>
      <div class="field-row">
        <div class="field"><label for="f-qty">Quantidade <small>(vazio = sem contagem)</small></label><input id="f-qty" type="number" inputmode="numeric" min="0" max="999999" value="${it ? (it.qty ?? '') : 1}"></div>
        <div class="field"><label for="f-unit">Unidade</label><input id="f-unit" maxlength="12" value="${it ? esc(it.unit || '') : ''}" placeholder="usos, un., PO…"></div>
      </div>
      <div class="field"><label for="f-cat">Categoria</label><select id="f-cat">${ITEM_CATS.map(c => `<option value="${c.id}" ${(it?.cat || 'cons') === c.id ? 'selected' : ''}>${c.t}</option>`).join('')}</select></div>
      ${linked.length ? `<p class="note">Ligado a: <b>${linked.join(', ')}</b> — descontado ao conjurar.</p>` : ''}
      <div class="m-actions">${it ? `<button type="button" class="btn danger" data-action="item-del">${icon('i-trash')}Excluir</button>` : ''}
        <button type="submit" class="btn gold">Salvar</button></div>
    </form>`);
}

function resetModal() {
  openModal(() => `${mHead('Opções', 'Restaurar ficha original?')}
    <p class="note" style="margin-top:12px">Espaços, recursos, PV e a mochila voltam aos valores iniciais da ficha. Suas <b>anotações não são apagadas</b>. Logo em seguida você ainda pode tocar em <b>Desfazer</b>.</p>
    <div class="m-actions"><button class="btn ghost" data-action="close" autofocus>Cancelar</button><button class="btn danger" data-action="reset-go">${icon('i-trash')}Restaurar</button></div>`);
}

