#!/usr/bin/env node
// Percorre o site montado com o Supabase local, com pessoas e aparelhos diferentes.
// O login por e-mail existe só no ambiente local de teste; no site real o acesso é pelo Google.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { chavesLocais } from './nuvem-local.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'http://127.0.0.1:54321';
const { ANON, SERVICE } = chavesLocais();
const FOTOS = process.env.FOTOS || '';
execFileSync(process.execPath, ['tools/build-site.mjs'], { cwd: root, env: { ...process.env, SUPABASE_URL: API, SUPABASE_ANON_KEY: ANON } });

const dist = path.join(root, 'dist');
const csp = fs.readFileSync(path.join(dist, '_headers'), 'utf8').match(/Content-Security-Policy: (.*)/)[1];
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/json' };
const servidor = http.createServer((q, r) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname), f = path.join(dist, p === '/' ? 'index.html' : p);
  if (!f.startsWith(dist) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'text/plain', 'content-security-policy': csp });
  r.end(fs.readFileSync(f));
}).listen(4173, '127.0.0.1');
const SITE = 'http://127.0.0.1:4173/';

let falhas = 0, total = 0;
const ok = (c, m) => { total++; console.log(`${c ? '  ok  ' : '  FALHOU:'} ${m}`); if (!c) falhas++; };
const admin = createClient(API, SERVICE, { auth: { persistSession: false } });
const sufixo = Date.now().toString(36);
const browser = await chromium.launch();
const erros = [];

async function pessoa(nome, viewport) {
  const ctx = await browser.newContext({ viewport, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true, reducedMotion: 'reduce' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, r => r.abort());
  return { ctx, nome, email: `${nome.toLowerCase()}-${sufixo}@exemplo.test` };
}
async function abrir(p, url = SITE) {
  const page = await p.ctx.newPage();
  page.on('pageerror', e => erros.push(`${p.nome}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|fonts\.|cdnjs|Failed to load resource/.test(m.text())) erros.push(`${p.nome}: ${m.text()}`); });
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#stats')?.children.length > 0);
  await page.waitForFunction(() => nuvem.sb);
  return page;
}
const criarConta = (page, p) => page.evaluate(async ({ email, nome }) => { const r = await nuvem.sb.auth.signUp({ email, password: 'senha-de-teste-123', options: { data: { name: nome } } }); return r.error?.message; }, { email: p.email, nome: p.nome });
const entrar = (page, p) => page.evaluate(async ({ email }) => { await nuvem.sb.auth.signInWithPassword({ email, password: 'senha-de-teste-123' }); }, { email: p.email });
const logado = page => page.waitForFunction(() => nuvem.user && nuvem.perfil && mesas.lista);
const parado = page => page.waitForFunction(() => !nuvem.enviando && nuvem.estado === 'ok' && store.characters.every(c => c.rascunho || c.nh === hashDe(c)), null, { timeout: 15000 });
async function sincroniza(page) { await page.waitForTimeout(1700); await parado(page); }
async function criarPersonagem(page, nome) {
  await page.fill('#c-name', nome);
  await page.press('#c-name', 'Enter');
  await page.waitForSelector('#cw-cl');
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(60);
    if (await page.locator('[data-action="cw-finish"]').count()) { await page.click('[data-action="cw-finish"]'); break; }
    const c = page.locator('[data-cwskill]');
    if (await c.count()) { const q = await page.evaluate(() => cwClasse().skills[0]); for (let k = 0; k < q; k++) { await c.nth(k).check(); await page.waitForTimeout(40); } }
    await page.click('[data-action="cw-next"]');
  }
  await page.waitForFunction(n => activeChar().name === n, nome);
}
const foto = (page, n) => (FOTOS ? page.screenshot({ path: path.join(FOTOS, `${n}.png`) }) : null);

const mestre = await pessoa('Mestre', { width: 1280, height: 800 });
const ana = await pessoa('Ana', { width: 390, height: 844 });
const bia = await pessoa('Bia', { width: 390, height: 844 });

// Primeira visita.
const pm = await abrir(mestre);
ok(await pm.evaluate(() => activeChar().rascunho === true && !store.characters.some(c => c.template === 'soren')), 'visitante novo não recebe a ficha do Søren');
ok(await pm.locator('[data-action="nuvem-login"]').isVisible(), 'aba Mesas abre com Entrar com Google');
await foto(pm, '1-entrada');
const oauth = await pm.evaluate(async () => (await nuvem.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/', skipBrowserRedirect: true } })).data.url);
ok(/provider=google/.test(oauth) && /code_challenge=/.test(oauth), 'login pede o Google com PKCE');

// Mestre cria a campanha com senha.
await criarConta(pm, mestre); await logado(pm);
await pm.click('[data-action="mesa-criar"]');
await pm.fill('#mc-nome', 'A <b>Costa</b> Perdida');
await pm.fill('#mc-desc', 'Sextas à noite');
await pm.fill('#mc-sen', 'dragao');
await pm.click('#mesa-criar-form .btn.gold');
await pm.waitForSelector('.mesa-convite');
const codigo = await pm.evaluate(() => mesas.det.c.codigo);
ok(await pm.locator('#mesas-view h2 b').count() === 0, 'nome da campanha não vira HTML');
await pm.click('[data-action="mesa-link"]');
await pm.waitForTimeout(100);
const link = await pm.evaluate(() => navigator.clipboard.readText());
ok(link === `${SITE}?c=${codigo}` || link.endsWith(`?c=${codigo}`), 'mestre copia o link de convite');
await foto(pm, '2-campanha-mestre');

// Jogadora chega pelo link, antes de entrar na conta.
const pa = await abrir(ana, link);
ok(await pa.evaluate(() => state.ui.tab === 'mesas' && !location.search), 'link abre a aba Mesas e guarda o convite');
await criarConta(pa, ana); await logado(pa);
await pa.waitForSelector('#mesa-entrar-form');
await pa.waitForFunction(() => /Costa/.test(document.querySelector('#mesa-previa').textContent));
ok(/Precisa de senha/.test(await pa.locator('#mesa-previa').textContent()), 'convite mostra a campanha e pede senha');
await pa.fill('#mesa-sen', 'errada');
await pa.click('#mesa-entrar-form .btn.gold');
await pa.waitForFunction(() => /incorreta/.test(document.querySelector('#mesa-msg').textContent));
ok(true, 'senha errada avisa e não entra');
await pa.fill('#mesa-sen', 'dragao');
await pa.click('#mesa-entrar-form .btn.gold');
await pa.waitForSelector('[data-action="mesa-novo-pc"]');
ok(await pa.locator('.mesa-convite').count() === 0, 'jogadora não vê o código de convite');

// Personagem novo entra direto na campanha.
await pa.click('[data-action="mesa-novo-pc"]');
await criarPersonagem(pa, 'Lyra <i>Ventoleve</i>');
await pa.waitForFunction(() => mesas.det?.elenco.some(e => e.situacao === 'ativo' && e.jogador === nuvem.user.id), null, { timeout: 15000 });
ok(await pa.evaluate(() => !store.characters.some(c => c.rascunho)), 'primeiro personagem substitui o rascunho');
await foto(pa, '3-campanha-jogadora');

// Mestre vê o nome, nada da ficha, e anota.
await pm.click('[data-action="mesa-atualizar"]');
await pm.waitForFunction(() => mesas.det.elenco.length === 1);
const cartao = await pm.locator('.elenco').first().innerText();
ok(cartao.includes('Lyra <i>Ventoleve</i>') && cartao.includes('Ana'), 'mestre vê personagem e jogadora, sem HTML injetado');
ok(!/Feiticeir|Classe|PV|CA /.test(cartao), 'cartão não mostra detalhes da ficha');
await pm.locator('.elenco textarea').first().fill('Parece esconder algo');
await pm.waitForTimeout(1000);
await pm.click('[data-action="mesa-nota-nova"]');
await pm.waitForSelector('.mesa-nota input');
await pm.locator('.mesa-nota input').fill('Segredo do vilão');
await pm.locator('.mesa-nota textarea').fill('O prefeito é o dragão');
await pm.waitForTimeout(900);
await pm.click('[data-action="mesa-atualizar"]');
await pm.waitForTimeout(400);
ok(await pm.locator('.elenco textarea').first().inputValue() === 'Parece esconder algo', 'anotação sobre o personagem fica salva');
ok(await pm.locator('.mesa-nota textarea').inputValue() === 'O prefeito é o dragão', 'nota do mestre fica salva');
await pa.click('[data-action="mesa-atualizar"]');
await pa.waitForTimeout(400);
ok(!/prefeito|esconder/.test(await pa.locator('#mesas-view').innerText()), 'jogadora não lê as notas do mestre');
await pm.click('[data-action="mesa-nota-mesa"]');
await pm.waitForTimeout(400);
await pa.click('[data-action="mesa-atualizar"]');
await pa.waitForFunction(() => /prefeito/.test(document.querySelector('#mesas-view').innerText));
ok(true, 'nota compartilhada aparece para a mesa');

// Ficha acompanha a conta em outro aparelho, e a biblioteca pessoal não sobe.
await pa.evaluate(async () => {
  await ensureLibrary(); const { _hay: _x, ...modelo } = libGet('fire-bolt');
  const c = activeChar();
  c.grimoire.added.push({ ...modelo, id: 'p-teste', name: 'Magia Pessoal', src: 'pessoal', desc: ['TRECHO DO LIVRO'], higher: 'MAIS TEXTO', orig: { desc: ['ORIGINAL'] } });
  state.hp = 3; save();
});
await sincroniza(pa);
const { data: linhas } = await admin.from('personagens').select('dados');
const bruto = JSON.stringify(linhas);
ok(bruto.includes('Magia Pessoal') && !/TRECHO DO LIVRO|MAIS TEXTO|ORIGINAL/.test(bruto), 'texto da biblioteca pessoal não vai para o servidor');
ok(await pa.evaluate(() => activeChar().grimoire.added.find(s => s.id === 'p-teste').desc[0] === 'TRECHO DO LIVRO'), 'texto continua neste aparelho');
const ana2 = await pessoa('Ana', { width: 390, height: 844 });
const pa2 = await abrir(ana2);
await entrar(pa2, ana); await logado(pa2);
await pa2.waitForFunction(() => activeChar().name.startsWith('Lyra'));
ok(await pa2.evaluate(() => state.hp) === 3, 'outro aparelho recebe a ficha com o estado atual');
await pa2.evaluate(() => { state.hp = 2; save(); }); await sincroniza(pa2);
await pa.evaluate(() => { state.hp = 1; save(); }); await sincroniza(pa);
ok(await pa.evaluate(() => store.characters.some(c => c.name.endsWith('(conflito)')) && state.hp === 2), 'edição simultânea preserva as duas versões');
await pa.evaluate(() => { deleteCharacter(store.characters.find(c => c.name.endsWith('(conflito)')).id); });
await sincroniza(pa);
await pa2.close(); await ana2.ctx.close();

// Morte.
await pa.evaluate(() => setTab('recursos'));
await pa.fill('#hp-amt', '2');
await pa.click('[data-action="hp"][data-op="dmg"]');
await pa.waitForSelector('[data-action="morte-rolar"]');
await pa.fill('#hp-amt', '1'); await pa.click('[data-action="hp"][data-op="dmg"]');
ok(await pa.evaluate(() => state.morte.f) === 1, 'dano a 0 PV soma uma falha');
await foto(pa, '4-salvaguardas');
await pa.fill('#morte-val', '14'); await pa.click('[data-action="morte-dado"]');
ok(await pa.evaluate(() => state.morte.s) === 1, 'dado físico 14 conta sucesso');
await pa.fill('#morte-val', '1'); await pa.click('[data-action="morte-dado"]');
await pa.waitForSelector('.cena-morte');
ok(await pa.evaluate(() => state.morte.morto), 'um natural completa as três falhas');
await pa.click('.cena-morte');
await pa.waitForSelector('#morte-causa');
await pa.fill('#morte-causa', 'Sopro do dragão');
await foto(pa, '5-morte');
await pa.click('#morte-form .btn:not(.gold)');
await sincroniza(pa);
await pm.click('[data-action="mesa-atualizar"]');
await pm.waitForFunction(() => mesas.det.elenco[0].situacao === 'morto');
ok(/Sopro do dragão/.test(await pm.locator('.elenco.morto').innerText()), 'mesa vê a morte e a causa');
ok(await pm.locator('.elenco.morto textarea').inputValue() === 'Parece esconder algo', 'anotações sobre quem caiu continuam');

// Volta com outro personagem.
await pa.evaluate(() => setTab('recursos'));
await pa.click('[data-action="morte-novo"]');
await criarPersonagem(pa, 'Borin');
await pa.waitForFunction(() => mesas.det?.elenco.some(e => e.nome === 'Borin' && e.situacao === 'ativo'), null, { timeout: 15000 });
ok(await pa.locator('.elenco.morto').count() === 1, 'morto vai para Caídos e o novo personagem entra na mesa');
await pa.click('[data-action="chars"]');
ok(/Morto/.test(await pa.locator('.char-row', { hasText: 'Lyra' }).innerText()), 'lista de personagens marca quem morreu');
await pa.click('.m-close');

// Mestre declara morte: a ficha acompanha.
await pm.click('[data-action="mesa-atualizar"]');
await pm.waitForFunction(() => mesas.det.elenco.some(e => e.nome === 'Borin'));
await sincroniza(pa);
await pm.click('.elenco:not(.morto) [data-action="mesa-morte"]');
await pm.fill('#mm-causa', 'Caiu no abismo');
await pm.click('[data-action="mesa-morte-ok"]');
await pm.waitForFunction(() => mesas.det.elenco.every(e => e.situacao === 'morto'));
await pa.click('[data-action="mesa-atualizar"]');
await pa.waitForFunction(() => state.morte.morto && state.hp === 0);
ok(await pa.evaluate(() => state.morte.causa) === 'Caiu no abismo', 'morte declarada pelo mestre chega à ficha');
await sincroniza(pa);
await pm.locator('[data-action="mesa-reverter"]').nth(1).click();
await pm.waitForFunction(() => mesas.det.elenco.some(e => e.nome === 'Borin' && e.situacao === 'ativo'));
await pa.click('[data-action="mesa-atualizar"]');
await pa.waitForFunction(() => !state.morte.morto && state.hp === 1);
ok(true, 'mestre desfaz a morte e a ficha volta');

// Exportar e importar com a conta.
await sincroniza(pa);
await pa.click('[data-action="chars"]');
const [download] = await Promise.all([pa.waitForEvent('download'), pa.locator('.char-row', { hasText: 'Borin' }).locator('[data-action="char-export"]').click()]);
const arq = await download.path();
const exportado = JSON.parse(fs.readFileSync(arq, 'utf8'));
ok(exportado.tipo === 'personagem' && !('nv' in exportado.character) && !('nh' in exportado.character), 'exportação não leva dados de sincronização');
await pa.click('.m-close');
await pa.setInputFiles('#file', { name: 'borin.json', mimeType: 'application/json', buffer: fs.readFileSync(arq) });
await pa.waitForFunction(n => store.characters.filter(c => c.name === n).length === 2, 'Borin');
await sincroniza(pa);
const contados = await admin.from('personagens').select('id', { count: 'exact', head: true }).eq('nome', 'Borin').eq('dono', await pa.evaluate(() => nuvem.user.id));
ok(contados.count === 2, 'personagem importado sobe para a conta');

// Sugestões.
await pa.evaluate(() => setTab('sugestoes'));
await pa.waitForSelector('#sug-form');
await pa.fill('#sg-texto', 'Quero mapas <script>alert(1)</script>');
await pa.click('#sug-form .btn.gold');
await pa.waitForFunction(() => sug.lista?.length === 1);
await foto(pa, '6-sugestoes');
await pm.evaluate(() => setTab('sugestoes'));
await pm.waitForSelector('#sug-form');
ok(await pm.locator('#sugestoes-view .elenco').count() === 0, 'conta comum não vê sugestões alheias');
await admin.from('desenvolvedores').insert({ email: mestre.email });
const dev = await pm.evaluate(async () => { const { data } = await nuvem.sb.rpc('sou_dev'); nuvem.dev = data; await sugestoesCarregar(); return data; });
ok(dev === true, 'desenvolvedor reconhecido');
await pm.waitForSelector('[data-sug-sit]');
ok(/Quero mapas <script>/.test(await pm.locator('#sugestoes-view .elenco').innerText()), 'painel lista a sugestão como texto');
await foto(pm, '7-painel-dev');
await pm.fill('[data-sug-resp]', 'Entrou na fila');
await pm.locator('[data-sug-resp]').blur();
await pm.waitForTimeout(400);
await pm.selectOption('[data-sug-sit]', 'lida');
await pm.waitForTimeout(400);
await pa.evaluate(() => sugestoesCarregar());
await pa.waitForFunction(() => /Entrou na fila/.test(document.querySelector('#sugestoes-view').innerText));
ok(true, 'autora lê a resposta');
await admin.from('desenvolvedores').delete().eq('email', mestre.email);

// Sair limpa o navegador; outra conta não herda nada.
await pa.evaluate(() => setTab('mesas'));
await pa.evaluate(() => nuvemSair());
await pa.waitForFunction(() => !nuvem.user && activeChar().rascunho);
ok(await pa.evaluate(() => !JSON.stringify(store).includes('Borin')), 'sair remove as fichas deste navegador');
await criarConta(pa, bia); await logado(pa);
await pa.waitForTimeout(600);
ok(await pa.evaluate(() => store.characters.every(c => c.rascunho)), 'conta nova no mesmo navegador não herda fichas');
await pa.evaluate(() => nuvemSair());
await pa.waitForFunction(() => !nuvem.user);
await entrar(pa, ana); await logado(pa);
await pa.waitForFunction(() => store.characters.filter(c => c.name === 'Borin').length === 2 && mesas.lista.length === 1);
ok(true, 'ao voltar, fichas e campanhas retornam da conta');

// Trocar código e apagar.
const antigo = codigo;
await pm.evaluate(() => { setTab('mesas'); });
await pm.waitForTimeout(300);
await pm.click('[data-action="mesa-novo-codigo"]');
await pm.click('[data-action="mesa-novo-codigo-ok"]');
await pm.waitForFunction(c => mesas.det.c.codigo !== c, antigo);
ok(true, 'mestre gera novo código');
await pm.click('[data-action="mesa-apagar"]');
await pm.click('[data-action="mesa-apagar-ok"]');
await pm.waitForFunction(() => mesas.lista.length === 0 && !mesas.aberta);
ok(true, 'mestre apaga a campanha');

ok(!erros.length, `sem erros de JS nem de segurança: ${erros.slice(0, 5).join(' | ')}`);
for (const p of [mestre, ana, bia]) {
  const { data } = await admin.auth.admin.listUsers();
  const u = data.users.find(x => x.email === p.email);
  if (u) await admin.auth.admin.deleteUser(u.id);
}
await browser.close(); servidor.close();
console.log(falhas ? `${falhas} de ${total} FALHARAM` : `${total}/${total} verificações do site`);
process.exit(falhas ? 1 : 0);
