# Audit Report — Multi-Runtime Support V1

| Field | Value |
|-------|-------|
| **Auditor** | Chief Architecture Auditor (Orchestrator) |
| **Date** | 2026-06-21 |
| **TDD Reference** | `docs/design/tdd-multi-runtime-support.md` |
| **Plan Reference** | `docs/planning/multi-runtime-implementation-plan.md` |
| **Scope** | Tasks 0–22 (Phases 0–11); focus on Tasks 3–4, 5–11, 12–15, 16–17, 19–20 |
| **Methodology** | Direct source inspection by four independent subagents (Layer 1–4), with cross-validated double coverage on the most critical findings |

---

## Executive Summary

The implementation is substantially correct. All three bugs documented in the TDD as "you must fix" have been **eliminated**: hardcoded `agy` in `dag_runner.py`, `auditor.py` missing the `PASS` check, and `.specs/dags/` vault not being updated. The hook wiring layer (Layer 2) passed all 12 invariants without deviation. **5 anomalies** were identified: none Critical, 4 Medium severity, 1 Low.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 4 |
| Low | 1 |

---

## Layers That Passed Clean

| Layer | Invariants | Result |
|-------|------------|--------|
| Layer 2 — Hook Wiring & Guard (Tasks 11, 20) | 12/12 | ✅ All PASS |
| Layer 3 — Runner, Vault & Auditor (Tasks 12–15) | 8/8 | ✅ All PASS; 3 known bugs FIXED |

---

## Anomalies and Deviations

---

### [CLI / Compiler] — `dag init` steps 2 and 3 are swapped

* **Severity:** Medium
* **Problem Found:** In `cli/src/commands/init.ts`, manifest resolution (TDD step 3) happens at lines 107–111, **before** the idempotency check (TDD step 2) at line 117. The practical reason is that `skill_install_path` (needed to compute `outputDir`) comes from the manifest. However, this means manifest resolution errors surface before the idempotency gate can abort early — different behavior from what is specified.
* **Evidence / Validation Method:** Layer 1 inspected `cli/src/commands/init.ts` lines 102–137 and mapped each step against TDD §5.5. The actual sequence is: (1) prerequisites → (3) resolve manifests → (2) idempotency → (4) compile → (5) scripts → (6) scaffold → (7) hooks → (8) dag-config.
* **Expected Behavior (per TDD):** §5.5 defines exactly eight steps in order:
  1. Check `context-mode` + `rtk`
  2. Abort if Compiled Skill already exists (unless `--force`)
  3. Resolve manifests
  4. Dual Manifest Compilation → install
  5. Copy scripts (whitelist only)
  6. Project Scaffold
  7. Wire hooks
  8. Write `dag-config.json`

---

### [CLI / Compiler] — External manifest path detection only checks leading prefix

* **Severity:** Medium
* **Problem Found:** `isExternalManifestRef` in `cli/src/compiler/manifest-resolver.ts` lines 37–39 implements:
  ```typescript
  return ref.startsWith('/') || ref.startsWith('.');
  ```
  A path like `my-company/my-runtime` (contains `/` but does not start with `/` or `.`) is treated as a built-in ID, not an external path. The spec requires support for external paths identified by the **presence** of `/` or `.`.
* **Evidence / Validation Method:** Layer 1 read the full `manifest-resolver.ts` source and identified the exact predicate. This function is used in the resolver to decide whether to load from `cli/manifests/` or from a filesystem path.
* **Expected Behavior (per TDD):** Task 6 acceptance criteria (Implementation Plan): "Resolve `cli/manifests/{id}/` and external paths (`/` or `.`)". §5.5 step 3: "built-in or external path with `/` or `.`". The specification indicates that the *presence* of the characters `/` or `.` — not only as a prefix — is the distinguishing criterion.

---

### [CLI / Gates] — Parity script uses `node dist/index.js` instead of `dag` and adds undocumented flags

* **Severity:** Medium
* **Problem Found:** `cli/scripts/verify-antigravity-parity.sh` (lines 19–23) executes:
  ```bash
  node dist/index.js init \
    --orchestrator=antigravity \
    --target="$OUT" \
    --skill-install-path=skills \
    --project-scaffold=false
  ```
  Deviations independently confirmed by both Layer 1 and Layer 4:
  1. Uses `node dist/index.js` (relative dev binary) instead of the global `dag` command specified by the TDD.
  2. Adds undocumented extra flag `--skill-install-path=skills` not present in the TDD template.
  3. Runs `npm run build` before the test (implies cold CI dependency).
  4. Adds `--exclude=README.md` to the diff — not in the TDD template (workaround for the fixture anomaly; see Low finding below).
* **Evidence / Validation Method:** Layer 1 and Layer 4 independently inspected the full script and arrived at the same list of deviations. Exit messages (`❌ Gate de ouro falhou` / `✅ Paridade Antigravity OK`) and exit codes are correct.
* **Expected Behavior (per TDD):** §5.11 specifies the exact script template:
  ```bash
  dag init --orchestrator=antigravity --target="$OUT" --project-scaffold=false
  GOLDEN="cli/test/fixtures/antigravity-parity-golden"
  diff -ru "$GOLDEN" "$OUT/skills/dag-flow" \
    --exclude=dag-config.json \
    || { echo "❌ Gate de ouro falhou"; exit 1; }
  echo "✅ Paridade Antigravity OK"
  ```
  The script must use the `dag` binary (installed via `npm link` per Q3), without extra flags, and the `diff` must exclude only `dag-config.json`.

---

### [Gates] — `isTaskDone()` uses `.includes('Done')` instead of strict equality

* **Severity:** Medium
* **Problem Found:** In `cli/src/guards/pending-dag-guard.ts` lines 29–32:
  ```typescript
  function isTaskDone(status: string | undefined): boolean {
    const normalized = status ?? 'Pending';
    return normalized.includes('Done');
  }
  ```
  The `.includes('Done')` predicate allows statuses such as `"Done (verified)"` to pass the guard (confirmed by a test case in `cli/test/pending-dag-guard.test.ts` line 85–88). The same predicate would incorrectly allow the hypothetical status `"Not Done"` (which contains the substring `"Done"`). This contradicts the invariant that **only** `"Done"` releases the update.
* **Evidence / Validation Method:** Layer 4 read the source at `pending-dag-guard.ts` and the test suite at `pending-dag-guard.test.ts`. The test that validates `"Done (verified)"` as allowed demonstrates a deliberate design decision in the code that deviates from the exact TDD contract.
* **Expected Behavior (per TDD):** D2 and Task 16 acceptance criteria: "Block if **any** task has a status other than `'Done'`" and "All `Done` → proceed". The only status that must release the guard is the exact string `"Done"`. The TDD defines only three valid states: `"Done"`, `"Pending"`, `"Failed"`. A safety-critical guard must not relax its predicate beyond spec, even if `"Not Done"` does not appear in the current runtime.

---

### [Gates / CLI] — Golden fixture contains `README.md` outside the whitelist

* **Severity:** Low
* **Problem Found:** `cli/test/fixtures/antigravity-parity-golden/README.md` exists in the parity fixture but is not listed in the specified content whitelist. The parity script compensates by adding `--exclude=README.md` to the diff, creating implicit coupling between the fixture and the script. Independently verified by both Layer 1 and Layer 4.
* **Evidence / Validation Method:** Layer 1 listed files in `cli/test/fixtures/antigravity-parity-golden/` and compared against the whitelist in §5.9. Layer 4 corroborated by identifying `--exclude=README.md` in the parity script as a direct workaround for this extra file.
* **Expected Behavior (per TDD):** §5.11 defines the golden fixture content: `SKILL.md`, `references/*.md`, and scripts from the §5.9 whitelist. `README.md` is not in that list. §5.9 explicitly enumerates what to include and exclude; files not listed should be absent.

---

## Known TDD Bugs — Confirmed Status

| Bug Documented in TDD | File | Status |
|-----------------------|------|--------|
| Hardcoded `agy` ~line 139 in `dag_runner.py` | `scripts/dag_runner.py` | ✅ **FIXED** — replaced by `dag-config.json` read |
| `auditor.py` only checks exit 0, missing `"PASS"` in stdout (D6) | `scripts/auditor.py` lines 53–56 | ✅ **FIXED** — D6 contract implemented: `exit_code == 0 and "PASS" in eval_output` |
| Vault `.specs/dags/*.json` not updated (D2) | `scripts/update_task_status.py` | ✅ **FIXED** — both vault and runs/ updated with temporary chmod unlock |
| `DAG_FLOW_WORKER` absent from `dag_runner.py` (Appendix A) | `scripts/dag_runner.py` | ✅ **FIXED** — set only on the worker subprocess env |
| `hooks/dag-flow-src-guard.sh` absent (Appendix A) | `cli/hooks/dag-flow-guard.mjs` | ✅ **IMPLEMENTED** at the correct path |

---

## Non-Invariant Observations (Informational)

These items do not constitute TDD violations but are recorded for awareness:

1. **`scripts/dag-config.json`** (Layer 3): A smoke fixture exists with an incomplete `_meta` (`{"worker":"smoke","schema_version":1}`). Does not affect the runner in production — `dag_runner.py` reads the config adjacent to the scripts; this file is for development testing only.

2. **`wire-hooks.ts` tier `none` message** (Layer 2): The warning message reads `"dag init: hook_wiring_tier..."` even when called from `dag update`. Cosmetic only; behavior is correct.

3. **Hook idempotency test coverage** (Layer 2): No integration test runs `runUpdate` twice against a `cursor` target and asserts exactly one `dag-flow-guard` entry in `hooks.json`. The behavior is covered at the unit test level for upsert, and at the integration level for `boot_file`, but the combination `update × 2 × pre_tool_use` has no direct assertion.

4. **Links in `docs/planning/archive/`** (Layer 4): Historical archive docs still reference `references/discovery.md`. Does not affect active files (`SKILL.md`, `references/`).
