#!/usr/bin/env node
// Normaliza o SRD 5.2 (CC BY 4.0) para o formato de magia do app e gera data/library.js.
// Uso: npm run srd            usa a cópia em data/srd/
//      npm run srd -- --baixar  baixa de novo do 5e-database
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = f => path.join(root, 'data', f);
const BASE = 'https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en';
const ARQUIVOS = ['Spells', 'Levels', 'Feats', 'Species', 'Traits', 'Backgrounds', 'Features', 'Subclasses', 'Classes', 'Subspecies'];

if (process.argv.includes('--baixar')) {
  for (const f of ARQUIVOS) {
    const r = await fetch(`${BASE}/5e-SRD-${f}.json`);
    if (!r.ok) throw new Error(`Falha ao baixar ${f}: ${r.status}`);
    fs.writeFileSync(data(`srd/${f}.json`), await r.text());
  }
}

const ler = (f, padrao) => (fs.existsSync(data(f)) ? JSON.parse(fs.readFileSync(data(f), 'utf8')) : padrao);

const ESCOLA = { abjuration: 'Abjuração', conjuration: 'Invocação', divination: 'Adivinhação', enchantment: 'Encantamento', evocation: 'Evocação', illusion: 'Ilusão', necromancy: 'Necromancia', transmutation: 'Transmutação' };
const TIPO = { Acid: 'Ácido', Bludgeoning: 'Contundente', Cold: 'Gélido', Fire: 'Ígneo', Force: 'Energético', Lightning: 'Elétrico', Necrotic: 'Necrótico', Piercing: 'Perfurante', Poison: 'Venenoso', Psychic: 'Psíquico', Radiant: 'Radiante', Slashing: 'Cortante', Thunder: 'Trovejante' };
const ATRIB = { Strength: 'FOR', Dexterity: 'DES', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'SAB', Charisma: 'CAR' };
const FORMA = { Sphere: 'Esfera', Cone: 'Cone', Cube: 'Cubo', Cylinder: 'Cilindro', Line: 'Linha', Emanation: 'Emanação', Wall: 'Muralha' };
const TIPOS_RE = Object.keys(TIPO).join('|');

const m = pes => String(Math.round(pes * 0.3 * 10) / 10).replace('.', ',');
const unidade = (n, sing, plur) => `${n} ${n === 1 ? sing : plur}`;

function tempo(t) {
  const base = t.split(/,| \(| or /)[0].trim();
  let out = { Action: '1 Ação', 'Bonus Action': '1 Ação Bônus', Reaction: 'Reação' }[base];
  if (!out) { const x = base.match(/^(\d+) (minute|hour)s?$/); out = x ? (x[2] === 'minute' ? unidade(+x[1], 'minuto', 'minutos') : unidade(+x[1], 'hora', 'horas')) : base; }
  return out;
}
function alcance(r) {
  const b = r.replace(/ Component:.*$/, '').trim();
  const fixo = { Self: 'Pessoal', Touch: 'Toque', Sight: 'Visão', Special: 'Especial', Unlimited: 'Ilimitado' }[b];
  if (fixo) return fixo;
  let x = b.match(/^([\d,]+) feet$/);
  if (x) return `${m(+x[1].replace(/,/g, ''))} m (${x[1]} pés)`;
  x = b.match(/^(\d+) miles?$/);
  if (x) return `${String(+x[1] * 1.5).replace('.', ',')} km (${unidade(+x[1], 'milha', 'milhas')})`;
  return b;
}
function duracao(d, conc) {
  const tx = d.replace(/^concentration /i, '').trim();
  const fixo = { Instantaneous: 'Instantânea', 'Until dispelled': 'Até ser dissipada', 'Until dispelled or triggered': 'Até ser dissipada ou acionada', Special: 'Especial' }[tx];
  if (fixo) return fixo;
  const x = tx.match(/^(up to )?(\d+) (round|minute|hour|day)s?$/i);
  if (!x) return tx;
  const n = +x[2], nome = { round: ['rodada', 'rodadas'], minute: ['minuto', 'minutos'], hour: ['hora', 'horas'], day: ['dia', 'dias'] }[x[3].toLowerCase()];
  const v = unidade(n, ...nome);
  return conc ? `Concentração, até ${v}` : x[1] ? `Até ${v}` : v;
}

const negrito = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
function separarTexto(s) {
  const ps = s.description.split(/\n+/).map(p => p.trim()).filter(Boolean), desc = [];
  let higher = s.higher_level || '', upgrade = '';
  for (const p of ps) {
    const up = p.match(/^(?:\*\*)?(?:\*)?Cantrip Upgrade\.(?:\*)?(?:\*\*)? ?(.*)$/);
    const hi = p.match(/^(?:\*\*)?(?:\*)?Using a Higher-Level Spell Slot\.(?:\*)?(?:\*\*)? ?(.*)$/);
    if (up) upgrade = up[1]; else if (hi) higher = higher || hi[1]; else desc.push(negrito(p));
  }
  // Alguns textos trazem o trecho no fim do parágrafo, sem quebra de linha.
  const juntos = desc.length ? desc[desc.length - 1] : '';
  const cu = juntos.match(/^(.*?)\s*(?:<b>)?Cantrip Upgrade\.(?:<\/b>)? ?(.*)$/);
  if (cu) { desc[desc.length - 1] = cu[1]; upgrade = upgrade || cu[2]; }
  const hl = desc[desc.length - 1]?.match(/^(.*?)\s*(?:<b>)?Using a Higher-Level Spell Slot\.(?:<\/b>)? ?(.*)$/);
  if (hl) { desc[desc.length - 1] = hl[1]; higher = higher || hl[2]; }
  return { desc: desc.filter(Boolean), higher, upgrade };
}

function rolagens(s, tx, ov) {
  const r = [], todo = tx.desc.join(' ').replace(/<[^>]+>/g, '');
  const saves = [...new Set([...todo.matchAll(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/g)].map(x => ATRIB[x[1]]))];
  if (s.attack_type || /\b(melee|ranged) spell attack|spell attack\b/i.test(todo)) r.push({ t: 'atk' });
  saves.forEach(a => r.push({ t: 'save', a }));
  const metade = /half as much/i.test(todo);
  const upTxt = tx.higher.match(/(?:damage|healing)[^.]*?increases by (\d+d\d+)[^.]*?(?:slot level|level) above/i)?.[1]
    || tx.higher.match(/increases by (\d+d\d+) for each/i)?.[1];
  const cantrip = tx.upgrade.match(/increases by (\d+d\d+)/i)?.[1];
  const vistos = new Set();
  const addDano = (d, tipo, extra = {}) => {
    const e = d.replace(/\s/g, ''), k = e + tipo;
    if (vistos.has(k)) return;
    vistos.add(k);
    const row = { t: 'dmg', d: e, type: TIPO[tipo] || tipo };
    if (metade && saves.length) row.half = true;
    if (s.attack_type) row.crit = true;
    Object.assign(row, extra);
    r.push(row);
  };
  if (s.damage?.damage_at_slot_level) {
    const tabela = s.damage.damage_at_slot_level, ks = Object.keys(tabela).map(Number).sort((a, b) => a - b);
    const extra = ks.length > 1 ? { table: tabela } : {};
    addDano(tabela[ks[0]], s.damage.damage_type.name, extra);
  }
  for (const x of todo.matchAll(new RegExp(`(\\d+d\\d+(?: ?\\+ ?\\d+)?)(?: (?:extra|additional))? (${TIPOS_RE})(?: damage)?`, 'g'))) addDano(x[1], x[2]);
  const danos = r.filter(x => x.t === 'dmg');
  if (danos.length) {
    if (upTxt) { const f = upTxt.split('d')[1]; (danos.find(x => x.d.includes('d' + f)) || danos[0]).up = upTxt; }
    if (cantrip) { const f = cantrip.split('d')[1]; const alvo = danos.find(x => x.d.includes('d' + f)) || danos[0]; alvo.cantrip = cantrip; }
  }
  const cura = todo.match(/(?:regains?|restores?)[^.]*?Hit Points equal to (\d+d\d+)( \+ \d+)?( plus your spellcasting ability modifier)?/i)
    || todo.match(/(?:regains?|restores?) (?:a number of )?(?:Hit Points )?(\d+d\d+)/i);
  if (cura) r.push({ t: 'dmg', d: cura[1], type: 'Cura', heal: true, ...(cura[3] ? { addMod: true } : {}), ...(tx.higher.match(/healing increases by (\d+d\d+)/i) ? { up: tx.higher.match(/healing increases by (\d+d\d+)/i)[1] } : {}) });
  return ov.r || r;
}

function escolhaDeTipo(tx) {
  const frases = tx.desc.join(' ').replace(/<[^>]+>/g, '').split(/(?<=[.:;])\s+/);
  for (const f of frases) {
    if (!/choose|choice|chosen|one of/i.test(f)) continue;
    const ts = [...new Set([...f.matchAll(new RegExp(`\\b(${TIPOS_RE})\\b`, 'g'))].map(x => TIPO[x[1]]))];
    if (ts.length >= 3) return ts;
  }
  return null;
}

const { _legenda, ...overrides } = ler('srd-overrides.json', {});
const pt = ler('i18n/spells.pt.json', {});
const srd = ler('srd/Spells.json', []);

/* Lista de magias do Artífice, de Eberron: Forge of the Artificer. */
const ARTIFICE = new Set(['Acid Splash', 'Dancing Lights', 'Elementalism', 'Fire Bolt', 'Guidance', 'Light', 'Mage Hand', 'Message', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Resistance', 'Shocking Grasp', 'Spare the Dying', 'Thorn Whip', 'Thunderclap', 'True Strike', 'Alarm', 'Cure Wounds', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'Faerie Fire', 'False Life', 'Feather Fall', 'Grease', 'Identify', 'Jump', 'Longstrider', 'Purify Food and Drink', 'Sanctuary', 'Aid', 'Alter Self', 'Arcane Lock', 'Blur', 'Continual Flame', 'Darkvision', "Dragon's Breath", 'Enhance Ability', 'Enlarge/Reduce', 'Heat Metal', 'Invisibility', 'Lesser Restoration', 'Levitate', 'Magic Mouth', 'Magic Weapon', 'Protection from Poison', 'Rope Trick', 'See Invisibility', 'Spider Climb', 'Web', 'Blink', 'Create Food and Water', 'Dispel Magic', 'Elemental Weapon', 'Fly', 'Glyph of Warding', 'Haste', 'Protection from Energy', 'Revivify', 'Water Breathing', 'Water Walk', 'Arcane Eye', 'Fabricate', 'Freedom of Movement', 'Secret Chest', 'Faithful Hound', 'Private Sanctum', 'Resilient Sphere', 'Stone Shape', 'Stoneskin', 'Animate Objects', 'Arcane Hand', 'Creation', 'Greater Restoration', 'Wall of Stone']);

const magias = srd.map(s => {
  const ov = overrides[s.index] || {};
  const tx = separarTexto(s), t = pt[s.index] || {}, r = rolagens(s, tx, ov);
  const area = tx.desc.join(' ').match(new RegExp(`(\\d+)-foot(?:-radius|-long|-wide|-tall|-high)?[ -](?:[\\w-]+ )?(${Object.keys(FORMA).join('|')})`));
  const dano = r.find(x => x.t === 'dmg');
  const out = {
    id: s.index, name: t.name || s.name, en: s.name, level: s.level, school: ESCOLA[s.school.index], classes: [...s.classes.map(c => c.index), ...(ARTIFICE.has(s.name) ? ['artificer'] : [])],
    time: tempo(s.casting_time), range: alcance(s.range), comp: s.components.join(', '), dur: duracao(s.duration, s.concentration),
    conc: s.concentration, ritual: s.ritual, r,
    desc: t.desc || tx.desc, src: 'srd', orig: { desc: tx.desc, higher: tx.higher, upgrade: tx.upgrade, time: s.casting_time }, ptOk: !!t.desc
  };
  if (s.components.includes('M') && s.material) {
    out.material = t.material || s.material;
    const gp = s.material.match(/([\d,]+)\+? ?GP/i);
    if (gp) { out.matGp = +gp[1].replace(/,/g, ''); out.matUsed = /consumes/i.test(s.material + ' ' + s.description); }
  }
  if (tx.higher) out.higher = t.higher || tx.higher;
  if (tx.upgrade) out.upgrade = t.upgrade || tx.upgrade;
  if (/Reaction/.test(s.casting_time)) out.reaction = true;
  if (dano) out.dmgChip = dano.d;
  if (area) out.area = { shape: FORMA[area[2]], feet: +area[1], text: `${FORMA[area[2]]} de ${m(+area[1])} m` };
  const ch = ov.choice || escolhaDeTipo(tx);
  if (ch) out.choice = ch;
  return { ...out, ...Object.fromEntries(Object.entries(ov).filter(([k]) => k !== 'r')) };
});

fs.writeFileSync(data('spells.json'), JSON.stringify(magias, null, 1));
const biblioteca = { versao: new Date().toISOString().slice(0, 10), fonte: 'SRD 5.2 (CC BY 4.0)', magias };
fs.writeFileSync(data('library.js'), `window.GRIMORIO_LIBRARY=${JSON.stringify(biblioteca)};\n`);

const pct = n => `${n} (${Math.round(n / magias.length * 100)}%)`;
const cob = f => pct(magias.filter(f).length);
console.log({
  magias: magias.length,
  comRolagem: cob(s => s.r.length), comDano: cob(s => s.r.some(x => x.t === 'dmg' && !x.heal)), comCura: cob(s => s.r.some(x => x.heal)),
  comSalvaguarda: cob(s => s.r.some(x => x.t === 'save')), comAtaque: cob(s => s.r.some(x => x.t === 'atk')), comArea: cob(s => s.area),
  escalonamento: cob(s => s.r.some(x => x.up || x.table || x.cantrip)), escolhaDeTipo: magias.filter(s => s.choice).map(s => s.en).join(', '),
  traduzidasNome: cob(s => s.name !== s.en || pt[s.id]?.name), traduzidasTexto: cob(s => s.ptOk), overrides: Object.keys(overrides).length,
  tamanhoKB: Math.round(fs.statSync(data('library.js')).size / 1024)
});
