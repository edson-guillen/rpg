/* =====================================================================
   ABA PERSONAGEM — identidade, origem, talentos e características
   ===================================================================== */
const SOREN_IDENTITY = {
  concept: 'Manipulação, ilusões e controle de campo, com poder mágico crescente.', alignment: 'Caótico Neutro',
  appearance: 'Golias alto e esguio, cabelos castanhos e olhos verdes. Leva um cetro com cristal como foco arcano.',
  story: 'Herdeiro da Casa Frostgaard, exilado depois que a família foi acusada de traição. Viaja para descobrir quem armou a queda da casa e de onde vem o poder dracônico que desperta nele.'
};
const identityOf = c => c.identity || (c.identity = c.template === 'soren' ? { ...SOREN_IDENTITY } : {});

function renderPersonagem() {
  const c = activeChar(), b = buildOf(c), id = identityOf(c), n = b.level, sp = speciesById(b.speciesId), bg = backgroundById(b.backgroundId);
  const F = (k, label, tag = 'input') => tag === 'input'
    ? `<div class="field"><label for="id-${k}">${label}</label><input id="id-${k}" data-id-f="${k}" maxlength="120" value="${esc(id[k] || '')}"></div>`
    : `<div class="field"><label for="id-${k}">${label}</label><textarea id="id-${k}" data-id-f="${k}" rows="4" maxlength="4000">${esc(id[k] || '')}</textarea></div>`;
  const lin = sp?.lineages?.[b.lineage];
  const tracos = sp ? `<ul class="plist">${sp.traits.map(([t, d]) => `<li><b>${esc(t)}.</b> ${esc(d)}</li>`).join('')}${lin ? `<li><b>${esc(lin[0])}.</b> ${esc(lin[1])}</li>` : ''}</ul>` : '<p class="note">Espécie ainda não definida.</p>';
  const feats = b.feats.map(featById).filter(Boolean);
  const feitos = featuresOf(b).filter(f => f[0] <= n), proximos = featuresOf(b).filter(f => f[0] > n);
  const linha = (f, on) => `<li class="tl ${on ? 'on' : ''}"><span class="tl-n">${f[0]}</span><div><b>${esc(f[1])}</b> <small>${esc(f[3])}</small><p>${esc(f[2])}</p></div></li>`;
  const planos = Object.entries(b.planned || {}).sort((x, y) => x[1] - y[1]).map(([fid, lv]) => { const f = featById(fid); return f ? `<li><b>Nível ${lv}:</b> ${esc(f.name)} <button class="btn sm ghost" data-action="feat-unplan" data-id="${esc(fid)}">Tirar</button></li>` : ''; }).join('');
  $('#personagem').innerHTML = `
    <div class="panel"><div class="panel-h"><h2>Identidade</h2><span class="rule"></span></div>
      <div class="field"><label for="id-name">Nome</label><input id="id-name" data-id-f="name" maxlength="60" value="${esc(c.name)}"></div>
      ${F('concept', 'Conceito')}${F('alignment', 'Alinhamento')}${F('appearance', 'Aparência', 'textarea')}${F('story', 'História', 'textarea')}
    </div>
    <div class="panel"><div class="panel-h"><h2>Nível ${n}</h2><span class="rule"></span></div>
      <p class="note">${esc(CHAR.subText)}</p>
      ${c.template === 'soren' ? '' : `<div class="field-row"><div class="field"><label for="id-armor">Armadura vestida</label><select id="id-armor"><option value="">Nenhuma</option>${ARMADURAS.map(a => `<option ${b.armor === a[0] ? 'selected' : ''}>${esc(a[0])}</option>`).join('')}</select></div><div class="field"><label class="ck"><input type="checkbox" id="id-shield" ${b.shield ? 'checked' : ''}>Escudo</label></div></div>`}
      <div class="m-actions"><button class="btn gold" data-action="lv-open" ${n >= 20 ? 'disabled' : ''}>${icon('i-plus')}${n >= 20 ? 'Nível máximo' : 'Subir de nível'}</button>${c.history?.length ? `<button class="btn ghost" data-action="lv-undo">Desfazer último nível</button>` : ''}</div>
    </div>
    <div class="panel"><div class="panel-h"><h2>Espécie</h2><span class="rule"></span><span class="aside">${esc(sp ? sp.name + (lin ? ' · ' + lin[0] : '') : '—')}</span></div>${tracos}</div>
    <div class="panel"><div class="panel-h"><h2>Antecedente</h2><span class="rule"></span><span class="aside">${esc(bg?.name || '—')}</span></div>
      ${bg ? `<p>${esc(bg.desc || '')}</p><ul class="plist"><li><b>Perícias:</b> ${esc((bg.skills || []).join(', '))}</li>${bg.tool ? `<li><b>Ferramenta:</b> ${esc(bg.tool)}</li>` : ''}<li><b>Talento:</b> ${esc(featById(bg.feat)?.name || bg.feat || '—')}</li></ul>` : '<p class="note">Antecedente ainda não definido.</p>'}</div>
    <div class="panel"><div class="panel-h"><h2>Talentos</h2><span class="rule"></span><button class="btn sm" data-action="feat-catalog">Catálogo</button></div>
      ${feats.length ? `<ul class="plist">${feats.map(f => `<li><b>${esc(f.name)}.</b> ${esc(f.desc)}</li>`).join('')}</ul>` : '<p class="note">Nenhum talento ainda.</p>'}
      ${planos ? `<h4 class="ed-h">Planejados</h4><ul class="plist">${planos}</ul>` : ''}</div>
    <div class="panel"><div class="panel-h"><h2>Características</h2><span class="rule"></span><button class="btn sm" data-action="comp-open">Compêndio</button><span class="aside">${feitos.length} obtidas · ${proximos.length} por vir</span></div>
      <ul class="timeline">${feitos.map(f => linha(f, true)).join('')}${proximos.map(f => linha(f, false)).join('')}</ul></div>`;
}

function featCatalog() {
  const c = activeChar(), b = buildOf(c);
  openModal(() => {
    const lista = allFeats().filter(f => !b.feats.includes(f.id) && f.id !== 'asi' && f.cat !== 'estilo');
    const grupos = [['origem', 'Talentos de origem'], ['geral', 'Talentos gerais'], ['dadiva', 'Dádivas épicas'], [undefined, 'Criados por você']];
    return `${mHead('Catálogo', 'Talentos para o futuro')}
      ${grupos.map(([cat, nome]) => { const fs = lista.filter(f => f.cat === cat); return fs.length ? `<h4 class="ed-h">${nome}</h4><div class="feat-list">${fs.map(f => `<div class="feat"><div><b>${esc(f.name)}</b>${f.min ? ` <small>nível ${f.min}+</small>` : ''}${f.pre ? ` <small>${esc(f.pre)}</small>` : ''}<p>${esc(String(f.desc).slice(0, 220))}</p></div>
        <label class="lf"><span>Planejar</span><select data-plan="${esc(f.id)}"><option value="">—</option>${[4, 8, 12, 16, 19].filter(l => l > b.level && l >= (f.min || 0)).map(l => `<option value="${l}" ${b.planned?.[f.id] === l ? 'selected' : ''}>Nível ${l}</option>`).join('')}</select></label></div>`).join('')}</div>` : ''; }).join('')}
      <form id="feat-form" autocomplete="off" style="margin-top:14px"><h4 class="ed-h">Criar talento</h4>
        <div class="field"><label for="ft-name">Nome</label><input id="ft-name" required maxlength="60"></div>
        <div class="field"><label for="ft-desc">Descrição</label><textarea id="ft-desc" rows="2" maxlength="500"></textarea></div>
        <button class="btn sm gold">Adicionar ao catálogo</button></form>`;
  });
}

let idTimer = null;
document.addEventListener('input', e => {
  const k = e.target.dataset?.idF;
  if (!k) return;
  const c = activeChar();
  if (k === 'name') c.name = e.target.value.trim() || c.name; else identityOf(c)[k] = e.target.value;
  clearTimeout(idTimer);
  idTimer = setTimeout(() => { persistStore(); renderHero(); renderNotesScope(); }, 250);
});
document.addEventListener('change', e => {
  if (e.target.id === 'id-armor' || e.target.id === 'id-shield') {
    const c = activeChar(), b = buildOf(c);
    if (e.target.id === 'id-armor') b.armor = e.target.value || null; else b.shield = e.target.checked;
    bindSheet(c); save(); render();
    return;
  }
  const fid = e.target.dataset?.plan;
  if (fid === undefined) return;
  const b = buildOf(activeChar());
  b.planned = b.planned || {};
  if (e.target.value) b.planned[fid] = +e.target.value; else delete b.planned[fid];
  persistStore(); renderPersonagem();
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.action === 'feat-catalog') featCatalog();
  if (b.dataset.action === 'feat-unplan') { delete buildOf(activeChar()).planned[b.dataset.id]; persistStore(); renderPersonagem(); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'feat-form') return;
  e.preventDefault();
  const name = $('#ft-name').value.trim();
  if (!name) return;
  store.library.feats = [...(store.library.feats || []), { id: newId('f-'), name, desc: $('#ft-desc').value.trim(), src: 'minha' }];
  persistStore(); modalRefresh?.(); toast(`${name} adicionado ao catálogo`, false);
});

/* =====================================================================
   COMPÊNDIO — classes, subclasses, itens e o que veio da biblioteca pessoal
   ===================================================================== */
let compFiltro = '', compAba = 'classes';
function compEntradas() {
  const P = privateRaw || {}, q = norm(compFiltro);
  const inteiro = (cl, sub, nome) => (P.caracteristicas || []).find(f => f.classe === cl && f.sub === sub && f.nome === nome)?.texto;
  const abas = {
    classes: Object.entries(CLASSES).flatMap(([id, C]) => [{ t: C.name, s: `d${C.hd} · ${C.armadura}${C.fonte ? ' · ' + C.fonte : ''}`, itens: C.feats.map(f => [f[0], f[1], inteiro(id, null, f[1]) || f[2]]) }, ...Object.entries(C.subs).map(([k, s]) => ({ t: s.name, s: C.name, itens: s.feats.map(f => [f[0], f[1], inteiro(id, k, f[1]) || f[2]]) }))]),
    antigas: Object.entries((P.subclassesAntigas || []).reduce((a, f) => { (a[f.sub] = a[f.sub] || []).push(f); return a; }, {})).map(([sub, fs]) => ({ t: sub, s: 'Anterior a 2024', itens: fs.map(f => [f.nivel, f.nome, f.texto]) })),
    itens: (P.itens || []).map(x => ({ t: x.nome, s: x.tipo, itens: [['', '', x.texto]], item: 1 })),
    armas: ARMAS.map(a => ({ t: a[0], s: `${a[1]} ${a[2]} · ${a[3] || 'sem propriedades'} · Maestria: ${a[4]}`, itens: [], arma: 1 }))
  };
  const lista = abas[compAba] || [];
  return q ? lista.filter(e => norm(e.t + ' ' + e.s + ' ' + e.itens.map(i => i[1] + ' ' + i[2]).join(' ')).includes(q)) : lista;
}
function compendio() {
  openModal(() => {
    const abas = [['classes', 'Classes'], ['armas', 'Armas'], ['antigas', 'Subclasses antigas'], ['itens', 'Itens mágicos']], l = compEntradas();
    return `${mHead('Consulta', 'Compêndio')}
      <div class="ck-row">${abas.map(([k, n]) => `<button class="btn sm ${compAba === k ? 'gold' : ''}" data-action="comp-aba" data-a="${k}">${n}</button>`).join('')}</div>
      <div class="field"><label for="comp-q">Buscar</label><input id="comp-q" value="${esc(compFiltro)}"></div>
      <p class="note">${l.length} resultado(s).${privateRaw ? '' : ' Importe a biblioteca pessoal para ver os textos integrais, as subclasses antigas e os itens mágicos.'}</p>
      ${l.slice(0, 60).map((e, i) => `<details class="passive"><summary>${esc(e.t)} <small>${esc(e.s)}</small></summary>${e.itens.length ? `<ul>${e.itens.map(f => `<li>${f[0] ? `<b>${f[0]} · ${esc(f[1])}.</b> ` : ''}${esc(f[2])}</li>`).join('')}</ul>` : ''}${e.item || e.arma ? `<button class="btn sm" data-action="comp-add" data-n="${esc(e.t)}" data-c="${e.arma ? 'arma' : 'equip'}">Pôr na mochila</button>` : ''}</details>`).join('')}
      <div class="m-actions"><button class="btn gold" data-action="close">Fechar</button></div>`;
  });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.action === 'comp-open') compendio();
  else if (b.dataset.action === 'comp-aba') { compAba = b.dataset.a; modalRefresh?.(); }
  else if (b.dataset.action === 'comp-add') {
    const nome = b.dataset.n, cat = b.dataset.c;
    commit(`${nome} na mochila`, st => { st.items.push({ id: 'it' + Date.now(), name: nome, note: '', qty: 1, cat, unit: '' }); });
    const c = activeChar(); bindSheet(c); render();
  }
});
document.addEventListener('input', e => { if (e.target.id === 'comp-q') { compFiltro = e.target.value; const p = e.target.selectionStart; modalRefresh?.(); const n = $('#comp-q'); n?.focus(); n?.setSelectionRange(p, p); } });
