# New Runtime Implementation Guide

| Field | Value |
|-------|-------|
| **Goal** | Onboard a runtime with **parity guarantees** across built-ins (Antigravity, Cursor, future) |
| **Spec** | [`docs/design/tdd-multi-runtime-support.md`](../design/tdd-multi-runtime-support.md) |
| **Reference** | [`docs/planning/archive/multi-runtime-audit-corrections-plan.md`](../planning/archive/multi-runtime-audit-corrections-plan.md) Task 6 (Cursor gate — completed) |
| **Anti-patterns** | [TDD Appendix C](../design/tdd-multi-runtime-support.md#apêndice-c--anti-padrões-de-implementação) |
| **Central harness** | [`cli/test/golden-gate.test.ts`](../../cli/test/golden-gate.test.ts) |

---

## What “runtime parity” means

| Means | Does not mean |
|-------|----------------|
| Same **guarantee level** (manifest, golden, shell script, central Jest, CI) | Same compiled output byte-for-byte |
| Same **CLI protocol** (`dag init`, `update`, compiler, hooks per tier) | Same hook tier or worker CLI |
| Each runtime freezes **its** output in a golden fixture | Copy another runtime’s golden and edit |
| **Bidirectional invariants** (runtime X in golden X; no leakage from Y) | Shell gate only, without Jest asserts |

**Golden rule:** a built-in is ship-ready when it has manifest + worker spike + fixture + `verify-{id}-parity.sh` + `golden-gate.test.ts` extension + `{id}-manifest.test.ts` + CI.

---

## Central parity layer: `golden-gate.test.ts`

After Task 6, **shell scripts alone are not enough**. `cli/test/golden-gate.test.ts` is the Jest contract that enforces symmetry across runtimes.

| Describe block | What it validates |
|----------------|-------------------|
| `fixture structure` | `it.each` — SKILL + references + scripts only; no README/dag-config; whitelist §5.9 |
| `cursor / antigravity golden invariants` | Positive grep for the runtime; **leak grep** for the other runtime |
| `dag init matches golden fixtures` | `runInit` ≡ fixture (equivalent to shell `diff`) |
| `parity shell scripts` | TDD §5.11 shape + **real execution** after `npm link` |
| `npm scripts and CI wiring` | `package.json` + workflow + TDD documents path/fixture |

**When adding runtime `{id}`**, extend this file (do not create a parallel harness):

1. Constant `{ID}_GOLDEN` → `cli/test/fixtures/{id}-parity-golden`
2. `LEAK_IN_{OTHER}` table for cross-runtime grep
3. `it.each` in fixture structure + invariants + init↔golden
4. Entry in `parity shell scripts` `it.each` (script name, `COMPILED` path, fail/success msgs)
5. Assert in `package.json` / CI / TDD (copy Cursor pattern)

**Leak invariant model** (already in repo):

```typescript
// Cursor golden — must not contain agy, run_command, …
// Antigravity golden — must not contain cursor agent
```

---

## Before you start

### Required reading

1. TDD §5.2, §5.5, §5.7, §5.9, §5.10, §5.11, §5.12
2. [ADR-0010](../adr/0010-dag-flow-hook-guard-router.md), [ADR-0014](../adr/0014-orchestrator-worker-split.md), [ADR-0017](../adr/0017-per-runtime-worker-permission-flags.md)
3. `cli/manifests/cursor/`, `cli/manifests/antigravity/`
4. **`cli/test/golden-gate.test.ts`** — current parity contract

### Choose your path

| Path | When | Registration |
|------|------|--------------|
| **Built-in** | Official project runtime | `cli/manifests/{id}/` + `BUILT_IN_RUNTIMES` + full checklist |
| **External** | Fork / company / experimental | `dag manifest scaffold --extends=…` |
| **extends** | Inherit tier/placeholders | `"extends"` on child manifest |

External manifests follow Phases 1–3 and the worker spike. Built-ins merged into dag-flow require the full checklist below.

---

## Parity checklist (every built-in runtime)

Replace `{id}` with your `runtime_id`.

### Phase 1 — Manifest and spike

- [ ] **1.1** `cli/manifests/{id}/manifest.json` (§5.7)
- [ ] **1.2** `partials/*.md` for each key in `orchestrator.partials`
- [ ] **1.3** `hook_wiring_tier` declared — **no** `if (runtime === '{id}')` in the CLI
- [ ] **1.4** `skill_install_path` set
- [ ] **1.5** `worker.command_template` with `<<<PROMPT>>>`
- [ ] **1.6** `AUDITOR_COMMAND_TEMPLATE` uses `[OUTPUT_FILES]` / `[CONTEXT_REF]`
- [ ] **1.7** Spike §5.12 → `worker_validation_status: "validated"`
- [ ] **1.8** Hook adapter if JSON format ≠ Cursor

### Phase 2 — Golden gate (fixture + shell)

- [ ] **2.1** `cli/test/fixtures/{id}-parity-golden/` via `dag init` (not copied from another runtime)
- [ ] **2.2** Only `SKILL.md`, `references/`, whitelist `scripts/` §5.9
- [ ] **2.3** No `dag-config.json`, `README.md`, hooks, `.specs/`
- [ ] **2.4** `cli/scripts/verify-{id}-parity.sh` ([template](#parity-shell-script))
- [ ] **2.5** Whitelist scripts **identical** across runtimes; markdown **differs** (asserted in `golden-gate.test.ts`)

### Phase 3 — Jest (required — not optional)

- [ ] **3.1** Extend **`cli/test/golden-gate.test.ts`** (see [central layer](#central-parity-layer-golden-gatetestts))
- [ ] **3.2** `cli/test/{id}-manifest.test.ts` — behavior (model: `cursor-manifest.test.ts`)
- [ ] **3.3** Tier `pre_tool_use`: `dag init --force` × 2 → single guard entry
- [ ] **3.4** Tier `pre_tool_use`: **`dag update` × 2** → single `dag-flow-guard` entry (Task 7 pattern — implemented for Cursor)
- [ ] **3.5** `runtime-compiler.test.ts`: `it.each` includes `{id}` golden if shared whitelist assert applies
- [ ] **3.6** `session10-cleanup.test.ts` (or equivalent): valid references in **all** goldens

### Phase 4 — Repo integration

- [ ] **4.1** `BUILT_IN_RUNTIMES` in `manifest-resolver.ts`
- [ ] **4.2** `package.json`: `golden-gate:{id}` chained in `golden-gate` (with `build` + `link`)
- [ ] **4.3** `.github/workflows/cli-golden-gate.yml`: step for the script
- [ ] **4.4** TDD §5.11: subsection with path + fixture + script
- [ ] **4.5** `validate-session4.sh`, `validate-session8.sh`, `validate-session10.sh`: **all** parity scripts (not Antigravity only)

### Phase 5 — Final verification

```bash
cd cli && npm test                    # includes golden-gate.test.ts
cd cli && npm run golden-gate         # shell: antigravity + cursor (+ {id})
./cli/scripts/validate-session10.sh   # optional; session smoke
```

- [ ] **5.1** `npm test` green
- [ ] **5.2** `npm run golden-gate` green (all runtimes)
- [ ] **5.3** Manual smoke in target IDE

---

## Symmetry matrix (built-ins)

| Guarantee | Antigravity | Cursor | New `{id}` |
|-----------|-------------|--------|------------|
| Manifest | ✅ | ✅ | ✅ |
| Golden fixture | `antigravity-parity-golden` | `cursor-parity-golden` | `{id}-parity-golden` |
| Shell script | `verify-antigravity-parity.sh` | `verify-cursor-parity.sh` | `verify-{id}-parity.sh` |
| **`golden-gate.test.ts`** | ✅ invariants + init + shell exec | ✅ | ✅ extend |
| Manifest Jest | init tests | `cursor-manifest.test.ts` | `{id}-manifest.test.ts` |
| CI step | ✅ | ✅ | ✅ |
| Session scripts (4/8/10) | both gates | both gates | both + new |
| Worker spike | agy (manual S1) | cursor agent (manual S1) | §5.12 before ship |

**Compiled output:** intentionally **different** per column — whitelist scripts must be **identical**.

---

## Detailed steps

### 1–2. Manifest and spike

See TDD §5.7 and §5.12. Reference manifests: `cli/manifests/cursor/` (multi-runtime) or `cli/manifests/antigravity/` (legacy `boot_file` tier).

**Scaffold (recommended):**

```bash
cd cli && npm run build && npm link
dag manifest scaffold --extends=cursor --output=/tmp/my-runtime-scaffold
# Inspect, adapt, move to cli/manifests/{id}/ when promoting to built-in
```

### 3. Capture golden fixture

From **repo root**, after `npm link`:

```bash
OUT="$(mktemp -d)"
FAKE_BIN="$(mktemp -d)"
trap 'rm -rf "$OUT" "$FAKE_BIN"' EXIT
printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"

dag init --orchestrator={id} --target="$OUT" --project-scaffold=false

GOLDEN="cli/test/fixtures/{id}-parity-golden"
rm -rf "$GOLDEN" && mkdir -p "$GOLDEN"
cp -a "$OUT/{skill_install_path}/dag-flow/." "$GOLDEN/"
rm -f "$GOLDEN/dag-config.json"
test ! -f "$GOLDEN/README.md"
```

Replace `{skill_install_path}` with the manifest value (e.g. `.cursor/skills` → `$OUT/.cursor/skills/dag-flow`).

### 4. Parity shell script

Create `cli/scripts/verify-{id}-parity.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$(mktemp -d)"
FAKE_BIN="$(mktemp -d)"
trap 'rm -rf "$OUT" "$FAKE_BIN"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"

if ! command -v dag >/dev/null 2>&1; then
  echo "❌ dag not on PATH — run: cd cli && npm run build && npm link" >&2
  exit 1
fi

dag init --orchestrator={id} --target="$OUT" --project-scaffold=false

GOLDEN="$CLI_ROOT/test/fixtures/{id}-parity-golden"
COMPILED="$OUT/{skill_install_path}/dag-flow"

diff -ru "$GOLDEN" "$COMPILED" \
  --exclude=dag-config.json \
  || { echo "❌ {id} golden gate failed"; exit 1; }

echo "✅ {id} parity OK"
```

**Script rules:**

- Use `dag` on PATH (`npm link`), not `node dist/index.js`
- No `--skill-install-path` except isolated unit tests
- `diff` excludes **only** `dag-config.json`
- Do not run `npm run build` inside the script

### 5. Extend `golden-gate.test.ts`

**Minimum checklist per new runtime:**

```typescript
// 1. Constant
const {ID}_GOLDEN = path.join(CLI_ROOT, 'test/fixtures/{id}-parity-golden');

// 2. Leak patterns — other runtimes must not appear in this golden
const OTHER_LEAK_IN_{ID} = [/agy/, /cursor agent/, …] as const;

// 3. it.each fixture structure — add ['{id}', {ID}_GOLDEN]

// 4. describe('{id} golden invariants') — positives + negative leak grep

// 5. it('{id} init output matches …-parity-golden')

// 6. parity shell scripts it.each — script, COMPILED path, fail msg

// 7. npm scripts and CI — expect golden-gate:{id}, workflow, TDD strings
```

### 6. `{id}-manifest.test.ts`

Runtime-specific behavior (hooks, dual-worker, update). **Do not** duplicate what `golden-gate.test.ts` already covers (fixture shape, shell shape, init≡golden).

| Coverage | File |
|----------|------|
| Structural parity + cross-runtime leaks | `golden-gate.test.ts` |
| Hooks, update, dual-manifest, tier | `{id}-manifest.test.ts` |

### 7. Register built-in + npm + CI

```typescript
export const BUILT_IN_RUNTIMES = ['antigravity', 'cursor', '{id}'] as const;
```

**`cli/package.json` (current pattern):**

```json
{
  "golden-gate:antigravity": "cd .. && ./cli/scripts/verify-antigravity-parity.sh",
  "golden-gate:cursor": "cd .. && ./cli/scripts/verify-cursor-parity.sh",
  "golden-gate:{id}": "cd .. && ./cli/scripts/verify-{id}-parity.sh",
  "golden-gate": "npm run build && npm link && npm run golden-gate:antigravity && npm run golden-gate:cursor && npm run golden-gate:{id}"
}
```

---

## Outside Jest/CI automation (explicit)

| Item | Why | Where |
|------|-----|-------|
| Spike S1/S2 with real CLIs (`agy`, `cursor agent`) | Requires installed binaries | `validate-session8.sh` (manual / CI with tools) |
| IDE smoke (skill loaded, guard in real session) | Not reproducible in headless Jest | Phase 5.3 manual checklist |
| Full orchestrator E2E DAG | Out of golden scope (Compiled Skill tree only) | Python tests / manual |

**Do not confuse:** golden gate validates the **compiled artifact**; spike validates the **real worker CLI**.

---

## What NOT to do

| ❌ | ✅ |
|----|-----|
| Shell script only, without extending `golden-gate.test.ts` | Shell + central Jest |
| Antigravity golden as Cursor base | `dag init --orchestrator={id}` capture |
| Invariants only on the new runtime | **Bidirectional** leak grep (agy ↔ cursor) |
| Session scripts run Antigravity gate only | All critical `validate-session*.sh` run **all** gates |
| `if (orchestrator === '{id}')` in CLI | Manifest + tier |
| Skip `update` × 2 hook test (`pre_tool_use` tier) | Task 7 pattern in manifest test |

Full list: [TDD Appendix C](../design/tdd-multi-runtime-support.md#apêndice-c--anti-padrões-de-implementação).

---

## When to rebaseline

Regenerate fixture + ensure `npm test` passes (`golden-gate.test.ts` fails if you do not rebaseline):

- Source Skill / compiler / manifest for **that** runtime only
- Commit: `chore(cli): rebaseline {id} parity golden — <reason>`

---

## Agent prompt (new built-in)

```text
Add built-in runtime "{id}" with FULL parity per docs/guides/new-runtime-implementation-guide.md.

Read:
1. docs/guides/new-runtime-implementation-guide.md
2. cli/test/golden-gate.test.ts — EXTEND this file (mandatory)
3. cli/test/cursor-manifest.test.ts — behavioral tests model
4. TDD §5.7, §5.11, §5.12, Appendix C

Deliverables:
- cli/manifests/{id}/ + spike → worker_validation_status: "validated"
- cli/test/fixtures/{id}-parity-golden/ (dag init capture)
- cli/scripts/verify-{id}-parity.sh
- EXTEND cli/test/golden-gate.test.ts: fixture it.each, invariants, init≡golden, shell it.each, CI/TDD asserts
- cli/test/{id}-manifest.test.ts (hooks, update×2 single guard if pre_tool_use)
- BUILT_IN_RUNTIMES, package.json golden-gate:{id}, CI workflow step
- TDD §5.11 subsection
- validate-session4/8/10.sh: include verify-{id}-parity.sh

Done when:
- npm test (golden-gate.test.ts passes for ALL runtimes)
- npm run golden-gate (all scripts exit 0)
- Cross-runtime leak grep bidirectional

Do NOT: if(runtime) in CLI; copy another golden; skip golden-gate.test.ts extension.
Spikes with real CLIs: document manual evidence, not required in jest CI.
```

---

## Cross-references

| Artifact | Use |
|----------|-----|
| [`cli/test/golden-gate.test.ts`](../../cli/test/golden-gate.test.ts) | **Parity contract** — extend per runtime |
| [`cli/test/cursor-manifest.test.ts`](../../cli/test/cursor-manifest.test.ts) | Cursor behavior + update×2 guard |
| [TDD §5.11](../design/tdd-multi-runtime-support.md#511-gate-de-ouro--script-de-paridade-antigravity) | Canonical shell gate |
| [Audit plan Task 6](../planning/archive/multi-runtime-audit-corrections-plan.md) | Cursor gate history |

---

## Summary

**Runtime parity** (post-Task 6) = manifest + golden + shell + **`golden-gate.test.ts`** + manifest test + CI + session scripts — with **bidirectional invariants** and **shell execution inside Jest**.

Shell alone was a gap in the original plan; this guide reflects what the repository **actually** requires.
