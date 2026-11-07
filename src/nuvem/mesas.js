/* =====================================================================
   CAMPANHAS
   Fora da própria ficha, a mesa só enxerga nome e situação. O banco
   garante isso: a tela apenas mostra o que ele entrega.
   ===================================================================== */
const mesas = { lista: null, meus: [], aberta: null, det: null, carregando: false, erro: null, destino: null, ordem: 0 };
const ERRO_MESA = {
  senha: 'Senha incorreta.', codigo: 'Código não encontrado. Confira com o mestre.', muitas_tentativas: 'Muitas tentativas. Espere 15 minutos.', cheia: 'Esta campanha está cheia.', sem_login: 'Entre com sua conta primeiro.',
  ja_tem_ativo: 'Você já tem um personagem ativo nesta campanha.', em_outra_mesa: 'Este personagem já está em outra campanha.', personagem_morto: 'Personagem morto: reviva-o na aba Recursos ou use outro.', personagem_inexistente: 'Este personagem ainda não subiu para a conta. Tente de novo em instantes.',
  senha_invalida: 'A senha precisa ter de 4 a 72 caracteres.', sem_nome: 'Dê um nome à campanha.', limite: 'Você chegou ao limite de 30 campanhas.'
};
const erroMesa = e => { const m = e?.message || e || ''; return ERRO_MESA[Object.keys(ERRO_MESA).find(k => m.includes(k))] || 'Não foi possível concluir. Tente de novo.'; };
const linkMesa = c => `${location.origin}${location.pathname}?c=${c}`;
const codigoFmt = c => `${c.slice(0, 5)}-${c.slice(5)}`;
const SITUACAO = { ativo: 'Em jogo', morto: 'Morto', saiu: 'Fora da mesa' };

async function mesasCarregar() {
  if (!nuvem.user) return;
  mesas.carregando = true;
  const ordem = ++mesas.ordem;
  const [camp, meus] = await Promise.all([
    nuvem.sb.from('campanhas').select('id,nome,descricao,mestre,tem_senha,participantes(count)').order('criada_em', { ascending: false }),
    nuvem.sb.from('elenco').select('id,campanha_id,personagem_id,nome,situacao,causa').eq('jogador', nuvem.user.id)
  ]);
  if (ordem !== mesas.ordem) return;
  mesas.carregando = false;
  mesas.erro = camp.error ? 'Não foi possível carregar as campanhas.' : null;
  mesas.lista = camp.data || [];
  mesas.meus = meus.data || [];
  seguirSituacao();
  if (mesas.aberta) await mesaCarregar(mesas.aberta); else mesasRender();
}

/* O mestre pode declarar a morte ou desfazê-la: a ficha acompanha, se não houver edição por enviar. */
function seguirSituacao() {
  let mudou = false;
  for (const e of mesas.meus) {
    const c = store.characters.find(x => x.id === e.personagem_id);
    if (!c || c.rascunho || hashDe(c) !== c.nh || e.situacao === 'saiu') continue;
    const morto = !!(c.id === store.activeId ? state.morte : c.state?.morte)?.morto;
    if ((e.situacao === 'morto') === morto) continue;
    const m = e.situacao === 'morto' ? { ...morteVazia(), morto: true, f: 3, causa: e.causa || 'Declarado pelo mestre' } : morteVazia(), hp = e.situacao === 'morto' ? 0 : 1;
    if (c.id === store.activeId) { state.morte = m; state.hp = hp; save(); render(); }
    else c.state = { ...(c.state || {}), morte: m, hp };
    mudou = true;
  }
  if (mudou) persistStore();
}

async function mesaCarregar(id) {
  const ordem = ++mesas.ordem;
  const [c, part, elenco, notas] = await Promise.all([
    nuvem.sb.from('campanhas').select('*').eq('id', id).maybeSingle(),
    nuvem.sb.from('participantes').select('user_id,papel').eq('campanha_id', id),
    nuvem.sb.from('elenco').select('*').eq('campanha_id', id).order('entrou_em'),
    nuvem.sb.from('anotacoes').select('*').eq('campanha_id', id).order('atualizado_em', { ascending: false })
  ]);
  if (ordem !== mesas.ordem) return;
  if (!c.data) { mesas.aberta = null; mesas.det = null; toast('Você não participa mais desta campanha', false); await mesasCarregar(); return; }
  const ids = (part.data || []).map(p => p.user_id);
  const { data: perfis } = await nuvem.sb.from('perfis').select('id,nome').in('id', ids);
  mesas.det = { c: c.data, part: part.data || [], elenco: elenco.data || [], notas: notas.data || [], nomes: Object.fromEntries((perfis || []).map(p => [p.id, p.nome])) };
  mesasRender();
}

const digitando = () => document.activeElement?.closest?.('#mesas-view') && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

function vistaLogin() {
  return `<div class="panel mesa-intro">
    <div class="panel-h"><h2>Mesas</h2><span class="rule"></span></div>
    ${mesas.erro ? `<p class="note">${esc(mesas.erro)}</p>` : ''}
    <p>Entre com o Google para guardar suas fichas na conta, criar campanhas e jogar com seus amigos.</p>
    <p class="note">Sem entrar, o app continua funcionando e salva apenas neste navegador.</p>
    <div class="m-actions"><button class="btn gold" data-action="nuvem-login" ${nuvem.sb ? '' : 'disabled'}>Entrar com Google</button></div>
  </div>`;
}

function contaHtml() {
  return `<div class="panel mesa-conta">
    <div><b>${esc(nuvem.perfil?.nome || 'Sua conta')}</b><small id="nuvem-status">${nuvem.estado === 'enviando' ? 'Salvando…' : 'Fichas salvas na sua conta'}</small></div>
    <button class="btn sm" data-action="nuvem-conta">Conta</button>
  </div>`;
}

function vistaLista() {
  const rascunho = activeChar().rascunho, l = mesas.lista;
  const cards = (l || []).map(c => {
    const meu = mesas.meus.find(e => e.campanha_id === c.id && e.situacao === 'ativo'), mestre = c.mestre === nuvem.user.id, n = c.participantes?.[0]?.count || 1;
    return `<button class="mesa-card" data-action="mesa-abrir" data-id="${esc(c.id)}">
      <b>${esc(c.nome)}</b>
      <small>${mestre ? 'Você é o mestre' : meu ? `Jogando com ${esc(meu.nome)}` : 'Sem personagem ativo'} · ${n} ${n === 1 ? 'participante' : 'participantes'}</small>
    </button>`;
  }).join('');
  return `${contaHtml()}
    ${rascunho ? `<div class="panel"><p>Você ainda não tem personagem. Crie o primeiro ou importe um arquivo .json pelo menu de opções.</p><div class="m-actions"><button class="btn gold" data-action="char-new">${icon('i-plus')}Criar personagem</button></div></div>` : ''}
    <div class="panel">
      <div class="panel-h"><h2>Suas campanhas</h2><span class="rule"></span></div>
      ${mesas.erro ? `<p class="note">${esc(mesas.erro)}</p>` : ''}
      ${l === null ? '<p class="note">Carregando…</p>' : cards ? `<div class="mesa-lista">${cards}</div>` : '<p class="empty">Nenhuma campanha ainda.</p>'}
      <div class="m-actions"><button class="btn gold" data-action="mesa-criar">${icon('i-plus')}Criar campanha</button><button class="btn" data-action="mesa-entrar">Entrar com código</button></div>
    </div>`;
}

function cartaoElenco(e, d, mestre) {
  const nota = d.notas.find(n => n.autor === nuvem.user.id && n.alvo === e.id), meu = e.jogador === nuvem.user.id, id = esc(e.id);
  const acoesMestre = mestre ? `<div class="m-actions">${e.situacao === 'ativo' ? `<button class="btn sm danger" data-action="mesa-morte" data-id="${id}">Declarar morte</button>` : e.situacao === 'morto' ? `<button class="btn sm" data-action="mesa-reverter" data-id="${id}">Desfazer morte</button>` : ''}</div>` : '';
  return `<div class="elenco ${e.situacao}">
    <div class="elenco-t"><b>${esc(e.nome)}</b><span class="elenco-s">${SITUACAO[e.situacao]}</span></div>
    <small>${meu ? 'Seu personagem' : `Jogador: ${esc(d.nomes[e.jogador] || 'saiu da mesa')}`}</small>
    ${e.situacao === 'morto' && e.causa ? `<p class="note">${esc(e.causa)}</p>` : ''}
    ${meu ? '' : `<div class="field"><label for="an-${id}">Suas anotações, só você lê</label><textarea id="an-${id}" rows="2" maxlength="20000" data-nota-alvo="${id}" data-nota="${esc(nota?.id || '')}">${esc(nota?.texto || '')}</textarea></div>`}
    ${acoesMestre}
  </div>`;
}

function blocoMeuPersonagem(d) {
  const meu = d.elenco.find(e => e.jogador === nuvem.user.id && e.situacao === 'ativo');
  if (meu) {
    const local = store.characters.some(c => c.id === meu.personagem_id);
    return `<div class="panel"><div class="panel-h"><h2>Seu personagem</h2><span class="rule"></span></div>
      <p><b>${esc(meu.nome)}</b></p>
      <div class="m-actions">${local ? `<button class="btn gold" data-action="mesa-ficha" data-id="${esc(meu.personagem_id)}">Abrir ficha</button>` : ''}<button class="btn" data-action="mesa-retirar" data-id="${esc(meu.id)}">Retirar da campanha</button></div></div>`;
  }
  const emUso = new Set(mesas.meus.filter(e => e.situacao === 'ativo').map(e => e.personagem_id));
  const livres = store.characters.filter(c => !c.rascunho && !emUso.has(c.id) && !(c.id === store.activeId ? state.morte : c.state?.morte)?.morto);
  const caiu = d.elenco.some(e => e.jogador === nuvem.user.id && e.situacao === 'morto');
  return `<div class="panel"><div class="panel-h"><h2>${caiu ? 'Volte para a mesa' : 'Escolha seu personagem'}</h2><span class="rule"></span></div>
    ${caiu ? '<p class="note">Seu personagem caiu. Traga outro para continuar nesta campanha.</p>' : ''}
    ${livres.length ? `<div class="field"><label for="mesa-pc">Personagem</label><select id="mesa-pc">${livres.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>` : '<p class="note">Nenhum personagem disponível.</p>'}
    <div class="m-actions">${livres.length ? '<button class="btn gold" data-action="mesa-add">Adicionar à campanha</button>' : ''}<button class="btn" data-action="mesa-novo-pc">${icon('i-plus')}Criar personagem</button></div></div>`;
}

function blocoNotas(d, mestre) {
  const minhas = d.notas.filter(n => n.autor === nuvem.user.id && !n.alvo), mesa = d.notas.filter(n => n.autor !== nuvem.user.id && n.compartilhada);
  return `<div class="panel"><div class="panel-h"><h2>${mestre ? 'Notas do mestre' : 'Suas notas da campanha'}</h2><span class="rule"></span></div>
    ${minhas.map(n => `<div class="mesa-nota">
      <div class="field"><label for="nt-${esc(n.id)}">Título</label><input id="nt-${esc(n.id)}" maxlength="120" value="${esc(n.titulo)}" data-nota-campo="titulo" data-nota="${esc(n.id)}"></div>
      <div class="field"><label for="nx-${esc(n.id)}">Texto</label><textarea id="nx-${esc(n.id)}" rows="4" maxlength="20000" data-nota-campo="texto" data-nota="${esc(n.id)}">${esc(n.texto)}</textarea></div>
      <div class="m-actions">${mestre ? `<button class="btn sm" data-action="mesa-nota-mesa" data-id="${esc(n.id)}" aria-pressed="${n.compartilhada}">${n.compartilhada ? 'Visível para a mesa' : 'Só para o mestre'}</button>` : ''}<button class="btn sm danger" data-action="mesa-nota-del" data-id="${esc(n.id)}">Apagar</button></div>
    </div>`).join('') || '<p class="note">Nenhuma nota ainda.</p>'}
    <div class="m-actions"><button class="btn" data-action="mesa-nota-nova">${icon('i-plus')}Nova nota</button></div></div>
    ${mesa.length ? `<div class="panel"><div class="panel-h"><h2>Do mestre para a mesa</h2><span class="rule"></span></div>${mesa.map(n => `<div class="mesa-nota"><b>${esc(n.titulo || 'Sem título')}</b><p class="pre">${esc(n.texto)}</p></div>`).join('')}</div>` : ''}`;
}

function vistaMesa() {
  const d = mesas.det, c = d.c, mestre = c.mestre === nuvem.user.id;
  const ativos = d.elenco.filter(e => e.situacao === 'ativo'), caidos = d.elenco.filter(e => e.situacao === 'morto'), fora = d.elenco.filter(e => e.situacao === 'saiu');
  const jogadores = d.part.filter(p => p.papel === 'jogador');
  return `<div class="mesa-topo"><button class="btn sm" data-action="mesa-voltar">Voltar</button><button class="btn sm" data-action="mesa-atualizar">Atualizar</button></div>
    <div class="panel">
      <div class="panel-h"><h2>${esc(c.nome)}</h2><span class="rule"></span>${mestre ? '<span class="aside">você é o mestre</span>' : `<span class="aside">Mestre: ${esc(d.nomes[c.mestre] || '')}</span>`}</div>
      ${c.descricao ? `<p class="pre">${esc(c.descricao)}</p>` : ''}
      ${mestre ? `<div class="mesa-convite">
        <small>Código de entrada · ${c.tem_senha ? 'com senha' : 'sem senha: quem tiver o link entra'}</small>
        <b class="num">${esc(codigoFmt(c.codigo))}</b>
        <div class="m-actions"><button class="btn gold" data-action="mesa-link">Copiar link</button><button class="btn" data-action="mesa-codigo">Copiar código</button><button class="btn" data-action="mesa-senha">${c.tem_senha ? 'Trocar senha' : 'Colocar senha'}</button><button class="btn" data-action="mesa-novo-codigo">Gerar novo código</button></div>
      </div>` : ''}
    </div>
    ${mestre ? '' : blocoMeuPersonagem(d)}
    <div class="panel"><div class="panel-h"><h2>Na mesa</h2><span class="rule"></span><span class="aside">${ativos.length}</span></div>
      <div class="elenco-lista">${ativos.map(e => cartaoElenco(e, d, mestre)).join('') || '<p class="empty">Nenhum personagem ainda.</p>'}</div></div>
    ${caidos.length ? `<div class="panel"><div class="panel-h"><h2>Caídos</h2><span class="rule"></span><span class="aside">${caidos.length}</span></div><div class="elenco-lista">${caidos.map(e => cartaoElenco(e, d, mestre)).join('')}</div></div>` : ''}
    ${fora.length ? `<div class="panel"><div class="panel-h"><h2>Fora da mesa</h2><span class="rule"></span></div><div class="elenco-lista">${fora.map(e => cartaoElenco(e, d, mestre)).join('')}</div></div>` : ''}
    ${blocoNotas(d, mestre)}
    <div class="panel"><div class="panel-h"><h2>Participantes</h2><span class="rule"></span></div>
      <div class="mesa-part"><span>${esc(d.nomes[c.mestre] || 'Mestre')} <small>mestre</small></span></div>
      ${jogadores.map(p => `<div class="mesa-part"><span>${esc(d.nomes[p.user_id] || 'Jogador')}</span>${mestre ? `<button class="btn sm danger" data-action="mesa-remover" data-id="${esc(p.user_id)}">Remover</button>` : ''}</div>`).join('')}
      <div class="m-actions">${mestre ? '<button class="btn" data-action="mesa-editar">Editar campanha</button><button class="btn danger" data-action="mesa-apagar">Apagar campanha</button>' : '<button class="btn danger" data-action="mesa-sair">Sair da campanha</button>'}</div>
    </div>`;
}

function mesasRender() {
  const el = $('#mesas-view');
  if (!el || !NUVEM_CFG) return;
  el.innerHTML = !nuvem.user ? vistaLogin() : mesas.aberta && mesas.det ? vistaMesa() : vistaLista();
}

/* ---------- ações ---------- */
function entrarModal(cod = '') {
  const prev = { dado: null, erro: '' };
  const buscar = async c => {
    if (c.replace(/[^a-zA-Z0-9]/g, '').length < 10) { prev.dado = null; return; }
    const { data } = await nuvem.sb.rpc('previa_campanha', { p_codigo: c });
    prev.dado = data; prev.erro = data ? '' : ERRO_MESA.codigo;
    const box = $('#mesa-previa');
    if (box) box.innerHTML = previa();
  };
  const previa = () => prev.dado ? `<p class="note"><b>${esc(prev.dado.nome)}</b>, mestre ${esc(prev.dado.mestre)}. ${prev.dado.ja_participo ? 'Você já participa.' : prev.dado.tem_senha ? 'Precisa de senha.' : 'Sem senha.'}</p>` : prev.erro ? `<p class="note">${esc(prev.erro)}</p>` : '';
  openModal(() => `${mHead('Campanhas', 'Entrar em uma campanha')}
    <form id="mesa-entrar-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="mesa-cod">Código</label><input id="mesa-cod" required maxlength="20" value="${esc(cod)}" autocapitalize="characters" ${cod ? '' : 'autofocus'}></div>
      <div id="mesa-previa">${previa()}</div>
      <div class="field"><label for="mesa-sen">Senha, se houver</label><input id="mesa-sen" type="password" maxlength="72" autocomplete="off" ${cod ? 'autofocus' : ''}></div>
      <p class="note" id="mesa-msg" role="alert"></p>
      <div class="m-actions"><button type="button" class="btn ghost" data-action="close">Cancelar</button><button class="btn gold">Entrar</button></div>
    </form>`);
  mesas.previa = buscar;
  if (cod) buscar(cod);
}

function criarModal() {
  openModal(() => `${mHead('Campanhas', 'Nova campanha')}
    <form id="mesa-criar-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="mc-nome">Nome</label><input id="mc-nome" required maxlength="80" autofocus></div>
      <div class="field"><label for="mc-desc">Descrição</label><textarea id="mc-desc" rows="2" maxlength="1000"></textarea></div>
      <div class="field"><label for="mc-sen">Senha para entrar</label><input id="mc-sen" type="password" minlength="4" maxlength="72" autocomplete="new-password"></div>
      <p class="note">Com senha, o jogador precisa do código e da senha. Sem senha, basta o link. O código não dá para adivinhar, e você pode trocá-lo depois.</p>
      <p class="note" id="mesa-msg" role="alert"></p>
      <div class="m-actions"><button type="button" class="btn ghost" data-action="close">Cancelar</button><button class="btn gold">Criar campanha</button></div>
    </form>`);
}

function editarModal() {
  const c = mesas.det.c;
  openModal(() => `${mHead('Campanhas', 'Editar campanha')}
    <form id="mesa-editar-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="me-nome">Nome</label><input id="me-nome" required maxlength="80" value="${esc(c.nome)}"></div>
      <div class="field"><label for="me-desc">Descrição</label><textarea id="me-desc" rows="3" maxlength="1000">${esc(c.descricao)}</textarea></div>
      <div class="m-actions"><button type="button" class="btn ghost" data-action="close">Cancelar</button><button class="btn gold">Salvar</button></div>
    </form>`);
}

function senhaModal() {
  const tem = mesas.det.c.tem_senha;
  openModal(() => `${mHead('Campanhas', tem ? 'Trocar senha' : 'Colocar senha')}
    <form id="mesa-senha-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="ms-sen">Nova senha</label><input id="ms-sen" type="password" required minlength="4" maxlength="72" autofocus autocomplete="new-password"></div>
      <p class="note">Quem já entrou continua na campanha.</p>
      <p class="note" id="mesa-msg" role="alert"></p>
      <div class="m-actions">${tem ? '<button type="button" class="btn" data-action="mesa-sem-senha">Tirar senha</button>' : ''}<button class="btn gold">Salvar</button></div>
    </form>`);
}

function confirmaModal(titulo, texto, acao, rotulo, extra = '') {
  openModal(() => `${mHead('Confirmar', titulo)}<p style="margin-top:14px">${texto}</p>${extra}
    <div class="m-actions"><button class="btn ghost" data-action="close">Cancelar</button><button class="btn danger" data-action="${acao}">${rotulo}</button></div>`);
}

function contaModal() {
  openModal(() => `${mHead('Conta', esc(nuvem.perfil?.nome || 'Sua conta'))}
    <form id="conta-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="ct-nome">Nome mostrado nas campanhas</label><input id="ct-nome" required maxlength="60" value="${esc(nuvem.perfil?.nome || '')}"></div>
      <div class="m-actions"><button class="btn gold">Salvar nome</button></div>
    </form>
    <div class="m-actions"><button class="btn" data-action="nuvem-sair">Sair da conta</button><button class="btn danger" data-action="nuvem-excluir">Excluir conta</button></div>`);
}

async function copiar(txt, msg) {
  try { await navigator.clipboard.writeText(txt); toast(msg, false); }
  catch (e) { toast(txt, false); }
}

async function chamar(f, args, msg) {
  const { data, error } = await nuvem.sb.rpc(f, args);
  if (error) { toast(erroMesa(error), false); return null; }
  if (msg) toast(msg, false);
  return data ?? true;
}

function abrirMesa(id) {
  mesas.aberta = id; mesas.det = null;
  setTab('mesas');
  return mesaCarregar(id);
}

/** Depois da morte, o personagem novo já nasce indo para a mesma campanha. */
function mesaDeSubstituicao(id) {
  mesas.destino = mesas.meus.find(e => e.personagem_id === id && e.situacao !== 'saiu')?.campanha_id || mesas.destino;
}

async function aposCriar(c) {
  if (!mesas.destino || !nuvem.user) return;
  const camp = mesas.destino;
  mesas.destino = null;
  await nuvemEnviar();
  if (await chamar('adicionar_personagem', { p_campanha: camp, p_personagem: c.id }, `${c.name} entrou na campanha`)) { await mesasCarregar(); await abrirMesa(camp); }
}

const notaTimers = {};
function salvarNota(el) {
  const k = el.id;
  clearTimeout(notaTimers[k]);
  notaTimers[k] = setTimeout(async () => {
    const d = mesas.det;
    if (el.dataset.notaAlvo) {
      if (el.dataset.nota) await nuvem.sb.from('anotacoes').update({ texto: el.value, atualizado_em: new Date().toISOString() }).eq('id', el.dataset.nota);
      else {
        const { data } = await nuvem.sb.from('anotacoes').insert({ campanha_id: d.c.id, autor: nuvem.user.id, alvo: el.dataset.notaAlvo, texto: el.value }).select().single();
        if (data) { el.dataset.nota = data.id; d.notas.push(data); }
      }
      const n = d.notas.find(x => x.id === el.dataset.nota);
      if (n) n.texto = el.value;
    } else {
      const campo = el.dataset.notaCampo, n = d.notas.find(x => x.id === el.dataset.nota);
      await nuvem.sb.from('anotacoes').update({ [campo]: el.value, atualizado_em: new Date().toISOString() }).eq('id', el.dataset.nota);
      if (n) n[campo] = el.value;
    }
  }, 600);
}

document.addEventListener('input', e => {
  if (e.target.id === 'mesa-cod') mesas.previa?.(e.target.value);
  if (e.target.dataset?.notaAlvo !== undefined || e.target.dataset?.notaCampo) salvarNota(e.target);
});

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action]');
  if (!b || !b.dataset.action.match(/^(mesa|nuvem)-/)) return;
  const id = b.dataset.id, d = mesas.det;
  switch (b.dataset.action) {
    case 'nuvem-login': nuvemLogin(); break;
    case 'nuvem-conta': contaModal(); break;
    case 'nuvem-sair': closeModal(); nuvemSair(); break;
    case 'nuvem-excluir': confirmaModal('Excluir conta', 'Suas fichas salvas na conta, anotações, sugestões e as campanhas em que você é mestre serão apagadas para sempre. Exporte antes o que quiser guardar.', 'nuvem-excluir-ok', 'Excluir para sempre'); break;
    case 'nuvem-excluir-ok':
      closeModal();
      if (await chamar('excluir_minha_conta', {})) { await nuvem.sb.auth.signOut({ scope: 'local' }); const r = lojaRascunho(); r.settings = store.settings; trocarLoja(r); aoSair(); toast('Conta excluída', false); }
      break;
    case 'mesa-criar': criarModal(); break;
    case 'mesa-entrar': entrarModal(); break;
    case 'mesa-abrir': abrirMesa(id); break;
    case 'mesa-voltar': mesas.aberta = null; mesas.det = null; mesasRender(); mesasCarregar(); break;
    case 'mesa-atualizar': await mesasCarregar(); toast('Campanha atualizada', false); break;
    case 'mesa-link': copiar(linkMesa(d.c.codigo), d.c.tem_senha ? 'Link copiado. Envie a senha aos jogadores à parte' : 'Link copiado'); break;
    case 'mesa-codigo': copiar(codigoFmt(d.c.codigo), 'Código copiado'); break;
    case 'mesa-senha': senhaModal(); break;
    case 'mesa-sem-senha': closeModal(); if (await chamar('definir_senha', { p_id: d.c.id, p_senha: null }, 'Senha removida')) await mesaCarregar(d.c.id); break;
    case 'mesa-novo-codigo': confirmaModal('Gerar novo código', 'O link e o código atuais deixam de funcionar. Quem já entrou continua na campanha.', 'mesa-novo-codigo-ok', 'Gerar'); break;
    case 'mesa-novo-codigo-ok': closeModal(); if (await chamar('trocar_codigo', { p_id: d.c.id }, 'Novo código gerado')) await mesaCarregar(d.c.id); break;
    case 'mesa-editar': editarModal(); break;
    case 'mesa-apagar': confirmaModal('Apagar campanha', `${esc(d.c.nome)} e todas as anotações dela serão apagadas para sempre. As fichas dos jogadores continuam com eles.`, 'mesa-apagar-ok', 'Apagar para sempre'); break;
    case 'mesa-apagar-ok': {
      closeModal();
      const { error } = await nuvem.sb.from('campanhas').delete().eq('id', d.c.id);
      if (error) toast(erroMesa(error), false); else { mesas.aberta = null; mesas.det = null; await mesasCarregar(); toast('Campanha apagada', false); }
      break;
    }
    case 'mesa-sair': confirmaModal('Sair da campanha', 'Seu personagem deixa a mesa, mas a ficha continua com você.', 'mesa-sair-ok', 'Sair'); break;
    case 'mesa-sair-ok': closeModal(); if (await chamar('sair_campanha', { p_id: d.c.id }, 'Você saiu da campanha')) { mesas.aberta = null; mesas.det = null; await mesasCarregar(); } break;
    case 'mesa-add': {
      const pid = $('#mesa-pc').value;
      await nuvemEnviar();
      if (await chamar('adicionar_personagem', { p_campanha: d.c.id, p_personagem: pid }, 'Personagem adicionado')) await mesasCarregar();
      break;
    }
    case 'mesa-novo-pc': mesas.destino = d.c.id; newCharModal(); break;
    case 'mesa-ficha': closeModal(); switchCharacter(id); setTab('ficha'); break;
    case 'mesa-retirar': if (await chamar('retirar_personagem', { p_elenco: id }, 'Personagem retirado')) await mesasCarregar(); break;
    case 'mesa-morte':
      mesas.alvo = id;
      confirmaModal('Declarar morte', `${esc(d.elenco.find(x => x.id === id).nome)} será marcado como morto na ficha do jogador e na mesa.`, 'mesa-morte-ok', 'Declarar morte', '<div class="field" style="margin-top:12px"><label for="mm-causa">Causa</label><input id="mm-causa" maxlength="300"></div>');
      break;
    case 'mesa-morte-ok': { const causa = $('#mm-causa').value.trim(); closeModal(); if (await chamar('definir_situacao', { p_elenco: mesas.alvo, p_situacao: 'morto', p_causa: causa }, 'Morte registrada')) await mesasCarregar(); break; }
    case 'mesa-reverter': if (await chamar('definir_situacao', { p_elenco: id, p_situacao: 'ativo', p_causa: '' }, 'Morte desfeita')) await mesasCarregar(); break;
    case 'mesa-remover': mesas.alvo = id; confirmaModal('Remover jogador', `${esc(d.nomes[id] || 'Este jogador')} perderá o acesso à campanha.`, 'mesa-remover-ok', 'Remover'); break;
    case 'mesa-remover-ok': closeModal(); if (await chamar('remover_participante', { p_id: d.c.id, p_user: mesas.alvo }, 'Jogador removido')) await mesasCarregar(); break;
    case 'mesa-nota-nova': {
      const { error } = await nuvem.sb.from('anotacoes').insert({ campanha_id: d.c.id, autor: nuvem.user.id, titulo: '', texto: '' });
      if (error) toast(erroMesa(error), false); else await mesaCarregar(d.c.id);
      break;
    }
    case 'mesa-nota-del': await nuvem.sb.from('anotacoes').delete().eq('id', id); await mesaCarregar(d.c.id); break;
    case 'mesa-nota-mesa': {
      const n = d.notas.find(x => x.id === id);
      const { error } = await nuvem.sb.from('anotacoes').update({ compartilhada: !n.compartilhada }).eq('id', id);
      if (error) toast(erroMesa(error), false); else await mesaCarregar(d.c.id);
      break;
    }
  }
});

document.addEventListener('submit', async e => {
  const f = e.target.id, msg = t => { const m = $('#mesa-msg'); if (m) m.textContent = t; };
  if (!/^(mesa-|conta-form)/.test(f)) return;
  e.preventDefault();
  if (f === 'mesa-criar-form') {
    const senha = $('#mc-sen').value;
    const { data, error } = await nuvem.sb.rpc('criar_campanha', { p_nome: $('#mc-nome').value, p_descricao: $('#mc-desc').value, p_senha: senha || null });
    if (error) { msg(erroMesa(error)); return; }
    closeModal(); await mesasCarregar(); await abrirMesa(data); toast('Campanha criada', false);
  } else if (f === 'mesa-entrar-form') {
    const { data, error } = await nuvem.sb.rpc('entrar_campanha', { p_codigo: $('#mesa-cod').value, p_senha: $('#mesa-sen').value || null });
    if (error || !data.ok) { msg(ERRO_MESA[data?.erro] || erroMesa(error)); return; }
    closeModal(); await mesasCarregar(); await abrirMesa(data.id); toast('Você entrou na campanha', false);
  } else if (f === 'mesa-senha-form') {
    const { error } = await nuvem.sb.rpc('definir_senha', { p_id: mesas.det.c.id, p_senha: $('#ms-sen').value });
    if (error) { msg(erroMesa(error)); return; }
    closeModal(); await mesaCarregar(mesas.det.c.id); toast('Senha salva', false);
  } else if (f === 'mesa-editar-form') {
    if (await chamar('editar_campanha', { p_id: mesas.det.c.id, p_nome: $('#me-nome').value, p_descricao: $('#me-desc').value }, 'Campanha atualizada')) { closeModal(); await mesasCarregar(); }
  } else if (f === 'conta-form') {
    const nome = $('#ct-nome').value.trim();
    const { error } = await nuvem.sb.from('perfis').update({ nome }).eq('id', nuvem.user.id);
    if (error) { toast('Não foi possível salvar o nome', false); return; }
    nuvem.perfil = { ...nuvem.perfil, nome };
    closeModal(); mesasRender(); toast('Nome salvo', false);
  }
});

/* Mesa aberta na tela: acompanha os outros jogadores sem atrapalhar quem está digitando. */
setInterval(() => {
  if (nuvem.user && state.ui.tab === 'mesas' && document.visibilityState === 'visible' && !digitando() && $('#modal').hidden) mesasCarregar();
}, 30000);
