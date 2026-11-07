#!/usr/bin/env node
// Testa as regras de acesso no banco real (Supabase local), com contas diferentes.
// Requer: npx supabase start.
import { createClient } from '@supabase/supabase-js';
import { chavesLocais } from './nuvem-local.mjs';

const URL_LOCAL = 'http://127.0.0.1:54321';
const { ANON, SERVICE } = chavesLocais();

let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log(`  FALHOU: ${m}`); } };
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const sufixo = Date.now().toString(36);

async function conta(nome) {
  const sb = createClient(URL_LOCAL, ANON, opts), email = `${nome.toLowerCase()}-${sufixo}@exemplo.test`;
  const { data, error } = await sb.auth.signUp({ email, password: 'senha-de-teste-123', options: { data: { name: nome } } });
  if (error) throw error;
  return { sb, id: data.user.id, email };
}
const rpc = async (u, f, a) => { const { data, error } = await u.sb.rpc(f, a); return { data, erro: error?.message || null }; };
const ficha = (extra = {}) => ({ name: 'x', state: { hp: 10, ...extra } });

const [mestre, ana, bia, fora] = await Promise.all(['Mestre', 'Ana', 'Bia', 'Fora'].map(conta));
const admin = createClient(URL_LOCAL, SERVICE, opts);
const anon = createClient(URL_LOCAL, ANON, opts);

// Perfil nasce só com o nome.
{
  const { data } = await ana.sb.from('perfis').select('*').eq('id', ana.id).single();
  ok(data?.nome === 'Ana', 'perfil criado com o nome da conta');
  ok(!('email' in (data || {})), 'perfil não guarda e-mail');
}

// Fichas.
{
  let r = await rpc(ana, 'salvar_personagem', { p_id: 'c1', p_nome: 'Lyra', p_dados: ficha(), p_versao: null });
  ok(r.data?.ok && r.data.versao === 1, 'cria ficha na conta');
  r = await rpc(ana, 'salvar_personagem', { p_id: 'c1', p_nome: 'Lyra', p_dados: ficha({ hp: 9 }), p_versao: 1 });
  ok(r.data?.versao === 2, 'salva nova versão');
  r = await rpc(ana, 'salvar_personagem', { p_id: 'c1', p_nome: 'Lyra', p_dados: ficha({ hp: 1 }), p_versao: 1 });
  ok(r.data?.ok === false && r.data.erro === 'conflito' && r.data.dados.state.hp === 9, 'versão antiga vira conflito e devolve a atual');
  await rpc(bia, 'salvar_personagem', { p_id: 'c1', p_nome: 'Borin', p_dados: ficha(), p_versao: null });
  const d = await ana.sb.from('personagens').select('nome');
  ok(d.data.length === 1 && d.data[0].nome === 'Lyra', 'ids iguais em contas diferentes não se misturam');
  const x = await bia.sb.from('personagens').select('*').eq('dono', ana.id);
  ok(x.data.length === 0, 'não lê ficha de outra pessoa');
  const i = await ana.sb.from('personagens').insert({ dono: bia.id, id: 'z', nome: 'z', dados: {} });
  ok(!!i.error, 'não grava direto na tabela de fichas');
  const a = await anon.from('personagens').select('*');
  ok(!!a.error || a.data.length === 0, 'visitante sem login não lê fichas');
}

// Campanha com senha.
let camp, codigo;
{
  const c = await rpc(mestre, 'criar_campanha', { p_nome: 'A Costa Perdida', p_descricao: 'Sessão às sextas', p_senha: 'dragao' });
  camp = c.data; ok(!!camp, 'cria campanha');
  codigo = (await mestre.sb.from('campanhas').select('codigo').eq('id', camp).single()).data.codigo;
  ok(/^[2-9A-Z]{10}$/.test(codigo), 'código com 10 caracteres');
  const s = await mestre.sb.from('campanha_segredos').select('*');
  ok(!!s.error || s.data.length === 0, 'nem o mestre lê o hash da senha');
  ok((await ana.sb.from('campanhas').select('*')).data.length === 0, 'não vê campanha onde não participa');
  const p = await rpc(ana, 'previa_campanha', { p_codigo: codigo.toLowerCase() });
  ok(p.data?.nome === 'A Costa Perdida' && p.data.tem_senha && p.data.mestre === 'Mestre' && !p.data.id, 'prévia pelo código, sem expor o id');
  let e = await rpc(ana, 'entrar_campanha', { p_codigo: codigo, p_senha: 'errada' });
  ok(e.data?.erro === 'senha', 'senha errada não entra');
  e = await rpc(ana, 'entrar_campanha', { p_codigo: codigo, p_senha: null });
  ok(e.data?.erro === 'senha', 'sem senha não entra');
  e = await rpc(ana, 'entrar_campanha', { p_codigo: codigo, p_senha: 'dragao' });
  ok(e.data?.ok && e.data.id === camp, 'senha certa entra');
  e = await rpc(bia, 'entrar_campanha', { p_codigo: `${codigo.slice(0, 5)}-${codigo.slice(5)}`, p_senha: 'dragao' });
  ok(e.data?.ok, 'código com hífen também vale');
  for (let i = 0; i < 8; i++) e = await rpc(fora, 'entrar_campanha', { p_codigo: codigo, p_senha: 'chute' + i });
  e = await rpc(fora, 'entrar_campanha', { p_codigo: codigo, p_senha: 'dragao' });
  ok(e.data?.erro === 'muitas_tentativas', 'muitas tentativas bloqueiam mesmo com a senha certa');
  ok((await rpc(ana, 'definir_senha', { p_id: camp, p_senha: 'hack' })).erro, 'jogador não troca a senha');
  ok((await rpc(ana, 'trocar_codigo', { p_id: camp })).erro, 'jogador não troca o código');
  await ana.sb.from('campanhas').delete().eq('id', camp);
  ok((await mestre.sb.from('campanhas').select('id').eq('id', camp)).data.length === 1, 'jogador não apaga a campanha');
  const u = await ana.sb.from('campanhas').update({ mestre: ana.id }).eq('id', camp);
  ok(!!u.error, 'jogador não muda o mestre');
}

// Elenco, morte e substituição.
let lyra, borin;
{
  lyra = (await rpc(ana, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'c1' })).data;
  ok(!!lyra, 'adiciona personagem à campanha');
  ok((await rpc(ana, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'c1' })).erro?.includes('ja_tem_ativo'), 'só um personagem ativo por jogador');
  ok((await rpc(mestre, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'c1' })).erro, 'mestre não entra como personagem');
  ok((await rpc(fora, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'c1' })).erro?.includes('nao_participa'), 'quem está fora não adiciona');
  ok((await rpc(bia, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'inexistente' })).erro, 'não adiciona ficha que não é sua');
  borin = (await rpc(bia, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'c1' })).data;
  const v = await bia.sb.from('elenco').select('*').eq('campanha_id', camp);
  ok(v.data.length === 2, 'jogadora vê o elenco da mesa');
  ok(v.data.every(e => Object.keys(e).every(k => !['dados', 'hp', 'classe'].includes(k))), 'elenco não traz dados da ficha');
  ok((await fora.sb.from('elenco').select('*').eq('campanha_id', camp)).data.length === 0, 'quem está fora não vê o elenco');
  const nomes = await bia.sb.from('perfis').select('nome');
  ok(nomes.data.map(x => x.nome).sort().join() === 'Ana,Bia,Mestre', 'vê nomes só de quem está na mesa');
  ok((await bia.sb.from('personagens').select('*').eq('dono', ana.id)).data.length === 0, 'mesa não libera a ficha do outro');

  await rpc(ana, 'salvar_personagem', { p_id: 'c1', p_nome: 'Lyra Ventoleve', p_dados: ficha({ hp: 9 }), p_versao: 2 });
  ok((await bia.sb.from('elenco').select('nome').eq('id', lyra).single()).data.nome === 'Lyra Ventoleve', 'renomear a ficha atualiza a mesa');
  await rpc(ana, 'salvar_personagem', { p_id: 'c1', p_nome: 'Lyra Ventoleve', p_dados: ficha({ hp: 0, morte: { morto: true, causa: 'Sopro do dragão' } }), p_versao: 3 });
  let e = (await bia.sb.from('elenco').select('*').eq('id', lyra).single()).data;
  ok(e.situacao === 'morto' && e.causa === 'Sopro do dragão', 'morte na ficha aparece para a mesa');
  ok((await rpc(ana, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'c1' })).erro?.includes('personagem_morto'), 'personagem morto não volta sem reviver');
  await rpc(ana, 'salvar_personagem', { p_id: 'c2', p_nome: 'Nova', p_dados: ficha(), p_versao: null });
  const nova = (await rpc(ana, 'adicionar_personagem', { p_campanha: camp, p_personagem: 'c2' })).data;
  ok(!!nova, 'depois da morte o jogador volta com outro personagem');
  await rpc(ana, 'salvar_personagem', { p_id: 'c1', p_nome: 'Lyra Ventoleve', p_dados: ficha({ hp: 1, morte: { morto: false } }), p_versao: 4 });
  e = (await ana.sb.from('elenco').select('situacao').eq('id', lyra).single()).data;
  ok(e.situacao === 'morto', 'reviver não cria dois ativos para o mesmo jogador');

  ok((await rpc(bia, 'definir_situacao', { p_elenco: nova, p_situacao: 'morto', p_causa: 'x' })).erro, 'jogadora não mata personagem alheio');
  ok(!(await rpc(mestre, 'definir_situacao', { p_elenco: borin, p_situacao: 'morto', p_causa: 'Queda' })).erro, 'mestre declara morte');
  await rpc(bia, 'salvar_personagem', { p_id: 'c1', p_nome: 'Borin', p_dados: ficha({ hp: 5 }), p_versao: 1 });
  ok((await bia.sb.from('elenco').select('situacao').eq('id', borin).single()).data.situacao === 'morto', 'salvar a ficha não desfaz a morte declarada pelo mestre');
  ok(!(await rpc(mestre, 'definir_situacao', { p_elenco: borin, p_situacao: 'ativo', p_causa: '' })).erro, 'mestre reverte a morte');
  ok((await ana.sb.from('elenco').update({ situacao: 'ativo' }).eq('id', lyra)).error, 'não altera o elenco direto');
}

// Anotações.
{
  const n = await bia.sb.from('anotacoes').insert({ campanha_id: camp, autor: bia.id, alvo: lyra, texto: 'Desconfio dela' }).select().single();
  ok(!n.error, 'jogadora anota sobre outro personagem');
  ok((await ana.sb.from('anotacoes').select('*').eq('campanha_id', camp)).data.length === 0, 'a anotação é privada de quem escreveu');
  ok((await mestre.sb.from('anotacoes').select('*').eq('campanha_id', camp)).data.length === 0, 'nem o mestre lê a anotação do jogador');
  ok((await ana.sb.from('anotacoes').update({ texto: 'hack' }).eq('id', n.data.id).select()).data.length === 0, 'não altera nota alheia');
  ok((await bia.sb.from('anotacoes').update({ compartilhada: true }).eq('id', n.data.id)).error, 'jogadora não compartilha nota com a mesa');
  const fo = await fora.sb.from('anotacoes').insert({ campanha_id: camp, autor: fora.id, texto: 'x' });
  ok(!!fo.error, 'quem está fora não anota');
  await mestre.sb.from('anotacoes').insert([{ campanha_id: camp, autor: mestre.id, titulo: 'Segredo', texto: 'O vilão é o prefeito', compartilhada: false }, { campanha_id: camp, autor: mestre.id, titulo: 'Diário', texto: 'Sessão 1', compartilhada: true }]);
  const m = await ana.sb.from('anotacoes').select('titulo').eq('campanha_id', camp);
  ok(m.data.length === 1 && m.data[0].titulo === 'Diário', 'jogador vê só a nota compartilhada do mestre');
}

// Sair, remover, link aberto.
{
  ok((await rpc(mestre, 'sair_campanha', { p_id: camp })).erro, 'mestre não abandona a campanha');
  ok((await rpc(ana, 'remover_participante', { p_id: camp, p_user: bia.id })).erro, 'jogador não remove outro');
  ok(!(await rpc(mestre, 'remover_participante', { p_id: camp, p_user: bia.id })).erro, 'mestre remove jogador');
  ok((await bia.sb.from('campanhas').select('id').eq('id', camp)).data.length === 0, 'removida perde o acesso');
  await rpc(mestre, 'definir_senha', { p_id: camp, p_senha: null });
  const novo = (await rpc(mestre, 'trocar_codigo', { p_id: camp })).data;
  ok((await rpc(bia, 'entrar_campanha', { p_codigo: codigo, p_senha: null })).data?.erro === 'codigo', 'código antigo deixa de valer');
  ok((await rpc(bia, 'entrar_campanha', { p_codigo: novo, p_senha: null })).data?.ok, 'sem senha, o link basta');
}

// Sugestões.
{
  await mestre.sb.from('sugestoes').insert({ autor: mestre.id, texto: 'Adicionar mapas', situacao: 'feita', resposta: 'forjado', autor_nome: 'Outro' });
  let { data } = await mestre.sb.from('sugestoes').select('*');
  ok(data.length === 1 && data[0].situacao === 'nova' && data[0].autor_nome === 'Mestre' && !data[0].resposta, 'autor não forja situação, resposta nem nome');
  ok((await ana.sb.from('sugestoes').select('*')).data.length === 0, 'jogador não vê sugestão de outro');
  ok((await mestre.sb.from('sugestoes').update({ situacao: 'feita' }).eq('id', data[0].id).select()).data.length === 0, 'autor não muda a própria situação');
  ok(!(await ana.sb.from('sugestoes').insert({ autor: ana.id, tipo: 'privacidade', texto: 'Pedido de dados', autor_nome: '-' })).error, 'aceita pedido de privacidade');
  ok(!(await rpc(ana, 'sou_dev', {})).data, 'conta comum não é desenvolvedora');
  const ins = await admin.from('desenvolvedores').insert({ email: ana.email });
  ok(!ins.error, `registra desenvolvedora ${ins.error?.message || ''}`);
  ok((await rpc(ana, 'sou_dev', {})).data === true, 'desenvolvedora reconhecida pelo e-mail da sessão');
  ok((await ana.sb.from('sugestoes').select('*')).data.length >= 1, 'desenvolvedora vê todas');
  const up = await ana.sb.from('sugestoes').update({ situacao: 'feita', resposta: 'Na lista' }).eq('id', data[0].id).select();
  ok(up.data?.[0]?.resposta === 'Na lista', 'desenvolvedora responde');
  ok((await ana.sb.from('sugestoes').update({ texto: 'alterado' }).eq('id', data[0].id)).error, 'nem a desenvolvedora reescreve a sugestão');
  ok((await mestre.sb.from('sugestoes').select('resposta').eq('id', data[0].id).single()).data.resposta === 'Na lista', 'autor lê a resposta');
  ok((await ana.sb.from('desenvolvedores').select('*')).error, 'lista de desenvolvedores não é legível');
  await admin.from('desenvolvedores').delete().eq('email', ana.email);
}

// Exclusão de conta.
{
  ok(!(await rpc(fora, 'excluir_minha_conta', {})).erro, 'exclui a própria conta');
  const { data } = await admin.auth.admin.getUserById(fora.id);
  ok(!data?.user, 'conta removida');
}

for (const u of [mestre, ana, bia]) await admin.auth.admin.deleteUser(u.id);
console.log(falhas ? `${falhas} de ${total} verificações FALHARAM` : `${total}/${total} regras de acesso ok`);
process.exit(falhas ? 1 : 0);
