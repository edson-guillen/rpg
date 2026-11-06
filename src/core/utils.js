/* =====================================================================
   UTILITÁRIOS
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const d = n => 1 + Math.floor(Math.random() * n);
const sign = n => (n >= 0 ? '+' : '−') + Math.abs(n);
const lvClass = l => 'lv' + Math.min(l, 2);
const avail = l => CHAR.slots[l] - state.used[l];
const totalAvail = l => avail(l) + state.extra[l];
const dc = () => CHAR.stats.dc + (state.fx.innate ? 1 : 0);
const ac = () => CHAR.stats.ac + (state.fx.shield ? CHAR.stats.shieldBonus : 0);
const norm = s => [...String(s)].map(ch => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()).join('');
const strip = s => String(s).replace(/<[^>]+>/g, '');
const fmt = s => String(s ?? '').replace(/\{CD\}/g, dc());
const modOf = score => Math.floor((score - 10) / 2);
const abil = k => CHAR.abilities.find(a => a.k === k);
const decimal = n => String(Math.round(n * 10) / 10).replace('.', ',');
const SAVE_NAME = { FOR: 'Força', DES: 'Destreza', CON: 'Constituição', INT: 'Inteligência', SAB: 'Sabedoria', CAR: 'Carisma' };
const matItem = key => state.items.find(i => i.key === key);
const matQty = key => matItem(key)?.qty ?? 0;
const blocked = s => !!(s.mat?.required && matQty(s.mat.key) < 1);

