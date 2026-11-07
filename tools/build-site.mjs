#!/usr/bin/env node
// Monta a pasta dist/ publicada na Netlify. Só entra o que o site usa: nada de tools, tests, src ou private.
// A chave anon do Supabase é pública por natureza; quem protege os dados são as regras do banco.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY.'); process.exit(1); }

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), build({ url, key }));
for (const f of ['sw.js', 'manifest.webmanifest', 'privacidade.html', 'termos.html', 'legal.css', 'data/library.js', 'data/fx-art.js']) fs.copyFileSync(path.join(root, f), path.join(dist, f));
fs.copyFileSync(path.join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), path.join(dist, 'data/supabase.js'));

const origem = new URL(url).origin;
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${origem}`,
  "manifest-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');
fs.writeFileSync(path.join(dist, '_headers'), `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/sw.js
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
`);
console.log('dist/ pronto');
