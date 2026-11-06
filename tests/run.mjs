#!/usr/bin/env node
// Testes de ponta a ponta do index.html gerado, abrindo por file:// como o usuário faria offline.
// Cada cenário roda em celular (390 px) e desktop (1280 px), com e sem GSAP.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_APP = pathToFileURL(path.join(root, 'index.html')).href;
const GSAP = fs.readFileSync(path.join(root, 'node_modules/gsap/dist/gsap.min.js'), 'utf8');

const OLD_STATE = {
  v: 2, used: { 1: 2, 2: 1 }, extra: { 1: 1, 2: 0 }, res: { sp: 1, innate: 1, jaunt: 2, luck: 0, hd: 3 }, hp: 17, temp: 5, conc: null,
  fx: { innate: false, shield: false, mirror: 0 }, spLog: [{ t: '20:15', d: -3, txt: 'Magia Gêmea', sp: 1 }],
  items: [{ id: 'x1', name: 'Poção de teste', note: 'nota', qty: 3, cat: 'cons', unit: '' }], ui: { tab: 'mochila', filter: 'all' }
};
const OLD_NOTES = {
  v: 1, topics: [{ id: 't-geral', name: 'Geral', c: '#d5dbe3' }, { id: 't-npc', name: 'NPCs da Campanha do Norte', c: '#9fdcff' }],
  notes: [{ id: 'n1', topic: 't-npc', pinned: true, created: 1, updated: 2, title: 'Mestre Halvar', html: '<p>Suspeito da traição</p>' }],
  ui: { topic: 'all', open: null }
};

const VIEWPORTS = { celular: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { falhas++; console.log(`    FALHOU: ${msg}`); } };

async function abrir(browser, { viewport, comGsap, seed }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: comGsap ? 'no-preference' : 'reduce' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/cdnjs\.cloudflare\.com/, r => (comGsap ? r.fulfill({ contentType: 'text/javascript', body: GSAP }) : r.abort()));
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  if (seed) await page.addInitScript(([k, s, kn, n]) => {
    if (!sessionStorage.getItem('semeado')) { sessionStorage.setItem('semeado', '1'); localStorage.setItem(k, s); localStorage.setItem(kn, n); }
  }, ['soren-frostgaard-nv4', JSON.stringify(OLD_STATE), 'soren-frostgaard-nv4-notas', JSON.stringify(OLD_NOTES)]);
  await page.goto(URL_APP);
  await page.waitForFunction(() => document.querySelector('#stats')?.children.length > 0);
  return { ctx, page, erros };
}
const estado = page => page.evaluate(() => ({ used: state.used, extra: state.extra, res: state.res, hp: state.hp, temp: state.temp, items: state.items.map(i => i.name), log: state.spLog.length, tab: state.ui.tab, nome: activeChar().name, n: store.characters.length, notas: notes.notes.map(x => x.title) }));
const fecharToast = page => page.evaluate(() => document.querySelector('#toast')?.classList.remove('show'));
const clicar = (page, sel) => page.locator(sel).first().click({ timeout: 4000 });
const aba = (page, t) => page.evaluate(x => setTab(x), t);
async function novoPersonagem(page, nome) {
  await clicar(page, '[data-action="chars"]');
  await clicar(page, '[data-action="char-new"]');
  await page.fill('#c-name', nome);
  await page.press('#c-name', 'Enter');
  await page.waitForFunction(n => activeChar().name === n, nome);
  await page.waitForFunction(() => document.querySelector('#modal').hidden);
}
async function trocarPara(page, nome) {
  await clicar(page, '[data-action="chars"]');
  await page.locator('.char-pick', { hasText: nome }).first().click();
  await page.waitForFunction(n => activeChar().name.startsWith(n), nome);
  await page.waitForFunction(() => document.querySelector('#modal').hidden);
}
async function novaNota(page, titulo) {
  await page.evaluate(() => { setTab('notas'); newNote(); });
  await page.fill('#ne-title', titulo);
  await page.evaluate(() => flushNote());
}

const cenarios = {
  async 'migra os dados antigos sem perder nada'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, { ...opts, seed: true });
    const s = await estado(page);
    ok(s.nome === 'Søren Frostgaard', 'Søren é o personagem ativo');
    ok(s.used[1] === 2 && s.used[2] === 1 && s.extra[1] === 1, 'espaços gastos preservados');
    ok(s.res.sp === 1 && s.res.luck === 0 && s.res.hd === 3, 'recursos preservados');
    ok(s.hp === 17 && s.temp === 5, 'PV preservados');
    ok(s.items.length === 1 && s.items[0] === 'Poção de teste', 'inventário preservado');
    ok(s.log === 1, 'histórico de PF preservado');
    ok(s.tab === 'mochila', 'aba aberta preservada');
    ok(s.notas.includes('Mestre Halvar'), 'nota preservada no Søren');
    const antigas = await page.evaluate(() => [localStorage.getItem('soren-frostgaard-nv4'), localStorage.getItem('soren-frostgaard-nv4-notas'), !!localStorage.getItem('grimorio-v3')]);
    ok(antigas[0] === JSON.stringify(OLD_STATE), 'chave antiga da ficha intacta');
    ok(antigas[1] === JSON.stringify(OLD_NOTES), 'chave antiga das notas intacta');
    ok(antigas[2], 'store v3 criada');
    await aba(page, 'magia');
    await clicar(page, '[data-action="slot"][data-lv="1"]');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#stats')?.children.length > 0);
    const s2 = await estado(page);
    ok(s2.notas.includes('Mestre Halvar') && s2.hp === 17, 'dados continuam após recarregar');
    ok(await page.evaluate(() => localStorage.getItem('soren-frostgaard-nv4')) === JSON.stringify(OLD_STATE), 'chave antiga segue intacta após salvar');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'primeira abertura sem dados mostra a ficha do Søren'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const n = await page.evaluate(() => ({ ac: ac(), dc: dc(), hp: state.hp, atk: CHAR.stats.atk, slots: CHAR.slots, sp: state.res.sp, spells: SPELLS.length, nome: document.querySelector('#char-name-txt').textContent }));
    ok(n.ac === 16 && n.dc === 14 && n.hp === 30 && n.atk === 6, 'números da ficha conferem');
    ok(n.slots[1] === 4 && n.slots[2] === 3 && n.sp === 4, 'espaços e PF conferem');
    ok(n.spells === 16, '16 magias do Søren');
    ok(n.nome === 'Søren Frostgaard', 'nome no cabeçalho');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'conjurar, rolar, desfazer e descansar continuam iguais'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await aba(page, 'grimorio');
    await clicar(page, '[data-action="spell"][data-id]:not([disabled])');
    await page.waitForSelector('[data-action="cast"]:not([disabled])');
    const antes = await estado(page);
    const lv = await page.locator('[data-action="cast"]:not([disabled])').first().getAttribute('data-lv');
    await clicar(page, '[data-action="cast"]:not([disabled])');
    const depois = await estado(page);
    if (+lv) ok(depois.used[lv] === antes.used[lv] + 1, 'conjurar gasta o espaço');
    await page.keyboard.press('Control+z');
    const desfeito = await estado(page);
    if (+lv) ok(desfeito.used[lv] === antes.used[lv], 'desfazer devolve o espaço');
    await page.evaluate(() => { closeModal(); document.querySelector('[data-action="roll-hide"]')?.click(); });
    await page.evaluate(() => commit('Teste', st => { st.used[1] = 4; st.res.sp = 0; st.hp = 5; }));
    await page.evaluate(() => longRest());
    await page.waitForFunction(() => state.hp === 30, null, { timeout: 8000 });
    const d = await estado(page);
    ok(d.used[1] === 0 && d.res.sp === 4, 'Descanso Longo restaura');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'personagens ficam separados, notas incluídas'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, { ...opts, seed: true });
    await novoPersonagem(page, 'Lyra Ventoleve');
    let s = await estado(page);
    ok(s.n === 2 && s.nome === 'Lyra Ventoleve', 'novo personagem ativo');
    ok(await page.locator('#char-name-txt').textContent() === 'Lyra Ventoleve', 'cabeçalho mostra o novo nome');
    ok(!s.notas.includes('Mestre Halvar'), 'nota do Søren não aparece na Lyra');
    ok(s.items.length === 0, 'mochila da Lyra vazia');
    for (const t of ['ficha', 'magia', 'grimorio', 'recursos', 'mochila', 'notas']) await aba(page, t);
    await novaNota(page, 'Segredo da Lyra');
    await page.evaluate(() => commit('Teste', st => { st.hp = 2; }));
    await trocarPara(page, 'Søren');
    s = await estado(page);
    ok(s.hp === 17 && s.used[1] === 2, 'estado do Søren intacto');
    ok(s.notas.includes('Mestre Halvar') && !s.notas.includes('Segredo da Lyra'), 'notas do Søren separadas');
    ok(await page.evaluate(() => undoStack.length) === 0, 'desfazer não atravessa personagens');
    await trocarPara(page, 'Lyra');
    s = await estado(page);
    ok(s.hp === 2 && s.notas.includes('Segredo da Lyra'), 'Lyra mantém estado e notas');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#stats')?.children.length > 0);
    s = await estado(page);
    ok(s.nome === 'Lyra Ventoleve', 'personagem ativo lembrado ao recarregar');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'notas de campanha são compartilhadas'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, { ...opts, seed: true });
    await aba(page, 'notas');
    await clicar(page, '[data-action="note-scope"][data-s="camp"]');
    let s = await estado(page);
    ok(s.notas.length === 0, 'campanha começa vazia');
    await novaNota(page, 'Mapa do Norte');
    await novoPersonagem(page, 'Bram');
    s = await estado(page);
    ok(s.notas.includes('Mapa do Norte'), 'nota de campanha aparece no outro personagem');
    await aba(page, 'notas');
    await page.evaluate(() => { flushNote(); notes.ui.open = null; renderNoteList(); renderNoteEditor(); });
    await clicar(page, '[data-action="note-scope"][data-s="char"]');
    s = await estado(page);
    ok(!s.notas.includes('Mapa do Norte') && !s.notas.includes('Mestre Halvar'), 'escopo do personagem não mistura');
    ok(await page.locator('#note-scope').textContent().then(t => t.includes('Notas de Bram')), 'seletor mostra o nome do personagem');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'tópicos das notas não ficam cortados'({ browser, opts, nome }) {
    const { ctx, page, erros } = await abrir(browser, { ...opts, seed: true });
    await aba(page, 'notas');
    await page.evaluate(() => {
      for (const n of ['Sessões', 'Lugares', 'Missões', 'Lore e Segredos', 'Facções do Norte', 'Inimigos jurados', 'Tesouros perdidos']) notes.topics.push({ id: 't' + n, name: n, c: '#ff9d8a' });
      saveNotes(); renderNoteList();
    });
    const m = await page.evaluate(() => {
      const t = document.querySelector('#note-topics'), r = t.getBoundingClientRect(), chips = [...t.children].map(c => c.getBoundingClientRect());
      return { sw: t.scrollWidth, cw: t.clientWidth, dentro: chips.every(c => c.left >= r.left - 1 && c.right <= r.right + 1 && c.right <= innerWidth), col: getComputedStyle(t).flexDirection, wrap: getComputedStyle(t).flexWrap, doc: document.documentElement.scrollWidth, vw: innerWidth, listaEsq: document.querySelector('#note-list').getBoundingClientRect().left, topR: r.right };
    });
    ok(m.sw <= m.cw + 1, `sem rolagem lateral (${m.sw} > ${m.cw})`);
    ok(m.dentro, 'todos os tópicos visíveis por inteiro');
    ok(m.doc <= m.vw, 'página sem estouro horizontal');
    if (nome === 'celular') ok(m.wrap === 'wrap', 'tópicos quebram linha no celular');
    else ok(m.col === 'column' && m.topR <= m.listaEsq, 'tópicos em coluna lateral no desktop');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'duplicar, excluir com desfazer e exportar/importar'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, { ...opts, seed: true });
    await clicar(page, '[data-action="chars"]');
    await clicar(page, '[data-action="char-dup"]');
    await page.waitForFunction(() => store.characters.length === 2);
    await page.waitForFunction(() => document.querySelector('#modal').hidden);
    let s = await estado(page);
    ok(s.nome === 'Søren Frostgaard (cópia)', 'cópia ativa');
    ok(s.hp === 17 && !s.notas.includes('Mestre Halvar'), 'cópia leva a ficha, não as notas');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportData())]);
    const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok(backup.tipo === 'backup' && backup.store.characters.length === 2, 'backup completo');
    ok(/^grimorio-backup-/.test(dl.suggestedFilename()), 'nome do backup');
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportCharacter(store.activeId))]);
    const ficha = fs.readFileSync(await dl2.path());
    ok(JSON.parse(ficha).tipo === 'personagem', 'exportação de personagem');
    await page.evaluate(() => deleteCharacter(store.activeId));
    s = await estado(page);
    ok(s.n === 1 && s.nome === 'Søren Frostgaard', 'exclusão volta ao restante');
    await clicar(page, '#toast button');
    s = await estado(page);
    ok(s.n === 2, 'desfazer recupera o personagem');
    await page.evaluate(() => deleteCharacter(store.activeId));
    await page.setInputFiles('#file', { name: 'p.json', mimeType: 'application/json', buffer: ficha });
    await page.waitForFunction(() => store.characters.length === 2);
    ok((await estado(page)).nome === 'Søren Frostgaard (cópia)', 'personagem importado');
    await page.setInputFiles('#file', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForFunction(() => document.querySelector('#toast .msg').textContent.includes('Backup importado'));
    ok((await estado(page)).n === 2, 'backup completo importado');
    await trocarPara(page, 'Søren Frostgaard');
    const legado = JSON.stringify({ app: 'soren-frostgaard-nv4', state: { ...OLD_STATE, hp: 9 }, notes: OLD_NOTES });
    await page.setInputFiles('#file', { name: 'l.json', mimeType: 'application/json', buffer: Buffer.from(legado) });
    await page.waitForFunction(() => state.hp === 9);
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },
};

const browser = await chromium.launch();
for (const [nome, viewport] of Object.entries(VIEWPORTS)) for (const comGsap of [true, false]) {
  console.log(`\n${nome}, ${comGsap ? 'com' : 'sem'} GSAP`);
  for (const [titulo, fn] of Object.entries(cenarios)) {
    const antes = falhas;
    try { await fn({ browser, nome, opts: { viewport, comGsap } }); }
    catch (e) { falhas++; total++; console.log(`    ERRO: ${e.message.split('\n')[0]}`); }
    console.log(`  ${falhas === antes ? 'ok  ' : 'FALHA'} ${titulo}`);
  }
}
await browser.close();
console.log(`\n${total - falhas}/${total} verificações passaram`);
process.exit(falhas ? 1 : 0);
