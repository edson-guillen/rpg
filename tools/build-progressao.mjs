#!/usr/bin/env node
// Gera src/rules/progressao.js a partir de data/srd/Levels.json (SRD 5.2, CC BY 4.0).
// O Artífice vem de Eberron: Forge of the Artificer e entra por tabela escrita aqui.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const niveis = JSON.parse(fs.readFileSync(path.join(root, 'data/srd/Levels.json'), 'utf8')).filter(l => l.class && !l.subclass);
const pb = n => Math.ceil(n / 4) + 1;
const out = {};
for (const l of niveis) {
  const id = l.class.index, s = l.spellcasting, k = l.class_specific || {};
  const linha = { pb: l.prof_bonus ?? pb(l.level) };
  if (s) { linha.cantrips = s.cantrips_known || 0; linha.prepared = s.prepared_spells || 0; linha.slots = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => s[`spell_slots_level_${i}`] || 0); }
  for (const c of ['rage_count', 'rage_damage_bonus', 'bardic_inspiration_die', 'channel_divinity_charges', 'wild_shape_uses', 'second_wind_uses', 'martial_arts_die', 'focus_points', 'unarmored_movement_bonus', 'favored_enemies', 'eldritch_invocations', 'sorcery_points']) if (k[c] !== undefined) linha[c] = k[c];
  (out[id] = out[id] || [])[l.level - 1] = linha;
}
const MEIO = [[2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]];
const PREP = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
out.artificer = MEIO.map((m, i) => ({ pb: pb(i + 1), cantrips: i >= 13 ? 4 : i >= 9 ? 3 : 2, prepared: PREP[i], slots: [...m, ...Array(9 - m.length).fill(0)] }));
const TERCO = [[], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1]].map(m => [...m, ...Array(9 - m.length).fill(0)]);
const txt = `/* Progressão das classes. Gerado por tools/build-progressao.mjs a partir do SRD 5.2 (CC BY 4.0) e de Eberron: Forge of the Artificer. */
const CLASS_LEVELS = ${JSON.stringify(out)};
const SORCERER_LEVELS = CLASS_LEVELS.sorcerer;
const TERCO_SLOTS = ${JSON.stringify(TERCO)};
`;
fs.writeFileSync(path.join(root, 'src/rules/progressao.js'), txt);
console.log(Object.keys(out).map(k => `${k}:${out[k].length}`).join(' '));
