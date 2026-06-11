# Tasks — dag-flow E2E Benchmark Suite v0.1.0

> Derived from [`suite_e2e_implementation_plan.md`](file:///home/guilherme/Área de trabalho/Repos/dag-flow/research/suite_e2e_implementation_plan.md)
> Root dir: `research/benchmarks/e2e-v0.1.0/`

---

## Phase 1 — Target Skeleton

### Task 1.1: Create `taskflow-api` skeleton
**Size:** S  
**Description:** Create the controlled target codebase that all scenarios run against. Pattern mirrors existing RBAC benchmark (`research/benchmarks/rbac-api-showdown/`). Fresh Node.js/Express skeleton — agents build into it, not the dag-flow repo itself.

**Acceptance criteria:**
- [ ] `targets/taskflow-api/package.json` with deps: `express`, `jsonwebtoken`, `bcrypt`, `jest`
- [ ] `targets/taskflow-api/jest.config.js` and `.eslintrc.json` present
- [ ] `src/app.js` (Express app, zero routes mounted), `src/server.js`, `src/routes/`, `src/middleware/`, `src/models/`, `src/config/env.js` stubs all exist
- [ ] `README.md` with domain description: task management API
- [ ] `npm install` succeeds inside `targets/taskflow-api/`

**Verification:**
- [ ] `cd targets/taskflow-api && npm test` → passes (no tests yet, just framework OK)
- [ ] `node src/server.js` → Express starts on default port

**Dependencies:** None  
**Files:** `targets/taskflow-api/**` (~8 files)

---

### Task 1.2: Create S4 brownfield seed (40+ files)
**Size:** M  
**Description:** The brownfield scenario (S4) requires a dense pre-populated codebase to stress-test Discovery Phase. Create 40+ files representing realistic middleware chains, domain models, and existing routes that an agent would need to map before adding rate limiting.

**Acceptance criteria:**
- [ ] `scenarios/s4-brownfield/seed/` contains ≥ 40 files
- [ ] Files include: middleware chains (auth, logging, error), domain models (User, Task, Project), existing routes (tasks, users, projects), config files, a basic README
- [ ] Files have realistic content (not Lorem Ipsum) — enough for `ctx_search` to surface architectural patterns
- [ ] Seed applies cleanly on top of taskflow-api skeleton: `cp -r seed/* targets/taskflow-api/src/`

**Verification:**
- [ ] `find scenarios/s4-brownfield/seed -type f | wc -l` → ≥ 40
- [ ] `node` can require the copied files without syntax errors

**Dependencies:** Task 1.1  
**Files:** `scenarios/s4-brownfield/seed/**`

---

### Task 1.3: Create S6 bug-injection patch
**Size:** XS  
**Description:** S6 requires a known bug pre-injected into the auth middleware: bcrypt async/await misuse causing 500 on valid login. Create the `.patch` file that `setup.sh` will apply.

**Acceptance criteria:**
- [ ] `scenarios/s6-quick-mode-hotfix/bug-injection.patch` is valid unified diff
- [ ] Patch applies cleanly to S1 outputs via `git apply`
- [ ] Bug is: `bcrypt.compare()` called without `await`, returns Promise (truthy) always — or `.compareSync()` called with hash that doesn't match sync path
- [ ] `npm test` FAILS after patch is applied (confirms the bug exists)

**Verification:**
- [ ] `patch --dry-run` succeeds
- [ ] Manual test: `POST /api/auth/login` with valid credentials → 500

**Dependencies:** Task 1.1  
**Files:** `scenarios/s6-quick-mode-hotfix/bug-injection.patch`

---

### ✅ Checkpoint: Foundation
- [ ] `targets/taskflow-api/` installs and starts
- [ ] S4 seed has ≥ 40 files
- [ ] S6 patch applies cleanly
- [ ] Human review before proceeding to scenario definitions

---

## Phase 2 — Scenario Definitions

> One task per scenario. Each produces: `scenario.json` + `assertions.json` + `setup.sh`

### Task 2.1: S1 — `auth-jwt` scenario definition
**Size:** S  
**Description:** Define the nominal full-flow scenario. S1 is the baseline against which all other scenarios are measured (S2 depends on its outputs, S6 injects a bug into it).

**Acceptance criteria:**
- [ ] `scenarios/s1-auth-jwt/scenario.json` matches schema in plan (all required fields present: `scenario_id`, `dag_flow_prompt`, `baseline_prompt`, `expected_artifacts`, `phases_exercised`, `adr0003_check: true`)
- [ ] `scenarios/s1-auth-jwt/setup.sh` — copies fresh target, runs `setup_indexer.sh` pre-boot, sets `hook_indexing_ms` baseline
- [ ] `scenarios/s1-auth-jwt/assertions.json` covers all Phase A-E + Living Memory metrics from the plan:
  - `file_exists` for CONTEXT.md, spec.md, design.md, tasks.md, auth.js, auth.test.js
  - `grep "agy --dangerously-skip-permissions"` in tasks.md (ADR-0003)
  - `grep_not "\\bgemini\\b"` in auditor/T-Final prompts
  - `token_lte` for discovery (≤ 3000) and specify (≤ 10000)
  - `skill_in_set` → `["security-review", "backend-patterns", "api-design"]`
  - `exit_code 0` for `npm test`

**Verification:**
- [ ] `python -c "import json; json.load(open('scenarios/s1-auth-jwt/scenario.json'))"` → no error
- [ ] `bash scenarios/s1-auth-jwt/setup.sh --dry-run` → exits 0

**Dependencies:** Task 1.1  
**Files:** `scenarios/s1-auth-jwt/scenario.json`, `setup.sh`, `assertions.json`

---

### Task 2.2: S2 — `rbac-roles` scenario definition
**Size:** S  
**Description:** Multi-dependency DAG scenario. S2 starts from S1 outputs — requires auth to already exist. Tests that Discovery Phase detects prior artifacts and Living Memory from S1 accelerates S2.

**Acceptance criteria:**
- [ ] `scenario.json` has `target_state: "s1-complete"` — `setup.sh` copies S1 `outputs/` before running
- [ ] `assertions.json` includes `count_gte` check: S2 Discovery `total_tokens` ≤ S1 Discovery `total_tokens` (Living Memory acceleration)
- [ ] Assertions include `file_exists` for RBAC route files and role middleware
- [ ] `skill_in_set` → `["security-review", "backend-patterns", "api-design"]`

**Verification:**
- [ ] JSON valid, `setup.sh` handles missing S1 outputs gracefully (exit 1 with clear message)

**Dependencies:** Task 2.1  
**Files:** `scenarios/s2-rbac-roles/scenario.json`, `setup.sh`, `assertions.json`

---

### Task 2.3: S3 — `file-upload` scenario definition
**Size:** S  
**Description:** Skill Injection stress test. Fresh target, no auth dependency. Tests that workers call `search_skills` before implementing file validation.

**Acceptance criteria:**
- [ ] `target_state: "fresh"` — independent of S1/S2
- [ ] `assertions.json` includes `skill_in_set` → `["security-review", "backend-patterns"]`
- [ ] Assertion: transcript grep for `search_skills` call ≥ 1
- [ ] `setup.sh` includes dummy-skill MCP pre-check (described in plan)

**Verification:**
- [ ] JSON valid

**Dependencies:** Task 1.1  
**Files:** `scenarios/s3-file-upload/scenario.json`, `setup.sh`, `assertions.json`

---

### Task 2.4: S4 — `brownfield-discovery` scenario definition
**Size:** S  
**Description:** Discovery Phase stress test. Seeded codebase (40+ files). Tests that Orchestrator uses `ctx_search` (not `view_file`) to map the architecture.

**Acceptance criteria:**
- [ ] `setup.sh` applies seed via `cp -r seed/* <workspace>/src/` then runs indexer
- [ ] `assertions.json` includes `count_gte 0` for `view_file` calls on source files (zero crawls gate)
- [ ] Assertion: `memory_recall` count ≥ 5 invariants
- [ ] `skill_in_set` → `["security-review", "backend-patterns", "api-design"]`

**Verification:**
- [ ] `setup.sh --dry-run` exits 0, confirms seed copy would succeed

**Dependencies:** Task 1.2  
**Files:** `scenarios/s4-brownfield/scenario.json`, `setup.sh`, `assertions.json`

---

### Task 2.5: S5 — `ambiguous-spec` scenario definition
**Size:** S  
**Description:** Anti-hallucination gate. Deliberately underspecified prompt ("Add notifications to the app."). Orchestrator must stop and interrogate before generating spec.md.

**Acceptance criteria:**
- [ ] Prompt is exactly: `"Add notifications to the app."`
- [ ] `assertions.json` includes `file_not_exists` for `spec.md` in transcript before first `?` exchange
- [ ] `count_gte 1` for `?` in transcript before spec generation
- [ ] `skill_in_set` → N/A (no worker tasks — assertion omitted or set to `always_pass`)
- [ ] `adr0003_check: false` (no worker runs)

**Verification:**
- [ ] JSON valid

**Dependencies:** Task 1.1  
**Files:** `scenarios/s5-ambiguous-spec/scenario.json`, `setup.sh`, `assertions.json`

---

### Task 2.6: S6 — `quick-mode-hotfix` scenario definition
**Size:** S  
**Description:** Quick Mode complete flow. Applies bug-injection patch on top of S1 outputs. Tests that agent bypasses full pipeline (no spec.md, no design.md), produces Mini-DAG (≤ 4 tasks), leaves traceability comment.

**Acceptance criteria:**
- [ ] `setup.sh` copies S1 outputs then applies `bug-injection.patch` via `git apply`
- [ ] `assertions.json` includes:
  - `file_not_exists` for spec.md and design.md
  - `file_exists` for tasks.md
  - `count_lte 4` for task count in tasks.md
  - `grep "DAG-FLOW-QUICK\|QUICK.MODE\|hotfix"` in src/ (traceability comment)
  - `exit_code 0` for `npm test` post-fix
  - `token_lte` Quick Mode total_tokens ≤ 35% of S1 total_tokens
  - `adr0003_check: true`
- [ ] `skill_in_set` → `["security-review", "tdd-workflow", "backend-patterns"]`

**Verification:**
- [ ] `setup.sh` handles missing S1 outputs (exit 1)

**Dependencies:** Task 1.3, Task 2.1  
**Files:** `scenarios/s6-quick-mode-hotfix/scenario.json`, `setup.sh`, `assertions.json`

---

### ✅ Checkpoint: Scenario Definitions
- [ ] All 6 `scenario.json` files validate as JSON
- [ ] All 6 `setup.sh` scripts exit 0 with `--dry-run`
- [ ] All 6 `assertions.json` cover the metric contracts from the plan
- [ ] Human review before writing harness scripts

---

## Phase 3 — Harness Scripts

### Task 3.1: `grade_scenario.py` — automated gate grader
**Size:** M  
**Description:** Reads `assertions.json` per scenario, executes each gate, writes `grading.json`. Supports all assertion types from the plan: `file_exists`, `file_not_exists`, `grep`, `grep_not`, `exit_code`, `count_gte`, `token_lte`, `skill_in_set`, `judge_gte`.

**Acceptance criteria:**
- [ ] CLI: `python harness/grade_scenario.py <scenario_id> <workspace_run_dir>`
- [ ] Reads `scenarios/<scenario_id>/assertions.json`
- [ ] Executes each assertion against `workspace/<run_dir>/<scenario_id>/with_dag_flow/outputs/`
- [ ] Outputs `grading.json` with fields: `text`, `passed`, `evidence` (exact field names — viewer depends on these)
- [ ] ADR-0003 gate implemented: `grep "agy --dangerously-skip-permissions"` + `grep_not "\\bgemini\\b"` in Auditor/T-Final
- [ ] `skill_in_set` gate: reads injected skill from transcript, checks membership in expected set
- [ ] Exit code: 0 if all gates pass, 1 if any fail

**Verification:**
- [ ] Run against a mock workspace with known pass/fail outcomes → grading.json matches expected
- [ ] `python -m pytest harness/tests/test_grade.py` passes (write minimal unit tests)

**Dependencies:** Task 2.1–2.6 (needs assertions.json schemas finalized)  
**Files:** `harness/grade_scenario.py`, `harness/tests/test_grade.py`

---

### Task 3.2: `judge_scenario.py` — Gemini 2.5 Flash judge dispatcher
**Size:** M  
**Description:** Dispatches qualitative judgment calls to Gemini 2.5 Flash (Antigravity runtime). One call per qualitative criterion per scenario. Collects results into `judge_verdict.json`. Uses rubrics defined in the plan.

**Acceptance criteria:**
- [ ] CLI: `python harness/judge_scenario.py <scenario_id> <workspace_run_dir>`
- [ ] Loads rubric definitions per phase (Spec completeness, Design coherence, DAG topological, Skill relevance, Code structure) from embedded or external config
- [ ] Dispatches one `agy` call per criterion with relevant output files
- [ ] Each call returns `{ "score": N, "evidence": "...", "criterion": "..." }`
- [ ] Writes `judge_verdict.json` to `workspace/<run>/<scenario_id>/`
- [ ] Handles Gemini API errors gracefully (retry × 2, then writes `{"score": null, "error": "..."}`)
- [ ] Supports `--criteria` flag to run subset (speeds up iteration)

**Verification:**
- [ ] Dry-run mode (`--dry-run`) prints rubric + files that would be sent, exits 0
- [ ] Integration test: run against S1 mock outputs → `judge_verdict.json` produced with 5 scored criteria

**Dependencies:** Task 3.1  
**Files:** `harness/judge_scenario.py`

---

### Task 3.3: `run_scenario.sh` — single scenario runner
**Size:** M  
**Description:** Orchestrates a single scenario end-to-end: setup → agent (manual trigger with printed prompt) → collect artifacts → grade → judge. Saves everything to `workspace/run-<timestamp>/<scenario_id>/`.

**Acceptance criteria:**
- [ ] CLI: `./harness/run_scenario.sh <scenario_id> [workspace_dir]`
- [ ] Reads `scenarios/<scenario_id>/scenario.json`
- [ ] Runs `scenarios/<scenario_id>/setup.sh` to prepare workspace copy
- [ ] Prints `dag_flow_prompt` and `baseline_prompt` for manual agent invocation
- [ ] Waits for user confirmation that agent has finished (interactive prompt)
- [ ] After confirmation: collects `timing.json`, transcript, outputs from agent workspace
- [ ] Calls `grade_scenario.py` automatically
- [ ] Calls `judge_scenario.py` automatically (async, prints PID)
- [ ] Saves all artifacts to `workspace/run-<timestamp>/<scenario_id>/`
- [ ] MCP pre-check: `search_skills "dummy"` → must return dummy-skill, else abort with `harness_error: "mcp_unavailable"`

**Verification:**
- [ ] `--dry-run` flag: runs setup, prints prompts, exits without waiting for agent
- [ ] Existing S1 mock workspace: full run completes, `grading.json` and `judge_verdict.json` created

**Dependencies:** Task 3.1, Task 3.2  
**Files:** `harness/run_scenario.sh`

---

### Task 3.4: `run_all.sh` — sequential runner
**Size:** S  
**Description:** Runs all 6 scenarios sequentially with correct dependency ordering (S1 → S2 → S3 → S4 → S5 → S6). Uses a single shared `workspace/run-<timestamp>/` directory.

**Acceptance criteria:**
- [ ] CLI: `./harness/run_all.sh [workspace_dir]`
- [ ] Creates shared `workspace/run-<timestamp>/` once
- [ ] Runs scenarios in order: S1, S2, S3, S4, S5, S6
- [ ] After S1 completes, copies outputs to S2 workspace before running S2
- [ ] After S1 completes, copies outputs + applies patch for S6
- [ ] On any scenario failure: pauses, reports which scenario failed, asks user whether to continue or abort
- [ ] Final status summary: pass/fail per scenario + overall

**Verification:**
- [ ] `--dry-run` prints execution plan (order, which scenarios depend on which)

**Dependencies:** Task 3.3  
**Files:** `harness/run_all.sh`

---

### Task 3.5: `aggregate_report.py` — benchmark aggregator
**Size:** M  
**Description:** Reads all `grading.json` + `judge_verdict.json` + `timing.json` across all 6 scenarios in a run directory. Produces `benchmark.json` (matches schema in plan) and `benchmark.md` summary.

**Acceptance criteria:**
- [ ] CLI: `python harness/aggregate_report.py <workspace_run_dir>`
- [ ] Reads from `workspace/<run>/{s1..s6}/with_dag_flow/` and `baseline/`
- [ ] `benchmark.json` matches the exact schema in the plan (version, run_timestamp, scenarios[], summary{})
- [ ] `benchmark.md` is human-readable: per-phase metric scorecards, overall pass/fail table
- [ ] Summary fields: `scenarios_passed`, `scenarios_total`, `overall_pass_rate`, `avg_token_savings_vs_baseline`, `avg_code_quality_score`, `skill_injection_relevance_avg`, `adr0003_compliance_rate`
- [ ] Writes to `workspace/<run>/summary/benchmark.json` and `benchmark.md`

**Verification:**
- [ ] Run against mock data with known values → output matches expected benchmark.json
- [ ] `python -m pytest harness/tests/test_aggregate.py` passes

**Dependencies:** Task 3.1, Task 3.2  
**Files:** `harness/aggregate_report.py`, `harness/tests/test_aggregate.py`

---

### ✅ Checkpoint: Harness Scripts
- [ ] `grade_scenario.py` unit tests pass
- [ ] `aggregate_report.py` unit tests pass
- [ ] `run_scenario.sh --dry-run` exits 0 for all 6 scenarios
- [ ] `run_all.sh --dry-run` prints correct execution order
- [ ] Human review before running live scenarios

---

## Phase 4 — Eval Registration

### Task 4.1: Register scenarios in `evals/evals.json`
**Size:** XS  
**Description:** Add the 6 new scenario entries to the skill-creator eval registry. Each entry references a scenario prompt as the eval task.

**Acceptance criteria:**
- [ ] `evals/evals.json` updated with 6 new entries (IDs not colliding with existing ones)
- [ ] Each entry has: `id`, `prompt` (the `dag_flow_prompt` from scenario.json), `expected_output` description, `files: []`
- [ ] JSON remains valid

**Verification:**
- [ ] `python -c "import json; json.load(open('evals/evals.json'))"` → no error
- [ ] Entry count increases by 6

**Dependencies:** Task 2.1–2.6  
**Files:** `evals/evals.json`

---

### ✅ Final Checkpoint
- [ ] All 6 scenario directories complete with `scenario.json`, `setup.sh`, `assertions.json`
- [ ] `targets/taskflow-api/` skeleton installs and runs
- [ ] `harness/` has all 5 scripts
- [ ] `run_all.sh --dry-run` exits 0
- [ ] `evals/evals.json` updated
- [ ] Commit: `feat(research): add e2e-v0.1.0 benchmark infrastructure`

---

## Dependency Map

```
Task 1.1 (skeleton)
  ├── Task 1.3 (bug patch)         → Task 2.6 (S6 def)
  ├── Task 2.1 (S1 def)            → Task 2.2 (S2 def) → Task 2.6
  ├── Task 2.3 (S3 def)
  └── Task 2.5 (S5 def)
Task 1.2 (seed) → Task 2.4 (S4 def)

Tasks 2.1–2.6 → Task 3.1 (grader)
                   → Task 3.2 (judge)
                     → Task 3.3 (run_scenario)
                       → Task 3.4 (run_all)
                   → Task 3.5 (aggregate)
Tasks 2.1–2.6 → Task 4.1 (evals.json)
```

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| S4 seed files too shallow — Discovery Phase trivially maps them | High | Use realistic JS/Express patterns, multiple layers (auth middleware referencing models, routes importing middleware) |
| S6 bug patch doesn't apply cleanly after S1 outputs vary | Med | Patch targets only `src/middleware/auth.js` — minimal surface area; keep S1 output deterministic |
| `judge_scenario.py` Gemini API unavailable at test time | Med | `--dry-run` mode + graceful null scores allow grading to proceed |
| `skill_in_set` gate depends on transcript format — brittle | Med | Parse `search_skills` tool call args directly from JSON transcript, not raw text grep |
| S2 Living Memory acceleration metric flaky — S1/S2 Discovery tokens vary per run | Low | Measure over 3 runs, report mean ± stddev; gate is soft (reported, not blocking) |
