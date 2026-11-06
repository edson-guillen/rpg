/* =====================================================================
   CONTEÚDO DE REGRAS (D&D 2024)
   Resumos com palavras próprias, conferidos com o Livro do Jogador 2024.
   Os nomes seguem o livro em português.
   ===================================================================== */
const ATTR = [['FOR', 'Força'], ['DES', 'Destreza'], ['CON', 'Constituição'], ['INT', 'Inteligência'], ['SAB', 'Sabedoria'], ['CAR', 'Carisma']];
const SKILLS = [['Acrobacia', 'DES'], ['Lidar com Animais', 'SAB'], ['Arcanismo', 'INT'], ['Atletismo', 'FOR'], ['Atuação', 'CAR'], ['Enganação', 'CAR'], ['Furtividade', 'DES'], ['História', 'INT'], ['Intimidação', 'CAR'], ['Intuição', 'SAB'], ['Investigação', 'INT'], ['Medicina', 'SAB'], ['Natureza', 'INT'], ['Percepção', 'SAB'], ['Persuasão', 'CAR'], ['Prestidigitação', 'DES'], ['Religião', 'INT'], ['Sobrevivência', 'SAB']];
const SORCERER_SKILLS = ['Arcanismo', 'Enganação', 'Intimidação', 'Intuição', 'Persuasão', 'Religião'];
const ASI_LEVELS = [4, 8, 12, 16], SLOT_COST = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };
const metamagicKnown = n => (n >= 17 ? 6 : n >= 10 ? 4 : n >= 2 ? 2 : 0);

const SPECIES = [
  { id: 'dragonborn', name: 'Draconato', speed: 30, traits: [['Herança Dracônica', 'Escolha um tipo de dragão: ele define o elemento do sopro e da resistência.'], ['Ataque de Sopro', 'Troca um ataque por um Cone ou uma Linha de energia. Os usos são iguais ao Bônus de Proficiência.'], ['Resistência a Dano', 'Resistência ao elemento da sua ancestralidade.'], ['Visão no Escuro', 'Enxerga no escuro até 18 m.'], ['Voo Dracônico', 'A partir do nível 5, asas espectrais dão Deslocamento de voo por 10 minutos, uma vez por Descanso Longo.']] },
  { id: 'dwarf', name: 'Anão', speed: 30, traits: [['Visão no Escuro', 'Enxerga no escuro até 36 m.'], ['Resistência a Toxinas', 'Resistência a dano Venenoso e Vantagem contra a condição Envenenado.'], ['Tenacidade Anã', 'Ganha 1 PV máximo por nível.'], ['Conhecimento de Pedras', 'Ação Bônus para ganhar Sismiconsciência de 18 m por 10 minutos ao tocar em pedra.']] },
  { id: 'elf', name: 'Elfo', speed: 30, traits: [['Visão no Escuro', 'Enxerga no escuro até 18 m.'], ['Ancestralidade Feérica', 'Vantagem contra a condição Enfeitiçado.'], ['Linhagem Élfica', 'Escolha Drow, Alto Elfo ou Elfo Silvestre, que dão magias e benefícios próprios.'], ['Sentidos Aguçados', 'Proficiência em Intuição, Percepção ou Sobrevivência.'], ['Transe', 'Descanso Longo em 4 horas de transe.']] },
  { id: 'gnome', name: 'Gnomo', speed: 30, traits: [['Visão no Escuro', 'Enxerga no escuro até 18 m.'], ['Astúcia de Gnomo', 'Vantagem em salvaguardas de Inteligência, Sabedoria e Carisma.'], ['Linhagem Gnômica', 'Gnomo do Bosque ou das Rochas, com truques e magias próprios.']] },
  { id: 'goliath', name: 'Golias', speed: 35, traits: [['Ancestralidade Gigante', 'Escolha um gigante ancestral. Ele dá um benefício sobrenatural com usos iguais ao Bônus de Proficiência, por Descanso Longo.'], ['Forma Grande', 'A partir do nível 5, Ação Bônus para virar Grande por 10 minutos, uma vez por Descanso Longo, com Vantagem em testes de Força e +3 m de Deslocamento.'], ['Porte Poderoso', 'Vantagem para encerrar a condição Imobilizado e conta como um tamanho maior para carga.']],
    lineages: { cloud: ['Gigante das Nuvens', 'Salto da Nuvem: Ação Bônus para se teleportar até 9 m.'], fire: ['Gigante de Fogo', 'Queimadura de Fogo: ao acertar, causa 1d10 extra de dano Ígneo.'], frost: ['Gigante do Gelo', 'Arrepio do Gelo: ao acertar, causa 1d6 extra de dano Gélido e reduz em 3 m o Deslocamento do alvo.'], hill: ['Gigante da Colina', 'Tombo da Colina: ao acertar, derruba um alvo Grande ou menor.'], stone: ['Gigante da Pedra', 'Resistência da Pedra: Reação para reduzir o dano sofrido.'], storm: ['Gigante da Tempestade', 'Trovão da Tempestade: Reação para causar 1d8 Trovejante a quem o atingiu.'] } },
  { id: 'halfling', name: 'Pequenino', speed: 30, traits: [['Corajoso', 'Vantagem contra a condição Amedrontado.'], ['Agilidade Pequenina', 'Atravessa o espaço de criaturas maiores.'], ['Sorte', 'Pode jogar de novo um 1 no d20 de um Teste de D20.'], ['Furtividade Natural', 'Pode se esconder atrás de criaturas maiores.']] },
  { id: 'human', name: 'Humano', speed: 30, traits: [['Eficiente', 'Ganha Inspiração Heroica ao terminar um Descanso Longo.'], ['Hábil', 'Proficiência em uma perícia à escolha.'], ['Versátil', 'Um talento de origem à escolha.']] },
  { id: 'orc', name: 'Orc', speed: 30, traits: [['Pico de Adrenalina', 'Ação Bônus para Correr e ganhar PV temporários, com usos iguais ao Bônus de Proficiência.'], ['Visão no Escuro', 'Enxerga no escuro até 36 m.'], ['Vigor Implacável', 'Uma vez por Descanso Longo, cai para 1 PV em vez de 0.']] },
  { id: 'tiefling', name: 'Tiferino', speed: 30, traits: [['Visão no Escuro', 'Enxerga no escuro até 18 m.'], ['Legado Ínfero', 'Escolha Abissal, Ctônico ou Infernal, que dão resistência e magias próprias.'], ['Presença Sobrenatural', 'Conhece o truque Taumaturgia.']] }
];
const BACKGROUNDS = [
  { id: 'acolyte', name: 'Acólito', attrs: ['INT', 'SAB', 'CAR'], feat: 'magic-initiate', skills: ['Intuição', 'Religião'], tool: 'Suprimentos de Calígrafo', desc: 'Você serviu num templo e aprendeu seus ritos.' },
  { id: 'criminal', name: 'Criminoso', attrs: ['DES', 'CON', 'INT'], feat: 'alert', skills: ['Prestidigitação', 'Furtividade'], tool: 'Ferramentas de Ladrão', desc: 'Você viveu de golpes, roubos e contatos nas sombras.' },
  { id: 'sage', name: 'Sábio', attrs: ['CON', 'INT', 'SAB'], feat: 'magic-initiate', skills: ['Arcanismo', 'História'], tool: 'Suprimentos de Calígrafo', desc: 'Você passou anos entre bibliotecas e mestres.' },
  { id: 'soldier', name: 'Soldado', attrs: ['FOR', 'DES', 'CON'], feat: 'savage-attacker', skills: ['Atletismo', 'Intimidação'], tool: 'Kit de Jogos', desc: 'Você treinou para a guerra e conhece a vida de quartel.' },
  { id: 'wayfarer', name: 'Andarilho', attrs: ['DES', 'SAB', 'CAR'], feat: 'lucky', skills: ['Intuição', 'Furtividade'], tool: 'Ferramentas de Ladrão', desc: 'Você cresceu pelas estradas, sobrevivendo com astúcia.' }
];
const FEATS = [
  { id: 'alert', name: 'Alerta', cat: 'origem', desc: 'Soma o Bônus de Proficiência à Iniciativa e pode trocar de Iniciativa com um aliado.' },
  { id: 'magic-initiate', name: 'Iniciado em Magia', cat: 'origem', desc: 'Aprende dois truques e uma magia de 1º círculo de uma lista de classe.' },
  { id: 'savage-attacker', name: 'Atacante Selvagem', cat: 'origem', desc: 'Uma vez por turno, rola os dados de dano da arma duas vezes e usa o melhor.' },
  { id: 'skilled', name: 'Habilidoso', cat: 'origem', desc: 'Ganha proficiência em três perícias ou ferramentas à escolha.' },
  { id: 'lucky', name: 'Sortudo', cat: 'origem', desc: 'Ganha Pontos de Sorte iguais ao Bônus de Proficiência para ter Vantagem ou impor Desvantagem.' },
  { id: 'war-caster', name: 'Conjurador Bélico', cat: 'geral', min: 4, desc: 'Vantagem para manter Concentração, conjura com as mãos ocupadas e pode responder com magia a um ataque de oportunidade.' },
  { id: 'grappler', name: 'Imobilizador', cat: 'geral', min: 4, desc: 'Ataca e imobiliza com mais facilidade e move-se sem penalidade com quem imobilizou.' },
  { id: 'asi', name: 'Aumento no Valor de Atributo', cat: 'geral', min: 4, desc: '+2 em um atributo ou +1 em dois, até o máximo de 20.' },
  { id: 'archery', name: 'Arquearia', cat: 'estilo', desc: '+2 nas jogadas de ataque à distância com armas.' },
  { id: 'defense', name: 'Defensivo', cat: 'estilo', desc: '+1 na CA usando armadura.' },
  { id: 'great-weapon-fighting', name: 'Combate com Armas Grandes', cat: 'estilo', desc: 'Dados de dano 1 e 2 contam como 3 em armas de duas mãos.' },
  { id: 'two-weapon-fighting', name: 'Combate com Duas Armas', cat: 'estilo', desc: 'Soma o modificador ao dano do ataque extra.' },
  { id: 'boon-combat-prowess', name: 'Dádiva da Proeza em Combate', cat: 'dadiva', min: 19, desc: 'Uma vez por turno, transforma um ataque errado em acerto.' },
  { id: 'boon-dimensional-travel', name: 'Dádiva da Viagem Dimensional', cat: 'dadiva', min: 19, desc: 'Teleporta-se 9 m depois de atacar ou conjurar.' },
  { id: 'boon-fate', name: 'Dádiva do Destino', cat: 'dadiva', min: 19, desc: 'Soma ou subtrai 2d4 de um Teste de D20 próximo.' },
  { id: 'boon-irresistible-offense', name: 'Dádiva do Ataque Irresistível', cat: 'dadiva', min: 19, desc: 'Seus ataques ignoram Resistência e um 20 natural causa dano extra.' },
  { id: 'boon-spell-recall', name: 'Dádiva da Recordação de Magia', cat: 'dadiva', min: 19, desc: 'Às vezes conjura sem gastar o espaço de magia.' },
  { id: 'boon-night-spirit', name: 'Dádiva do Espírito da Noite', cat: 'dadiva', min: 19, desc: 'Fica Invisível na penumbra e resiste a quase todo dano nela.' },
  { id: 'boon-truesight', name: 'Dádiva da Visão Verdadeira', cat: 'dadiva', min: 19, desc: 'Ganha Visão Verdadeira até 18 m.' }
];
const METAMAGIC = [
  { id: 'careful', name: 'Magia Cautelosa', en: 'Careful Spell', cost: 1, icon: 'i-shield', desc: 'Protege criaturas à escolha do efeito de uma magia com salvaguarda.', when: 'Para lançar área perto de aliados.' },
  { id: 'distant', name: 'Magia Distante', en: 'Distant Spell', cost: 1, icon: 'i-spark', desc: 'Dobra o alcance da magia, ou dá 9 m a uma magia de Toque.', when: 'Para atingir de longe.' },
  { id: 'empowered', name: 'Magia Potencializada', en: 'Empowered Spell', cost: 1, icon: 'i-flame', desc: 'Rola de novo alguns dados de dano e fica com os novos resultados.', when: 'Depois de uma rolagem fraca.' },
  { id: 'extended', name: 'Magia Persistente', en: 'Extended Spell', cost: 1, icon: 'i-moon', desc: 'Dobra a duração, até 24 horas, e dá Vantagem para manter a Concentração.', when: 'Em magias longas de controle.' },
  { id: 'heightened', name: 'Magia Agravada', en: 'Heightened Spell', cost: 2, icon: 'i-gem', desc: 'Um alvo tem Desvantagem na salvaguarda contra a magia.', when: 'Contra o alvo mais perigoso.' },
  { id: 'quick', name: 'Magia Acelerada', en: 'Quickened Spell', cost: 2, icon: 'i-bolt', desc: 'Uma magia de 1 Ação passa a ser conjurada como Ação Bônus.', when: 'Para agir duas vezes no turno.' },
  { id: 'seeking', name: 'Magia Buscadora', en: 'Seeking Spell', cost: 1, icon: 'i-eye', desc: 'Rola de novo um ataque mágico que errou.', when: 'Depois de errar um ataque importante.' },
  { id: 'subtle', name: 'Magia Sutil', en: 'Subtle Spell', cost: 1, icon: 'i-hush', desc: 'Conjura sem componentes Verbais, Somáticos ou Materiais sem custo.', when: 'Para conjurar sem ser percebido.' },
  { id: 'transmuted', name: 'Magia Transmutada', en: 'Transmuted Spell', cost: 1, icon: 'i-flame', desc: 'Troca o tipo de dano da magia entre Ácido, Elétrico, Gélido, Ígneo, Trovejante e Venenoso.', when: 'Contra resistências.' },
  { id: 'twinned', name: 'Magia Duplicada', en: 'Twinned Spell', cost: 1, icon: 'i-spark', desc: 'A magia ganha um alvo adicional ao ser ampliada em um círculo.', when: 'Para dobrar buffs e controle.' }
];
const SORCERER_FEATURES = [
  [1, 'Conjuração', 'Conjura magias de Feiticeiro usando Carisma.'], [1, 'Feitiçaria Inata', 'Ação Bônus para somar +1 à CD e ter Vantagem em ataques de magia por 1 minuto, duas vezes por Descanso Longo.'],
  [2, 'Fonte de Magia', 'Pontos de Feitiçaria iguais ao nível, que viram espaços de magia e vice-versa.'], [2, 'Metamagia', 'Escolhe 2 opções para moldar magias; mais 2 nos níveis 10 e 17.'],
  [3, 'Subclasse de Feiticeiro', 'Escolhe a origem do seu poder.'], [4, 'Aumento no Valor de Atributo', 'Aumenta atributos ou escolhe um talento. Repete nos níveis 8, 12 e 16.'],
  [5, 'Restauração Feiticeira', 'Em um Descanso Curto, recupera Pontos de Feitiçaria iguais à metade do nível, uma vez por Descanso Longo.'], [7, 'Feitiçaria Encarnada', 'Com a Feitiçaria Inata ativa, pode usar até duas Metamagias por magia; gasta 2 PF para ativá-la sem usos.'],
  [10, 'Metamagia adicional', 'Conhece mais 2 opções de Metamagia.'], [17, 'Metamagia adicional', 'Conhece mais 2 opções de Metamagia.'],
  [19, 'Dádiva Épica', 'Escolhe uma Dádiva Épica.'], [20, 'Apoteose Arcana', 'Com a Feitiçaria Inata ativa, uma Metamagia por turno sai sem custo de PF.']
];
const DRACONIC_FEATURES = [
  [3, 'Resiliência Dracônica', '+3 PV máximos, mais 1 por nível, e CA sem armadura = 10 + DES + CAR.'], [3, 'Magias Dracônicas', 'Alterar-se, Orbe Cromático, Comando e Sopro de Dragão sempre preparadas.'],
  [5, 'Magias Dracônicas', 'Medo e Voo sempre preparadas.'], [6, 'Afinidade Elemental', 'Escolha Ácido, Elétrico, Gélido, Ígneo ou Venenoso: Resistência a ele e soma Carisma a uma jogada de dano de magia desse tipo.'],
  [7, 'Magias Dracônicas', 'Olho Arcano e Enfeitiçar Monstro sempre preparadas.'], [9, 'Magias Dracônicas', 'Lendas e Histórias e Invocar Dragão sempre preparadas.'],
  [14, 'Asas de Dragão', 'Ação Bônus para ganhar Deslocamento de Voo de 18 m por 1 hora. Volta no Descanso Longo ou gastando 3 PF.'], [18, 'Companheiro Dracônico', 'Conjura Invocar Dragão sem componente Material e, uma vez por Descanso Longo, sem espaço de magia; pode dispensar a Concentração, com duração de 1 minuto.']
];
const DRACONIC_SPELLS = { 3: ['alter-self', 'chromatic-orb', 'command', 'dragons-breath'], 5: ['fear', 'fly'], 7: ['arcane-eye', 'charm-monster'], 9: ['legend-lore', 'summon-dragon'] };
const STARTING_GEAR = {
  a: { label: 'Lança, 2 Adagas, Foco Arcano, Kit de Explorador de Masmorras e 28 PO', items: [['Lança', 1, 'arm'], ['Adaga', 2, 'arm'], ['Foco Arcano', 1, 'arm'], ['Kit de Explorador de Masmorras', 1, 'eq'], ['Peças de Ouro', 28, 'cons']] },
  b: { label: '50 PO para comprar o que quiser', items: [['Peças de Ouro', 50, 'cons']] }
};
const speciesById = id => SPECIES.find(s => s.id === id) || privateCatalog().especies.find(s => s.id === id);
const backgroundById = id => BACKGROUNDS.find(b => b.id === id) || privateCatalog().antecedentes.find(b => b.id === id);
const featById = id => allFeats().find(f => f.id === id);
