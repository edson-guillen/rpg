/* =====================================================================
   CABEÇALHO E EFEITOS ATIVOS
   ===================================================================== */
function renderStats() {
  const s = CHAR.stats, hpPct = Math.round(100 * state.hp / s.hpMax);
  $('#stats').innerHTML = `
    <div class="stat ${state.fx.shield ? 'boost' : ''}"><div class="lbl">CA</div><div class="val num">${ac()}</div><div class="hint">${state.fx.shield ? 'com Escudo' : 'natural'}</div></div>
    <div class="stat hp" data-action="goto-hp" role="button" tabindex="0" aria-label="Pontos de vida ${state.hp} de ${s.hpMax}. Ajustar">
      <div class="lbl">PV</div><div class="val num">${state.hp}<small>/${s.hpMax}</small></div>
      <div class="hpbar"><i style="width:${hpPct}%;background-position:${100 - hpPct}% 0"></i></div>
      <div class="hint">${state.temp ? `+${state.temp} temp.` : 'ajustar'}</div></div>
    <div class="stat ${state.fx.innate ? 'boost' : ''}"><div class="lbl">CD Magia</div><div class="val num">${dc()}</div><div class="hint">${state.fx.innate ? 'F. Inata' : 'Carisma'}</div></div>
    <div class="stat ${state.fx.innate ? 'boost' : ''}"><div class="lbl">Ataque</div><div class="val num">${sign(s.atk)}</div><div class="hint">${state.fx.innate ? 'Vantagem' : 'mágico'}</div></div>`;
  $('#substats').innerHTML = `<span>Iniciativa <b>${sign(s.init)}</b></span><span>Desloc. <b>${s.speed}</b></span><span>BP <b>${sign(s.pb)}</b></span><span>PF <b>${state.res.sp}/${RES.sp.max}</b></span><span>Salv. CON <b>${sign(s.conSave)}</b> <small>(V em conc.)</small></span>`;
}

function renderEffects() {
  const f = state.fx, out = [];
  if (state.conc) out.push(`<span class="fx" style="--c:#ffd28a">${icon('i-conc')}<span>Concentração: <b>${esc(SPELL[state.conc].name)}</b></span>
      <button class="act" data-action="conc-check">Teste</button><button class="x" data-action="conc-end" aria-label="Encerrar concentração">${icon('i-x')}</button></span>`);
  if (f.innate) out.push(`<span class="fx" style="--c:var(--frost)">${icon('i-snow')}<span><b>Feitiçaria Inata</b> · CD ${dc()} · Vantagem</span>
      <button class="x" data-action="fx-end" data-fx="innate" aria-label="Encerrar Feitiçaria Inata">${icon('i-x')}</button></span>`);
  if (f.shield) out.push(`<span class="fx" style="--c:var(--arcane)">${icon('i-shield')}<span><b>Escudo Arcano</b> · CA ${ac()}</span>
      <button class="x" data-action="fx-end" data-fx="shield" aria-label="Encerrar Escudo Arcano">${icon('i-x')}</button></span>`);
  if (f.mirror) {
    const pips = [0, 1, 2].map(i => `<button class="${i < f.mirror ? '' : 'off'}" data-action="mirror-hit" data-i="${i}" aria-label="Duplicata ${i + 1}${i < f.mirror ? ' — tocar quando for destruída' : ' destruída'}"><i></i></button>`).join('');
    out.push(`<span class="fx" style="--c:var(--silver)">${icon('i-mirror')}<span><b>Reflexos</b></span><span class="mini">${pips}</span>
      <button class="act" data-action="mirror-roll" title="Fui atingido: rolar 1d6 por duplicata">Rolar</button><button class="x" data-action="fx-end" data-fx="mirror" aria-label="Encerrar Reflexos">${icon('i-x')}</button></span>`);
  }
  $('#effects').innerHTML = out.join('');
}

/* =====================================================================
   ABA MAGIA: ESPAÇOS, FONTE DE MAGIA, LEMBRETES
   ===================================================================== */
function renderSlots() {
  $('#slots').innerHTML = LEVELS.map(l => {
    const max = CHAR.slots[l], av = avail(l), ex = state.extra[l];
    let gems = '';
    for (let i = 0; i < max; i++) gems += gem('', i >= av, 'slot', { lv: l, i }, `Espaço de ${ORD(l)} círculo ${i + 1}: ${i >= av ? 'gasto, tocar para recuperar' : 'disponível, tocar para gastar'}`);
    for (let i = 0; i < ex; i++) gems += gem('extra', false, 'slot-extra', { lv: l, i }, `Espaço criado de ${ORD(l)} círculo: tocar para gastar`);
    return `<div class="slot-row ${lvClass(l)}">
      <div class="lvl-badge">${ORD(l)}<small>CÍRC.</small></div>
      <div>
        <div class="slot-meta"><h3>${ORD(l)} Círculo</h3>
          <span class="count num">${av + ex}<small>/${max}${ex ? ` · +${ex} criado${ex > 1 ? 's' : ''}` : ''}</small></span></div>
        <div class="gems">${gems}</div>
      </div></div>`;
  }).join('');
  const total = LEVELS.reduce((a, l) => a + totalAvail(l), 0), b = $('#badge-slots');
  b.textContent = total; b.hidden = false;
  b.setAttribute('aria-label', `${total} espaços disponíveis`);
}

let spRulesOpen = false;
function renderSpHub() {
  const sp = state.res.sp, max = RES.sp.max;
  let gems = '';
  for (let i = 0; i < max; i++) gems += gem('', i >= sp, 'res-gem', { id: 'sp', i }, `Ponto de Feitiçaria ${i + 1}: ${i >= sp ? 'gasto, tocar para recuperar' : 'disponível, tocar para gastar'}`);
  const afford = CHAR.metamagic.map(m => [m.name, Math.floor(sp / m.cost)])
    .concat(LEVELS.filter(l => CHAR.createSlotCost[l]).map(l => [`Criar espaço de ${ORD(l)}`, Math.floor(sp / CHAR.createSlotCost[l])]))
    .map(([n, k]) => `<span class="afford ${k ? '' : 'off'}"><b>${k}×</b> ${n}</span>`).join('');
  const metas = CHAR.metamagic.map(m => {
    const ok = sp >= m.cost;
    return `<div class="sp-card">
      <div class="sp-card-h">${icon(m.icon)}<div><b>${m.name}</b><small>${m.en}</small></div>
        <span class="cost" aria-label="Custa ${m.cost} PF">${'<i></i>'.repeat(m.cost)}<em>${m.cost} PF</em></span></div>
      <p>${m.desc}</p>${m.when ? `<p class="when">${m.when}</p>` : ''}
      <button class="btn sm ${ok ? 'gold' : ''}" data-action="meta-use" data-id="${m.id}" ${ok ? '' : 'disabled'}>${ok ? `Usar · −${m.cost} PF` : `Faltam ${m.cost - sp} PF`}</button></div>`;
  }).join('');
  const toSp = LEVELS.map(l => {
    const n = totalAvail(l), room = sp + l <= max, ok = n > 0 && room;
    const why = !n ? `sem espaço de ${ORD(l)} disponível` : !room ? `passaria do máximo de ${max} PF` : `fica com ${sp + l} PF e ${n - 1} espaço${n - 1 === 1 ? '' : 's'} de ${ORD(l)}`;
    return `<div class="conv ${lvClass(l)}"><span class="conv-a"><span class="dot"></span>Espaço de ${ORD(l)}</span><span class="arrow">→</span>
      <span class="conv-b"><b>+${l} PF</b></span><button class="btn sm" data-action="slot-to-sp" data-lv="${l}" ${ok ? '' : 'disabled'}>Converter</button>
      <small class="why">${why}</small></div>`;
  }).join('');
  const toSlot = LEVELS.filter(l => CHAR.createSlotCost[l]).map(l => {
    const c = CHAR.createSlotCost[l], ok = sp >= c;
    return `<div class="conv ${lvClass(l)}"><span class="conv-a"><b>${c} PF</b></span><span class="arrow">→</span>
      <span class="conv-b"><span class="dot"></span>Espaço de ${ORD(l)}</span><button class="btn sm" data-action="sp-to-slot" data-lv="${l}" ${ok ? '' : 'disabled'}>Criar</button>
      <small class="why">${ok ? `fica com ${sp - c} PF · espaço dourado até o Descanso Longo` : `faltam ${c - sp} PF`}</small></div>`;
  }).join('');
  const log = state.spLog || [];
  $('#sp-hub').innerHTML = `
    <div class="panel-h"><h2>Pontos de Feitiçaria</h2><span class="rule"></span><span class="aside">Fonte de Magia · recupera no Descanso Longo</span></div>
    <div class="sp-top">
      <div class="sp-meter">
        <div class="sp-big num" id="fom-sp" aria-live="polite"><b>${sp}</b><small>/${max} PF</small></div>
        <div class="gems">${gems}</div>
        <div class="ctl"><button class="step" data-action="res-step" data-id="sp" data-d="-1" ${sp ? '' : 'disabled'} aria-label="Gastar 1 Ponto de Feitiçaria">−</button>
          <button class="step" data-action="res-step" data-id="sp" data-d="1" ${sp < max ? '' : 'disabled'} aria-label="Recuperar 1 Ponto de Feitiçaria">+</button></div>
      </div>
      <div><p class="sub-h">Com ${sp} PF você pode</p><div class="afford-list">${afford}</div></div>
    </div>
    <div class="sp-grid">
      <section><p class="sub-h">Metamagia · uma por magia</p><div class="sp-cards">${metas}</div></section>
      <section>
        <p class="sub-h">Espaço → PF <small>(sem ação)</small></p>${toSp}
        <p class="sub-h">PF → Espaço <small>(Ação Bônus)</small></p>${toSlot}
        <p class="note" style="margin-top:6px">Espaço de 3º círculo (5 PF) só a partir do nível 5.</p>
      </section>
    </div>
    <div class="sp-foot">
      <details class="passive sp-rules" ${spRulesOpen ? 'open' : ''}><summary>Regras rápidas (2024)</summary><ul>
        <li>Máximo de <b>${max} PF</b>; você não pode passar disso.</li>
        <li><b>Espaço → PF:</b> sem ação; ganha PF igual ao círculo do espaço.</li>
        <li><b>PF → Espaço:</b> Ação Bônus; 1º = ${CHAR.createSlotCost[1]} PF, 2º = ${CHAR.createSlotCost[2]} PF. Somem no Descanso Longo.</li>
        <li>Só <b>uma Metamagia</b> por magia.</li>
        <li><b>Magia Sutil</b> também dispensa os componentes do inventário (teia, pimenta, mel, lã), mas não o diamante de 50 PO.</li>
        <li>Recupera tudo no <b>Descanso Longo</b>. No nível 5, a <i>Restauração Feiticeira</i> devolve até 2 PF num Descanso Curto.</li></ul></details>
      <div class="sp-log"><p class="sub-h">Histórico de PF</p>${log.length
        ? `<ul>${log.map(e => `<li><span class="t num">${esc(e.t)}</span><b class="num ${e.d > 0 ? 'up' : 'down'}">${e.d > 0 ? '+' : '−'}${Math.abs(e.d)}</b><span class="x" title="${esc(e.txt)}">${esc(e.txt)}</span><span class="s num">${e.sp}/${max}</span></li>`).join('')}</ul>`
        : '<p class="note">Nenhum ponto gasto ou recuperado ainda.</p>'}</div>
    </div>`;
}

function renderReminders() {
  const sp = state.res.sp, s1 = totalAvail(1);
  $('#reminders').innerHTML = `<div class="turn">
    <div class="tr"><span class="tk a">Ação</span><p>Magia ou truque: ataque <b>${sign(CHAR.stats.atk)}</b>${state.fx.innate ? ' <b>com Vantagem</b>' : ''} ou <b>CD ${dc()}</b>. <i>Talho Mental</i> 1d6 (−1d4) · <i>Explosão Elemental</i> 1d8 · <i>Faca de Gelo</i> 1d10 + 2d6 · <i>Golpe Certeiro</i> 1d8 + 4.</p></div>
    <div class="tr"><span class="tk b">Ação Bônus</span><p><i>Salto das Nuvens</i> (<b>${state.res.jaunt}/2</b>) · <i>Feitiçaria Inata</i> (<b>${state.res.innate}/2</b>) · <i>Magia Acelerada</i> (2 PF — você tem <b>${sp}</b>) · <i>Sopro de Dragão</i>.</p></div>
    <div class="tr"><span class="tk m">Movimento</span><p><b>10,5 m</b>. O Salto das Nuvens teleporta 9 m sem provocar ataques de oportunidade.</p></div>
    <div class="tr"><span class="tk r">Reação</span><p><i>Escudo Arcano</i> → <b>CA 21</b> (${s1} espaço${s1 === 1 ? '' : 's'} de 1º) · <b>Magia Reativa</b> quando alguém provoca seu ataque de oportunidade.</p></div>
  </div>
  <ul class="rules">
    <li><b>Um espaço de magia por turno</b> (2024): magia acelerada na Ação Bônus deixa a Ação só para truques (ex.: <i>Teia</i> acelerada + <i>Talho Mental</i>).</li>
    <li><b>Concentração:</b> salvaguarda de CON <b>+4 com Vantagem</b> contra CD 10 ou metade do dano sofrido (o maior).</li>
    <li>Truques e magias <b>não somam Carisma ao dano</b> no nível 4 — só <i>Golpe Certeiro</i> e as armas naturais de <i>Alterar-se</i>.</li></ul>`;
}

