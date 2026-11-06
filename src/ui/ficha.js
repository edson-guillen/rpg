/* =====================================================================
   ABA FICHA
   ===================================================================== */
function renderFicha() {
  const s = CHAR.stats, pb = s.pb;
  $('#abil').innerHTML = CHAR.abilities.map(a => {
    const m = modOf(a.s), sv = m + (a.prof ? pb : 0);
    return `<div class="abil ${a.prof ? 'prof' : ''}">
      ${rollBtn({ kind: 'd20', bonus: m, label: `Teste de ${a.n}` }, `<span class="ab-k">${a.k}</span><span class="ab-m num">${sign(m)}</span><span class="ab-s num">${a.s}</span>`, 'ab-main')}
      ${rollBtn({ kind: 'd20', bonus: sv, label: `Salvaguarda de ${a.n}` }, `<span>Salv.</span><b class="num">${sign(sv)}</b>${a.prof ? '<i class="pdot" title="Proficiente"></i>' : ''}`, 'ab-save')}
      ${a.note ? `<span class="ab-note">${a.note}</span>` : ''}</div>`;
  }).join('');

  $('#atk-hint').textContent = state.fx.innate ? 'Golpe Certeiro com Vantagem' : 'toque para rolar';
  $('#attacks').innerHTML = CHAR.attacks.map(w => `<div class="atk-row">
      <div class="atk-t"><b>${w.name}</b><span>${w.sub}</span></div>
      ${rollBtn({ kind: 'd20', bonus: w.atk, atk: 1, src: w.id, adv: w.spell ? 'spell' : null, label: `${w.name} · ataque` }, `<small>ATQ</small><b class="num">${sign(w.atk)}</b>`, 'rb atk')}
      ${rollBtn({ kind: 'dmg', expr: w.dmg, crit: 1, src: w.id, type: w.type, label: `${w.name} · dano` }, `<small>DANO</small><b class="num">${showDice(w.dmg)}</b>`, 'rb dmg')}
      <div class="atk-c">Acerto: ${w.calc} · ${w.type} · média ${decimal(avgOf(w.dmg))}</div></div>`).join('');

  const rows = [
    ['Classe de Armadura', ac(), `${CHAR.calc.ac}${state.fx.shield ? ` + ${s.shieldBonus} Escudo Arcano` : ` · ${s.ac + s.shieldBonus} com Escudo Arcano`}`, state.fx.shield],
    ['Pontos de Vida', s.hpMax, CHAR.calc.hp],
    ['CD de Magia', dc(), `${CHAR.calc.dc}${state.fx.innate ? ' + 1 Feitiçaria Inata' : ` · ${s.dc + 1} com Feitiçaria Inata`}`, state.fx.innate],
    ['Ataque Mágico', sign(s.atk), `${CHAR.calc.atk}${state.fx.innate ? ' · com Vantagem' : ' · Vantagem com Feitiçaria Inata'}`, state.fx.innate],
    ['Iniciativa', sign(s.init), 'DES 2'],
    ['Percepção Passiva', 10 + modOf(abil('SAB').s), '10 + SAB 0'],
    ['Deslocamento', s.speed, '35 pés · Salto das Nuvens: 9 m'],
    ['Bônus de Proficiência', sign(pb), 'Nível de personagem 4'],
    ['Carga Máxima', CHAR.carry, 'FOR 8 · Constituição Poderosa (conta como Grande)']
  ];
  $('#calc').innerHTML = rows.map(([n, v, f, boost]) => `<div class="calc-row ${boost ? 'boost' : ''}"><b>${n}</b><span class="cv num">${v}</span><span>${f}</span></div>`).join('');

  const line = ([n, k, src]) => {
    const v = modOf(abil(k).s) + (src ? pb : 0);
    return rollBtn({ kind: 'd20', bonus: v, label: `${n} (${k})` },
      `<span class="sk-n"><i class="pdot ${src ? '' : 'off'}"></i>${n} <small>${k}${src ? ' · ' + src : ''}</small></span><b class="num">${sign(v)}</b>`, `skill ${src ? 'prof' : ''}`);
  };
  $('#skills').innerHTML = CHAR.skills.map(line).join('') + `<p class="sub-h" style="grid-column:1/-1">Ferramentas</p>` + CHAR.tools.map(line).join('');
}

