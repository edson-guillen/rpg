#!/usr/bin/env node
// Monta o index.html único a partir de src/. Os arquivos de src/js compartilham um só escopo,
// na ordem de APP_FILES, porque a camada de animação envolve funções do app por nome.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

export const APP_FILES = [
  'core/store.js', 'core/state.js', 'core/utils.js', 'core/dice.js',
  'ui/header-slots.js', 'ui/ficha.js', 'ui/grimorio.js', 'ui/recursos-mochila.js',
  'ui/modais.js', 'ui/acoes.js', 'ui/init.js', 'notes/notes.js', 'ui/personagens.js', 'library/library.js', 'fx/spellfx.js', 'ui/boot.js',
];

export function build() {
  const app = APP_FILES.map(src).join('');
  return src('index.template.html').replace(/<!--inject:([^>]+)-->\r?\n?/g, (_, f) => (f === 'app' ? app : src(f)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = build();
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log(`index.html gerado (${(html.length / 1024).toFixed(0)} KB)`);
}
