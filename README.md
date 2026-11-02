# ❄️ Søren Frostgaard — Grimório Interativo

Ficha de controle de **magias e recursos limitados** para **Søren Frostgaard**, Golias (Gigante das Nuvens) **Feiticeiro Dracônico de nível 4** em **D&D 2024 (5.5)**.

É um web app em **um único arquivo HTML** (CSS e JavaScript embutidos), com tema escuro medieval-glacial, pensado para uso **no celular durante a sessão** e também no computador.

> CD de Magia **14** (15 com Feitiçaria Inata) · Ataque Mágico **+6** · Carisma **18 (+4)** · CA **16** (21 com Escudo Arcano) · PV **30**

---

## ✨ Funcionalidades

### 💎 Espaços de Magia
- Gemas clicáveis por círculo: **1º círculo (4)** e **2º círculo (3)**. Um toque gasta e outro recupera.
- **Fonte de Magia**: converte espaços em Pontos de Feitiçaria e cria espaços com PF (2 PF → 1º, 3 PF → 2º). Os espaços criados aparecem em **dourado** e somem no Descanso Longo.
- **Descanso Longo**: mostra antes o que vai voltar e recupera espaços, recursos, PV e Dados de Vida.
- **Descanso Curto**: gasta Dados de Vida (1d6 + 2), com rolagem automática ou pelo resultado de um dado físico.

### 📖 Grimório
- 5 truques, 7 magias preparadas e 4 magias dracônicas, organizados por círculo.
- **Busca instantânea** (ignora acentos) e filtros: *Truques*, *1º*, *2º*, *Concentração*, *Sem concentração* e *Dracônicas*.
- Ao tocar numa magia, um modal mostra **Tempo de Conjuração, Alcance, Componentes, Duração**, a descrição completa, a regra para círculos superiores e uma **dica tática** da ficha.
- O botão **Conjurar** gasta o espaço certo (com opção de conjurar em círculo maior) e, se você marcar uma **Metamagia**, gasta os PF junto.

### ⚔️ Efeitos ativos (barra fixa no topo)
- **Concentração**: mostra a magia mantida, encerra a anterior ao conjurar outra e tem um **teste de concentração** (CD automática, 2d20 + 4 por causa do Conjurador Bélico).
- **Feitiçaria Inata**: a CD sobe para 15 e o cabeçalho indica Vantagem nos ataques.
- **Escudo Arcano**: a CA vai para 21 no cabeçalho.
- **Reflexos**: as 3 duplicatas aparecem para você riscar quando forem destruídas.

### 🔥 Recursos de classe
- Contadores com **+ / −** e gemas para Pontos de Feitiçaria (4), Feitiçaria Inata (2), Salto das Nuvens (2), Pontos de Sorte (2) e Dados de Vida (4d6).
- Controle de **PV**: dano (absorvido primeiro pelos PV temporários, com teste de concentração automático), cura e PV temporários.
- Metamagia (**Acelerada** e **Sutil**) e um resumo dos traços passivos.

### 🎒 Mochila
- Consumíveis com **+ / −**: poções, tochas, rações, óleo e mais.
- Você pode adicionar, editar e excluir itens.

### 💾 Persistência
- Tudo fica salvo automaticamente no **`localStorage`** do navegador e é restaurado ao reabrir a página.
- **Desfazer** em toda ação (botão no aviso ou `Ctrl+Z`).
- Menu **⋮** para **exportar/importar backup (.json)** e restaurar a ficha original.

---

## 🚀 Como usar

1. Baixe o arquivo [`index.html`](index.html) e abra no navegador. Funciona offline; as fontes são opcionais.
2. **No celular:** publique com **GitHub Pages** (*Settings → Pages → Deploy from branch*) e abra o link. Use *"Adicionar à tela inicial"* para abrir como um app.

> ⚠️ O progresso fica salvo **por navegador e por dispositivo**. Para passar de um aparelho para outro, use *Exportar / Importar backup*.

### Atalhos de teclado (desktop)
| Tecla | Ação |
| :--- | :--- |
| `/` | Abre o grimório e foca a busca |
| `Ctrl/⌘ + Z` | Desfaz a última ação |
| `Esc` | Fecha o modal ou o menu |
| `← / →` | Troca de aba (com o foco nas abas) |

---

## 🛠️ Personalização

Todos os dados ficam no início do `<script>`, em `index.html`:

- **`CHAR`**: atributos, espaços por círculo, recursos (nome, máximo, descrição), metamagias, traços passivos e itens iniciais da mochila.
- **`SPELLS`**: lista de magias. Cada uma tem `name`, `en`, `level`, `school`, `time`, `range`, `comp`, `dur`, `conc`, `desc`, `higher`/`upgrade` e `tactic`.

Ao subir de nível, basta editar esses objetos, por exemplo `slots: { 1: 4, 2: 3, 3: 2 }` no nível 5. Se mudar a estrutura dos dados, troque também `storageKey` para começar com um estado limpo.

---

## 📜 Notas de regras (D&D 2024)

- **Descanso Longo** recupera **todos** os Dados de Vida (mudança de 2024; em 2014 era metade).
- **Teia** ocupa um **Cubo de 6 m** (não uma esfera).
- Feiticeiro nível 4 **não** recupera recursos no Descanso Curto. A *Restauração Feiticeira* chega no nível 5.
- **Orbe Cromático** exige um diamante de 50 PO, que nem o foco arcano nem a Magia Sutil substituem.

---

## ⚖️ Aviso legal

Projeto de fã, sem fins lucrativos. *Dungeons & Dragons* e os nomes de magias e regras pertencem à **Wizards of the Coast**. As descrições foram **resumidas e parafraseadas** para uso pessoal em mesa. Consulte o *Livro do Jogador* para o texto oficial.

Código sob a licença [MIT](LICENSE).
