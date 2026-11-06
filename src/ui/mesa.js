/* =====================================================================
   MESA DE DADOS — valores físicos, com os limites de cada magia.
   Casa vazia é rolada pelo app; a cena recebe o resultado fechado.
   ===================================================================== */
let lance = null, mesaCtx = null;
const spellById = id => SPELL[id] || libGet(id);
const refazLimite = () => Math.max(1, CHAR.stats.cha);

function openMesa(s, lv, ctx = {}) {
  const spec = diceSpec(s, lv, ctx);
  lance = novoLance(spec);
  mesaCtx = { s, lv, ctx };
  if (critSrc === s.id && spec.atk) { lance.d20[0] = [20]; critSrc = null; }
  openModal(mesaBuild);
}
function mesaTrocaSpec(ctx) {
  Object.assign(mesaCtx.ctx, ctx);
  const velho = lance;
  lance = novoLance(diceSpec(mesaCtx.s, mesaCtx.lv, mesaCtx.ctx));
  lance.d20 = velho.d20; lance.save = velho.save;
  modalRefresh?.();
}

const dieCell = (key, j, f, v, nome, extra = '') => `<input class="dc ${extra}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="${String(f).length}" data-mc="${key}" data-j="${j}" data-f="${f}" value="${v || ''}" aria-label="${esc(nome)}">`;
const faceTxt = (n, f, mod) => `${n}d${f}${mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : ''}`;

function grupoHtml(g, i) {
  const k = cellKey(i, g), n = dicePorGrupo(lance, g, i), ab = extrasAbertos(lance, g, i), vals = lance.dados[k] || [], ex = lance.extras[k] || [], soTotal = lance.totais[k] !== undefined, r = faixaGrupo(lance, g, i);
  const nome = j => `Dado ${j + 1} de ${n}, d${g.f}`;
  const extraTxt = g.explode ? `<small>${ab ? `${ab} de ${g.explode.max} extras` : `tirar ${g.explode.v} abre outro dado, até ${g.explode.max}`}</small>` : '';
  const cells = soTotal
    ? `<input class="dc wide" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-mt="${k}" data-min="${r.min}" data-max="${r.max}" value="${lance.totais[k] ?? ''}" aria-label="Total de ${r.n}d${g.f}, de ${r.min} a ${r.max}"><small>de ${r.min} a ${r.max}</small>`
    : `<div class="dcs ${n > 8 ? 'many' : ''}">${Array.from({ length: n }, (_, j) => dieCell(k, j, g.f, vals[j], nome(j), j >= g.n && g.crit ? 'crit' : j >= g.nBase ? 'up' : '') + (castMeta.has('empowered') && mesaCtx.ctx.modo !== 'livre' && vals[j] ? `<button class="dc-re" data-action="mesa-refaz" data-k="${k}" data-j="${j}" aria-label="Refazer dado ${j + 1}" ${lance.refeitos >= refazLimite() ? 'disabled' : ''}>↻</button>` : '')).join('')}${Array.from({ length: ab }, (_, j) => `<input class="dc exp" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="${String(g.f).length}" data-mx="${k}" data-j="${j}" data-f="${g.f}" value="${ex[j] || ''}" aria-label="Dado extra ${j + 1}, d${g.f}">`).join('')}</div>`;
  return `<div class="mg"><div class="mg-h"><b>${faceTxt(r.n, g.f, g.mod)}</b> <span>${esc([g.aux ? g.label : g.type, g.aux ? '' : g.label].filter(Boolean).join(' · '))}</span>
      ${n > 3 && r.max > r.min ? `<button class="mg-t" data-action="mesa-total" data-k="${k}" aria-pressed="${soTotal}">Só o total</button>` : ''}</div>${cells}${extraTxt}</div>`;
}
function ataqueHtml(i) {
  const a = lance.spec.atk, d20 = lance.d20[i] || [], nat = natural(lance, i), travado = nat === 20 || nat === 1, miss = isMiss(lance, i);
  const cell = j => `<input class="dc" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="2" data-md="${i}" data-j="${j}" data-f="20" value="${d20[j] || ''}" aria-label="d20 ${j + 1} do ataque">`;
  return `<div class="mg atk"><div class="mg-h"><b>d20 ${sign(a.bonus)}</b><span>${a.adv ? 'Vantagem: vale o maior' : 'ataque'}${nat ? ` · total ${nat + a.bonus}` : ''}</span></div>
    <div class="dcs">${cell(0)}${a.adv ? cell(1) : ''}
      <div class="seg" role="group" aria-label="Resultado do ataque"><button class="mt" data-action="mesa-erro" data-i="${i}" data-v="0" aria-pressed="${!miss}" ${travado ? 'disabled' : ''}>${nat === 20 ? 'Crítico' : 'Acertou'}</button><button class="mt" data-action="mesa-erro" data-i="${i}" data-v="1" aria-pressed="${miss}" ${travado ? 'disabled' : ''}>Errou</button></div></div></div>`;
}
function mesaBuild() {
  const { s, lv } = mesaCtx, sp = lance.spec, n = instanciasDe(lance), danos = sp.grupos.filter(g => !g.aux), aux = sp.grupos.filter(g => g.aux), acum = danos.find(g => g.acumula);
  const blocos = Array.from({ length: n }, (_, i) => `<section class="mi"><h4>${i >= sp.inst ? `Salto ${i - sp.inst + 1} · novo alvo` : n > 1 && sp.rotulo ? `${esc(sp.rotulo)} ${i + 1}` : danos.length ? 'Dados' : ''}</h4>${sp.atk ? ataqueHtml(i) : ''}${danos.map(g => grupoHtml(g, i)).join('')}</section>`).join('');
  const faltaTipo = s.choice?.length && !sp.tipo;
  return `<div class="${lvClass(s.level)}">${mHead(`Mesa de dados · ${s.level ? `${ORD(lv)} círculo` : 'Truque'}`, esc(s.name), sp.tipo ? esc(sp.tipo) : '')}
    ${faltaTipo ? `<div class="mt-group" role="group" aria-label="Elemento">${s.choice.map(t => `<button class="mt" data-action="mesa-tipo" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
    ${sp.alts.length > 1 ? `<div class="mt-group" role="group" aria-label="Efeito">${sp.alts.map(a => `<button class="mt" data-action="mesa-alt" data-a="${esc(a)}" aria-pressed="${a === sp.alt}">${esc(a)}</button>`).join('')}</div>` : ''}
    <p class="note">Digite o que saiu nos dados físicos. O que ficar vazio o app rola.</p>
    ${acum ? `<div class="mg"><div class="mg-h"><b>${acum.acumula} acumulado</b><span>por turno sem explodir</span></div><div class="stepper"><button class="mt" data-action="mesa-stack" data-v="-1" aria-label="Menos um turno">−</button><b class="num">${lance.stack}</b><button class="mt" data-action="mesa-stack" data-v="1" aria-label="Mais um turno">+</button></div></div>` : ''}
    ${blocos}
    ${sp.save ? `<div class="mg"><div class="mg-h"><b>Salvaguarda do alvo</b></div><div class="seg" role="group" aria-label="Salvaguarda">${[['falhou', 'Falhou'], ['passou', danos.some(g => g.half) ? 'Passou (metade)' : 'Passou'], ['varios', 'Vários alvos']].map(([v, t]) => `<button class="mt" data-action="mesa-save" data-v="${v}" aria-pressed="${lance.save === v}">${t}</button>`).join('')}</div></div>` : ''}
    ${aux.length ? `<section class="mi"><h4>${danos.length ? 'À parte' : 'Dados'}</h4>${aux.map(g => grupoHtml(g, 0)).join('')}</section>` : ''}
    ${castMeta.has('empowered') && mesaCtx.ctx.modo !== 'livre' ? `<p class="note">Magia Potencializada: refaça até ${refazLimite()} dados (${lance.refeitos} usados). Com dados físicos, basta digitar o novo valor.</p>` : ''}
    <p class="mesa-msg" id="mesa-msg" role="alert"></p>
    <div class="mesa-foot"><div class="mesa-t" aria-live="polite"><small>Total</small><b class="num" id="mesa-total">–</b></div>
      <div class="m-actions">${mesaCtx.ctx.modo === 'livre' ? '' : '<button class="btn ghost" data-action="mesa-pular">Pular dados</button>'}<button class="btn gold" id="mesa-go" data-action="mesa-go" ${faltaTipo ? 'disabled' : ''}>${icon('i-die')}<span id="mesa-go-t">Rolar no app</span></button></div></div></div>`;
}
const casasFaltando = L => {
  let vazias = 0, cheias = 0;
  const conta = v => { if (v) cheias++; else vazias++; };
  for (let i = 0; i < instanciasDe(L); i++) {
    if (L.spec.atk) { conta(L.d20[i]?.[0]); if (L.spec.atk.adv) conta(L.d20[i]?.[1]); }
    L.spec.grupos.forEach(g => {
      const k = cellKey(i, g);
      if (L.totais[k] !== undefined) return conta(L.totais[k]);
      for (let j = 0; j < dicePorGrupo(L, g, i); j++) conta(L.dados[k]?.[j]);
      for (let j = 0; j < extrasAbertos(L, g, i); j++) conta(L.extras[k]?.[j]);
    });
  }
  return { vazias, cheias };
};
function mesaResumo() {
  if (!$('#mesa-total')) return;
  const { vazias, cheias } = casasFaltando(lance), res = resolveLance(lance);
  $('#mesa-total').textContent = cheias ? res.total : '–';
  $('#mesa-go-t').textContent = !cheias ? 'Rolar no app' : vazias ? `Rolar ${vazias === 1 ? 'o dado' : `os ${vazias} dados`} que falta${vazias === 1 ? '' : 'm'}` : 'Lançar';
}
const formaLance = L => { const out = [instanciasDe(L)]; for (let i = 0; i < out[0]; i++) { out.push(isMiss(L, i), natural(L, i) === 20, natural(L, i) === 1); L.spec.grupos.forEach(g => out.push(dicePorGrupo(L, g, i), extrasAbertos(L, g, i))); } return out.join(); };
function mesaAviso(t) { const m = $('#mesa-msg'); if (m) m.textContent = t; }
function proximaCasa(el) {
  const casas = [...document.querySelectorAll('#sheet .dc')], i = casas.indexOf(el);
  (casas.slice(i + 1).find(c => !c.value) || $('#mesa-go'))?.focus({ preventScroll: false });
}
function focoCasa(sel) { const c = sel && document.querySelector(`#sheet ${sel}`); c ? proximaCasa(c) : $('#sheet .dc')?.focus(); }

/* Entrada: recusa o que está fora do dado e avança sozinha. */
document.addEventListener('input', e => {
  const el = e.target, ds = el.dataset;
  if (!lance || !el.classList?.contains('dc')) return;
  el.value = el.value.replace(/\D/g, '');
  const antes = formaLance(lance);
  if (ds.mt !== undefined) {
    const v = el.value === '' ? null : +el.value, max = +ds.max;
    if (v !== null && v > max) { el.value = ''; lance.totais[ds.mt] = null; el.classList.add('bad'); mesaAviso(`O total vai de ${ds.min} a ${ds.max}.`); }
    else { el.classList.remove('bad'); mesaAviso(''); lance.totais[ds.mt] = v; }
    mesaResumo();
    return;
  }
  const f = +ds.f, j = +ds.j, raw = el.value, v = raw === '' ? 0 : +raw;
  const guarda = x => {
    if (ds.md !== undefined) { const a = lance.d20[ds.md] = lance.d20[ds.md] || []; a[j] = x; }
    else if (ds.mx !== undefined) { const a = lance.extras[ds.mx] = lance.extras[ds.mx] || []; a[j] = x; }
    else { const a = lance.dados[ds.mc] = lance.dados[ds.mc] || []; a[j] = x; }
  };
  if (raw !== '' && !validoDado(f, v)) {
    el.value = ''; guarda(0); el.classList.add('bad');
    mesaAviso(`Um d${f} vai de 1 a ${f}.`);
    mesaResumo();
    return;
  }
  el.classList.remove('bad'); mesaAviso(''); guarda(v);
  const fechou = raw !== '' && (raw.length === String(f).length || v * 10 > f);
  if (formaLance(lance) !== antes) {
    const sel = ds.md !== undefined ? `[data-md="${ds.md}"][data-j="${j}"]` : ds.mx !== undefined ? `[data-mx="${ds.mx}"][data-j="${j}"]` : `[data-mc="${ds.mc}"][data-j="${j}"]`;
    modalRefresh?.(); mesaResumo();
    if (fechou) focoCasa(sel);
    return;
  }
  mesaResumo();
  if (fechou) proximaCasa(el);
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (!lance || el.dataset?.mt === undefined || el.value === '') return;
  if (+el.value < +el.dataset.min) { el.value = ''; lance.totais[el.dataset.mt] = null; el.classList.add('bad'); mesaAviso(`O total vai de ${el.dataset.min} a ${el.dataset.max}.`); mesaResumo(); }
});

function mostrarResultado(s, res) {
  const nome = res.inst.length > 1 ? (s.inst?.rotulo || 'Alvo') : '', linhas = [], extras = [];
  res.inst.forEach(x => {
    const d20 = x.d20 ? `🎲 ${x.d20.filter(Boolean).join(' e ')} → ${x.nat + (lance.spec.atk?.bonus || 0)}` : '';
    const valores = `[${x.dados.map(q => q.v).join(', ')}]`;
    linhas.push(`${x.salto ? 'Salto: ' : nome ? `${nome} ${x.i + 1}: ` : ''}${d20}${d20 ? ' · ' : '🎲 '}${x.hit ? `${valores} = <b>${x.total}</b>` : 'errou'}`);
  });
  if (res.temDano && lance.spec.grupos.some(g => !g.aux && g.mod)) extras.push(`Modificador incluído: ${lance.spec.grupos.filter(g => !g.aux && g.mod).map(g => sign(g.mod)).join(', ')}.`);
  if (res.passou) extras.push('O alvo passou na salvaguarda.');
  if (res.varios) extras.push(`Quem passar sofre <b>${lance.spec.grupos.some(g => g.half) ? Math.floor(res.total / 2) : 0}</b>.`);
  if (res.saltos) extras.push(`O orbe saltou ${res.saltos} ${res.saltos > 1 ? 'vezes' : 'vez'}!`);
  if (res.crit) extras.push('Crítico: os dados dobraram.');
  res.aux.forEach(a => extras.push(`${esc(a.label)}: <b>${a.total}</b>.`));
  const soAux = !res.temDano && res.aux.length, rot = esc(s.name) + (res.tipo ? ` · ${esc(res.tipo)}` : res.cura ? ' · Cura' : '');
  showRoll(rot, soAux ? res.aux[0].total : res.total, linhas.join('<br>') || `🎲 [${res.aux.flatMap(a => a.vals).join(', ')}]`, extras.join(' '), res.crit ? 'crit' : res.erro ? 'fail' : '');
}
function mesaLancar() {
  const { s, lv, ctx } = mesaCtx;
  completarLance(lance);
  const res = resolveLance(lance);
  closeModal();
  mostrarResultado(s, res);
  playSpell(s, res.tipo || ctx.tipo || null, lv || s.level, res);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action^="mesa-"]');
  if (!b || !lance) return;
  const ds = b.dataset;
  switch (ds.action) {
    case 'mesa-go': mesaLancar(); break;
    case 'mesa-pular': closeModal(); playSpell(mesaCtx.s, mesaCtx.ctx.tipo || null, mesaCtx.lv || mesaCtx.s.level); break;
    case 'mesa-alt': mesaTrocaSpec({ alt: ds.a }); break;
    case 'mesa-tipo': mesaTrocaSpec({ tipo: ds.t }); break;
    case 'mesa-save': lance.save = ds.v; modalRefresh?.(); break;
    case 'mesa-erro': lance.erro[ds.i] = ds.v === '1'; modalRefresh?.(); break;
    case 'mesa-stack': lance.stack = Math.min(10, Math.max(0, lance.stack + +ds.v)); modalRefresh?.(); break;
    case 'mesa-total': { const k = ds.k; if (lance.totais[k] !== undefined) delete lance.totais[k]; else lance.totais[k] = null; modalRefresh?.(); break; }
    case 'mesa-refaz': {
      if (lance.refeitos >= refazLimite()) return;
      const [i, gid] = ds.k.split(':'), g = lance.spec.grupos.find(x => x.id === gid);
      lance.dados[ds.k][+ds.j] = d(g.f); lance.refeitos++;
      if (+i >= 0) modalRefresh?.();
      break;
    }
  }
  mesaResumo();
});
