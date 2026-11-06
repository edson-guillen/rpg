#!/usr/bin/env node
// Junta private/cenas-pessoais.json à private/biblioteca-pessoal.json. Tudo em private/ fica fora do git.
// Valor texto: usa a cena de outra magia. Valor lista: cena própria, no formato de src/fx/cenas.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arq = f => path.join(root, 'private', f);
if (fs.existsSync(arq('biblioteca-pessoal.json')) && fs.existsSync(arq('cenas-pessoais.json'))) {
  const bib = JSON.parse(fs.readFileSync(arq('biblioteca-pessoal.json'), 'utf8')), cenas = JSON.parse(fs.readFileSync(arq('cenas-pessoais.json'), 'utf8'));
  const srd = JSON.parse(fs.readFileSync(path.join(root, 'data/spells.json'), 'utf8'));
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const porNome = new Map(srd.map(s => [norm(s.name), s.id]));
  let proprias = 0, iguais = 0;
  const sem = [];
  for (const m of bib.magias) {
    const c = cenas[m.id] ?? porNome.get(norm(m.nome));
    if (c) { m.cena = c; if (Array.isArray(c)) proprias++; else iguais++; } else sem.push(m.id);
  }
  fs.writeFileSync(arq('biblioteca-pessoal.json'), JSON.stringify(bib));
  console.log({ magias: bib.magias.length, proprias, iguais, sem: sem.slice(0, 20) });
}
