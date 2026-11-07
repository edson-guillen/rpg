/* =====================================================================
   SALVAGUARDAS CONTRA MORTE (Livro do Jogador 2024, cap. 1)
   Dano a 0 PV soma uma falha; acerto crítico soma duas. Três sucessos
   estabilizam, três falhas matam. O resultado 1 conta duas falhas e o 20
   devolve 1 PV. Dano Maciço mata na hora.
   ===================================================================== */
const morteVazia = () => ({ s: 0, f: 0, estavel: false, morto: false, causa: '' });

function morrer(st, causa) {
  st.morte = { ...morteVazia(), morto: true, causa, f: 3 };
  st.hp = 0; st.temp = 0; st.conc = null;
}

function somaFalhas(st, n, causa) {
  st.morte.estavel = false;
  st.morte.f = Math.min(3, st.morte.f + n);
  if (st.morte.f >= 3) morrer(st, causa);
}

/** Aplica o d20 e devolve o texto do resultado. */
function aplicaSalvaguarda(st, v) {
  if (v === 20) { st.hp = 1; st.morte = morteVazia(); return `20 natural: ${activeChar().name} recupera 1 PV`; }
  if (v < 10) { somaFalhas(st, v === 1 ? 2 : 1, 'Falhou em três Salvaguardas contra Morte'); return st.morte.morto ? `${v}: terceira falha` : `${v}: ${v === 1 ? 'duas falhas' : 'falha'}`; }
  st.morte.s++;
  if (st.morte.s >= 3) { st.morte = { ...morteVazia(), estavel: true }; return `${v}: terceiro sucesso, personagem Estável`; }
  return `${v}: sucesso`;
}

/** Dano recebido depois dos PV temporários. hp0 é o PV antes do golpe. */
function danoEmMorte(st, hp0, dano, critico = false) {
  if (st.morte.morto || dano <= 0) return;
  const max = CHAR.stats.hpMax;
  if (hp0 === 0) {
    if (dano >= max) morrer(st, 'Dano igual ou maior que os PV máximos');
    else somaFalhas(st, critico ? 2 : 1, 'Dano com 0 Pontos de Vida');
  } else if (st.hp === 0 && dano - hp0 >= max) morrer(st, 'Dano Maciço');
}

/** Commit que dispara a cena quando o personagem acaba de morrer. */
function commitMorte(label, fn) {
  const antes = state.morte.morto, r = commit(label, fn);
  if (r && !antes && state.morte.morto) cenaMorte();
  return r;
}

function painelMorte() {
  const m = state.morte;
  if (m.morto) return `<div class="morte-box morto">
    <div class="panel-h"><h2>Morto</h2><span class="rule"></span></div>
    <p class="note">${esc(m.causa || 'Causa não registrada.')}</p>
    <div class="m-actions"><button class="btn" data-action="morte-modal">Registrar causa</button><button class="btn" data-action="morte-reviver">Reviver com 1 PV</button><button class="btn gold" data-action="morte-novo">${icon('i-plus')}Novo personagem</button></div></div>`;
  if (state.hp) return '';
  if (m.estavel) return `<div class="morte-box">
    <div class="panel-h"><h2>Estável</h2><span class="rule"></span></div>
    <p class="note">Inconsciente, sem Salvaguardas. Sem cura, recupera 1 PV depois de 1d4 horas. Se sofrer dano, volta a fazer Salvaguardas.</p>
    <div class="m-actions"><button class="btn" data-action="morte-recupera">Recuperou 1 PV</button></div></div>`;
  const trilha = (tipo, nome, n) => `<div class="morte-trilha ${tipo}"><span>${nome}</span>${[0, 1, 2].map(i => gem('morte-gem', i >= n, 'morte-marca', { t: tipo, i }, `${nome} ${i + 1}: ${i < n ? 'marcado' : 'vazio'}`)).join('')}</div>`;
  return `<div class="morte-box">
    <div class="panel-h"><h2>Salvaguardas contra Morte</h2><span class="rule"></span><span class="aside">no início do turno</span></div>
    ${trilha('s', 'Sucessos', m.s)}${trilha('f', 'Falhas', m.f)}
    <div class="morte-ctrl">
      <button class="btn gold" data-action="morte-rolar">${icon('i-d20')}Rolar d20</button>
      <input id="morte-val" type="number" inputmode="numeric" min="1" max="20" placeholder="1 a 20" aria-label="Valor do dado físico">
      <button class="btn" data-action="morte-dado">Usar dado</button>
    </div>
    <p class="note">10 ou mais é sucesso. 1 conta duas falhas. 20 devolve 1 PV. O campo Dano acima já soma uma falha.</p>
    <div class="m-actions"><button class="btn danger" data-action="morte-critico">Acerto crítico: 2 falhas</button><button class="btn" data-action="morte-estavel">Estabilizado</button></div>
  </div>`;
}

function chipMorte() {
  const m = state.morte;
  if (m.morto) return `<span class="fx" style="--c:#ff8a8a">${icon('i-heart')}<span><b>Morto</b></span><button class="act" data-action="goto-hp">Ver</button></span>`;
  if (state.hp) return '';
  return `<span class="fx" style="--c:#ff8a8a">${icon('i-heart')}<span><b>${m.estavel ? 'Estável' : '0 PV'}</b>${m.estavel ? '' : ` · ${m.s} sucessos, ${m.f} falhas`}</span><button class="act" data-action="goto-hp">${m.estavel ? 'Ver' : 'Testar'}</button></span>`;
}

function morteModal() {
  const c = activeChar();
  openModal(() => `${mHead('Fim da jornada', `${esc(c.name)} morreu`)}
    <form id="morte-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="morte-causa">Como foi?</label><textarea id="morte-causa" rows="3" maxlength="300">${esc(state.morte.causa)}</textarea></div>
      <p class="note">A ficha continua guardada. Magias como Revivificar devolvem o personagem por Reviver com 1 PV, na aba Recursos.</p>
      <div class="m-actions"><button class="btn">Salvar</button><button type="button" class="btn gold" data-action="morte-novo">${icon('i-plus')}Novo personagem</button></div>
    </form>`);
}

function cenaMorte() {
  const modo = fxMode();
  if (modo === 'off') { morteModal(); return; }
  const el = document.createElement('div');
  el.className = `cena-morte ${modo}`; el.setAttribute('role', 'status');
  el.innerHTML = `<div><i>${icon('i-heart')}</i><b>${esc(activeChar().name)}</b><span>caiu</span></div>`;
  let fim = false;
  const fecha = () => { if (fim) return; fim = true; el.remove(); morteModal(); };
  el.addEventListener('click', fecha);
  document.body.appendChild(el);
  setTimeout(fecha, modo === 'full' ? 3000 : 1200);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const ds = b.dataset;
  switch (ds.action) {
    case 'morte-rolar': { const v = d(20); let t = ''; commitMorte(`Salvaguarda contra Morte: ${v}`, st => { t = aplicaSalvaguarda(st, v); }); toast(t, true); break; }
    case 'morte-dado': {
      const i = $('#morte-val'), v = Math.round(+i.value);
      if (!(v >= 1 && v <= 20)) { toast('Digite um valor de 1 a 20', false); i.focus(); break; }
      let t = ''; commitMorte(`Salvaguarda contra Morte: ${v}`, st => { t = aplicaSalvaguarda(st, v); }); toast(t, true); break;
    }
    case 'morte-critico': commitMorte('Acerto crítico: duas falhas', st => { somaFalhas(st, 2, 'Acerto crítico com 0 Pontos de Vida'); }); break;
    case 'morte-marca': commitMorte(null, st => {
      const k = ds.t, i = +ds.i, n = st.morte[k] === i + 1 ? i : i + 1;
      st.morte[k] = n;
      if (k === 'f' && n >= 3) morrer(st, 'Falhou em três Salvaguardas contra Morte');
      if (k === 's' && n >= 3) st.morte = { ...morteVazia(), estavel: true };
    }); break;
    case 'morte-estavel': commit('Personagem Estável', st => { st.morte = { ...morteVazia(), estavel: true }; }); break;
    case 'morte-recupera': commit('+1 PV', st => { st.hp = 1; }); break;
    case 'morte-reviver': commit(`${activeChar().name} voltou com 1 PV`, st => { st.morte = morteVazia(); st.hp = 1; }); closeModal(); break;
    case 'morte-modal': morteModal(); break;
    case 'morte-novo': closeModal(); if (typeof mesaDeSubstituicao === 'function') mesaDeSubstituicao(activeChar().id); newCharModal(); break;
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'morte-form') return;
  e.preventDefault();
  const causa = $('#morte-causa').value.trim().slice(0, 300);
  commit(null, st => { st.morte.causa = causa; });
  closeModal();
});
