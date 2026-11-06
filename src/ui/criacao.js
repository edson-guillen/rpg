/* =====================================================================
   CRIAR PERSONAGEM — assistente guiado, todas as classes de D&D 2024
   ===================================================================== */
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
let cw = null;
const CW_TITLES = ['Classe', 'Espécie', 'Antecedente', 'Atributos', 'Perícias', 'Talento de origem', 'Equipamento', 'Truques e magias', 'Nível inicial'];

function freshWizard(name) {
  return { step: 0, name, classId: 'sorcerer', sub: '', speciesId: 'human', lineage: 'cloud', customSpecies: '', customSpeed: 30, backgroundId: 'acolyte', customBg: '', attrs: ['CAR', 'CON', 'DES'], bonusMode: '21', bonus: { plus2: 'CAR', plus1: 'SAB' }, method: 'padrao', scores: Object.fromEntries(ATTR.map(([k]) => [k, 10])), pool: [...STANDARD_ARRAY], assign: { CAR: 15, CON: 14, DES: 13, SAB: 12, INT: 10, FOR: 8 }, skills: [], feat: '', gear: 'a', spells: [], level: 1, expertise: [] };
}
async function openCreator(name) { await ensureLibrary(); cw = freshWizard(name); openModal(creatorBody); }

const cwClasse = () => CLASSES[cw.classId];
const cwLista = () => (cwClasse().skills[1] || SKILLS.map(s => s[0]));
const cwSpecies = () => (cw.speciesId === 'custom' ? { id: 'custom', name: cw.customSpecies || 'Personalizada', speed: cw.customSpeed, traits: [] } : speciesById(cw.speciesId));
const cwBackground = () => (cw.backgroundId === 'custom' ? { id: 'custom', name: cw.customBg || 'Personalizado', attrs: cw.attrs, feat: '', skills: [], tool: '', desc: '' } : backgroundById(cw.backgroundId));
function baseScores() {
  if (cw.method === 'compra') return { ...cw.scores };
  return Object.fromEntries(ATTR.map(([k]) => [k, cw.assign[k] ?? 8]));
}
function finalScores() {
  const s = baseScores(), bg = cwBackground();
  if (cw.bonusMode === '111') bg.attrs.forEach(k => { s[k] += 1; });
  else { s[cw.bonus.plus2] += 2; s[cw.bonus.plus1] += 1; }
  for (const k of Object.keys(s)) s[k] = Math.min(20, s[k]);
  return s;
}
const pointsUsed = () => Object.values(cw.scores).reduce((a, v) => a + (POINT_COST[v] ?? 0), 0);
function stepValid() {
  const bg = cwBackground();
  switch (cw.step) {
    case 1: return cw.speciesId !== 'custom' || !!cw.customSpecies.trim();
    case 2: return (cw.backgroundId !== 'custom' || !!cw.customBg.trim()) && (cw.bonusMode === '111' || (cw.bonus.plus2 !== cw.bonus.plus1 && bg.attrs.includes(cw.bonus.plus2) && bg.attrs.includes(cw.bonus.plus1)));
    case 3: { if (cw.method === 'compra') return pointsUsed() <= 27; const v = Object.values(cw.assign); return new Set(ATTR.map(([k]) => k)).size === 6 && [...v].sort().join() === [...cw.pool].sort().join(); }
    case 4: return cw.skills.length === cwClasse().skills[0];
    case 6: return !!cw.gear;
    default: return true;
  }
}
function creatorBody() {
  const i = cw.step, head = mHead(`${cw.name} · etapa ${i + 1} de ${CW_TITLES.length}`, CW_TITLES[i]);
  const nav = `<div class="m-actions">${i ? '<button class="btn ghost" data-action="cw-back">Voltar</button>' : '<button class="btn ghost" data-action="close">Cancelar</button>'}<button class="btn gold" data-action="${i === CW_TITLES.length - 1 ? 'cw-finish' : 'cw-next'}" ${stepValid() ? '' : 'disabled'}>${i === CW_TITLES.length - 1 ? 'Criar personagem' : 'Continuar'}</button></div>`;
  const opts = (list, val) => list.map(([v, t]) => `<option value="${esc(v)}" ${val === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const P = privateCatalog();
  let b = '';
  if (i === 0) {
    const C = cwClasse();
    b = `<div class="field"><label for="cw-cl">Classe</label><select id="cw-cl">${opts(Object.entries(CLASSES).sort((x, y) => x[1].name.localeCompare(y[1].name, 'pt-BR')).map(([k, v]) => [k, v.name]), cw.classId)}</select></div>
      <ul class="plist"><li><b>Dado de Ponto de Vida:</b> d${C.hd}</li><li><b>Atributo primário:</b> ${C.prim.join(' e ')}</li><li><b>Salvaguardas:</b> ${C.saves.join(' e ')}</li><li><b>Armas:</b> ${esc(C.armas)}</li><li><b>Armadura:</b> ${esc(C.armadura)}</li>${C.ferr ? `<li><b>Ferramentas:</b> ${esc(C.ferr)}</li>` : ''}${C.caster ? `<li><b>Conjuração:</b> ${C.caster.attr}</li>` : ''}</ul>
      <p class="note">Subclasses: ${esc(Object.values(C.subs).map(s => s.name).join(', '))}.</p>`;
  } else if (i === 1) {
    const sp = cwSpecies();
    b = `<div class="field"><label for="cw-sp">Espécie</label><select id="cw-sp">${opts([...SPECIES.map(s => [s.id, s.name]), ...P.especies.map(s => [s.id, s.name + ' (pessoal)']), ['custom', 'Personalizada']], cw.speciesId)}</select></div>
      ${cw.speciesId === 'custom' ? `<div class="field-row"><div class="field"><label for="cw-spn">Nome</label><input id="cw-spn" maxlength="40" value="${esc(cw.customSpecies)}"></div><div class="field"><label for="cw-spd">Deslocamento (pés)</label><input id="cw-spd" type="number" min="5" max="60" step="5" value="${cw.customSpeed}"></div></div>` : ''}
      ${sp.lineages ? `<div class="field"><label for="cw-lin">Ascendência</label><select id="cw-lin">${opts(Object.entries(sp.lineages).map(([k, v]) => [k, v[0]]), cw.lineage)}</select></div>` : ''}
      <ul class="plist">${(sp.traits || []).map(([t, d]) => `<li><b>${esc(t)}.</b> ${esc(String(d).slice(0, 240))}</li>`).join('')}</ul>`;
  } else if (i === 2) {
    const bg = cwBackground(), a = bg.attrs.map(k => [k, ATTR.find(x => x[0] === k)[1]]);
    b = `<div class="field"><label for="cw-bg">Antecedente</label><select id="cw-bg">${opts([...BACKGROUNDS.filter(x => x.id !== 'wayfarer').map(x => [x.id, x.name]), ...P.antecedentes.map(x => [x.id, x.name + ' (pessoal)']), ['custom', 'Personalizado']], cw.backgroundId)}</select></div>
      ${cw.backgroundId === 'custom' ? `<div class="field"><label for="cw-bgn">Nome</label><input id="cw-bgn" maxlength="40" value="${esc(cw.customBg)}"></div><div class="field-row">${[0, 1, 2].map(n => `<div class="field"><label>Atributo ${n + 1}</label><select data-cwattr="${n}">${opts(ATTR, cw.attrs[n])}</select></div>`).join('')}</div>` : `<p class="note">${esc(bg.desc || '')} Perícias: ${esc((bg.skills || []).join(', '))}.</p>`}
      <div class="ck-row"><label class="ck"><input type="radio" name="cw-bonus" value="21" ${cw.bonusMode === '21' ? 'checked' : ''}>+2 e +1</label><label class="ck"><input type="radio" name="cw-bonus" value="111" ${cw.bonusMode === '111' ? 'checked' : ''}>+1, +1 e +1</label></div>
      ${cw.bonusMode === '21' ? `<div class="field-row"><div class="field"><label for="cw-p2">+2 em</label><select id="cw-p2">${opts(a, cw.bonus.plus2)}</select></div><div class="field"><label for="cw-p1">+1 em</label><select id="cw-p1">${opts(a, cw.bonus.plus1)}</select></div></div>${cw.bonus.plus2 === cw.bonus.plus1 ? '<p class="note">Escolha atributos diferentes.</p>' : ''}` : ''}`;
  } else if (i === 3) {
    const metodo = `<div class="ck-row">${[['padrao', 'Conjunto padrão'], ['compra', 'Compra de pontos (27)'], ['rolar', 'Rolar 4d6']].map(([v, t]) => `<label class="ck"><input type="radio" name="cw-method" value="${v}" ${cw.method === v ? 'checked' : ''}>${t}</label>`).join('')}</div>`;
    const fim = finalScores();
    if (cw.method === 'compra') b = `${metodo}<p class="note">Pontos usados: <b>${pointsUsed()}</b> de 27</p><div class="scores">${ATTR.map(([k, n]) => `<div class="score"><span>${n}</span><div><button type="button" class="btn sm" data-action="cw-score" data-k="${k}" data-d="-1">−</button><b>${cw.scores[k]}</b><button type="button" class="btn sm" data-action="cw-score" data-k="${k}" data-d="1">+</button></div><small>com bônus: ${fim[k]}</small></div>`).join('')}</div>`;
    else b = `${metodo}${cw.method === 'rolar' ? `<div class="m-actions"><button type="button" class="btn frost" data-action="cw-roll">${icon('i-d20')}Rolar 4d6 seis vezes</button></div>` : ''}<p class="note">Valores: ${cw.pool.join(', ')}</p><div class="scores">${ATTR.map(([k, n]) => `<div class="score"><span>${n}</span><select data-cwassign="${k}">${[...new Set(cw.pool)].sort((x, y) => y - x).map(v => `<option ${cw.assign[k] === v ? 'selected' : ''}>${v}</option>`).join('')}</select><small>com bônus: ${fim[k]}</small></div>`).join('')}</div>${stepValid() ? '' : '<p class="note">Use cada valor uma vez só.</p>'}`;
  } else if (i === 4) {
    const bgS = cwBackground().skills || [];
    b = `<p class="note" style="margin-top:12px">Do antecedente: ${esc(bgS.join(', ') || 'nenhuma')}. Escolha ${cwClasse().skills[0]} perícias de ${esc(cwClasse().name)}.</p><div class="pick">${cwLista().filter(s => !bgS.includes(s)).map(s => `<label class="ck"><input type="checkbox" data-cwskill="${s}" ${cw.skills.includes(s) ? 'checked' : ''}>${s}</label>`).join('')}</div>`;
  } else if (i === 5) {
    const bg = cwBackground(), fixo = bg.feat && featById(bg.feat), origem = allFeats().filter(f => f.cat === 'origem');
    b = fixo && cw.backgroundId !== 'custom' ? `<p style="margin-top:12px"><b>${esc(fixo.name)}</b>, do antecedente.</p><p class="note">${esc(String(fixo.desc).slice(0, 260))}</p>` : `<div class="field"><label for="cw-feat">Talento</label><select id="cw-feat"><option value="">Nenhum</option>${opts(origem.map(f => [f.id, f.name]), cw.feat)}</select></div>`;
  } else if (i === 6) {
    b = `<div class="pick" style="margin-top:12px">${Object.entries(cwClasse().gear).map(([k, g]) => `<label class="ck"><input type="radio" name="cw-gear" value="${k}" ${cw.gear === k ? 'checked' : ''}>${esc(g.label)}</label>`).join('')}</div>`;
  } else if (i === 7) {
    const L1 = CLASS_LEVELS[cw.classId][0], lista = cwClasse().caster ? libraryAll().filter(s => (s.classes || []).includes(cw.classId) && s.level <= 1) : [];
    const q = nivel => cw.spells.filter(id => { const s = libGet(id); return nivel ? s.level > 0 : s.level === 0; }).length;
    const box = (titulo, max, f, nv) => `<h4 class="ed-h">${titulo} (${q(nv)} de ${max})</h4><div class="pick">${lista.filter(f).sort((x, y) => x.name.localeCompare(y.name, 'pt-BR')).map(s => `<label class="ck"><input type="checkbox" data-cwsp="${esc(s.id)}" ${cw.spells.includes(s.id) ? 'checked' : ''}>${esc(s.name)}</label>`).join('')}</div>`;
    b = !cwClasse().caster ? '<p class="note" style="margin-top:12px">Esta classe não conjura magias no nível 1.</p>' : lista.length ? (L1.cantrips ? box('Truques', L1.cantrips, s => !s.level, false) : '') + box('Magias preparadas', L1.prepared, s => s.level, true) : '<p class="note">A biblioteca não está disponível. Você pode escolher as magias depois.</p>';
  } else {
    b = `<div class="field" style="margin-top:12px"><label for="cw-level">Nível inicial</label><select id="cw-level">${Array.from({ length: 20 }, (_, n) => n + 1).map(n => `<option ${cw.level === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      ${cw.level >= 3 ? `<div class="field"><label for="cw-sub">Subclasse</label><select id="cw-sub"><option value="">Escolher depois</option>${opts(Object.entries(cwClasse().subs).map(([k, v]) => [k, v.name]), cw.sub)}</select></div>` : ''}
      <p class="note">Acima do nível 1, o app usa a média de PV e soma os aumentos de atributo no atributo primário. Depois você ajusta magias e talentos pela Biblioteca e pela aba Personagem.</p>`;
  }
  return head + b + nav;
}
function buildFromWizard() {
  const bg = cwBackground(), sp = cwSpecies(), b = blankBuild(1, cw.classId);
  b.speciesId = sp.id === 'custom' ? null : sp.id;
  b.lineage = sp.lineages ? cw.lineage : null;
  b.backgroundId = bg.id === 'custom' ? null : bg.id;
  b.scores = finalScores();
  b.skills = Object.fromEntries([...cw.skills.map(s => [s, 'Classe']), ...(bg.skills || []).map(s => [s, bg.name])]);
  const feat = cw.backgroundId !== 'custom' && bg.feat && featById(bg.feat) ? bg.feat : cw.feat;
  b.feats = feat ? [feat] : [];
  if (bg.tool) b.tools = [[bg.tool, 'DES', bg.name]];
  return b;
}
function finishCreator() {
  const b = buildFromWizard(), c = newCharacter(cw.name, b);
  const gear = cwClasse().gear[cw.gear].items, cats = { arm: 'arma', eq: 'equip' }, arm = gear.find(g => ARMADURAS.some(a => a[0] === g[0]));
  c.sheet.items = gear.map(([name, qty, cat]) => ({ name, note: ARMAS.find(a => a[0] === name)?.slice(1, 3).join(' ') || '', qty, cat: cats[cat] || cat, unit: '' }));
  if (arm) b.armor = arm[0];
  if (gear.some(g => g[0] === 'Escudo')) b.shield = true;
  c.grimoire.added = cw.spells.map(id => { const { base: _b, _hay, ...s } = libGet(id); return s; });
  c.sub = deriveSheet(c).subText;
  closeModal();
  addCharacter(c);
  const meta = METAMAGIC.map(m => m.id);
  while (buildOf(c).level < cw.level) {
    const need = levelNeeds(c, cw.classId, cw.sub || null), p0 = cwClasse().prim[0], attr = buildOf(c).scores[p0] < 20 ? p0 : 'CON';
    commitLevel({ classId: cw.classId, subclass: cw.sub || undefined, hp: Math.floor(cwClasse().hd / 2) + 1, asi: need.asi ? { [attr]: 2 } : {}, feat: need.boon ? 'boon-fate' : '', metamagic: meta.filter(m => !buildOf(c).metamagic.includes(m)).slice(0, Math.max(0, need.metamagic)) });
  }
  state.hp = CHAR.stats.hpMax;
  save(); renderHero(); render(); renderPassives();
  toast(`${c.name} criado`, false);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b || !cw) return;
  switch (b.dataset.action) {
    case 'cw-next': cw.step++; modalRefresh(); $('#sheet').scrollTop = 0; break;
    case 'cw-back': cw.step--; modalRefresh(); break;
    case 'cw-finish': finishCreator(); break;
    case 'cw-score': { const k = b.dataset.k, v = cw.scores[k] + +b.dataset.d; if (v >= 8 && v <= 15) { cw.scores[k] = v; modalRefresh(); } break; }
    case 'cw-roll': {
      cw.pool = Array.from({ length: 6 }, () => { const r = [d(6), d(6), d(6), d(6)].sort((x, y) => x - y); return r[1] + r[2] + r[3]; }).sort((x, y) => y - x);
      ATTR.forEach(([k], i) => { cw.assign[k] = cw.pool[i]; }); modalRefresh(); break;
    }
  }
});
document.addEventListener('change', e => {
  if (!cw || $('#modal').hidden) return;
  const t = e.target, set = (f, v) => { cw[f] = v; modalRefresh(); };
  if (t.id === 'cw-cl') { cw.classId = t.value; cw.skills = []; cw.spells = []; cw.sub = ''; cw.gear = 'a'; modalRefresh(); }
  else if (t.id === 'cw-sub') set('sub', t.value);
  else if (t.id === 'cw-sp') set('speciesId', t.value);
  else if (t.id === 'cw-lin') set('lineage', t.value);
  else if (t.id === 'cw-spn') set('customSpecies', t.value);
  else if (t.id === 'cw-spd') set('customSpeed', +t.value || 30);
  else if (t.id === 'cw-bg') {
    cw.backgroundId = t.value; const a = cwBackground().attrs; cw.bonus = { plus2: a[0], plus1: a[1] }; modalRefresh();
  } else if (t.id === 'cw-bgn') set('customBg', t.value);
  else if (t.dataset.cwattr) { cw.attrs[+t.dataset.cwattr] = t.value; modalRefresh(); }
  else if (t.name === 'cw-bonus') set('bonusMode', t.value);
  else if (t.id === 'cw-p2') { cw.bonus.plus2 = t.value; modalRefresh(); }
  else if (t.id === 'cw-p1') { cw.bonus.plus1 = t.value; modalRefresh(); }
  else if (t.name === 'cw-method') {
    cw.method = t.value;
    if (t.value === 'padrao') { cw.pool = [...STANDARD_ARRAY]; ATTR.forEach(([k], i) => { cw.assign[k] = [8, 13, 14, 10, 12, 15][i]; }); }
    if (t.value === 'compra') cw.scores = Object.fromEntries(ATTR.map(([k]) => [k, 8]));
    if (t.value === 'rolar') cw.pool = [10, 10, 10, 10, 10, 10];
    modalRefresh();
  } else if (t.dataset.cwassign) { cw.assign[t.dataset.cwassign] = +t.value; modalRefresh(); }
  else if (t.dataset.cwskill) {
    const q = cwClasse().skills[0];
    if (t.checked && cw.skills.length >= q) { t.checked = false; toast(`Escolha ${q} perícias`, false); return; }
    cw.skills = t.checked ? [...cw.skills, t.dataset.cwskill] : cw.skills.filter(s => s !== t.dataset.cwskill); modalRefresh();
  } else if (t.id === 'cw-feat') set('feat', t.value);
  else if (t.name === 'cw-gear') set('gear', t.value);
  else if (t.id === 'cw-level') set('level', +t.value);
  else if (t.dataset.cwsp) {
    const s = libGet(t.dataset.cwsp), L1 = CLASS_LEVELS[cw.classId][0], max = s.level ? L1.prepared : L1.cantrips;
    const n = cw.spells.filter(id => (libGet(id).level > 0) === (s.level > 0)).length;
    if (t.checked && n >= max) { t.checked = false; toast(`Escolha até ${max}`, false); return; }
    cw.spells = t.checked ? [...cw.spells, s.id] : cw.spells.filter(x => x !== s.id); modalRefresh();
  }
});
