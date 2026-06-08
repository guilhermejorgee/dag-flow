# dag-flow

Uma arquitetura avançada de desenvolvimento orientado a especificações (SDD) para agentes autônomos. O **dag-flow** é um **Framework de Governança Cognitiva Autônomo**, financeiramente otimizado e estruturalmente resiliente.

---

## 1. O Problema: O Colapso dos SDDs Tradicionais

Os sistemas multiagentes e fluxos de Desenvolvimento Orientado a Especificações (SDD) tradicionais falham sistemicamente ao serem submetidos a projetos complexos. Mesmo quando utilizam múltiplos agentes, as arquiteturas clássicas sofrem de **acoplamento de estado e fluxo linear**, onde a inteligência central precisa gerenciar excessivamente os executores e compartilhar todo o contexto histórico. Isso causa:

- **Exaustão de Contexto e Preguiça Cognitiva:** Em fluxos tradicionais, subagentes frequentemente devolvem *logs* de erro brutos e *stack traces* diretamente para a janela de contexto do orquestrador. O acúmulo desse histórico satura a memória do agente principal, levando-o a ignorar diretrizes arquiteturais e burlar *gates* de qualidade (*Reward Hacking*).
- **Vulnerabilidade Epistêmica:** Modelos tradicionais aceitam requisitos vagos com complacência. Como as tarefas não são isoladas matematicamente, eles preenchem lacunas lógicas com alucinações probabilísticas estruturais que resultam em falhas catastróficas apenas em fases avançadas (integração e compilação).
- **Caos de Sincronização (Race Conditions):** O uso de listas lineares de tarefas para subagentes permite que um modelo tente processar uma implementação cuja dependência ainda está sendo construída por outro, gerando retrabalho e impasses (*deadlocks*).

## 2. A Fundação Neurocognitiva (O Paradigma dag-flow)

Para superar essas deficiências, o **dag-flow** abandona o monólito e implementa um modelo inspirado na neurociência cognitiva, focado na separação estrita entre controle executivo e função motora:
- **O Córtex Pré-Frontal (Controle Executivo):** O Orquestrador atua puramente na análise sistêmica, governança e decomposição arquitetural. Seu acesso motor a arquivos fonte é **fisicamente revogado**. Ele raciocina e planeja.
- **O Sistema Motor (Execução):** O trabalho braçal é despachado para subagentes "burros", apátridas (*stateless*) e amnésicos, que recebem diretivas atômicas e permissão estrita apenas de I/O. Eles nascem, alteram o código e morrem.

---

## 3. Filosofia e Governança Universal

O sistema não opera por tentativa e erro livre, mas através de inibição rigorosa e orquestração socrática:

- **Interrogação Socrática (O Analista Adversarial):** O Orquestrador atua com um questionamento incisivo (busca em profundidade) para erradicar ambiguidades antes de gerar código. Ele esgota a árvore de decisões validando interdependências e exigindo confirmação de calibração matemática de certeza antes de formular premissas.
- **PAGRL (Pre-Action Governance Reasoning Loop):** Mecanismo inibitório obrigatório. Força o modelo a declarar, através de um *trace* explícito, sua intenção e confrontá-la com as regras sistêmicas antes de agir.
- **Inibição Física (Shadow LLM):** Um juiz-sombra ultraleve roda em paralelo para impedir evasões. Se o Orquestrador tentar modificar código de produção antecipadamente, a ação é barrada no nível operacional (*bash*).

---

## 4. Ecossistema de Memória e Ciclo de Vida dos Artefatos

O dag-flow abandona a efemeridade do chat em prol de uma "Biblioteca da Verdade" no sistema de arquivos, dividindo o conhecimento entre o que é **coordenação temporária** e o que é **jurisprudência eterna**.

**⏳ Memória Transacional (Ação Operacional):**
- **O Diretório de Coordenação (`.specs/features/*/`):** Artefatos como `spec.md`, `design.md` e `tasks.md` são os rascunhos operacionais. Eles coordenam a ação pontual do momento. Após a funcionalidade ser executada com sucesso, esses arquivos perdem sua utilidade ativa. O sistema não sobrecarrega sua memória futura lendo tarefas velhas.

**💎 Memória Perene (A Lei do Sistema):**
- **O Dicionário de Linguagem Ubíqua (`CONTEXT.md`):** Um glossário estrito gerado dinamicamente. Elimina ruídos semânticos proibindo sinônimos através de gatilhos inibitórios (*Avoid:*).
- **Registros de Decisão (`.docs/adr/`):** Documentação imutável gerada de forma *lazy*. Justifica o "porquê" de escolhas arquiteturais complexas.
- **Sobrevivência:** Esses artefatos ficam persistidos **para sempre**. Em futuras interações, o agente e o auditor consultarão o `CONTEXT.md` e os antigos `ADRs` para garantir que novas *features* não quebrem a linguagem e a arquitetura estabelecidas no passado.

*(Obs: O processo de criação é simbiótico. Enquanto o agente especifica a funcionalidade no `spec.md`, ele retroalimenta o `CONTEXT.md` em tempo real. Enquanto ele arquiteta o `design.md`, ele gera novos `ADRs`. E somente no final, ancorado por essas leis, ele constrói o DAG no `tasks.md`.)*
- **Harness de Otimização e Virtualização:** O dag-flow opera encapsulado em uma suíte rigorosa de ferramentas (*harness*) desenvolvida para blindar a janela de contexto do LLM:
  - **rtk-ai (Rust Token Killer):** Um *proxy* CLI transparente que intercepta e comprime as saídas de comandos operacionais do terminal (testes, logs) antes que cheguem à mente do modelo.
  - **caveman:** Protocolo de restrição sintática (verbosidade zero) utilizado nos artefatos vitais para economizar agressivamente o *overhead* gramatical passivo.
  - **context-mode:** Camada de virtualização MCP que proíbe o agente de ler *dumps* massivos. Força o modelo a "Pensar em Código" (*sandbox scripts*), extraindo resumos cirúrgicos indexados (FTS5) e reduzindo a poluição do contexto em até 98%.
  - **agentmemory:** Interface de persistência abstrata que gere a recuperação de observações passadas e decisões sistêmicas sem abarrotar o hipocampo efêmero do orquestrador.
  - **Sincronização Multi-Dev (Automated Onboarding):** Como `context-mode` e `agentmemory` são bancos locais na máquina do desenvolvedor, quando um novo membro clona o repositório, seu Orquestrador inicia "cego". Essa ausência de memória aciona a Fase **Map** localmente, que escaneia o código e lê a jurisprudência do git (`CONTEXT.md` e `docs/adr/`). Isso popula imediatamente o *harness* local do novo membro com as regras do time, sincronizando a equipe perfeitamente sem intervenção humana.

---

## 5. Consolidado Arquitetural: O Motor de Execução

- **DAG Runner (`run_dag.sh`):** O Orquestrador condensa seu plano em um Grafo Acíclico Direcionado (DAG). A execução descentralizada é coordenada por este *script* Bash que invoca *workers* em paralelo respeitando as dependências do nó.
- **Firewall Financeiro:** O isolamento cirúrgico restringe o LLM temporário apenas aos `Input Files` listados no DAG, proibindo escaneamentos massivos com *wildcards*, tornando o ciclo altamente viável economicamente.
- **Living Memory (Delta Updates):** A fase de Mapeamento profundo roda **apenas uma vez** na vida do projeto (no primeiro boot). A partir daí, para garantir que o mapa da arquitetura evolua com o código sem desperdiçar tokens com re-scans, o Orquestrador sempre injeta uma tarefa final (`T-Final`) no DAG. Isso garante que cada nova funcionalidade faça um *upsert* cirúrgico das pastas modificadas no `context-mode` e das novas invariantes no `agentmemory`, mantendo o orquestrador perfeitamente atualizado para desenhar a próxima *feature* em um loop infinito.
- **Loop de Auto-Cura (Backprop Reflex):** Se o código falha, os *stack traces* e avisos do linter são retroalimentados diretamente no subagente (Worker) para auto-resolução. O Orquestrador é blindado e não sofre desgaste processando erros de sintaxe alheios.
- **Auditoria Independente (Test-Driven & LLM-as-a-Judge):** A validação inicial é puramente determinística, com o script rodando comandos reais de terminal (Testes Unitários, Linters, Grep). Apenas em tarefas de alto nível um juiz autônomo (LLM), cego ao histórico da sessão, é invocado para inspecionar invariantes complexas e exigir aderência infalível ao `SPEC.md` e aos `ADRs. Qualquer regressão estrutural aciona uma correção punitiva.

---

## 6. Modos Operacionais (Fases do dag-flow)

0. **A. Map (O Cartógrafo):** Pré-requisito automático para projetos Brownfield. Vasculha as fronteiras do repositório (via `ctx_execute`) para alimentar o `agentmemory` com invariantes e o `context-mode` com a topologia estrutural. Mantido vivo pelo *Delta Update* (`T-Final`).
1. **B. Specify (O Erradicador):** Interrogação Socrática de Negócios. Saída: `spec.md` e `CONTEXT.md`.
2. **C. Design (O Arquiteto):** Proposição técnica com pontuação de confiança. Saída: `design.md` e `ADRs` (se houver trade-offs pesados). Caso a feature não exija escopo de arquitetura, essa fase sofre um *Bypass* direto para a Fase Tasks.
3. **D. Tasks (O Engenheiro):** Conversão em fluxo executável. Saída: `tasks.md` (o DAG atômico).
4. **E. Implement (O Chão de Fábrica):** Execução assíncrona coordenada pelo `run_dag.sh` alimentando Workers cegos.
5. **F. Quick Mode (O Diagnóstico):** Mini-DAG de sequenciamento rápido para hot-patches rigorosos sem planejamento massivo.

---

## 7. Exemplos Práticos: Linhas do Tempo

Para materializar a separação de responsabilidades (e quando os artefatos são gerados), considere os dois principais fluxos de desenvolvimento do dag-flow:

### A. Geração de Especificação (Nova Feature)

Considere o fluxo de criação de uma funcionalidade de "Carrinho de Compras":

**1. Fase Specify (O Quê vamos fazer?)**
O Orquestrador usa a Interrogação Socrática focada no negócio: *"O carrinho expira? Como chamamos o item na base?"*.
- **Ação Imediata:** Atualiza o dicionário ubíquo (`CONTEXT.md`) com a nova nomenclatura aprovada.
- **Saída:** O documento de requisitos e regras de negócio (`spec.md`) é consolidado.
*(Nota: Nenhuma decisão técnica foi tomada ainda. Nenhuma ADR gerada).*

**2. O Bypass Check (Transição PAGRL)**
O Orquestrador avalia o `spec.md`: *"Essa regra de negócio exige novos componentes de infraestrutura ou altera o padrão arquitetural?"*
- Se NÃO: O Orquestrador faz um *Bypass* na Fase Design e pula direto para a geração de Tasks (pois não há escopo de arquitetura).
- Se SIM (ex: precisamos persistir o carrinho temporariamente): Avança para Design.

**3. Fase Design (Como vamos fazer?)**
O Orquestrador faz a proposição técnica: *"Proponho usar Redis em vez do banco SQL primário para manter a baixa latência nas interações de tela."*
- **Ação Imediata:** O Orquestrador detecta o trade-off crítico (ganho de latência x risco de perda volátil) e gera uma `ADR` justificando a escolha para a posteridade.
- **Saída:** O mapa técnico e a planta baixa (`design.md`) são consolidados.

**4. Fase Tasks (A Ordem de Execução)**
O Orquestrador traduz o `design.md` em um grafo estrito (`tasks.md`), incluindo o `T-Final` (Delta Update) para que os novos arquivos e a ADR sejam mapeados automaticamente pelo `run_dag.sh` no final da execução.

### B. O Fluxo de Emergência (Quick Mode / Hotfix)

Considere um cenário de emergência: *"Fix bug no login que falha com timeout"*.

**1. Fase Diagnosis (O que quebrou?)**
O Orquestrador usa o PAGRL para isolar a falha sem editar o código.
- **Saída:** O arquivo `.specs/hotfixes/login-timeout.md` é gerado, contendo o resumo do diagnóstico e a tabela do Mini-DAG estruturada com 7 colunas (incluindo dependências sequenciais).

**2. Fase Execution (O Chão de Fábrica Efêmero)**
O usuário invoca o `run_dag.sh` passando o arquivo de hotfix.
- **Ação:** O *stateless worker* conserta o bug no código-fonte e insere um **comentário in-code** obrigatório explicando o racional da correção para futuros desenvolvedores.

**3. Living Memory (A Sincronia do T-Final)**
- **Ação Automática:** A última tarefa do Mini-DAG (T-Final) roda silenciosamente, invocando o comando de indexação.
- **Resultado:** O banco vetorial local (`context-mode`) ingere a alteração do código e o markdown do hotfix recém-criado. A memória do Orquestrador é atualizada instantaneamente para as próximas interações, preservando a governança descentralizada sem burocracia.

---

## 8. A Nova Toolchain do dag-flow

| Ferramenta | Papel | Natureza |
| :--- | :--- | :--- |
| **Orquestrador** | Estrategista, Arquiteto e Interrogador Socrático | LLM (*Stateful*) |
| **Worker** (Sub-agentes) | Operário executor apátrida de modificações | LLM (*Stateless*/Efêmero) |
| `run_dag.sh` | Motor de agendamento paralelo e Auto-Healing | Bash Script |
| `auditor.sh` | Portão de Qualidade Determinístico (Testes) e Inspetor LLM-as-a-Judge | Bash Script (Primário) + LLM Assíncrono |

---

## 9. Benefícios e Diferenciais Estratégicos

1. **Soberania Lógica Perene:** Transição do raciocínio efêmero preso em sessões de LLM para uma "Biblioteca da Verdade" no disco (LFE).
2. **Imunidade Sistêmica ao Spec-Drift:** Com um auditor isolado como portão final, subagentes são banidos de comprometer o escopo, sacrificando arquitetura em prol de resoluções temporárias fáceis.
3. **Compressão Extrema de Contexto:** Sessões infinitas são viabilizadas através da virtualização de *sandbox* e formatações coercitivas concisas.
4. **Estabilidade de Idioma (Language Alignment):** Proteção canônica que obriga e confina as extrações, negociações e nomenclaturas sistêmicas aos trilhos linguísticos nativos pré-estabelecidos pelo humano, impedindo desvios semânticos e ruídos transculturais durante a interrogação.
