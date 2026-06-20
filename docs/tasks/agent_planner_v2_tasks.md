# Implementation Tasks: Planner Evolution

**Para o agente implementador:** este documento é **auto-suficiente**. Você não tem (e não
precisa de) contexto de sessões anteriores. Leia do início ao fim, implemente as tasks na
ordem indicada, marque cada acceptance criterion ao concluir.

**Documento de design (opcional, mais contexto):** `docs/planning/archive/agent_planner.md`

---

## Overview

### Problema

No benchmark e2e-v0.2.0, o cenário **S3 (Quick Mode Hotfix)** passa 2/3 assertions. O protocolo
Quick Mode é seguido (PAGRLs + Mini-DAG + worker), mas a **3ª assertion falha** porque o
Mini-DAG tem qualidade insuficiente:

- `done_when_gate: "node -c src/routes/auth.js"` — syntax-only, não `npm test` / `node test.js`
- Fix ignora contrato do teste: `test.js` chama `auth({}, res)` e espera `res.status(200)`

**Causa raiz:** Quick Mode gera o Mini-DAG **inline no Orchestrator**. Tasks phase já usa
**Subagent Planner** — assimetria arquitetural.

### Solução (escopo deste plano)

1. **Subagent Planner** para Quick Mode (mesmo mecanismo que Tasks)
2. **Planner enriquecido** em ambas as fases: `search_skills` + `read_skill` no Subagent
3. **Diagnosis PAGRL** com campos de accountability (`FilesInspected`, `ReferencesRead`)
4. `**references/planner-template.md`** — system prompt verbatim do Planner
5. `**planner.pagrl.xml**` — cognitive trace do Planner; validado em `write_dag.sh`
6. `**validate_pagrl.py**` — novos validators + testes unitários

### Já implementado (NÃO é seu escopo)

- `hooks/dag-flow-src-guard.sh` — bloqueia Orchestrator de editar `src/` (ADR-0010)
- `DAG_FLOW_WORKER=1` em `scripts/dag_runner.py` — workers bypass do hook

---

## Layout do repositório

Todos os paths são relativos à **raiz do repo** `dag-flow/`:


| Path                   | Função                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `SKILL.md`             | Root orchestrator skill                                    |
| `references/`          | Protocolos por fase (`quick-mode.md`, `tasks.md`, …)       |
| `scripts/`             | Gates Python/Bash (`validate_pagrl.py`, `write_dag.sh`, …) |
| `.specs/staging/[id]/` | Staging area (chmod 755) antes dos bash gates              |
| `.specs/dags/`         | Vault de DAGs (chmod 555)                                  |
| `CONTEXT.md`           | Ubiquitous language do projeto (raiz)                      |


**Path resolution (SKILL.md):** `references/` e `scripts/` ficam no mesmo diretório que
`SKILL.md` (raiz do skill/repo).

---

## Arquivos que NÃO devem ser modificados


| Arquivo                               | Razão                                        |
| ------------------------------------- | -------------------------------------------- |
| `hooks/dag-flow-src-guard.sh`         | ADR-0010 completo                            |
| `scripts/dag_runner.py`               | Worker bypass completo                       |
| `scripts/auditor.py`                  | RTK wrap já correto (`rtk {gate}`)           |
| `references/escalation-phase.md`      | Sem mudanças                                 |
| `docs/benchmarks/`                    | Não adaptar benchmark para passar            |
| `mcp/src/`                            | `covers:` structured search é backlog futuro |
| `.dag-flow/skills/coding-guidelines/` | Fora do escopo                               |


---

## Ordem de implementação

```
Task 1  ∥ Task 2     (paralelo OK)
Task 3               (depende 1 + 2)
Task 3b              (depende 3)
Task 4               (depende 1 + 2)
Task 4b              (depende 4)
Task 5               (depende 1 + 4 + 4b)
Task 6               (depende 3)
Task 7               (depende 1–6; verificação E2E)
```

### Checkpoints


| Após       | Verificar                                                 |
| ---------- | --------------------------------------------------------- |
| Tasks 1–3b | `python3 scripts/test_validate_pagrl.py` passa            |
| Tasks 4–5  | §1.5 + §2 sem contradição; 3 refs a `planner-template.md` |
| Task 6     | `write_dag.sh` exige `planner.pagrl.xml`                  |
| Task 7     | S3 grade 3/3; S6 sem regressão                            |


---

## Task 1: Criar `references/planner-template.md`

**Description:** Fonte única do system prompt do Subagent Planner. O Orchestrator faz
`view_file` e passa o conteúdo **verbatim** — nunca paráfrase.

**Dependencies:** None

**Files:** `references/planner-template.md` (novo)

**Estimated scope:** M (~120 linhas)

### Acceptance criteria

- [ ] Arquivo existe
- [ ] Cabeçalho explica uso verbatim
- [ ] 8 seções conforme especificação abaixo
- [ ] Output Contract com `<planner_pagrl>` + `<dag_json>` e schema `DagPlanner`
- [ ] RTK Compatibility com caminhos relativos
- [ ] Sem ferramentas de teste específicas do projeto (jest, pytest thresholds, etc.)

### Conteúdo completo do arquivo

Crie `references/planner-template.md` com **exatamente** o conteúdo abaixo (pode ajustar
exemplos menores, mas preserve estrutura e regras):

```markdown
# Subagent Planner — System Prompt Template

**USAGE:** The Orchestrator MUST load this file verbatim via `view_file` and pass it as the
`system_prompt` to `define_subagent`. Do NOT paraphrase or reconstruct from memory.

You are the **DAG Planner** — a senior software engineer specializing in task decomposition
and verification design. You do NOT implement code. You produce:

1. A cognitive trace (`planner.pagrl.xml` content) — reasoning about domains, skills, gates
2. An executable JSON DAG (`dag.json` content) — atomic tasks with strong `done_when_gate`

---

## 1. Engineering Identity

Think like a senior engineer, not a JSON formatter.

### Mandatory pre-output sequence (6 steps)

Before emitting output, you MUST mentally complete:

1. **Read inputs** — spec/diagnosis PAGRL, affected files list, CONTEXT.md path, reference docs
2. **Identify domains** — list technical domains (auth, db, api, testing, …) BEFORE skill search
3. **Search skills** — `search_skills` in parallel for all domains
4. **Read skills** — `read_skill` on every relevant match; apply content to gates and context_ref
5. **Detect gaps** — open implementation decisions? missing verification pattern?
6. **Design gates** — pick highest testing-pyramid level achievable; emit PAGRL + JSON

### Three questions per task (mandatory)

Before writing each task, answer:

1. **How will I know it's done?** → defines `done_when_gate`
2. **Will the gate catch what can go wrong?** → reject weak gates (syntax-only when tests exist)
3. **Is it atomic?** → one concern per task

---

## 2. Testing Pyramid Thinking

For every task involving code, ask which verification level is achievable:

```

E2E → Integration → Unit → Syntax

```

- **Prefer the highest level available.** If `test.js` exists, `node test.js` beats `node -c`.
- **Syntax-only (`node -c`, `bash -n`) is last resort**, never default.
- Framework only — specific tools (jest, pytest, coverage %) come from project skills.

**Weak vs strong:**

| Weak | Strong |
|---|---|
| `node -c src/routes/auth.js` | `node test.js` |
| `bash -n file.sh` | `npm test -- --grep "auth"` |

---

## 3. Gate Quality — Two-Leg Test

For each `done_when_gate`, decide:

| Leg | When | Example |
|---|---|---|
| **Shell (deterministic)** | Syntax, file presence, string checks, test runners | `node test.js`, `grep -q` |
| **LLM Auditor (`agy`)** | Semantic/architectural rules that cannot be shell-tested | SOLID, design patterns |

**Default to shell** when a deterministic check exists.

---

## 4. Context-Blindness Hard Rule

**FORBIDDEN:** using `agy` to verify string presence, absence, replacement, or text refactoring.

LLM auditors suffer context blindness. For any textual/structural check, use shell:

- `grep -q 'pattern' file`
- `! grep -q 'old-pattern' file`

Reserve `agy` for semantic rules only.

---

## 5. Context Ref Quality

`context_ref` must be **self-contained** — the stateless Auditor reads ONLY this field.

**Weak:** `"Database rules"`
**Strong:** `"The /login handler must return HTTP 200 when called with an empty request object. test.js calls auth({}, res) and expects res.status(200). Do not add body guards that break this contract."`

Use CONTEXT.md vocabulary when available.

---

## 6. RTK Compatibility

The DAG Runner's `auditor.py` wraps EVERY gate as `rtk {your_gate_command}`.

**Rules:**

1. **Always use relative paths** in `done_when_gate`, `input_files`, `output_files`
2. **Never prefix with `cd /absolute/path &&`** — `cd` is a shell builtin; `rtk cd` breaks (exit 127)
3. Workspace root is always the working directory

| Incorrect | Correct |
|---|---|
| `cd /home/user/proj && node test.js` | `node test.js` |
| `node /abs/path/test.js` | `node test.js` |

`rtk` passthrough works for: `rtk npm test`, `rtk node test.js`, `rtk grep`.

---

## 7. Escalation Heuristic

Decide before generating JSON:

| Situation | Action |
|---|---|
| No skill, but SE baseline suffices (obvious fix + test exists) | `<EscalationDecision>Proceed</EscalationDecision>` |
| Open implementation decision (e.g. Redis vs in-memory cache) | `<EscalationDecision>Escalate</EscalationDecision>` |

**Proceed:** `<OpenDecisions/>` empty.
**Escalate:** `<OpenDecisions>` names the **specific** gap — not "I'm uncertain."

**Escalation output:** emit ONLY `<planner_pagrl>` block — NO `<dag_json>` block.

Illegitimate: `"I'm uncertain about the best approach."`
Legitimate: `"Cache strategy for session tokens: Redis vs in-memory not defined in spec."`

---

## 8. Output Contract

Emit **exactly two tagged blocks**. No prose outside tags. No markdown fences.

### Block 1: `<planner_pagrl>`

```xml
<planner_pagrl>
<PAGRL phase="DagPlanner">
  <DomainsIdentified>auth, nodejs, express</DomainsIdentified>
  <SkillsApplied>coding-guidelines</SkillsApplied>
  <EscalationDecision>Proceed</EscalationDecision>
  <OpenDecisions/>
  <GateReasoning>T1: test.js exists — unit-level gate via node test.js, not syntax-only</GateReasoning>
  <TasksCount>2</TasksCount>
</PAGRL>
</planner_pagrl>
```

**DagPlanner fields:**


| Field                | Required      | Description                                      |
| -------------------- | ------------- | ------------------------------------------------ |
| `DomainsIdentified`  | Yes           | Technical domains identified BEFORE skill search |
| `SkillsApplied`      | No (empty OK) | Skills found AND read via `read_skill`           |
| `EscalationDecision` | Yes           | `Proceed` or `Escalate`                          |
| `OpenDecisions`      | If Escalate   | Specific open decision(s); empty if Proceed      |
| `GateReasoning`      | Yes           | Why each gate's pyramid level was chosen         |
| `TasksCount`         | Yes           | Positive integer matching JSON array length      |


### Block 2: `<dag_json>` (omit entirely if escalating)

```xml
<dag_json>
[
  {
    "id": "T1",
    "description": "...",
    "context_ref": "...",
    "skill": "None",
    "dependencies": [],
    "input_files": ["src/routes/auth.js", "test.js"],
    "output_files": ["src/routes/auth.js"],
    "cognitive_rationale": "...",
    "done_when_gate": "node test.js"
  },
  {
    "id": "T-Final",
    "description": "Living Memory Delta Update",
    "context_ref": "Orchestrator Rule",
    "skill": "None",
    "dependencies": ["T1"],
    "input_files": [],
    "output_files": [],
    "cognitive_rationale": "Mandatory ctx_index delta.",
    "done_when_gate": "agy --dangerously-skip-permissions --prompt \"Call ctx_index for src/routes/auth.js.\""
  }
]
</dag_json>
```

### Incorrect output examples

```
Here is the DAG:
```json
[...]
```

→ WRONG: prose outside tags, markdown fences

...
[...]
→ WRONG: missing wrapper tags

```

### Verification

- [ ] Manual read: Planner with zero skills still prefers unit test over `node -c`
- [ ] All gates use relative paths

---

## Task 2: Atualizar Diagnosis PAGRL em `references/quick-mode.md`

**Description:** Adicionar accountability estrutural ao PAGRL de diagnóstico Quick Mode.

**Dependencies:** None

**Files:** `references/quick-mode.md` — seção `### 1. Diagnosis (Second PAGRL)` apenas

**Estimated scope:** S

### O que mudar

**Manter** os dois parágrafos introdutórios existentes (linhas 66–67). **Adicionar** antes
do bloco XML de exemplo:

```markdown
Before writing this PAGRL, the Orchestrator MUST:
1. Read the affected source file(s) using read-only tools.
2. Read any test files for the affected module (e.g., `test.js`, `*.test.js`, `*.spec.js`).
   Test files define the expected behavior - the fix specification must align with what
   tests check, not with what "would make sense in production" in isolation.
3. Read `CONTEXT.md` if it exists, to use the project's domain language in the diagnosis.

Declare all files read in `<FilesInspected>`. If `test.js` is not in `<FilesInspected>`,
you are declaring you did not read it - and this will be visible in the audit trail.
```

**Substituir** o bloco XML de exemplo (linhas 69–76) por:

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

**Remover** a linha `<Rules>Read-only access...</Rules>` do exemplo antigo.

**Adicionar** tabela após o XML:


| Campo                          | Tipo                       | Por que existe                                                    |
| ------------------------------ | -------------------------- | ----------------------------------------------------------------- |
| `phase="quick-mode-diagnosis"` | atributo XML               | Distingue Entry Gate de Diagnosis no audit trail                  |
| `<ReferencesRead>`             | Lista separada por vírgula | Declara protocolos lidos; omitir `CONTEXT.md` é auto-incriminante |
| `<FilesInspected>`             | Lista separada por vírgula | Declara código/testes lidos; omitir `test.js` é visível no audit  |


**CRITICAL:** `<Decision>` deve ser **exatamente** `Generate a Mini-DAG for the hot-patch.`
(com ponto final) — `validate_pagrl.py` verifica string exata.

### Acceptance criteria

- [ ] `phase="quick-mode-diagnosis"` no exemplo
- [ ] `<ReferencesRead>` e `<FilesInspected>` com tabela
- [ ] 3 passos obrigatórios antes do PAGRL
- [ ] `<Intention>`, `<Reasoning>`, `<Decision>` preservados como campos livres
- [ ] `<Decision>` string exata preservada

### Verification

- [ ] Ler §1 e confirmar que omissão de `test.js` em `<FilesInspected>` seria explícita

---

## Task 3: Atualizar `scripts/validate_pagrl.py`

**Description:** Validar novos campos de diagnosis + adicionar phase `dag-planner`.

**Dependencies:** Task 1 (schema DagPlanner), Task 2 (schema diagnosis)

**Files:** `scripts/validate_pagrl.py`

**Estimated scope:** S (~45 linhas)

### Mudanças

**1. Substituir** `validate_quick_mode_diagnosis` (linhas 115–121) por:

```python
def validate_quick_mode_diagnosis(root: ET.Element):
    if is_empty(root, "ReferencesRead"):
        print("❌ Validation failed: <ReferencesRead> must not be empty. "
              "Declare which protocol files were read (at minimum: references/quick-mode.md).")
        return False

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
```

**2. Adicionar** nova função após `validate_quick_mode_diagnosis`:

```python
def validate_dag_planner(root: ET.Element):
    if is_empty(root, "DomainsIdentified"):
        print("❌ Validation failed: <DomainsIdentified> must not be empty. "
              "Declare the technical domains identified from the spec before skill search.")
        return False

    tasks_count = get_text(root, "TasksCount")
    try:
        if int(tasks_count) <= 0:
            raise ValueError
    except (ValueError, TypeError):
        print(f"❌ Validation failed: <TasksCount> must be a positive integer, got '{tasks_count}'")
        return False

    escalation = get_text(root, "EscalationDecision")
    if escalation not in ("Proceed", "Escalate"):
        print(f"❌ Validation failed: <EscalationDecision> must be 'Proceed' or 'Escalate', got '{escalation}'")
        return False

    if escalation == "Escalate" and is_empty(root, "OpenDecisions"):
        print("❌ Validation failed: <EscalationDecision> is 'Escalate' but <OpenDecisions> is empty. "
              "Name the specific open decision that requires user input.")
        return False

    return True
```

**3. Em `main()`:**

- Adicionar `"dag-planner"` ao `choices` do `--phase`
- Adicionar branch:

```python
    elif args.phase == "dag-planner":
        success = validate_dag_planner(root)
```

**Nota:** Não adicionar validação de atributo `phase=` para quick-mode-diagnosis — routing
é pelo `--phase` CLI.

### Acceptance criteria

- [ ] `ReferencesRead` e `FilesInspected` obrigatórios em quick-mode-diagnosis
- [ ] `validate_dag_planner` implementada
- [ ] `dag-planner` nos choices
- [ ] Mensagens de erro informativas

### Verification

```bash
cat > /tmp/test_diagnosis.pagrl.xml << 'EOF'
<PAGRL phase="quick-mode-diagnosis">
  <ReferencesRead>references/quick-mode.md</ReferencesRead>
  <Intention>Test</Intention>
  <Reasoning>Test</Reasoning>
  <Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>
EOF
python3 scripts/validate_pagrl.py --phase quick-mode-diagnosis /tmp/test_diagnosis.pagrl.xml
# Esperado: exit 1, mensagem FilesInspected
```

---

## Task 3b: Criar `scripts/test_validate_pagrl.py`

**Description:** Testes unitários para validators novos — sem pytest.

**Dependencies:** Task 3

**Files:** `scripts/test_validate_pagrl.py` (novo)

**Estimated scope:** S (~100 linhas)

### Acceptance criteria

- [ ] 5 casos abaixo passam via `python3 scripts/test_validate_pagrl.py`
- [ ] Usa `subprocess` + fixtures em `/tmp` ou `tempfile`
- [ ] Imprime `ALL PASSED` no sucesso; exit 0

### Casos obrigatórios


| #   | Phase                | Fixture                                               | Esperado |
| --- | -------------------- | ----------------------------------------------------- | -------- |
| 1   | quick-mode-diagnosis | Sem `<FilesInspected>`                                | FAIL     |
| 2   | quick-mode-diagnosis | Completo (ReferencesRead + FilesInspected + Decision) | PASS     |
| 3   | dag-planner          | Escalate + OpenDecisions vazio                        | FAIL     |
| 4   | dag-planner          | Proceed + campos válidos                              | PASS     |
| 5   | dag-planner          | TasksCount=0                                          | FAIL     |


### Fixtures de referência

**Diagnosis PASS:**

```xml
<PAGRL phase="quick-mode-diagnosis">
  <ReferencesRead>references/quick-mode.md</ReferencesRead>
  <FilesInspected>src/routes/auth.js, test.js</FilesInspected>
  <Intention>Test</Intention>
  <Reasoning>Test</Reasoning>
  <Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>
```

**DagPlanner PASS (Proceed):**

```xml
<PAGRL phase="DagPlanner">
  <DomainsIdentified>auth, nodejs</DomainsIdentified>
  <SkillsApplied/>
  <EscalationDecision>Proceed</EscalationDecision>
  <OpenDecisions/>
  <GateReasoning>Unit test available</GateReasoning>
  <TasksCount>2</TasksCount>
</PAGRL>
```

**DagPlanner FAIL (Escalate sem OpenDecisions):**

```xml
<PAGRL phase="DagPlanner">
  <DomainsIdentified>auth</DomainsIdentified>
  <EscalationDecision>Escalate</EscalationDecision>
  <OpenDecisions/>
  <GateReasoning>N/A</GateReasoning>
  <TasksCount>1</TasksCount>
</PAGRL>
```

### Verification

```bash
python3 scripts/test_validate_pagrl.py && echo OK
```

---

## Task 4: Adicionar §1.5 Planner Invocation em `references/quick-mode.md`

**Description:** Protocolo de spawn do Subagent Planner no Quick Mode.

**Dependencies:** Task 1, Task 2

**Files:** `references/quick-mode.md`

**Estimated scope:** M

### Localização

Inserir nova seção `**### 1.5. Planner Invocation`** entre:

- `### 1. Diagnosis (Second PAGRL)` (fim após tabela de campos)
- `### 2. Mini-DAG Generation`

### Conteúdo completo a inserir

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
Affected files: [list of file paths from ]
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
  Extract both blocks. Write `planner.pagrl.xml` (inner `<PAGRL>` XML from planner_pagrl block)
  and `dag.json` to `.specs/staging/[issue_id]/`. Run `write_dag.sh`.
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
  will find the newly written skill if the skill body contains relevant domain terms.

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
[directives from user's answers — include domain keywords here for search_skills discoverability]
```

**Note on `covers:` and discoverability:** `covers:` is documentary. `search_skills` uses
Fuse.js full-text on `name`, `description`, `triggers`, `category` — NOT the `covers:` field.
Write domain terms in the skill **body** so `search_skills` finds it.

The new Planner session spawned after skill creation will call `search_skills` normally.
The user can improve the skill later with the skill-creator skill.

**Overlapping coverage:** if multiple skills cover the same domain, most-specific wins
(the skill with the most `covers:` claims is applied).

```

### Acceptance criteria

- [ ] Seção `### 1.5. Planner Invocation` inserida na ordem correta
- [ ] Steps 1–4 completos
- [ ] Two-block output contract no Step 2 item 5 (NÃO "Return only JSON array")
- [ ] Escalation flow documentado
- [ ] Nota sobre `covers:` / MCP limitation

### Verification

- [ ] Fluxo: Entry Gate → Diagnosis → §1.5 → §2 (schema only)

---

## Task 4b: Deconflictar `references/quick-mode.md` §2

**Description:** Remover instruções contraditórias que mandam Orchestrator gerar DAG inline.

**Dependencies:** Task 4

**Files:** `references/quick-mode.md` — `### 2. Mini-DAG Generation` apenas

**Estimated scope:** XS

### Estado atual (remover)

Linhas 81–90 aproximadamente:

```markdown
**Skill Injection Rule:**
After outputting the `<PAGRL>`, the Orchestrator MUST use the `search_skills` tool...

**Artifact Generation & Gating:**
...
1. Write BOTH your entry PAGRL ...
2. Write the Mini-DAG JSON to `.specs/staging/[issue_id]/dag.json`.
3. Use the `run_command` tool to execute ...
```

### Substituir por

```markdown
**Artifact Generation & Gating:**
Mini-DAG JSON generation is the Subagent Planner's responsibility — see **§1.5 Planner Invocation**.
The Orchestrator MUST NOT generate the JSON inline or call `search_skills` for DAG planning.

The physical vault `.specs/dags/` is locked (`chmod 555`). You cannot write to it directly.

When completing Quick Mode, the Orchestrator MUST have these files in `.specs/staging/[issue_id]/`:
1. `quickmode-entry.pagrl.xml` — entry gate PAGRL
2. `quickmode-diagnosis.pagrl.xml` — diagnosis PAGRL (§1)
3. `planner.pagrl.xml` — extracted from Subagent `<planner_pagrl>` block (§1.5)
4. `dag.json` — extracted from Subagent `<dag_json>` block (§1.5)

Then use `run_command` to execute `<path-to-skill>/scripts/write_dag.sh [issue_id] --phase quick-mode`.
```

**Manter inalterado** em §2:

- Parágrafo introdutório ("Generate a simplified, sequential JSON AST...")
- `**Output format for the dag.json:`** e todas as notas de campo (`context_ref`, `dependencies`, `done_when_gate`, `T-Final`, Financial Firewall, In-Code Documentation)

### Acceptance criteria

- [ ] §2 sem `Orchestrator MUST use the search_skills`
- [ ] §2 sem instrução de gerar JSON inline
- [ ] §2 referencia §1.5
- [ ] Lista 4 arquivos de staging incluindo `planner.pagrl.xml`
- [ ] Schema JSON preservado

### Verification

```bash
python3 -c "
t=open('references/quick-mode.md').read()
s2=t[t.find('### 2. Mini-DAG'):t.find('### 3. Execution')]
assert 'Orchestrator MUST use the \`search_skills\`' not in s2, 'search_skills still on Orchestrator'
assert 'generate the JSON inline' in s2.lower() or 'must not generate' in s2.lower(), 'missing inline prohibition'
print('§2 deconflict OK')
"
```

---

## Task 5: Atualizar Tasks phase — `references/tasks.md` + `SKILL.md`

**Description:** Alinhar Tasks phase ao mesmo protocolo Planner do Quick Mode.

**Dependencies:** Task 1, Task 4, Task 4b

**Files:** `references/tasks.md`, `SKILL.md`

**Estimated scope:** S

### 5a — `references/tasks.md`

**Substituir** o bloco `When advancing, you MUST:` (linhas 44–48) por:

```markdown
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

**Substituir** `**The MCP Skill Injection Rule:`** (linhas 93–94) por:

```markdown
**The MCP Skill Injection Rule:**
The Subagent Planner is responsible for skill discovery and loading - not the Orchestrator.
The Subagent calls `search_skills` in parallel across all technical domains identified in
spec.md and design.md, then calls `read_skill` on each found skill. It applies the skill
content to write precise `context_ref`, `execution_prompt`, and `done_when_gate` - not
just to assign the `skill:` field. The `skill:` field in the task JSON points the worker
to the same skill for execution-time learning.
```

### 5b — `SKILL.md`

**Substituir** parágrafo `**Subagent Relay (Crucial):`** (linha ~70) por:

```markdown
- **Subagent Relay (Crucial):** To protect the physical vault, the JSON DAG is generated by
a Subagent without write permissions. First, write `tasks.pagrl.xml` to staging. Then,
use `view_file` to read `references/planner-template.md` verbatim - this is the Subagent
system prompt. Spawn the Subagent Planner (`define_subagent`) with `enable_mcp_tools=true`
and `enable_write_tools=false`, passing the template as system prompt and a user message
containing: the tasks.pagrl.xml content, paths to spec.md, design.md, references/tasks.md,
and CONTEXT.md (if present). The Subagent will call search_skills + read_skill before
generating the JSON. Full spawn protocol in `references/tasks.md`.
```

**Substituir** bullet Quick Mode `**Artifact Generation & Gating:`** (linha ~99) por:

```markdown
- **Artifact Generation & Gating:** After the Diagnosis PAGRL, spawn a Subagent Planner
  to generate the Mini-DAG JSON (do NOT generate inline). Full spawn protocol in
  `references/quick-mode.md` section 1.5. The Orchestrator writes `planner.pagrl.xml`
  and `dag.json` (extracted from Subagent message) to `.specs/staging/[issue_id]/`.
  You MUST also emit `quickmode-entry.pagrl.xml` and `quickmode-diagnosis.pagrl.xml`
  in the same staging folder. Then use `run_command` to execute
  `write_dag.sh [issue_id] --phase quick-mode`.
```

### Acceptance criteria

- [ ] `tasks.md`: XML antes de spawn; planner-template verbatim; two-block detection
- [ ] `tasks.md`: MCP Skill Injection Rule atribui search ao Subagent
- [ ] `SKILL.md`: Subagent Relay atualizado
- [ ] `SKILL.md`: Quick Mode referencia §1.5, não inline generation
- [ ] Três arquivos referenciam `planner-template.md`: SKILL.md, tasks.md, quick-mode.md

### Verification

```bash
grep -l 'planner-template' SKILL.md references/tasks.md references/quick-mode.md | wc -l
# Esperado: 3
```

---

## Task 6: Atualizar `scripts/write_dag.sh`

**Description:** Exigir `planner.pagrl.xml` no staging e validar com `--phase dag-planner`.

**Dependencies:** Task 3

**Files:** `scripts/write_dag.sh`

**Estimated scope:** S

### Onde inserir

Em **ambos** os branches (`quick-mode` e `else`/tasks), **após** a validação PAGRL existente
e **antes** de `echo "🔍 Extracting JSON DAG..."`.

### Código a adicionar (idêntico nos dois branches)

```bash
# Assert planner.pagrl.xml exists
PLANNER_PAGRL="$STAGING_DIR/planner.pagrl.xml"
if [ ! -f "$PLANNER_PAGRL" ]; then
  echo "❌ Error: planner.pagrl.xml not found in $STAGING_DIR"
  echo "   The Orchestrator must extract the <planner_pagrl> block from the Subagent message"
  echo "   and write it to $PLANNER_PAGRL before running this script."
  exit 1
fi

echo "🔍 Validating PAGRL schema for phase: dag-planner"
python3 "$SCRIPT_DIR/validate_pagrl.py" --phase dag-planner "$PLANNER_PAGRL"
```

### Estrutura resultante (tasks branch)

```
1. Check dag.json + tasks.pagrl.xml exist
2. validate_pagrl.py --phase tasks
3. [NOVO] assert + validate planner.pagrl.xml
4. extract_json_dag.py
5. validate_dag_coherence.py
6. cp to vault
```

### Estrutura resultante (quick-mode branch)

```
1. Check dag.json + entry + diagnosis exist
2. validate quick-mode-entry
3. validate quick-mode-diagnosis
4. [NOVO] assert + validate planner.pagrl.xml
5. extract_json_dag.py
6. validate_dag_coherence.py
7. cp to vault
```

### Acceptance criteria

- [ ] Gate em `--phase tasks` e `--phase quick-mode`
- [ ] Mensagem de erro descreve extração do `<planner_pagrl>` block
- [ ] Lógica existente preservada

### Verification manual

```bash
# Setup staging mínimo sem planner.pagrl.xml — deve falhar:
mkdir -p .specs/staging/test-gate
echo '[]' > .specs/staging/test-gate/dag.json
# ... criar PAGRLs mínimos válidos conforme phase ...
bash scripts/write_dag.sh test-gate --phase tasks
# Esperado: ❌ Error: planner.pagrl.xml not found
```

---

## Task 7: Verificação end-to-end

**Description:** Validar comportamento via benchmark existente. **Não modificar** arquivos em `docs/benchmarks/`.

**Dependencies:** Tasks 1–6

**Estimated scope:** XS (execução + inspeção)

### S3 — Quick Mode Hotfix

```bash
cd docs/benchmarks/data/e2e-v0.2.0
bash harness/run_scenario.sh --mode dag_flow s3-quick-mode-hotfix workspace/run-verify
```

**Observar:**


| #   | Critério                                                                                   |
| --- | ------------------------------------------------------------------------------------------ |
| 1   | `quickmode-diagnosis.pagrl.xml` tem `<FilesInspected>` com `test.js`                       |
| 2   | `validate_pagrl.py --phase quick-mode-diagnosis` passa                                     |
| 3   | Orchestrator spawna Subagent (não inline DAG)                                              |
| 4   | Mensagem Subagent tem `<planner_pagrl>` + `<dag_json>`                                     |
| 5   | `planner.pagrl.xml` no staging; `--phase dag-planner` passa                                |
| 6   | `done_when_gate` relativo (`node test.js` ou `npm test`) — NÃO `node -c`, NÃO `cd /abs &&` |
| 7   | Worker com `DAG_FLOW_WORKER=1` aplica fix correto                                          |
| 8   | `rtk node test.js` passa                                                                   |
| 9   | **Grade 3/3**                                                                              |


Grading: `workspace/run-verify/s3-quick-mode-hotfix/grading_dag_flow.json`

### S6 — Skill Invocation (Tasks phase)

```bash
cd docs/benchmarks/data/e2e-v0.2.0
bash harness/run_scenario.sh --mode dag_flow s6-skill-invocation workspace/run-verify
```

**Observar:**


| #   | Critério                                                   |
| --- | ---------------------------------------------------------- |
| 1   | Orchestrator lê `planner-template.md` verbatim             |
| 2   | Two-block extraction funciona                              |
| 3   | `write_dag.sh --phase tasks` passa com `planner.pagrl.xml` |
| 4   | `<SkillsApplied>` não vazio no planner PAGRL               |
| 5   | Grade igual ou melhor que baseline                         |


### Acceptance criteria

- [ ] S3: 3/3 assertions passed
- [ ] S6: sem regressão

---

## Decisões já tomadas (não reabrir)


| ID  | Decisão                                                   |
| --- | --------------------------------------------------------- |
| D1  | Task 4b obrigatória — §2 conflita com §1.5 sem deconflict |
| D2  | Output Contract é two-block; nunca "JSON only"            |
| D3  | Task 3b obrigatória — validators sem testes               |
| D4  | `mcp/src/` fora do escopo — `covers:` é backlog           |


### Backlog futuro (não implementar agora)

- Indexar `covers:` em `mcp/src/registry.ts` + `mcp/src/types.ts`
- Query sintática `domain:auth` em `mcp/src/tools/search-tool.ts`

---

## Resumo de arquivos tocados


| Task | Arquivo                           | Ação           |
| ---- | --------------------------------- | -------------- |
| 1    | `references/planner-template.md`  | CREATE         |
| 2    | `references/quick-mode.md`        | EDIT §1        |
| 3    | `scripts/validate_pagrl.py`       | EDIT           |
| 3b   | `scripts/test_validate_pagrl.py`  | CREATE         |
| 4    | `references/quick-mode.md`        | EDIT add §1.5  |
| 4b   | `references/quick-mode.md`        | EDIT §2        |
| 5    | `references/tasks.md`, `SKILL.md` | EDIT           |
| 6    | `scripts/write_dag.sh`            | EDIT           |
| 7    | —                                 | RUN benchmarks |


**Total:** 7 arquivos criados/editados + 1 test runner