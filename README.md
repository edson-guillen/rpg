# ❄️ Søren Frostgaard — Grimório Interativo

Ficha de controle de **magias e recursos limitados** para **Søren Frostgaard**, Golias (Gigante das Nuvens) **Feiticeiro Dracônico de nível 4** em **D&D 2024 (5.5)**.

É um web app em **um único arquivo HTML** (CSS e JavaScript embutidos), com tema escuro medieval-glacial e animações em [GSAP](https://gsap.com), pensado para uso **no celular durante a sessão** e também no computador.

🔗 **https://edson-guillen.github.io/rpg/**

> CD de Magia **14** (15 com Feitiçaria Inata) · Ataque Mágico **+6** · Carisma **18 (+4)** · CA **16** (21 com Escudo Arcano) · PV **30**

---

## ✨ Funcionalidades

### 📜 Ficha (atributos e somas)
- **Atributos e salvaguardas** com valor, modificador e proficiência (CON +4 com Vantagem em Concentração, CAR +6). Toque para rolar o teste ou a salvaguarda.
- **Somas e cálculos** mostrados por extenso: CA 16 = 10 + DES 2 + CAR 4; CD 14 = 8 + BP 2 + CAR 4; Ataque +6 = BP 2 + CAR 4; PV 30; carga máxima de 120 kg (Constituição Poderosa).
- **Ataques e armas** com acerto e dano exatos, prontos para rolar:

  | Ataque | Acerto | Dano |
  | :--- | :---: | :--- |
  | Golpe Certeiro + Lança (1 / 2 mãos) | +6 | 1d6 + 4 / 1d8 + 4 Perfurante ou Radiante |
  | Golpe Certeiro + Adaga | +6 | 1d4 + 4 Perfurante ou Radiante |
  | Adaga | +4 | 1d4 + 2 Perfurante |
  | Lança (1 / 2 mãos) | +1 | 1d6 − 1 / 1d8 − 1 Perfurante |
  | Armas Naturais (Alterar-se) | +6 | 1d6 + 4 |

- **Perícias** (18) e Ferramentas de Ladrão com o bônus calculado.

### 🎲 Rolagens
- Botões de **ataque** e **dano** em cada arma e magia. Um pop-up mostra o total e cada dado rolado.
- Com **Feitiçaria Inata** ativa, os ataques de magia rolam com **Vantagem** automaticamente.
- Um **20 natural** num ataque faz a próxima rolagem de dano daquele ataque dobrar os dados (crítico).
- Regras especiais já incluídas: os 8 da *Explosão Elemental* explodem (até +4d8); no *Orbe Cromático*, dados iguais avisam que o orbe salta; o *Sopro de Dragão* mostra também a metade para quem passa na salvaguarda; em *Reflexos*, o botão **Rolar** rola 1d6 por cópia.

### 💎 Espaços de Magia
- Gemas clicáveis por círculo: **1º círculo (4)** e **2º círculo (3)**. Um toque gasta e outro recupera.
- **Pontos de Feitiçaria** (painel próprio, logo abaixo dos espaços):
  - Medidor com os 4 PF (gemas, **+ / −**) e "**com X PF você pode**": quantas vezes dá para usar cada Metamagia ou criar cada espaço.
  - **Metamagia** em cartões com custo, quando usar e botão **Usar**.
  - **Fonte de Magia** nos dois sentidos: espaço → PF (sem ação) e PF → espaço (Ação Bônus: 2 PF → 1º, 3 PF → 2º), com o motivo quando algo está bloqueado ("passaria do máximo de 4 PF", "faltam 1 PF"). Espaços criados aparecem em **dourado** e somem no Descanso Longo.
  - **Histórico de PF** com hora, ganho ou gasto, motivo e saldo (últimos 8), além de **regras rápidas** de 2024.
- **Descanso Longo**: mostra antes o que vai voltar e recupera espaços, recursos, PV e Dados de Pontos de Vida.
- **Descanso Curto**: gasta Dados de Pontos de Vida (1d6 + 2), com rolagem automática ou pelo resultado de um dado físico.

### 📖 Grimório
- 5 truques, 7 magias preparadas e 4 magias dracônicas, organizados por círculo.
- **Busca instantânea** (ignora acentos) e filtros: *Truques*, *1º*, *2º*, *Concentração*, *Sem concentração* e *Dracônicas*.
- Cada cartão já mostra os números: **ATQ +6**, **CD 14 · DES**, dados de dano.
- Ao tocar numa magia, um modal mostra **Tempo de Conjuração, Alcance, Componentes, Duração**, um quadro **Números e rolagens** (acerto, CD, dano com média e versão ampliada no 2º círculo), a descrição completa e uma **dica tática** da ficha.
- A **CD** nos textos acompanha a Feitiçaria Inata (14 → 15).
- O botão **Conjurar** gasta o espaço certo (com opção de conjurar em círculo maior) e, se você marcar uma **Metamagia**, gasta os PF junto. Só é possível marcar **uma Metamagia por magia** (regra 2024). Com **Magia Sutil**, os componentes do inventário não são descontados (o diamante continua obrigatório).

### ⚔️ Efeitos ativos (barra fixa no topo)
- **Concentração**: mostra a magia mantida, encerra a anterior ao conjurar outra e tem um **teste de concentração** (CD automática, 2d20 + 4 por causa do Conjurador Bélico).
- **Feitiçaria Inata**: a CD sobe para 15 e o cabeçalho indica Vantagem nos ataques.
- **Escudo Arcano**: a CA vai para 21 no cabeçalho.
- **Reflexos**: as 3 cópias aparecem para você riscar quando forem destruídas.

### 🔥 Recursos de classe
- Contadores com **+ / −** e gemas para Pontos de Feitiçaria (4), Feitiçaria Inata (2), Salto das Nuvens (2), Pontos de Sorte (2) e Dados de Pontos de Vida (4d6).
- Controle de **PV**: dano (absorvido primeiro pelos PV temporários, com teste de concentração automático), cura e PV temporários.
- Atalho **Fonte de Magia →** no cartão de PF e um resumo dos traços passivos.

### 🎒 Inventário exato
- **Componentes de conjuração** ligados às magias: Teia de Aranha (49), Pimenta Seca (19), Mel (1 cantil, ~100 usos), Lã (10 cm) e Diamante de 50 PO (0).
  - Ao conjurar *Teia*, *Sopro de Dragão*, *Sugestão* ou *Força Espectral*, 1 unidade é **descontada automaticamente**. Pelas regras de 2024 o foco arcano substitui esses componentes, então o desconto pode ser desmarcado na hora de conjurar.
  - O **Orbe Cromático** fica **bloqueado** enquanto o inventário tiver 0 diamantes.
- **Armas e foco**: Cetro com Cristal Lapidado (foco arcano), 1 Lança e 4 Adagas.
- **Consumíveis e moedas**: 53 PO, mais tochas, rações, óleo e estrepes do Kit de Explorador de Masmorras.
- **Equipamento**: Ferramentas de Ladrão, Kit de Explorador de Masmorras, Kit de Tarot, Capa da Ondulação, Medalha da Casa Frostgaard, Roupas de Viagem, 2 Algibeiras e Saco de Dormir.
- Itens podem ser adicionados, editados, recategorizados ou excluídos.

### 📝 Anotações
- Aba **Notas** com um editor de texto: **títulos** (T1 e T2), **negrito**, *itálico*, sublinhado, tachado, listas com marcadores e numeradas, citações, separadores e limpar formatação, além de desfazer e refazer.
- Notas organizadas em **tópicos** (Sessões, NPCs, Lugares, Missões, Lore e Segredos, Geral). Em **⚙ Tópicos** você cria, renomeia, troca a cor ou apaga tópicos; as notas de um tópico apagado vão para outro.
- Filtro por tópico, **busca** no título e no texto (com o trecho encontrado destacado) e **alfinete** para fixar notas no topo.
- Uma nota nova em *Sessões* já vem com título "Sessão N — data".
- **Salvamento automático** enquanto você escreve (ou `Ctrl/⌘ + S`), com aviso "Salvo às…". Excluir uma nota ou um tópico tem **Desfazer**.
- No celular, a lista e o editor ocupam a tela um de cada vez; no computador, ficam lado a lado.
- Texto colado entra **sem formatação**, e o conteúdo salvo passa por uma limpeza que só mantém a formatação do editor (nada de scripts ou estilos externos).
- As anotações ficam num armazenamento separado da ficha: **Restaurar ficha original não as apaga**, e o backup do menu **⋮** as inclui.

### 🧙 Personagens
- Toque no **nome** no topo para trocar de personagem, criar um novo, duplicar, exportar ou excluir (com **Desfazer**).
- Cada personagem tem ficha, recursos, inventário e anotações próprios. As anotações podem ser do personagem ou da campanha, compartilhadas entre todos.
- **Treze classes e 53 subclasses:** as 12 do Livro do Jogador 2024 e o Artífice de Eberron: Forge of the Artificer, com recursos, Ações de classe, multiclasse, armaduras, armas e maestrias. Cada ação que gasta recurso ou rola dado usa a mesa de dados e tem cena própria.
- **Bônus de classe nos ataques:** Fúria, Ataque Furtivo, Frenesi, Golpes Radiantes, Estilos de Luta, crítico do Campeão, Artes Marciais, invocações e bônus de magia entram sozinhos no ataque e no dano. O que depende da situação fica em botões acima das armas, com controle de uma vez por turno.
- **Compêndio** na aba Personagem: características, armas e, com a biblioteca pessoal, textos integrais, subclasses antigas e itens mágicos.
- **Criação guiada** pelas regras de 2024: classe, espécie, antecedente, atributos (conjunto padrão, compra de pontos ou 4d6), perícias, talento, equipamento, magias e nível inicial.
- Por enquanto, só a classe **Feiticeiro** está disponível.

### 🎭 Aba Personagem
- Identidade editável, espécie, antecedente, talentos e linha do tempo das características.
- **Catálogo de talentos** para planejar a evolução e criar talentos próprios.
- **Subir de nível:** rolar 1d6, digitar o dado físico ou usar a média; ver o que muda; escolher aumento de atributo, talento, Metamagia e magias; revisar. Dá para **desfazer o último nível**.

### 📚 Biblioteca de magias
- As **339 magias do SRD 5.2** traduzidas para o português, com botão **Ver original**, separadas por **Truques e Círculos** e com nomes e termos conferidos com o Livro do Jogador 2024.
- Busca em português ou inglês e filtros por círculo, escola, classe, dano, concentração, ritual, tempo e fonte.
- **Editor de magias:** crie ou altere magias, com linhas de dano, escalonamento por círculo e por nível, tipos à escolha e **consumível vinculado** à mochila.
- **Biblioteca pessoal:** importe os dados gerados dos seus próprios livros. Eles ficam só neste navegador.
- As rolagens escalam por círculo, e os truques escalam pelo nível do personagem.

### ✨ Animação por magia
- Cada magia tem animação própria, com forma, cor do tipo de dano e assinatura gerada pelo nome.
- Quando a magia deixa escolher o tipo de dano, o app pergunta antes de animar e de rolar, e lembra a última escolha.
- No menu **⋮**: animações completas, reduzidas ou desligadas.

### 💾 Persistência
- Tudo fica salvo automaticamente no **`localStorage`** do navegador e é restaurado ao reabrir a página.
- Na primeira abertura desta versão, os dados antigos do Søren são copiados para o novo armazenamento (`grimorio-v3`). As chaves antigas continuam intactas como cópia de segurança.
- **Desfazer** em toda ação (botão no aviso ou `Ctrl+Z`).
- Menu **⋮** para **exportar/importar backup (.json)**, com ficha e anotações, e para restaurar a ficha original.

---

## 🌌 Visual e animações

Animações feitas com [GSAP](https://gsap.com) 3.12.5, carregado do cdnjs:

- **Ambiente:** aurora em movimento lento, neve sutil e textura granulada; título com gradiente de ouro para gelo.
- **Abertura:** o sigilo gira e o nome se revela; os cartões entram em sequência.
- **Abas:** um indicador desliza até a aba escolhida e o conteúdo entra em cascata.
- **Gemas:** ao gastar, a gema se estilhaça em faíscas; ao recuperar, renasce com um anel de luz. Os números contam até o novo valor.
- **Conjurar:** explosão de energia na cor do círculo da magia.
- **Dados:** os números giram antes de parar no resultado. O crítico solta faíscas douradas e a falha treme.
- **Dano e cura:** o valor flutua sobre o PV, que pisca em vermelho ou verde.
- **Descanso Longo:** tela de amanhecer antes de restaurar tudo.
- **Modais:** sobem como uma folha, com o conteúdo em cascata.

As animações ficam numa camada separada no fim do arquivo, que só envolve as funções do app. Sem internet para carregar o GSAP, ou com **"reduzir movimento"** ativado no sistema, tudo funciona igual, só que sem animação.

O antigo endereço `/beta/` redireciona para a página principal.

---

## 🚀 Como usar

1. Baixe o arquivo [`index.html`](index.html) e abra no navegador. Funciona offline; as fontes e as animações são opcionais. Para ter a Biblioteca, mantenha a pasta `data` junto dele. No site, o app guarda tudo para uso offline.
2. **No celular:** publique com **GitHub Pages** (*Settings → Pages → Deploy from branch*) e abra o link. Use *"Adicionar à tela inicial"* para abrir como um app.

> ⚠️ O progresso fica salvo **por navegador e por dispositivo**. Para passar de um aparelho para outro, use *Exportar / Importar backup*.

### Atalhos de teclado (desktop)
| Tecla | Ação |
| :--- | :--- |
| `/` | Abre o grimório e foca a busca |
| `Ctrl/⌘ + Z` | Desfaz a última ação (no editor de notas, desfaz o texto) |
| `Ctrl/⌘ + S` | Salva a anotação aberta na hora |
| `Ctrl/⌘ + B / I / U` | Negrito, itálico e sublinhado no editor de notas |
| `Esc` | Fecha o modal ou o menu |
| `← / →` | Troca de aba (com o foco nas abas) |

---

## 🛠️ Personalização

O `index.html` é **gerado**: não o edite direto. O código fica em `src/` e os dados do Søren em `src/data/soren.js`:

- **`CHAR`**: atributos, perícias, ataques, espaços por círculo, recursos, metamagias, traços passivos e o inventário inicial. No inventário, a `key` liga o item às magias.
- **`SPELLS`**: lista de magias com `time`, `range`, `comp`, `dur`, `conc`, `desc`, as rolagens em `r` (ataque, salvaguarda, dano, ampliação) e o componente rastreado em `mat`.

Ao subir de nível, basta editar esses objetos, por exemplo `slots: { 1: 4, 2: 3, 3: 2 }` no nível 5. Se mudar a estrutura dos dados, troque também `storageKey` para começar com um estado limpo.

---

## 🧰 Desenvolvimento

```bash
npm install
npm run build
npm test
```

- `npm run build` monta o `index.html` único a partir de `src/`.
- `npm run srd` normaliza o SRD e gera `data/library.js`, que a Biblioteca carrega sob demanda.
- `npm test` gera o app e testa o resultado em celular e desktop, com e sem GSAP.
- `npm run extract -- "<pasta dos livros>"` lê os seus PDFs e grava dados em `private/`, para uso pessoal. Essa pasta é ignorada pelo git: **nada dela pode ser publicado**.

---

## 📜 Notas de regras (D&D 2024)

- **Descanso Longo** recupera **todos** os Dados de Pontos de Vida (mudança de 2024; em 2014 era metade).
- **Teia** ocupa um **Cubo de 6 m** (não uma esfera).
- **Faca de Gelo**: quem passa na salvaguarda de DES não sofre os 2d6 de dano Gélido (não é "metade").
- **Força Espectral** causa **2d8** Psíquico por turno em 2024 (1d6 era a versão de 2014).
- No nível 4, truques e magias **não** somam Carisma ao dano. Só *Golpe Certeiro* e as armas naturais de *Alterar-se* somam.
- Feiticeiro nível 4 **não** recupera recursos no Descanso Curto. A *Restauração Feiticeira* chega no nível 5.
- **Orbe Cromático** exige um diamante de 50 PO, que nem o foco arcano nem a Magia Sutil substituem.

---

## ⚖️ Aviso legal

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

As magias da biblioteca são uma **tradução não oficial** do SRD 5.2, com pés convertidos em metros e pequenas adaptações. Algumas linhas de tabela ausentes no arquivo de origem foram completadas (Palavra Sagrada, Confusão, Rajada Prismática, Muralha Prismática, Vidência, Criação e Controlar o Clima).

Projeto de fã, sem fins lucrativos. *Dungeons & Dragons* e os nomes de magias e regras pertencem à **Wizards of the Coast**. As descrições foram **resumidas e parafraseadas** para uso pessoal em mesa. Consulte o *Livro do Jogador* para o texto oficial.

Código sob a licença [MIT](LICENSE).

## Cenas de magia e mesa de dados

Ao conjurar, a mesa de dados recebe os valores físicos dentro dos limites da magia: quantidade pelo círculo e pelo nível, ataques múltiplos, crítico, salvaguarda, dados que explodem e saltos do Orbe Cromático. Casa vazia é rolada pelo app.

Depois, a cena da magia toma a tela. As 340 cenas do SRD e do Søren foram escritas à mão em `src/fx/cenas.js`, com os verbos de `src/fx/cena-atos.js`. O tamanho vem do dano total e a força vem da sorte na rolagem. Um toque pula a cena.

- `npm run build` gera `data/fx-art.js` só com as silhuetas usadas pelas cenas.
- `npm run cenas` junta `private/cenas-pessoais.json` à biblioteca pessoal. Depois disso, importe o arquivo de novo no app.

As silhuetas das animações são do [Game-icons.net](https://game-icons.net), de Lorc, Delapouite e colaboradores, sob licença [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
