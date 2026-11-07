/* =====================================================================
   SUGESTÕES
   Cada pessoa vê as próprias. Quem está na lista de desenvolvedores do
   banco vê todas e pode responder.
   ===================================================================== */
const sug = { lista: null, filtro: 'nova' };
const TIPO_SUG = { ideia: 'Ideia', erro: 'Erro', regra: 'Regra errada', privacidade: 'Privacidade' };
const SIT_SUG = { nova: 'Nova', lida: 'Lida', feita: 'Feita', recusada: 'Recusada' };
const dataCurta = t => new Date(t).toLocaleDateString('pt-BR');

async function sugestoesCarregar() {
  if (!nuvem.user) return;
  const { data, error } = await nuvem.sb.from('sugestoes').select('*').order('criada_em', { ascending: false }).limit(300);
  sug.lista = error ? [] : data;
  sugestoesRender(true);
}

function cartaoSug(s) {
  const id = esc(s.id);
  if (!nuvem.dev) return `<div class="elenco"><div class="elenco-t"><b>${TIPO_SUG[s.tipo]}</b><span class="elenco-s">${SIT_SUG[s.situacao]}</span></div>
    <small>${dataCurta(s.criada_em)}</small><p class="pre">${esc(s.texto)}</p>${s.resposta ? `<p class="note">Resposta: ${esc(s.resposta)}</p>` : ''}</div>`;
  return `<div class="elenco"><div class="elenco-t"><b>${TIPO_SUG[s.tipo]}</b><span class="elenco-s">${SIT_SUG[s.situacao]}</span></div>
    <small>${esc(s.autor_nome)} · ${dataCurta(s.criada_em)}</small><p class="pre">${esc(s.texto)}</p>
    <div class="field"><label for="sg-${id}">Situação</label><select id="sg-${id}" data-sug-sit="${id}">${Object.entries(SIT_SUG).map(([k, v]) => `<option value="${k}" ${k === s.situacao ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label for="sr-${id}">Resposta ao autor</label><textarea id="sr-${id}" rows="2" maxlength="1000" data-sug-resp="${id}">${esc(s.resposta)}</textarea></div>
    <div class="m-actions"><button class="btn sm danger" data-action="sug-apagar" data-id="${id}">Apagar</button></div></div>`;
}

function sugestoesRender(carregado = false) {
  const el = $('#sugestoes-view');
  if (!el || !NUVEM_CFG) return;
  if (!nuvem.user) { sug.lista = null; el.innerHTML = '<div class="panel"><div class="panel-h"><h2>Sugestões</h2><span class="rule"></span></div><p>Entre na aba Mesas para enviar ideias, erros e correções de regras.</p></div>'; return; }
  if (!carregado && !sug.lista) sugestoesCarregar();
  const todas = sug.lista || [], lista = nuvem.dev && sug.filtro !== 'todas' ? todas.filter(s => s.situacao === sug.filtro) : todas;
  const filtros = nuvem.dev ? `<div class="nscope" role="group" aria-label="Filtrar sugestões">${[['nova', 'Novas'], ['lida', 'Lidas'], ['feita', 'Feitas'], ['recusada', 'Recusadas'], ['todas', 'Todas']].map(([k, v]) => `<button class="filter" data-action="sug-filtro" data-f="${k}" aria-pressed="${sug.filtro === k}">${v} (${k === 'todas' ? todas.length : todas.filter(s => s.situacao === k).length})</button>`).join('')}</div>` : '';
  el.innerHTML = `<div class="panel">
      <div class="panel-h"><h2>Enviar sugestão</h2><span class="rule"></span></div>
      <form id="sug-form" autocomplete="off">
        <div class="field"><label for="sg-tipo">Tipo</label><select id="sg-tipo">${Object.entries(TIPO_SUG).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label for="sg-texto">O que você gostaria?</label><textarea id="sg-texto" required minlength="3" maxlength="2000" rows="4"></textarea></div>
        <div class="m-actions"><button class="btn gold">Enviar</button></div>
      </form>
    </div>
    <div class="panel">
      <div class="panel-h"><h2>${nuvem.dev ? 'Painel do desenvolvedor' : 'Suas sugestões'}</h2><span class="rule"></span></div>
      ${filtros}
      ${sug.lista === null ? '<p class="note">Carregando…</p>' : lista.length ? `<div class="elenco-lista">${lista.map(cartaoSug).join('')}</div>` : '<p class="empty">Nada por aqui.</p>'}
    </div>`;
}

document.addEventListener('submit', async e => {
  if (e.target.id !== 'sug-form') return;
  e.preventDefault();
  const texto = $('#sg-texto').value.trim();
  if (texto.length < 3) return;
  const { error } = await nuvem.sb.from('sugestoes').insert({ autor: nuvem.user.id, tipo: $('#sg-tipo').value, texto, autor_nome: '-' });
  if (error) { toast(/limite/.test(error.message) ? 'Limite de 10 sugestões por dia' : 'Não foi possível enviar', false); return; }
  toast('Sugestão enviada. Obrigado!', false);
  await sugestoesCarregar();
});

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  if (b.dataset.action === 'sug-filtro') { sug.filtro = b.dataset.f; sugestoesRender(true); }
  if (b.dataset.action === 'sug-apagar') { await nuvem.sb.from('sugestoes').delete().eq('id', b.dataset.id); await sugestoesCarregar(); }
});

document.addEventListener('change', async e => {
  const { sugSit, sugResp } = e.target.dataset || {};
  if (!sugSit && !sugResp) return;
  const campos = sugSit ? { situacao: e.target.value } : { resposta: e.target.value };
  const { error } = await nuvem.sb.from('sugestoes').update(campos).eq('id', sugSit || sugResp);
  if (error) { toast('Não foi possível salvar', false); return; }
  Object.assign(sug.lista.find(s => s.id === (sugSit || sugResp)), campos);
  if (sugSit) sugestoesRender(true); else toast('Resposta salva', false);
});
