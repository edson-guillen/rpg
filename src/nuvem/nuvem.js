/* =====================================================================
   CONTA E SINCRONIZAÇÃO
   Sem configuração (GitHub Pages, arquivo local) nada aqui é ativado.
   O navegador continua sendo a cópia de trabalho: cada personagem sobe
   quando muda, e a versão do servidor detecta edição em dois aparelhos.
   ===================================================================== */
const nuvem = { sb: null, user: null, perfil: null, dev: false, estado: 'off', enviando: false, denovo: false, timer: 0, retry: 0, puxado: 0 };
const CONVITE_KEY = 'grimorio-convite';
const AVISO_TEXTO = 'Texto na biblioteca pessoal: importe-a neste aparelho para ler.';

/* A biblioteca pessoal nunca sai do aparelho: a ficha sobe só com o nome e a mecânica dessas magias. */
function semTextoPessoal(s) {
  if (!/pessoal/.test(s?.src || '')) return s;
  const { desc: _d, higher: _h, upgrade: _u, material: _m, orig: _o, ...resto } = s;
  return { ...resto, desc: [AVISO_TEXTO], semTexto: true };
}
function paraNuvem(c) {
  const { nv: _v, nh: _h, rascunho: _r, ...x } = c;
  const out = clone(x);
  if (out.state) delete out.state.ui;
  if (out.spells) out.spells = out.spells.map(semTextoPessoal);
  if (out.grimoire?.added) out.grimoire.added = out.grimoire.added.map(semTextoPessoal);
  return out;
}
/** Mantém o texto completo que este aparelho já tinha. */
function reidrata(remoto, local) {
  const achar = s => [...(local?.grimoire?.added || []), ...(local?.spells || [])].find(l => l.id === s.id && !l.semTexto);
  const volta = l => (l || []).map(s => (s.semTexto && achar(s)) || s);
  if (remoto.spells) remoto.spells = volta(remoto.spells);
  if (remoto.grimoire?.added) remoto.grimoire.added = volta(remoto.grimoire.added);
  return remoto;
}

/* O banco reordena as chaves do JSON: o hash precisa ignorar a ordem. */
const canon = o => Array.isArray(o) ? `[${o.map(canon).join()}]`
  : o && typeof o === 'object' ? `{${Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => `${JSON.stringify(k)}:${canon(o[k])}`).join()}}`
  : JSON.stringify(o) ?? 'null';
function resumo(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0; return `${s.length}.${h.toString(36)}`; }
const hashDe = c => resumo(canon(paraNuvem(c)));
const dadosConta = () => ({ settings: store.settings, campaignNotes: store.campaignNotes, library: { custom: store.library.custom, overrides: store.library.overrides } });

function nuvemEstado(e) {
  nuvem.estado = e;
  const el = $('#nuvem-status');
  if (el) el.textContent = { ok: 'Fichas salvas na sua conta', enviando: 'Salvando…', pendente: 'Sem conexão: salva neste aparelho e envia depois', erro: 'Não foi possível salvar na conta' }[e] || '';
}

function nuvemAgendar() {
  if (!nuvem.user) return;
  clearTimeout(nuvem.timer);
  nuvem.timer = setTimeout(nuvemEnviar, 1500);
}

function adotar(c, remoto) {
  const local = { nv: c.nv, grimoire: c.grimoire, spells: c.spells, ui: c.state?.ui };
  const novo = reidrata(clone(remoto.dados), local);
  Object.keys(c).forEach(k => delete c[k]);
  Object.assign(c, novo, { id: remoto.id, name: remoto.nome, nv: remoto.versao });
  if (c.state && local.ui) c.state.ui = local.ui;
  c.nh = hashDe(c);
  return sanitizeCharacter(c) ? c : null;
}

async function enviarPersonagens() {
  const lista = store.characters.filter(c => !c.rascunho);
  for (const c of lista) {
    const h = hashDe(c);
    if (h === c.nh) continue;
    const dados = paraNuvem(c);
    const { data, error } = await nuvem.sb.rpc('salvar_personagem', { p_id: c.id, p_nome: c.name, p_dados: dados, p_versao: c.nv ?? null });
    if (error) throw error;
    if (data.ok) { c.nv = data.versao; c.nh = h; continue; }
    if (data.erro === 'grande' || data.erro === 'limite') { toast(data.erro === 'limite' ? 'Limite de 60 personagens na conta' : `${c.name} é grande demais para salvar na conta`, false); c.nh = h; continue; }
    // Editado em dois aparelhos. Fica a versão do servidor, e esta vira cópia, salvo se forem iguais.
    if (resumo(canon({ ...data.dados })) !== resumo(canon(dados))) {
      const copia = { ...clone(c), id: newId('c'), name: `${c.name} (conflito)`.slice(0, 60) };
      delete copia.nv; delete copia.nh;
      store.characters.push(copia); nuvem.denovo = true;
      toast(`${c.name} mudou em outro aparelho: esta versão virou uma cópia`, false);
    }
    adotar(c, { id: c.id, nome: data.nome, versao: data.versao, dados: data.dados });
    if (c.id === store.activeId) { bindSheet(c); state = load(); undoStack.length = 0; refreshAll(); }
  }
  const atuais = new Set(store.characters.filter(c => !c.rascunho).map(c => c.id));
  for (const id of store.sinc?.ids || []) if (!atuais.has(id)) {
    const { error } = await nuvem.sb.from('personagens').delete().eq('dono', nuvem.user.id).eq('id', id);
    if (error) throw error;
  }
  store.sinc = { ...store.sinc, ids: [...atuais] };
  const conta = dadosConta(), hc = resumo(canon(conta));
  if (hc !== store.sinc.conta) {
    const { error } = await nuvem.sb.from('contas').upsert({ user_id: nuvem.user.id, dados: conta, atualizado_em: new Date().toISOString() });
    if (error) throw error;
    store.sinc.conta = hc;
  }
}

async function nuvemEnviar() {
  if (!nuvem.user) return true;
  if (nuvem.enviando) { nuvem.denovo = true; return false; }
  nuvem.enviando = true; nuvemEstado('enviando');
  let ok = true;
  try {
    await enviarPersonagens();
    gravaLocal();
    nuvemEstado('ok');
  } catch (e) {
    ok = false;
    nuvemEstado(navigator.onLine === false ? 'pendente' : 'erro');
    clearTimeout(nuvem.retry); nuvem.retry = setTimeout(nuvemEnviar, 20000);
  }
  nuvem.enviando = false;
  if (nuvem.denovo) { nuvem.denovo = false; return nuvemEnviar(); }
  return ok;
}

function trocarLoja(s) {
  store = s;
  activateCharacter(store.activeId);
}

function removerLocal(ids) {
  if (!ids.length) return;
  const eraAtivo = ids.includes(store.activeId);
  store.characters = store.characters.filter(c => !ids.includes(c.id));
  if (!store.characters.length) { const r = lojaRascunho(); store.characters = r.characters; store.activeId = r.activeId; }
  if (eraAtivo) activateCharacter(store.characters[0].id);
}

async function nuvemPuxar() {
  if (!nuvem.user) return;
  const { data, error } = await nuvem.sb.from('personagens').select('id,versao');
  if (error) throw error;
  const remotos = new Map(data.map(r => [r.id, r.versao])), locais = new Map(store.characters.map(c => [c.id, c]));
  removerLocal(store.characters.filter(c => c.nv && !c.rascunho && !remotos.has(c.id)).map(c => c.id));
  const buscar = data.filter(r => { const c = locais.get(r.id); return !c || (c.nv !== r.versao && hashDe(c) === c.nh); }).map(r => r.id);
  if (buscar.length) {
    const { data: fichas, error: e2 } = await nuvem.sb.from('personagens').select('id,nome,dados,versao').in('id', buscar);
    if (e2) throw e2;
    for (const r of fichas) {
      const c = locais.get(r.id);
      if (c) { adotar(c, r); if (r.id === store.activeId) { flushNote(); bindSheet(c); state = load(); undoStack.length = 0; refreshAll(); } }
      else { const n = adotar({}, r); if (n) store.characters.push(n); }
    }
    const real = store.characters.find(c => !c.rascunho);
    if (real && activeChar()?.rascunho) { store.characters = store.characters.filter(c => !c.rascunho); activateCharacter(real.id); }
    else renderHero();
  }
  store.sinc = { ...store.sinc, ids: store.characters.filter(c => c.nv).map(c => c.id) };
  const { data: conta } = await nuvem.sb.from('contas').select('dados').eq('user_id', nuvem.user.id).maybeSingle();
  if (conta?.dados && store.sinc.conta !== resumo(canon(conta.dados)) && (!store.sinc.conta || store.sinc.conta === resumo(canon(dadosConta())))) {
    const d = conta.dados;
    store.settings = { ...store.settings, ...d.settings };
    store.library = { ...store.library, custom: d.library?.custom || [], overrides: d.library?.overrides || {} };
    if (d.campaignNotes) store.campaignNotes = d.campaignNotes;
    store.sinc.conta = resumo(canon(dadosConta()));
  }
  gravaLocal();
  nuvem.puxado = Date.now();
}

async function aoEntrar(user) {
  if (nuvem.user?.id === user.id) return;
  nuvem.user = user;
  document.body.classList.add('logado');
  // Outra pessoa neste navegador: nada da conta anterior pode ir para esta.
  if (store.conta && store.conta !== user.id) { const r = lojaRascunho(); r.settings = store.settings; trocarLoja(r); }
  store.conta = user.id; gravaLocal();
  const [{ data: perfil }, { data: dev }] = await Promise.all([
    nuvem.sb.from('perfis').select('nome').eq('id', user.id).maybeSingle(),
    nuvem.sb.rpc('sou_dev')
  ]);
  nuvem.perfil = perfil; nuvem.dev = !!dev;
  try { await nuvemEnviar(); await nuvemPuxar(); nuvemEstado('ok'); } catch (e) { nuvemEstado('erro'); }
  await mesasCarregar();
  sugestoesRender();
  const conv = localStorage.getItem(CONVITE_KEY);
  if (conv) { localStorage.removeItem(CONVITE_KEY); entrarModal(conv); }
}

function aoSair() {
  nuvem.user = null; nuvem.perfil = null; nuvem.dev = false;
  document.body.classList.remove('logado');
  mesas.lista = null; mesas.det = null; mesas.aberta = null;
  mesasRender(); sugestoesRender();
}

async function nuvemLogin() {
  const { error } = await nuvem.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) toast('Não foi possível abrir o login do Google', false);
}

async function nuvemSair() {
  if (!(await nuvemEnviar())) { toast('Sem conexão com a conta: tente sair de novo para não perder alterações', false); return; }
  await nuvem.sb.auth.signOut();
  const r = lojaRascunho(); r.settings = store.settings;
  trocarLoja(r);
  aoSair();
  toast('Você saiu da conta', false);
}

function carregarCliente() {
  return new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'data/supabase.js'; s.onload = ok; s.onerror = falha;
    document.head.appendChild(s);
  });
}

async function nuvemIniciar() {
  if (!NUVEM_CFG) return;
  document.body.classList.add('com-nuvem');
  const convite = new URLSearchParams(location.search).get('c');
  if (convite) { localStorage.setItem(CONVITE_KEY, convite); history.replaceState(null, '', location.pathname); }
  mesasRender(); sugestoesRender();
  if (convite || activeChar().rascunho) setTab('mesas');
  try {
    await carregarCliente();
    nuvem.sb = window.supabase.createClient(NUVEM_CFG.url, NUVEM_CFG.key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  } catch (e) { mesas.erro = 'Sem conexão: conta e campanhas indisponíveis agora.'; mesasRender(); return; }
  aoPersistir = nuvemAgendar;
  // O cliente segura uma trava durante este aviso: outra chamada ao banco aqui travaria tudo.
  nuvem.sb.auth.onAuthStateChange((ev, sessao) => {
    setTimeout(() => {
      if (sessao?.user) aoEntrar(sessao.user);
      else if (ev === 'SIGNED_OUT' && nuvem.user) aoSair();
    });
  });
  const { data } = await nuvem.sb.auth.getSession();
  if (!data.session) { mesasRender(); sugestoesRender(); if (localStorage.getItem(CONVITE_KEY)) toast('Entre com sua conta para aceitar o convite', false); }
  window.addEventListener('online', nuvemEnviar);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') nuvemEnviar();
    else if (nuvem.user && Date.now() - nuvem.puxado > 60000) nuvemPuxar().catch(() => {});
  });
}
