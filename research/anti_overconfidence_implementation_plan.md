# Anti-Overconfidence Implementation Plan

> **Audience:** modelo de implementação (provavelmente menor que o que produziu este plano).
> **Princípio:** este documento é prescritivo. Onde houver dúvida entre "o que parece elegante" e "o que está escrito aqui", siga o que está escrito aqui. As decisões abaixo foram tomadas após interrogação Socrática completa entre o usuário e o modelo principal; cada uma rejeita alternativas que pareciam atraentes por razões específicas. Não improvise.

---

## 1. Contexto e diagnóstico

### 1.1 Sintoma observado nos benchmarks

Em benchmarks reais do `dag-flow` (notavelmente o cenário `s3-file-upload` em `research/benchmarks/e2e-v0.1.0/scenarios/s3-file-upload/scenario.json`), modelos de larga escala - particularmente Gemini 3.1 Pro (High) - apresentam um padrão de falha consistente:

- **0 turnos de Q&A na fase Specify.** Diante do prompt **"Implement a file upload endpoint using multer. Validate the file type and size."**, o modelo pulou inteiramente a interrogação Socrática.
- **Alucinação de requisitos.** O modelo assumiu por conta própria limites como "5MB" e validação para "jpeg/png", em vez de perguntar ao emulador do usuário.
- **Improviso de formato.** Em vez de criar `.specs/features/file-upload/tasks.md` com a tabela estrita prevista em `references/tasks.md`, o modelo despejou as tarefas no console.
- **Não-leitura de references.** O modelo nem chegou a abrir `references/tasks.md` - assumiu conhecer o formato de cor.

### 1.2 Causa raiz (resumo)

A pesquisa em `research/Otimização Do Projeto Dag-Flow.md` identifica três causas, das quais apenas duas se aplicam a esta primeira iteração de correção:

1. **Overconfidence induzido por RLHF.** Modelos grandes são treinados para parecer prestativos e decididos. A regra "Anti-Hallucination" em prosa (`SKILL.md:30`) compete em peso com a tendência a "fazer logo", e perde.
2. **Gravidade semântica + few-shot ossification.** O `SKILL.md` atualmente contém a seção "Bypass Check" (`SKILL.md:33-43`) com listas exemplares ("Pattern-Conforming: new CRUD endpoint, new UI component, bug fix"). O modelo:
   - lê a palavra **"Bypass"** em um título H2 e **generaliza**: "fases puláveis quando eu julgo necessário" - vazando para Specify e Tasks;
   - lê a lista de exemplos e a trata como **enumeração fechada**, não ilustração - qualquer feature fora da lista de cross-cutting cai automaticamente em "pattern-conforming".

A terceira causa apontada na pesquisa (FSM em código com runtime hooks bloqueantes) é deliberadamente **não adotada** nesta iteração - ver decisão 4 abaixo.

### 1.3 Escopo do gargalo

O usuário e o modelo principal concordaram que **(A) o pulo da fase Specify por overconfidence é o gargalo primário**, e que **(B) a não-leitura de references é consequência de (A)** - uma vez no "modo improviso", o modelo ignora todo o ritual de carregamento de manuais. Atacando (A) com o mecanismo certo, (B) cai junto. Ainda assim, vários campos do PAGRL contável (decisão 4 abaixo) atacam (B) diretamente como reforço.

---

## 2. Decisões consolidadas

Sete decisões estruturais foram tomadas, cada uma com sua alternativa rejeitada e o motivo da rejeição. **Nenhuma destas decisões é negociável durante a implementação.** Se o modelo de implementação encontrar um caso onde uma decisão "parece exagerada", ele deve seguir a decisão e registrar o caso para revisão futura - não improvisar.

### Decisão 1 - Specify -> Design -> Tasks é uniforme, sem bypass

A seção "Bypass Check" (`SKILL.md:33-43`) e "2.1 Phase: Design" (`SKILL.md:44-49`) com discricionariedade são **removidas**. Toda feature passa pelas três fases.

- **Alternativa rejeitada:** manter o bypass mas renomear ("Design Scope Check") e restringir escopo na prosa.
- **Por que rejeitada:** trata o sintoma (palavra "Bypass") sem tratar a doença (existência de licença discricionária para pular fase). Em sistemas anti-overconfidence, **uniformidade vence condicionalidade** - uma instrução uniforme é dramaticamente mais difícil de o modelo confiante racionalizar.

### Decisão 2 - `SKILL.md` é índice, não livro; sem listas exemplares

`SKILL.md` contém apenas regras imperativas em prosa abstrata. Listas de exemplos vão para `references/<phase>.md`, que são lidas sob demanda. Os triggers de ativação (ex: "Specify feature X") são a **única exceção legítima** - sua função é casamento de padrão, não definição de comportamento.

- **Alternativa rejeitada:** manter exemplos com prefixos defensivos ("non-exhaustive examples").
- **Por que rejeitada:** LLMs ignoram esses prefixos quando estão confiantes. Listas em `SKILL.md` viram **leis de fato** porque o RLHF treina o modelo a privilegiar demonstrações sobre prosa abstrata.

### Decisão 3 - `references/design.md` criado com template estruturado

A fase Design hoje vive inteiramente na prosa do `SKILL.md:44-49`, sem reference dedicada. Isso é parte do problema: não há ritual de leitura que sinalize "esta fase é séria". Será criado `references/design.md` com **template de seções obrigatórias e N/A justificado**.

- **Alternativa rejeitada (a):** prosa proporcional, sem template - confiar no modelo para escalar profundidade.
- **Alternativa rejeitada (c):** template + verificação por gate em código (hook validando 'design.md' antes de Tasks).
- **Por que (a) rejeitada:** é o que existe hoje na prática e falhou. (c): viola simplicidade nesta iteração; pode voltar à mesa se (b) falhar nos benchmarks. **(b) escolhida porque N/A justificado é o oposto de bypass silencioso** - força o modelo a *nomear* o que não se aplica e *por quê*.

### Decisão 4 - PAGRL contável nas três fases (Specify, Design, Tasks) + PAGRL de QuickModeEntry

PAGRL deixa de ser prosa livre dentro de tags XML e vira **schema com campos contáveis ou enumeráveis**. A regra de avanço entre fases passa a depender de valores nesses campos, não de auto-julgamento textual. Cada fase tem campos próprios, atacando a falha característica daquela fase.

- **Alternativa rejeitada (a):** apenas reforço de prompt - "negative persona" agressiva ("VOCÊ NÃO POSSUI CONHECIMENTO TÁCITO").
- **Alternativa rejeitada (c):** gate determinístico em código (hooks bash interceptando escrita de arquivos de spec).
- **Por que (a) rejeitada:** persona teatral é ignorada por modelos confiantes (mesma classe da regra "Anti-Hallucination" que já falhou). Sobrecorrige (modelo passa a fazer 8 perguntas onde 2 bastavam). Polui o tom geral da Skill.
- **Por que (c) rejeitada:** viola a simplicidade do dag-flow (hoje 2 scripts bash; (c) adicionaria um terceiro hook interceptando planejamento, mudando a topologia de "puramente cognitivo" para "sandbox de validação"). Pode voltar à mesa se PAGRL contável falhar nos benchmarks. **(b) escolhida porque cria contradição estrutural no output do modelo** - não é pressão retórica, é mecânica: o modelo não consegue escrever `<QuestionsAsked>0</QuestionsAsked>` e `<Decision>Proceed</Decision>` sem dissonância visível.
- **Granularidade β escolhida** (vs. mínima α ou completa γ) porque o campo `<AssumedValues>` é o antídoto direto ao file-upload - força auto-delação de inferência silenciosa.

### Decisão 5 - Frase calibrada lite em `references/specify.md`; negative persona descartada

Uma única frase factual, escopada ao tipo específico de informação que o modelo confiante alucina:

> *"Project-specific values (limits, types, paths, names, identifiers) are never inferable from training data. When absent from the user's input, they must be elicited via Socratic interrogation."*

Vai em `references/specify.md`, **não** no topo do `SKILL.md` (gravidade semântica + onde modelo confiante mais ignora scaffolding).

- **Alternativa rejeitada:** negative persona completa em caps no topo do SKILL.md.
- **Por que rejeitada:** ver Decisão 4(a). Adicionalmente: o skill-creator oficial da Anthropic alerta explicitamente que "ALWAYS/NEVER em caps são yellow flags".

### Decisão 6 - Default policy: toda solicitação entra em Specify

Regra única no SKILL.md: *"Any feature request - regardless of phrasing - enters Specify by default. The only way out is the user explicitly invoking Quick Mode for hotfixes."* Não enumera verbos de implementação; não tenta classificar prompts.

- **Alternativa rejeitada (a):** trigger ampliado - adicionar verbos "Implement", "Build", "Add", "Create" à lista de triggers de Specify.
- **Alternativa rejeitada (c):** PAGRL de roteamento separado na entrada da Skill.
- **Por que (a) rejeitada:** ainda exige que o modelo classifique seu próprio prompt - exatamente o tipo de tarefa onde o overconfidence ataca. (c): adiciona overhead em toda invocação para uma decisão de baixa entropia.
- **Por que (b) escolhida:** **inverte o ônus para o lado certo** - o caminho seguro vira o default; fugir exige decisão ativa do usuário (não do modelo). Em ambiente produtivo, default = caminho seguro é regra de ouro.

### Decisão 7 - Quick Mode blindado: trigger lexical fechado + PAGRL contável de entrada + remoção de "bypasses"

Com Decisão 6, Quick Mode vira a única porta de fuga de Specify, então precisa de trava contra autoclassificação. Três correções:

1. **Remover a palavra "bypasses"** da abertura de `references/quick-mode.md` (linha 3 atual). Substituir por linguagem que descreva Quick Mode como **rota explícita**, não atalho.
2. **Adicionar PAGRL contável de entrada** (`<Phase=QuickModeEntry>` com campos `<UserExplicitlyInvokedQuickMode>` e `<TriggerPhrase>`, antes do PAGRL de diagnóstico já existente).
3. **Lista canônica de triggers declarada como fechada:** "Variants and paraphrases do not qualify."

Exceção registrada: Escalation Phase (`references/escalation-phase.md`) entra em Quick Mode pelo passo 2 sem trigger do usuário. Para isso, `<TriggerPhrase>` aceita o valor literal 'ESCALATION' quando a entrada vem do passo 2 da Escalation Phase.

- **Alternativa rejeitada (a):** trigger lexical estrito sozinho.
- **Alternativa rejeitada (b):** confirmação explícita do usuário em todo bug fix.
- **Por que rejeitadas:** (a) sem PAGRL não fecha buraco - modelo confiante racionaliza paráfrases. (b): cria fricção desnecessária para usuário legítimo que já disse "Fix bug X".

### Decisão 8 - ADR-0004 documentando a reescrita

A reescrita satisfaz os três critérios para ADR (hard to reverse + surprising without context + real trade-off). Será criado `docs/adr/0004-counted-pagrl-anti-overconfidence-gate.md`. A justificativa está em §6 deste plano.

- **Por que necessário:** sem ADR, em 6 meses alguém olha a Skill, acha o PAGRL contável "burocrático demais para feature simples", propõe desligar. O ADR é a vacina contra essa regressão.

---

## 3. Princípios para o modelo de implementação

Antes dos diffs, leia esta seção inteira. Ela existe para evitar que você "melhore" o plano improvisando.

1. **Não adicione listas de exemplos no `SKILL.md`.** Decisão 2 é absoluta. Se você sente vontade de dar exemplo, mova para o `references/<phase>.md` correspondente.
2. **Não use ALWAYS/NEVER em caps no `SKILL.md` ou em references.** Prefira regras que criem contradição estrutural (ex: "you MAY only write `spec.md` when `<UnresolvedAmbiguities>` is empty") em vez de imperativos retóricos.
3. **Não invente novos campos no PAGRL.** Os campos abaixo foram escolhidos por razão específica (cada um tem uma falha que ele bloqueia). Adicionar campos infla cerimônia sem ganho.
4. **Não remova campos do PAGRL.** Mesmo que pareça que `<EvidenceSource>` é redundante com `<AssumedValues>`, eles atacam ângulos diferentes. Mantenha todos.
5. **Preserve referências cruzadas.** Onde o `SKILL.md` aponta para `references/X.md`, mantenha o link relativo. Onde uma reference aponta para uma ADR, mantenha o número correto.
6. **Não reformate arquivos não tocados pelos diffs.** Especialmente `scripts/run_dag.sh`, `scripts/auditor.sh`, `hooks/setup_indexer.sh` - não mexa neles. O escopo desta iteração é puramente textual (SKILL.md + references + 1 ADR + 1 reference nova).
7. **Não toque em `CONTEXT.md`.** O glossário não muda. As decisões aqui não introduzem novos termos de domínio (PAGRL e Quick Mode já existem).
8. **Após todos os diffs, faça um diff final completo e leia.** Se algum trecho seu contradiz uma decisão acima, refaça.

---

## 4. Diffs literais por arquivo

A ordem importa: comece por `references/specify.md` (porque é onde a frase calibrada vai morar e onde o PAGRL de Specify é detalhado), depois `references/design.md` (novo arquivo), depois `references/tasks.md`, depois `references/quick-mode.md`, depois `SKILL.md` (que aponta para tudo isso), e finalmente `docs/adr/0004-...`. Razão: `SKILL.md` por último permite verificar que todos os links cruzados existem antes de você os escrever.

### 4.1 `[MODIFY] references/specify.md`

**Estado atual:** o arquivo (49 linhas) descreve interrogação Socrática, dicionário CONTEXT.md e PAGRL de prosa livre.

**Mudanças:**

- (M1) Inserir, logo após o cabeçalho `# dag-flow: Specify Phase` (linha 1), e antes do parágrafo introdutório, uma nova seção `## Calibration` contendo a frase calibrada da Decisão 5.
- (M2) Substituir a seção `### 3. Usage of PAGRL` (linhas 32-42) por uma seção que define o **schema contável** do PAGRL para Specify, com rationale por campo.
- (M3) Adicionar, logo após a nova seção do PAGRL contável, uma subseção `### Advancement Rule` que define quando o orquestrador pode escrever `spec.md`.

**Diff conceitual (escreva exatamente como abaixo, ajustando apenas indentação consistente):**

```markdown
# dag-flow: Specify Phase

## Calibration

Project-specific values (limits, types, paths, names, identifiers) are never inferable from training data. When absent from the user's input, they must be elicited via Socratic interrogation. This applies even when a default value would be "obvious" - *obvious to the model* and *correct for this project* are different things, and the model has no way to distinguish them without asking.

The **Specify Phase** represents the bedrock of dag-flow. Its core objective is to systematically eradicate ambiguity before a single line of architecture or code is written.

## Trigger
"Specify feature X", "Plan project", or initiating a new major feature.
(Note: per the Default Policy in SKILL.md, *any* feature request enters Specify by default, regardless of phrasing. The phrases above are explicit triggers; absence of an explicit trigger does not exempt a feature request from Specify.)

## Core Mechanics

### 1. Socratic Interrogation
[unchanged from current lines 10-16]

### 2. Live Dictionary Building (`CONTEXT.md`)
[unchanged from current lines 18-30]

### 3. Counted PAGRL (Schema)

PAGRL in the Specify phase is not free prose. It is a structured XML block with countable or enumerable fields. Each field exists to block a specific failure mode observed in benchmarks:

| Field | Type | Why it exists |
|---|---|---|
| `<ReferencesRead>` | comma-separated list | Forces explicit acknowledgment of which reference files were loaded this turn. The Tasks-phase failure where the model improvised the table format originated in skipping reference loading; declaring an empty list here is a visible self-incrimination. |
| `<QuestionsAsked>` | non-negative integer | Counts Socratic questions asked so far in this Specify session. Cannot be lied about while still claiming to have advanced. |
| `<UnresolvedAmbiguities>` | list of `<item>` elements | Lists every ambiguity the model is aware of and has not yet resolved. Must be empty to advance. |
| `<AssumedValues>` | list of `<item>` elements | **Direct antidote to the file-upload benchmark.** Lists every project-specific value (limits, types, paths) the model is about to use without explicit user input. Must be empty to advance. If the model is tempted to assume "5MB", it must list "5MB for max file size" here - and listing it forces it to be elicited instead. |
| `<EvidenceSource>` | per-decision tag | For each non-trivial decision in the current spec draft, declares the source: `user_input`, `reference_file:<path>`, or `inference`. The value `inference` is a flag - it tells the orchestrator (and the human reviewing the trace) that something was decided without ground. |
| `<Decision>` | enum | One of 'ContinueInterrogation', 'WriteSpec', 'AbortToUser'. Cannot be 'WriteSpec' while `<UnresolvedAmbiguities>` or `<AssumedValues>` is non-empty. |

**Schema example (this is the format every PAGRL turn in Specify must follow):**

```xml
<PAGRL phase="Specify">
  <ReferencesRead>references/specify.md</ReferencesRead>
  <QuestionsAsked>2</QuestionsAsked>
  <UnresolvedAmbiguities>
    <item>Max file size not specified</item>
    <item>Allowed MIME types not specified</item>
  </UnresolvedAmbiguities>
  <AssumedValues>
    <!-- empty: model has not assumed anything yet -->
  </AssumedValues>
  <EvidenceSource>
    <decision name="upload destination">user_input</decision>
  </EvidenceSource>
  <Decision>ContinueInterrogation</Decision>
</PAGRL>
```

### Advancement Rule

You may only write `.specs/features/[feature]/spec.md` when **all** of the following hold in your most recent `<PAGRL phase="Specify">`:

- `<QuestionsAsked>` ≥ 1
- `<UnresolvedAmbiguities>` is empty
- `<AssumedValues>` is empty
- `<Decision>` is `WriteSpec`

If any of these fails, the only valid action is to ask another Socratic question (or, if blocked, set `<Decision>` to `AbortToUser` and surface the blocker explicitly).

### 4. Zero Execution
[unchanged from current lines 44-45]

## Exit Condition
[unchanged from current line 48]
```

**Note for the implementer:** preserve every line currently in `references/specify.md` that I marked `[unchanged]`. Only replace what is explicitly being replaced, and only insert what is explicitly being inserted.

---

### 4.2 `[NEW] references/design.md`

**Estado atual:** arquivo não existe.

**Conteúdo completo do novo arquivo** (escrever literal, exceto blocos onde indicado "exemplos abaixo são ilustrativos"):

```markdown
# dag-flow: Design Phase

The **Design Phase** is mandatory for every feature. It exists to make architectural decisions visible before they are committed to code, and to ensure that "no architectural change" is *named and justified* rather than silently assumed.

## Trigger

Automatically follows the completion of the Specify Phase. There is no bypass: every feature passes through Design, regardless of perceived complexity.

## Core Principle: Depth Proportional to Decisions

The depth of `design.md` is proportional to the architectural decisions the feature requires - not to the perceived complexity of the feature. A feature that genuinely reuses existing patterns produces a short `design.md` where most sections are explicitly marked N/A with justification. A feature that introduces a new cross-cutting concern produces a longer one. **The shape of the file is uniform; the depth of each section is variable.**

This rule replaces the old "Bypass Check" mechanism, which has been removed from the workflow because it taught the model that phases are skippable when judged unnecessary - a generalization that leaked from Design into Specify and Tasks.

## Required Sections

Every `design.md` MUST contain the following sections, in order. Each section accepts 'N/A' only when accompanied by a justification.

```markdown
# Design: [feature name]

## Patterns Reused
[List existing patterns this feature builds on. Reference files or modules where each pattern is currently implemented. If none - i.e., this feature introduces only new code with no reuse - explain why no existing pattern applies.]

## New Patterns Introduced
[List any new patterns this feature establishes that other parts of the codebase will need to follow. If 'N/A', justify: "This feature introduces no new pattern; it strictly conforms to <named existing pattern>."]

## Cross-Cutting Concerns
[Address auth, authorization, logging, rate limiting, observability, error handling conventions, and any other concern that crosses module boundaries. For each concern, state how this feature interacts with it. 'N/A' is acceptable per concern, but each 'N/A' requires a sentence: "<concern>: N/A - <reason>".]

## ADRs Required
[List ADRs that this design produces. If none, justify: "No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off)."]

## Confidence
[A single sentence assessing the confidence in this design. If confidence is low, name what specifically is uncertain - do not write a number. The 0.0-1.0 confidence score from previous versions of this skill has been removed because thresholds invite theatrical self-grading.]
```

## Counted PAGRL (Schema)

PAGRL in the Design phase has its own field set, attacking the failure characteristic of this phase: writing a `design.md` of vague prose that hides absent reasoning.

| Field | Type | Why it exists |
|---|---|---|
| `<ReferencesRead>` | comma-separated list | Must include `references/design.md` and `references/specify.md` (the latter so the design is grounded in the spec, not in the prompt). |
| `<PatternsReused>` | list of `<item>` elements | Mirrors the `## Patterns Reused` section. Empty list with no justification is a flag. |
| `<NewPatternsIntroduced>` | list of `<item>` elements | Mirrors `## New Patterns Introduced`. Non-empty list signals cross-cutting impact and may require an ADR. |
| `<ADRsRequired>` | list of `<item>` elements | Mirrors `## ADRs Required`. Each item is a one-line ADR title that the orchestrator must create before advancing to Tasks. |
| `<UnjustifiedDecisions>` | list of `<item>` elements | Lists any decision in the current `design.md` draft that lacks a stated rationale. Must be empty to advance. |
| `<Decision>` | enum | One of 'ContinueDesign', 'WriteDesign', 'AbortToUser'. Cannot be 'WriteDesign' while `<UnjustifiedDecisions>` is non-empty. |

**Schema example:**

```xml
<PAGRL phase="Design">
  <ReferencesRead>references/design.md, references/specify.md</ReferencesRead>
  <PatternsReused>
    <item>Express middleware pattern (existing src/middleware/)</item>
  </PatternsReused>
  <NewPatternsIntroduced>
    <!-- empty: feature reuses existing patterns -->
  </NewPatternsIntroduced>
  <ADRsRequired>
    <!-- empty -->
  </ADRsRequired>
  <UnjustifiedDecisions>
    <!-- empty -->
  </UnjustifiedDecisions>
  <Decision>WriteDesign</Decision>
</PAGRL>
```

## Advancement Rule

You may only write `.specs/features/[feature]/design.md` when **all** of the following hold in your most recent `<PAGRL phase="Design">`:

- `<ReferencesRead>` includes both `references/design.md` and `references/specify.md`
- `<UnjustifiedDecisions>` is empty
- `<Decision>` is 'WriteDesign'

You may only advance to the Tasks phase after `design.md` has been written and every item in `<ADRsRequired>` has been created in `docs/adr/`.

## Zero Execution

During the Design Phase, the Orchestrator is FORBIDDEN from modifying any functional application code (`src/`, `lib/`, etc.). All writes must be confined to `.specs/`, `docs/adr/`, and (if a new domain term emerges) `CONTEXT.md`.

## Exit Condition

The Design Phase concludes when `design.md` has been written, all required ADRs exist in `docs/adr/`, and the most recent PAGRL has `<Decision>WriteDesign</Decision>` with all advancement-rule conditions met.
```

**Note for the implementer:** the inner ````markdown 
```` block above is the *template content for users of the Skill*, not part of `references/design.md` prose. When you write the file, render it as a code block exactly as shown - the backticks are intentional. If your tooling interferes with nested code blocks, you may use `~~~markdown` for the inner block.

---

### 4.3 `[MODIFY] references/tasks.md`

**Estado atual:** arquivo (~64 linhas) descreve geração da tabela DAG, regras de skill injection, traceability, "Done When" gates, financial firewall, e Living Memory.

**Mudanças:**

- (T1) Inserir uma nova seção `## Counted PAGRL (Schema)` logo após o título e antes da seção `## Trigger`. Esta seção define os campos do PAGRL para a Tasks phase.
- (T2) Inserir uma seção `## Advancement Rule` logo após a seção do PAGRL.

**Diff conceitual:** preserve todo o conteúdo existente do arquivo. Insira, entre o título `# dag-flow: Tasks Phase (The DAG Generator)` e o atual primeiro parágrafo, o seguinte bloco:

```markdown
## Counted PAGRL (Schema)

PAGRL in the Tasks phase has its own field set, attacking the failure characteristic of this phase: improvising the artifact format (e.g., dumping tasks to the console instead of writing the strict markdown table to `.specs/features/[feature]/tasks.md`).

| Field | Type | Why it exists |
|---|---|---|
| `<ReferencesRead>` | comma-separated list | Must include `references/tasks.md`. The benchmark failure where the model dumped to console originated in skipping this reference; declaring it as not-read here is self-incrimination. |
| `<ArtifactPath>` | string | The exact path where the tasks table will be written. Must match `.specs/features/[feature]/tasks.md` for features (or `.specs/hotfixes/[issue_id].md` for Quick Mode). The literal string `console` is forbidden. |
| `<TableSchemaSource>` | enum | One of `references/tasks.md`, `references/quick-mode.md`, or `memory`. The value `memory` is forbidden - table schema must come from a reference file, not from the model's pretraining. |
| `<Decision>` | enum | One of `WriteTasksTable`, `AbortToUser`. |

**Schema example:**

```xml
<PAGRL phase="Tasks">
  <ReferencesRead>references/tasks.md, references/specify.md, references/design.md</ReferencesRead>
  <ArtifactPath>.specs/features/file-upload/tasks.md</ArtifactPath>
  <TableSchemaSource>references/tasks.md</TableSchemaSource>
  <Decision>WriteTasksTable</Decision>
</PAGRL>
```

## Advancement Rule

You may only generate the tasks table when **all** of the following hold:

- `<ReferencesRead>` includes `references/tasks.md`
- `<ArtifactPath>` is a valid `.specs/...` path (never `console`)
- `<TableSchemaSource>` is a reference file path, never `memory`
- `<Decision>` is `WriteTasksTable`
```

(Insert the block above immediately after the H1 title and before the first existing paragraph. Everything else in the file stays as it is.)

---

### 4.4 `[MODIFY] references/quick-mode.md`

**Estado atual:** arquivo (~50 linhas) descreve diagnóstico, geração de Mini-DAG, e execução.

**Mudanças:**

- (Q1) Substituir a linha 3 atual (que contém a palavra "bypasses") por uma reescrita que descreve Quick Mode como rota explícita.
- (Q2) Substituir a seção `## Trigger` (linha 6) por uma seção que declara a lista canônica como **fechada**.
- (Q3) Inserir, entre `## Trigger` e `## The Process`, uma nova seção `## Entry Gate (Counted PAGRL)`.
- (Q4) Renomear a atual seção `### 1. Diagnosis (PAGRL)` para `### 1. Diagnosis (Second PAGRL)` e adicionar uma frase de transição explicando que este é o *segundo* PAGRL, posterior ao gate de entrada.

**Diff conceitual:**

(Q1) Substituir:

```markdown
Quick Mode bypasses the extensive Spec and Design phases for immediate diagnostic and patching scenarios, while strictly retaining the architectural separation of concerns (PAGRL and automated delegated execution).
```

por:

```markdown
Quick Mode is the explicit hotfix path: a compressed flow for runtime regressions and reported bugs. It is not a shortcut to be self-selected by the orchestrator - it is a route the user opens by invoking one of the canonical trigger phrases below. Specify and Design remain the default for all other feature requests (see SKILL.md, Default Policy).
```

(Q2) Substituir:

```markdown
## Trigger
"Fix bug X", "Hot-patch issue Y", "Quick mode: Z"
```

por:

```markdown
## Trigger

Quick Mode opens **only** when the user's prompt literally contains one of the following canonical phrases:

- 'Fix bug'
- 'Hotfix'
- 'Hot-patch'
- 'Quick mode'

This list is **closed**. Variants and paraphrases ('patch this regression', 'apply a quick fix', 'it's just a small bug') do not qualify. If the user's intent seems hotfix-shaped but they have not used a canonical phrase, the correct action is to enter Specify per the Default Policy and, if appropriate, ask the user whether they prefer to invoke Quick Mode explicitly.

The literal token 'ESCALATION' is also accepted as a `<TriggerPhrase>` value, but only when entry comes from step 2 of the Escalation Phase (see `references/escalation-phase.md`). It cannot be invoked by the user directly.
```

(Q3) Inserir entre `## Trigger` e `## The Process`:

```markdown
## Entry Gate (Counted PAGRL)

Before any diagnosis, the orchestrator MUST emit an entry-gate PAGRL that proves Quick Mode was authorized.

| Field | Type | Why it exists |
|---|---|---|
| `<UserExplicitlyInvokedQuickMode>` | boolean | True only if the user's prompt literally contains one of the canonical trigger phrases, or if entry is via Escalation. |
| `<TriggerPhrase>` | string | The exact substring from the user's prompt that matched a canonical trigger, or the literal `ESCALATION` for escalation entry. The value `NONE` is permitted but forces abort. |
| `<Decision>` | enum | One of `ProceedToDiagnosis`, `AbortToSpecify`. |

**Schema example (legitimate user-invoked entry):**

```xml
<PAGRL phase="QuickModeEntry">
  <UserExplicitlyInvokedQuickMode>true</UserExplicitlyInvokedQuickMode>
  <TriggerPhrase>Fix bug</TriggerPhrase>
  <Decision>ProceedToDiagnosis</Decision>
</PAGRL>
```

**Schema example (escalation entry):**

```xml
<PAGRL phase="QuickModeEntry">
  <UserExplicitlyInvokedQuickMode>true</UserExplicitlyInvokedQuickMode>
  <TriggerPhrase>ESCALATION</TriggerPhrase>
  <Decision>ProceedToDiagnosis</Decision>
</PAGRL>
```

**Schema example (illegitimate attempt - must abort):**

```xml
<PAGRL phase="QuickModeEntry">
  <UserExplicitlyInvokedQuickMode>false</UserExplicitlyInvokedQuickMode>
  <TriggerPhrase>NONE</TriggerPhrase>
  <Decision>AbortToSpecify</Decision>
</PAGRL>
```

### Advancement Rule

You may only proceed to the Diagnosis step when `<UserExplicitlyInvokedQuickMode>` is `true` AND `<TriggerPhrase>` matches one of the canonical triggers (or equals `ESCALATION` for escalation entry). Otherwise, the only valid action is to set `<Decision>` to `AbortToSpecify` and surface to the user that Quick Mode was not authorized.
```

(Q4) Replace the current heading `### 1. Diagnosis (PAGRL)` with `### 1. Diagnosis (Second PAGRL)` and immediately under that heading insert one introductory sentence:

```markdown
This PAGRL is the *second* one in Quick Mode - it follows the entry gate above. By the time you reach this step, you have already proven user authorization. The diagnosis PAGRL focuses on root-cause hypothesis, not on entry permission.
```

The remaining contents of section 1 (current lines 11-20) stay as they are.

---

### 4.5 `[MODIFY] SKILL.md`

**Estado atual:** ~80 linhas, descrevendo PAGRL, Living Memory, e as 4 fases (Specify, Design via Bypass Check, Tasks, Execute), mais Discovery e Quick Mode como Standalone Operations.

**Mudanças (em ordem):**

- (S1) Substituir o `## 1. The Pre-Action Governance Reasoning Loop (PAGRL)` (linhas 10-21) por uma versão que descreve PAGRL como **schema contável por fase**, sem mostrar todos os campos (esses ficam nas references). Apenas o esqueleto e a regra de que PAGRL é vinculante.
- (S2) Adicionar uma nova seção `## Default Policy` logo após Living Memory (após linha 24), declarando a Decisão 6.
- (S3) Substituir inteiramente as seções `## 2. The Bypass Check (PAGRL Transition)` (linhas 33-43) e `## 2.1 Phase: Design` (linhas 44-49) por uma única seção `## 2. Phase: Design` que **não menciona bypass**, aponta para `references/design.md`, e remove a Confidence Score (0.0-1.0).
- (S4) Manter `## 3. Phase: Tasks` como está (linhas 51-55), mas atualizar a explicação para citar a nova seção PAGRL contável dentro de `references/tasks.md`.
- (S5) Em `## 1. Phase: Specify` (linhas 26-31), adicionar uma frase apontando para a nova seção `## Calibration` em `references/specify.md`.
- (S6) Em `### Emergency / Quick Mode` (linhas 73-74), reforçar que ela é a **única exceção** ao Default Policy e citar o gate de entrada.

**Diff conceitual completo do arquivo final** (escreva exatamente este conteúdo, ajustando apenas se identificar erro factual):

```markdown
---
name: dag-flow
description: MANDATORY: Use this skill whenever the user asks to implement a feature, fix a bug, or plan an architecture using the dag-flow system. This orchestrates software design using Socratic Interrogation and strict cognitive separation. Plans features via Counted PAGRL, builds a ubiquitous language (CONTEXT.md), and generates an executable Markdown DAG Table. It strictly delegates execution to stateless independent CLI sessions and validates via an independent auditor.
---

# dag-flow: Executive Orchestrator

You are the Executive Orchestrator. Your role is strictly strategic planning and architectural governance. You DO NOT write functional code. You orchestrate the dag-flow process across four core phases: **Specify**, **Design**, **Tasks**, and **Execute**. Every feature passes through Specify -> Design -> Tasks. There is no bypass.

## 1. The Pre-Action Governance Reasoning Loop (Counted PAGRL)

Before advancing phases or initiating any major plan, you must emit a `<PAGRL phase="...">` block. PAGRL is not free prose: it is a structured schema with countable or enumerable fields, defined per phase in the corresponding reference file (`references/specify.md`, `references/design.md`, `references/tasks.md`, and the entry gate in `references/quick-mode.md`).

**Why this is mandatory:** PAGRL fields create structural contradiction when the model attempts to advance without satisfying advancement rules. For example, you cannot emit `<QuestionsAsked>0</QuestionsAsked>` and `<Decision>WriteSpec</Decision>` in the same block - the schema makes the contradiction visible to you, to the user, and to anyone auditing the trace later. Pretending PAGRL is decorative defeats the entire workflow.

**Skeleton (refer to the per-phase reference for full field set):**

```xml
<PAGRL phase="Specify | Design | Tasks | QuickModeEntry">
  <ReferencesRead>...</ReferencesRead>
  <!-- phase-specific fields -->
  <Decision>...</Decision>
</PAGRL>
```

**Advancement is bound to PAGRL fields, not to your judgment.** Each phase reference defines the exact `<Decision>` values and the conditions under which each value is permitted. Read the reference for the phase you are in *before* emitting the PAGRL - relying on memory of past PAGRL emissions is what produced the benchmark failures this design is correcting.

## Living Memory (Global Principle)

`dag-flow` maintains a continuous memory of the project's architecture across sessions to prevent expensive re-scans. You initialize this memory in the **Discovery Phase** and update it in the **Tasks Phase**.

## Default Policy

Any feature request - regardless of phrasing - enters the Specify phase by default. This applies to prompts using verbs like "Implement", "Build", "Add", "Create", and to prompts that do not use any explicit verb at all. The orchestrator does not classify prompts to decide whether Specify is needed; Specify is the default, and the only opt-out is the user explicitly invoking Quick Mode via one of the canonical trigger phrases listed in `references/quick-mode.md`.

This rule exists because earlier versions of this skill granted the orchestrator discretion to bypass phases for "trivial" features. In benchmark traces, large models reliably abused this discretion by self-classifying as trivial whenever the request matched their pretraining distribution - which is precisely when overconfidence is highest and Socratic interrogation is most needed.

## 1. Phase: Specify (Socratic Interrogation)

**Trigger:** Any feature request (per Default Policy), including but not limited to "Specify feature X", "Plan project", "Implement Y", "Add Z".

**Goal:** Eradicate ambiguity before writing a single line of code.

- **Reference:** You MUST use the `view_file` tool to read [`references/specify.md`](./references/specify.md) before executing this phase, including its `## Calibration` section. **Why:** the calibration sentence and the counted PAGRL schema defined there are not summarizable; relying on memory drops the load-bearing fields and you will fail the advancement rule.
- **Anti-Hallucination is enforced by the PAGRL schema, not by prose.** The fields `<UnresolvedAmbiguities>`, `<AssumedValues>`, and `<EvidenceSource>` (defined in `references/specify.md`) make assumed values self-incriminating: declaring an assumption forces it to be elicited instead.

## 2. Phase: Design

**Trigger:** Automatically follows the completion of the Specify Phase. There is no bypass.

**Goal:** Make architectural decisions visible before they are committed to code, including for features that reuse existing patterns (which produce a short `design.md` with N/A justified, not a skipped phase).

- **Reference:** You MUST use the `view_file` tool to read [`references/design.md`](./references/design.md) before executing this phase. **Why:** the required-sections template and the counted PAGRL schema for Design live there. The depth of `design.md` is proportional to the architectural decisions the feature requires; the *shape* (which sections must appear) is uniform.
- **ADRs:** any item declared in `<ADRsRequired>` of the Design PAGRL must be created in `docs/adr/` before advancing to Tasks.

## 3. Phase: Tasks (The DAG Generator)

**Trigger:** Design is complete (every feature has a Design Phase; see Decision Default Policy).

**Goal:** Translate the specification and design into an executable Directed Acyclic Graph (DAG) formatted as a Markdown Table.

- **Reference:** You MUST use the `view_file` tool to read [`references/tasks.md`](./references/tasks.md) for detailed formatting and execution prompt templates, including its `## Counted PAGRL (Schema)` section. **Why:** the table schema is not memorable from pretraining - claiming to know it from memory is the failure mode the `<TableSchemaSource>` field is designed to detect.
- **CRITICAL RULE:** No matter how trivial the request appears, you MUST adhere strictly to the DAG-flow phases and write the DAG Markdown Table to `.specs/features/[feature]/tasks.md`. Dumping the table to the console is a violation that the `<ArtifactPath>` PAGRL field is designed to prevent.

## 4. Phase: Execute (Decentralized)

**Trigger:** User runs the generated DAG script.

- As the Orchestrator, your job is largely done. The user will spawn independent CLI sessions using the script you generated in Phase 3.
- **The CLI Session:** the sub-session will act as a stateless execution layer. It only reads inputs and writes outputs. It does NOT run tests.
- **The Auditor:** after an execution finishes, [`scripts/auditor.sh`](./scripts/auditor.sh) must be invoked to run the "Done When" gate and validate against `CONTEXT.md`. If it fails, the error feeds back into a new prompt.
- **Escalation Protocol:** if the user reports a DAG failure, read `last_failure.log` and read [`references/escalation-phase.md`](./references/escalation-phase.md) to initiate the recovery protocol.

## Standalone Operations

These operations are executed independently and are not part of the core feature pipeline.

### Discovery (Project Mapping)

**Trigger:** User explicitly says "Map this project", "Do a discovery", "Map architecture".

**Goal:** Establish an accurate, token-efficient understanding of the existing codebase.

- **Reference:** You MUST use the `view_file` tool to read [`references/discovery.md`](./references/discovery.md) for execution rules using `context-mode` and `agentmemory`. **Why:** standard directory listings are too expensive and inaccurate for deep architectural context.

### Emergency / Quick Mode

**Trigger:** **Only** when the user's prompt literally contains one of the canonical phrases listed in [`references/quick-mode.md`](./references/quick-mode.md). Quick Mode is the **only** exception to the Default Policy.

- **Entry Gate:** before any diagnosis, you MUST emit a `<PAGRL phase="QuickModeEntry">` block proving authorization, per the schema in `references/quick-mode.md`. Self-classifying a request as a hotfix when the user did not use a canonical trigger is forbidden.
- **Reference:** see [`references/quick-mode.md`](./references/quick-mode.md). **Why:** full ceremonies for 1-line bug fixes waste tokens, but uncontrolled direct file editing breaks the DAG architecture. Mini-DAGs are the required bridge.

## Strict Restrictions

- You (The Orchestrator) are **FORBIDDEN** from using file-editing tools on application source code (`src/`, `lib/`, `api/`) during the Specify and Design phases.
- Confine your outputs to `.specs/`, `CONTEXT.md`, and `docs/adr/`.
```

**Notes for the implementer:**

- Do **not** carry over the old `## 2. The Bypass Check (PAGRL Transition)` section in any form.
- Do **not** carry over the 'Confidence Score (0.0 to 1.0)' mention. Confidence is now expressed in prose in the `## Confidence` section of `design.md` (see `references/design.md`).
- The trigger list `"capitalize a string"` example previously in `## 3. Phase: Tasks` is removed - it was an enumerated example that contributed to few-shot ossification. The CRITICAL RULE prose above is the replacement.

---

### 4.6 `[NEW] docs/adr/0004-counted-pagrl-anti-overconfidence-gate.md`

**Estado atual:** arquivo não existe. Os ADRs existentes (`0001`, `0002`, `0003`) seguem um formato curto: Title / Date / Status / Context / Decision / Consequences. Use o mesmo formato.

**Conteúdo completo:**

```markdown
# 4. Counted PAGRL as Anti-Overconfidence Gate

Date: 2026-06-11

## Status

Accepted

## Context

Benchmarks of dag-flow against large frontier models (notably Gemini 3.1 Pro High) revealed a consistent failure pattern: the model would skip the Specify phase entirely (zero Q&A turns), hallucinate project-specific values (file size limits, MIME types), skip the loading of `references/tasks.md`, and improvise the tasks output to the console rather than writing the strict markdown table to `.specs/features/[feature]/tasks.md`. The full diagnostic, including investigation of RLHF-induced overconfidence and semantic gravity in pretraining, is documented in `research/Otimização Do Projeto Dag-Flow.md`.

The original skill relied on prose-level rules ("Anti-Hallucination", "you MUST read references/tasks.md") to enforce phase discipline. These rules competed in token weight against the model's RLHF-trained tendency to "be helpful immediately", and they lost. The skill also contained a "Bypass Check" section that granted the orchestrator discretion to skip the Design phase for "Pattern-Conforming" features (CRUD endpoints, UI components, bug fixes). Two failure modes were observed:

1. The discretion leaked. The model generalized "Design is skippable when I judge it unnecessary" into "Specify and Tasks are skippable when I judge them unnecessary."
2. The illustrative examples ossified into a closed enumeration. Any feature outside the listed cross-cutting concerns was automatically classified as Pattern-Conforming.

We considered three classes of solution from the research document: (a) negative-persona reinforcement of the prompt, (b) counted PAGRL - converting the existing PAGRL block into a structured schema with countable fields whose values create structural contradiction with illegitimate `<Decision>` values, and (c) deterministic gates implemented in shell scripts that intercept artifact writes.

## Decision

We adopted (b) and rejected (a) and (c) for this iteration.

The PAGRL block, previously free prose inside XML tags, becomes a per-phase schema with required fields. Each field exists to block a specific failure mode: `<UnresolvedAmbiguities>` and `<AssumedValues>` block hallucination of requirements; `<ReferencesRead>` blocks self-deception about which manuals were loaded; `<ArtifactPath>` blocks console-dumping; `<TableSchemaSource>` blocks recall of table format from pretraining; `<UserExplicitlyInvokedQuickMode>` and `<TriggerPhrase>` block self-promotion of feature requests into Quick Mode. Advancement between phases is bound to specific field values, not to the orchestrator's textual judgment.

We also removed the Bypass Check entirely. Specify -> Design -> Tasks is uniform; the depth of `design.md` is proportional to the architectural decisions the feature requires (with N/A justified per section), but every feature passes through Design. We added a Default Policy stating that any feature request enters Specify by default, with Quick Mode as the only opt-out and Quick Mode itself gated by a counted entry PAGRL.

We rejected (a) - negative persona - because prose-level reinforcement is the same class of mechanism that already failed (the existing "Anti-Hallucination" rule). Models confidently ignore retorical pressure when their internal probability gradient pushes the other way. Negative persona also has a known sobrecorrection effect (model asks excessive questions on trivial features) and contaminates the general tone of the skill.

We rejected (c) - shell-level gates - because it changes the topology of dag-flow from "purely cognitive orchestration" to "sandboxed validation", introducing a third script alongside `run_dag.sh` and `auditor.sh`. The simplicity of dag-flow is a load-bearing property and we are not willing to sacrifice it for a marginal robustness gain when (b) has not yet been validated. (c) remains available as a future iteration if benchmarks after (b) still show failures.

## Consequences

- **Positive:** the failure modes observed in benchmark `s3-file-upload` are blocked at the schema level: assumed values must be listed and therefore cannot be silently inserted; reference files must be declared and therefore cannot be silently skipped; the artifact path must be a valid `.specs/...` location and therefore cannot be `console`. Trust in dag-flow as a production-grade workflow for organizations is increased because the trace of any feature contains an auditable record of which assumptions were made on what evidence.
- **Positive:** removing the Bypass Check eliminates the meta-permission that leaked across phases. The workflow becomes uniform; the model has no rule to generalize from.
- **Negative:** every feature, including trivial ones, now produces a non-empty `design.md` (with N/A justified per section). This is a small token cost relative to the failure cost it replaces.
- **Negative:** the orchestrator's PAGRL emissions are longer and more structured. This costs tokens per turn; the cost is acceptable for the determinism it buys, and is concentrated in the orchestrator (which runs cheaply) rather than the workers (which do not run PAGRL).
- **Future:** if benchmarks after this change still show phase-skipping or format-improvising, escalate to (c) - shell-level gates intercepting writes to `.specs/...`. This iteration was deliberately the cheapest, simplest step.
```

**Note for the implementer:** the ADR uses the same Markdown structure as `docs/adr/0001-intentional-manual-execution.md`. Match the heading levels exactly. Date is the date you write the file; if uncertain, use today's date.

---

## 5. Arquivos que NÃO devem ser tocados

Esta lista é tão importante quanto a lista de mudanças. Se você modificar qualquer um destes arquivos durante esta iteração, está fora de escopo:

- `scripts/run_dag.sh` - escopo é puramente textual nesta iteração.
- `scripts/auditor.sh` - idem.
- `hooks/setup_indexer.sh` - idem.
- `mcp/**` - não relacionado.
- `evals/**` - os benchmarks existem; rodar contra a nova Skill é uma etapa **posterior**, não parte desta implementação.
- `CONTEXT.md` - nenhum termo de domínio novo é introduzido.
- `references/discovery.md` - não interage com as decisões.
- `references/escalation-phase.md` - não muda. A integração com Quick Mode (escalation entry com `<TriggerPhrase>ESCALATION</TriggerPhrase>`) é resolvida do lado de Quick Mode, não do lado de Escalation.
- `docs/adr/0001-*`, `docs/adr/0002-*`, `docs/adr/0003-*` - ADRs anteriores não são alterados.
- `README.md`, `CONTRIBUTING.md`, `LICENSE`, `docs/architecture.md`, `docs/benchmarks.md`, `docs/examples.md`, `docs/getting-started.md`, `docs/theory.md` - fora de escopo.
- Qualquer arquivo em `research/` exceto este plano.

Se você ler um arquivo e identificar uma "inconsistência" entre ele e as decisões deste plano, **não conserte automaticamente**. Liste a inconsistência no final da sua entrega para revisão humana.

---

## 6. Checklist de verificação

Após aplicar todos os diffs, verifique cada item abaixo. Não marque um item como feito até ter confirmado lendo o arquivo. Se algum item falhar, corrija antes de entregar.

### 6.1 Arquivos criados

- [ ] `references/design.md` existe e contém as 6 seções obrigatórias do template (Patterns Reused, New Patterns Introduced, Cross-Cutting Concerns, ADRs Required, Confidence) mais o schema PAGRL e a Advancement Rule.
- [ ] `docs/adr/0004-counted-pagrl-anti-overconfidence-gate.md` existe e segue o formato de `docs/adr/0001-intentional-manual-execution.md` (Title / Date / Status / Context / Decision / Consequences).

### 6.2 Arquivos modificados

- [ ] `references/specify.md` contém uma seção `## Calibration` antes do parágrafo introdutório.
- [ ] `references/specify.md` substituiu a antiga `### 3. Usage of PAGRL` por `### 3. Counted PAGRL (Schema)` com tabela de campos e exemplo XML.
- [ ] `references/specify.md` contém `### Advancement Rule` listando as quatro condições para escrever `spec.md`.
- [ ] `references/tasks.md` contém uma nova seção `## Counted PAGRL (Schema)` logo após o título H1.
- [ ] `references/tasks.md` contém uma seção `## Advancement Rule` com `<ArtifactPath>` ≠ `console` e `<TableSchemaSource>` ≠ `memory`.
- [ ] `references/quick-mode.md` linha de abertura **não contém a palavra "bypasses"**.
- [ ] `references/quick-mode.md` declara a lista de triggers como **fechada** com a frase exata "This list is **closed**. Variants and paraphrases ... do not qualify."
- [ ] `references/quick-mode.md` contém `## Entry Gate (Counted PAGRL)` antes de `## The Process`.
- [ ] `references/quick-mode.md` aceita o token `ESCALATION` como `<TriggerPhrase>` válido para entrada via Escalation.
- [ ] `SKILL.md` **não contém** as palavras `Bypass Check`, `Pattern-Conforming`, `Structural/Cross-Cutting`, `Confidence Score`, `0.0 to 1.0`.
- [ ] `SKILL.md` contém uma seção `## Default Policy` com a regra de que toda feature entra em Specify por default.
- [ ] `SKILL.md` descreve PAGRL como schema contável e aponta para as references por fase.
- [ ] `SKILL.md` na seção Quick Mode declara explicitamente que ela é a "only exception to the Default Policy".

### 6.3 Verificações de coerência cruzada

- [ ] Cada link relativo no `SKILL.md` aponta para um arquivo que existe (`references/specify.md`, `references/design.md`, `references/tasks.md`, `references/quick-mode.md`, `references/discovery.md`, `references/escalation-phase.md`, `scripts/auditor.sh`).
- [ ] O nome do campo `<Decision>` é consistente entre o `SKILL.md` e cada reference (use exatamente os valores enumerados na tabela de cada reference).
- [ ] O termo "Counted PAGRL" aparece com essa grafia exata em todos os lugares (não "PAGRL Counted", não "Schema PAGRL").
- [ ] Os exemplos XML têm sintaxe válida (tags abrem e fecham, atributos `phase="..."` em aspas duplas).

### 6.4 Verificação anti-improviso (importante)

- [ ] Você **não** adicionou listas de exemplos no `SKILL.md` (exceto triggers de ativação). Releia o `SKILL.md` final inteiramente e procure listas com hifens contendo exemplos de tipos de feature, padrões, ou cenários. Se encontrar, remova.
- [ ] Você **não** adicionou ALWAYS/NEVER em caps no `SKILL.md` ou em references novas/modificadas.
- [ ] Você **não** inventou novos campos no PAGRL além dos listados em §4.1, §4.2 (em `references/design.md`), §4.3, e §4.4.
- [ ] Você **não** removeu a frase calibrada da Decisão 5. Ela deve estar literalmente em `references/specify.md`, `## Calibration`.

---

## 7. Plano de validação (pós-implementação, não parte desta task)

Esta seção descreve o que **outra sessão** fará após a implementação ser entregue. Não execute nada aqui. É apenas para você entender por que cada decisão foi tomada e como sua qualidade será medida.

1. **Re-rodar o benchmark `s3-file-upload`** com a Skill modificada contra modelos grandes (Gemini 3.1 Pro High, GPT-4 class, Claude Opus class). Métrica primária: número de turnos de Q&A na fase Specify. Sucesso = ≥ 1 (zero é regressão).
2. **Verificar o trace** procurando: que `<AssumedValues>` foi declarado vazio quando deveria, que `<ArtifactPath>` foi `.specs/...` e nunca `console`, que `<TableSchemaSource>` foi `references/tasks.md` e nunca `memory`.
3. **Rodar cenários adicionais** (`s1-auth-jwt`, `s2-rbac-roles`, `s4-brownfield`, `s5-ambiguous-spec`, `s6-quick-mode-hotfix`) para detectar:
   - Regressão em features cross-cutting (devem continuar produzindo Design completo).
   - Regressão em quick-mode-hotfix (deve continuar abrindo Quick Mode com `<TriggerPhrase>` casando trigger canônico).
   - Sobrecorreção (turnos de Q&A excessivos em features triviais).

Se a validação revelar problemas que não estão cobertos pelas Decisões 1-8, **não corrija nesta sessão**. Volte ao usuário com o relatório.

---

## 8. Glossário rápido (referência)

- **Counted PAGRL:** versão estruturada do PAGRL onde cada `<phase="...">` tem um conjunto fixo de campos contáveis ou enumeráveis, e a regra de avanço entre fases depende dos valores desses campos.
- **Default Policy:** regra única no `SKILL.md` que envia toda solicitação para Specify, sem classificação prévia pelo modelo.
- **Few-shot ossification:** efeito pelo qual listas de exemplos em prompts viram, na prática, enumerações fechadas que o modelo trata como definição. Razão da Decisão 2.
- **Gravidade semântica:** efeito pelo qual termos com forte associação no pretraining (ex: "multer", "5MB", "jpeg/png") suplantam contexto local específico do projeto. Razão das Decisões 4 e 5.
- **N/A justificado:** valor aceitável em uma seção de `design.md` quando acompanhado de uma frase explicando por que aquela seção não se aplica àquela feature. Substitui a alternativa de "pular a seção".

---

## 9. Resumo executivo (uma frase)

Substitua a discricionariedade do modelo (que falha com modelos grandes overconfident) por contradição estrutural no formato do output (que não falha porque o próprio modelo não consegue se contradizer dentro de um schema sem que isso fique visível), e remova a única licença textual ("Bypass Check") que o modelo confiante usa para generalizar "fases são puláveis quando eu julgar". Tudo isso sem sair do plano puramente textual - sem novos scripts, sem novos hooks, sem mudança de topologia.