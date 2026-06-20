# Implementation Plan: Planner Evolution

**Para o agente implementador:** este documento é auto-suficiente. Você não precisa de
contexto da sessão que o gerou. Leia do início ao fim antes de tocar em qualquer arquivo.
---

## 1. Por que este plano existe

### O problema descoberto no benchmark e2e-v0.2.0

O benchmark tem 6 cenários. S3 (Quick Mode Hotfix) e S4 (Critical Error Escalation)
falhavam completamente antes de qualquer mudança nesta sessão.

**Causa raiz do S3/S4 (já corrigida - ADR-0010):**
O Orchestrator editava `src/` diretamente em vez de seguir o protocolo Quick Mode.
Sem proteção arquitetural em `src/`, LLMs capazes ignoram instruções comportamentais
e tomam o caminho mais curto. A solução foi um PreToolUse hook (`hooks/dag-flow-src-guard.sh`)
que bloqueia fisicamente edições em `src/` para o Orchestrator. Workers bypass via
`DAG_FLOW_WORKER=1`. Isso está **completamente implementado** e não é responsabilidade
deste plano.

**Resultado após ADR-0010:** S3 e S4 passaram para 2/3. O protocolo passou a ser seguido
(PAGRLs criados, Mini-DAG gerado, worker executou). Mas a 3ª assertion falha porque o
Mini-DAG gerado tem qualidade insuficiente.

**Causa raiz do problema restante (este plano):**
```
Quick Mode hoje:
  Diagnosis PAGRL -> Mini-DAG gerado INLINE pelo Orchestrator

Tasks phase hoje:
  tasks.pagrl.xml -> Subagent Planner (define_subagent) -> Planner gera JSON -> Orchestrator commita
```

A assimetria é o problema. O Quick Mode não tem Subagent Planner. O Orchestrator gera
o Mini-DAG inline, de memória, sem skill-informed task specification. Resultado concreto
no S3:

- `done_when_gate: "node -c src/routes/auth.js"` - syntax check apenas, não `npm test`
- `execution_prompt` instrui o worker a usar `req.body.username && req.body.password` -
  fix razoável em produção, mas `test.js` chama `auth({}, res)` com req vazio e espera
  `res.status(200)`. Gate fraco não detectou o erro.

O Orchestrator não leu `test.js` antes de diagnosticar. Não havia nenhum mecanismo
estrutural que forçasse essa leitura.

### O que este plano implementa

1. **Subagent Planner para Quick Mode** - o mesmo mecanismo do Tasks phase, adaptado
2. **Enrichment do Planner do Tasks phase** - o planner atual não lê skill content, só injeta nomes
3. **Schema semi-formal para o Diagnosis PAGRL** - accountability estrutural, não instrução comportamental
4. **validate_pagrl.py** - atualizar validação do quick-mode-diagnosis + novo validador `phase="DagPlanner"`
5. **SKILL.md** - atualizar referências ao novo fluxo
6. **references/planner-template.md** - novo arquivo: template verbatim do system prompt do Planner
   (7 seções: Engineering Identity, Testing Pyramid Thinking, Gate Quality, Context-Blindness, Context Ref Quality, **RTK Compatibility**, Output Contract com dois blocos tagueados `<planner_pagrl>` + `<dag_json>`)
7. **`planner.pagrl.xml`** - implementar o artefato definido no glossário do `CONTEXT.md`: XML cognitive trace emitido pelo Planner antes do JSON. Requer: Output Contract atualizado no template, extração pelo Orchestrator, validação em `write_dag.sh`. O Planner emite o XML via mensagem (tem `enable_write_tools=false`); o Orchestrator extrai e escreve no staging.
8. **`write_dag.sh`** - adicionar assertion de `planner.pagrl.xml` no staging + chamada `validate_pagrl.py --phase DagPlanner`. Este arquivo é removido da lista de proibidos por escopo expandido.

---

## 2. Princípios de design - por que cada decisão foi tomada assim

### Por que Subagent Planner e não instrução no SKILL.md

"Leia test.js antes de diagnosticar" como instrução comportamental seria ignorada por
modelos capazes que já têm o patch evidente. O dag-flow aprendeu isso com ADR-0005
(proteger `.specs/dags/` com chmod 555) e ADR-0010 (proteger `src/` com hook).
A solução sempre é arquitetural, não instrucional.

O Subagent Planner separa planejamento de execução: o Orchestrator faz o diagnóstico
(A), o Planner especializa-se em produzir task specifications de qualidade (B). Sem o
Planner, (A) e (B) competem pelo mesmo context window e (B) perde.

### Por que o Planner lê skills (read_skill) e não só descobre nomes

Hoje `search_skills` encontra o nome da skill -> `skill: "nome"` é injetado na task ->
**o worker** lê a skill em execução. O Planner nunca vê o conteúdo.

Isso cria um gap: o worker aprende COMO executar com qualidade. Mas quem escreveu o
`done_when_gate` e o `context_ref` (o Planner, ou o Orchestrator inline) não tinha esse
conhecimento quando escolheu `node -c` em vez de `npm test`.

Worker e Planner recebem a mesma skill, mas para propósitos diferentes:
- **Planner:** usa para escrever o critério de aceitação correto (gate) e a especificação precisa
- **Worker:** usa para saber como implementar de forma a satisfazer esse critério

### Por que template verbatim para o system prompt do Planner

O Orchestrator improvisa spawn instructions de memória -> variância -> comportamento
não-determinístico. O campo `<DagSchemaSource>` existe exatamente por isso: o modelo
inventava o schema do DAG de pretraining. O mesmo padrão se aplica ao spawn instruction.

Solução: o Orchestrator lê `references/planner-template.md` via file read e usa como
system prompt. Nunca passa pelo text generation do Orchestrator.

### Por que o Output Contract usa dois blocos tagueados e não JSON puro

O Planner tem `enable_write_tools=false` — não pode escrever arquivos. Precisa emitir dois
artefatos via mensagem: o `planner.pagrl.xml` (cognitive trace) e o `dag.json` (executável).

Um separador baseado em tags XML é mais robusto que um separador ad-hoc (linha em branco,
marcador de texto) porque o LLM tem comportamento previsível com estrutura XML explícita.
O Output Contract especifica:

```
<planner_pagrl>
[PAGRL XML aqui]
</planner_pagrl>

<dag_json>
[JSON array aqui]
</dag_json>
```

O Orchestrator extrai cada bloco por tag, escreve separadamente no staging, depois roda
`write_dag.sh`. Emitir `planner.pagrl.xml` no corpo da mensagem como texto não-tagueado
seria `planner.pagrl.xml` gerado pelo Orchestrator — uma fraude, pois o Orchestrator não
tem visibilidade do raciocínio interno do Planner.

A **detecção de escalação** usa a mesma estrutura: ausência de `<dag_json>` é o sinal de
que o Planner escalou em vez de gerar o JSON. O Orchestrator não deve tentar extrair um
bloco inexistente — deve ler o `<planner_pagrl>` para identificar os `<OpenDecisions>`.

### Por que o trigger de escalação combina checklist estrutural e decisão em aberto

O trigger de escalação do plano original era um checklist de 3 condições estruturais
(sem skill para o domínio, sem padrão de verificação, boundary sem cobertura). Isso é
necessário mas não suficiente.

A distinção correta: **ausência de skill com implementação óbvia → Proceed com SE baseline**.
**Ausência de skill com decisão de implementação em aberto → Escalate**. O Planner escalada
quando tem dúvida real que não resolve por SE baseline — não por ansiedade de cobertura.

O campo `<EscalationDecision>` com `<OpenDecisions>` torna isso auditável:
- `<EscalationDecision>Proceed</EscalationDecision>` com `<OpenDecisions/>` vazio → base
  SE foi suficiente, nenhuma decisão de implementação em aberto
- `<EscalationDecision>Escalate</EscalationDecision>` com `<OpenDecisions>` não-vazio →
  decisão específica nomeada, não vibe check

Exemplo de decisão legítima em aberto: "Cache strategy for session tokens: Redis vs
in-memory not defined in spec." Exemplo de escalação ilegítima: "I'm uncertain about
the best approach."

### Por que `covers:` é convenção documental e não capacidade técnica do MCP

O campo `covers:` no frontmatter das quick-capture skills tem valor documental (clareza
para humanos que leem o arquivo) mas **não muda o comportamento do `search_skills` hoje**.

`search_skills` opera por full-text search no conteúdo do SKILL.md. Uma quick-capture
skill é encontrada pela query "auth" se "auth" aparecer no conteúdo — não pelo campo
`covers: domain:auth` em si. O MCP server não indexa frontmatter como campo estruturado.

**Impacto direto:** quick-capture skills com `covers:` bem preenchido mas conteúdo pobre
podem não ser encontradas. O campo não muda o comportamento do MCP.

**Backlog (fora deste plano):** atualizar `mcp/src/` para indexar `covers:` como campo
de busca estruturado, permitindo queries exatas por domínio (`search_skills domain:auth`)
com precedência sobre full-text. Enquanto não implementado, a qualidade do conteúdo da
skill é o que determina a discoverability.

### Por que RTK Compatibility está no template e o que ela resolve

Descoberta durante a validação do S3 v3: o Planner gerou um gate com caminho absoluto
`cd /absolute/path && node test.js`. O auditor (`auditor.py`) envolve todo gate com `rtk`:
`cmd` -> `rtk cmd`. O comando `rtk cd /absolute/path &&...` quebra porque `cd` é um shell
builtin e comandos compostos com `cd &&` não são compatíveis com `rtk`.

**O erro:** exit code 127, `[rtk: No such file or directory (os error 2)]`.

**A causa raiz:** o Planner não sabia que o auditor usa `rtk`, nem que gates devem usar
caminhos relativos. Sem esse conhecimento, usou o caminho absoluto que aparecia no contexto.

**O que `rtk` é:** RTK (Rust Token Killer) é um wrapper CLI que otimiza outputs de
comandos para reduzir tokens. É um recurso obrigatório do ambiente dag-flow, não opcional.
O auditor sempre envolve gates com `rtk` - o Planner precisa saber disso para formatar
gates compatíveis.

**A correção:** seção `RTK Compatibility` no template com duas regras:
1. Sempre usar caminhos relativos em gates, `input_files` e `output_files`
2. Nunca usar `cd /path &&` como prefixo - o workspace root é sempre o diretório de trabalho

Após a correção, o Planner gerou `done_when_gate: "node test.js"` (relativo) -> `rtk node test.js`
-> funcionou. S3 passou 3/3.

**Importante:** `rtk` é um passthrough para comandos que não reconhece - `rtk npm test`,
`rtk node test.js`, `rtk grep` funcionam corretamente.

### Por que a testing pyramid está no SE baseline e não nas skills do projeto

O grill inicial decidiu excluir a testing pyramid do template alegando que é "domain
knowledge que varia por projeto." Essa decisão foi revisada.

A distinção correta é:
- **Framework de pensar** (para cada task, que nível da pirâmide consigo alcançar?) -> SE geral -> pertence ao template
- **Ferramentas específicas** (jest, pytest, coverage 80%, Docker para integration) -> projeto-específico -> pertence às skills

O template contém o FRAMEWORK (testing pyramid como escala de verificação, sintaxe como
last resort), não as FERRAMENTAS. Um Planner sem nenhuma skill encontrada ainda deve
produzir gates melhores que `node -c` - o SE baseline garante esse piso mínimo de
qualidade de verificação.

### Por que CONTEXT.md vai para o Planner em ambas as fases

CONTEXT.md não é um artefato do Specify - é um artefato do **projeto**. É alimentado
durante Specify mas pertence à raiz do projeto e existe independentemente de qualquer
feature. O Planner usa para escrever `context_ref` com a linguagem ubíqua do projeto.
O Auditor stateless usa `context_ref` como única fonte de verdade - vocabulário errado
no `context_ref` = gate semântico degradado.

### Por que o Diagnosis PAGRL tem campos novos e não uma instrução nova

A falha do S3 foi específica: o Orchestrator não leu `test.js`. Um campo `<FilesInspected>`
no PAGRL torna essa omissão visível no audit trail - auto-incriminação estrutural, não
instrução comportamental. O Orchestrator que não declarar `test.js` em `<FilesInspected>`
está dizendo explicitamente que não leu. Isso é auditável.

Os campos livres (`<Intention>`, `<Reasoning>`, `<Decision>`) são mantidos porque o
diagnóstico precisa de espaço para raciocínio rico. O Diagnosis PAGRL é um documento de
investigação, não um formulário. Apenas os campos de accountability são formalizados.

---

## 3. Estado atual dos arquivos (leia antes de modificar)

### `scripts/validate_pagrl.py` - função `validate_quick_mode_diagnosis` (linhas 115-121)

```python
def validate_quick_mode_diagnosis(root: ET.Element):
    decision = get_text(root, "Decision")
    if decision != "Generate a Mini-DAG for the hot-patch.":
        print(f"❌ Validation failed: ...")
        return False
    return True
```

**Problema:** valida apenas `<Decision>`. Não valida `<ReferencesRead>` nem `<FilesInspected>`.
O atributo `phase=` não é verificado para quick-mode (linha 134: condição exclui quick-mode).

### `SKILL.md` - seção Tasks phase (linha 70)

```
Instruct it to read `references/tasks.md`, the spec, the design, and generate the JSON AST,
passing it back to you via message.
```

**Problemas:**
- Não menciona `tasks.pagrl.xml` content verbatim
- Não menciona CONTEXT.md
- Não menciona read_skill (só search_skills está em references/tasks.md como responsabilidade do Orchestrator)

### `SKILL.md` - seção Quick Mode (linha 99)

```
Write the Mini-DAG to `.specs/staging/[issue_id]/dag.json`.
```

**Problema:** instrui geração inline do Mini-DAG. Não menciona Subagent Planner.

### `references/tasks.md` - MCP Skill Injection Rule (linhas 93-94)

```
The Orchestrator MUST use a parallel search strategy for `search_skills`.
```

**Problema:** atribui search_skills ao Orchestrator. Após a mudança, é o Subagent que faz.

### `references/quick-mode.md` - Diagnosis PAGRL schema (linhas 69-76)

```xml
<PAGRL>
<Intention>Diagnose bug X</Intention>
<Rules>Read-only access to source code. Do not write fixes directly.</Rules>
<Reasoning>Evaluate stack trace, logs, and affected files to identify the root cause.</Reasoning>
<Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>
```

**Problemas:**
- Sem atributo `phase=`
- Sem `<ReferencesRead>`
- Sem `<FilesInspected>`
- Sem tabela de campos com "Why it exists"

### `references/tasks.md` - spawn instruction (linhas 44-48)

```
2. Spawn a Subagent Planner (`define_subagent` with `enable_write_tools=false`) to generate
the JSON DAG and send it back to you via message.
```

**Problemas:**
- Sem instrução de ler planner-template.md
- Sem especificação do user message composition
- Sem menção de CONTEXT.md
- Sem menção de read_skill no Subagent
- Sem ordenação explícita (escrever XML antes de spawnar)

### `.dag-flow/skills/coding-guidelines/SKILL.md` - formato atual de skills locais

```yaml
---
name: coding-guidelines
description: Behavioral guidelines...
metadata:
  author: ale
  version: '1.0.0'
---
```

**Observação:** skills locais do projeto usam `name`, `description`, `metadata` no frontmatter.
O campo `covers:` não existe ainda - será introduzido como convenção nova.

### Estado verificado (2026-06-20 — codegraph + context-mode)

Re-verificação automatizada do repo antes de implementar. Use como baseline; não substitui
leitura dos arquivos na hora do edit.

| Artefato | Estado | Evidência |
|---|---|---|
| `references/planner-template.md` | **MISSING** | `test -f` via context-mode |
| `references/quick-mode.md` §1.5 | **MISSING** | Sem `### 1.5` / `Planner Invocation` |
| `references/quick-mode.md` §2 | **CONFLITANTE** | L82: Orchestrator `search_skills`; L89: Orchestrator escreve `dag.json` inline |
| `scripts/validate_pagrl.py` | **INCOMPLETO** | `choices` sem `dag-planner`; `validate_quick_mode_diagnosis` só checa `<Decision>` |
| `scripts/write_dag.sh` | **INCOMPLETO** | Zero refs a `planner.pagrl` / `dag-planner` (codegraph: bash não indexado; ctx confirma) |
| Testes `validate_pagrl` | **AUSENTES** | codegraph: ⚠️ no covering tests; nenhum `*pagrl*test*` em `scripts/` ou `docs/` |
| MCP `covers:` index | **NÃO IMPLEMENTADO** | `mcp/src/registry.ts` indexa `name`, `description`, `category` via Fuse.js; `covers` ausente |

**Blast radius (codegraph):** `validate_quick_mode_diagnosis` tem 1 caller (`main()` em
`validate_pagrl.py`). Mudanças em Task 3 são localizadas — sem callers externos além de
`write_dag.sh` (shell, invoca via CLI).

**MCP search_skills (codegraph):** `registry.ts` parseia frontmatter com `gray-matter` mas
só persiste `name`, `description`, `category`, `author`, `version`. Fuse busca em
`name` (0.45), `triggers` (0.3), `description` (0.2), `category` (0.05). Campo `covers:`
no frontmatter de quick-capture skills **não entra no índice** — confirmado em código.

---

## 4. Tasks de implementação

### Task 1 - Criar `references/planner-template.md`

**Arquivo:** `/workspaces/dag-flow/references/planner-template.md` (novo)

**Por que este arquivo existe:**
O system prompt do Subagent Planner precisa ser um template verbatim carregado via file
read pelo Orchestrator - nunca gerado de memória. Este arquivo é a fonte única desse
template.

O template define dois tipos de conhecimento:
- **Identidade SE (sempre presente):** o Planner pensa como engenheiro sênior, não como
  formatador de JSON. Isso inclui o framework de pensar nos níveis da pirâmide de testes
  para cada task. A testing pyramid como FRAMEWORK DE PENSAMENTO (que nível consigo
  alcançar?) é SE-geral. As ferramentas específicas (jest, pytest, coverage thresholds)
  são projeto-específicas e pertencem às skills do projeto.
- **Constraints mecânicos:** gate two-leg test, context-blindness hard rule, output contract.

**Conteúdo a escrever** (ver `references/planner-template.md` - já implementado):

O template contém 8 seções:

| Seção | Propósito |
| --- | --- |
| Engineering Identity | Identidade do Planner como engenheiro sênior + **sequência de raciocínio pré-output obrigatória** (6 etapas: ler spec → identificar domínios → buscar skills → detectar gaps → desenhar gates → emitir PAGRL + JSON). 3 perguntas obrigatórias antes de escrever cada task: "como saberei que está feito?", "o gate vai pegar o que pode dar errado?", "é atômico?" |
| Testing Pyramid Thinking | Para cada task com código, perguntar qual nível da pirâmide é alcançável (syntax -> unit -> integration -> E2E). Preferir sempre o mais alto. Syntax-only é last resort, nunca default. |
| Gate Quality - Two-Leg Test | Shell vs LLM-auditor: heurístico de decisão. |
| Context-Blindness Hard Rule | Strings e checks estruturais -> sempre shell determinístico. |
| Context Ref Quality | `context_ref` deve ser self-contained para o Auditor stateless. Exemplo fraco vs forte. |
| **RTK Compatibility** | **Descoberta em validação (S3 v3).** O auditor envolve todo gate com `rtk`. Gates devem usar caminhos relativos, sem `cd /path &&`. Inclui regras para `input_files` e `output_files`. |
| **Escalation Heuristic** | Quando escalar vs. proceder com SE baseline. Trigger: ausência de skill com decisão de implementação em aberto (não mera ausência de skill). `<OpenDecisions>` vazio → Proceed. Não-vazio → Escalate nomeando o gap específico. |
| Output Contract | Dois blocos tagueados: `<planner_pagrl>[XML]</planner_pagrl>` seguido de `<dag_json>[JSON array]</dag_json>`. Inclui schema completo do `<PAGRL phase="DagPlanner">` com exemplo. Sem prosa fora das tags. |

**Acceptance criteria:**
- [ ] Arquivo existe em `references/planner-template.md`
- [ ] Contém cabeçalho explicando uso verbatim
- [ ] 8 seções conforme tabela acima
- [ ] Testing pyramid como framework de pensamento (sem ferramentas específicas)
- [ ] RTK Compatibility com regras de caminhos relativos e proibição de `cd &&`
- [ ] Cada seção tem exemplos concretos (correto/incorreto onde aplicável)
- [ ] NÃO contém coverage thresholds, ferramentas de teste específicas, ou convenções de projeto
- [ ] Seção "Engineering Identity" inclui sequência de raciocínio pré-output (6 etapas)
- [ ] Seção "Escalation Heuristic" com distinção proceed vs escalate baseada em `<OpenDecisions>`
- [ ] Output Contract especifica dois blocos tagueados: `<planner_pagrl>` + `<dag_json>`
- [ ] Output Contract inclui schema completo do `<PAGRL phase="DagPlanner">` com 5 campos e exemplo:
  - `<DomainsIdentified>` - domínios técnicos identificados da spec ANTES da busca de skills
  - `<SkillsApplied>` - skills encontradas e lidas via `read_skill`
  - `<EscalationDecision>` - `Proceed` ou `Escalate` + `<OpenDecisions>` se escalando
  - `<GateReasoning>` - por que o nível da testing pyramid escolhido para cada task
  - `<TasksCount>` - número de tasks geradas (deve ser > 0)

**Verificação:** leia o arquivo e confirme que um Planner sem nenhuma skill encontrada
ainda produziria gates melhores que syntax-only com caminhos relativos - o SE baseline garante esse piso.

**Dependências:** nenhuma.
**Escopo:** XS - 1 arquivo novo, ~40 linhas.

---

### Task 2 - Atualizar schema do Diagnosis PAGRL em `references/quick-mode.md`

**Arquivo:** `references/quick-mode.md`

**Localização exata:** seção `### 1. Diagnosis (Second PAGRL)` - o parágrafo de instrução
e o bloco XML de exemplo.

**Por que esta mudança:**
O S3 falhou porque o Orchestrator não leu `test.js` antes de diagnosticar. O campo
`<Reasoning>` livre parecia completo mas escondia investigação incompleta. A solução é
estrutural: campos contáveis que tornam a omissão visível (auto-incriminação), não
instrução que pode ser ignorada.

**Parágrafo de instrução atual** (substituir pela versão abaixo):
```
This PAGRL is the *second* one in Quick Mode...
Even in an emergency, the Orchestrator NEVER directly edits functional code...
```

**Parágrafo atualizado - adicionar antes do bloco XML:**
```
Before writing this PAGRL, the Orchestrator MUST:
1. Read the affected source file(s) using read-only tools.
2. Read any test files for the affected module (e.g., `test.js`, `*.test.js`, `*.spec.js`).
   Test files define the expected behavior - the fix specification must align with what
   tests check, not with what "would make sense in production" in isolation.
3. Read `CONTEXT.md` if it exists, to use the project's domain language in the diagnosis.

Declare all files read in `<FilesInspected>`. If `test.js` is not in `<FilesInspected>`,
you are declaring you did not read it - and this will be visible in the audit trail.
```

**Schema atualizado - substituir o XML de exemplo atual por:**
```xml
<PAGRL phase="quick-mode-diagnosis">
  <ReferencesRead>references/quick-mode.md, CONTEXT.md</ReferencesRead>
  <FilesInspected>src/routes/auth.js, test.js</FilesInspected>
  <Intention>Diagnose: /login returns 500 due to undefinedVar</Intention>
  <Reasoning>
    Read src/routes/auth.js - undefinedVar on line 3 causes ReferenceError (500).
    Read test.js - calls auth({}, res) with empty req, expects res.status(200).
    Fix must remove the guard and call res.status(200) unconditionally.
  </Reasoning>
  <Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>
```

**Tabela de campos a adicionar logo após o XML de exemplo:**

| Campo | Tipo | Por que existe |
|---|---|---|
| `phase="quick-mode-diagnosis"` | atributo XML | Permite ao `validate_pagrl.py` distinguir Entry Gate de Diagnosis. Sem ele, a validação não sabe qual schema aplicar. |
| `<ReferencesRead>` | Lista separada por vírgula | Força declaração de quais arquivos de protocolo foram lidos. Omitir `CONTEXT.md` aqui é auto-incriminante - o `context_ref` vai usar vocabulário errado. |
| `<FilesInspected>` | Lista separada por vírgula | Força declaração de quais arquivos de código e teste foram lidos durante a investigação. Se `test.js` não aparecer aqui, a omissão é visível no audit trail. Este campo é a solução estrutural para a falha do S3. |

**Campos mantidos como livres (não formalizar):**
`<Intention>`, `<Reasoning>`, `<Decision>` - o diagnóstico precisa de espaço para
raciocínio rico. Apenas os campos de accountability são contáveis.

**IMPORTANTE:** `<Decision>` deve continuar sendo `"Generate a Mini-DAG for the hot-patch."`
exatamente - o `validate_pagrl.py` verifica esse string exato (linha 117).

**Acceptance criteria:**
- [ ] `phase="quick-mode-diagnosis"` no XML de exemplo
- [ ] `<ReferencesRead>` adicionado com tabela "Why it exists"
- [ ] `<FilesInspected>` adicionado com tabela "Why it exists"
- [ ] Parágrafo de instrução atualizado com os 3 passos obrigatórios antes de escrever o PAGRL
- [ ] Campos livres preservados
- [ ] `<Decision>` mantém valor exato `"Generate a Mini-DAG for the hot-patch."`

**Verificação:** leia o schema e confirme que um Orchestrator que não leu `test.js`
precisaria escrever `<FilesInspected>src/routes/auth.js</FilesInspected>` - omissão
visível, não silenciosa.

**Dependências:** nenhuma.
**Escopo:** S - 1 arquivo, seção localizada.

---

### Task 3 - Atualizar `scripts/validate_pagrl.py`

**Arquivo:** `scripts/validate_pagrl.py`

**Função a atualizar:** `validate_quick_mode_diagnosis` (linhas 115-121)

**Estado atual:**
```python
def validate_quick_mode_diagnosis(root: ET.Element):
    decision = get_text(root, "Decision")
    if decision != "Generate a Mini-DAG for the hot-patch.":
        print(f"❌ Validation failed: <Decision> expected 'Generate a Mini-DAG...'")
        return False
    return True
```

**Estado desejado:**
```python
def validate_quick_mode_diagnosis(root: ET.Element):
    # Validate <ReferencesRead> is not empty
    if is_empty(root, "ReferencesRead"):
        print("❌ Validation failed: <ReferencesRead> must not be empty. "
              "Declare which protocol files were read (at minimum: references/quick-mode.md).")
        return False

    # Validate <FilesInspected> is not empty
    if is_empty(root, "FilesInspected"):
        print("❌ Validation failed: <FilesInspected> must not be empty. "
              "Declare which source and test files were read during diagnosis.")
        return False

    decision = get_text(root, "Decision")
    if decision != "Generate a Mini-DAG for the hot-patch.":
        print(f"❌ Validation failed: <Decision> expected "
              f"'Generate a Mini-DAG for the hot-patch.', got '{decision}'")
        return False

    return True


def validate_dag_planner(root: ET.Element):
    # Validate <DomainsIdentified> is not empty
    if is_empty(root, "DomainsIdentified"):
        print("❌ Validation failed: <DomainsIdentified> must not be empty. "
              "Declare the technical domains identified from the spec before skill search.")
        return False

    # Validate <TasksCount> is a positive integer
    tasks_count = get_text(root, "TasksCount")
    try:
        if int(tasks_count) <= 0:
            raise ValueError
    except (ValueError, TypeError):
        print(f"❌ Validation failed: <TasksCount> must be a positive integer, got '{tasks_count}'")
        return False

    # Validate <EscalationDecision> is a known value
    escalation = get_text(root, "EscalationDecision")
    if escalation not in ("Proceed", "Escalate"):
        print(f"❌ Validation failed: <EscalationDecision> must be 'Proceed' or 'Escalate', got '{escalation}'")
        return False

    # If escalating, <OpenDecisions> must not be empty
    if escalation == "Escalate" and is_empty(root, "OpenDecisions"):
        print("❌ Validation failed: <EscalationDecision> is 'Escalate' but <OpenDecisions> is empty. "
              "Name the specific open decision that requires user input.")
        return False

    return True
```

**Observação sobre o atributo `phase=`:**
O código atual (linha 133-137) só verifica `phase=` para specify/design/tasks - Quick Mode
é lenient. Não é necessário adicionar validação de `phase=` para quick-mode-diagnosis
neste momento: o `--phase quick-mode-diagnosis` passado pelo `write_dag.sh` já seleciona
a função correta. O atributo `phase=` no XML serve ao audit trail, não à routing.

Adicionar também ao `main()`: o mapeamento `"dag-planner"` → `validate_dag_planner` e
o valor `"dag-planner"` ao argumento `--phase choices`.

**Acceptance criteria:**
- [ ] `validate_quick_mode_diagnosis` valida `<ReferencesRead>` não-vazio
- [ ] `validate_quick_mode_diagnosis` valida `<FilesInspected>` não-vazio
- [ ] Mensagens de erro são informativas (descrevem o que preencher)
- [ ] Validação de `<Decision>` preservada com string exato
- [ ] `validate_dag_planner` valida `<DomainsIdentified>` não-vazio
- [ ] `validate_dag_planner` valida `<TasksCount>` é inteiro positivo
- [ ] `validate_dag_planner` valida `<EscalationDecision>` é `Proceed` ou `Escalate`
- [ ] `validate_dag_planner` valida que `<OpenDecisions>` não-vazio quando `Escalate`
- [ ] `main()` inclui `"dag-planner"` nos choices de `--phase`

**Verificação:**
```bash
# Criar um PAGRL de diagnosis sem FilesInspected e verificar que falha:
cat > /tmp/test_diagnosis.pagrl.xml << 'EOF'
<PAGRL phase="quick-mode-diagnosis">
  <ReferencesRead>references/quick-mode.md</ReferencesRead>
  <Intention>Test</Intention>
  <Reasoning>Test</Reasoning>
  <Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>
EOF
python3 scripts/validate_pagrl.py --phase quick-mode-diagnosis /tmp/test_diagnosis.pagrl.xml
# Esperado: ❌ Validation failed: <FilesInspected> must not be empty.
```

**Dependências:** Task 2 (schema deve estar definido antes de implementar o validador).
**Escopo:** S — 1 função nova + dispatch em `main()` (~45 linhas; escopo original subestimado).

---

### Task 3b - Testes unitários para `validate_pagrl.py` (novos phases)

**Arquivo:** `scripts/test_validate_pagrl.py` (novo)

**Por que esta mudança:**
Codegraph reporta ⚠️ no covering tests para `validate_quick_mode_diagnosis`. Task 3 adiciona
regras novas — sem testes, regressões passam silenciosamente até o benchmark E2E.

**Fixtures mínimos a cobrir:**

| Caso | Phase | Esperado |
|---|---|---|
| Diagnosis sem `<FilesInspected>` | `quick-mode-diagnosis` | FAIL |
| Diagnosis completo | `quick-mode-diagnosis` | PASS |
| DagPlanner `Escalate` sem `<OpenDecisions>` | `dag-planner` | FAIL |
| DagPlanner `Proceed` com campos válidos | `dag-planner` | PASS |
| DagPlanner `TasksCount` = 0 | `dag-planner` | FAIL |

**Acceptance criteria:**
- [ ] Arquivo `scripts/test_validate_pagrl.py` existe
- [ ] Usa `subprocess` ou import direto — sem dependências externas além de stdlib
- [ ] Todos os 5 casos acima passam via `python3 scripts/test_validate_pagrl.py`
- [ ] Testes não dependem de arquivos em `.specs/staging/` (fixtures inline em `/tmp` ou strings)

**Verificação:**
```bash
python3 scripts/test_validate_pagrl.py
# Esperado: all passed
```

**Dependências:** Task 3.
**Escopo:** S — 1 arquivo novo, ~80 linhas.

---

### Task 4 - Adicionar Planner Invocation ao Quick Mode

**Arquivo:** `references/quick-mode.md`

**Localização exata:** inserir nova seção `### 1.5. Planner Invocation` entre
`### 1. Diagnosis (Second PAGRL)` e `### 2. Mini-DAG Generation`.

**Por que esta mudança:**
Quick Mode não tinha fase de planejamento dedicada. O Orchestrator gerava o Mini-DAG
inline após o diagnóstico, sem consultar skills do projeto para informar gates e task
descriptions. Esta seção adiciona o mesmo mecanismo já existente no Tasks phase
(`define_subagent`) ao Quick Mode.

**Conteúdo a inserir:**

```markdown
### 1.5. Planner Invocation

After completing the Diagnosis PAGRL, the Orchestrator MUST spawn a Subagent Planner
to generate the Mini-DAG JSON. Do NOT generate the JSON inline - this is what produces
weak gates and imprecise task descriptions.

**Step 1 - Load the system prompt template:**
Use the `view_file` tool to read `references/planner-template.md` verbatim.
This is the system prompt for the Subagent. Do not paraphrase or reconstruct from memory.

**Step 2 - Compose the user message with this structure:**
```
Context: [paste the quickmode-diagnosis.pagrl.xml content verbatim]
Affected files: [list of file paths from <FilesInspected>]
Error log: [raw stack trace or log content that triggered this hotfix, if available]
CONTEXT.md path: [path to project CONTEXT.md if it exists, e.g. "CONTEXT.md"]
Reference: Read `references/quick-mode.md` for the Mini-DAG JSON schema and field requirements.

Instructions:
1. Call search_skills with queries based on the diagnosis (domain, file types, error type).
2. For each skill found, call read_skill to learn project conventions before writing tasks.
3. Apply skill knowledge to write precise context_ref, execution_prompt, and done_when_gate.
4. If no skill covers the primary domain AND no skill defines a verification pattern for
   this class of change: see "Structural Escalation" below before emitting output.
5. Return your response using the two-block Output Contract from the system prompt:
   `<planner_pagrl>` (PAGRL XML) followed by `<dag_json>` (JSON array). No prose outside
   the tags, no markdown fences.
```

**Step 3 - Spawn:**
`define_subagent` with `enable_mcp_tools=true`, `enable_write_tools=false`,
`system_prompt=<template from Step 1>`, `first_message=<user message from Step 2>`.

**Step 4 - Receive and detect:**
The Subagent message contains either (a) both blocks or (b) only `<planner_pagrl>`:

- **If the message contains `<dag_json>`** (normal flow):
  Extract both blocks. Write `planner.pagrl.xml` and `dag.json` to
  `.specs/staging/[issue_id]/`. Run `write_dag.sh`.
  If `write_dag.sh` fails: spawn a **new** Subagent session (same system prompt,
  original user message + broken content + validation error appended). One retry only.
  Do not attempt to fix the JSON or XML manually.

- **If the message contains no `<dag_json>`** (escalation flow):
  Read the `<planner_pagrl>` block to identify the `<OpenDecisions>` listed.
  The Orchestrator conducts a focused Socratic session with the user — ask targeted
  questions about verification strategy and what "done" looks like for the specific
  open decisions. Do NOT ask broad requirements questions (Specify's role).
  After the session, **the Orchestrator writes** the user's answers as a draft skill:
  `.dag-flow/skills/[domain-name]/SKILL.md` (the Subagent cannot write — it has
  `enable_write_tools=false`). Then spawn a **new** Subagent session; `search_skills`
  will find the newly written skill.

**Structural Escalation - when to involve the user:**
The Subagent escalates when its `<EscalationDecision>` is `Escalate` — triggered by
either a structural gap OR an open implementation decision:
- No skill covers the primary domain of the failing code, AND the implementation path
  is not obvious from SE baseline alone (open decision)
- No skill defines a verification pattern for this class of change
- The task touches a system boundary (auth, migrations, external APIs) with no coverage

When escalating, the Subagent must name the specific gap in `<OpenDecisions>` — not
"I'm uncertain" but "Cache strategy for session tokens: Redis vs in-memory not defined."
The Subagent returns its `<planner_pagrl>` block **without** `<dag_json>`.

The Orchestrator detects absence of `<dag_json>` and reads `<OpenDecisions>` to conduct
a focused Socratic session with the user. After the session, **the Orchestrator writes**
the draft skill (the Subagent cannot write — `enable_write_tools=false`):
`.dag-flow/skills/[domain-name]/SKILL.md` with frontmatter:
```yaml
---
name: [domain-name]
description: [what this skill teaches]
covers:
  - domain:[primary-domain]
  - boundary:[system-boundary-if-applicable]
  - verification:[test-type]
---
[directives from user's answers]
```

**Nota sobre `covers:` e discoverability:** o campo `covers:` é uma convenção documental.
`search_skills` opera por full-text search — a skill é encontrada pelo conteúdo semântico,
não pelo campo `covers:` em si. Ver seção 2 ("Por que `covers:` é convenção documental")
para o backlog de atualização do MCP server.

The new Planner session spawned after skill creation will call `search_skills` normally
and find the newly written skill on disk. The user can improve it later with the
skill-creator skill.

**Overlapping coverage:** if multiple skills cover the same domain, most-specific wins
(the skill with the most `covers:` claims is applied).
```

**Acceptance criteria:**
- [ ] Seção `### 1.5. Planner Invocation` inserida entre Diagnosis e Mini-DAG Generation
- [ ] Steps 1-3 (load template, compose user message, spawn) claramente definidos
- [ ] Step 4 com protocolo de detecção: `<dag_json>` presente → fluxo normal; ausente → escalação
- [ ] Fluxo normal: extrair dois blocos, escrever `planner.pagrl.xml` + `dag.json` no staging
- [ ] Retry (falha de validação): nova sessão Subagent com contexto original + erro, uma vez
- [ ] Fluxo de escalação: Orchestrator lê `<OpenDecisions>`, conduz Socratic session, **escreve** skill
- [ ] Instrução explícita: Subagent chama search_skills + read_skill
- [ ] Estrutura do user message especificada (PAGRL verbatim, file paths, log, CONTEXT.md)
- [ ] Trigger de escalação: checklist estrutural OU decisão em aberto (não vibe check)
- [ ] Formato da quick-capture skill com frontmatter `covers:` documentado + nota de limitação MCP
- [ ] Menção ao write_dag.sh para validação
- [ ] **Task 4b concluída:** §2 deconflictado (ver abaixo)

**Verificação:** leia o fluxo completo de Quick Mode após a mudança. A sequência deve ser:
Entry Gate -> Diagnosis PAGRL (com FilesInspected) -> Planner Invocation -> Mini-DAG Generation.

**Dependências:** Task 1 (planner-template.md deve existir), Task 2 (schema atualizado).
**Escopo:** M - 1 arquivo, nova seção de ~50 linhas.

---

### Task 4b - Deconflictar `references/quick-mode.md` §2 (Mini-DAG Generation)

**Arquivo:** `references/quick-mode.md`

**Por que esta mudança:**
Verificação context-mode (2026-06-20) confirmou que §2 ainda atribui `search_skills` e
escrita de `dag.json` ao Orchestrator (linhas 81–89). Com §1.5, isso gera instruções
contraditórias — implementador ou Orchestrator podem seguir o caminho errado.

**Mudanças obrigatórias em `### 2. Mini-DAG Generation`:**

1. **Remover** o bloco `**Skill Injection Rule:**` que manda o Orchestrator chamar
   `search_skills` e gerar o JSON após o PAGRL.
2. **Substituir** `**Artifact Generation & Gating:**` por texto que:
   - Diz que geração do JSON é responsabilidade do Subagent Planner (§1.5)
   - Lista o que o Orchestrator escreve no staging: `quickmode-entry.pagrl.xml`,
     `quickmode-diagnosis.pagrl.xml`, `planner.pagrl.xml` (extraído do Subagent),
     `dag.json` (extraído do Subagent)
   - Mantém o passo `write_dag.sh [issue_id] --phase quick-mode`
3. **Manter** em §2 apenas: schema do `dag.json`, notas de `context_ref`, `dependencies`,
   `done_when_gate`, `T-Final`, Financial Firewall — documentação de formato, não protocolo de spawn.

**Acceptance criteria:**
- [ ] §2 não menciona Orchestrator chamando `search_skills`
- [ ] §2 não instrui geração inline do Mini-DAG
- [ ] §2 referencia §1.5 para protocolo de spawn/extração
- [ ] Schema JSON e field requirements preservados integralmente

**Verificação:**
```bash
# Nenhuma linha em §2 deve atribuir search_skills ao Orchestrator:
python3 -c "
import re
t=open('references/quick-mode.md').read()
s2=t[t.find('### 2. Mini-DAG'):t.find('### 3. Execution')]
assert 'Orchestrator MUST use the \`search_skills\`' not in s2
assert 'Write the Mini-DAG JSON' not in s2 or 'extract' in s2.lower()
print('§2 deconflict OK')
"
```

**Dependências:** Task 4 (§1.5 deve existir primeiro).
**Escopo:** XS — 1 arquivo, ~15 linhas removidas/substituídas.

---

### Task 5 - Enriquecer spawn instruction do Planner no Tasks phase

**Arquivos:** `references/tasks.md` E `SKILL.md`

#### 5a - `references/tasks.md`

**Localização:** seção `## Advancement Rule`, bloco `When advancing, you MUST:` (linhas 44-48).

**Estado atual:**
```
When advancing, you MUST:
1. Write your `tasks.pagrl.xml` to the staging area `.specs/staging/[feature]/`.
2. Spawn a Subagent Planner (`define_subagent` with `enable_write_tools=false`) to generate
   the JSON DAG and send it back to you via message.
3. Write the JSON to `.specs/staging/[feature]/dag.json`.
4. Use the `run_command` tool to execute `<path-to-skill>/scripts/write_dag.sh [feature] --phase tasks`.
```

**Estado desejado:**
```
When advancing, you MUST:
1. Write your `tasks.pagrl.xml` to the staging area `.specs/staging/[feature]/`.
   (You MUST write the XML BEFORE spawning - the Subagent receives its content verbatim.)
2. Use the `view_file` tool to read `references/planner-template.md` verbatim.
   This is the system prompt for the Subagent. Do not paraphrase or reconstruct from memory.
3. Spawn a Subagent Planner (`define_subagent` with `enable_mcp_tools=true`,
   `enable_write_tools=false`) with:
   - system_prompt: the verbatim content of `references/planner-template.md`
   - first_message: (a) the content of `tasks.pagrl.xml` just written, verbatim;
     (b) paths to `.specs/features/[feature]/spec.md`,
     `.specs/features/[feature]/design.md`, `references/tasks.md`;
     (c) path to `CONTEXT.md` if it exists at the project root;
     (d) instruction: "Call search_skills in parallel for all technical domains in the
     spec, then call read_skill on each found skill before generating the JSON. Return
     your response using the two-block format specified in the Output Contract."
4. Receive and detect:
   - If the Subagent message contains `<dag_json>` (normal flow):
     Extract both blocks. Write `planner.pagrl.xml` and `dag.json` to
     `.specs/staging/[feature]/`. Run `write_dag.sh --phase tasks`.
     If `write_dag.sh` fails: spawn a new Subagent session (same system prompt,
     original user message + broken content + validation error appended). One retry.
   - If the Subagent message contains no `<dag_json>` (escalation flow):
     Read `<OpenDecisions>` in the `<planner_pagrl>` block. Conduct a focused Socratic
     session with the user. The Orchestrator writes the draft skill to
     `.dag-flow/skills/[domain-name]/SKILL.md`. Spawn a new Subagent session.
5. Use the `run_command` tool to execute `<path-to-skill>/scripts/write_dag.sh [feature] --phase tasks`.
```

**MCP Skill Injection Rule - atualizar** (seção `### 2. Generating the JSON DAG`):

Estado atual:
```
**The MCP Skill Injection Rule:**
The Orchestrator MUST use a **parallel search** strategy for `search_skills`...
```

Estado desejado:
```
**The MCP Skill Injection Rule:**
The Subagent Planner is responsible for skill discovery and loading - not the Orchestrator.
The Subagent calls `search_skills` in parallel across all technical domains identified in
spec.md and design.md, then calls `read_skill` on each found skill. It applies the skill
content to write precise `context_ref`, `execution_prompt`, and `done_when_gate` - not
just to assign the `skill:` field. The `skill:` field in the task JSON points the worker
to the same skill for execution-time learning.
```

#### 5b - `SKILL.md`

**Localização:** seção `## 3. Phase: Tasks`, parágrafo `**Subagent Relay (Crucial):**` (linha 70).

**Estado atual:**
```
**Subagent Relay (Crucial):** To protect the physical vault, the JSON DAG is generated by a
Subagent without write permissions. First, write your `tasks.pagrl.xml` to
`.specs/staging/[feature]/`. Then, spawn a Subagent Planner (`define_subagent`) with
`enable_mcp_tools=true` and `enable_write_tools=false`. Instruct it to read
`references/tasks.md`, the spec, the design, and generate the JSON AST, passing it back
to you via message.
```

**Estado desejado:**
```
**Subagent Relay (Crucial):** To protect the physical vault, the JSON DAG is generated by
a Subagent without write permissions. First, write `tasks.pagrl.xml` to staging. Then,
use `view_file` to read `references/planner-template.md` verbatim - this is the Subagent
system prompt. Spawn the Subagent Planner (`define_subagent`) with `enable_mcp_tools=true`
and `enable_write_tools=false`, passing the template as system prompt and a user message
containing: the tasks.pagrl.xml content, paths to spec.md, design.md, references/tasks.md,
and CONTEXT.md (if present). The Subagent will call search_skills + read_skill before
generating the JSON. Full spawn protocol in `references/tasks.md`.
```

**Localização:** seção `### Emergency / Quick Mode`, linha 99.

**Estado atual:**
```
- **Artifact Generation & Gating:** Write the Mini-DAG to `.specs/staging/[issue_id]/dag.json`.
```

**Estado desejado:**
```
- **Artifact Generation & Gating:** After the Diagnosis PAGRL, spawn a Subagent Planner
  to generate the Mini-DAG JSON (do NOT generate inline). Full spawn protocol in
  `references/quick-mode.md` section 1.5. Write the returned JSON to
  `.specs/staging/[issue_id]/dag.json`. You MUST emit TWO XML files:
  `quickmode-entry.pagrl.xml` and `quickmode-diagnosis.pagrl.xml` in the same staging
  folder. Then use `run_command` to execute `write_dag.sh [issue_id] --phase quick-mode`.
```

**Acceptance criteria:**
- [ ] `references/tasks.md`: ordenação explícita (escrever XML antes de spawnar)
- [ ] `references/tasks.md`: instrução de ler planner-template.md verbatim
- [ ] `references/tasks.md`: user message composition especificada (tasks.pagrl.xml + paths + CONTEXT.md)
- [ ] `references/tasks.md`: Step 4 com protocolo de detecção `<dag_json>` presente/ausente
- [ ] `references/tasks.md`: MCP Skill Injection Rule atualizada (é o Subagent, não o Orchestrator)
- [ ] `SKILL.md` Tasks phase: parágrafo Subagent Relay atualizado
- [ ] `SKILL.md` Quick Mode: instrução de gerar inline substituída por referência ao Planner

**Dependências:** Task 1 (planner-template.md deve existir), Task 4, Task 4b.
**Escopo:** S - 2 arquivos, seções localizadas.

---

---

### Task 6 - Atualizar `scripts/write_dag.sh`

**Arquivo:** `scripts/write_dag.sh`

**Por que esta mudança:**
Com a adição do `planner.pagrl.xml` ao Output Contract do Planner, o `write_dag.sh` precisa
assertar a presença deste arquivo no staging antes de mover o DAG para o vault. Sem essa
assertion, o audit trail do Planner fica incompleto e silenciosamente ausente.

Este arquivo foi removido da lista de proibidos (seção 7) com justificativa: scope expandido
para implementar `planner.pagrl.xml` requer duas adições cirúrgicas, não reescrita.

**Mudanças a adicionar** (para ambos `--phase tasks` e `--phase quick-mode`):

```bash
# Após a validação do tasks.pagrl.xml / quickmode-diagnosis.pagrl.xml:

# Assert planner.pagrl.xml exists
PLANNER_PAGRL="$STAGING_DIR/planner.pagrl.xml"
if [ ! -f "$PLANNER_PAGRL" ]; then
  echo "❌ Error: planner.pagrl.xml not found in $STAGING_DIR"
  echo "   The Orchestrator must extract the <planner_pagrl> block from the Subagent message"
  echo "   and write it to $PLANNER_PAGRL before running this script."
  exit 1
fi

# Validate planner.pagrl.xml schema
python3 scripts/validate_pagrl.py --phase dag-planner "$PLANNER_PAGRL"
if [ $? -ne 0 ]; then
  echo "❌ Planner PAGRL validation failed. Fix the issues above before retrying."
  exit 1
fi
```

**Acceptance criteria:**
- [ ] Assertion de existência de `planner.pagrl.xml` adicionada para `--phase tasks`
- [ ] Assertion de existência de `planner.pagrl.xml` adicionada para `--phase quick-mode`
- [ ] Chamada `validate_pagrl.py --phase dag-planner` adicionada para ambas as fases
- [ ] Mensagem de erro é informativa: descreve o que o Orchestrator deve fazer
- [ ] Lógica existente de validação do DAG JSON e das outras PAGRLs preservada

**Verificação:**
```bash
# Tentar rodar write_dag.sh sem planner.pagrl.xml no staging:
# Esperado: ❌ Error: planner.pagrl.xml not found in ...

# Após escrever planner.pagrl.xml válido:
# Esperado: fluxo normal continua
```

**Dependências:** Task 3 (`validate_pagrl.py` com `validate_dag_planner` deve existir).
**Escopo:** S - 1 arquivo, duas inserções idênticas (~15 linhas cada).

---

## 5. Ordem de implementação

```
Task 1 (planner-template.md)     - independente, fazer primeiro
Task 2 (Diagnosis PAGRL schema)  - independente, paralela com Task 1
Task 3 (validate_pagrl.py)       - depende de Task 1 + Task 2
Task 3b (test_validate_pagrl.py) - depende de Task 3
Task 4 (Quick Mode §1.5)         - depende de Task 1 + Task 2
Task 4b (Quick Mode §2 deconflict) - depende de Task 4
Task 5 (tasks.md + SKILL.md)     - depende de Task 1 + Task 4
Task 6 (write_dag.sh)            - depende de Task 3
Task 7 (E2E benchmarks S3 + S6)   - depende de Tasks 1–6
```

### Checkpoints

**Após Tasks 1–3b (Foundation):**
- [ ] `python3 scripts/test_validate_pagrl.py` passa
- [ ] Fixtures de diagnosis e dag-planner validam conforme schema

**Após Tasks 4–5 (Protocol):**
- [ ] Quick Mode: §1.5 + §2 sem contradições (`python3` assert da Task 4b)
- [ ] Três anchor points referenciam `planner-template.md`

**Após Task 6 (Gates):**
- [ ] `write_dag.sh` falha sem `planner.pagrl.xml` no staging
- [ ] `write_dag.sh` passa com fixtures válidas

**Após Task 7 (Complete):**
- [ ] S3: 3/3; S6: sem regressão

---

## 6. Verificação end-to-end (Task 7)

Após implementar Tasks 1–6, rodar o cenário S3:

```bash
cd /workspaces/dag-flow/docs/benchmarks/data/e2e-v0.2.0
bash harness/run_scenario.sh --mode dag_flow s3-quick-mode-hotfix workspace/run-verify
```

**O que observar (S3):**
1. Orchestrator cria `quickmode-diagnosis.pagrl.xml` com `<FilesInspected>` incluindo `test.js`
2. `validate_pagrl.py --phase quick-mode-diagnosis` passa (sem erros de ReferencesRead/FilesInspected)
3. Orchestrator spawna Subagent Planner (não gera Mini-DAG inline)
4. Subagent message contém `<planner_pagrl>` + `<dag_json>` (dois blocos — sem escalação)
5. `planner.pagrl.xml` extraído e escrito no staging; `validate_pagrl.py --phase dag-planner` passa
6. Mini-DAG gerado tem `done_when_gate` com caminho relativo (ex: `node test.js` ou `npm test`) - NÃO `node -c`, NÃO `cd /absolute/path &&`
7. Worker executa com `DAG_FLOW_WORKER=1`, aplica fix correto (leu `test.js`, sabe que fix deve ser incondicional)
8. Gate `rtk node test.js` ou `rtk npm test` passa
9. Grade: `3/3` ✅

**Cenário adicional — Tasks phase (S6 ou equivalente):**

Após implementar Task 5, rodar um cenário de Tasks phase com skill injection para verificar
que o novo Output Contract (dois blocos) não quebra o fluxo existente:

```bash
cd /workspaces/dag-flow/docs/benchmarks/data/e2e-v0.2.0
bash harness/run_scenario.sh --mode dag_flow s6-skill-invocation workspace/run-verify
```

**O que observar (Tasks phase):**
1. Orchestrator lê `references/planner-template.md` verbatim antes de spawnar
2. Subagent message contém `<planner_pagrl>` + `<dag_json>`
3. Orchestrator extrai ambos os blocos, escreve `planner.pagrl.xml` e `dag.json` no staging
4. `write_dag.sh --phase tasks` passa (incluindo nova validação do `planner.pagrl.xml`)
5. `<SkillsApplied>` no `planner.pagrl.xml` não está vazio (skill foi encontrada e lida)
6. Grade do cenário: igual ou melhor que antes da mudança ✅

**Grading file esperado:**
```
/workspace/run-verify/s3-quick-mode-hotfix/grading_dag_flow.json
-> todas as 3 assertions: "passed": true
```

**Resultado validado (run-s3-v4, 2026-06-17):** 3/3 ✅ - sem nenhuma skill no projeto,
o SE baseline sozinho foi suficiente. O Planner leu `test.js`, identificou que o fix deve
ser `res.status(200)` incondicional, gerou `done_when_gate: "node test.js"` (relativo).
`rtk node test.js` passou. Worker aplicou o fix correto na primeira tentativa.

---

## 7. Arquivos que NÃO devem ser modificados

| Arquivo | Razão |
|---|---|
| `hooks/dag-flow-src-guard.sh` | ADR-0010 implementado, não tocar |
| `scripts/dag_runner.py` | DAG_FLOW_WORKER=1 implementado, não tocar |
| `scripts/write_dag.sh` | ~~Validação já funciona corretamente~~ **REMOVIDO DA LISTA** — Task 6 adiciona assertion de `planner.pagrl.xml` e chamada de `validate_pagrl.py --phase dag-planner`. Mudança cirúrgica, não reescrita. |
| `scripts/auditor.py` | Sem mudanças necessárias |
| `references/escalation-phase.md` | Mecanismo existente e correto |
| `docs/benchmarks/` | Benchmark revela gaps reais, não deve ser adaptado |
| `mcp/src/` | `covers:` structured search é backlog (D4); registry atual não indexa o campo |
| `.dag-flow/skills/coding-guidelines/` | Skill existente, sem relação com este plano |

---

## 8. Riscos

| Risco | Como identificar | Mitigação |
|---|---|---|
| Orchestrator improvisa planner-template em vez de ler o arquivo | Mini-DAG gerado varia entre runs | Template referenciado explicitamente em SKILL.md E references/tasks.md E references/quick-mode.md - três pontos de ancoragem |
| Subagent retorna JSON com prosa ao redor | write_dag.sh falha com JSON parse error | Output contract no template é explícito com exemplo de "Incorreto". write_dag.sh retorna erro útil para re-prompt |
| validate_pagrl.py rejeita PAGRLs de runs anteriores que não têm os novos campos | Falhas em cenários que antes passavam | Os novos campos só são validados para quick-mode-diagnosis. Outros phases (specify, design, tasks, quick-mode-entry) não são afetados |
| search_skills não encontra skills relevantes | Subagent escalada para usuário | SE baseline garante qualidade mínima mesmo sem skills. Escalada só ocorre com gap estrutural identificado |
| Planner gera gate com caminho absoluto | Gate falha com exit 127 (`rtk cd /path...`) | Seção RTK Compatibility no template proíbe `cd &&` e exige caminhos relativos. Descoberto no S3 v3, corrigido no v4. |
| Planner gera gate com `cd /abs &&` prefix | `rtk cd` quebra - `cd` é shell builtin | Mesma mitigação acima. Preferir `npm test` sobre `node /path/test.js`. |
| Planner emite output sem blocos tagueados (prosa livre) | Orchestrator falha na extração de `<planner_pagrl>` ou `<dag_json>` | Output Contract no template especifica formato obrigatório com exemplo. `write_dag.sh` falha com erro claro se `planner.pagrl.xml` não foi escrito. Retry com contexto expandido. |
| Orchestrator tenta extrair `<dag_json>` de mensagem de escalação | Extrai string vazia, escreve `dag.json` inválido, `write_dag.sh` falha com JSON parse error | Step 4 especifica detecção explícita: ausência de `<dag_json>` → fluxo de escalação. Nunca tentar extrair bloco ausente. |
| `covers:` field interpretado como mecanismo de discoverability pelo MCP | Quick-capture skills não encontradas por `search_skills` mesmo com `covers:` correto | Nota explícita no plano (seção 2 e Task 4): `covers:` é convenção documental. Discoverability depende do conteúdo semântico. Backlog para atualizar MCP documentado. |
| `planner.pagrl.xml` contém XML inválido (caracteres não escapados) | `validate_pagrl.py` falha com XML parse error | `write_dag.sh` captura e retorna mensagem de erro clara. Retry protocol aplica-se da mesma forma que JSON inválido. |
| §2 quick-mode contradiz §1.5 após implementação parcial | Orchestrator segue caminho inline antigo | Task 4b obrigatória; assert Python na verificação |
| Regressão em validators sem teste unitário | Task 3 quebra sem falhar até E2E | Task 3b com fixtures mínimas |

---

## 9. Decisões resolvidas (ex-perguntas em aberto)

Revisão 2026-06-20 com codegraph + context-mode. Itens abaixo **não são mais open questions**.

### D1 — §2 `quick-mode.md` precisa de deconflict?

**Decisão: SIM — Task 4b obrigatória.**

Evidência context-mode: §2 ainda tem `Orchestrator MUST use the search_skills` (L82) e
`Write the Mini-DAG JSON` (L89). §1.5 não existe. Implementar só §1.5 deixa duas rotas
válidas no mesmo arquivo.

### D2 — User message "Return only JSON array" vs two-block contract?

**Decisão: CORRIGIR para two-block contract.**

Instrução original na Task 4 contradiz Output Contract do `planner-template.md`. Texto
corrigido neste plano (Task 4, Step 2 item 5): emitir `<planner_pagrl>` + `<dag_json>`,
sem prosa fora das tags.

### D3 — Testes unitários para `validate_pagrl.py`?

**Decisão: SIM — Task 3b no escopo.**

Codegraph: zero covering tests. Validators são gate de OS — regressão aqui só aparece no
benchmark. `scripts/test_validate_pagrl.py` com 5 fixtures mínimas; sem pytest dependency.

### D4 — MCP `covers:` structured search?

**Decisão: FORA DO ESCOPO — backlog documentado.**

Evidência codegraph em `mcp/src/registry.ts`: `gray-matter` parseia frontmatter mas índice
Fuse usa apenas `name`, `triggers`, `description`, `category`. Quick-capture skills devem
repetir termos de domínio no **corpo** do SKILL.md para discoverability. Backlog futuro:
adicionar `covers` a `IndexSkill` + peso Fuse ou filtro `domain:auth`.

| Backlog item | Arquivo alvo | Escopo |
|---|---|---|
| Indexar `covers:` no Fuse | `mcp/src/registry.ts`, `mcp/src/types.ts` | Plano separado |
| Query sintática `domain:auth` | `mcp/src/tools/search-tool.ts` | Plano separado |
