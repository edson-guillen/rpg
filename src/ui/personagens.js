/* =====================================================================
   PERSONAGENS — trocar, criar, duplicar, exportar e excluir
   ===================================================================== */
const ANIM_LABEL = { full: 'completas', reduced: 'reduzidas', off: 'desligadas' };
function renderHero() {
  const c = activeChar();
  $('#char-name-txt').textContent = c.name;
  $('#char-sub').textContent = c.sub = CHAR.subText || c.sub;
  $('#char-eyebrow').textContent = `D&D 2024 · Grimório${c.subclassId === 'draconic' ? ' Dracônico' : ''}`;
  $('#carry-aside').textContent = (CHAR.carry ? `Carga máx. ${CHAR.carry} · ` : '') + 'toque no nome para editar';
  document.title = `${c.name} · Grimório`;
  $('#anim-label').textContent = `Animações: ${ANIM_LABEL[store.settings.anim || 'full']}`;
}

/** Redesenha tudo depois que o personagem, a store ou o escopo das notas mudam. */
function refreshAll() {
  renderHero(); render(); renderPassives(); renderNotesScope(); initNotes(); setTab(state.ui.tab);
}

function activateCharacter(id) {
  store.activeId = id;
  bindSheet(activeChar());
  state = load();
  undoStack.length = 0;
  persistStore();
  notes = loadNotes();
  noteQuery = ''; $('#nq').value = '';
  refreshAll();
}

function switchCharacter(id) {
  if (id === store.activeId) return false;
  flushNote(); save();
  activateCharacter(id);
  return true;
}

function downloadJSON(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const today = () => new Date().toISOString().slice(0, 10);
const fileSlug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'personagem';

function exportCharacter(id) {
  flushNote(); save();
  const c = store.characters.find(x => x.id === id);
  downloadJSON(`${fileSlug(c.name)}-${today()}.json`, { app: 'grimorio', tipo: 'personagem', exported: new Date().toISOString(), character: c });
  toast(`${c.name} exportado`, false);
}

function addCharacter(c) {
  store.characters.push(c);
  flushNote(); save();
  activateCharacter(c.id);
}

function duplicateCharacter(id) {
  flushNote(); save();
  // As notas não vão junto: cada personagem começa com as próprias.
  const copy = { ...clone(store.characters.find(x => x.id === id)), id: newId('c'), notes: null };
  copy.name = `${copy.name} (cópia)`.slice(0, 60);
  addCharacter(copy);
  toast(`${copy.name} criado`, false);
}

function deleteCharacter(id) {
  if (store.characters.length < 2) return;
  flushNote(); save();
  const i = store.characters.findIndex(x => x.id === id), c = store.characters[i], wasActive = id === store.activeId;
  store.characters.splice(i, 1);
  if (wasActive) activateCharacter(store.characters[0].id); else persistStore();
  toast(`${c.name} excluído`, true, () => {
    store.characters.splice(i, 0, c);
    if (wasActive) { flushNote(); save(); activateCharacter(c.id); } else persistStore();
    if (modalRefresh) modalRefresh();
  });
}

function charsModal() {
  openModal(() => `${mHead('Personagens', 'Trocar de personagem')}
    <div class="char-list" style="margin-top:14px">${store.characters.map(c => {
      const on = c.id === store.activeId, id = esc(c.id);
      return `<div class="char-row ${on ? 'on' : ''}">
        <button class="char-pick" data-action="char-switch" data-id="${id}" ${on ? 'aria-current="true"' : ''}><b>${esc(c.name)}</b><small>${esc(c.sub)}</small></button>
        <button class="icon-btn" data-action="char-dup" data-id="${id}" aria-label="Duplicar ${esc(c.name)}" title="Duplicar">${icon('i-copy')}</button>
        <button class="icon-btn" data-action="char-export" data-id="${id}" aria-label="Exportar ${esc(c.name)}" title="Exportar">${icon('i-down')}</button>
        ${store.characters.length > 1 ? `<button class="icon-btn" data-action="char-del" data-id="${id}" aria-label="Excluir ${esc(c.name)}" title="Excluir">${icon('i-trash')}</button>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="m-actions"><button class="btn gold" data-action="char-new">${icon('i-plus')}Novo personagem</button></div>`);
}

function newCharModal() {
  openModal(() => `${mHead('Personagens', 'Novo personagem')}
    <form id="char-form" style="margin-top:14px" autocomplete="off">
      <div class="field"><label for="c-name">Nome</label><input id="c-name" required maxlength="60" autofocus placeholder="Ex.: Lyra Ventoleve"></div>
      <p class="note">O assistente segue as regras de 2024: espécie, antecedente, atributos, perícias, talento, equipamento, magias e nível.</p>
      <div class="m-actions"><button type="button" class="btn ghost" data-action="close">Cancelar</button><button class="btn gold">Continuar</button></div>
    </form>`);
}

function setNotesScope(s) {
  if (s === store.settings.notesScope) return;
  flushNote();
  store.settings.notesScope = s;
  persistStore();
  notes = loadNotes();
  noteQuery = ''; $('#nq').value = '';
  renderNotesScope(); initNotes();
}

function renderNotesScope() {
  const s = store.settings.notesScope;
  $('#note-scope').innerHTML = [['char', `Notas de ${esc(activeChar().name.split(' ')[0])}`], ['camp', 'Campanha (compartilhadas)']]
    .map(([id, label]) => `<button class="filter" data-action="note-scope" data-s="${id}" aria-pressed="${s === id}">${label}</button>`).join('');
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case 'chars': charsModal(); break;
    case 'anim-cycle': {
      const seq = ['full', 'reduced', 'off'];
      store.settings.anim = seq[(seq.indexOf(store.settings.anim || 'full') + 1) % 3];
      persistStore(); renderHero(); toggleMenu(false);
      toast(`Animações ${ANIM_LABEL[store.settings.anim]}`, false);
      break;
    }
    case 'char-switch': closeModal(); if (switchCharacter(id)) toast(`Agora com ${activeChar().name}`, false); break;
    case 'char-dup': closeModal(); duplicateCharacter(id); break;
    case 'char-export': exportCharacter(id); break;
    case 'char-del': deleteCharacter(id); break;
    case 'char-new': newCharModal(); break;
    case 'note-scope': setNotesScope(b.dataset.s); break;
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'char-form') return;
  e.preventDefault();
  const name = $('#c-name').value.trim();
  if (!name) return;
  openCreator(name);
});

window.addEventListener('storage', e => {
  if (e.key !== STORE_KEY) return;
  const next = sanitizeStore(readJSON(STORE_KEY));
  if (!next) return;
  const ui = state.ui, same = next.activeId === store.activeId;
  store = next;
  bindSheet(activeChar());
  state = load();
  if (same) state.ui = ui;
  render();
  renderHero();
  notes = loadNotes(); renderNotesScope(); renderNoteList();
  if (!document.activeElement?.closest?.('#note-editor')) renderNoteEditor();
});
