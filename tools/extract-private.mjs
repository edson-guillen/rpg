#!/usr/bin/env node
// Lê a pasta de livros do usuário e gera dados privados em private/ (ignorado pelo git).
// Uso: npm run extract -- "C:\Users\edigu\Downloads\DnD" [--texto "C:\...\texto"]
// Nada do que este script produz pode ser versionado ou publicado: o conteúdo é de livros pagos.
// O app recebe esses dados pelo importador, e eles ficam só no navegador do usuário.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE = path.join(root, 'private');
const SCHEMA = 1;

/** Fontes conhecidas. `texto` é o nome do arquivo de texto já extraído, quando existe. */
const FONTES = [
  { re: /livro-do-jogador/i, id: 'phb24-pt', titulo: 'Livro do Jogador 2024', edicao: '2024', idioma: 'pt', texto: 'livro-do-jogador-2024-ptbr' },
  { re: /^PBH 5/i, id: 'phb24-en', titulo: "Player's Handbook 2024", edicao: '2024', idioma: 'en', texto: 'players-handbook-2024-en-ocr', parteDe: true },
  { re: /dungeon master/i, id: 'dmg24', titulo: "Dungeon Master's Guide 2024", edicao: '2024', idioma: 'en', texto: 'dungeon-masters-guide-2024' },
  { re: /tasha/i, id: 'tce', titulo: "Tasha's Cauldron of Everything", edicao: 'pre-2024', idioma: 'en', texto: 'tashas-cauldron-of-everything' },
  { re: /mordenkainen/i, id: 'motm', titulo: 'Monsters of the Multiverse', edicao: 'pre-2024', idioma: 'en', texto: 'monsters-of-the-multiverse' },
  { re: /forge-of-the-artificer/i, id: 'efota', titulo: 'Eberron: Forge of the Artificer', edicao: '2024', idioma: 'en', texto: 'eberron-forge-of-the-artificer' },
  { re: /rising-from-the-last-war/i, id: 'erftlw', titulo: 'Eberron: Rising from the Last War', edicao: 'pre-2024', idioma: 'en', texto: 'eberron-rising-from-the-last-war' },
];
const ABERTA = /\b(srd|cc[- ]by|creative commons)\b/i;

const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titulo = s => s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
  .replace(/\b(Of|The|And|To|From|In|With|On|For)\b/g, (m, _, i) => (i ? m.toLowerCase() : m));

// ---------- texto com marcadores de página ----------

function paginas(texto) {
  const out = [];
  for (const parte of texto.split(/^=== PDF p\.(\d+) ===.*$/m).slice(1).reduce((a, x, i, arr) => (i % 2 ? a : [...a, [+x, arr[i + 1]]]), [])) out.push(parte);
  return out;
}
/** Linhas de um intervalo de páginas, cada uma com a página de origem. */
function linhas(pgs, de, ate = Infinity) {
  const out = [];
  for (const [p, t] of pgs) if (p >= de && p <= ate) for (const l of t.split(/\r?\n/)) out.push({ p, l: l.trim() });
  return out;
}
const ruido = l => !l || /^(Capítulo \d+ \| |\d+ Capítulo |CAPÍTULO \d+ \| )/i.test(l) || /^\d{1,3}$/.test(l)
  || /^[A-ZÀ-Ý][A-ZÀ-Ý .'-]{3,30}$/.test(l) && !/^[IVX]+$/.test(l); // créditos de arte, em maiúsculas

function juntar(ls) {
  // Reúne as linhas em parágrafos: pdftotext quebra no fim da coluna.
  const ps = [];
  for (const l of ls) {
    if (ps.length && !/[.!?:)”"]$/.test(ps[ps.length - 1]) && /^[\p{Ll}0-9(]/u.test(l)) ps[ps.length - 1] += ' ' + l;
    else ps.push(l);
  }
  return ps.join('\n').replace(/(\p{L})- (\p{Ll})/gu, '$1$2');
}

// ---------- magias ----------

const ESCOLAS_PT = { 'Abjuração': 'abjuration', 'Adivinhação': 'divination', 'Encantamento': 'enchantment', 'Evocação': 'evocation', 'Ilusão': 'illusion', 'Invocação': 'conjuration', 'Conjuração': 'conjuration', 'Necromancia': 'necromancy', 'Transmutação': 'transmutation' };
const CLASSES_PT = { 'Artífice': 'artificer', 'Bardo': 'bard', 'Bruxo': 'warlock', 'Clérigo': 'cleric', 'Druida': 'druid', 'Feiticeiro': 'sorcerer', 'Guardião': 'ranger', 'Mago': 'wizard', 'Paladino': 'paladin' };

function campos(s, rotulos) {
  // Separa "Rótulo: valor Rótulo: valor" numa linha só.
  const re = new RegExp(`(${rotulos.join('|')}):`, 'g');
  const achados = [...s.matchAll(re)], out = {};
  achados.forEach((m, i) => { out[m[1]] = s.slice(m.index + m[0].length, achados[i + 1]?.index ?? s.length).trim(); });
  return out;
}
function material(comp) {
  const m = comp.match(/M \((.*)\)\s*$/);
  return { comp: comp.replace(/\s*\(.*$/, '').trim(), mat: m ? m[1] : '' };
}

const DURACAO = /^((?:Concentração, até )?(?:\d+ (?:rodadas?|minutos?|horas?|dias?)|Instantânea|Até ser dissipada(?: ou acionada)?|Especial))\s+(\p{Lu}.*)$/su;

/** Magias do Livro do Jogador em português. */
function magiasPT(fonte, pgs) {
  // O cabeçalho e o "Tempo de Conjuração" às vezes vêm na mesma linha.
  const ls = linhas(pgs, 241, 349).filter(x => !/^As magias são apresentadas/.test(x.l)).flatMap(x => {
    const i = x.l.search(/ Tempo de Conjuração:/);
    return i > 0 && /^(Truque de |\d[º°] Círculo, )/.test(x.l) ? [{ p: x.p, l: x.l.slice(0, i) }, { p: x.p, l: x.l.slice(i + 1) }] : [x];
  });
  const HEAD = /^(?:Truque de ([\p{L}]+)|(\d)[º°] Círculo, ([\p{L}]+))(?: \((.*)\))?$/u;
  const inicios = [];
  ls.forEach((x, i) => { if (HEAD.test(x.l) && /^Tempo de Conjuração:/.test(ls[i + 1]?.l || '')) inicios.push(i); });
  const out = [];
  inicios.forEach((i, k) => {
    const m = ls[i].l.match(HEAD), fim = (inicios[k + 1] ?? ls.length) - 1;
    let j = i + 1, cab = ls[j].l;
    while (j + 1 < fim && !/Duração: .*\S/.test(cab)) cab += ' ' + ls[++j].l;
    // A duração pode continuar na linha seguinte quando termina sem ponto; o texto da magia começa com maiúscula.
    const c = campos(cab, ['Tempo de Conjuração', 'Alcance', 'Componentes', 'Componente', 'Duração']);
    // Em algumas magias o texto vem na mesma linha da duração.
    const [, durLimpa, resto] = (c['Duração'] || '').match(DURACAO) || [, c['Duração'] || '', ''];
    const corpo = resto ? [resto] : [];
    for (let q = j + 1; q < fim; q++) if (!ruido(ls[q].l)) corpo.push(ls[q].l);
    const texto = juntar(corpo);
    const sup = texto.search(/^(Usando um Espaço de Magia de Círculo Superior|Aprimoramento de Truque)\./m);
    const { comp, mat } = material(c['Componentes'] || c['Componente'] || '');
    const dur = durLimpa, tempo = c['Tempo de Conjuração'] || '';
    const nome = ls[i - 1]?.l || '';
    out.push({
      id: slug(nome), nome, nomeEn: '', circulo: m[2] ? +m[2] : 0, escola: ESCOLAS_PT[m[1] || m[3]] || (m[1] || m[3]),
      classes: (m[4] || '').split(',').map(s => CLASSES_PT[s.trim()]).filter(Boolean),
      tempo, alcance: c['Alcance'] || '', comp, material: mat, duracao: dur,
      concentracao: /concentração/i.test(dur), ritual: /ritual/i.test(tempo),
      texto: (sup >= 0 ? texto.slice(0, sup) : texto).trim(), superior: sup >= 0 ? texto.slice(sup).trim() : '',
      fonte: { id: fonte.id, pagina: ls[i].p }
    });
  });
  return out;
}

const ESCOLAS_EN = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];

/** Magias do Player's Handbook com OCR: dá o nome em inglês e o texto original. */
function magiasEN(fonte, pgs) {
  const ls = linhas(pgs, 234).filter(x => x.l);
  const HEAD = new RegExp(`^(?:Level (\\d) (${ESCOLAS_EN.join('|')})|(${ESCOLAS_EN.join('|')}) Cantrip)\\s*\\((.*)\\)?`);
  const inicios = [];
  ls.forEach((x, i) => { if (HEAD.test(x.l)) inicios.push(i); });
  return inicios.map((i, k) => {
    const m = ls[i].l.match(HEAD), fim = (inicios[k + 1] ?? ls.length) - 1;
    let j = i + 1, cab = '';
    while (j < fim && !/^Duration:/.test(ls[j].l)) cab += ' ' + ls[j++].l;
    const c = campos(cab + ' ' + (ls[j]?.l || ''), ['Casting Time', 'Range', 'Components', 'Duration']);
    const corpo = ls.slice(j + 1, fim).map(x => x.l).filter(l => !/^(CHAPTER \d|\d+ CHAPTER)/.test(l));
    const texto = juntar(corpo);
    const sup = texto.search(/^(Using a Higher-Level Spell Slot|Cantrip Upgrade)\./m);
    const { comp, mat } = material(c['Components'] || '');
    const nome = titulo(ls[i - 1]?.l || '');
    return {
      id: slug(nome), nome, circulo: m[1] ? +m[1] : 0, escola: (m[2] || m[3]).toLowerCase(),
      classes: (m[4] || '').replace(/\)$/, '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      tempo: c['Casting Time'] || '', alcance: c['Range'] || '', comp, material: mat, duracao: c['Duration'] || '',
      texto: (sup >= 0 ? texto.slice(0, sup) : texto).trim(), superior: sup >= 0 ? texto.slice(sup).trim() : '',
      fonte: { id: fonte.id, pagina: ls[i].p }
    };
  });
}

/** Nomes listados no sumário, que não têm os espaços quebrados dos títulos do miolo. */
function nomesDoSumario(pgs) {
  const texto = linhas(pgs, 1, 8).map(x => x.l).join(' ');
  return [...texto.matchAll(/([A-Z][A-Za-z'’-]+(?: [A-Za-z'’-]+){0,5}) ?(?:\. ?){3,}/g)].map(m => m[1].trim());
}

/** Magias de livros anteriores a 2024, no formato "7th-level conjuration" + "Casting Time: ...". */
function magiasAntigas(fonte, pgs) {
  const ls = linhas(pgs, 1).filter(x => x.l);
  const toc = nomesDoSumario(pgs);
  const compacto = n => slug(n).replace(/-/g, '');
  const out = [];
  const HEAD = /^(?:(\d)(?:st|nd|rd|th)-level (\w+)|(\w+) cantrip)(?: \((.*)\))?$/i;
  ls.forEach((x, i) => {
    const m = x.l.match(HEAD);
    if (!m || !/^Casting Time:/.test(ls[i + 1]?.l || '')) return;
    let j = i + 1, cab = ls[j].l;
    while (j + 1 < ls.length && j < i + 5 && !/Duration: \S+/.test(cab)) cab += ' ' + ls[++j].l;
    const c = campos(cab, ['Casting Time', 'Range', 'Components', 'Duration']);
    const corpo = [];
    for (let q = j + 1; q < ls.length && q < j + 40; q++) {
      if (HEAD.test(ls[q + 1]?.l || '') || /^[A-Z][A-Z' ]{5,}$/.test(ls[q].l.replace(/ (?=[A-Z])/g, ''))) break;
      corpo.push(ls[q].l);
    }
    const { comp, mat } = material(c['Components'] || '');
    const bruto = ls[i - 1].l;
    const nome = toc.find(n => compacto(n) === compacto(bruto)) || titulo(bruto);
    out.push({
      id: slug(nome), nome, circulo: m[1] ? +m[1] : 0, escola: (m[2] || m[3]).toLowerCase(), classes: [],
      tempo: c['Casting Time'] || '', alcance: c['Range'] || '', comp, material: mat, duracao: c['Duration'] || '',
      concentracao: /concentration/i.test(c['Duration'] || ''), ritual: false,
      texto: juntar(corpo).trim(), superior: '', fonte: { id: fonte.id, pagina: x.p }
    });
  });
  return out;
}

/** Magias inline: "Level 2 Conjuration (Artificer) Casting Time: ..." na mesma linha. */
function magiasInline(fonte, pgs) {
  const ls = linhas(pgs, 1).filter(x => x.l);
  const out = [];
  ls.forEach((x, i) => {
    const m = x.l.match(/^(?:Level (\d) (\w+)|(\w+) Cantrip) \((.*?)\) (Casting Time:.*)$/);
    if (!m) return;
    const c = campos(m[5], ['Casting Time', 'Range', 'Components', 'Duration']);
    const { comp, mat } = material(c['Components'] || '');
    const nome = titulo(ls[i - 1].l);
    const corpo = [];
    for (let q = i + 1; q < ls.length && q < i + 30; q++) {
      if (/^(Level \d \w+|\w+ Cantrip) \(/.test(ls[q + 1]?.l || '') || /^https?:/.test(ls[q].l)) break;
      corpo.push(ls[q].l);
    }
    out.push({
      id: slug(nome), nome, circulo: m[1] ? +m[1] : 0, escola: (m[2] || m[3]).toLowerCase(),
      classes: m[4].split(',').map(s => s.trim().toLowerCase()), tempo: c['Casting Time'] || '', alcance: c['Range'] || '',
      comp, material: mat, duracao: c['Duration'] || '', concentracao: /concentration/i.test(c['Duration'] || ''),
      ritual: /ritual/i.test(c['Casting Time'] || ''), texto: juntar(corpo).trim(), superior: '', fonte: { id: fonte.id, pagina: x.p }
    });
  });
  return out;
}

/** Liga cada magia em português à versão em inglês comparando a ficha técnica e os dados do texto. */
function ligarIdiomas(pt, en) {
  const pes = a => {
    const m = a.match(/([\d.,]+) (metros?|quilômetros?|km)/);
    if (!m) return null;
    const v = parseFloat(m[1].replace('.', '').replace(',', '.'));
    return Math.round(m[2].startsWith('m') ? v / 0.3 : v / 1.5 * 5280);
  };
  const dados = t => [...t.matchAll(/\d+d\d+/g)].map(m => m[0]).sort().join(' ');
  const nota = (p, e) => {
    if (p.circulo !== e.circulo || p.escola !== e.escola) return -1;
    let n = 0;
    const cl = new Set(e.classes), iguais = p.classes.filter(c => cl.has(c)).length;
    n += iguais === p.classes.length && iguais === e.classes.length ? 4 : iguais ? 1 : 0;
    const ft = pes(p.alcance);
    if (ft !== null && e.alcance.replace(/,/g, '').includes(String(ft))) n += 3;
    if (p.comp === e.comp) n += 1;
    if (!!p.material === !!e.material) n += 1;
    if (dados(p.texto) === dados(e.texto)) n += dados(p.texto) ? 4 : 1;
    if (dados(p.superior) === dados(e.superior) && dados(p.superior)) n += 2;
    const r = Math.min(p.texto.length, e.texto.length) / Math.max(p.texto.length, e.texto.length, 1);
    return n + r * 3;
  };
  const pares = [];
  for (const p of pt) for (const e of en) { const n = nota(p, e); if (n >= 6) pares.push([n, p, e]); }
  pares.sort((x, y) => y[0] - x[0]);
  const usadoP = new Set(), usadoE = new Set();
  let ligadas = 0;
  for (const [, p, e] of pares) {
    if (usadoP.has(p) || usadoE.has(e)) continue;
    usadoP.add(p); usadoE.add(e); ligadas++;
    p.nomeEn = e.nome; p.original = { texto: e.texto, superior: e.superior, fonte: e.fonte };
  }
  return ligadas;
}

/* O OCR do livro em inglês estraga alguns nomes, e duas magias de mesma ficha técnica se trocam. */
const TROCADAS = { 'Aura de Pureza': 'Aura de Vida', 'Aura de Vida': 'Aura de Pureza' };
const NOME_EN = { 'Aura de Pureza': 'Aura of Purity', 'Aura de Vida': 'Aura of Life', 'Fonte do Luar': 'Fount of Moonlight', 'Saraivada de Espinhos': 'Hail of Thorns', 'Raio de Bruxa': 'Witch Bolt', 'Manto do Cruzado': "Crusader's Mantle" };
function corrigirNomesEn(magias) {
  const srd = JSON.parse(fs.readFileSync(path.join(root, 'data/spells.json'), 'utf8')), porNome = new Map(srd.map(s => [s.name, s.en]));
  const copia = new Map(magias.map(m => [m.nome, m.original]));
  for (const m of magias) {
    if (TROCADAS[m.nome]) m.original = copia.get(TROCADAS[m.nome]);
    m.nomeEn = porNome.get(m.nome) || NOME_EN[m.nome] || m.nomeEn;
  }
}

// ---------- talentos, antecedentes e espécies ----------

function talentosPT(fonte, pgs) {
  const ls = linhas(pgs, 205, 218).filter(x => x.l);
  const HEAD = /^Talento (de Origem|Geral|de Estilo de Luta|de Dádiva Épica)(?: \(Pré-requisito: (.*?)\)?)?$/;
  const inicios = [];
  ls.forEach((x, i) => { if (HEAD.test(x.l)) inicios.push(i); });
  return inicios.map((i, k) => {
    const m = ls[i].l.match(HEAD), fim = (inicios[k + 1] ?? ls.length) - 1;
    const corpo = ls.slice(i + 1, fim).map(x => x.l).filter(l => !ruido(l));
    const nome = ls[i - 1].l;
    return { id: slug(nome), nome, categoria: { 'de Origem': 'origem', 'Geral': 'geral', 'de Estilo de Luta': 'estilo', 'de Dádiva Épica': 'dadiva' }[m[1]], prerequisito: (m[2] || '').replace(/\)$/, ''), texto: juntar(corpo).trim(), fonte: { id: fonte.id, pagina: ls[i].p } };
  });
}

function antecedentesPT(fonte, pgs) {
  const ls = linhas(pgs, 184, 191).filter(x => x.l);
  const out = [];
  // No PDF o título vem em versalete e perde as minúsculas: o nome certo está no sumário.
  const sumario = linhas(pgs, 1, 12).map(x => x.l).join(' ').match(/Acólito.*?Soldado/)?.[0] || '';
  const nomes = [...(sumario + ' ...').matchAll(/([\p{Lu}][\p{Ll}]+)\s*\.{3,}/gu)].map(m => m[1]);
  ls.forEach((x, i) => {
    if (!/^Valores de Atributo:/.test(x.l)) return;
    let bloco = x.l, j = i;
    while (j + 1 < ls.length && !/^Valores de Atributo:/.test(ls[j + 1].l) && j < i + 6 && !/Equipamento: .*\.$/.test(bloco)) bloco += ' ' + ls[++j].l;
    const c = campos(bloco, ['Valores de Atributo', 'Talento', 'Proficiências em Perícias', 'Proficiências em Perícia', 'Proficiência com Ferramentas', 'Proficiência em Ferramenta', 'Proficiência com Ferramenta', 'Equipamento']);
    const nome = nomes[out.length] || ls[i - 1].l;
    out.push({
      id: slug(nome), nome, atributos: (c['Valores de Atributo'] || '').split(',').map(s => s.trim()),
      talento: (c['Talento'] || '').replace(/\s*\(veja.*$/, ''), pericias: (c['Proficiências em Perícias'] || c['Proficiências em Perícia'] || '').replace(/\.$/, '').split(/,| e /).map(s => s.trim()).filter(Boolean),
      ferramenta: (c['Proficiência com Ferramentas'] || c['Proficiência em Ferramenta'] || c['Proficiência com Ferramenta'] || '').replace(/\.$/, ''), equipamento: c['Equipamento'] || '',
      texto: ls.slice(j + 1, Math.min(j + 6, ls.length)).map(x => x.l).filter(l => !ruido(l) && !/^Valores de Atributo/.test(l)).slice(0, 2).join(' '),
      fonte: { id: fonte.id, pagina: x.p }
    });
  });
  return out;
}

function especiesPT(fonte, pgs) {
  const ls = linhas(pgs, 192, 204).filter(x => x.l);
  const nomes = ['Aasimar', 'Anão', 'Draconato', 'Elfo', 'Gnomo', 'Golias', 'Humano', 'Orc', 'Pequenino', 'Tiferino'];
  const inicios = [];
  ls.forEach((x, i) => { if (/^Tipo de Criatura:/.test(x.l)) inicios.push(i); });
  return inicios.map((i, k) => {
    let j = i, cab = ls[i].l;
    while (j + 1 < ls.length && !/Deslocamento: [\d,]+ metros/.test(cab) && j < i + 3) cab += ' ' + ls[++j].l;
    const c = campos(cab, ['Tipo de Criatura', 'Tamanho', 'Deslocamento']);
    const fim = inicios[k + 1] ? inicios[k + 1] - 3 : ls.length;
    const corpo = ls.slice(j + 1, fim).map(x => x.l).filter(l => !ruido(l));
    const nome = nomes[k] || 'Espécie ' + (k + 1);
    return { id: slug(nome), nome, tipo: c['Tipo de Criatura'] || '', tamanho: c['Tamanho'] || '', deslocamento: (c['Deslocamento'] || '').replace(/\.?\s*$/, ''), texto: juntar(corpo).trim(), fonte: { id: fonte.id, pagina: ls[i].p } };
  });
}

// ---------- classes, livros antigos e itens mágicos ----------

const LIVRO_CLASSES = [['barbarian', 56, 63, ['world-tree', 'berserker', 'wild-heart', 'zealot']], ['bard', 64, 73, ['valor', 'dance', 'lore', 'glamour']], ['warlock', 74, 85, ['archfey', 'celestial', 'great-old-one', 'fiend']], ['cleric', 86, 95, ['war', 'light', 'trickery', 'life']], ['druid', 96, 107, ['moon', 'land', 'stars', 'sea']], ['sorcerer', 108, 120, ['aberrant', 'draconic', 'clockwork', 'wild']], ['ranger', 122, 131, ['fey-wanderer', 'hunter', 'beast-master', 'gloom-stalker']], ['fighter', 132, 140, ['champion', 'eldritch-knight', 'psi-warrior', 'battle-master']], ['rogue', 142, 151, ['soulknife', 'assassin', 'thief', 'arcane-trickster']], ['wizard', 152, 163, ['abjurer', 'diviner', 'evoker', 'illusionist']], ['monk', 164, 171, ['open-hand', 'mercy', 'shadow', 'elements']], ['paladin', 172, 181, ['devotion', 'glory', 'vengeance', 'ancients']]];
/** Texto integral das características do Livro do Jogador, por classe e subclasse. */
function caracteristicasPT(pgs) {
  const out = [];
  for (const [classe, a, b, subs] of LIVRO_CLASSES) {
    let modo = 'base', i = -1, ultimo = 0, cur = null;
    for (const x of linhas(pgs, a, b).filter(y => y.l)) {
      const m = x.l.match(/^Nível (\d+): (.+)$/);
      if (/^(CAPÍTULO \d|\d{1,3}$|Subclasse |Traços Básicos)/.test(x.l) || /^[A-ZÀ-Ý .'-]{4,30}$/.test(x.l)) continue;
      if (m) {
        const n = +m[1];
        if (modo === 'base' && ultimo >= 18 && n <= 3) { modo = 'sub'; i = 0; } else if (modo === 'sub' && n < ultimo) i++;
        ultimo = n;
        cur = { classe, sub: modo === 'sub' ? subs[Math.min(i, 3)] : null, nivel: n, nome: m[2], texto: '' };
        out.push(cur);
      } else if (cur) cur.texto += x.l + '\n';
    }
  }
  return out.map(f => ({ ...f, texto: juntar(f.texto.split('\n').filter(Boolean)).trim() }));
}
/** Subclasses de Tasha, anteriores a 2024: agrupa pelo nome em "6th-level Genie feature". */
function subclassesTasha(fonte, pgs) {
  const ls = linhas(pgs, 8, 83).filter(x => x.l), inicios = [];
  ls.forEach((x, i) => { const m = x.l.match(/(\d+)\s*(?:st|nd|rd|th)-level (.+?) feature/i); if (m) inicios.push({ i, n: +m[1], sub: m[2].trim() }); });
  const antes = i => ls[i].l.replace(/\d+\s*(?:st|nd|rd|th)-level .*$/i, '').trim() || ls[i - 1]?.l || '';
  return inicios.map((x, k) => ({ sub: x.sub, nivel: x.n, nome: titulo(antes(x.i)).replace(/\s+/g, ' '), texto: juntar(ls.slice(x.i + 1, inicios[k + 1]?.i ?? x.i + 12).map(y => y.l).filter(l => !ruido(l))).trim(), fonte: { id: fonte.id, pagina: ls[x.i].p } }));
}
/** Espécies de Monsters of the Multiverse. */
function especiesMotM(fonte, pgs) {
  const ls = linhas(pgs, 1, 60).filter(x => x.l), inicios = [];
  ls.forEach((x, i) => { const m = x.l.match(/^As an? ([\w' -]+?), you have the following racial traits/i); if (m) inicios.push({ i, nome: m[1] }); });
  return inicios.map((x, k) => {
    const texto = juntar(ls.slice(x.i, inicios[k + 1]?.i ?? x.i + 20).map(y => y.l).filter(l => !ruido(l))).trim(), desl = texto.match(/walking speed of (\d+) feet/i)?.[1];
    return { id: slug('motm-' + x.nome), nome: titulo(x.nome), tipo: '', tamanho: '', deslocamento: desl ? (+desl * .3).toString().replace('.', ',') + ' metros' : '9 metros', texto, fonte: { id: fonte.id, pagina: ls[x.i].p } };
  });
}
/** Espécies de Eberron: Forge of the Artificer, com ficha "Creature Type". */
function especiesFotA(fonte, pgs) {
  const ls = linhas(pgs, 1).filter(x => x.l), inicios = [];
  ls.forEach((x, i) => { if (/^Creature Type:/.test(x.l)) inicios.push(i); });
  return inicios.map((i, k) => {
    const nome = titulo(ls.slice(Math.max(0, i - 12), i).map(x => x.l).find(l => /^[A-Z][A-Z ]{3,20}$/.test(l)) || 'Espécie ' + (k + 1));
    return { id: slug('fota-' + nome), nome, tipo: '', tamanho: '', deslocamento: '9 metros', texto: juntar(ls.slice(i, inicios[k + 1] ?? i + 22).map(x => x.l).filter(l => !/^(https|\d+\/\d+|=== |11\/25)/.test(l))).trim(), fonte: { id: fonte.id, pagina: ls[i].p } };
  });
}
/** Talentos de outros livros: o nome vem na linha antes de "Prerequisite". */
function talentosIngles(fonte, pgs) {
  const ls = linhas(pgs, 1).filter(x => x.l), out = [];
  ls.forEach((x, i) => {
    if (!/^Prerequisite/.test(x.l)) return;
    const nome = titulo(ls[i - 1]?.l || '').replace(/\s+/g, ' ');
    if (!nome || nome.length > 40) return;
    let j = i + 1; const corpo = [];
    while (j < ls.length && corpo.length < 14 && !/^Prerequisite/.test(ls[j + 1]?.l || '')) corpo.push(ls[j++].l);
    out.push({ id: slug(fonte.id + '-' + nome), nome, categoria: 'geral', prerequisito: x.l.replace(/^Prerequisites?:\s*/, ''), texto: juntar(corpo.filter(l => !ruido(l))).trim(), fonte: { id: fonte.id, pagina: x.p } });
  });
  return out;
}
/** Itens mágicos do Dungeon Master's Guide 2024. */
function itensMagicos(fonte, pgs) {
  const tudo = linhas(pgs, 217, 337).filter(x => x.l);
  const RE = /^(.*?)\s*((?:Wondrous Item|Weapon|Armor|Ring|Rod|Staff|Wand|Potion|Scroll)[^,]{0,50}, (?:Common|Uncommon|Rare|Very Rare|Legendary|Artifact|Rarity Varies)[^.‘']{0,40})(.*)$/;
  const inicios = [];
  tudo.forEach((x, i) => { const m = x.l.match(RE); if (m) inicios.push({ i, m }); });
  return inicios.map(({ i, m }, k) => {
    const nome = (m[1] || tudo[i - 1]?.l || '').replace(/[^A-Za-zÀ-ÿ'’,+\d -]/g, ' ').replace(/\s+/g, ' ').trim();
    return { id: slug('item-' + nome), nome: titulo(nome), tipo: m[2].trim(), texto: juntar([m[3].replace(/^[\s‘']+/, ''), ...tudo.slice(i + 1, inicios[k + 1]?.i ? inicios[k + 1].i - 1 : i + 8).map(x => x.l)].filter(l => l && !ruido(l))).trim(), fonte: { id: fonte.id, pagina: tudo[i].p } };
  }).filter(x => x.nome.length > 2);
}

// ---------- inventário ----------

async function infoPdf(arquivo) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(arquivo)), verbosity: 0, isEvalSupported: false }).promise;
  const info = { paginas: doc.numPages, sumario: [] };
  try { info.sumario = ((await doc.getOutline()) || []).slice(0, 40).map(o => o.title); } catch { /* PDF sem sumário */ }
  const amostra = await (await doc.getPage(Math.min(20, doc.numPages))).getTextContent();
  info.temTexto = amostra.items.length > 20;
  await doc.destroy();
  return info;
}

async function textoDaFonte(fonte, arquivo, pastaTexto) {
  const pronto = path.join(pastaTexto, fonte.texto + '.txt');
  if (fs.existsSync(pronto)) return fs.readFileSync(pronto, 'utf8');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(arquivo)), verbosity: 0, isEvalSupported: false }).promise;
  const partes = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    partes.push(`=== PDF p.${p} ===\n${c.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('')}\n`);
  }
  await doc.destroy();
  return partes.join('\n');
}

// ---------- principal ----------

async function main() {
  const args = process.argv.slice(2);
  const iTexto = args.indexOf('--texto');
  const pastaTexto = iTexto >= 0 ? args[iTexto + 1] : path.resolve(root, '..', 'texto');
  const pasta = args.find((a, i) => !a.startsWith('--') && i !== iTexto + 1 || (iTexto < 0 && !a.startsWith('--')));
  if (!pasta || !fs.existsSync(pasta)) { console.error('Informe a pasta dos livros: npm run extract -- "<pasta>"'); process.exit(1); }
  fs.mkdirSync(PRIVATE, { recursive: true });

  const inventario = [];
  const fontes = new Map();
  for (const nome of fs.readdirSync(pasta).sort()) {
    const arq = path.join(pasta, nome);
    if (!fs.statSync(arq).isFile()) continue;
    const ext = path.extname(nome).toLowerCase();
    const item = { arquivo: nome, tipo: ext.slice(1), mb: +(fs.statSync(arq).size / 1048576).toFixed(1) };
    const fonte = FONTES.find(f => f.re.test(nome));
    item.fonte = fonte?.id || null;
    item.licenca = ABERTA.test(nome) ? 'aberta' : ext === '.pdf' ? 'paga' : 'pessoal';
    if (ext === '.pdf') {
      Object.assign(item, await infoPdf(arq));
      process.stdout.write(`  ${nome}: ${item.paginas} p.${item.temTexto ? '' : ' (sem texto)'}\n`);
      if (fonte && !fontes.has(fonte.id)) fontes.set(fonte.id, { fonte, arq });
    }
    inventario.push(item);
  }

  const textos = {};
  for (const [id, { fonte, arq }] of fontes) textos[id] = paginas(await textoDaFonte(fonte, arq, pastaTexto));

  const magiasBase = textos['phb24-pt'] ? magiasPT(fontes.get('phb24-pt').fonte, textos['phb24-pt']) : [];
  const en = textos['phb24-en'] ? magiasEN(fontes.get('phb24-en').fonte, textos['phb24-en']) : [];
  const ligadas = ligarIdiomas(magiasBase, en);
  corrigirNomesEn(magiasBase);
  const extras = [];
  for (const id of ['tce', 'erftlw']) if (textos[id]) extras.push(...magiasAntigas(fontes.get(id).fonte, textos[id]));
  if (textos.efota) extras.push(...magiasInline(fontes.get('efota').fonte, textos.efota));
  // Livros antigos repetem magias que já têm versão de 2024: prevalece a versão mais nova.
  const nomesEn = new Set(magiasBase.map(s => slug(s.nomeEn)).filter(Boolean));
  const novas = extras.filter((s, i) => s.nome && !nomesEn.has(s.id) && extras.findIndex(o => o.id === s.id) === i);
  const magias = [...magiasBase, ...novas];

  const fonteP = fontes.get('phb24-pt')?.fonte;
  const talentos = fonteP ? talentosPT(fonteP, textos['phb24-pt']) : [];
  const antecedentes = fonteP ? antecedentesPT(fonteP, textos['phb24-pt']) : [];
  const especies = fonteP ? especiesPT(fonteP, textos['phb24-pt']) : [];
  if (textos.motm) especies.push(...especiesMotM(fontes.get('motm').fonte, textos.motm));
  if (textos.efota) especies.push(...especiesFotA(fontes.get('efota').fonte, textos.efota).filter(e => /Traits$/.test(e.nome)).map(e => ({ ...e, nome: e.nome.replace(/ Traits$/, '') + ' (Eberron)' })));
  especies.forEach(e => { if (e.nome === 'Ore') e.nome = 'Orc'; e.nome = e.nome.trim(); });
  for (const id of ['tce', 'erftlw', 'efota']) if (textos[id]) { const novos = talentosIngles(fontes.get(id).fonte, textos[id]).filter(x => !talentos.some(p => p.id === x.id) && !/Bastion|Facility|House|Species|Level \d/.test(x.nome)); talentos.push(...novos); }
  const caracteristicas = fonteP ? caracteristicasPT(textos['phb24-pt']) : [];
  const limpaSub = s => s.replace(/of ?the ?/g, 'of the ').replace(/of(?=[A-Z])/g, 'of ').replace('KniSht', 'Knight').trim();
  const subclassesAntigas = textos.tce ? subclassesTasha(fontes.get('tce').fonte, textos.tce).map(f => ({ ...f, sub: limpaSub(f.sub) })).filter(f => /^[A-Z]/.test(f.sub) && !/^(Alchemist|Armorer|Artillerist|Battle Smith|Aberrant Mind|Clockwork Soul|Psi Warrior|Soulknife|Fey Wanderer|Beast Master|Circle of the Stars|Way of Mercy|Oath of Glory)$/.test(f.sub)) : [];
  const itens = textos.dmg24 ? itensMagicos(fontes.get('dmg24').fonte, textos.dmg24) : [];

  const salvar = (f, d) => fs.writeFileSync(path.join(PRIVATE, f), JSON.stringify(d, null, 1));
  salvar('inventario.json', inventario);
  salvar('biblioteca-pessoal.json', {
    app: 'grimorio', tipo: 'biblioteca-pessoal', schema: SCHEMA, gerado: new Date().toISOString(),
    fontes: [...fontes.values()].map(({ fonte: { re, ...f } }) => f), magias, talentos, antecedentes, especies, caracteristicas, subclassesAntigas, itens
  });

  const semTexto = magias.filter(s => !s.texto).length;
  const semClasse = magiasBase.filter(s => !s.classes.length).length;
  const rel = {
    arquivos: inventario.length, pdfs: inventario.filter(i => i.tipo === 'pdf').length, pagas: inventario.filter(i => i.licenca === 'paga').length,
    magias: magias.length, magiasPT: magiasBase.length, magiasEN: en.length, ligadasPTEN: ligadas, magiasOutrosLivros: novas.length,
    semTexto, semClasse, caracteristicas: caracteristicas.length, subclassesAntigas: subclassesAntigas.length, itens: itens.length, talentos: talentos.length, antecedentes: antecedentes.length, especies: especies.length,
    aFeiticeiro: magiasBase.filter(s => s.classes.includes('sorcerer')).length
  };
  salvar('relatorio.json', rel);
  console.log(rel);
}

await main();
await import('./cenas-pessoais.mjs');
