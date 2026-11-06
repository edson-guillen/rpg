/* =====================================================================
   AÇÕES
   ===================================================================== */
function setTab(t) {
  setUI('tab', t);
  document.querySelectorAll('.tab').forEach(b => { const on = b.dataset.tab === t; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  document.querySelectorAll('.panel-tab').forEach(p => p.classList.toggle('on', p.id === 'tab-' + t));
  const top = $('main').getBoundingClientRect().top + window.scrollY - 70;
  if (window.scrollY > top) window.scrollTo({ top: Math.max(0, top) });
}
function toggleMenu(force) {
  const m = $('#menu'), open = force ?? m.hidden;
  m.hidden = !open; $('[data-action="menu"]').setAttribute('aria-expanded', open);
}
function exportData() {
  flushNote();
  const notesOut = { ...notes, notes: notes.notes.map(({ text, ...n }) => n) };
  const blob = new Blob([JSON.stringify({ app: CHAR.storageKey, exported: new Date().toISOString(), state, notes: notesOut }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `soren-frostgaard-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup exportado', false);
}
const clampRes = (id, v) => Math.min(RES[id].max, Math.max(0, v));
const FX_NAME = { innate: 'Feitiçaria Inata', shield: 'Escudo Arcano', mirror: 'Reflexos' };

function handle(a, el) {
  const ds = el.dataset, lv = +ds.lv, i = +ds.i;
  switch (a) {
    case 'menu': toggleMenu(); break;
    case 'export': toggleMenu(false); exportData(); break;
    case 'import': toggleMenu(false); $('#file').click(); break;
    case 'reset': toggleMenu(false); resetModal(); break;
    case 'reset-go': commit('Ficha restaurada', st => { const ui = st.ui; Object.assign(st, defaultState(), { ui }); }); closeModal(); break;
    case 'undo': if (toastUndo) { const f = toastUndo; toastUndo = null; $('#toast').classList.remove('show'); f(); } else undo(); break;
    case 'roll': doRoll(ds); break;
    case 'roll-hide': el.classList.remove('show'); break;
    case 'mat-toggle': castMat = !castMat; modalRefresh?.(); break;
    case 'mirror-roll': {
      const m = state.fx.mirror; if (!m) break;
      const rolls = Array.from({ length: m }, () => d(6)), hit = rolls.some(x => x >= 3);
      showRoll('Reflexos · você foi atingido', hit ? 'Desviado!' : 'Acertou', `🎲 ${rolls.join(', ')} (precisa de 3+ em algum)`,
        hit ? `Uma duplicata é destruída${m - 1 ? ` — restam ${m - 1}` : ' — Reflexos termina'}.` : 'Nenhuma duplicata intercepta: o ataque atinge Søren.', hit ? '' : 'fail');
      if (hit) commit(null, st => { st.fx.mirror = m - 1; });
      break;
    }
    case 'close': closeModal(); break;
    case 'tab': if (typeof flushNote === 'function') flushNote(); setTab(ds.tab); break;
    case 'goto-hp': setTab('recursos'); setTimeout(() => { $('#hp-panel').scrollIntoView({ block: 'center' }); $('#hp-amt').focus({ preventScroll: true }); }, 30); break;

    /* espaços de magia */
    case 'slot': {
      const av = avail(lv), spend = i < av;
      popKey = `slot:${lv}:${spend ? av - 1 : av}`;
      commit(`Espaço de ${ORD(lv)} círculo ${spend ? 'gasto' : 'recuperado'} (${spend ? av - 1 : av + 1}/${CHAR.slots[lv]})`, st => { st.used[lv] += spend ? 1 : -1; });
      break;
    }
    case 'slot-extra': commit(`Espaço criado de ${ORD(lv)} círculo gasto`, st => { if (!st.extra[lv]) return false; st.extra[lv]--; }); break;
    case 'slot-to-sp': commit(`Espaço de ${ORD(lv)} convertido em ${lv} PF`, st => {
      if (st.res.sp + lv > RES.sp.max) return false;
      if (st.used[lv] < CHAR.slots[lv]) st.used[lv]++; else if (st.extra[lv]) st.extra[lv]--; else return false;
      st.res.sp += lv;
    }); break;
    case 'sp-to-slot': { const c = CHAR.createSlotCost[lv];
      commit(`${c} PF → espaço de ${ORD(lv)} círculo criado`, st => { if (st.res.sp < c) return false; st.res.sp -= c; st.extra[lv]++; }); break; }
    case 'short-rest': shortRestModal(); break;
    case 'long-rest': longRestModal(); break;
    case 'long-rest-go': longRest(); break;
    case 'hd-roll': spendHitDie(+ds.v || 0); break;

    /* recursos */
    case 'res-gem': {
      const r = RES[ds.id], cur = state.res[r.id], spend = i < cur;
      popKey = `res-gem:${r.id}:${spend ? cur - 1 : cur}`;
      commit(`${r.name}: ${spend ? cur - 1 : cur + 1}/${r.max}`, st => { st.res[r.id] = clampRes(r.id, cur + (spend ? -1 : 1)); });
      break;
    }
    case 'res-step': { const r = RES[ds.id], v = clampRes(r.id, state.res[r.id] + +ds.d);
      commit(`${r.name}: ${v}/${r.max}`, st => { if (st.res[r.id] === v) return false; st.res[r.id] = v; }); break; }
    case 'res-use': {
      const r = RES[ds.id];
      if (r.action?.fx === 'hd') { shortRestModal(); break; }
      if (r.action?.fx === 'innate') { commit(`Feitiçaria Inata ativada: CD ${CHAR.stats.dc + 1} e Vantagem por 1 minuto`, st => { if (!st.res.innate) return false; st.res.innate--; st.fx.innate = true; }); break; }
      commit(`${r.name} usado (${state.res[r.id] - 1}/${r.max})`, st => { if (!st.res[r.id]) return false; st.res[r.id]--; });
      break;
    }
    case 'meta-use': { const m = META[ds.id]; commit(`${m.name}: −${m.cost} PF`, st => { if (st.res.sp < m.cost) return false; st.res.sp -= m.cost; }); break; }
    case 'fx-end': commit(`${FX_NAME[ds.fx]} encerrado`, st => { st.fx[ds.fx] = ds.fx === 'mirror' ? 0 : false; }); break;
    case 'mirror-hit': { const m = state.fx.mirror, hit = i < m;
      commit(hit ? (m - 1 ? `Duplicata destruída — restam ${m - 1}` : 'Última duplicata destruída — Reflexos termina') : 'Duplicata restaurada', st => { st.fx.mirror = Math.max(0, Math.min(3, m + (hit ? -1 : 1))); }); break; }
    case 'conc-end': commit(`Concentração em ${SPELL[state.conc]?.name} encerrada`, st => { st.conc = null; }); break;
    case 'conc-check': concModal(0); break;
    case 'conc-roll': { const a1 = d(20), b1 = d(20), total = Math.max(a1, b1) + CHAR.stats.conSave; concRoll = { a: a1, b: b1, total, ok: total >= concDC() }; modalRefresh?.(); break; }
    case 'conc-lost': commit(`Concentração em ${SPELL[state.conc]?.name} perdida`, st => { st.conc = null; }); closeModal(); break;
    case 'hp': {
      const inp = $('#hp-amt'), amt = Math.round(+inp.value);
      if (!amt || amt < 0) { toast('Digite um valor de PV primeiro', false); inp.focus(); break; }
      if (ds.op === 'dmg') {
        const absorbed = Math.min(state.temp, amt), rest = amt - absorbed, hadConc = state.conc;
        commit(`−${amt} PV${absorbed ? ` (${absorbed} absorvido${absorbed > 1 ? 's' : ''} pelos temporários)` : ''}`, st => {
          st.temp -= absorbed; st.hp = Math.max(0, st.hp - rest); if (!st.hp) st.conc = null;
        });
        if (hadConc && !state.conc) toast(`0 PV — concentração em ${SPELL[hadConc].name} perdida`);
        else if (state.conc) concModal(amt);
      } else if (ds.op === 'heal') {
        const healed = Math.min(CHAR.stats.hpMax - state.hp, amt);
        commit(`+${healed} PV`, st => { if (!healed) return false; st.hp += healed; }) || toast('PV já estão no máximo', false);
      } else commit(`${amt} PV temporários`, st => { st.temp = amt; });
      break;
    }

    /* grimório */
    case 'filter': setUI('filter', ds.f); renderFilters(); renderGrim(); break;
    case 'clear-q': query = ''; $('#q').value = ''; syncClear(); renderGrim(); $('#q').focus(); break;
    case 'spell': spellModal(ds.id); break;
    case 'meta-toggle': { const on = castMeta.has(ds.id); castMeta.clear(); if (!on) castMeta.add(ds.id); modalRefresh?.(); break; }
    case 'goto-sp': setTab('magia'); setTimeout(() => $('#sp-hub').scrollIntoView({ block: 'start', behavior: 'smooth' }), 40); break;
    case 'cast': doCast(ds.id, +ds.lv); break;

    /* mochila */
    case 'item-step': { const it = state.items.find(x => x.id === ds.id); if (!it || it.qty == null) break;
      const v = Math.max(0, it.qty + +ds.d);
      commit(`${it.name}: ${v}`, st => { const x = st.items.find(y => y.id === ds.id); if (!x || x.qty === v) return false; x.qty = v; }); break; }
    case 'item-edit': itemModal(ds.id); break;
    case 'item-new': itemModal(null); break;
    case 'item-del': { const it = state.items.find(x => x.id === editingItem);
      if (it) commit(`${it.name} removido da mochila`, st => { st.items = st.items.filter(x => x.id !== it.id); }); closeModal(); break; }
  }
}

function syncClear() { $('[data-action="clear-q"]').hidden = !query; }

