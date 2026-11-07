/* =====================================================================
   BÔNUS DE ATAQUE E DANO
   Regras resumidas com palavras próprias, conferidas com o Livro do
   Jogador 2024 e Eberron: Forge of the Artificer.

   modo 'auto': entra sozinho quando a condição vale.
   modo 'marca': depende da situação, então a Ficha mostra um botão.
   uma: só uma vez por turno. res: gasta recurso. pacto: gasta espaço de
   Pacto. magia: vale para magias, não para armas.
   ===================================================================== */
const TIPOS_ARMA = 'Da arma';
const modDe = v => (v ? `${v > 0 ? '+' : '-'}${Math.abs(v)}` : '');

function regrasBonus(b, M, cl) {
  const R = [], estilos = new Set([...(b.escolhas?.estilos || []), ...(b.feats || []).map(id => FEATS.find(f => f.id === id)?.name)]), inv = new Set(b.escolhas?.invocacoes || []);
  const ligada = id => bonusMarcado(id), comArma = a => !!a.arma, corpo = a => !!a.melee && !!a.arma, corpoOuMao = a => !!a.melee, forca = a => a.attr === 'FOR';
  const add = (id, nome, r) => R.push({ id, nome, modo: 'auto', vale: () => true, ...r });

  if (estilos.has('Arquearia')) add('arquearia', 'Arquearia', { atk: 2, vale: a => !!a.dist });
  if (estilos.has('Combate com Armas de Arremesso')) add('arremesso', 'Arremessando', { modo: 'marca', mod: 2, info: '+2', vale: a => !!a.arremesso });
  if (estilos.has('Duelismo')) add('duelismo', 'Duelismo', { mod: 2, vale: a => corpo(a) && !a.duas && !(a.versatil && ligada('duasmaos')) });
  if (estilos.has('Combate com Armas Grandes')) add('gwf', 'Armas Grandes', { gwf: true, vale: a => corpo(a) && (a.duas || (a.versatil && ligada('duasmaos'))) });
  if ((b.feats || []).includes('savage-attacker')) add('selvagem', 'Atacante Selvagem', { modo: 'marca', padrao: true, uma: true, melhor: true, info: '2× dados', vale: comArma });

  for (const x of cl) {
    const L = CLASS_LEVELS[x.id][x.lv - 1], s = x.sub, lv = x.lv;
    if (x.id === 'barbarian') {
      const f = L.rage_damage_bonus, raiva = st => st.fx.rage, impr = () => ligada('imprudente');
      add('furia', 'Fúria', { mod: f, requer: raiva, vale: forca });
      if (lv >= 2) add('imprudente', 'Ataque Imprudente', { modo: 'marca', adv: true, turno: true, dura: true, info: 'Vantagem', vale: forca });
      if (lv >= 9) add('brutal', 'Golpe Brutal', { modo: 'marca', uma: true, semVant: true, dado: lv >= 17 ? '2d10' : '1d10', requer: impr, vale: forca });
      if (s === 'berserker') add('frenesi', 'Frenesi', { uma: true, dado: `${f}d6`, requer: st => raiva(st) && impr(), vale: forca });
      if (s === 'zealot') add('furia-divina', 'Fúria Divina', { uma: true, dado: `1d6${modDe(Math.floor(lv / 2))}`, tipo: 'Necrótico ou Radiante', requer: raiva, vale: corpoOuMao });
    }
    if (x.id === 'rogue') {
      add('furtivo', 'Ataque Furtivo', { modo: 'marca', uma: true, dado: `${Math.ceil(lv / 2)}d6`, vale: a => !!a.acuidade || !!a.dist });
      if (s === 'assassin') add('surpresa', 'Golpe Surpreendente', { modo: 'marca', uma: true, mod: lv, info: `+${lv}`, requer: () => ligada('furtivo') && !state.fx.usado?.furtivo, vale: a => !!a.acuidade || !!a.dist });
    }
    if (x.id === 'cleric' && lv >= 7) {
      add('golpe-divino', 'Golpe Divino', { modo: 'marca', uma: true, dado: lv >= 14 ? '2d8' : '1d8', tipo: 'Necrótico ou Radiante', vale: comArma });
      add('poder-clerigo', 'Conjuração Poderosa', { modo: 'marca', magia: true, info: 'truques', cadaAlvo: true, mod: M.SAB, valeMagia: sp => !sp.level && (sp.classes || []).includes('cleric') });
    }
    if (x.id === 'druid' && lv >= 7) {
      add('ataque-primal', 'Ataque Primal', { modo: 'marca', uma: true, dado: lv >= 15 ? '2d8' : '1d8', tipo: 'Elétrico, Gélido, Ígneo ou Trovejante', vale: comArma });
      add('poder-druida', 'Conjuração Poderosa', { modo: 'marca', magia: true, info: 'truques', cadaAlvo: true, mod: M.SAB, valeMagia: sp => !sp.level && (sp.classes || []).includes('druid') });
    }
    if (x.id === 'ranger') {
      add('marca', 'Marca do Predador', { modo: 'marca', conc: 'hunters-mark', dura: true, dado: lv >= 20 ? '1d10' : '1d6', tipo: 'Energético', vale: comArma });
      if (s === 'fey-wanderer' && lv >= 3) add('terriveis', 'Golpes Terríveis', { modo: 'marca', padrao: true, uma: true, dado: lv >= 11 ? '1d6' : '1d4', tipo: 'Psíquico', vale: comArma });
      if (s === 'hunter' && lv >= 3) add('colosso', 'Assassino de Colossos', { modo: 'marca', uma: true, dado: '1d8', vale: comArma });
      if (s === 'gloom-stalker' && lv >= 3) add('golpe-terrivel', 'Golpe Terrível', { modo: 'marca', uma: true, dado: lv >= 11 ? '2d8' : '2d6', tipo: 'Psíquico', vale: comArma });
    }
    if (x.id === 'fighter') {
      if (s === 'champion' && lv >= 3) add('critico', lv >= 15 ? 'Crítico Superior' : 'Crítico Aprimorado', { crit: lv >= 15 ? 18 : 19, vale: a => !!a.arma || !!a.desarmado });
      if (s === 'psi-warrior' && lv >= 3) add('psi-golpe', 'Golpe Psiônico', { modo: 'marca', uma: true, res: 'psi', dado: `1d${PSI(lv)[0]}${modDe(M.INT)}`, tipo: 'Energético', vale: comArma });
      if (s === 'battle-master' && lv >= 3) add('manobra', 'Manobra', { modo: 'marca', res: 'superiority', solta: true, dado: `1d${lv >= 18 ? 12 : lv >= 10 ? 10 : 8}`, vale: a => !!a.arma || !!a.desarmado });
    }
    if (x.id === 'paladin') {
      if (lv >= 11) add('radiantes', 'Golpes Radiantes', { dado: '1d8', tipo: 'Radiante', vale: corpoOuMao });
      if (s === 'devotion' && lv >= 3) add('sagrada', 'Arma Sagrada', { modo: 'marca', dura: true, atk: Math.max(1, M.CAR), info: `+${Math.max(1, M.CAR)} ataque`, vale: corpo });
    }
    if (x.id === 'warlock') {
      if (inv.has('Explosão Agonizante')) add('agonizante', 'Explosão Agonizante', { magia: true, cadaAlvo: true, mod: M.CAR, valeMagia: sp => sp.id === 'eldritch-blast' });
      if (inv.has('Sorvedouro de Vida')) add('sorvedouro', 'Sorvedouro de Vida', { modo: 'marca', padrao: true, uma: true, dado: '1d6', tipo: 'Necrótico, Psíquico ou Radiante', vale: corpo });
      if (inv.has('Punição Mística')) add('punicao', 'Punição Mística', { modo: 'marca', uma: true, pacto: true, solta: true, dado: `${1 + slotPactoDe(cl)}d8`, tipo: 'Energético', vale: corpo });
      if (s === 'celestial' && lv >= 6) add('alma', 'Alma Radiante', { magia: true, mod: M.CAR, tipos: ['Ígneo', 'Radiante'], valeMagia: () => true });
    }
    if (x.id === 'sorcerer' && s === 'draconic' && lv >= 6) add('afinidade', 'Afinidade Elemental', { modo: 'marca', magia: true, opcoes: ['Ácido', 'Elétrico', 'Gélido', 'Ígneo', 'Venenoso'], mod: M.CAR, valeMagia: () => true });
    if (x.id === 'wizard' && s === 'evoker' && lv >= 10) add('evocacao', 'Evocação Potencializada', { magia: true, mod: M.INT, valeMagia: sp => sp.school === 'Evocação' && (sp.classes || []).includes('wizard') });
    if (x.id === 'artificer' && s === 'alchemist' && lv >= 5) add('alquimia', 'Sábio Alquímico', { magia: true, mod: Math.max(1, M.INT), tipos: ['Ácido', 'Ígneo', 'Venenoso'], curaTambem: true, valeMagia: () => true });
  }
  return R;
}
/** Círculo do espaço de Pacto no nível atual. */
function slotPactoDe(cl) {
  const x = cl.find(k => k.id === 'warlock');
  return x ? CLASS_LEVELS.warlock[x.lv - 1].slots.findIndex(v => v) + 1 : 1;
}
const regraBonus = id => (CHAR.bonus || []).find(r => r.id === id);
function bonusMarcado(id) {
  const r = regraBonus(id) || (id === 'duasmaos' ? { padrao: false } : null), v = state.fx.on?.[id];
  return v === undefined ? !!r?.padrao : !!v;
}
const pactoLivre = () => Object.keys(CHAR.pactSlots || {}).find(l => (state.used[l] || 0) < CHAR.pactSlots[l]);
/** A regra pode valer agora? Só falta saber se serve para o ataque. */
function bonusLigado(r) {
  if (r.uma && state.fx.usado?.[r.id]) return false;
  if (r.modo === 'marca' && !bonusMarcado(r.id) && !(r.conc && state.conc === r.conc)) return false;
  if (r.requer && !r.requer(state)) return false;
  if (r.res && (state.res[r.res] ?? 0) < 1) return false;
  if (r.pacto && !pactoLivre()) return false;
  return true;
}
const descBonus = r => r.info || r.dado?.replace('-', '−').replace('+', ' + ') || (r.mod ? sign(r.mod) : r.atk ? `${sign(r.atk)} ataque` : r.crit ? `crítico em ${r.crit}+` : '');

function bonusDeAtaque(a) {
  const lista = (CHAR.bonus || []).filter(r => !r.magia && r.vale(a) && bonusLigado(r)), soma = k => lista.reduce((t, r) => t + (r[k] || 0), 0);
  return {
    lista, atk: soma('atk'), mod: soma('mod'), adv: lista.some(r => r.adv) && !lista.some(r => r.semVant), gwf: lista.some(r => r.gwf), melhor: lista.some(r => r.melhor),
    crit: Math.min(20, ...lista.map(r => r.crit || 20)), dados: lista.filter(r => r.dado).map(r => ({ ...parseDice(r.dado), nome: r.nome, tipo: r.tipo || null }))
  };
}
/** Dano final de uma arma da Ficha, com os bônus de agora. */
function danoDeArma(w) {
  const B = bonusDeAtaque(w), p = parseDice(w.dmg), f = w.versatil && bonusMarcado('duasmaos') ? parseDice(w.versatil).f : p.f, mod = p.mod + B.mod;
  return { ...B, expr: `${p.n}d${f}${modDe(mod)}` };
}
const textoDano = D => [showDice(D.expr), ...D.dados.map(x => showDice(`${x.n}d${x.f}${modDe(x.mod)}`))].join(' + ');
const mediaDano = D => avgOf(D.expr) + D.dados.reduce((t, x) => t + x.n * (x.f + 1) / 2 + x.mod, 0);

/** O que uma magia ganha. cadaAlvo soma em toda instância; os demais, em uma só jogada. */
function bonusDeMagia(s, tipoDe) {
  return (CHAR.bonus || []).filter(r => r.magia && r.valeMagia(s) && (r.modo !== 'marca' || bonusMarcado(r.id))).map(r => {
    const tipos = r.opcoes ? [state.fx.on?.[r.id]].filter(x => typeof x === 'string') : r.tipos;
    return { ...r, casa: g => !g.aux && (!tipos ? !g.heal : (r.curaTambem && g.heal) || tipos.some(t => tipoDe(g).includes(t))) };
  });
}

/** Marca o que foi usado depois de o dano entrar. */
function gastarBonus(lista) {
  const usados = lista.filter(r => r.uma || r.res || r.pacto || r.solta);
  if (!usados.length) return;
  commit(null, st => {
    for (const r of usados) {
      if (r.uma) st.fx.usado[r.id] = true;
      if (r.res) st.res[r.res] = Math.max(0, st.res[r.res] - 1);
      if (r.pacto) { const l = pactoLivre(); if (l) st.used[l]++; }
      if (r.solta) delete st.fx.on[r.id];
    }
  });
}
function novoTurno() {
  commit('Novo turno: bônus liberados', st => {
    st.fx.usado = {};
    for (const r of CHAR.bonus || []) if (r.turno) delete st.fx.on[r.id];
  }, { undo: false });
}
function alternarBonus(id) {
  const r = regraBonus(id) || { id: 'duasmaos' };
  commit(null, st => {
    if (r.opcoes) {
      const lista = [undefined, ...r.opcoes], i = lista.indexOf(st.fx.on[id]), v = lista[(i + 1) % lista.length];
      if (v === undefined) delete st.fx.on[id]; else st.fx.on[id] = v;
    } else st.fx.on[id] = !bonusMarcado(id);
  });
}
