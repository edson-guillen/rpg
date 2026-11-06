/* =====================================================================
   ANIMAÇÕES com GSAP.
   Camada opcional: envolve funções do app (render, setTab, openModal…)
   sem alterar a lógica. Sem GSAP ou com "movimento reduzido", nada muda.
   ===================================================================== */
(() => {
  const G = window.gsap;
  if (!G || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('gx');

  const qa = (sel, el = document) => [...el.querySelectorAll(sel)];
  const cssVar = (el, v, def = '#9fdcff') => (el && getComputedStyle(el).getPropertyValue(v).trim()) || def;
  const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------- partículas ---------------- */
  function spawn(cls, x, y, color) {
    const e = document.createElement('i');
    e.className = cls; e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.setProperty('--c', color);
    document.body.appendChild(e); return e;
  }
  function sparks(x, y, color, n = 9, dist = 40) {
    for (let i = 0; i < n; i++) {
      const s = spawn('fx-spark', x, y, color), a = rand(0, Math.PI * 2), d = rand(dist * .55, dist);
      G.to(s, { x: Math.cos(a) * d, y: Math.sin(a) * d + 12, rotation: rand(-200, 200), scale: rand(.3, 1), autoAlpha: 0,
        duration: rand(.5, .85), ease: 'power2.out', onComplete: () => s.remove() });
    }
  }
  function ring(x, y, color, size = 5, dur = .7) {
    const r = spawn('fx-burst', x, y, color);
    G.fromTo(r, { scale: .2, autoAlpha: 1 }, { scale: size, autoAlpha: 0, duration: dur, ease: 'power2.out', onComplete: () => r.remove() });
  }
  function floatText(el, txt, color) {
    const [x, y] = center(el), f = spawn('fx-float', x, y, color);
    f.textContent = txt; f.style.color = color;
    G.timeline({ onComplete: () => f.remove() })
      .fromTo(f, { xPercent: -50, yPercent: -50, y: 0, autoAlpha: 0, scale: .6 }, { y: -40, autoAlpha: 1, scale: 1, duration: .5, ease: 'back.out(2)' })
      .to(f, { y: -66, autoAlpha: 0, duration: .55, ease: 'power1.in' }, '+=.45');
  }
  function shatter(el, color) {
    if (!el) return;
    const [x, y] = center(el), g = el.querySelector('i');
    sparks(x, y, color, 9, 42);
    if (g) G.fromTo(g, { scale: 1.4, filter: 'brightness(2.2)' }, { scale: 1, filter: 'brightness(1)', duration: .55, ease: 'power3.out', clearProps: 'transform,filter' });
  }
  function glowIn(el, color, delay = 0) {
    if (!el) return;
    const g = el.querySelector('i');
    if (g) G.fromTo(g, { scale: 0 }, { scale: 1, duration: .65, ease: 'back.out(3)', delay, clearProps: 'transform' });
    G.delayedCall(delay + .15, () => { if (el.isConnected) { const [x, y] = center(el); ring(x, y, color, 3.4, .6); } });
  }
  function tweenNum(el, from, to) {
    if (!el || from === to || from == null || to == null) return;
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!node) return;
    const tpl = node.nodeValue, o = { v: from };
    node.nodeValue = tpl.replace(/\d+/, from);
    G.to(o, { v: to, duration: .6, ease: 'power3.out', onUpdate: () => { node.nodeValue = tpl.replace(/\d+/, Math.round(o.v)); } });
    G.fromTo(el, { scale: 1.2 }, { scale: 1, duration: .55, ease: 'back.out(3)', clearProps: 'transform' });
  }
  function flashStat(st, rgb) {
    G.fromTo(st, { boxShadow: `0 0 0 2px rgba(${rgb},.85), 0 0 34px rgba(${rgb},.5)` },
      { boxShadow: `0 0 0 0px rgba(${rgb},0), 0 0 0px rgba(${rgb},0)`, duration: 1.1, ease: 'power2.out', clearProps: 'boxShadow' });
  }

  /* ---------------- diferenças entre renders ---------------- */
  const snap = () => ({ used: { ...state.used }, extra: { ...state.extra }, res: { ...state.res }, hp: state.hp, fx: { ...state.fx },
    conc: state.conc, items: Object.fromEntries(state.items.map(i => [i.id, i.qty])), log0: JSON.stringify((state.spLog || [])[0] || null) });
  let prev = snap(), inRender = false;

  function diff(a, b) {
    for (const l of LEVELS) {
      const row = $(`.slot-row.${lvClass(l)}`); if (!row) continue;
      const max = CHAR.slots[l], oa = max - a.used[l], na = max - b.used[l], color = cssVar(row, '--c');
      const gems = qa('.gem:not(.extra)', row), ex = qa('.gem.extra', row);
      for (let i = na; i < oa; i++) shatter(gems[i], color);
      for (let i = oa; i < na; i++) glowIn(gems[i], color, (i - oa) * .07);
      for (let i = a.extra[l]; i < b.extra[l]; i++) glowIn(ex[i], '#d9b46c');
      tweenNum($('.count', row), oa + a.extra[l], na + b.extra[l]);
    }
    for (const r of CHAR.resources) {
      const o = a.res[r.id], n = b.res[r.id]; if (o === n) continue;
      const boxes = new Set(qa(`.gem[data-action="res-gem"][data-id="${r.id}"]`).map(g => g.closest('.res, .sp-meter')).filter(Boolean));
      boxes.forEach(box => {
        const gems = qa(`.gem[data-id="${r.id}"]`, box), color = cssVar(box, '--c', '#d9b46c');
        for (let i = n; i < o; i++) shatter(gems[i], color);
        for (let i = o; i < n; i++) glowIn(gems[i], color, (i - o) * .07);
        tweenNum($('.res-val', box), o, n);
      });
    }
    if (a.res.sp !== b.res.sp) tweenNum($('#fom-sp b'), a.res.sp, b.res.sp);
    if (a.log0 !== b.log0) {
      const li = $('.sp-log li');
      if (li) G.fromTo(li, { x: -14, autoAlpha: 0, backgroundColor: 'rgba(217,180,108,.25)' }, { x: 0, autoAlpha: 1, backgroundColor: 'rgba(0,0,0,.2)', duration: .7, ease: 'power3.out', clearProps: 'all' });
    }
    if (a.hp !== b.hp) {
      const st = $('.stat.hp'), dmg = b.hp < a.hp;
      tweenNum($('.val', st), a.hp, b.hp); tweenNum($('#hp-panel .hp-num'), a.hp, b.hp);
      floatText(st, (dmg ? '−' : '+') + Math.abs(b.hp - a.hp), dmg ? '#f07c6c' : '#88d8a6');
      flashStat(st, dmg ? '240,124,108' : '136,216,166');
      if (dmg) G.fromTo(st, { x: -7 }, { x: 0, duration: .6, ease: 'elastic.out(1,.3)', clearProps: 'transform' });
    }
    const stats = qa('.stat');
    if (!a.fx.shield && b.fx.shield) { const [x, y] = center(stats[0]); ring(x, y, '#c7adff', 7); flashStat(stats[0], '199,173,255'); }
    if (!a.fx.innate && b.fx.innate) stats.slice(2).forEach((st, i) => G.delayedCall(i * .1, () => { const [x, y] = center(st); ring(x, y, '#9fdcff', 6); flashStat(st, '159,220,255'); }));
    if (b.fx.mirror < a.fx.mirror) { const pips = qa('#effects .mini button'); for (let i = b.fx.mirror; i < a.fx.mirror; i++) shatter(pips[i], '#d5dbe3'); }
    for (const it of state.items) {
      const o = a.items[it.id]; if (o == null || it.qty == null || o === it.qty) continue;
      tweenNum($(`[data-action="item-step"][data-id="${CSS.escape(it.id)}"]`)?.closest('.item')?.querySelector('.v'), o, it.qty);
    }
    const keys = s => [s.conc && 'conc', s.fx.innate && 'innate', s.fx.shield && 'shield', s.fx.mirror && 'mirror'].filter(Boolean);
    const had = keys(a);
    keys(b).filter(k => !had.includes(k)).forEach(k => {
      const chip = (k === 'conc' ? $('#effects [data-action="conc-end"]') : $(`#effects [data-fx="${k}"]`))?.closest('.fx');
      if (chip) G.fromTo(chip, { scale: .5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .6, ease: 'back.out(2.4)', clearProps: 'transform' });
    });
  }

  const _render = render;
  render = function () {
    inRender = true;
    try { _render(); } finally { inRender = false; }
    const now = snap();
    try { diff(prev, now); } catch (e) { /* animação nunca quebra o app */ }
    prev = now;
  };

  /* ---------------- abas ---------------- */
  const nav = $('.tabs'), ind = document.createElement('span');
  ind.className = 'tab-ind'; ind.setAttribute('aria-hidden', 'true'); nav.prepend(ind);
  function moveInd(dur = .6) {
    const t = $('.tab[aria-selected="true"]'); if (!t) return;
    G.to(ind, { x: t.offsetLeft + 6, width: t.offsetWidth - 12, duration: dur, ease: 'expo.out' });
  }
  function animatePanel() {
    const p = $('.panel-tab.on'); if (!p) return;
    const items = qa(':scope > .grid > *, :scope > .toolbar, :scope > #grim > .spell-group, :scope > .panel, :scope > .notes > :not([hidden])', p);
    G.fromTo(items, { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, ease: 'power3.out', stagger: .06, clearProps: 'transform,opacity,visibility' });
  }
  const _setTab = setTab;
  setTab = function (t) {
    const changed = state.ui.tab !== t;
    _setTab(t); moveInd();
    if (changed) animatePanel();
  };
  const _renderGrim = renderGrim;
  renderGrim = function () {
    _renderGrim();
    if (inRender || state.ui.tab !== 'grimorio' || document.activeElement === $('#q')) return;
    G.fromTo(qa('#grim .spell'), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, ease: 'power2.out', stagger: { amount: .25 }, clearProps: 'transform,opacity,visibility' });
  };

  /* ---------------- modal ---------------- */
  const _open = openModal, _close = closeModal;
  let closing = null;
  const mobileSheet = () => innerWidth < 700;
  openModal = function (build) {
    if (closing) { closing.kill(); closing = null; _close(); }
    G.set(['#sheet', '#modal'], { clearProps: 'all' });
    _open(build);
    const sh = $('#sheet');
    G.fromTo('#modal', { autoAlpha: 0 }, { autoAlpha: 1, duration: .25, ease: 'power1.out' });
    G.fromTo(sh, mobileSheet() ? { yPercent: 40, autoAlpha: .4 } : { y: 26, scale: .965, autoAlpha: 0 },
      { yPercent: 0, y: 0, scale: 1, autoAlpha: 1, duration: .6, ease: 'expo.out', clearProps: 'transform' });
    G.fromTo(qa('.m-head, .m-tags, .props, .rolls-box, .m-body > *, .box, .cast, .restore-list li, form .field, .m-actions', sh),
      { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .45, ease: 'power2.out', stagger: .035, delay: .08, clearProps: 'transform,opacity,visibility' });
  };
  closeModal = function () {
    if ($('#modal').hidden || closing) return;
    const sh = $('#sheet');
    closing = G.timeline({ onComplete: () => { closing = null; _close(); G.set(['#sheet', '#modal'], { clearProps: 'all' }); } })
      .to(sh, mobileSheet() ? { yPercent: 30, autoAlpha: 0, duration: .26, ease: 'power2.in' } : { y: 16, scale: .98, autoAlpha: 0, duration: .22, ease: 'power2.in' })
      .to('#modal', { autoAlpha: 0, duration: .2 }, '<.06');
  };

  /* ---------------- conjurar: explosão de energia ---------------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action="cast"]');
    if (!b || b.disabled) return;
    const [x, y] = center(b), c = cssVar(b.closest('.lv0, .lv1, .lv2'), '--c');
    ring(x, y, c, 10, .8); sparks(x, y, c, 16, 90);
    const f = document.createElement('div');
    f.className = 'fx-flash'; f.style.setProperty('--x', x + 'px'); f.style.setProperty('--y', y + 'px'); f.style.setProperty('--c', c);
    document.body.appendChild(f);
    G.fromTo(f, { autoAlpha: 1 }, { autoAlpha: 0, duration: .9, ease: 'power2.out', onComplete: () => f.remove() });
  }, true);

  /* ---------------- descanso longo: amanhecer ---------------- */
  const _longRest = longRest;
  longRest = function () {
    const ov = document.createElement('div');
    ov.className = 'dawn';
    ov.innerHTML = '<div class="dawn-sun"></div><p>O amanhecer chega<small>espaços, recursos e vida restaurados</small></p>';
    document.body.appendChild(ov);
    G.timeline({ onComplete: () => ov.remove() })
      .fromTo(ov, { autoAlpha: 0 }, { autoAlpha: 1, duration: .4, ease: 'power1.out' })
      .fromTo('.dawn-sun', { y: 90, scale: .55 }, { y: 0, scale: 1, duration: 1, ease: 'power2.out' }, '<')
      .fromTo('.dawn p', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .5, ease: 'power2.out' }, '-=.55')
      .add(() => _longRest())
      .to(ov, { autoAlpha: 0, duration: .55, ease: 'power1.inOut' }, '+=.5');
  };

  /* ---------------- rolagem de dados ---------------- */
  const _showRoll = showRoll;
  let scramble = null;
  showRoll = function (label, total, detail, extra = '', cls = '') {
    _showRoll(label, total, detail, extra, cls);
    const el = $('#roll'), t = $('.rp-t', el), n = Number(total);
    scramble?.kill(); G.killTweensOf([el, t]);
    G.fromTo(el, { y: -26, scale: .9 }, { y: 0, scale: 1, duration: .55, ease: 'back.out(1.8)' });
    if (Number.isFinite(n)) {
      const hi = Math.max(20, n + 5);
      scramble = G.to({}, { duration: .42, onUpdate: () => { t.textContent = 1 + Math.floor(Math.random() * hi); }, onComplete: () => { t.textContent = n; } });
      G.fromTo(t, { scale: .55, rotation: -12 }, { scale: 1, rotation: 0, duration: .8, ease: 'elastic.out(1,.45)', delay: .38 });
    }
    if (cls.includes('crit')) G.delayedCall(.42, () => { const [x, y] = center(t); ring(x, y, '#d9b46c', 11, .9); sparks(x, y, '#f1d9a6', 20, 110); });
    if (cls.includes('fail')) G.fromTo(el, { x: -12 }, { x: 0, duration: .7, ease: 'elastic.out(1,.25)', delay: .42 });
  };

  /* ---------------- ambiente: aurora, neve, brilho do cursor ---------------- */
  qa('.aurora i').forEach((b, i) => G.to(b, {
    x: () => rand(-.16, .16) * innerWidth, y: () => rand(-.1, .1) * innerHeight, scale: () => rand(.85, 1.2),
    duration: () => rand(14, 22), ease: 'sine.inOut', repeat: -1, yoyo: true, repeatRefresh: true, delay: -i * 4
  }));

  const cv = $('#snow'), ctx = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  let W = 0, H = 0;
  const resize = () => { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; };
  resize();
  const flakes = Array.from({ length: innerWidth < 700 ? 26 : 48 }, () => ({
    x: Math.random() * W, y: Math.random() * H, r: rand(.6, 2.2) * dpr, v: rand(.15, .55) * dpr, p: rand(0, 6.28), a: rand(.12, .5)
  }));
  G.ticker.add(() => {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#e4f5ff';
    for (const f of flakes) {
      f.y += f.v; f.p += .012; f.x += Math.sin(f.p) * .35 * dpr;
      if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; }
      ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    }
  });
  addEventListener('resize', () => { resize(); moveInd(0); });

  if (matchMedia('(hover: hover)').matches) document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('.spell, .atk-row, .item, .panel');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ---------------- abertura ---------------- */
  moveInd(0);
  const wide = innerWidth >= 900;
  G.timeline({ defaults: { ease: 'expo.out' } })
    .from('.sigil', { scale: .3, rotation: -140, autoAlpha: 0, duration: 1.4, clearProps: 'transform' })
    .fromTo('.hero h1', { clipPath: 'inset(0 100% 0 0)', letterSpacing: '.2em' },
      { clipPath: 'inset(0 0% 0 0)', letterSpacing: '.05em', duration: 1.4, clearProps: 'clipPath,letterSpacing' }, '<.1')
    .from(['.eyebrow', '.hero .sub'], { y: 10, autoAlpha: 0, duration: .8, stagger: .1, clearProps: 'transform,opacity,visibility' }, '<.25')
    .from('.stat', { y: 24, autoAlpha: 0, duration: .9, stagger: .07, clearProps: 'transform,opacity,visibility' }, '<.1')
    .from('.substats', { y: 6, autoAlpha: 0, duration: .6, clearProps: 'transform,opacity,visibility' }, '<.3')
    .from('.tabs', wide ? { y: -12, autoAlpha: 0, duration: .8 } : { yPercent: 100, duration: .9 }, '<')
    .add(() => { moveInd(0); animatePanel(); }, '<.1');
})();
