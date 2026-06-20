# Implementation Plan: Multi-Runtime Support (V1)

| Campo | Valor |
|-------|-------|
| **Fonte de verdade** | [`docs/design/tdd-multi-runtime-support.md`](../design/tdd-multi-runtime-support.md) |
| **Este documento** | Roteiro de execução — ordem, checkpoints, verificação |
| **Status TDD** | Accepted (grill 2026-06-20) |
| **Estimativa** | ~22 dias agente; F5 ∥ F4 após F3; F9 ∥ F7 |

---

## Como usar (agente em sessão zerada)

**Não implemente só com este arquivo.** Ele não repete algoritmos, JSON completos nem anti-padrões.

### Ordem de leitura obrigatória (uma vez)

1. [TDD — Leia isto primeiro](../design/tdd-multi-runtime-support.md#leia-isto-primeiro-agente-implementador)
2. [`CONTEXT.md`](../../CONTEXT.md) — glossário
3. ADRs listados em [TDD §11](../design/tdd-multi-runtime-support.md#11-adrs-a-criar-antes-da-implementação) (0010–0017)
4. Por task: abrir **apenas** as seções TDD / ADRs / evidência listadas na task

### Por task

```
Task N → ler "TDD" + "ADRs" + "Evidência" → implementar → "Verificação"
```

### Não usar como verdade

| Arquivo | Motivo |
|---------|--------|
| `docs/planning/archive/agent_planner_v2_implementation_plan.md` | Drift — afirma hook e `DAG_FLOW_WORKER` implementados; **não estão** ([TDD Apêndice A](../design/tdd-multi-runtime-support.md#apêndice-a--evidência-de-drift-documental)) |
| `docs/planning/archive/*` (outros) | Histórico; não reflete código atual |
| `docs/getting-started.md` (fluxo `setup_indexer`) | Substituído por `dag init` + context-mode externo (D10) |

### Invariante absoluta

**Não avance da Fase 2** sem [golden gate](../design/tdd-multi-runtime-support.md#511-gate-de-ouro--script-de-paridade-antigravity) verde.

### Legenda das colunas de referência

| Coluna | Significado |
|--------|-------------|
| **TDD** | Seções do TDD a ler **antes** de codar esta task |
| **ADRs** | ADRs a ler/criar |
| **Evidência** | Arquivos no repo para inspecionar (estado atual) |
| **Não fazer** | Anti-padrões / restrições explícitas desta task |

---

## Overview

Introduzir **compilação multi-runtime**: Source Skill com `<<<DAG:NAME>>>` → `dag init` produz Compiled Skill + Project Scaffold + hook wiring declarado por manifest. V1 shipa **`antigravity`** (paridade) e **`cursor`**; `claude` pós-V1.

### Baseline no disco (2026-06-20)

| Item | Estado |
|------|--------|
| `cli/` | **Inexistente** — greenfield |
| Source Skill | Hardcoded: `agy`, `run_command`, `define_subagent`, `view_file` |
| `scripts/dag_runner.py` | `agy` hardcoded; sem `DAG_FLOW_WORKER`; sem `dag-config.json` |
| `scripts/auditor.py` | Só exit code — falta `PASS` no stdout ([D6](../design/tdd-multi-runtime-support.md#d6--auditor-gate-contract-invariante)) |
| Vault status | Runner atualiza só cópia em `.specs/runs/` ([D2](../design/tdd-multi-runtime-support.md#d2--pending-dag-guard-e-status-no-vault)) |
| `hooks/setup_indexer.sh` | Existe — remover na Fase 11 |
| `references/discovery.md` | Existe — eliminar na Fase 10 |
| ADRs 0010–0016 | ✅ Criados (`status: accepted`) |
| ADR-0017 | ✅ Aceito |
| Golden fixture | ✅ `cli/test/fixtures/antigravity-parity-golden/` |

---

## Architecture Decisions (resumo — detalhe no TDD §3)

| ID | Decisão | TDD |
|----|---------|-----|
| D1 | Dual manifest: Cat. A = worker; B/C + hooks = orchestrator | [§3 D1](../design/tdd-multi-runtime-support.md#d1--dual-manifest-compilation) |
| D2 | Pending DAG Guard no vault; `Failed` bloqueia | [§3 D2](../design/tdd-multi-runtime-support.md#d2--pending-dag-guard-e-status-no-vault) |
| D3 | Compiled Skill = só Agent Skill | [§3 D3](../design/tdd-multi-runtime-support.md#d3--compiled-skill--só-pacote-agent-skill) |
| D4 | Prerequisites no CLI (`context-mode`, `rtk`) | [§3 D4](../design/tdd-multi-runtime-support.md#d4--init-prerequisites-gate-cli-não-skill) |
| D5 / D5b | Init idempotente + Project Scaffold | [§3 D5](../design/tdd-multi-runtime-support.md#d5--init-idempotency), [D5b](../design/tdd-multi-runtime-support.md#d5b--project-scaffold) |
| D6 | Auditor: exit 0 + `PASS` no stdout | [§3 D6](../design/tdd-multi-runtime-support.md#d6--auditor-gate-contract-invariante) |
| D7 | `manifest scaffold` exige `--extends` | [§3 D7](../design/tdd-multi-runtime-support.md#d7--dag-manifest-scaffold---extends-obrigatório) |
| D8 | Built-ins V1: `antigravity` + `cursor` | [§3 D8](../design/tdd-multi-runtime-support.md#d8--built-ins-v1-antigravity--cursor-claude-adiado) |
| D9–D11 | discovery inline; matar setup_indexer; Hook tiers | [D9](../design/tdd-multi-runtime-support.md#d9--eliminar-referencesdiscoverymd), [D10](../design/tdd-multi-runtime-support.md#d10--matar-hookssetup_indexersh), [D11](../design/tdd-multi-runtime-support.md#d11--dag-flow-hook-guard--router--implementar-de-verdade) |
| D12–D13 | `dag update` re-wire hooks; MCP inalterado | [D12](../design/tdd-multi-runtime-support.md#d12--dag-update-re-wire-hooks), [D13](../design/tdd-multi-runtime-support.md#d13--mcp-sem-mudanças) |

**Anti-padrões:** [Apêndice C](../design/tdd-multi-runtime-support.md#apêndice-c--anti-padrões-de-implementação) — ler antes de tocar no CLI.

---

## Dependency Graph

```
Task 0 (ADRs)
    │
    ├── Task 1–2 (manifest antigravity + golden)
    │       │
    │       └── Task 3–4 (placeholders + parity) ◄── GOLDEN GATE
    │               │
    │               ├── Tasks 5–7 (CLI + compiler)
    │               │       │
    │               │       ├── Tasks 8–11 (dag init)
    │               │       │       └── Tasks 16–17 (dag update)
    │               │       │
    │               │       └── Tasks 12–15 (runner + vault + auditor)  [∥ 8–11 após 7]
    │               │
    │               ├── Task 18 (cursor manifest)  [∥ Task 20]
    │               └── Task 19 (manifest scaffold)
    │
    └── Task 20 (hook guard) → integra Task 11
            └── Tasks 21–22 (cleanup)
```

---

## Task List

---

### Phase 0: ADRs

## Task 0: Write ADRs 0010–0016

**Description:** Documentar decisões fechadas antes de codar. ADR-0017 já existe.

**TDD:** [§11 ADRs](../design/tdd-multi-runtime-support.md#11-adrs-a-criar-antes-da-implementação), [§13 Status](../design/tdd-multi-runtime-support.md#13-status-de-decisões)

**ADRs:** Criar 0010–0016 com slugs [Q1](#q1--slugs-adr-aceito); conteúdo mínimo em [TDD §11](../design/tdd-multi-runtime-support.md#11-adrs-a-criar-antes-da-implementação); ler [0017](../adr/0017-per-runtime-worker-permission-flags.md) como modelo de formato

**Evidência:** `docs/adr/0003-worker-unsandboxed-cli-execution.md`, `docs/adr/0005-os-level-gating-and-topology-separation.md`, `docs/adr/0006-staging-area-and-subagent-relay.md`

**Não fazer:** Reabrir debates em [TDD §12 ✅](../design/tdd-multi-runtime-support.md#-resolvidas-grill-2026-06-20)

**Acceptance criteria:**
- [x] `docs/adr/0010` … `0016` com `status: accepted` *(pré-criado 2026-06-20)*
- [ ] Conteúdo revisado pelo humano — expandir se necessário antes de implementação

**Verification:**
- [ ] Sete arquivos existem com frontmatter `status: accepted`

**Dependencies:** None

**Files likely touched:**
- `docs/adr/0010-*.md` … `docs/adr/0016-*.md`

**Estimated scope:** M

---

### Phase 1: Parity foundation

## Task 1: Antigravity built-in manifest

**Description:** Criar manifest built-in que captura comportamento Antigravity atual (orchestrator + worker no mesmo manifest).

**TDD:** [§5.7 Manifests](../design/tdd-multi-runtime-support.md#57-manifests-built-in-e-schema-manifestjson) (exemplo antigravity), [D1](../design/tdd-multi-runtime-support.md#d1--dual-manifest-compilation), [D8](../design/tdd-multi-runtime-support.md#d8--built-ins-v1-antigravity--cursor-claude-adiado), [§5.2 Placeholders](../design/tdd-multi-runtime-support.md#52-placeholders), [§5.13 Worker flags](../design/tdd-multi-runtime-support.md#513-worker-permission-flags-equivalente-adr-0003)

**ADRs:** 0011 (dual manifest), 0014 (orchestrator/worker split), 0016 (V1 scope), [0017](../adr/0017-per-runtime-worker-permission-flags.md)

**Evidência:** `SKILL.md` (spawn `define_subagent`), `references/tasks.md` (templates `agy`), `references/planner-template.md`, `scripts/dag_runner.py` (linha `agy`)

**Não fazer:** `hook_wiring_tier: pre_tool_use` no antigravity — usar `boot_file` ([D11 tier table](../design/tdd-multi-runtime-support.md#d11--dag-flow-hook-guard--router--implementar-de-verdade))

**Acceptance criteria:**
- [x] `cli/manifests/antigravity/manifest.json` conforme exemplo §5.7 (incl. `orchestrator.partials`)
- [x] Três partials spawn refletem prose atual de `define_subagent` (§5.2 mapa)
- [x] `worker_validation_status: "validated"`; `auditor_wrapper: null`
- [x] `AUDITOR_COMMAND_TEMPLATE` usa `[OUTPUT_FILES]` / `[CONTEXT_REF]` (não `{…}`)

**Verification:**
- [x] Review manual: placeholders e partials batem com strings hardcoded atuais

**Dependencies:** Task 0

**Files likely touched:**
- `cli/manifests/antigravity/manifest.json`
- `cli/manifests/antigravity/partials/spawn-subagent.md`
- `cli/manifests/antigravity/partials/spawn-subagent-skill.md`
- `cli/manifests/antigravity/partials/spawn-subagent-quick.md`

**Estimated scope:** S

---

## Task 2: Golden parity fixture

**Description:** Snapshot único do output Compiled Skill esperado para Antigravity (pré-placeholders).

**TDD:** [§5.9 Scripts whitelist](../design/tdd-multi-runtime-support.md#59-scripts-na-compiled-skill), [§5.11 Gate de ouro](../design/tdd-multi-runtime-support.md#511-gate-de-ouro--script-de-paridade-antigravity), [§6 Migração](../design/tdd-multi-runtime-support.md#6-plano-de-migração)

**ADRs:** 0015 (whitelist + rebaseline)

**Evidência:** `SKILL.md`, `references/*.md`, `scripts/` (filtrar whitelist §5.9)

**Não fazer:** Incluir `migrate_*`, `test_*`, `docs/`, hooks, `dag-config.json`, `.specs/` ([C5](../design/tdd-multi-runtime-support.md#c5--gate-de-ouro-contra-cópia-manual-do-repo))

**Acceptance criteria:**
- [x] `cli/test/fixtures/antigravity-parity-golden/` com SKILL + references + scripts whitelist *(snapshot 2026-06-20, pré-placeholders)*
- [ ] Re-snapshot se SKILL/references mudarem antes da Fase 2

**Verification:**
- [ ] Contagem de arquivos em `scripts/` = apenas whitelist §5.9

**Dependencies:** Task 1

**Files likely touched:**
- `cli/test/fixtures/antigravity-parity-golden/**`

**Estimated scope:** S

---

### Phase 2: Placeholders + golden gate ⚠️ BLOCKER

## Task 3: Source Skill placeholders

**Description:** Substituir acoplamento hardcoded por `<<<DAG:NAME>>>` em markdowns da Source Skill. **Não alterar `dag_runner.py`** nesta task ([§6](../design/tdd-multi-runtime-support.md#6-plano-de-migração)).

**TDD:** [§5.2 Placeholders](../design/tdd-multi-runtime-support.md#52-placeholders), [§2 Três categorias](../design/tdd-multi-runtime-support.md#2-três-categorias-de-acoplamento), [D1 tabela](../design/tdd-multi-runtime-support.md#d1--dual-manifest-compilation), [§6 passos 2–4](../design/tdd-multi-runtime-support.md#6-plano-de-migração)

**ADRs:** 0011

**Evidência:** `SKILL.md`, `references/{tasks,quick-mode,planner-template,specify,design,escalation-phase}.md`, `cli/manifests/antigravity/manifest.json` (valores alvo)

**Não fazer:** Alterar `scripts/dag_runner.py`; tocar `discovery.md` (Task 21); usar `{{}}` em vez de `<<<DAG:>>>` ([§5.2](../design/tdd-multi-runtime-support.md#52-placeholders))

**Inventário de placeholders (resolver no compile — não hardcodar no markdown):** tabela completa em [TDD §5.2](../design/tdd-multi-runtime-support.md#52-placeholders).

| Placeholder | Categoria | Manifest |
|-------------|-----------|----------|
| `CLI_COMMAND_PREFIX` | A | worker |
| `AUDITOR_COMMAND_TEMPLATE` | A | worker |
| `TOOL_RUN_COMMAND` | B | orchestrator |
| `TOOL_VIEW_FILE` | B | orchestrator |
| `RUNTIME_NAME` | C | orchestrator |
| `SPAWN_SUBAGENT_BLOCK` | Partial | orchestrator (passe 1) |
| `SPAWN_SUBAGENT_SKILL_BLOCK` | Partial | orchestrator (passe 1) |
| `SPAWN_SUBAGENT_QUICK_BLOCK` | Partial | orchestrator (passe 1) |

**Mapa de injeção spawn (obrigatório — paridade golden gate):**

| Arquivo | Placeholder | Manter fora do placeholder |
|---------|-------------|----------------------------|
| `references/tasks.md` passo 3 | `<<<DAG:SPAWN_SUBAGENT_BLOCK>>>` | prefixo `3. ` |
| `SKILL.md` Subagent Relay | `<<<DAG:SPAWN_SUBAGENT_SKILL_BLOCK>>>` | texto até `system prompt. ` |
| `references/quick-mode.md` Step 3 | `<<<DAG:SPAWN_SUBAGENT_QUICK_BLOCK>>>` | `**Step 3 - Spawn:**` |

Valores alvo dos partials: `cli/manifests/antigravity/partials/*.md` (via `orchestrator.partials` no manifest).

**Acceptance criteria:**
- [ ] Todos os pontos Cat. A/B/C + spawn (três placeholders) usam `<<<DAG:…>>>`
- [ ] Grep negativo: zero `agy|run_command|view_file|define_subagent` em `SKILL.md` + `references/`

**Verification:**
```bash
rg -l 'agy|run_command|view_file|define_subagent' SKILL.md references/ \
  && { echo "❌ acoplamento restante"; exit 1; } || echo "✅ grep negativo OK"
```

**Dependencies:** Task 1

**Files likely touched:**
- `SKILL.md`
- `references/*.md` (exceto `discovery.md` — Fase 10)

**Estimated scope:** M

---

## Task 4: Parity verification script

**Description:** Script automatizado do golden gate.

**TDD:** [§5.11](../design/tdd-multi-runtime-support.md#511-gate-de-ouro--script-de-paridade-antigravity), [§6](../design/tdd-multi-runtime-support.md#6-plano-de-migração)

**ADRs:** 0015

**Evidência:** `cli/test/fixtures/antigravity-parity-golden/`, Task 7 compiler (ou API compile-only)

**Não fazer:** Diff incluindo `dag-config.json` ou scripts fora da whitelist

**Acceptance criteria:**
- [ ] `cli/scripts/verify-antigravity-parity.sh` implementado conforme §5.11
- [ ] Usa `--project-scaffold=false` / `--target` em temp dir
- [ ] `diff -ru` exclui `dag-config.json`

**Verification:**
```bash
./cli/scripts/verify-antigravity-parity.sh
```

**Dependencies:** Tasks 2, 3, 7 (compiler deve existir — mínimo compile-only)

**Files likely touched:**
- `cli/scripts/verify-antigravity-parity.sh`

**Estimated scope:** S

---

### ⛔ Checkpoint: Golden Gate (Tasks 3 + 4 + compiler)

**TDD:** [TDD §10 checklist Fase 2](../design/tdd-multi-runtime-support.md#10-plano-de-implementação)

- [ ] `verify-antigravity-parity.sh` passa
- [ ] Grep negativo na Source Skill passa
- [ ] **Parar aqui** — não mergear Fase 4+ sem isto verde

---

### Phase 3: CLI package + compiler

## Task 5: npm CLI scaffold

**Description:** Pacote `cli/` com bin `dag`, TypeScript, build, test runner.

**TDD:** [§7 Estrutura monorepo](../design/tdd-multi-runtime-support.md#7-estrutura-monorepo-alvo), [§5.5](../design/tdd-multi-runtime-support.md#55-comando-dag-init--fluxo-completo), [§5.6](../design/tdd-multi-runtime-support.md#56-comando-dag-update)

**ADRs:** 0014

**Evidência:** (greenfield) — seguir layout §7

**Não fazer:** `if (runtime === 'cursor')` no entrypoint ([C1](../design/tdd-multi-runtime-support.md#c1--lógica-hardcoded-por-nome-de-runtime-no-cli)); Vitest ou `node:test` ([Q2](#q2--test-runner-aceito) — Jest)

**Acceptance criteria:**
- [ ] `cli/package.json` com `"bin": { "dag": "dist/index.js" }`
- [ ] Comandos registrados: `init`, `update`, `manifest scaffold` (podem stub inicialmente)

**Verification:**
```bash
cd cli && npm run build && node dist/index.js --help
```

**Dependencies:** Golden Gate (disciplina de merge); implementação pode começar em paralelo com Task 3 em branch separada

**Files likely touched:**
- `cli/package.json`, `cli/tsconfig.json`, `cli/src/index.ts`

**Estimated scope:** S

---

## Task 6: Manifest resolver (`extends`)

**Description:** Carregar manifests built-in ou externos; deep merge; detectar ciclos.

**TDD:** [§5.8 Herança extends](../design/tdd-multi-runtime-support.md#58-herança-extends), [§5.7](../design/tdd-multi-runtime-support.md#57-manifests-built-in-e-schema-manifestjson), [D7](../design/tdd-multi-runtime-support.md#d7--dag-manifest-scaffold---extends-obrigatório)

**ADRs:** 0013

**Evidência:** `cli/manifests/antigravity/manifest.json`

**Não fazer:** Merge raso que perde `placeholders` aninhados; permitir ciclo `extends`

**Acceptance criteria:**
- [ ] Resolve `cli/manifests/{id}/` e paths externos (`/` ou `.`)
- [ ] Filho sobrescreve pai; parciais do filho sobrescrevem mesmo nome
- [ ] Ciclo → erro explícito

**Verification:**
- [ ] `cli/test/manifest-resolver.test.ts` — extend simples, override, ciclo

**Dependencies:** Task 5

**Files likely touched:**
- `cli/src/compiler/manifest-resolver.ts`
- `cli/test/manifest-resolver.test.ts`

**Estimated scope:** M

---

## Task 7: Runtime compiler (two passes)

**Description:** Compilador dual-manifest com dois passes e whitelist de scripts.

**TDD:** [§5.3 Runtime Compiler](../design/tdd-multi-runtime-support.md#53-runtime-compiler), [D1](../design/tdd-multi-runtime-support.md#d1--dual-manifest-compilation), [§5.9](../design/tdd-multi-runtime-support.md#59-scripts-na-compiled-skill), [§5.1 Arquitetura](../design/tdd-multi-runtime-support.md#51-arquitetura)

**ADRs:** 0011, 0015

**Evidência:** Task 1 manifest, Task 3 Source Skill, `scripts/` (whitelist)

**Não fazer:** `cp -r scripts/` sem whitelist ([C4](../design/tdd-multi-runtime-support.md#c4--copiar-todos-os-scripts-para-compiled-skill)); passe 2 antes de passe 1

**Acceptance criteria:**
- [ ] Passe 1: cada entrada em `orchestrator.partials` injeta `partials/{arquivo}` em `<<<DAG:{chave}>>>` (§5.3)
- [ ] Passe 2: escalares `placeholders` (orchestrator B/C + worker A conforme D1)
- [ ] Cópia só Compiled Skill Scripts §5.9
- [ ] Validação: zero `<<<DAG:` na saída

**Verification:**
- [ ] `cli/test/runtime-compiler.test.ts`
- [ ] Alimenta Task 4 (`verify-antigravity-parity.sh`)

**Dependencies:** Tasks 1, 6

**Files likely touched:**
- `cli/src/compiler/runtime-compiler.ts`
- `cli/test/runtime-compiler.test.ts`

**Estimated scope:** M

---

### Phase 4: `dag init`

## Task 8: Prerequisites + idempotency gates

**Description:** Gates D4 e D5 no início de `dag init`.

**TDD:** [D4](../design/tdd-multi-runtime-support.md#d4--init-prerequisites-gate-cli-não-skill), [D5](../design/tdd-multi-runtime-support.md#d5--init-idempotency), [§5.5 passos 1–2](../design/tdd-multi-runtime-support.md#55-comando-dag-init--fluxo-completo)

**ADRs:** —

**Evidência:** `CONTEXT.md` (Core Infrastructure: context-mode, rtk)

**Não fazer:** Pré-requisitos na SKILL.md ([D4](../design/tdd-multi-runtime-support.md#d4--init-prerequisites-gate-cli-não-skill))

**Acceptance criteria:**
- [ ] Sem `context-mode` ou `rtk` no PATH → abort + mensagem clara
- [ ] Compiled Skill existe em `skill_install_path` → abort; `--force` sobrescreve com aviso

**Verification:**
- [ ] Teste integração com PATH mockado

**Dependencies:** Task 7

**Files likely touched:**
- `cli/src/commands/init.ts`
- `cli/src/prerequisites.ts`

**Estimated scope:** S

---

## Task 9: `dag init` compile + install + `dag-config.json`

**Description:** Fluxo principal: resolver manifests, compilar, instalar, escrever config.

**TDD:** [§5.5 passos 3–4, 8](../design/tdd-multi-runtime-support.md#55-comando-dag-init--fluxo-completo), [§5.4 dag-config.json](../design/tdd-multi-runtime-support.md#54-dag-configjson), [D1](../design/tdd-multi-runtime-support.md#d1--dual-manifest-compilation)

**ADRs:** 0011, 0014, [0017](../adr/0017-per-runtime-worker-permission-flags.md)

**Evidência:** `cli/manifests/antigravity/manifest.json`, exemplos §5.4 e §5.7

**Não fazer:** Compilar `docs/getting-started.md` ([D3](../design/tdd-multi-runtime-support.md#d3--compiled-skill--só-pacote-agent-skill)); hardcode install path por runtime name

**Acceptance criteria:**
- [ ] `--orchestrator` + `--worker` opcional (default = mesmo runtime)
- [ ] Instala em `{skill_install_path}/dag-flow/` do manifest orchestrator
- [ ] Flags `--target`, `--project-scaffold=false` para testes
- [ ] `dag-config.json` com `_meta` + `worker.command_template`

**Verification:**
- [ ] `verify-antigravity-parity.sh` passa via `dag init --orchestrator=antigravity --target=...`

**Dependencies:** Tasks 7, 8

**Files likely touched:**
- `cli/src/commands/init.ts`

**Estimated scope:** M

---

## Task 10: Project Scaffold (D5b)

**Description:** Bootstrap `.specs/` com chmod correto.

**TDD:** [D5b](../design/tdd-multi-runtime-support.md#d5b--project-scaffold), [§5.5 passo 6](../design/tdd-multi-runtime-support.md#55-comando-dag-init--fluxo-completo)

**ADRs:** [0005](../adr/0005-os-level-gating-and-topology-separation.md), [0006](../adr/0006-staging-area-and-subagent-relay.md)

**Evidência:** `scripts/commit_spec.sh` (chmod unlock ~linhas 30–35), `scripts/dag_runner.py` (`.specs/runs/` lazy)

**Não fazer:** Criar `runs/` ou `hotfixes/` no init; reintroduzir `setup_indexer.sh` ([C7](../design/tdd-multi-runtime-support.md#c7--reintroduzir-setup_indexersh-no-dag-init))

**Acceptance criteria:**
- [ ] `.specs/staging/` 755, `.specs/features/` 555, `.specs/dags/` 555
- [ ] Idempotente: preserva conteúdo; corrige chmod drift
- [ ] Respeita `--project-scaffold=false`

**Verification:**
- [ ] Teste integração: `stat` dos três diretórios

**Dependencies:** Task 9

**Files likely touched:**
- `cli/src/scaffold/project-scaffold.ts`

**Estimated scope:** S

---

## Task 11: Hook wiring (tier-based)

**Description:** Wire hooks via tier do manifest — upsert ou boot_file append.

**TDD:** [§5.10 Hook Config Upsert](../design/tdd-multi-runtime-support.md#510-hook-config-upsert-algoritmo), [D11](../design/tdd-multi-runtime-support.md#d11--dag-flow-hook-guard--router--implementar-de-verdade), [D12](../design/tdd-multi-runtime-support.md#d12--dag-update-re-wire-hooks), [§5.5 passo 7](../design/tdd-multi-runtime-support.md#55-comando-dag-init--fluxo-completo)

**ADRs:** 0010

**Evidência:** `.cursor/hooks.json` (hooks terceiros: caveman, tool-routing), `cli/hooks/dag-flow-guard.mjs` (Task 20 — pode stub mínimo primeiro)

**Não fazer:** Sobrescrever `hooks.json` inteiro ([C3](../design/tdd-multi-runtime-support.md#c3--sobrescrever-hooksjson-inteiro)); `wireAntigravityHook()` ([C2](../design/tdd-multi-runtime-support.md#c2--tratar-antigravity-ou-cursor-como-caso-especial-na-documentaçãocódigo))

**Acceptance criteria:**
- [ ] `pre_tool_use`: upsert por `HOOK_ENTRY_ID` apenas; preserva matchers/outros hooks
- [ ] `boot_file`: append idempotente com `<!-- dag-flow-hook -->`
- [ ] `none`: `console.warn` + skip

**Verification:**
- [ ] Unit test: fixture `hooks.json` com entradas caveman preservadas
- [ ] Manual: diff `.cursor/hooks.json` antes/depois `dag init --orchestrator=cursor`

**Dependencies:** Task 9; Task 20 (script hook — stub OK para upsert path)

**Files likely touched:**
- `cli/src/hooks/hook-config-upsert.ts`
- `cli/src/hooks/boot-file-append.ts`
- `cli/src/hooks/adapters/cursor.ts`

**Estimated scope:** M

---

### Checkpoint: After Phase 4 (Tasks 8–11)

**TDD:** [§10 checklist Fase 4](../design/tdd-multi-runtime-support.md#10-plano-de-implementação)

- [ ] `dag init --orchestrator=antigravity` E2E em projeto limpo
- [ ] Golden gate ainda verde
- [ ] Hook upsert não apagou hooks terceiros

---

### Phase 5: Runner + vault + auditor

> **Pode paralelizar com Phase 4** após Task 7. **Não modificar `dag_runner.py` antes do golden gate** ([§6](../design/tdd-multi-runtime-support.md#6-plano-de-migração)).

## Task 12: `dag_runner.py` reads `dag-config.json`

**Description:** Worker CLI via `command_template`; remover hardcode `agy`.

**TDD:** [§5.4](../design/tdd-multi-runtime-support.md#54-dag-configjson), [§6](../design/tdd-multi-runtime-support.md#6-plano-de-migração), [§5.13](../design/tdd-multi-runtime-support.md#513-worker-permission-flags-equivalente-adr-0003)

**ADRs:** 0014, [0017](../adr/0017-per-runtime-worker-permission-flags.md), [0003](../adr/0003-worker-unsandboxed-cli-execution.md)

**Evidência:** `scripts/dag_runner.py` (~linha 139), `cli/manifests/*/manifest.json` `command_template`

**Não fazer:** Hardcode `agy` ou flags cursor no Python ([C8](../design/tdd-multi-runtime-support.md#c8--alterar-auditorpy-para-cada-runtime) não se aplica aqui, mas mesmo princípio)

**Acceptance criteria:**
- [ ] Lê `dag-config.json` adjacente aos scripts
- [ ] Substitui `<<<PROMPT>>>` no template
- [ ] Falha explícita se config ausente

**Verification:**
- [ ] `scripts/test_dag_runner.py` atualizado e passando

**Dependencies:** Task 7 (schema config); Golden Gate para merge

**Files likely touched:**
- `scripts/dag_runner.py`
- `scripts/test_dag_runner.py`

**Estimated scope:** S

---

## Task 13: `DAG_FLOW_WORKER=1` on worker spawn

**Description:** Env bypass para Guard durante execução DAG.

**TDD:** [D11 Guard bypass](../design/tdd-multi-runtime-support.md#d11--dag-flow-hook-guard--router--implementar-de-verdade), [Apêndice A](../design/tdd-multi-runtime-support.md#apêndice-a--evidência-de-drift-documental), [§10 checklist Fase 9](../design/tdd-multi-runtime-support.md#10-plano-de-implementação)

**ADRs:** 0010

**Evidência:** `scripts/dag_runner.py` (spawn worker subprocess)

**Não fazer:** Setar env no processo auditor ou orchestrator

**Acceptance criteria:**
- [ ] `DAG_FLOW_WORKER=1` apenas no subprocess do worker CLI

**Verification:**
- [ ] Teste ou log confirmando env no worker child

**Dependencies:** Task 12

**Files likely touched:**
- `scripts/dag_runner.py`

**Estimated scope:** XS

---

## Task 14: Vault status synchronization

**Description:** Corrigir bug D2: atualizar vault `.specs/dags/*.json`, não só runs copy.

**TDD:** [D2](../design/tdd-multi-runtime-support.md#d2--pending-dag-guard-e-status-no-vault), [§10 Fase 5](../design/tdd-multi-runtime-support.md#10-plano-de-implementação)

**ADRs:** 0012, [0005](../adr/0005-os-level-gating-and-topology-separation.md)

**Evidência:** `scripts/dag_runner.py` (`vault_file` vs `tasks_file`), `scripts/update_task_status.py`, `scripts/commit_spec.sh` (chmod unlock)

**Não fazer:** Atualizar só `.specs/runs/` ([D2 alternativa rejeitada](../design/tdd-multi-runtime-support.md#d2--pending-dag-guard-e-status-no-vault))

**Acceptance criteria:**
- [ ] Done/Failed refletidos no vault JSON
- [ ] Cópia em `runs/` ainda atualizada
- [ ] chmod 555 no vault: unlock temporário ao escrever

**Verification:**
- [ ] Teste: task → Done → vault contém `Done`

**Dependencies:** Task 12

**Files likely touched:**
- `scripts/dag_runner.py`
- `scripts/update_task_status.py`

**Estimated scope:** M

---

## Task 15: `auditor.py` PASS contract (D6)

**Description:** Exigir `PASS` case-sensitive no stdout além de exit 0.

**TDD:** [D6](../design/tdd-multi-runtime-support.md#d6--auditor-gate-contract-invariante), [§5.12](../design/tdd-multi-runtime-support.md#512-worker-runtime-validation-spike-protocolo-s1), [§8 testes](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes)

**ADRs:** [0008](../adr/0008-cognitive-hardening-and-json-dag.md) (contrato auditor)

**Evidência:** `scripts/auditor.py` (linhas 53–56 atuais)

**Não fazer:** Tornar `auditor.py` runtime-aware — usar `auditor_wrapper` no manifest ([C8](../design/tdd-multi-runtime-support.md#c8--alterar-auditorpy-para-cada-runtime))

**Acceptance criteria:**
- [ ] exit 0 sem `PASS` → falha
- [ ] exit 0 com `PASS` → sucesso

**Verification:**
- [ ] Unit tests com stdout mockado

**Dependencies:** Nenhuma (paralelo com 12–14)

**Files likely touched:**
- `scripts/auditor.py`

**Estimated scope:** S

---

### Phase 6: `dag update`

## Task 16: Pending DAG Guard

**Description:** Bloquear update se qualquer task no vault não estiver Done.

**TDD:** [D2](../design/tdd-multi-runtime-support.md#d2--pending-dag-guard-e-status-no-vault), [§5.6 passo 1](../design/tdd-multi-runtime-support.md#56-comando-dag-update), [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes)

**ADRs:** 0012

**Evidência:** `.specs/dags/*.json` (formato task status), `scripts/dag_runner.py`

**Não fazer:** Checar só existência de arquivo; permitir `Failed` ([Q13](../design/tdd-multi-runtime-support.md#-resolvidas-grill-2026-06-20))

**Acceptance criteria:**
- [ ] Varre `.specs/dags/*.json`
- [ ] `Pending`, `Failed`, ausente → abort total
- [ ] Todas `Done` → prossegue

**Verification:**
- [ ] Unit tests com fixtures JSON

**Dependencies:** Task 14

**Files likely touched:**
- `cli/src/guards/pending-dag-guard.ts`

**Estimated scope:** S

---

## Task 17: `dag update` recompile + preserve worker + re-wire hooks

**Description:** Caminho de upgrade pós-init.

**TDD:** [§5.6](../design/tdd-multi-runtime-support.md#56-comando-dag-update), [D12](../design/tdd-multi-runtime-support.md#d12--dag-update-re-wire-hooks), [D5](../design/tdd-multi-runtime-support.md#d5--init-idempotency)

**ADRs:** 0010, 0012

**Evidência:** Task 11 hook wiring (reusar mesmo protocolo)

**Não fazer:** Sobrescrever seção `worker` de `dag-config.json` sem intenção; skip guard

**Acceptance criteria:**
- [ ] Guard primeiro (Task 16)
- [ ] Recompila markdowns; preserva `dag-config.json` → `worker`
- [ ] Atualiza `_meta.dag_flow_version`
- [ ] Re-wire hooks idempotente (mesmo que init)

**Verification:**
- [ ] Integração: dois `dag update` → uma entrada hook

**Dependencies:** Tasks 9, 11, 16

**Files likely touched:**
- `cli/src/commands/update.ts`

**Estimated scope:** M

---

### Phase 7: Cursor built-in

## Task 18: Cursor manifest + ship

**Description:** Primeiro runtime multi-runtime real pós-infra.

**TDD:** [§5.7 exemplo cursor](../design/tdd-multi-runtime-support.md#57-manifests-built-in-e-schema-manifestjson), [D8](../design/tdd-multi-runtime-support.md#d8--built-ins-v1-antigravity--cursor-claude-adiado), [§5.13](../design/tdd-multi-runtime-support.md#513-worker-permission-flags-equivalente-adr-0003), [§12 S1/S2](../design/tdd-multi-runtime-support.md#s1--resultados-worker-runtime-validation-spike) (spike já ✅)

**ADRs:** 0016, [0017](../adr/0017-per-runtime-worker-permission-flags.md)

**Evidência:** Spike results TDD §12; `cli/manifests/antigravity/` como modelo

**Não fazer:** `--dangerously-skip-permissions` no cursor ([Apêndice B](../design/tdd-multi-runtime-support.md#apêndice-b--confusões-comuns-não-repita)); manifest `claude` ([Q18](../design/tdd-multi-runtime-support.md#-resolvidas-grill-2026-06-20))

**Acceptance criteria:**
- [ ] `cli/manifests/cursor/manifest.json` + `partials/spawn-subagent.md`
- [ ] `hook_wiring_tier: pre_tool_use`; flags §5.13 no worker
- [ ] `worker_validation_status: validated`
- [ ] `dag init --orchestrator=cursor` → `.cursor/skills/dag-flow/`

**Verification:**
- [ ] Spot-check compiled `references/tasks.md`: `cursor agent` em gates, `Shell`/`Task` em tools

**Dependencies:** Tasks 9, 11, 17

**Files likely touched:**
- `cli/manifests/cursor/manifest.json`
- `cli/manifests/cursor/partials/spawn-subagent.md`

**Estimated scope:** S

---

### Phase 8: Extensibility

## Task 19: `dag manifest scaffold --extends`

**Description:** CLI para manifests custom herdando built-in.

**TDD:** [D7](../design/tdd-multi-runtime-support.md#d7--dag-manifest-scaffold---extends-obrigatório), [§5.8](../design/tdd-multi-runtime-support.md#58-herança-extends), [§7](../design/tdd-multi-runtime-support.md#7-estrutura-monorepo-alvo)

**ADRs:** 0013, 0016

**Evidência:** `cli/manifests/cursor/` (template alvo)

**Não fazer:** Scaffold sem `--extends` ([D7](../design/tdd-multi-runtime-support.md#d7--dag-manifest-scaffold---extends-obrigatório))

**Acceptance criteria:**
- [ ] `dag manifest scaffold --extends=cursor --output=./my-runtime/` gera estrutura
- [ ] Sem `--extends` → erro listando built-ins

**Verification:**
- [ ] CLI tests happy + error path

**Dependencies:** Task 6

**Files likely touched:**
- `cli/src/commands/manifest/scaffold.ts`

**Estimated scope:** S

---

### Phase 9: dag-flow Hook Guard + Router

## Task 20: `cli/hooks/dag-flow-guard.mjs`

**Description:** Guard físico + Router cognitivo — npm CLI, não Compiled Skill.

**TDD:** [D11 completo](../design/tdd-multi-runtime-support.md#d11--dag-flow-hook-guard--router--implementar-de-verdade), [§5.10](../design/tdd-multi-runtime-support.md#510-hook-config-upsert-algoritmo), [Apêndice A](../design/tdd-multi-runtime-support.md#apêndice-a--evidência-de-drift-documental)

**ADRs:** 0010

**Evidência:** `references/quick-mode.md` (frases canônicas Router), `.cursor/hooks/tool-routing.mjs` (referência de hook shape)

**Não fazer:** `hooks/dag-flow-src-guard.sh` na raiz; detectar sessão dag-flow ativa; sempre sugerir Quick Mode

**Heurística Router (resumo — detalhe no TDD D11):**
- Quick: frase canônica OU (1–2 arquivos + erro/sintoma + sem requisitos novos)
- Senão: Specify (viés Specify se ambíguo)

**Acceptance criteria:**
- [ ] Bloqueia write em `src/`, `lib/`, `api/`, `test/` sem `DAG_FLOW_WORKER=1`
- [ ] Mensagem adaptativa única conforme template D11
- [ ] Autossuficiente no `preToolUse` (sem depender de ordem com outros hooks)

**Verification:**
- [ ] Unit tests Router ([§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes))
- [ ] Manual: payload preToolUse simulado

**Dependencies:** Task 5

**Files likely touched:**
- `cli/hooks/dag-flow-guard.mjs`
- `cli/test/hook-router.test.ts`

**Estimated scope:** M

---

### Phase 10–11: Cleanup

## Task 21: Inline discovery + delete `references/discovery.md` (D9)

**Description:** Eliminar arquivo redundante; protocolo curto no SKILL.md.

**TDD:** [D9](../design/tdd-multi-runtime-support.md#d9--eliminar-referencesdiscoverymd), [§4 out of scope implícito](../design/tdd-multi-runtime-support.md#4-escopo-v1)

**ADRs:** —

**Evidência:** `references/discovery.md`, `SKILL.md` (seção Discovery)

**Não fazer:** Manter links órfãos para `discovery.md`

**Acceptance criteria:**
- [ ] ~5 linhas inline em SKILL.md: `ctx_search` only; `CONTEXT.md` sob pedido explícito
- [ ] `references/discovery.md` removido
- [ ] Zero links órfãos

**Verification:**
```bash
rg 'discovery\.md' && exit 1 || echo OK
```

**Dependencies:** Task 3 (placeholders não devem referenciar discovery.md)

**Files likely touched:**
- `SKILL.md`
- `references/discovery.md` (delete)

**Estimated scope:** XS

---

## Task 22: Remove `setup_indexer.sh` from dag-flow flows (D10)

**Description:** Desacoplar dag-flow de context-mode no install.

**TDD:** [D10](../design/tdd-multi-runtime-support.md#d10--matar-hookssetup_indexersh), [D4](../design/tdd-multi-runtime-support.md#d4--init-prerequisites-gate-cli-não-skill), [§7](../design/tdd-multi-runtime-support.md#7-estrutura-monorepo-alvo)

**ADRs:** [0002](../adr/0002-offload-global-indexing-to-hook.md) (contexto histórico — não reintroduzir no init)

**Evidência:** `hooks/setup_indexer.sh`, `README.md`, `docs/getting-started.md`

**Não fazer:** `dag init` configurar context-mode ([C7](../design/tdd-multi-runtime-support.md#c7--reintroduzir-setup_indexersh-no-dag-init))

**Acceptance criteria:**
- [ ] Docs apontam para `dag init` + context-mode como pré-requisito separado
- [ ] `setup_indexer.sh` removido ou deprecated com redirect claro

**Verification:**
```bash
rg 'setup_indexer' README.md docs/
# → apenas menções de migração/deprecação, não instrução primária
```

**Dependencies:** Task 10

**Files likely touched:**
- `hooks/setup_indexer.sh`
- `README.md`
- `docs/getting-started.md`

**Estimated scope:** S

---

### ⛔ Checkpoint: V1 Complete

**TDD:** [§4 Escopo V1](../design/tdd-multi-runtime-support.md#4-escopo-v1), [§10 checklist](../design/tdd-multi-runtime-support.md#10-plano-de-implementação), [§13](../design/tdd-multi-runtime-support.md#13-status-de-decisões)

- [ ] Golden gate passa
- [ ] `dag init` + `dag update` para `antigravity` e `cursor`
- [ ] `dag_runner.py` + vault + auditor PASS
- [ ] Guard bloqueia src/ no Cursor; bypass com `DAG_FLOW_WORKER=1`
- [ ] ADRs 0010–0017 aceitos
- [ ] Review humano

---

## Test Strategy

| Área | Task | TDD | Comando |
|------|------|-----|---------|
| Compiler 2-pass | 7 | [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes) | `npm test -- runtime-compiler` |
| extends merge | 6 | [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes) | `npm test -- manifest-resolver` |
| Pending DAG Guard | 16 | [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes) | unit tests |
| Hook Router | 20 | [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes) | unit tests |
| Hook upsert | 11 | [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes) | unit + manual `.cursor/hooks.json` |
| **Golden gate** | 4 | [§5.11](../design/tdd-multi-runtime-support.md#511-gate-de-ouro--script-de-paridade-antigravity) | `./cli/scripts/verify-antigravity-parity.sh` |
| dag init | 9–10 | [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes) | integration tests |
| dag update | 17 | [§8](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes) | integration tests |

---

## Parallelization

| Track | Start after | Notes |
|-------|-------------|-------|
| F5 (Tasks 12–15) | Task 7 | Não merge `dag_runner` antes do golden gate |
| F9 (Task 20) | Task 5 | ∥ F7 (Task 18) |
| F3 (Tasks 5–7) | Task 1 | Pode branch paralelo a Task 3; merge só após gate |

---

## Questões em aberto (grill)

| # | Questão | Status | Resolução |
|---|---------|--------|-----------|
| Q1 | Slugs dos ADRs 0010–0016 | ✅ Fechado 2026-06-20 | Tabela abaixo — canônica para Task 0 |
| Q2 | Test runner do pacote `cli/` | ✅ Fechado 2026-06-20 | **Jest**, config autocontida em `cli/` (esbuild build; não depender de `jest.preset.js`) |
| Q3 | Publicar pacotes no npm em V1? | ✅ Fechado 2026-06-20 | **Não publicar** — instalação local via clone + `npm link` ([Q3](#q3--instalação-local-npm-link)) |

### Q1 — Slugs ADR (aceito)

| ADR | Arquivo |
|-----|---------|
| 0010 | `docs/adr/0010-dag-flow-hook-guard-router.md` |
| 0011 | `docs/adr/0011-dual-manifest-compilation.md` |
| 0012 | `docs/adr/0012-pending-dag-guard.md` |
| 0013 | `docs/adr/0013-manifest-inheritance.md` |
| 0014 | `docs/adr/0014-orchestrator-worker-split.md` |
| 0015 | `docs/adr/0015-compiled-skill-scripts-whitelist.md` |
| 0016 | `docs/adr/0016-v1-runtime-scope.md` |

### Q2 — Test runner (aceito)

- **Jest** em `cli/` — config própria (`jest.config.ts`), sem preset monorepo
- Build: **esbuild** (mesmo padrão que `mcp/`)
- Scripts: `"test": "jest"`, testes em `cli/test/**/*.test.ts` ou `**/*.test.ts`

### Q3 — Instalação local (`npm link`)

**Decisão:** Nenhum pacote dag-flow (`mcp/`, futuro `cli/`) é publicado no npm registry em V1. Desenvolvimento e uso pessoal via **clone do repo + build + `npm link`**.

Relatório de menções enganosas a publicação: [`docs/reports/npm-install-drift-report.md`](../reports/npm-install-drift-report.md).

#### Pré-requisitos globais (fora do repo)

```bash
npm install -g context-mode
cargo install rtk-ai   # ou equivalente — ver README
```

#### MCP (`mcp/`) — hoje

```bash
cd /path/to/dag-flow/mcp
npm install
npm run build          # gera main.js na raiz do pacote

# Disponibilizar bin globalmente no seu ambiente
npm link               # registra @dag-flow/skills-mcp → agent-skills-mcp

# Verificar
which agent-skills-mcp
agent-skills-mcp       # ou: node main.js (stdio MCP)
```

**Runtime MCP config** — caminho absoluto ao bundle local (não `npx` do registry):

```json
{
  "mcpServers": {
    "dag-flow-skills": {
      "command": "node",
      "args": ["/absolute/path/to/dag-flow/mcp/main.js"]
    }
  }
}
```

Alternativa após `npm link`: `"command": "agent-skills-mcp"` se o link global estiver no PATH do runtime.

**Desfazer link:** `npm unlink -g` dentro de `mcp/`.

#### CLI `dag` (`cli/`) — após Task 5 existir

```bash
cd /path/to/dag-flow/cli
npm install
npm run build

npm link               # expõe bin `dag` globalmente

dag --help
dag init --orchestrator=cursor   # no root do projeto alvo
```

O hook upsert (§5.10) resolve `dag-flow-guard.mjs` via **caminho absoluto do pacote npm linkado** — por isso `npm link` (ou `npm install -g /path/to/cli`) é necessário; copiar só `dist/` sem link quebra o wiring.

**Futuro (pós-V1):** publicar `@dag-flow/cli` e `@dag-flow/skills-mcp` — fora de escopo agora; remover `publishConfig` ou documentar como “reserved” até lá.

---

## Risks

| Risk | TDD | Mitigation |
|------|-----|------------|
| Paridade quebrada | [§9](../design/tdd-multi-runtime-support.md#9-riscos) | Task 4 em todo PR que toca compiler/source |
| Hooks apagados | [§9](../design/tdd-multi-runtime-support.md#9-riscos) | Task 11 test com `.cursor/hooks.json` real |
| Vault guard falso positivo | [§9](../design/tdd-multi-runtime-support.md#9-riscos) | Task 14 antes de 16 |
| Flags cursor em CI frio | [§5.13](../design/tdd-multi-runtime-support.md#513-worker-permission-flags-equivalente-adr-0003) | Sempre `--trust --force --approve-mcps` no manifest |

---

## Prompt sugerido para agente implementador

```text
Implemente multi-runtime V1 do dag-flow.

## Leitura inicial (uma vez)
1. docs/design/tdd-multi-runtime-support.md — seção "Leia isto primeiro"
2. CONTEXT.md
3. docs/planning/multi-runtime-implementation-plan.md

## Papéis dos documentos
- Plano → ordem das tasks, checkpoints, verificação
- TDD → toda decisão de implementação (seções citadas em cada task)
- Não use docs/planning/archive/* nem setup_indexer como verdade

## Por task
1. Abra a task N no plano
2. Leia TDD + ADRs + Evidência listados na task
3. Implemente só essa task
4. Rode Verificação e marque acceptance criteria

## Regras fixas
- Uma task por vez (Task 0 ADRs já existem — revisar; começar Task 1 se OK)
- Não avance da Fase 2 sem verify-antigravity-parity.sh verde
- Instalação local: npm link (Q3) — nada no npm registry em V1
- Não reabra decisões ✅ em TDD §12
```

---

## Referências cruzadas

| Documento | Papel |
|-----------|-------|
| [`docs/design/tdd-multi-runtime-support.md`](../design/tdd-multi-runtime-support.md) | Especificação completa |
| [`CONTEXT.md`](../../CONTEXT.md) | Glossário |
| [`docs/adr/0017-per-runtime-worker-permission-flags.md`](../adr/0017-per-runtime-worker-permission-flags.md) | Flags worker (aceito) |
| [TDD §14](../design/tdd-multi-runtime-support.md#14-referências) | Índice de arquivos de evidência no repo |
