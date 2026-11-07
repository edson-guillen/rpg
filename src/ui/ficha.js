/* =====================================================================
   ABA FICHA
   ===================================================================== */
/** Botões do que depende da situação. O que é sempre válido entra sem botão. */
function barraBonus() {
  const regras = (CHAR.bonus || []).filter(r => r.modo === 'marca' || (r.modo === 'auto' && r.requer)), versatil = CHAR.attacks.some(w => w.versatil);
  const chip = r => {
    const usado = r.uma && state.fx.usado?.[r.id], on = r.opcoes ? typeof state.fx.on?.[r.id] === 'string' : r.modo === 'auto' ? bonusLigado(r) : bonusMarcado(r.id) || (r.conc && state.conc === r.conc);
    const falta = (r.res && (state.res[r.res] ?? 0) < 1) || (r.pacto && !pactoLivre()) || (r.requer && !r.requer(state));
    const txt = r.opcoes ? state.fx.on?.[r.id] || 'escolher' : usado ? 'usado' : descBonus(r);
    return r.modo === 'auto' ? `<span class="bchip ${on ? 'on' : ''} ${usado ? 'usado' : ''}">${r.nome} <small>${txt}</small></span>`
      : `<button class="bchip ${on ? 'on' : ''} ${usado ? 'usado' : ''}" data-action="bonus-toggle" data-id="${r.id}" aria-pressed="${!!on}" ${falta ? 'disabled' : ''}>${r.nome} <small>${txt}</small></button>`;
  };
  const lista = regras.map(chip);
  if (versatil) lista.unshift(`<button class="bchip ${bonusMarcado('duasmaos') ? 'on' : ''}" data-action="bonus-toggle" data-id="duasmaos" aria-pressed="${bonusMarcado('duasmaos')}">Duas mãos <small>Versátil</small></button>`);
  if (!lista.length) return '';
  const turno = (CHAR.bonus || []).some(r => r.uma || r.turno);
  return `<div class="bonus-bar">${lista.join('')}${turno ? '<button class="bchip turno" data-action="bonus-turno">Novo turno</button>' : ''}</div>`;
}
function renderFicha() {
  const s = CHAR.stats, pb = s.pb;
  $('#abil').innerHTML = CHAR.abilities.map(a => {
    const m = modOf(a.s), sv = m + (a.prof ? pb : 0);
    return `<div class="abil ${a.prof ? 'prof' : ''}">
      ${rollBtn({ kind: 'd20', bonus: m, label: `Teste de ${a.n}` }, `<span class="ab-k">${a.k}</span><span class="ab-m num">${sign(m)}</span><span class="ab-s num">${a.s}</span>`, 'ab-main')}
      ${rollBtn({ kind: 'd20', bonus: sv, label: `Salvaguarda de ${a.n}` }, `<span>Salv.</span><b class="num">${sign(sv)}</b>${a.prof ? '<i class="pdot" title="Proficiente"></i>' : ''}`, 'ab-save')}
      ${a.note ? `<span class="ab-note">${a.note}</span>` : ''}</div>`;
  }).join('');

  $('#atk-hint').textContent = state.fx.innate ? 'Ataques de magia com Vantagem' : 'toque para rolar';
  $('#atk-bonus').innerHTML = barraBonus();
  $('#attacks').innerHTML = CHAR.attacks.map(w => {
    const D = danoDeArma(w), atk = w.atk + D.atk, nomes = D.lista.map(r => r.nome), crit = D.crit < 20 ? ` · crítico em ${D.crit}+` : '';
    return `<div class="atk-row">
      <div class="atk-t"><b>${w.name}</b><span>${w.sub}</span></div>
      ${rollBtn({ kind: 'd20', bonus: atk, atk: 1, src: w.id, adv: D.adv ? 'sim' : w.spell ? 'spell' : null, critmin: D.crit < 20 ? D.crit : null, label: `${w.name} · ataque` }, `<small>ATQ${D.adv ? ' · V' : ''}</small><b class="num">${sign(atk)}</b>`, 'rb atk')}
      ${rollBtn({ kind: 'dmg', arma: w.id, crit: 1, src: w.id, type: w.type, label: `${w.name} · dano` }, `<small>DANO</small><b class="num">${textoDano(D)}</b>`, 'rb dmg')}
      <div class="atk-c">Acerto: ${w.calc} · ${w.type} · média ${decimal(mediaDano(D))}${crit}${nomes.length ? ` · <b>${nomes.join(', ')}</b>` : ''}</div></div>`;
  }).join('');

  const soren = activeChar().template === 'soren', inata = !!RES.innate, carga = soren ? `FOR ${abil('FOR').s} · Porte Poderoso (conta como Grande)` : `FOR ${abil('FOR').s}`;
  const rows = [
    ['Classe de Armadura', ac(), `${CHAR.calc.ac}${state.fx.shield ? ` + ${s.shieldBonus} Escudo Arcano` : SPELL.shield ? ` · ${s.ac + s.shieldBonus} com Escudo Arcano` : ''}`, state.fx.shield],
    ['Pontos de Vida', s.hpMax, CHAR.calc.hp],
    [s.attr ? 'CD de Magia' : 'CD de Característica', dc(), `${CHAR.calc.dc}${state.fx.innate ? ' + 1 Feitiçaria Inata' : inata ? ` · ${s.dc + 1} com Feitiçaria Inata` : ''}`, state.fx.innate],
    [s.attr ? 'Ataque Mágico' : 'Ataque', sign(s.atk), `${CHAR.calc.atk}${state.fx.innate ? ' · com Vantagem' : inata ? ' · Vantagem com Feitiçaria Inata' : ''}`, state.fx.innate],
    ['Iniciativa', sign(s.init), `DES ${sign(modOf(abil('DES').s))}`],
    ['Percepção Passiva', 10 + modOf(abil('SAB').s), `10 + SAB ${modOf(abil('SAB').s)}`],
    ['Deslocamento', s.speed, soren ? 'Salto da Nuvem: 9 m' : ''],
    ['Bônus de Proficiência', sign(pb), `Nível de personagem ${CHAR.level}`],
    ['Carga Máxima', CHAR.carry, carga]
  ];
  $('#calc').innerHTML = rows.map(([n, v, f, boost]) => `<div class="calc-row ${boost ? 'boost' : ''}"><b>${n}</b><span class="cv num">${v}</span><span>${f}</span></div>`).join('');

  const line = ([n, k, src, esp]) => {
    const v = modOf(abil(k).s) + (src ? pb : 0) + (esp ? pb : 0);
    return rollBtn({ kind: 'd20', bonus: v, label: `${n} (${k})` },
      `<span class="sk-n"><i class="pdot ${src ? '' : 'off'}"></i>${n} <small>${k}${src ? ' · ' + src : ''}${esp ? ' · Especialista' : ''}</small></span><b class="num">${sign(v)}</b>`, `skill ${src ? 'prof' : ''}`);
  };
  $('#skills').innerHTML = CHAR.skills.map(line).join('') + `<p class="sub-h" style="grid-column:1/-1">Ferramentas</p>` + CHAR.tools.map(line).join('');
}

