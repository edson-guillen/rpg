#!/usr/bin/env node
// Gera data/fx-art.js só com as silhuetas que as cenas usam.
// Silhuetas do Game-icons.net (CC BY 3.0), pelo pacote @iconify-json/game-icons.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { icons } = require('@iconify-json/game-icons/icons.json');
const PADRAO = ['person', 'spinning-blades'];

export function buildArt() {
  const fontes = ['src/fx/cenas.js', 'private/cenas-pessoais.json'].map(f => path.join(root, f)).filter(f => fs.existsSync(f));
  const texto = fs.readFileSync(path.join(root, 'src/fx/cenas.js'), 'utf8');
  const nomes = new Set(PADRAO);
  for (const m of texto.matchAll(/'@([a-z0-9-]+)'/g)) nomes.add(m[1]);
  // As cenas pessoais citam só silhuetas; o nome delas pode entrar no arquivo público.
  if (fontes[1]) for (const m of fs.readFileSync(fontes[1], 'utf8').matchAll(/"@([a-z0-9-]+)"/g)) nomes.add(m[1]);
  // Sem a pasta private (sessão na nuvem), mantém as silhuetas que já estavam no arquivo.
  const atual = path.join(root, 'data/fx-art.js');
  if (!fontes[1] && fs.existsSync(atual)) for (const m of fs.readFileSync(atual, 'utf8').matchAll(/"([a-z0-9-]+)":"/g)) nomes.add(m[1]);
  const faltam = [...nomes].filter(n => !icons[n]);
  if (faltam.length) throw new Error(`Silhuetas inexistentes: ${faltam.join(', ')}`);
  const art = {};
  for (const n of [...nomes].sort()) art[n] = [...icons[n].body.matchAll(/ d="([^"]+)"/g)].map(m => m[1]).join(' ');
  const saida = `/* Silhuetas: Game-icons.net, CC BY 3.0 (https://game-icons.net). */\nwindow.GRIMORIO_ART=${JSON.stringify(art)};\n`;
  fs.writeFileSync(path.join(root, 'data/fx-art.js'), saida);
  return { silhuetas: nomes.size, kb: Math.round(saida.length / 1024) };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(buildArt());
