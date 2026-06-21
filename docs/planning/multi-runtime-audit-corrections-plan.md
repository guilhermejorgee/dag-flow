# Implementation Plan: Multi-Runtime V1 Audit Corrections

| Field | Value |
|-------|-------|
| **Source** | [`docs/reports/multi-runtime-v1-audit-report.md`](../reports/multi-runtime-v1-audit-report.md) |
| **Parent plan** | [`docs/planning/multi-runtime-implementation-plan.md`](multi-runtime-implementation-plan.md) (Tasks 0–22 — **done**; do not re-implement) |
| **TDD** | [`docs/design/tdd-multi-runtime-support.md`](../design/tdd-multi-runtime-support.md) |
| **Scope** | 5 audit anomalies (4 Medium, 1 Low) |
| **Status (2026-06-21)** | **✅ COMPLETO** — Q1, Q2, Tasks 1–5; anomalias A1–A5 fechadas |
| **Out of scope** | Layer 2/3 passed clean; informational audit notes (see §Out of Scope) |

---

## Como usar (agente em sessão zerada)

**Não implemente só com este arquivo.** Ele não repete o TDD inteiro — aponta seções exatas por task.

### Ordem de leitura obrigatória (uma vez)

1. [`docs/reports/multi-runtime-v1-audit-report.md`](../reports/multi-runtime-v1-audit-report.md) — o que está errado e por quê
2. Este plano — tasks, ordem, verificação
3. TDD seções citadas na primeira task que for implementar
4. [`CONTEXT.md`](../../CONTEXT.md) — glossário (`Compiled Skill`, `vault`, `skill_install_path`)

### Por task

```
Task N → ler "TDD" + "ADRs" + "Evidência" + "Por quê" → implementar só o descrito → "Verificação"
```

### Invariante absoluta

**Não altere** código que passou audit (runner, vault, hooks, auditor). **Não reabra** Tasks 0–22 do plano pai.

### Legenda

| Coluna | Significado |
|--------|-------------|
| **TDD** | Seções a ler antes de codar |
| **ADRs** | ADRs relevantes |
| **Evidência** | Arquivo + linhas do bug atual |
| **Por quê** | Motivo de negócio / segurança — não pule |
| **Não fazer** | Anti-padrões que reintroduzem o bug |

---

## Overview

Multi-Runtime V1 foi auditado em 2026-06-21. Implementação **substancialmente correta** — 0 Critical, 0 High. Três bugs documentados no TDD (hardcoded `agy`, auditor sem `PASS`, vault não atualizado) estão **corrigidos**.

Restam **5 desvios de spec** — todos fecháveis com diffs pequenos. Este plano é **somente** para essas correções.

---

## Contexto do audit (o que foi verificado)

| Layer | Escopo | Resultado |
|-------|--------|-----------|
| Layer 1 — CLI / Compiler | `init.ts`, `manifest-resolver.ts`, parity script | 3 Medium + 1 Low |
| Layer 2 — Hook Wiring | Tasks 11, 20 | 12/12 PASS — **não tocar** |
| Layer 3 — Runner, Vault, Auditor | Tasks 12–15 | 8/8 PASS — **não tocar** |
| Layer 4 — Gates / Update | `pending-dag-guard.ts`, parity cross-check | 1 Medium + 1 Low |

---

## Mapa problema → correção

| ID | Sev | Evidência (arquivo:linhas) | Problema | Correção |
|----|-----|---------------------------|----------|----------|
| A1 | Med | `init.ts:107–117` | Worker resolve antes de idempotency | Orchestrator resolve → idempotency → worker resolve |
| A2 | Med | `manifest-resolver.ts:37–39` | `startsWith` em vez de presença de `/` ou `.` | `ref.includes('/') \|\| ref.includes('.')` |
| A3 | Med | `verify-antigravity-parity.sh:16–30` | `node dist`, flags extras, build inline, exclude README | Script §5.11 + `dag` global |
| A4 | Med | `pending-dag-guard.ts:29–32` | `.includes('Done')` aceita `"Not Done"` | `status === 'Done'` |
| A5 | Low | `antigravity-parity-golden/README.md` | Arquivo fora whitelist §5.9 | Deletar README |

---

## Decisão de arquitetura — A1 (init step order)

### Tensão TDD

§5.5 lista: (2) idempotency **antes** de (3) resolve manifests. Mas (2) precisa de `skill_install_path` que vem do manifest orchestrator.

### Compromisso aceito (fecha audit A1)

| Fase | O que roda | Por quê |
|------|------------|---------|
| 2a | `resolveManifest(orchestrator)` **com** `extends` merge | `skill_install_path` pode ser herdado/sobrescrito (§5.8) |
| 2b | `assertCompiledSkillAbsent(outputDir)` | D5 — usuário com skill instalada deve ver `InitError`, não erro de worker |
| 3 | `resolveManifest(worker)` **somente se** `worker !== orchestrator` | Erro de worker **não** mascara idempotency |
| 4–8 | compile → scaffold → hooks → dag-config | Inalterado |

**Não** usar peek sem `extends` — quebra manifests custom com `"extends": "cursor"` e `skill_install_path` herdado.

**Caso de teste obrigatório:** compiled skill existe + `--worker=__nonexistent__` → `InitError` (mensagem D5), **não** `ManifestResolverError`.

### Instalação path — parity script (A3)

| Fonte | Valor |
|-------|-------|
| `cli/manifests/antigravity/manifest.json` L11 | `"skill_install_path": ".agents/skills"` |
| TDD §5.11 | `$OUT/.agents/skills/dag-flow` — **alinhado ao manifest** (TDD corrigido 2026-06-21) |
| **COMPILED correto no parity script** | `$OUT/.agents/skills/dag-flow` |

---

## Questões resolvidas (2026-06-21)

### Q1 — Path no TDD §5.11 vs manifest antigravity

| | Decisão |
|---|---------|
| **Problema** | TDD exemplo usava `$OUT/skills/dag-flow`; manifest L11 = `.agents/skills` |
| **Fonte de verdade** | `cli/manifests/antigravity/manifest.json` → `orchestrator.skill_install_path` |
| **Resolução** | TDD §5.11 atualizado: path `$OUT/.agents/skills/dag-flow`, script canônico completo, nota de pré-requisito `npm link` |
| **Artefato** | `docs/design/tdd-multi-runtime-support.md` §5.11 |

### Q2 — CI e `npm link` antes do golden gate

| | Decisão |
|---|---------|
| **Problema** | Repo não tinha workflow CI; parity script antigo fazia `npm run build` + `node dist` inline |
| **Resolução** | Workflow `.github/workflows/cli-golden-gate.yml`: `npm ci` → `build` → `npm link` → `verify-antigravity-parity.sh` → `npm test` → `typecheck` |
| **Local** | `cd cli && npm run golden-gate` (build + link + parity) |
| **Session scripts** | `validate-session4.sh` chama `npm link` antes do gate |
| **Trigger** | push/PR em `cli/`, Source Skill (`SKILL.md`, `references/`, `scripts/`) |

**Status Tasks 1–5 + Q1/Q2:** ✅ implementados 2026-06-21. Ver **§Regressão — já implementado** antes de cada sessão.

---

## Regressão — já implementado (rodar sempre)

Antes de fechar o plano ou abrir PR, validar que o trabalho de Q1/Q2/Tasks 3/5 **não regrediu**:

```bash
# Q2 + Task 5 — golden gate local
cd cli && npm run golden-gate

# Task 3 — README ausente no golden
test ! -f cli/test/fixtures/antigravity-parity-golden/README.md

# Task 5 — script sem desvios auditados (mensagem de erro pode citar npm run build)
! rg -q 'node dist/index\.js|^npm run build' cli/scripts/verify-antigravity-parity.sh
! rg -q -- '--skill-install-path' cli/scripts/verify-antigravity-parity.sh
! rg -q 'exclude=README' cli/scripts/verify-antigravity-parity.sh

# Task 5 — path manifest default no script
rg -q '\.agents/skills/dag-flow' cli/scripts/verify-antigravity-parity.sh

# Q1 — TDD §5.11 alinhado ao manifest (sem path stale skills/)
! rg -q '\$OUT/skills/dag-flow' docs/design/tdd-multi-runtime-support.md
rg -q '\.agents/skills/dag-flow' docs/design/tdd-multi-runtime-support.md

# Q2 — CI workflow existe e chama link + gate
test -f .github/workflows/cli-golden-gate.yml
rg -q 'npm link' .github/workflows/cli-golden-gate.yml
rg -q 'verify-antigravity-parity' .github/workflows/cli-golden-gate.yml

# Q2 — session scripts linkam antes do gate
rg -q 'npm link' cli/scripts/validate-session4.sh
rg -q 'npm link' cli/scripts/validate-session8.sh
rg -q 'npm link' cli/scripts/validate-session10.sh

# Suite completa
cd cli && npm test
```

**CI (Q2):** push/PR nos paths do workflow dispara o mesmo gate em GitHub Actions — não substitui checagem local antes do merge.

---

## Out of scope (não implementar neste plano)

1. Smoke fixture `scripts/dag-config.json` incompleto
2. Mensagem cosmetic `wire-hooks.ts` tier `none`
3. Teste integração `runUpdate` × 2 sem assert hook count
4. Links `discovery.md` em `docs/planning/archive/`
5. Reimplementar Tasks 0–22

---

## Dependency graph

```
Task Q (Q1+Q2) ──► Task 3 ──► Task 5     ✅ FEITO
Task 1 ─┐
Task 2 ─┼─ ✅ FEITO (2026-06-21)
Task 4 ─┘   (re-validou Task 5)
```

Ordem single-agent: **1 → 2 → 4** → §Regressão → checkpoint final — **✅ concluída 2026-06-21**.

**Não reimplementar** salvo regressão falhar.

---

## Task List

---

### Phase 0: Questões abertas — ✅ FEITO (2026-06-21)

## Task Q: Resolver Q1 (TDD path) + Q2 (CI / npm link)

**Status:** ✅ Implementado. Não reabrir salvo regressão.

**O que foi entregue:**

| Item | Artefato |
|------|----------|
| Q1 — TDD path + script canônico | `docs/design/tdd-multi-runtime-support.md` §5.11 |
| Q2 — CI workflow | `.github/workflows/cli-golden-gate.yml` |
| Q2 — atalho local | `cli/package.json` → `"golden-gate"` |
| Q2 — session scripts | `validate-session4/8/10.sh` → `npm link` antes do gate |
| Task 3 — A5 | `README.md` deletado do golden |
| Task 5 — A3 | `verify-antigravity-parity.sh` alinhado ao TDD |

**Acceptance criteria:**
- [x] TDD §5.11 usa `$OUT/.agents/skills/dag-flow` (não `skills/`)
- [x] TDD documenta pré-requisito `npm link`
- [x] CI: `npm ci` → `build` → `link` → parity → jest → typecheck
- [x] `npm run golden-gate` passa localmente
- [x] Parity usa `dag`, sem `node dist`, sem `--skill-install-path`, sem `--exclude=README`

**Verification:** bloco completo em **§Regressão — já implementado** (acima).

---

### Phase 1: Isolated fixes

## Task 1: External manifest path detection

**Description:** Corrigir `isExternalManifestRef` para distinguir built-in ID de path externo pela **presença** de `/` ou `.` em qualquer posição.

**Por quê:** Ref `my-company/my-runtime` hoje resolve como built-in inexistente em `cli/manifests/` → erro opaco. Task 6 / §5.5 step 3 exigem paths externos com `/` ou `.`.

**TDD:** [§5.5 step 3](../design/tdd-multi-runtime-support.md#55-comando-dag-init--fluxo-completo), [§5.8](../design/tdd-multi-runtime-support.md#58-herança-extends), parent plan Task 6 acceptance

**ADRs:** [0013](../adr/0013-manifest-inheritance.md)

**Evidência — bug atual (`manifest-resolver.ts:37–39`):**
```typescript
export function isExternalManifestRef(ref: string): boolean {
  return ref.startsWith('/') || ref.startsWith('.');
}
```

**Implementação exata:**
```typescript
export function isExternalManifestRef(ref: string): boolean {
  return ref.includes('/') || ref.includes('.');
}
```

**Tabela de predicado (obrigatória nos testes):**

| `ref` | `isExternalManifestRef` | Resolve via |
|-------|-------------------------|-------------|
| `antigravity` | `false` | `cli/manifests/antigravity/` |
| `cursor` | `false` | `cli/manifests/cursor/` |
| `/abs/path/to/runtime` | `true` | filesystem |
| `./rel/runtime` | `true` | filesystem |
| `my-company/my-runtime` | `true` | filesystem |
| `runtime.v2` | `true` | filesystem |

**Não fazer:**
- Não usar `path.isAbsolute()` — spec é presença de caracteres, não semântica Node
- Não alterar `locateManifest` além do que `isExternalManifestRef` já governa
- Não adicionar lista hardcoded de built-ins no predicado — built-in = sem `/` nem `.`

**Acceptance criteria:**
- [x] Predicado conforme tabela acima
- [x] Teste integração: fixture temp `fixtures/manifest-resolver/external-nested/manifest.json` resolvido por ref relativo `external-nested` **não** — ref `my-fixtures/external-nested` **sim**

**Verification:**
```bash
cd cli && npm test -- manifest-resolver
```

**Dependencies:** None

**Files likely touched:**
- `cli/src/compiler/manifest-resolver.ts`
- `cli/test/manifest-resolver.test.ts`

**Estimated scope:** S

---

## Task 2: Strict Pending DAG Guard equality

**Description:** Guard de `dag update` deve liberar **somente** status exato `"Done"`.

**Por quê:** `.includes('Done')` é safety bug — `"Not Done"` contém substring `"Done"` e passaria o guard. TDD D2: três estados válidos apenas: `Done`, `Pending`, `Failed`. Guard é safety-critical (§8).

**TDD:** [D2](../design/tdd-multi-runtime-support.md#d2--pending-dag-guard-e-status-no-vault), [§5.6 step 1](../design/tdd-multi-runtime-support.md#56-comando-dag-update), [§8 testes](../design/tdd-multi-runtime-support.md#8-estratégia-de-testes)

**ADRs:** [0012](../adr/0012-pending-dag-guard.md)

**Evidência — bug atual (`pending-dag-guard.ts:29–32`):**
```typescript
function isTaskDone(status: string | undefined): boolean {
  const normalized = status ?? 'Pending';
  return normalized.includes('Done');
}
```

**Evidência — teste que codifica o bug (`pending-dag-guard.test.ts:85–88`):**
```typescript
it('treats status containing Done as complete (dag_runner parity)', () => {
  writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done (verified)' }]);
  expect(scanVaultDags(target).ok).toBe(true);
});
```

**Implementação exata:**
```typescript
function isTaskDone(status: string | undefined): boolean {
  return status === 'Done';
}
```
(`collectViolationsFromFile` já trata `undefined` como violação via `task.status ?? 'Pending'` na linha do `status` reportado — não mudar essa lógica.)

**Não fazer:**
- Não reintroduzir `.includes('Done')` por “paridade com dag_runner” — spec manda exact match
- Não aceitar `done` case-insensitive
- Não alterar `scanVaultDags` / `assertNoPendingDags` além de `isTaskDone`

**Acceptance criteria:**
- [x] `status === 'Done'` → pass
- [x] `'Done (verified)'` → block
- [x] `'Not Done'` → block (**regressão substring**)
- [x] `'Pending'`, `'Failed'`, ausente → block (testes existentes mantidos)

**Verification:**
```bash
cd cli && npm test -- pending-dag-guard
```

**Test changes obrigatórios:**
- [ ] **Remover** teste L85–88 (`Done (verified)`)
- [ ] **Adicionar:**
```typescript
it('blocks Not Done (substring must not pass)', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
  writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Not Done' }]);
  expect(scanVaultDags(target).ok).toBe(false);
});
```

**Dependencies:** None

**Files likely touched:**
- `cli/src/guards/pending-dag-guard.ts`
- `cli/test/pending-dag-guard.test.ts`

**Estimated scope:** XS

---

## Task 3: Remove stray README from golden fixture

**Status:** ✅ FEITO (2026-06-21). Só revalidar via §Regressão.

**Description:** Deletar `README.md` do golden — não está na whitelist §5.9 / §5.11.

**Por quê:** Parity script usa `--exclude=README.md` como workaround (audit A3.4 + A5). Fixture deve conter só o que Compiled Skill instala.

**TDD:** [§5.9](../design/tdd-multi-runtime-support.md#59-scripts-na-compiled-skill), [§5.11 baseline](../design/tdd-multi-runtime-support.md#511-gate-de-ouro--script-de-paridade-antigravity)

**ADRs:** [0015](../adr/0015-compiled-skill-scripts-whitelist.md)

**Evidência:** `cli/test/fixtures/antigravity-parity-golden/README.md` existe; compiler nunca gera README na Compiled Skill.

**Não fazer:**
- Não alterar conteúdo de `SKILL.md`, `references/`, `scripts/` no golden
- Não rebaseline golden por outro motivo
- Não adicionar README ao compiler

**Acceptance criteria:**
- [x] `cli/test/fixtures/antigravity-parity-golden/README.md` **deletado**
- [x] Golden contém: `SKILL.md`, `references/*.md`, `scripts/*` (whitelist §5.9 apenas)

**Verification:**
```bash
test ! -f cli/test/fixtures/antigravity-parity-golden/README.md && echo OK
ls cli/test/fixtures/antigravity-parity-golden/
```

**Dependencies:** None

**Files likely touched:**
- `cli/test/fixtures/antigravity-parity-golden/README.md` (delete)

**Estimated scope:** XS

---

### Phase 2: `dag init` flow order

## Task 4: Reorder `dag init` — idempotency before worker resolve

**Description:** Separar resolve orchestrator / idempotency / resolve worker para fechar audit A1.

**Por quê:** Hoje, `--worker=broken` com Compiled Skill já instalada lança `ManifestResolverError` em vez de `InitError` (“use `dag update`”). Usuário vê erro técnico errado. D5 exige abort claro quando artefato existe.

**TDD:** [§5.5](../design/tdd-multi-runtime-support.md#55-comando-dag-init--fluxo-completo), [D5](../design/tdd-multi-runtime-support.md#d5--init-idempotency), [D4](../design/tdd-multi-runtime-support.md#d4--init-prerequisites-gate-cli-não-skill)

**ADRs:** —

**Evidência — ordem errada atual (`init.ts:102–137`):**
```typescript
checkPrerequisites({ pathEnv });

const packageRoot = getPackageRoot();
const repoRoot = path.dirname(packageRoot);

const orchestratorManifest = resolveManifest(options.orchestrator, { packageRoot });  // step 3a
const workerManifest =
  options.worker === options.orchestrator
    ? orchestratorManifest
    : resolveManifest(options.worker, { packageRoot });                              // step 3b — TOO EARLY

const installPath =
  options.skillInstallPath ?? orchestratorManifest.manifest.orchestrator.skill_install_path;
const outputDir = path.join(options.target, installPath, 'dag-flow');

assertCompiledSkillAbsent(outputDir, options.force);                                  // step 2 — TOO LATE
```

**Pseudocódigo alvo (`runInit` body) — substituir bloco acima:**
```typescript
checkPrerequisites({ pathEnv });                                    // TDD 1

const packageRoot = getPackageRoot();
const repoRoot = path.dirname(packageRoot);

// TDD 2a — orchestrator resolve (extends merge OK; install path lives here)
const orchestratorManifest = resolveManifest(options.orchestrator, { packageRoot });
const installPath =
  options.skillInstallPath ?? orchestratorManifest.manifest.orchestrator.skill_install_path;
const outputDir = path.join(options.target, installPath, 'dag-flow');

assertCompiledSkillAbsent(outputDir, options.force);                // TDD 2b — idempotency

// TDD 3 — worker resolve AFTER idempotency gate
const workerManifest =
  options.worker === options.orchestrator
    ? orchestratorManifest
    : resolveManifest(options.worker, { packageRoot });

mkdirSync(outputDir, { recursive: true });                          // TDD 4+
compileRuntimeSkill({ ... });
// scaffold, wireHooks, writeDagConfig — unchanged
```

**Não fazer:**
- Não adicionar `peekOrchestratorInstallPath` sem `extends` — errado para manifests com `extends`
- Não mover `checkPrerequisites` depois de resolve
- Não resolver worker antes de `assertCompiledSkillAbsent`
- Não alterar mensagem `InitError` em `assertCompiledSkillAbsent`
- Não mudar default `skill_install_path` do antigravity manifest

**Acceptance criteria:**
- [x] Ordem no source bate pseudocódigo acima
- [x] Cenário crítico: skill exists + bad worker → `InitError`
- [x] Cenário: skill absent + bad worker → `ManifestResolverError`
- [x] `--skill-install-path` override ainda governa `outputDir` no step 2
- [x] `orchestrator === worker` não chama `resolveManifest` duas vezes para worker

**Verification:**
```bash
cd cli && npm test -- init
cd cli && npm test
```

**Teste novo obrigatório (`init.test.ts`):**
```typescript
it('aborts with InitError when compiled skill exists even if worker manifest is invalid', () => {
  const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
  const outputDir = path.join(target, 'skills', 'dag-flow');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'SKILL.md'), '# existing', 'utf8');

  const binDir = makeFakeBinDir(['context-mode', 'rtk']);
  expect(() =>
    runInit(
      [
        '--orchestrator=antigravity',
        '--worker=__nonexistent__',
        `--target=${target}`,
        '--skill-install-path=skills',
        '--project-scaffold=false',
      ],
      { pathEnv: binDir },
    ),
  ).toThrow(InitError);
});
```

**Testes existentes — não quebrar (usam `--skill-install-path=skills` explicitamente):**

| Arquivo | Nota |
|---------|------|
| `cli/test/init.test.ts` | Manter override `skills` — não é escopo desta task mudar |
| `cli/test/update.test.ts` | Idem |
| `cli/test/v1-checkpoint.test.ts` | Idem |
| `cli/test/cli-routing.test.ts` | Idem |
| `cli/scripts/validate-session*.sh` | E2E internos usam `node dist` + `--skill-install-path=skills` — OK; **devem** chamar `npm link` antes do parity gate (Q2 — já feito em 4/8/10) |

**Dependencies:** None

**Files likely touched:**
- `cli/src/commands/init.ts`
- `cli/test/init.test.ts`

**Estimated scope:** M

---

### Phase 3: Golden gate alignment

## Task 5: Align parity script with TDD §5.11

**Status:** ✅ FEITO (2026-06-21). Revalidar após Task 4 via §Regressão + `npm run golden-gate`.

**Description:** Reescrever `verify-antigravity-parity.sh` para conformidade audit A3 + A5.

**Por quê:** Gate de ouro é **invariante absoluta** do projeto (parent plan). Script atual desvia do TDD → falso negativo/positivo em CI; `node dist` ignora Q3 (`npm link`).

**TDD:** [§5.11](../design/tdd-multi-runtime-support.md#511-gate-de-ouro--script-de-paridade-antigravity), parent plan [Q3](../planning/multi-runtime-implementation-plan.md#q3--instalação-local-npm-link)

**ADRs:** [0015](../adr/0015-compiled-skill-scripts-whitelist.md), [0016](../adr/0016-v1-runtime-scope.md)

**Evidência — desvios corrigidos (não reintroduzir):**
- ~~`npm run build` inline~~ → pré-requisito externo
- ~~`node dist/index.js`~~ → `dag`
- ~~`--skill-install-path=skills`~~ → manifest default
- ~~`$OUT/skills/dag-flow`~~ → `$OUT/.agents/skills/dag-flow`
- ~~`--exclude=README.md`~~ → README removido (Task 3)

**Pré-requisito (rodar uma vez por máquina / CI job):**
```bash
cd cli && npm install && npm run build && npm link
command -v dag   # deve existir no PATH
```

**Script alvo completo** — substituir conteúdo de `cli/scripts/verify-antigravity-parity.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$(mktemp -d)"
FAKE_BIN="$(mktemp -d)"
trap 'rm -rf "$OUT" "$FAKE_BIN"' EXIT

# D4 prerequisite gate — init aborts without these on PATH
printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"

if ! command -v dag >/dev/null 2>&1; then
  echo "❌ dag not on PATH — run: cd cli && npm run build && npm link" >&2
  exit 1
fi

dag init --orchestrator=antigravity --target="$OUT" --project-scaffold=false

GOLDEN="$CLI_ROOT/test/fixtures/antigravity-parity-golden"
COMPILED="$OUT/.agents/skills/dag-flow"

diff -ru "$GOLDEN" "$COMPILED" \
  --exclude=dag-config.json \
  || { echo "❌ Gate de ouro falhou"; exit 1; }

echo "✅ Paridade Antigravity OK"
```

**Notas de implementação:**
- **Executar de:** repo root → `./cli/scripts/verify-antigravity-parity.sh` (script resolve `CLI_ROOT` internamente)
- **`COMPILED`:** `$OUT/.agents/skills/dag-flow` porque antigravity manifest L11 = `.agents/skills` **sem** override
- **Manter** fake `context-mode` + `rtk` — D4; não é desvio do TDD
- **Remover** `npm run build` do script — build é pré-requisito externo
- **Remover** `--exclude=README.md` — Task 3 deletou README do golden

**Não fazer:**
- Não voltar `--skill-install-path=skills` no parity script
- Não usar `node dist/index.js`
- Não adicionar excludes extras no `diff`
- Não alterar mensagens de exit (`❌ Gate de ouro falhou` / `✅ Paridade Antigravity OK`)
- Não alterar golden fixture além do README (Task 3)

**Acceptance criteria:**
- [x] Script match template acima (salvo paths `SCRIPT_DIR`/`CLI_ROOT` equivalentes)
- [x] Zero `--skill-install-path` no script
- [x] `diff` exclui só `dag-config.json`
- [x] `./cli/scripts/verify-antigravity-parity.sh` exit 0 após pré-requisito `npm link`

**Verification:** §Regressão — já implementado; após Task 4 rodar de novo.

**Dependencies:** Task 3 ✅; re-validar após Task 4

**Files likely touched:**
- `cli/scripts/verify-antigravity-parity.sh`

**Estimated scope:** S

---

### Checkpoint: Audit corrections complete — ✅ FEITO (2026-06-21)

- [x] A1 — Task 4 (init step order)
- [x] A2 — Task 1 (external manifest)
- [x] A3 — Task 5 (parity script) + Task 4 re-validação
- [x] A4 — Task 2 (strict guard)
- [x] A5 — Task 3 (golden README)
- [x] Q1 + Q2 — TDD §5.11 + CI workflow
- [x] §Regressão — bloco shell verde
- [x] `npm run golden-gate` verde
- [x] `cd cli && npm test` — 161 testes verdes
- [x] Layer 2/3 untouched
- [x] Teste InitError + worker inválido (Task 4)
- [ ] CI GitHub Actions verde no PR (Q2) — validar no merge

---

## Test strategy (completa)

| Escopo | Comando | Status |
|--------|---------|--------|
| **Q + Tasks 3,5 (regressão)** | §Regressão — bloco shell | ✅ rodar sempre |
| **Q2 CI** | push/PR → `.github/workflows/cli-golden-gate.yml` | ✅ no merge |
| Task 1 | `cd cli && npm test -- manifest-resolver` | ✅ |
| Task 2 | `cd cli && npm test -- pending-dag-guard` | ✅ |
| Task 4 | `cd cli && npm test -- init` + `npm test` | ✅ |
| Pós Task 4 | §Regressão + `npm run golden-gate` | ✅ |

---

## Parallelization

| Track | Tasks |
|-------|-------|
| A (parallel) | 1, 2, 3 |
| B | 4 (após ou durante A) |
| C | 5 (após 3 + 4) |

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Agent implementa peek sem extends | Pseudocódigo Task 4 proíbe; usa `resolveManifest(orchestrator)` |
| Parity falha sem `dag` on PATH | `command -v dag` + mensagem com `npm link` |
| Agent muda testes de sessão para `.agents/skills` | Tabela “não quebrar” — só parity script muda path |
| Agent mantém `--exclude=README.md` | Task 5 template não tem exclude |

---

## Prompt para agente implementador

```text
Implemente correções RESTANTES do audit Multi-Runtime V1.

Já feito (só regressão — NÃO reimplementar):
- Task Q, 3, 5 — TDD §5.11, CI, parity script, golden README
- Rodar §Regressão — já implementado no plano

Pendente: Tasks 1 → 2 → 4

Leitura obrigatória:
1. docs/reports/multi-runtime-v1-audit-report.md
2. docs/planning/multi-runtime-audit-corrections-plan.md

Após Task 4: §Regressão + npm run golden-gate + npm test
```

---

## Referências

| Documento | Papel |
|----------|-------|
| [Audit report](../reports/multi-runtime-v1-audit-report.md) | Findings + evidence lines |
| [Parent plan](multi-runtime-implementation-plan.md) | V1 completo (já implementado) |
| [TDD](../design/tdd-multi-runtime-support.md) | Spec authority |
| [ADR-0012](../adr/0012-pending-dag-guard.md) | Guard contract |
| [ADR-0013](../adr/0013-manifest-inheritance.md) | External manifests + extends |
| [ADR-0015](../adr/0015-compiled-skill-scripts-whitelist.md) | Golden content |
