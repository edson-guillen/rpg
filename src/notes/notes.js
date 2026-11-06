/* =====================================================================
   ANOTAÇÕES — editor de texto com tópicos (armazenamento próprio)
   Ficam fora do estado da ficha: não entram no "Desfazer" da ficha nem
   são apagadas ao restaurar a ficha original.
   ===================================================================== */
const TOPIC_COLORS = ['#d9b46c', '#9fdcff', '#88d8a6', '#ff9d8a', '#c7adff', '#d5dbe3', '#ffd28a', '#7fe0d0'];
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function defaultNotes() {
  const now = Date.now();
  return {
    v: 1,
    topics: [
      { id: 't-sessoes', name: 'Sessões', c: '#d9b46c' },
      { id: 't-npcs', name: 'NPCs', c: '#9fdcff' },
      { id: 't-lugares', name: 'Lugares', c: '#88d8a6' },
      { id: 't-missoes', name: 'Missões', c: '#ff9d8a' },
      { id: 't-lore', name: 'Lore e Segredos', c: '#c7adff' },
      { id: 't-geral', name: 'Geral', c: '#d5dbe3' }
    ],
    notes: [{
      id: 'n-guia', topic: 't-geral', pinned: false, created: now, updated: now, title: 'Como usar as anotações',
      html: '<p>Crie uma nota em <strong>＋ Nova nota</strong> e escolha o tópico: Sessões, NPCs, Lugares, Missões…</p>'
        + '<ul><li>Use a barra para <strong>títulos</strong>, <em>itálico</em>, listas, citações e separadores.</li>'
        + '<li>Tudo é salvo sozinho neste navegador enquanto você escreve.</li>'
        + '<li>Fixe as notas importantes com o alfinete para mantê-las no topo.</li>'
        + '<li>Em <strong>⚙ Tópicos</strong> você cria, renomeia, recolore ou apaga tópicos.</li>'
        + '<li>O backup do menu <strong>⋮</strong> inclui as anotações.</li></ul>'
        + '<blockquote>Pode apagar esta nota quando quiser.</blockquote>'
    }],
    ui: { topic: 'all', open: null }
  };
}

/* ---------- saneamento: só formatação simples, nada de scripts ou estilos ---------- */
const NOTE_TAGS = { P: 'p', DIV: 'p', BR: 'br', H1: 'h2', H2: 'h2', H3: 'h3', H4: 'h3', STRONG: 'strong', B: 'strong', EM: 'em', I: 'em',
  U: 'u', S: 's', STRIKE: 's', DEL: 's', UL: 'ul', OL: 'ol', LI: 'li', BLOCKQUOTE: 'blockquote', HR: 'hr' };
const DROP_TAGS = /^(SCRIPT|STYLE|TEMPLATE|IFRAME|OBJECT|EMBED|SVG|MATH|NOSCRIPT|TITLE|META|LINK|HEAD|IMG|VIDEO|AUDIO|CANVAS|FORM|INPUT|BUTTON|SELECT|TEXTAREA)$/;
function cleanHTML(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const out = document.createElement('div');
  (function walk(src, dst) {
    for (const n of [...src.childNodes]) {
      if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
      if (n.nodeType !== 1 || DROP_TAGS.test(n.tagName)) continue;
      const tag = NOTE_TAGS[n.tagName];
      if (!tag) { walk(n, dst); continue; }                 // desembrulha tags desconhecidas (span, font…)
      const el = document.createElement(tag);
      if (tag !== 'br' && tag !== 'hr') walk(n, el);
      if (tag === 'p' && dst.tagName === 'LI') { while (el.firstChild) dst.appendChild(el.firstChild); continue; }
      dst.appendChild(el);
    }
  })(doc.body, out);
  return out.innerHTML.slice(0, 200000);
}
function textOf(html) {
  const doc = new DOMParser().parseFromString(`<body>${String(html || '').replace(/<(br|hr)\s*\/?>/gi, '\n').replace(/<\/(p|h2|h3|li|blockquote|ul|ol)>/gi, '\n')}</body>`, 'text/html');
  return (doc.body.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

function sanitizeNotes(raw) {
  const d = defaultNotes();
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.topics) || !Array.isArray(raw.notes)) return d;
  const topics = raw.topics.filter(t => t && typeof t.name === 'string').slice(0, 40).map((t, i) => ({
    id: String(t.id || uid('t')), name: t.name.slice(0, 40) || 'Tópico', c: /^#[0-9a-f]{3,8}$/i.test(t.c) ? t.c : TOPIC_COLORS[i % TOPIC_COLORS.length]
  }));
  if (!topics.length) topics.push({ id: 't-geral', name: 'Geral', c: '#d5dbe3' });
  const ids = new Set(topics.map(t => t.id));
  const notes = raw.notes.filter(n => n && typeof n === 'object').slice(0, 2000).map(n => {
    const html = cleanHTML(n.html);
    return { id: String(n.id || uid('n')), topic: ids.has(n.topic) ? n.topic : topics[0].id, pinned: !!n.pinned,
      created: +n.created || Date.now(), updated: +n.updated || Date.now(), title: String(n.title || '').slice(0, 120), html, text: textOf(html) };
  });
  const ui = { topic: raw.ui?.topic === 'all' || ids.has(raw.ui?.topic) ? raw.ui.topic : 'all', open: notes.some(n => n.id === raw.ui?.open) ? raw.ui.open : null };
  return { v: 1, topics, notes, ui };
}
const inCampaign = () => store.settings.notesScope === 'camp';
function loadNotes() {
  const raw = inCampaign() ? store.campaignNotes : activeChar().notes;
  if (raw) return sanitizeNotes(raw);
  const d = sanitizeNotes(defaultNotes());
  if (inCampaign()) { d.notes = []; d.ui.open = null; }
  return d;
}
let notes = loadNotes(), noteQuery = '', noteTimer = null, savedRange = null;
function saveNotes() {
  const out = { v: notes.v, topics: notes.topics, notes: notes.notes.map(({ text, ...n }) => n), ui: notes.ui };
  if (inCampaign()) store.campaignNotes = out; else activeChar().notes = out;
  if (persistStore()) return true;
  toast('Não foi possível salvar as anotações: armazenamento do navegador cheio.', false);
  return false;
}
const topicOf = id => notes.topics.find(t => t.id === id) || notes.topics[0];
const openNote = () => notes.notes.find(n => n.id === notes.ui.open) || null;
const words = t => (t.match(/\S+/g) || []).length;
function when(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  const d = new Date(ts), today = new Date();
  if (d.toDateString() === today.toDateString()) return `hoje, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const y = new Date(today); y.setDate(today.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: d.getFullYear() === today.getFullYear() ? undefined : '2-digit' });
}
const fullDate = ts => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ---------- lista e tópicos ---------- */
function excerpt(text, q) {
  if (!text) return '<i>Sem conteúdo</i>';
  if (!q) return esc(text.slice(0, 160));
  const i = norm(text).indexOf(q);
  if (i < 0) return esc(text.slice(0, 160));
  const chars = [...text], start = Math.max(0, i - 40);
  return (start ? '…' : '') + highlight(chars.slice(start, i + 120).join(''), q);
}
function renderNoteList() {
  const q = norm(noteQuery.trim()), ui = notes.ui;
  const count = id => notes.notes.filter(n => id === 'all' || n.topic === id).length;
  $('#note-topics').innerHTML = `<button class="filter" data-action="topic-filter" data-t="all" aria-pressed="${ui.topic === 'all'}">Todas <small>${count('all')}</small></button>`
    + notes.topics.map(t => `<button class="filter tchip" style="--c:${t.c}" data-action="topic-filter" data-t="${esc(t.id)}" aria-pressed="${ui.topic === t.id}"><i class="tdot"></i>${esc(t.name)} <small>${count(t.id)}</small></button>`).join('')
    + `<button class="filter" data-action="topics-manage">⚙ Tópicos</button>`;
  const list = notes.notes.filter(n => (ui.topic === 'all' || n.topic === ui.topic) && (!q || norm(n.title + '\n' + n.text).includes(q)))
    .sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
  $('#note-list').innerHTML = list.length ? list.map(n => {
    const t = topicOf(n.topic);
    return `<button class="note-card ${n.id === ui.open ? 'on' : ''}" style="--c:${t.c}" data-action="note-open" data-id="${esc(n.id)}">
      <span class="nc-top"><span class="nc-topic"><i class="tdot"></i>${esc(t.name)}</span>${n.pinned ? icon('i-pin', 'nc-pin') : ''}<span class="nc-date">${when(n.updated)}</span></span>
      <b class="nc-title">${n.title ? highlight(n.title, q) : '<i>Sem título</i>'}</b>
      <span class="nc-snip">${excerpt(n.text, q)}</span></button>`;
  }).join('') : `<p class="empty">${q ? `Nada encontrado para “${esc(noteQuery)}”.` : 'Nenhuma anotação neste tópico ainda.'}<br><button class="btn sm gold" style="margin-top:10px" data-action="note-new">＋ Nova nota</button></p>`;
  $('#notes').classList.toggle('has-open', !!openNote());
  const b = $('#badge-notes'); if (b) { b.textContent = notes.notes.length; b.hidden = !notes.notes.length; }
}

/* ---------- editor ---------- */
const TOOLS = [
  ['undo', '', icon('i-undo'), 'Desfazer'], ['redo', '', `<span style="display:inline-grid;transform:scaleX(-1)">${icon('i-undo')}</span>`, 'Refazer'], '|',
  ['block', 'p', '<span style="font-size:18px">¶</span>', 'Texto normal'], ['block', 'h2', '<b style="font-size:17px">T1</b>', 'Título'], ['block', 'h3', '<b style="font-size:14px">T2</b>', 'Subtítulo'], '|',
  ['bold', '', '<b>B</b>', 'Negrito (Ctrl+B)'], ['italic', '', '<i style="font-family:Georgia,serif">I</i>', 'Itálico (Ctrl+I)'], ['underline', '', '<u>U</u>', 'Sublinhado (Ctrl+U)'], ['strikeThrough', '', '<s>S</s>', 'Tachado'], '|',
  ['insertUnorderedList', '', icon('i-list'), 'Lista com marcadores'], ['insertOrderedList', '', '<b style="font-size:14px">1.</b>', 'Lista numerada'],
  ['block', 'blockquote', '<b style="font-size:22px;line-height:1">“</b>', 'Citação'], ['hr', '', '<b>—</b>', 'Separador'], '|',
  ['clear', '', '<span style="font-size:14px">T<sub>x</sub></span>', 'Limpar formatação']
];
function renderNoteEditor() {
  const n = openNote(), box = $('#note-editor');
  if (!n) {
    box.innerHTML = `<div class="ne-empty">${icon('i-quill', 'ne-empty-ic')}<p><b>Selecione uma anotação</b><br>ou crie uma nova para começar a escrever.</p>
      <button class="btn gold" data-action="note-new">＋ Nova nota</button></div>`;
    return;
  }
  const t = topicOf(n.topic);
  box.style.setProperty('--c', t.c);
  box.innerHTML = `
    <div class="ne-top">
      <button class="icon-btn ne-back" data-action="note-close" aria-label="Voltar à lista">${icon('i-chev', 'flip')}</button>
      <input class="ne-title" id="ne-title" maxlength="120" placeholder="Título da anotação" value="${esc(n.title)}" aria-label="Título">
      <button class="icon-btn" data-action="note-pin" aria-pressed="${n.pinned}" aria-label="${n.pinned ? 'Desafixar' : 'Fixar no topo'}" title="${n.pinned ? 'Desafixar' : 'Fixar no topo'}">${icon('i-pin')}</button>
      <button class="icon-btn" data-action="note-del" aria-label="Excluir anotação" title="Excluir">${icon('i-trash')}</button>
    </div>
    <div class="ne-meta"><label class="ne-topic"><i class="tdot"></i><select id="ne-topic" aria-label="Tópico">${notes.topics.map(x => `<option value="${esc(x.id)}" ${x.id === n.topic ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <span class="ne-status saved" id="ne-status">Salvo</span></div>
    <div class="ne-toolbar" role="toolbar" aria-label="Formatação">${TOOLS.map(x => x === '|' ? '<span class="sep" aria-hidden="true"></span>'
      : `<button type="button" data-cmd="${x[0]}" data-arg="${x[1]}" aria-label="${x[3]}" title="${x[3]}" aria-pressed="false">${x[2]}</button>`).join('')}</div>
    <div class="ne-body" id="ne-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texto da anotação" spellcheck="true" data-placeholder="Escreva aqui… (sessão, NPCs, pistas, combinações de magia)">${n.html}</div>
    <div class="ne-foot"><span id="ne-count">${words(n.text)} palavras</span><span>Criada em ${fullDate(n.created)}</span></div>`;
  markEmpty();
}
function markEmpty() { const ed = $('#ne-body'); if (ed) ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('hr,li')); }
function setStatus(txt, cls) { const s = $('#ne-status'); if (s) { s.textContent = txt; s.className = 'ne-status ' + cls; } }

function flushNote() {
  clearTimeout(noteTimer); noteTimer = null;
  const n = openNote(), ed = $('#ne-body'), ti = $('#ne-title');
  if (!n || !ed || !ti) return;
  const html = cleanHTML(ed.innerHTML), title = ti.value.trim().slice(0, 120);
  if (html === n.html && title === n.title) { setStatus('Salvo', 'saved'); return; }
  Object.assign(n, { html, title, text: textOf(html), updated: Date.now() });
  if (saveNotes()) setStatus('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 'saved');
  const c = $('#ne-count'); if (c) c.textContent = `${words(n.text)} palavras`;
  renderNoteList();
}
function scheduleSave() { setStatus('Salvando…', 'saving'); clearTimeout(noteTimer); noteTimer = setTimeout(flushNote, 500); }

function restoreSel() {
  const ed = $('#ne-body'); if (!ed) return;
  ed.focus({ preventScroll: true });
  if (savedRange && ed.contains(savedRange.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); }
}
function updateTools() {
  const bar = $('.ne-toolbar'); if (!bar) return;
  let block = '';
  try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) {}
  bar.querySelectorAll('[data-cmd]').forEach(b => {
    const c = b.dataset.cmd; let on = false;
    try {
      if (c === 'block') on = block === b.dataset.arg;
      else if (/^(bold|italic|underline|strikeThrough|insertUnorderedList|insertOrderedList)$/.test(c)) on = document.queryCommandState(c);
    } catch (e) {}
    b.setAttribute('aria-pressed', on);
  });
}
function runCmd(cmd, arg) {
  restoreSel();
  if (cmd === 'block') {
    let cur = ''; try { cur = String(document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch (e) {}
    document.execCommand('formatBlock', false, cur === arg && arg !== 'p' ? 'p' : arg);
  } else if (cmd === 'hr') document.execCommand('insertHorizontalRule');
  else if (cmd === 'clear') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); }
  else document.execCommand(cmd);
  markEmpty(); updateTools(); scheduleSave();
}

function newNote() {
  flushNote();
  const topic = notes.ui.topic !== 'all' ? notes.ui.topic : 't-sessoes';
  const tp = notes.topics.find(t => t.id === topic) ? topic : notes.topics[0].id;
  let title = '';
  if (tp === 't-sessoes') title = `Sessão ${notes.notes.filter(n => n.topic === tp).length + 1} — ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
  const n = { id: uid('n'), topic: tp, pinned: false, created: Date.now(), updated: Date.now(), title, html: '', text: '' };
  notes.notes.unshift(n); notes.ui.open = n.id; noteQuery = ''; $('#nq').value = '';
  saveNotes(); renderNoteList(); renderNoteEditor();
  setTimeout(() => { if (title) restoreSel(); else $('#ne-title')?.focus(); }, 60);
  if (innerWidth < 900) window.scrollTo({ top: $('main').getBoundingClientRect().top + scrollY - 70 });
}
function snapshotNotes() { const s = JSON.stringify(notes); return () => { notes = sanitizeNotes(JSON.parse(s)); saveNotes(); renderNoteList(); renderNoteEditor(); modalRefresh?.(); }; }

function topicsModal() {
  openModal(() => `${mHead('Anotações', 'Tópicos')}
    <p class="note" style="margin-top:10px">Toque na cor para trocá-la. Ao apagar um tópico, as notas dele vão para outro.</p>
    <ul class="tp-list">${notes.topics.map(t => `<li style="--c:${t.c}">
      <button class="tp-color" data-action="topic-color" data-t="${esc(t.id)}" aria-label="Trocar cor de ${esc(t.name)}"><i class="tdot"></i></button>
      <input class="tp-name" data-t="${esc(t.id)}" value="${esc(t.name)}" maxlength="40" aria-label="Nome do tópico">
      <span class="tp-n num">${notes.notes.filter(n => n.topic === t.id).length}</span>
      <button class="icon-btn" data-action="topic-del" data-t="${esc(t.id)}" ${notes.topics.length > 1 ? '' : 'disabled'} aria-label="Apagar ${esc(t.name)}">${icon('i-trash')}</button></li>`).join('')}</ul>
    <div class="add-row"><input id="tp-new" class="tp-name" maxlength="40" placeholder="Novo tópico (ex.: Itens Mágicos)" aria-label="Nome do novo tópico">
      <button class="btn gold" data-action="topic-add">${icon('i-plus')}Criar</button></div>`);
}

/* ---------- eventos do módulo ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action, t = el.dataset.t;
  if (!/^(note-|topic)/.test(a)) return;
  if (a === 'note-new') newNote();
  else if (a === 'note-open') { flushNote(); notes.ui.open = el.dataset.id; saveNotes(); renderNoteList(); renderNoteEditor(); if (innerWidth < 900) window.scrollTo({ top: $('main').getBoundingClientRect().top + scrollY - 70 }); }
  else if (a === 'note-close') { flushNote(); notes.ui.open = null; saveNotes(); renderNoteList(); renderNoteEditor(); }
  else if (a === 'note-pin') { flushNote(); const n = openNote(); if (!n) return; n.pinned = !n.pinned; saveNotes(); renderNoteList(); renderNoteEditor(); toast(n.pinned ? 'Anotação fixada no topo' : 'Anotação desafixada', false); }
  else if (a === 'note-del') {
    flushNote(); const n = openNote(); if (!n) return;
    const restore = snapshotNotes();
    notes.notes = notes.notes.filter(x => x.id !== n.id); notes.ui.open = null;
    saveNotes(); renderNoteList(); renderNoteEditor();
    toast(`Anotação “${n.title || 'Sem título'}” excluída`, true, restore);
  }
  else if (a === 'topic-filter') { notes.ui.topic = t; saveNotes(); renderNoteList(); }
  else if (a === 'topics-manage') { flushNote(); topicsModal(); }
  else if (a === 'topic-color') { const tp = notes.topics.find(x => x.id === t); tp.c = TOPIC_COLORS[(TOPIC_COLORS.indexOf(tp.c) + 1) % TOPIC_COLORS.length]; saveNotes(); renderNoteList(); renderNoteEditor(); modalRefresh?.(); }
  else if (a === 'topic-add') {
    const inp = $('#tp-new'), name = inp.value.trim().slice(0, 40);
    if (!name) { inp.focus(); return; }
    notes.topics.push({ id: uid('t'), name, c: TOPIC_COLORS[notes.topics.length % TOPIC_COLORS.length] });
    saveNotes(); renderNoteList(); renderNoteEditor(); modalRefresh?.(); toast(`Tópico “${name}” criado`, false);
  }
  else if (a === 'topic-del') {
    if (notes.topics.length < 2) return;
    const tp = notes.topics.find(x => x.id === t), rest = notes.topics.filter(x => x.id !== t), dest = rest.find(x => x.id === 't-geral') || rest[0];
    const moved = notes.notes.filter(n => n.topic === t).length, restore = snapshotNotes();
    notes.notes.forEach(n => { if (n.topic === t) n.topic = dest.id; });
    notes.topics = rest; if (notes.ui.topic === t) notes.ui.topic = 'all';
    saveNotes(); renderNoteList(); renderNoteEditor(); modalRefresh?.();
    toast(`Tópico “${tp.name}” apagado${moved ? ` — ${moved} nota${moved > 1 ? 's' : ''} movida${moved > 1 ? 's' : ''} para ${dest.name}` : ''}`, true, restore);
  }
});
document.addEventListener('change', e => {
  if (e.target.classList?.contains('tp-name') && e.target.dataset.t) {
    const tp = notes.topics.find(x => x.id === e.target.dataset.t), v = e.target.value.trim().slice(0, 40);
    if (tp && v && v !== tp.name) { tp.name = v; saveNotes(); renderNoteList(); renderNoteEditor(); }
    else if (tp) e.target.value = tp.name;
  }
  if (e.target.id === 'ne-topic') { const n = openNote(); if (n) { n.topic = e.target.value; n.updated = Date.now(); saveNotes(); renderNoteList(); $('#note-editor').style.setProperty('--c', topicOf(n.topic).c); } }
});
document.addEventListener('input', e => {
  if (e.target.id === 'nq') { noteQuery = e.target.value; renderNoteList(); }
  if (e.target.id === 'ne-body' || e.target.id === 'ne-title') { if (e.target.id === 'ne-body') markEmpty(); scheduleSave(); }
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'tp-new' && e.key === 'Enter') { e.preventDefault(); $('[data-action="topic-add"]')?.click(); }
  if (e.target.id === 'ne-title' && e.key === 'Enter') { e.preventDefault(); restoreSel(); }
  if ((e.target.id === 'ne-body' || e.target.id === 'ne-title') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flushNote(); toast('Anotação salva', false); }
});
document.addEventListener('mousedown', e => { if (e.target.closest('.ne-toolbar')) e.preventDefault(); });
document.addEventListener('click', e => { const b = e.target.closest('.ne-toolbar [data-cmd]'); if (b) runCmd(b.dataset.cmd, b.dataset.arg); });
document.addEventListener('selectionchange', () => {
  const ed = $('#ne-body'), s = getSelection();
  if (ed && s.rangeCount && ed.contains(s.anchorNode)) { savedRange = s.getRangeAt(0).cloneRange(); updateTools(); }
});
document.addEventListener('paste', e => {
  if (e.target.closest?.('#ne-body')) { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); }
});
document.addEventListener('drop', e => {
  if (!e.target.closest?.('#ne-body')) return;
  e.preventDefault();
  const txt = e.dataTransfer.getData('text/plain'); if (!txt) return;
  let r = document.caretRangeFromPoint?.(e.clientX, e.clientY);
  if (!r && document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
  if (r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  document.execCommand('insertText', false, txt);
});
document.addEventListener('focusout', e => { if (e.target.id === 'ne-body' || e.target.id === 'ne-title') { if (noteTimer) flushNote(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && noteTimer) flushNote(); });
window.addEventListener('pagehide', () => { if (noteTimer) flushNote(); });
try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}

function initNotes() { renderNoteList(); renderNoteEditor(); }

