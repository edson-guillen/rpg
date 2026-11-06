/* =====================================================================
   SUBIR DE NÍVEL — assistente com PV, mudanças, escolhas e revisão
   ===================================================================== */
let lv = null;
const pickCount = (s, nivel) => s.filter(x => (nivel ? x.level > 0 : x.level === 0)).length;

async function openLevelUp() {
  const c = activeChar();
  if (buildOf(c).level >= 20) return;
  await ensureLibrary();
  lv = { step: 0, need: levelNeeds(c), hp: null, src: '', mode: 'asi2', a1: 'CAR', a2: 'CON', feat: '', meta: [], spells: [], swapOut: '', swapIn: '' };
  // Talento planejado para este nível já vem marcado.
  const plan = Object.entries(buildOf(c).planned || {}).find(([, l]) => l === lv.need.n);
  if (plan && (lv.need.asi || lv.need.boon)) { lv.mode = 'feat'; lv.feat = plan[0]; }
  if (lv.need.boon) lv.mode = 'feat';
  openModal(levelBody);
}
const hasChoices = () => { const n = lv.need; return n.asi || n.boon || n.metamagic > 0 || n.cantrips > 0 || n.prepared > 0; };
const steps = () => [0, 1, ...(hasChoices() ? [2] : []), 3];

function levelBody() {
  const c = activeChar(), b = buildOf(c), n = lv.need, con = modScore(b.scores.CON), resil = (b.subclassId === 'draconic' || n.subclass) && n.n >= 3 ? (n.n === 3 ? 3 : 1) : 0, st = steps(), i = st.indexOf(lv.step);
  const nav = (ok, label = 'Continuar') => `<div class="m-actions">${i ? '<button class="btn ghost" data-action="lv-back">Voltar</button>' : '<button class="btn ghost" data-action="close">Cancelar</button>'}<button class="btn gold" data-action="${lv.step === 3 ? 'lv-apply' : 'lv-next'}" ${ok ? '' : 'disabled'}>${label}</button></div>`;
  const head = mHead(`Nível ${b.level} → ${n.n} · etapa ${i + 1} de ${st.length}`, ['Pontos de Vida', 'O que muda', 'Suas escolhas', 'Revisão'][lv.step]);
  if (lv.step === 0) return `${head}
    <p class="note" style="margin-top:12px">Ganho de PV: 1d6 ${sign(con)} (CON)${resil ? ` + ${resil} (Resiliência Dracônica)` : ''}, com mínimo de 1.</p>
    <div class="m-actions"><button class="btn frost" data-action="lv-roll">${icon('i-d20')}Rolar 1d6</button><button class="btn" data-action="lv-avg">Usar a média (4)</button></div>
    <div class="field" style="margin-top:12px"><label for="lv-die">Ou digite o dado físico</label><input id="lv-die" type="number" min="1" max="6" inputmode="numeric" value="${lv.src === 'dado físico' ? lv.hp : ''}"></div>
    ${lv.hp ? `<p class="note">Dado: <b>${lv.hp}</b> (${lv.src}) · ganho de <b>${Math.max(1, lv.hp + con) + resil} PV</b></p>` : ''}${nav(!!lv.hp)}`;
  if (lv.step === 1) return `${head}<ul class="plist" style="margin-top:12px">${levelDiff(c).map(t => `<li>${esc(t)}</li>`).join('') || '<li>Nenhuma mudança além dos PV.</li>'}${n.draconic.length ? `<li>Sempre preparadas: ${n.draconic.map(x => esc(libGet(x)?.name || x)).join(', ')}</li>` : ''}</ul>${nav(true)}`;
  if (lv.step === 2) {
    const attrs = ATTR.map(([k, nome]) => [k, `${nome} (${b.scores[k]})`]);
    const op = (sel, val, list) => list.map(([k, t]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const feats = allFeats().filter(f => !b.feats.includes(f.id) && f.id !== 'asi' && f.cat !== 'estilo' && (!f.min || f.min <= n.n) && (n.boon ? f.cat === 'dadiva' : f.cat !== 'dadiva'));
    const asi = n.asi || n.boon ? `<h4 class="ed-h">${n.boon ? 'Dádiva Épica' : 'Aumento no Valor de Atributo'}</h4>
      ${n.boon ? '' : `<div class="ck-row"><label class="ck"><input type="radio" name="lv-mode" value="asi2" ${lv.mode === 'asi2' ? 'checked' : ''}>+2 em um</label><label class="ck"><input type="radio" name="lv-mode" value="asi11" ${lv.mode === 'asi11' ? 'checked' : ''}>+1 em dois</label><label class="ck"><input type="radio" name="lv-mode" value="feat" ${lv.mode === 'feat' ? 'checked' : ''}>Talento</label></div>`}
      ${lv.mode === 'feat' ? `<div class="field"><label for="lv-feat">Talento</label><select id="lv-feat"><option value="">Escolha…</option>${op('', lv.feat, feats.map(f => [f.id, f.name]))}</select></div>${lv.feat ? `<p class="note">${esc(String(featById(lv.feat)?.desc || '').slice(0, 240))}</p>` : ''}`
        : `<div class="field-row"><div class="field"><label for="lv-a1">Atributo</label><select id="lv-a1">${op('', lv.a1, attrs)}</select></div>${lv.mode === 'asi11' ? `<div class="field"><label for="lv-a2">Segundo atributo</label><select id="lv-a2">${op('', lv.a2, attrs)}</select></div>` : ''}</div>`}` : '';
    const meta = n.metamagic > 0 ? `<h4 class="ed-h">Metamagia: escolha ${n.metamagic}</h4><div class="pick">${METAMAGIC.filter(m => !b.metamagic.includes(m.id)).map(m => `<label class="ck"><input type="checkbox" data-meta="${m.id}" ${lv.meta.includes(m.id) ? 'checked' : ''}><span><b>${esc(m.name)}</b> · ${m.cost} PF<br><small>${esc(m.desc)}</small></span></label>`).join('')}</div>` : '';
    const maxC = Math.max(...Object.keys(deriveSheetAt(c, n.n).slots).map(Number));
    const lista = libraryAll().filter(s => (s.classes || []).includes('sorcerer') && s.level <= maxC && !inGrimoire(s));
    const grupo = (titulo, q, filtro) => (q > 0 ? `<h4 class="ed-h">${titulo}: escolha até ${q} <small>(ou depois, na Biblioteca)</small></h4><div class="pick">${lista.filter(filtro).sort((x, y) => x.level - y.level || x.name.localeCompare(y.name, 'pt-BR')).map(s => `<label class="ck"><input type="checkbox" data-sp="${esc(s.id)}" ${lv.spells.includes(s.id) ? 'checked' : ''}><span>${esc(s.name)} <small>${s.level ? s.level + 'º' : 'truque'}</small></span></label>`).join('')}</div>` : '');
    const troca = `<h4 class="ed-h">Trocar uma magia (opcional)</h4><div class="field"><label for="lv-swap">Sair do grimório</label><select id="lv-swap"><option value="">Nenhuma</option>${SPELLS.filter(s => !s.draconic).map(s => `<option value="${esc(s.id)}" ${lv.swapOut === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>`;
    const okMeta = lv.meta.length === n.metamagic || n.metamagic <= 0, okFeat = !(n.asi || n.boon) || lv.mode !== 'feat' || !!lv.feat;
    return `${head}${asi}${meta}${grupo('Novos truques', n.cantrips, s => !s.level)}${grupo('Novas magias', n.prepared, s => s.level)}${troca}${nav(okMeta && okFeat)}`;
  }
  const ganho = Math.max(1, lv.hp + con) + resil, itens = [`+${ganho} PV (dado ${lv.hp}, ${lv.src})`];
  if (lv.mode === 'feat' && lv.feat) itens.push(`Talento: ${featById(lv.feat)?.name}`);
  else if (n.asi) itens.push(lv.mode === 'asi2' ? `+2 em ${lv.a1}` : `+1 em ${lv.a1} e +1 em ${lv.a2}`);
  if (lv.meta.length) itens.push('Metamagia: ' + lv.meta.map(id => METAMAGIC.find(m => m.id === id).name).join(', '));
  if (lv.spells.length) itens.push('Magias: ' + lv.spells.map(id => libGet(id)?.name).join(', '));
  if (lv.swapOut) itens.push('Sai do grimório: ' + (SPELL[lv.swapOut]?.name || lv.swapOut));
  return `${head}<ul class="plist" style="margin-top:12px">${itens.map(t => `<li>${esc(t)}</li>`).join('')}</ul>${nav(true, 'Aplicar nível')}`;
}
function deriveSheetAt(c, n) { const f = clone(c); f.build.level = n; f.level = n; return deriveSheet(f); }

function choicesFromWizard() {
  const n = lv.need, asi = {};
  if ((n.asi || n.boon) && lv.mode !== 'feat') {
    if (lv.mode === 'asi2') asi[lv.a1] = 2; else { asi[lv.a1] = (asi[lv.a1] || 0) + 1; asi[lv.a2] = (asi[lv.a2] || 0) + 1; }
  }
  return { hp: lv.hp, asi, feat: lv.mode === 'feat' ? lv.feat : '', metamagic: lv.meta, spells: lv.spells, swapOut: lv.swapOut };
}
/** Aplica o nível no personagem ativo e atualiza recursos, PV e telas. */
function commitLevel(ch) {
  const c = activeChar();
  save();
  const { antes, depois } = applyLevel(c, ch);
  bindSheet(c);
  const st = state, dif = id => (depois.resources.find(r => r.id === id)?.max ?? 0) - (antes.resources.find(r => r.id === id)?.max ?? 0);
  for (const r of depois.resources) st.res[r.id] = (st.res[r.id] ?? 0) + Math.max(0, dif(r.id));
  st.hp += depois.stats.hpMax - antes.stats.hpMax;
  state = sanitize(st);
  undoStack.length = 0;
  save();
  return depois;
}
function undoLastLevel() {
  const c = activeChar(), antes = deriveSheet(c);
  if (!undoLevel(c)) return;
  bindSheet(c);
  const d = deriveSheet(c);
  state.hp -= antes.stats.hpMax - d.stats.hpMax;
  for (const r of antes.resources) { const m = d.resources.find(x => x.id === r.id)?.max ?? 0; if (r.max > m) state.res[r.id] = Math.max(0, (state.res[r.id] ?? 0) - (r.max - m)); }
  state = sanitize(state);
  undoStack.length = 0;
  save(); renderHero(); render(); renderPassives();
  toast(`De volta ao nível ${c.level}`, false);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  switch (b.dataset.action) {
    case 'lv-open': openLevelUp(); break;
    case 'lv-undo': undoLastLevel(); break;
    case 'lv-roll': lv.hp = d(6); lv.src = 'rolado'; modalRefresh(); break;
    case 'lv-avg': lv.hp = 4; lv.src = 'média'; modalRefresh(); break;
    case 'lv-next': { const s = steps(); lv.step = s[s.indexOf(lv.step) + 1]; modalRefresh(); $('#sheet').scrollTop = 0; break; }
    case 'lv-back': { const s = steps(); lv.step = s[s.indexOf(lv.step) - 1]; modalRefresh(); break; }
    case 'lv-apply': {
      const dep = commitLevel(choicesFromWizard());
      closeModal(); renderHero(); render(); renderPassives();
      toast(`Nível ${dep.level}! PV máximos: ${dep.stats.hpMax}`, false);
      break;
    }
  }
});
document.addEventListener('change', e => {
  if (!lv || $('#modal').hidden) return;
  const t = e.target;
  if (t.id === 'lv-die') { const v = +t.value; if (v >= 1 && v <= 6) { lv.hp = v; lv.src = 'dado físico'; modalRefresh(); } }
  else if (t.name === 'lv-mode') { lv.mode = t.value; modalRefresh(); }
  else if (t.id === 'lv-feat') { lv.feat = t.value; modalRefresh(); }
  else if (t.id === 'lv-a1') lv.a1 = t.value;
  else if (t.id === 'lv-a2') lv.a2 = t.value;
  else if (t.id === 'lv-swap') lv.swapOut = t.value;
  else if (t.dataset.meta) {
    if (t.checked && lv.meta.length >= lv.need.metamagic) { t.checked = false; toast(`Escolha só ${lv.need.metamagic}`, false); return; }
    lv.meta = t.checked ? [...lv.meta, t.dataset.meta] : lv.meta.filter(x => x !== t.dataset.meta); modalRefresh();
  } else if (t.dataset.sp) {
    const s = libGet(t.dataset.sp), q = s.level ? lv.need.prepared : lv.need.cantrips, atuais = lv.spells.map(libGet);
    if (t.checked && pickCount(atuais, s.level > 0) >= q) { t.checked = false; toast(`Escolha até ${q}`, false); return; }
    lv.spells = t.checked ? [...lv.spells, s.id] : lv.spells.filter(x => x !== s.id);
  }
});
