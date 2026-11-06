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

const DMG = { Fogo: '#ffb347', Frio: '#bfeeff' };
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
const DMG_FOGO = '#ffb347', DMG_FRIO = '#bfeeff';
const clicar = (page, sel) => page.locator(sel).first().click({ timeout: 4000 });
const aba = (page, t) => page.evaluate(x => setTab(x), t);
async function novoPersonagem(page, nome) {
  await clicar(page, '[data-action="chars"]');
  await clicar(page, '[data-action="char-new"]');
  await page.fill('#c-name', nome);
  await page.press('#c-name', 'Enter');
  await page.waitForSelector('[data-action="cw-next"]');
  await assistente(page);
  await page.waitForFunction(n => activeChar().name === n, nome);
  await page.waitForFunction(() => document.querySelector('#modal').hidden);
}
/** Percorre o assistente de criação com as opções padrão. */
async function assistente(page, ajustes = {}) {
  for (let i = 0; i < 8; i++) {
    if (ajustes[i]) await ajustes[i]();
    if (i === 3 && !ajustes[3]) { const c = page.locator('[data-cwskill]'); await c.nth(0).check(); await page.waitForSelector('[data-cwskill]'); await page.locator('[data-cwskill]').nth(1).check(); }
    await clicar(page, i === 7 ? '[data-action="cw-finish"]' : '[data-action="cw-next"]');
  }
}
async function trocarPara(page, nome) {
  await clicar(page, '[data-action="chars"]');
  await page.locator('.char-pick', { hasText: nome }).first().click();
  await page.waitForFunction(n => activeChar().name.startsWith(n), nome);
  await page.waitForFunction(() => document.querySelector('#modal').hidden);
}
async function novaNota(page, titulo) {
  await page.evaluate(() => { setTab('notas'); newNote(); });
  await page.waitForTimeout(120); // a nota nova move o foco depois de 60 ms
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

  async 'motor de regras reproduz o Søren do nível 4'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const r = await page.evaluate(() => {
      const c = deriveSheet(activeChar()), s = SOREN, dif = [];
      for (const k of Object.keys(s.stats)) if (c.stats[k] !== s.stats[k]) dif.push(k + ': ' + c.stats[k] + ' x ' + s.stats[k]);
      if (JSON.stringify(c.slots) !== JSON.stringify(s.slots)) dif.push('slots');
      if (JSON.stringify(c.createSlotCost) !== JSON.stringify(s.createSlotCost)) dif.push('createSlotCost');
      if (c.carry !== s.carry) dif.push('carga ' + c.carry);
      if (c.conMod !== s.conMod || c.hitDie !== s.hitDie) dif.push('dado');
      for (const r of s.resources) { const x = c.resources.find(y => y.id === r.id); if (!x || x.max !== r.max || x.desc !== r.desc) dif.push('recurso ' + r.id + ': ' + (x && x.desc)); }
      for (const a of s.attacks) { const x = c.attacks.find(y => y.id === a.id); if (!x || x.atk !== a.atk || x.dmg !== a.dmg || x.calc !== a.calc) dif.push('ataque ' + a.id + ': ' + (x && x.calc + ' ' + x.dmg)); }
      for (const k of Object.keys(s.calc)) if (c.calc[k] !== s.calc[k]) dif.push('calc ' + k + ': ' + c.calc[k]);
      if (JSON.stringify(c.passives) !== JSON.stringify(s.passives)) dif.push('passivas');
      if (JSON.stringify(c.abilities.map(a => [a.k, a.s, !!a.prof])) !== JSON.stringify(s.abilities.map(a => [a.k, a.s, !!a.prof]))) dif.push('atributos');
      if (JSON.stringify(c.skills.filter(x => x[2])) !== JSON.stringify(s.skills.filter(x => x[2]))) dif.push('pericias');
      if (c.metamagic.length !== 2) dif.push('metamagia');
      if (c.subText !== activeChar().sub) dif.push('sub ' + c.subText);
      return dif;
    });
    ok(!r.length, 'motor diverge da ficha: ' + r.join(' | '));
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
    ok(s.items.includes('Lança') && !s.items.includes('Poção de teste'), 'mochila da Lyra é a do equipamento inicial');
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

  async 'as sete abas cabem na tela'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const m = await page.evaluate(() => { const t = [...document.querySelectorAll('.tab')].map(x => x.getBoundingClientRect()); return { n: t.length, topo: new Set(t.map(r => Math.round(r.top))).size, dentro: t.every(r => r.right <= innerWidth + 1 && r.left >= -1), vaza: [...document.querySelectorAll('.tab')].some(x => x.scrollWidth > x.clientWidth + 1) }; });
    ok(m.n === 7 && m.topo === 1, `sete abas numa linha só (${m.topo})`);
    ok(m.dentro && !m.vaza, 'nenhuma aba corta o texto');
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

  async 'as 339 magias estão em português'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const r = await page.evaluate(async () => {
      await ensureLibrary();
      const ms = libraryAll();
      const dados = t => [...String(t).matchAll(/\d+d\d+/g)].map(m => m[0]).sort().join(' ');
      const difDados = ms.filter(s => dados(s.desc.join(' ')) !== dados(s.orig.desc.join(' '))).map(s => s.id);
      return {
        total: ms.length, semPt: ms.filter(s => !s.ptOk).map(s => s.id), semNome: ms.filter(s => !s.name).length,
        ingles: ms.filter(s => /\b(the target|saving throw|you can|spell slot|within range)\b/i.test(s.desc.join(' ') + (s.higher || ''))).map(s => s.id),
        semSuperior: ms.filter(s => s.orig.higher && !s.higher).map(s => s.id), matIngles: ms.filter(s => /\b(worth|which the spell|a bit of|a pinch)\b/i.test(s.material || '')).map(s => s.id), difDados
      };
    });
    ok(r.total === 339 && !r.semPt.length, `todas traduzidas (faltam ${r.semPt.length}: ${r.semPt.slice(0, 6)})`);
    ok(!r.ingles.length, `sem inglês no texto: ${r.ingles.slice(0, 6)}`);
    ok(!r.matIngles.length, `materiais traduzidos: ${r.matIngles.slice(0, 6)}`);
    ok(!r.semSuperior.length, `círculos superiores traduzidos: ${r.semSuperior.slice(0, 6)}`);
    ok(r.difDados.length <= 12, `dados conferem com o original (${r.difDados.length}: ${r.difDados.slice(0, 12)})`);
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'biblioteca: busca, filtros e grimório'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await aba(page, 'grimorio');
    await clicar(page, '[data-action="grim-view"][data-v="lib"]');
    await page.waitForSelector('#lib-count');
    await page.selectOption('[data-lib="cls"]', '');
    await page.waitForFunction(() => document.querySelector('#lib-count').textContent.startsWith('339'));
    await page.fill('#lib-q', 'fireball');
    await page.waitForFunction(() => /^2 de/.test(document.querySelector('#lib-count').textContent));
    ok((await page.locator('.lib-card b').first().textContent()).includes('Bola de Fogo'), 'busca em inglês acha o nome em português');
    await page.fill('#lib-q', 'bola de fogo');
    await page.waitForFunction(() => /^2 de/.test(document.querySelector('#lib-count').textContent));
    await clicar(page, '[data-action="lib-clear"]');
    await page.waitForFunction(() => /^\d+ de 339/.test(document.querySelector('#lib-count').textContent));
    const feit = await page.evaluate(() => libraryAll().filter(s => s.classes.includes('sorcerer')).length);
    ok(feit > 100 && +(await page.locator('#lib-count').textContent()).split(' ')[0] === feit, 'filtro padrão é Feiticeiro');
    await page.selectOption('[data-lib="dmg"]', 'Fogo');
    await page.selectOption('[data-lib="level"]', '3');
    await page.waitForFunction(() => document.querySelectorAll('.lib-card').length > 0);
    const nomes = await page.locator('.lib-card b').allTextContents();
    ok(nomes.includes('Bola de Fogo'), 'filtros de círculo e dano');
    await clicar(page, '[data-action="lib-clear"]');
    await page.fill('#lib-q', 'fire bolt');
    await page.waitForFunction(() => /^1 de/.test(document.querySelector('#lib-count').textContent));
    await clicar(page, '.lib-card');
    await page.waitForSelector('[data-action="lib-add"]');
    await clicar(page, '[data-action="spell-orig"]');
    ok((await page.locator('.m-body').first().textContent()).toLowerCase().includes('hurl'), 'Ver original mostra o inglês');
    await clicar(page, '[data-action="lib-add"]');
    ok(await page.evaluate(() => !SPELL['fire-bolt']), 'limite de truques impede adicionar');
    ok((await page.locator('#toast .msg').textContent()).includes('truques'), 'mensagem do limite');
    await page.evaluate(() => { closeModal(); removeFromGrimoire('mind-sliver', true); });
    await page.evaluate(() => addToGrimoire('fire-bolt'));
    ok(await page.evaluate(() => !!SPELL['fire-bolt'] && !SPELL['mind-sliver']), 'trocar truque funciona');
    ok(await page.evaluate(() => baseDice(SPELL['fire-bolt'].r.find(x => x.t === 'dmg'))) === '1d10', 'truque no nível 4 = 1d10');
    await page.evaluate(() => { activeChar().level = 5; });
    ok(await page.evaluate(() => baseDice(SPELL['fire-bolt'].r.find(x => x.t === 'dmg'))) === '2d10', 'truque no nível 5 = 2d10');
    await page.evaluate(() => { activeChar().level = 17; });
    ok(await page.evaluate(() => baseDice(SPELL['fire-bolt'].r.find(x => x.t === 'dmg'))) === '4d10', 'truque no nível 17 = 4d10');
    await page.evaluate(() => { activeChar().level = 4; });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#stats')?.children.length > 0);
    ok(await page.evaluate(() => !!SPELL['fire-bolt'] && !SPELL['mind-sliver']), 'grimório sobrevive a recarregar');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'rolagens por círculo e editor com consumível'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await page.evaluate(() => { const c = activeChar(); buildOf(c).level = 7; buildOf(c).hpRolls = [4, 4, 4, 4, 4, 4]; c.level = 7; bindSheet(c); state = sanitize(state); render(); });
    await page.evaluate(() => ensureLibrary());
    await page.evaluate(() => { spellModal('fireball', true); });
    const bot = await page.locator('.rolls-box .rb').allTextContents();
    ok(bot.join(' ').includes('8d6') && bot.join(' ').includes('9d6'), `Bola de Fogo escala por círculo: ${bot}`);
    await page.evaluate(() => { closeModal(); spellModal('cure-wounds', true); });
    ok((await page.locator('.rolls-box').textContent()).replace(/\s/g, '').includes('2d8+4'), 'cura soma o modificador');
    await page.evaluate(() => closeModal());
    await page.waitForFunction(() => document.querySelector('#modal').hidden);
    await aba(page, 'grimorio');
    await clicar(page, '[data-action="grim-view"][data-v="lib"]');
    await page.waitForSelector('[data-action="spell-new"]');
    await clicar(page, '[data-action="spell-new"]');
    await page.fill('#e-name', 'Lança de Geada');
    await page.selectOption('#e-level', '1');
    await page.fill('#e-range', '18 m');
    await page.fill('#e-desc', 'Uma lança de gelo atinge o alvo.');
    await page.check('#e-atk');
    await clicar(page, '[data-action="ed-row-add"]');
    await page.fill('[data-r="d"]', '2d6');
    await page.selectOption('[data-r="type"]', 'Frio');
    await page.fill('[data-r="up"]', '1d6');
    await page.selectOption('#e-mat', 'web');
    await page.fill('#e-mat-n', '2');
    await page.locator('#spell-form button.gold').click();
    await page.waitForFunction(() => store.library.custom.length === 1);
    await page.waitForFunction(() => document.querySelector('#modal').hidden);
    const id = await page.evaluate(() => { const s = store.library.custom[0]; removeFromGrimoire('sleet-storm', true); const g = grimoireOf(activeChar()); g.removed.push(SPELLS.find(x => x.level === 1 && !x.draconic).id); bindSheet(activeChar()); addToGrimoire(s.id); return s.id; });
    ok(await page.evaluate(i => !!SPELL[i], id), 'magia criada entra no grimório');
    await page.evaluate(i => spellModal(i), id);
    const antes = await page.evaluate(() => state.items.find(i => i.key === 'web')?.qty);
    ok((await page.locator('.rolls-box').textContent()).includes('2d6'), 'dano da magia criada');
    await clicar(page, '[data-action="cast"]:not([disabled])');
    const depois = await page.evaluate(() => state.items.find(i => i.key === 'web')?.qty);
    ok(depois === antes - 2, `consumível descontado (${antes} -> ${depois})`);
    await page.keyboard.press('Control+z');
    ok(await page.evaluate(() => state.items.find(i => i.key === 'web')?.qty) === antes, 'desfazer devolve o consumível');
    await page.evaluate(() => closeModal());
    await page.waitForFunction(() => document.querySelector('#modal').hidden);
    await page.evaluate(() => { openEditor('fireball'); });
    await page.fill('#e-name', 'Bola de Fogo Azul');
    await page.locator('#spell-form button.gold').click();
    await page.waitForFunction(() => !!store.library.overrides.fireball);
    ok(await page.evaluate(() => libGet('fireball').name) === 'Bola de Fogo Azul', 'alteração vira override');
    await page.waitForFunction(() => document.querySelector('#modal').hidden);
    await page.evaluate(() => openEditor('fireball'));
    await clicar(page, '[data-action="ed-restore"]');
    await page.waitForFunction(() => !store.library.overrides.fireball);
    ok(await page.evaluate(() => libGet('fireball').name) === 'Bola de Fogo', 'restaurar original');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'importador da biblioteca pessoal'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const fixture = { app: 'grimorio', tipo: 'biblioteca-pessoal', schema: 1, magias: [
      { id: 'magia-de-teste', nome: 'Magia de Teste', nomeEn: 'Test Spell', circulo: 2, escola: 'evocation', classes: ['sorcerer'], tempo: 'Ação', alcance: '18 metros', comp: 'V, S', material: '', duracao: 'Instantânea', concentracao: false, ritual: false, texto: 'O alvo faz uma salvaguarda de Destreza e sofre 3d8 de dano Trovejante, ou metade se passar.', superior: 'Usando um Espaço de Magia de Círculo Superior. O dano aumenta em 1d8 para cada círculo.', fonte: { id: 'x', pagina: 1 } },
      { id: 'bola-de-fogo', nome: 'Bola de Fogo', nomeEn: 'Fireball', circulo: 3, escola: 'evocation', classes: ['sorcerer'], tempo: 'Ação', alcance: '45 metros', comp: 'V, S, M', material: 'enxofre', duracao: 'Instantânea', texto: 'Texto pessoal da bola de fogo.', superior: '', fonte: { id: 'x', pagina: 2 } }
    ] };
    await aba(page, 'grimorio');
    await clicar(page, '[data-action="grim-view"][data-v="lib"]');
    await page.waitForSelector('[data-action="lib-import"]');
    await page.setInputFiles('#lib-file', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.waitForFunction(() => privateSpells.length === 2);
    const r = await page.evaluate(() => { const a = libGet('p-magia-de-teste'), b = libGet('fireball'); return { rolls: a.r, nome: a.name, src: b.src, t: b.desc[0], up: a.r.find(x => x.t === 'dmg')?.up, dano: b.r.find(x => x.t === 'dmg')?.d, armazenado: localStorage.getItem('grimorio-v3').includes('Texto pessoal') }; });
    ok(r.nome === 'Magia de Teste' && r.rolls.some(x => x.t === 'save' && x.a === 'DES') && r.up === '1d8', 'magia pessoal ganha rolagens');
    ok(r.src === 'srd+pessoal' && r.t.includes('Texto pessoal') && r.dano === '8d6', 'versão pessoal completa a do SRD');
    ok(!r.armazenado, 'texto pessoal fica fora do localStorage');
    await page.reload();
    await page.waitForFunction(() => privateSpells.length === 2);
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'toda magia tem cena própria e sem erros'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const r = await page.evaluate(async () => {
      await ensureLibrary();
      ensureArt();
      await new Promise(ok => { const v = () => (window.GRIMORIO_ART ? ok() : setTimeout(v, 30)); v(); });
      const ms = [...libraryAll(), ...SPELLS], ids = [...new Set(ms.map(s => s.id))], sigs = new Set(), semCena = [], falhas = [], repetidas = [], semArte = [], verbos = new Set(), frases = [];
      for (const id of ids) {
        const c = CENAS[id];
        if (!c) { semCena.push(id); continue; }
        const sig = JSON.stringify([c[0], c.slice(2)]);
        if (sigs.has(sig)) repetidas.push(id);
        sigs.add(sig);
        if (!c[1]) frases.push(id);
        for (const [v, o = {}] of c.slice(2)) {
          verbos.add(v);
          if (!ATOS[v]) falhas.push(id + ': verbo ' + v);
          for (const k of ['art', 'de', 'para', 'flor']) if (String(o[k]).startsWith('@') && !GRIMORIO_ART[o[k].slice(1)]) semArte.push(o[k]);
        }
      }
      for (const s of ms) {
        try {
          fxDryRun(s);
          (s.choice || []).forEach(t => fxDryRun(s, t));
          const sp = diceSpec(s, Math.max(s.level, 1), { tipo: s.choice?.[0], modo: 'livre' });
          fxDryRun(s, s.choice?.[0], resolveLance(completarLance(novoLance(sp))));
        } catch (e) { falhas.push(s.id + ': ' + e.message); }
      }
      const fb = libGet('fireball'), rf = (fxRunTeste => fxRunTeste)(null);
      const cor = t => spellRecipe(libGet('chromatic-orb'), t).palette[0];
      const baixo = impacto({ temDano: true, total: 12, sorte: 0 }), alto = impacto({ temDano: true, total: 44, sorte: 1 });
      const dano = libraryAll().filter(s => s.r.some(x => x.t === 'dmg' && !x.heal && !x.depois && DMG_COLORS[x.type])).every(s => spellRecipe(s).elemento);
      return { total: ids.length, unicas: sigs.size, semCena: semCena.slice(0, 40), nSem: semCena.length, repetidas: repetidas.slice(0, 8), falhas: falhas.slice(0, 5), semArte: [...new Set(semArte)].slice(0, 8), verbos: verbos.size, frases: frases.slice(0, 5), dano, fogo: spellRecipe(fb).palette[0], frio: spellRecipe(libGet('cone-of-cold')).palette[0], corF: cor('Fogo'), corG: cor('Frio'), baixo, alto, nVerbos: Object.keys(ATOS).length };
    });
    ok(r.total >= 340, `todas as magias entram na conta: ${r.total}`);
    ok(!r.nSem, `toda magia tem cena escrita à mão: faltam ${r.nSem}: ${r.semCena}`);
    ok(r.unicas === r.total, `nenhuma cena se repete: ${r.repetidas}`);
    ok(!r.frases.length, `toda cena tem frase: ${r.frases}`);
    ok(!r.semArte.length, `toda silhueta existe: ${r.semArte}`);
    ok(!r.falhas.length, `nenhuma cena quebra: ${r.falhas}`);
    ok(r.verbos >= 30, `cenas usam verbos variados: ${r.verbos} de ${r.nVerbos}`);
    ok(r.dano, 'toda magia de dano usa a paleta do tipo');
    ok(r.fogo === DMG_FOGO && r.frio === DMG_FRIO, 'cor segue o tipo de dano');
    ok(r.corF === DMG_FOGO && r.corG === DMG_FRIO, 'cor segue o elemento escolhido');
    ok(r.alto.tamanho > r.baixo.tamanho * 1.4 && r.alto.forca > r.baixo.forca * 2, 'dano alto gera cena maior e mais forte');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'cena toma a tela, pula com um toque e respeita o menu'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await page.evaluate(async () => { await ensureLibrary(); store.settings.anim = 'full'; playSpell(libGet('mage-hand'), null, 0); });
    await page.waitForFunction(() => +document.querySelector('#spell-fx').style.opacity > .05);
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('#spell-fx')).pointerEvents) === 'auto', 'cena recebe o toque');
    await page.evaluate(() => document.querySelector('#spell-fx').dispatchEvent(new PointerEvent('pointerdown')));
    await page.waitForFunction(() => !fxState.run, null, { timeout: 2000 });
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('#spell-fx')).pointerEvents) === 'none', 'depois da cena o app volta a responder');
    await page.evaluate(() => { store.settings.anim = 'reduced'; playSpell(libGet('fireball'), null, 3); });
    ok(await page.evaluate(() => fxState.run.total) <= 1200, 'modo reduzido é curto');
    ok(await page.evaluate(() => fxState.run.dados === undefined && fxState.run.reduced), 'modo reduzido sem tremor');
    await page.evaluate(() => { fxFim(); store.settings.anim = 'off'; });
    ok(await page.evaluate(() => { const L = completarLance(novoLance(diceSpec(libGet('fireball'), 3))), r = resolveLance(L); lance = L; mesaCtx = { s: libGet('fireball'), lv: 3, ctx: {} }; mostrarResultado(mesaCtx.s, r); return playSpell(mesaCtx.s, null, 3, r) === null && document.querySelector('#roll').classList.contains('show'); }), 'desligada: sem cena, mas com resultado');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'ver efeito e cena das magias criadas'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await page.evaluate(async () => { await ensureLibrary(); store.settings.anim = 'full'; spellModal('fireball', true); });
    ok(await page.locator('[data-action="fx-ver"]').count() === 3, 'magia com dados mostra três forças');
    const antes = await estado(page);
    await clicar(page, '[data-action="fx-ver"][data-q="1"]');
    const forte = await page.evaluate(() => { const r = fxState.run; return { F: r.F, K: r.K, total: r.rec.res.total }; });
    ok(forte.total === 48, `forte usa o máximo dos dados: ${forte.total}`);
    await page.evaluate(() => { fxFim(); fxPreview(libGet('fireball'), 0); });
    const fraco = await page.evaluate(() => { const r = fxState.run; return { F: r.F, K: r.K, total: r.rec.res.total }; });
    ok(fraco.total === 8 && fraco.K < forte.K && fraco.F < forte.F, 'fraco fica menor que forte');
    ok(JSON.stringify((await estado(page)).used) === JSON.stringify(antes.used), 'ver efeito não gasta nada');
    await page.evaluate(() => { fxFim(); closeModal(); spellModal('mage-hand'); });
    ok(await page.locator('[data-action="fx-ver"]').count() === 1, 'magia sem dados mostra um botão');
    const s = await page.evaluate(() => {
      fxFim();
      const m = (name, desc) => ({ id: 'm-x', name, desc: [desc], r: [], school: 'Evocação', level: 1 });
      return { gelo: JSON.stringify(cenaDe(m('Lança Boreal', 'Uma lança de gelo atinge o alvo.')).slice(2)) === JSON.stringify(CENAS['cone-of-cold'].slice(2)), neutra: cenaDe(m('Xyz', 'Sem pistas.')).length > 2, escolhida: cenaDe({ ...m('Xyz', ''), cena: 'fireball' }) === CENAS.fireball };
    });
    ok(s.gelo, 'magia criada recebe cena pela descrição');
    ok(s.neutra && s.escolhida, 'editor pode trocar a cena');
    await page.evaluate(() => { closeModal(); });
    await page.waitForFunction(() => document.querySelector('#modal').hidden);
    await page.evaluate(() => openEditor('hex'));
    await page.waitForSelector('#e-cena');
    await page.selectOption('#e-cena', 'fireball');
    await page.locator('#spell-form button.gold').click();
    const salvo = await page.evaluate(() => { const x = store.library.overrides.hex; return { cena: x.cena, depois: x.r.find(r => r.t === 'dmg').depois }; });
    ok(salvo.cena === 'fireball', 'cena escolhida fica salva');
    ok(salvo.depois === true, 'editar não perde as regras da rolagem');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'escolha de elemento antes de animar e rolar'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await aba(page, 'grimorio');
    await page.evaluate(() => spellModal('sorcerous-burst'));
    await clicar(page, '[data-action="cast"]');
    ok(await page.evaluate(() => !document.querySelector('#modal').hidden), 'sem elemento não conjura');
    await clicar(page, '[data-action="cast-type"][data-t="Fogo"]');
    ok((await page.locator('.rolls-box').textContent()).includes('Fogo'), 'rolagem mostra o elemento');
    const antes = await page.evaluate(() => { window.__fx = null; const p = playSpell; playSpell = (...a) => { window.__fx = a[1]; return p(...a); }; return 1; });
    await clicar(page, '[data-action="cast"]');
    await page.waitForFunction(() => activeChar().choices?.['sorcerous-burst'] === 'Fogo');
    await clicar(page, '[data-action="mesa-go"]');
    ok(await page.evaluate(() => window.__fx) === 'Fogo', 'animação recebe o elemento');
    ok(await page.evaluate(() => activeChar().lastElement) === 'Fogo', 'última escolha guardada');
    await page.waitForFunction(() => document.querySelector('#modal').hidden);
    await page.evaluate(() => spellModal('sorcerous-burst'));
    ok(await page.locator('[data-action="cast-type"][data-t="Fogo"]').getAttribute('aria-pressed') === 'true', 'lembra a última escolha');
    await page.evaluate(() => { closeModal(); store.settings.anim = 'off'; });
    ok(await page.evaluate(() => playSpell(SPELLS[0])) === null, 'animações desligadas não tocam');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'mesa de dados respeita cada magia'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const r = await page.evaluate(async () => {
      await ensureLibrary();
      const falhas = [], ms = [...libraryAll(), ...SPELLS];
      for (const s of ms) for (let lv = Math.max(s.level, 0); lv <= (s.level ? 9 : 0); lv++) for (const modo of ['cast', 'livre']) for (const alt of [null, ...mesaAlts(s, modo)]) {
        try {
          const sp = diceSpec(s, lv, { modo, alt, tipo: s.choice?.[0] });
          if (sp.grupos.some(g => !(g.n > 0 && g.f > 0) || !Number.isFinite(g.mod)) || sp.inst < 1) falhas.push(s.id + ' forma');
          const res = resolveLance(completarLance(novoLance(sp)));
          if (!Number.isFinite(res.total) || res.total < 0 || (res.temDano && res.bruto > res.max)) falhas.push(s.id + ' total');
        } catch (e) { falhas.push(s.id + ': ' + e.message); }
      }
      const lib = id => libGet(id), n = (id, lv, ctx) => diceSpec(lib(id), lv, ctx);
      const fixa = (L, i, g, vals) => { L.dados[cellKey(i, g)] = vals; };
      const o = {};
      o.bola5 = n('fireball', 5).grupos[0].n;
      o.missil = [n('magic-missile', 1).inst, n('magic-missile', 3).inst, n('scorching-ray', 2).inst, n('scorching-ray', 4).inst];
      o.feixe = n('eldritch-blast', 0).inst;
      const a = novoLance(n('sorcerous-burst', 0, { tipo: 'Fogo' })), g = a.spec.grupos[0];
      fixa(a, 0, g, [8]); a.d20[0] = [12]; o.abre = extrasAbertos(a, g, 0);
      a.extras[cellKey(0, g)] = [8]; o.abre2 = extrasAbertos(a, g, 0);
      a.extras[cellKey(0, g)] = [8, 8, 8, 8, 8]; o.abreMax = extrasAbertos(a, g, 0);
      o.lim = CHAR.stats.cha;
      const c = novoLance(n('chromatic-orb', 1, { tipo: 'Fogo' })), go = c.spec.grupos[0];
      c.d20[0] = [12]; fixa(c, 0, go, [3, 3, 5]); o.salta = instanciasDe(c);
      c.d20[1] = [12]; fixa(c, 1, go, [2, 2, 6]); o.salta1 = instanciasDe(c);
      const c3 = novoLance(n('chromatic-orb', 3, { tipo: 'Fogo' })), g3 = c3.spec.grupos[0];
      c3.d20[0] = [12]; fixa(c3, 0, g3, [1, 1, 2, 3, 4]); c3.d20[1] = [12]; fixa(c3, 1, g3, [1, 1, 2, 3, 4]); o.salta3 = instanciasDe(c3);
      const cr = novoLance(n('fire-bolt', 0)), gc = cr.spec.grupos[0];
      cr.d20[0] = [20]; o.crit = dicePorGrupo(cr, gc, 0);
      cr.dados[cellKey(0, gc)] = [10, 10]; o.critTot = resolveLance(cr).total;
      const er = novoLance(n('fire-bolt', 0)); er.d20[0] = [1]; er.dados[cellKey(0, er.spec.grupos[0])] = [10]; o.um = resolveLance(er).total;
      const b = novoLance(n('fireball', 3)), gb = b.spec.grupos[0];
      fixa(b, 0, gb, [6, 6, 6, 6, 6, 6, 6, 6]); o.cheia = resolveLance(b).total; b.save = 'passou'; o.metade = resolveLance(b).total;
      const ac = novoLance(n('acid-arrow', 2)); ac.erro[0] = true; ac.d20[0] = [9]; ac.dados[cellKey(0, ac.spec.grupos[0])] = [4, 4, 4, 4]; o.errouMetade = resolveLance(ac).total;
      const ik = novoLance(n('ice-knife', 1)); ik.d20[0] = [1]; ik.spec.grupos.forEach(x => { ik.dados[cellKey(0, x)] = Array(x.n).fill(2); }); o.gelo = resolveLance(ik).total;
      o.altVerdadeiro = mesaAlts(lib('true-strike'));
      o.semDadoAoConjurar = diceSpec(lib('hex'), 1).grupos.length; o.hexLivre = diceSpec(lib('hex'), 1, { modo: 'livre' }).grupos.length;
      o.magoHand = diceSpec(lib('mage-hand'), 0).grupos.length;
      o.desint = n('disintegrate', 7).grupos[0];
      o.vida = n('false-life', 3).grupos[0].mod;
      o.fraco = impacto({ temDano: true, total: 12, sorte: .1 }); o.forte = impacto({ temDano: true, total: 40, sorte: .9 });
      return { falhas: falhas.slice(0, 6), o };
    });
    ok(!r.falhas.length, `especificação de dados vale para toda magia e círculo: ${r.falhas}`);
    const o = r.o;
    ok(o.bola5 === 10, 'Bola de Fogo no 5º rola 10d6');
    ok(String(o.missil) === '3,5,3,5', 'dardos e raios crescem com o círculo');
    ok(o.feixe === 1, 'Rajada Mística segue o nível');
    ok(o.abre === 1 && o.abre2 === 2 && o.abreMax === o.lim, 'cada 8 abre outro dado, até o limite de Carisma');
    ok(o.salta === 2 && o.salta1 === 2 && o.salta3 === 3, 'orbe salta nos repetidos, até o círculo do espaço');
    ok(o.crit === 2 && o.critTot === 20, 'crítico dobra os dados');
    ok(o.um === 0, '1 natural erra');
    ok(o.cheia === 48 && o.metade === 24, 'salvaguarda reduz à metade');
    ok(o.errouMetade === 8, 'Flecha Ácida errada causa metade');
    ok(o.gelo === 4, 'Faca de Gelo explode mesmo errando');
    ok(o.altVerdadeiro.length === 5, 'Golpe Certeiro pede a arma');
    ok(o.semDadoAoConjurar === 0 && o.hexLivre === 1, 'dano que vem depois não entra na conjuração');
    ok(o.magoHand === 0, 'magia sem dados vai direto');
    ok(o.desint.n === 13 && o.desint.mod === 40, 'Desintegrar soma dados e bônus fixo');
    ok(o.vida === 14, 'Vida Falsa soma 5 por círculo');
    ok(o.forte.tamanho > o.fraco.tamanho && o.forte.forca > o.fraco.forca, 'dano maior gera impacto maior');

    await aba(page, 'grimorio');
    await page.evaluate(() => { closeModal(); commit('Diamante', st => { st.items.find(i => i.key === 'diamond').qty = 1; }); spellModal('chromatic-orb'); });
    await clicar(page, '[data-action="cast-type"][data-t="Fogo"]');
    await clicar(page, '[data-action="cast"]:not([disabled])');
    await page.waitForSelector('[data-action="mesa-go"]');
    const casas = page.locator('#sheet .dc');
    ok(await casas.count() === 4, 'mesa do Orbe tem d20 e três d8');
    await casas.nth(1).fill('9');
    ok(await casas.nth(1).inputValue() === '', 'd8 recusa 9');
    ok((await page.locator('#mesa-msg').textContent()).includes('1 a 8'), 'mesa explica o limite');
    await casas.nth(0).fill('14'); await casas.nth(1).fill('4'); await casas.nth(2).fill('4'); await casas.nth(3).fill('7');
    await page.waitForFunction(() => document.querySelectorAll('#sheet .dc').length === 8);
    ok(await page.evaluate(() => document.querySelector('.mi:nth-of-type(2) h4')?.textContent || [...document.querySelectorAll('.mi h4')].map(x => x.textContent).join()).then(x => /Salto/.test(x)), 'repetidos abrem o salto na mesa');
    await page.evaluate(() => { window.__res = null; const p = playSpell; playSpell = (...a) => { window.__res = a[3]; return p(...a); }; });
    await clicar(page, '[data-action="mesa-go"]');
    await page.waitForFunction(() => window.__res);
    const res = await page.evaluate(() => window.__res);
    ok(res.inst[0].dados.map(x => x.v).join() === '4,4,7' && res.inst[0].total === 15, 'valores físicos entram no resultado');
    ok(res.inst.length === 2 && res.inst[1].salto, 'salto chega à cena');
    ok(/Fogo/.test(await page.locator('#roll').textContent()), 'resultado aparece no aviso de rolagem');
    await page.evaluate(() => { spellModal('ice-knife'); });
    await page.waitForSelector('.rolls-box [data-action="roll"][data-mesa]');
    const antes = await estado(page);
    await page.locator('.rolls-box [data-action="roll"][data-mesa]').first().click();
    await page.waitForSelector('[data-action="mesa-go"]');
    ok(!(await page.locator('[data-action="mesa-pular"]').count()), 'botão de rolagem não oferece pular');
    await clicar(page, '[data-action="mesa-go"]');
    const depois = await estado(page);
    ok(JSON.stringify(antes.used) === JSON.stringify(depois.used), 'rolar sem conjurar não gasta espaço');
    await page.evaluate(() => { closeModal(); store.settings.anim = 'off'; spellModal('fireball-teste' in SPELL ? 'x' : SPELLS[0].id); closeModal(); openMesa(libGet('fireball'), 3, { modo: 'livre' }); });
    await page.waitForSelector('[data-action="mesa-total"]');
    await clicar(page, '[data-action="mesa-total"]');
    const tot = page.locator('#sheet .dc.wide');
    await tot.fill('49');
    ok(await tot.inputValue() === '', 'só o total recusa acima do máximo');
    await tot.fill('7'); await tot.blur();
    ok(await tot.inputValue() === '', 'só o total recusa abaixo do mínimo');
    await tot.fill('30');
    await clicar(page, '[data-action="mesa-go"]');
    await page.waitForFunction(() => document.querySelector('#roll .rp-t')?.textContent === '30');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'subir do 4 ao 5 com a média bate com a ficha'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await aba(page, 'personagem');
    await clicar(page, '[data-action="lv-open"]');
    await page.waitForSelector('[data-action="lv-avg"]');
    await clicar(page, '[data-action="lv-avg"]');
    ok((await page.locator('#sheet').textContent()).includes('7 PV'), 'mostra o ganho de 7 PV');
    await clicar(page, '[data-action="lv-next"]');
    const muda = await page.locator('#sheet').textContent();
    ok(muda.includes('Restauração Feiticeira') && muda.includes('Medo') && muda.includes('Voo'), 'mostra o que muda');
    await clicar(page, '[data-action="lv-next"]');
    await page.waitForSelector('[data-sp]');
    await clicar(page, '[data-action="lv-next"]');
    await clicar(page, '[data-action="lv-apply"]');
    await page.waitForFunction(() => activeChar().level === 5);
    const r = await page.evaluate(() => ({ hp: CHAR.stats.hpMax, atual: state.hp, pb: CHAR.stats.pb, dc: CHAR.stats.dc, atk: CHAR.stats.atk, slots: CHAR.slots, sp: RES.sp.max, spAtual: state.res.sp, prep: CHAR.limits.prepared, tru: CHAR.limits.cantrips, salto: RES.jaunt.max, sorte: RES.luck.max, grande: !!RES.large, medo: SPELL.fear?.draconic, voo: SPELL.fly?.draconic, cant: baseDice(SPELL['mind-sliver'].r.find(x => x.t === 'dmg')), expl: baseDice(SPELL['sorcerous-burst'].r.find(x => x.t === 'dmg')), sub: document.querySelector('#char-sub').textContent, gr: SPELL['sorcerous-burst'].r.find(x => x.t === 'dmg').cantrip }));
    ok(r.hp === 37 && r.atual === 37, `PV 37 (${r.hp}/${r.atual})`);
    ok(r.pb === 3 && r.dc === 15 && r.atk === 7, `BP +3, CD 15, +7 (${r.pb}, ${r.dc}, ${r.atk})`);
    ok(r.slots[1] === 4 && r.slots[2] === 3 && r.slots[3] === 2, 'espaços 4/3/2');
    ok(r.sp === 5 && r.spAtual === 5, '5 PF');
    ok(r.prep === 9, '9 preparadas');
    ok(r.salto === 3 && r.sorte === 3, 'Salto e Sorte 3 usos');
    ok(r.grande, 'Forma Grande desbloqueada');
    ok(r.medo && r.voo, 'Medo e Voo sempre preparadas');
    ok(r.sub.includes('Nível 5'), 'cabeçalho mostra o nível');
    await page.evaluate(() => { const l = SOREN_SPELLS.find(s => s.id === 'mind-sliver'); });
    await aba(page, 'personagem');
    await clicar(page, '[data-action="lv-undo"]');
    await page.waitForFunction(() => activeChar().level === 4);
    const u = await page.evaluate(() => ({ hp: CHAR.stats.hpMax, atual: state.hp, sp: state.res.sp, medo: !!SPELL.fear, slots: CHAR.slots[3] }));
    ok(u.hp === 30 && u.atual === 30 && u.sp === 4 && !u.medo && !u.slots, 'desfazer nível volta ao 4');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'do nível 4 ao 20 bate com as tabelas'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    const r = await page.evaluate(async () => {
      await ensureLibrary();
      const c = activeChar(), dif = [], meta = METAMAGIC.map(m => m.id);
      for (let n = 5; n <= 20; n++) {
        const need = levelNeeds(c);
        commitLevel({ hp: 4, asi: {}, feat: need.boon ? 'boon-fate' : '', metamagic: meta.filter(m => !buildOf(c).metamagic.includes(m)).slice(0, Math.max(0, need.metamagic)) });
        const L = SORCERER_LEVELS[n - 1], s = CHAR, ok = s.stats.pb === L.pb && RES.sp.max === n && s.limits.cantrips === L.cantrips && s.limits.prepared === L.prepared && L.slots.every((v, i) => (s.slots[i + 1] || 0) === v) && s.stats.hpMax === 30 + (n - 4) * 7 && RES.hd.max === n && activeChar().level === n;
        if (!ok) dif.push(n + ':' + JSON.stringify(s.slots) + ' pv' + s.stats.hpMax);
      }
      return { dif, meta: CHAR.metamagic.length, pv: CHAR.stats.hpMax, pb: CHAR.stats.pb, drag: !!SPELL['summon-dragon'], dad: CHAR.feats, level: activeChar().level, feats: buildOf(c).feats.length, tier: baseDice(SPELL['mind-sliver'].r.find(x => x.t === 'dmg')) };
    });
    ok(!r.dif.length, 'progressão diverge: ' + r.dif.join(' '));
    ok(r.level === 20 && r.pv === 142 && r.pb === 6, `nível 20, PV 142, BP +6 (${r.pv})`);
    ok(r.meta === 6, `6 Metamagias (${r.meta})`);
    ok(r.drag, 'Invocar Dragão preparada');
    ok(r.feats === 3, 'Dádiva Épica adicionada');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'aba Personagem edita e planeja'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await aba(page, 'personagem');
    const t = await page.locator('#personagem').textContent();
    ok(t.includes('Golias') && t.includes('Gigante das Nuvens') && t.includes('Andarilho') && t.includes('Sortudo') && t.includes('Conjurador Bélico'), 'mostra origem e talentos');
    ok(t.includes('Feitiçaria Inata') && t.includes('Apoteose Arcana'), 'linha do tempo completa');
    await page.fill('#id-story', 'Nova história');
    await page.fill('#id-name', 'Søren da Geada');
    await page.waitForFunction(() => document.querySelector('#char-name-txt').textContent === 'Søren da Geada');
    await clicar(page, '[data-action="feat-catalog"]');
    await page.selectOption('[data-plan="alert"]', '8');
    await page.waitForFunction(() => buildOf(activeChar()).planned.alert === 8);
    await page.fill('#ft-name', 'Mestre da Geada');
    await page.fill('#ft-desc', 'Talento criado.');
    await page.locator('#feat-form button').click();
    await page.waitForFunction(() => (store.library.feats || []).length === 1);
    ok(await page.evaluate(() => allFeats().some(f => f.name === 'Mestre da Geada')), 'talento criado entra no catálogo');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#stats')?.children.length > 0);
    ok(await page.evaluate(() => activeChar().identity.story === 'Nova história' && activeChar().name === 'Søren da Geada'), 'identidade salva');
    ok(!erros.length, `sem erros de JS: ${erros}`);
    await ctx.close();
  },

  async 'criação de feiticeiro do 1 ao 3'({ browser, opts }) {
    const { ctx, page, erros } = await abrir(browser, opts);
    await clicar(page, '[data-action="chars"]');
    await clicar(page, '[data-action="char-new"]');
    await page.fill('#c-name', 'Ilda');
    await page.press('#c-name', 'Enter');
    await page.waitForSelector('#cw-sp');
    await assistente(page, {
      0: async () => { await page.selectOption('#cw-sp', 'goliath'); await page.selectOption('#cw-lin', 'storm'); },
      1: async () => { await page.selectOption('#cw-bg', 'sage'); await page.selectOption('#cw-p2', 'CON'); await page.selectOption('#cw-p1', 'INT'); },
      2: async () => {
        await page.check('input[name="cw-method"][value="compra"]');
        await page.waitForSelector('[data-action="cw-score"]');
        for (let i = 0; i < 8; i++) await clicar(page, '[data-action="cw-score"][data-k="CAR"][data-d="1"]');
        ok(await page.evaluate(() => pointsUsed()) === 9, 'compra de pontos soma o custo certo');
        for (const k of ['DES', 'CON', 'SAB', 'FOR', 'INT']) for (let i = 0; i < 8; i++) await clicar(page, `[data-action="cw-score"][data-k="${k}"][data-d="1"]`).catch(() => {});
        ok(await page.locator('[data-action="cw-next"]').isDisabled(), 'passar de 27 pontos bloqueia');
        for (const k of ['DES', 'CON', 'SAB', 'FOR', 'INT']) for (let i = 0; i < 4; i++) await clicar(page, `[data-action="cw-score"][data-k="${k}"][data-d="-1"]`);
      },
      6: async () => {
        await page.locator('[data-cwsp]').first().check();
        await page.waitForSelector('[data-cwsp]');
      },
      7: async () => { await page.selectOption('#cw-level', '3'); }
    });
    await page.waitForFunction(() => activeChar().name === 'Ilda' && activeChar().level === 3);
    const r = await page.evaluate(() => { const b = buildOf(activeChar()); return { sc: b.scores, pv: CHAR.stats.hpMax, atual: state.hp, drac: b.subclassId, orbe: !!SPELL['chromatic-orb'], meta: CHAR.metamagic.length, pb: CHAR.stats.pb, sp: RES.sp.max, slots: CHAR.slots, feat: b.feats, sk: Object.keys(b.skills).length, sub: activeChar().sub, salto: !!RES.jaunt, ac: CHAR.stats.ac, spd: CHAR.stats.speed, it: state.items.length }; });
    const con = Math.floor((r.sc.CON - 10) / 2);
    ok(r.sc.CAR === 15 && r.sc.CON === 13 + 0 || r.sc.CON >= 10, 'atributos com bônus');
    ok(r.pv === 6 + con + 2 * (4 + con) + 3 && r.atual === r.pv, `PV do nível 3 (${r.pv})`);
    ok(r.drac === 'draconic' && r.orbe && r.meta === 2, 'subclasse, magias dracônicas e Metamagia');
    ok(r.slots[1] === 4 && r.slots[2] === 2 && r.sp === 3 && r.pb === 2, 'espaços e PF do nível 3');
    ok(r.feat.includes('magic-initiate') && r.sk === 4, 'talento e perícias do antecedente');
    ok(r.sub.includes('Golias (Gigante da Tempestade)') && !r.salto, 'ascendência escolhida');
    ok(r.spd === '10,5 m', 'deslocamento da espécie');
    ok(r.it === 5, 'equipamento inicial');
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
const rapido = process.env.TESTE_RAPIDO;
for (const [nome, viewport] of Object.entries(VIEWPORTS)) for (const comGsap of [true, false]) {
  if (rapido && (nome !== 'celular' || comGsap)) continue;
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
