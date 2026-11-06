/* =====================================================================
   EVENTOS E INICIALIZAÇÃO
   ===================================================================== */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!e.target.closest('#menu') && !e.target.closest('[data-action="menu"]')) toggleMenu(false);
  if (el && !el.disabled) handle(el.dataset.action, el);
  else if (e.target.id === 'modal') closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else toggleMenu(false); return; }
  const el = e.target.closest?.('[role="button"][data-action]');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handle(el.dataset.action, el); return; }
  if (e.target.getAttribute?.('role') === 'tab' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const tabs = [...document.querySelectorAll('.tab')], k = tabs.indexOf(e.target), n = tabs[(k + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    setTab(n.dataset.tab); n.focus(); return;
  }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
  if (e.key === '/' && !typing && $('#modal').hidden) { e.preventDefault(); setTab('grimorio'); $('#q').focus(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !typing) { e.preventDefault(); undo(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { query = e.target.value; syncClear(); renderGrim(); }
  if (e.target.id === 'conc-dmg') { concDmg = Math.max(0, +e.target.value || 0); $('#conc-dc').textContent = 'CD ' + concDC(); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'item-form') return;
  e.preventDefault();
  const name = $('#f-name').value.trim(), note = $('#f-note').value.trim(), rawQ = $('#f-qty').value.trim();
  const qty = rawQ === '' ? null : Math.max(0, Math.round(+rawQ || 0)), unit = $('#f-unit').value.trim(), cat = $('#f-cat').value;
  if (!name) { $('#f-name').focus(); return; }
  commit(editingItem ? `${name} atualizado` : `${name} adicionado ao inventário`, st => {
    const it = editingItem && st.items.find(x => x.id === editingItem);
    if (it) Object.assign(it, { name, note, qty, unit, cat });
    else st.items.push({ id: 'it' + Date.now().toString(36), name, note, qty, unit, cat });
  });
  closeModal();
});
$('#file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text()), raw = data.state || data;
    if (data.app === 'grimorio' && data.tipo === 'backup') {
      const next = sanitizeStore(data.store);
      if (!next) throw new Error('formato');
      flushNote(); save();
      localStorage.setItem(STORE_KEY + '-antes-de-importar', JSON.stringify(store));
      store = next;
      activateCharacter(store.activeId);
      toast('Backup importado', false);
      return;
    }
    if (data.app === 'grimorio' && data.tipo === 'personagem') {
      const c = sanitizeCharacter(data.character);
      if (!c) throw new Error('formato');
      addCharacter({ ...c, id: newId('c') });
      toast(`${c.name} importado`, false);
      return;
    }
    if (typeof raw !== 'object' || !raw.res) throw new Error('formato');
    commit(data.notes ? 'Backup importado (ficha e anotações)' : 'Backup importado', st => { const ui = st.ui; Object.assign(st, sanitize(raw), { ui }); });
    if (data.notes) { notes = sanitizeNotes(data.notes); saveNotes(); initNotes(); }
  } catch (err) { toast('Arquivo de backup inválido', false); }
});
document.addEventListener('toggle', e => { if (e.target.classList?.contains('sp-rules')) spRulesOpen = e.target.open; }, true);

