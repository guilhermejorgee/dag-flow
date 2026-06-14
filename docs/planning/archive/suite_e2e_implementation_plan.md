# dag-flow v0.1.0 — Exhaustive E2E Benchmark Suite (Revised)

## Design Decisions (locked)

| Decision | Choice |
|---|---|
| **Target codebase** | Fresh Node.js/Express skeleton (`taskflow-api`) — NOT dag-flow itself. Pattern mirrors existing RBAC benchmark. |
| **Baseline** | Plain conversational LLM — same prompt, zero skills, zero orchestration |
| **Scenarios** | 6 as defined — open to expansion later |
| **Execution order** | Sequential |
| **Judge model** | Gemini Flash (Antigravity runtime) — model available in this runtime as stated |
| **Storage** | Lives inside dag-flow repo: `research/benchmarks/e2e-v0.1.0/` — permanent proof, versioned |

---

## Context

### New Pipeline Model (ADR-0003 + nomenclature refactor)

The core feature pipeline is now strictly **4 phases**:

| # | Phase | Key Output | New in v0.1.0? |
|---|---|---|---|
| 1 | **Specify** | `spec.md`, `CONTEXT.md` via Socratic Interrogation + PAGRL | — |
| 2 | **Design** | `design.md`, optional ADRs | — |
| 3 | **Tasks** | `tasks.md` (DAG) + `T-Final` | ✅ Living Memory fixes |
| 4 | **Execute** | Source code, Auditor gate, Skill Injection | ✅ New MCP |

**Standalone Operations** (user-triggered, decoupled from the pipeline):
- **Discovery** (ex-"Map Phase") — explicit invocation: _"Map the architecture of this project"_
- **Quick Mode** — explicit invocation: _"Fix bug X"_

> [!IMPORTANT]
> **"Map Phase" is eradicated.** All references must use **Discovery Phase** or **Discovery**. Source of truth: `references/discovery.md`.

### CLI Execution — ADR-0003

The Independent Auditor and `T-Final` tasks **MUST** use the `agy` CLI with sandbox bypass:

```bash
agy --dangerously-skip-permissions --prompt "..."
```

This is mandatory so workers can call local MCP tools (`ctx_index`, `memory_save`) without human approval blocks. **Any `tasks.md` that uses `gemini` CLI for Auditor or T-Final is a grading FAIL.**

**The RBAC benchmark proved overall system superiority. This benchmark proves each component.**

---

## Target Codebase: `taskflow-api`

Pattern matches the RBAC benchmark: agent receives a fresh project skeleton and must implement features.

```
research/benchmarks/e2e-v0.1.0/targets/taskflow-api/
├── package.json             # Express + Jest + jsonwebtoken + bcrypt
├── jest.config.js
├── .eslintrc.json
├── src/
│   ├── app.js               # Express app, no routes mounted
│   ├── server.js            # Entry point
│   ├── routes/              # EMPTY — agents build here
│   ├── middleware/          # EMPTY
│   ├── models/              # EMPTY
│   └── config/
│       └── env.js           # DB_URL, JWT_SECRET stubs
└── README.md                # Domain description: task management API
```

**Why this domain:** task management is universally understood, avoids domain bias, and supports natural progression through auth → RBAC → file upload → rate limiting.

---

## The 6 E2E Scenarios

### S1 — `auth-jwt` (Nominal full flow, linear DAG)
**Target state:** fresh `taskflow-api` skeleton (no prior feature)
**Prompt to dag-flow:** _"Map the architecture of this project. Then, specify a new feature: user authentication with JWT. Tokens expire in 1 hour. Support token refresh."_
**Prompt to baseline:** same, no skill context
**Phases exercised:** Discovery → Specify → Design → Tasks → Execute → T-Final
**What this proves:** The complete nominal flow works end-to-end from cold start.

---

### S2 — `rbac-roles` (Multi-dependency DAG, topological order)
**Target state:** `taskflow-api` + S1 outputs already present (auth exists)
**Prompt to dag-flow:** _"Map the architecture of this project. Then, specify a new feature: Role-Based Access Control. Admins create users. Editors create tasks. Viewers are read-only."_
**Prompt to baseline:** same
**Phases exercised:** All phases + Discovery must detect S1 artifacts, DAG must respect auth dependency
**What this proves:** Discovery Phase detects existing code. DAG generates correct dependency ordering. Living Memory from S1 accelerates S2 Discovery.

---

### S3 — `file-upload` (Skill Injection stress test)
**Target state:** `taskflow-api` skeleton (independent of S1/S2)
**Prompt to dag-flow:** _"Specify a new feature: file attachment upload endpoint. Max 5MB. PNG and JPEG only."_
**Prompt to baseline:** same
**Phases exercised:** All phases + Skill Injection must fire (`search_skills` for file handling)
**What this proves:** Workers call `search_skills` before implementing. Injected skill is semantically appropriate. Skill presence produces better-structured validation code.

---

### S4 — `brownfield-discovery` (Discovery Phase stress test)
**Target state:** `taskflow-api` + **40+ pre-populated files** injected (middleware chains, domain models, existing routes)
**Prompt to dag-flow:** _"Map the architecture of this project. Then, specify a new feature: rate limiting on all API endpoints. Max 100 requests per 15 minutes per IP."_
**Prompt to baseline:** same
**Phases exercised:** Discovery Phase under realistic load, Specify must not hallucinate existing packages
**What this proves:** Discovery correctly captures invariants from a dense codebase. Specify references real existing files. Living Memory saves architectural invariants accurately.

---

### S5 — `ambiguous-spec` (Anti-hallucination gate)
**Target state:** fresh `taskflow-api` skeleton
**Prompt to dag-flow:** _"Add notifications to the app."_ (deliberately underspecified)
**Prompt to baseline:** same
**Phases exercised:** Specify PAGRL — agent MUST stop and interrogate before generating spec
**What this proves:** The PAGRL anti-hallucination mechanism works. Orchestrator never generates spec.md on an underspecified prompt. spec.md produced after clarification is grounded.

---

### S6 — `quick-mode-hotfix` (Quick Mode complete flow)
**Target state:** `taskflow-api` + S1 outputs + **injected bug** (auth middleware returns 500 on valid password hash comparison — bcrypt async/await misuse)
**Prompt to dag-flow:** _"Fix bug: the POST /api/auth/login endpoint returns 500 on valid credentials."_
**Prompt to baseline:** same
**Phases exercised:** Quick Mode — diagnoses → Mini-DAG → worker with mandatory comment
**What this proves:** Quick Mode bypasses ceremony. Worker leaves in-code traceability comment. Bug is fixed. Token cost is a fraction of full flow.

---

## Per-Phase Metric Contracts

### Phase A: Discovery

> [!IMPORTANT]
> **Implementer note — Discovery Phase has two separate layers. Do not conflate them.**
>
> | Layer | Who does it | When | Where stored |
> |---|---|---|---|
> | **Dense indexing** (raw codebase) | Global Indexing Hook (`setup_indexer.sh`) | **Pre-boot**, before agent starts | `context-mode` FTS5 |
> | **Invariant synthesis** (high-level map) | Orchestrator during Discovery Phase | During the session, via `ctx_search` | `CONTEXT.md` |
>
> **Consequence for the harness:** each scenario's `setup.sh` MUST run the indexer hook **before** launching the agent. The Orchestrator never indexes raw files itself — it only queries the pre-populated FTS5 and synthesizes results into `CONTEXT.md`.
>
> **Consequence for timing:** `timing.json` for the Discovery Phase captures only the Orchestrator's `ctx_search` + `memory_save` work. Hook indexing time is measured separately (it runs before the agent session begins) and reported as `hook_indexing_ms` — a distinct field, not included in Discovery Phase token/time totals.
>
> **Source of truth:** `references/discovery.md` (not `docs/architecture.md` — the latter has outdated language implying the Orchestrator does the indexing, which contradicts ADR-0002).

| Metric | Measurement Method | Pass Threshold |
|---|---|---|
| Architectural marker recall | Inject N known markers into target; count how many `CONTEXT.md` captures | ≥ 80% |
| Invariants saved count | `CONTEXT.md` → count invariant bullet points created during Discovery | ≥ 5 |
| Zero raw file crawls | Transcript analysis: count `view_file` calls on source files | 0 crawls |
| Token cost | `timing.json` total_tokens for Discovery Phase | ≤ 3,000 |
| Time to complete | `timing.json` duration_ms | ≤ 90s |
| S2 Discovery acceleration | S2 Discovery tokens ≤ S1 Discovery tokens (Living Memory benefit) | ≤ S1 tokens |

### Phase B: Specify

| Metric | Measurement Method | Pass Threshold |
|---|---|---|
| Anti-hallucination gate (S5) | `spec.md` absent before user answers first question | Pass |
| Clarifying questions asked (S5) | Count `?` exchanges in transcript before spec generation | ≥ 1 round |
| CONTEXT.md exists | `ls CONTEXT.md` | Pass |
| Caveman format compliance | `grep "_Avoid_"` count in CONTEXT.md | ≥ 1 per term defined |
| Domain term coverage | Judge: % of user-stated business concepts captured in CONTEXT.md | ≥ 85% |
| Spec completeness score | Judge: 5-point rubric (intent captured, no hallucinated scope, structured) | ≥ 4 / 5 |
| Specify token cost | `timing.json` | ≤ 10,000 |

### Phase C: Design

| Metric | Measurement Method | Pass Threshold |
|---|---|---|
| `design.md` exists | `ls design.md` | Pass |
| Trade-off present | Judge: articulates ≥1 explicit architectural trade-off | Pass |
| ADR created (when needed) | If design has non-obvious decision → ADR file exists | Pass |
| Design-spec coherence | Judge: design.md doesn't contradict or ignore spec.md | ≥ 4 / 5 |

### Phase D: Tasks (DAG)

| Metric | Measurement Method | Pass Threshold |
|---|---|---|
| `tasks.md` exists | `ls tasks.md` | Pass |
| T-Final injected | `grep -i "t-final"` in tasks.md | Pass |
| **ADR-0003 compliance** | `grep "agy --dangerously-skip-permissions"` in Auditor + T-Final task prompts | Pass (FAIL if `gemini` CLI found instead) |
| DAG topological correctness | Judge: dependencies listed are logically ordered | ≥ 4 / 5 |
| Run prompt completeness | Judge: each task has execution prompt + done-when criteria | ≥ 80% of tasks |
| No orphan task IDs | Script: all `depends_on` refs exist as task IDs | 0 orphans |
| Skill hints annotated | Judge: task descriptions contain domain hints usable for skill search | ≥ 75% of tasks |

### Phase E: Execute + Skill Injection

| Metric | Measurement Method | Pass Threshold |
|---|---|---|
| Auditor exit code | `echo $?` after `auditor.sh` | 0 |
| `search_skills` called | Transcript grep per worker session | ≥ 1 call |
| Skill relevance score | Judge: is injected skill semantically appropriate for the task? | ≥ 4 / 5 |
| Tests produced | `find outputs/ -name "*.test.*"` | ≥ 1 file |
| Tests pass | `npm test` exit code | 0 |
| Worker token cost (with_dag_flow vs baseline) | `timing.json` delta | with_dag_flow ≤ baseline |
| Code structure score | Judge: modular files, not monolith, follows codebase patterns | ≥ 4 / 5 |

### Living Memory / T-Final

| Metric | Measurement Method | Pass Threshold |
|---|---|---|
| T-Final task executed | Transcript: T-Final run confirmation | Pass |
| **T-Final uses `agy` CLI** | `grep "agy --dangerously-skip-permissions"` in T-Final execution log | Pass |
| CONTEXT.md updated | Check `git diff` or file modify time | Pass |
| Delta precision | Expected modified files == files actually re-indexed | 100% |
| Next-session recall | Fresh session `ctx_search` returns updated content from prior feature | Pass |

### Standalone: Quick Mode

| Metric | Measurement Method | Pass Threshold |
|---|---|---|
| No `spec.md` generated | `ls .specs/ 2>/dev/null` | NOT present |
| No `design.md` generated | `ls design.md 2>/dev/null` | NOT present |
| `tasks.md` present (Mini-DAG) | `ls tasks.md` | Pass |
| Mini-DAG is lean | Task count in tasks.md | ≤ 4 tasks |
| **ADR-0003 compliance** | `grep "agy --dangerously-skip-permissions"` in tasks.md prompts | Pass |
| In-code comment present | `grep -r "DAG-FLOW-QUICK\|QUICK.MODE\|hotfix" outputs/src/` | ≥ 1 match |
| Bug fixed | `npm test` exit code post-fix | 0 |
| Token cost vs S1 full flow | Quick Mode total_tokens ÷ S1 total_tokens | ≤ 35% |

---

## Available Skills in the dag-flow-skills MCP

35 skills disponíveis em `/home/guilherme/.dag-flow/skills/`, servidas pelo MCP local. Workers chamam `search_skills → read_skill → fetch_skill_files` para injetar expertise sob demanda.

| Skill | Domínio |
|---|---|
| `api-design` | REST design, naming, status codes, pagination |
| `backend-patterns` | Node.js/Express patterns, arch, DB optimization |
| `coding-standards` | TypeScript/JS/React/Node.js universal standards |
| `security-review` | Auth, input validation, secrets, rate limiting, file uploads |
| `tdd-workflow` | TDD enforced, 80% coverage, red-green-refactor |
| `e2e-testing` | Playwright E2E, Page Object Model, CI/CD |
| `eval-harness` | EDD evaluation framework for Claude Code sessions |
| `database-migrations` | Schema changes, rollbacks, zero-downtime |
| `deployment-patterns` | CI/CD, Docker, health checks, rollback |
| `docker-patterns` | Docker Compose, container security, networking |
| `frontend-patterns` | React, Next.js, state, performance |
| `postgres-patterns` | Query optimization, schema design, indexing |
| `python-patterns` / `python-testing` | Python idioms + pytest/TDD |
| `golang-patterns` / `golang-testing` | Idiomatic Go + table-driven tests |
| `rust-patterns` / `rust-testing` | Ownership, safety + coverage |
| `kotlin-patterns` / `kotlin-testing` | Kotlin + Kotest/MockK |
| `laravel-*` (4 skills) | Laravel patterns, security, TDD, verification |
| `springboot-*` (4 skills) | Spring Boot patterns, security, TDD, verification |
| `django-patterns` | Django/DRF patterns |
| `jpa-patterns` | JPA/Hibernate entity, query, transactions |
| `nextjs-turbopack` | Next.js 16+, Turbopack |
| `continuous-learning` / `v2` | Pattern extraction from sessions |
| `verification-loop` | Comprehensive verification system |
| `dummy-skill` | Test fixture — verifies MCP connectivity |

### Expected Skill Injections per Scenario

Esta tabela é a **fonte de verdade para o gate automatizado** de skill injection. O grader verifica se a skill injetada pelo worker está no conjunto esperado — não requer julgamento subjetivo.

| Scenario | Task type | Expected skills (any of) |
|---|---|---|
| S1 `auth-jwt` | Auth + JWT middleware | `security-review`, `backend-patterns`, `api-design` |
| S2 `rbac-roles` | RBAC middleware + route guards | `security-review`, `backend-patterns`, `api-design` |
| S3 `file-upload` | File validation, MIME, size limits | `security-review`, `backend-patterns` |
| S4 `brownfield` | Rate limiting on existing routes | `security-review`, `backend-patterns`, `api-design` |
| S5 `ambiguous-spec` | Specify only — no worker tasks | N/A (Orchestrator doesn't inject skills) |
| S6 `quick-mode` | Bug fix in auth middleware | `security-review`, `tdd-workflow`, `backend-patterns` |

> [!NOTE]
> O gate automatizado é: `injected_skill ∈ expected_skills[]` → Pass. Skill relevance judge score continua como métrica qualitativa adicional, mas o gate binário é objetivo.

### `dummy-skill` como pré-check

Antes de cada cenário, o `setup.sh` deve verificar que o MCP está respondendo:
```bash
# Pré-check: MCP alive?
search_skills "dummy" → deve retornar dummy-skill
```
Se falhar, o cenário é abortado com `harness_error: "mcp_unavailable"` — evita cenários corrompidos por falha de infraestrutura.

---

## Infrastructure Layout

```
research/benchmarks/e2e-v0.1.0/
│
├── targets/
│   └── taskflow-api/                 # The controlled target codebase skeleton
│       ├── package.json
│       ├── src/...
│       └── README.md
│
├── scenarios/
│   ├── s1-auth-jwt/
│   │   ├── scenario.json             # prompt, setup_script, expected_artifacts
│   │   ├── setup.sh                  # prepares workspace (cp target, optional seed)
│   │   ├── bug-injection.patch       # (S6 only)
│   │   └── assertions.json           # automated metric gate definitions
│   ├── s2-rbac-roles/
│   ├── s3-file-upload/
│   ├── s4-brownfield/
│   │   └── seed/                     # 40+ pre-populated files
│   ├── s5-ambiguous-spec/
│   └── s6-quick-mode-hotfix/
│
├── harness/
│   ├── run_scenario.sh               # Single scenario runner (setup → agent → grade)
│   ├── run_all.sh                    # Sequential runner for all 6 scenarios
│   ├── grade_scenario.py             # Automated gate checker (exit codes, greps, counts)
│   ├── judge_scenario.py             # Gemini 2.5 Flash judge dispatcher
│   └── aggregate_report.py           # Produces benchmark.json + benchmark.md
│
├── workspace/
│   └── run-<YYYYMMDD-HHMM>/
│       ├── s1-auth-jwt/
│       │   ├── with_dag_flow/
│       │   │   ├── outputs/          # Agent output files (spec, design, tasks, src)
│       │   │   ├── timing.json
│       │   │   └── transcript.log
│       │   ├── baseline/
│       │   │   ├── outputs/
│       │   │   ├── timing.json
│       │   │   └── transcript.log
│       │   ├── grading.json          # Automated gates results
│       │   └── judge_verdict.json    # Gemini 2.5 Flash judge scores
│       ├── s2-rbac-roles/
│       ├── ...
│       └── summary/
│           ├── benchmark.json
│           └── benchmark.md
│
└── reports/
    └── e2e-v0.1.0-<date>.json        # Permanent record, committed to repo
```

---

## Harness Design

### `run_scenario.sh` (single scenario)

```bash
#!/usr/bin/env bash
# Usage: ./run_scenario.sh <scenario_id> <workspace_dir>
# 1. Reads scenarios/<scenario_id>/scenario.json
# 2. Runs scenarios/<scenario_id>/setup.sh to prepare workspace copy
# 3. Prints agent prompt → user runs dag-flow (with_dag_flow config)
# 4. After dag-flow completes: collects timing.json, transcript, outputs
# 5. Runs baseline: same prompt, plain LLM (user triggers manually)
# 6. Calls grade_scenario.py
# 7. Calls judge_scenario.py (async, waits for Gemini 2.5 Flash response)
# 8. Saves all artifacts to workspace/run-<timestamp>/<scenario_id>/
```

### `grade_scenario.py` (automated gates)

Reads `assertions.json` per scenario. Each assertion is one of:
- `file_exists` / `file_not_exists`: path → pass/fail
- `grep`: file + pattern → pass/fail
- `grep_not`: file + pattern → must NOT match (e.g. `gemini` CLI in Auditor/T-Final prompt)
- `exit_code`: command → expected code
- `count_gte`: grep count ≥ threshold
- `token_lte`: timing.json field ≤ threshold
- `skill_in_set`: injected skill ∈ expected set for scenario
- `judge_gte`: defer to judge_verdict.json score ≥ threshold

**ADR-0003 gate (applied to S1–S6 where `adr0003_check: true`):**
```python
# Check Auditor and T-Final use agy CLI
assert_grep(tasks_md, pattern="agy --dangerously-skip-permissions", label="adr0003_auditor")
assert_grep_not(tasks_md, pattern=r"\bgemini\b", context="auditor|t-final", label="adr0003_no_gemini")
```

### `judge_scenario.py` (Gemini 2.5 Flash judge)

Dispatches one judge call per qualitative criterion. Each call:
1. Receives: criterion rubric (1-5 scale) + relevant output files
2. Returns: `{ "score": N, "evidence": "...", "criterion": "..." }`
3. All results collected into `judge_verdict.json`

**Judge rubric examples:**

_Spec completeness (Specify phase):_
```
Rate 1-5 how completely this spec.md captures the user's stated intent.
5 = All requirements present, structured, no hallucinated scope.
3 = Most requirements present but one key requirement missing or vague.
1 = Spec.md has hallucinated requirements not mentioned by user.
Evidence: cite specific lines.
```

_Skill relevance (Execute phase):_
```
Given the task description: "<task>", the worker injected skill: "<skill_name>".
Rate 1-5 how semantically appropriate this skill is for the task.
5 = Perfect match, skill directly addresses the technical domain of the task.
1 = Irrelevant skill — provides no useful guidance for this task.
```

---

## `scenario.json` Schema

```json
{
  "scenario_id": "s1-auth-jwt",
  "description": "Nominal full flow — JWT authentication from cold start",
  "target_state": "fresh",
  "standalone_ops": ["discovery"],
  "dag_flow_prompt": "Map the architecture of this project. Then, specify a new feature: user authentication with JWT. Tokens expire in 1 hour. Support token refresh.",
  "baseline_prompt": "Specify a new feature: user authentication with JWT. Tokens expire in 1 hour. Support token refresh.",
  "setup_script": "scenarios/s1-auth-jwt/setup.sh",
  "expected_artifacts": {
    "with_dag_flow": ["CONTEXT.md", ".specs/features/auth-jwt/spec.md", ".specs/features/auth-jwt/design.md", ".specs/features/auth-jwt/tasks.md", "src/middleware/auth.js", "test/auth.test.js"],
    "baseline": ["app.js", "app.test.js"]
  },
  "phases_exercised": ["discovery", "specify", "design", "tasks", "execute", "living_memory"],
  "adr0003_check": true
}
```

---

## `benchmark.json` Output Schema

```json
{
  "version": "0.1.0",
  "run_timestamp": "2026-06-10T...",
  "scenarios": [
    {
      "scenario_id": "s1-auth-jwt",
      "phases": {
        "discovery":     { "hook_indexing_ms": 4200, "recall_pct": 0.85, "token_cost": 2100, "crawls": 0, "pass": true },
        "specify":       { "completeness_score": 4.5, "hallucination_pass": true, "token_cost": 6200, "pass": true },
        "design":        { "tradeoff_present": true, "coherence_score": 4.0, "pass": true },
        "tasks":         { "t_final_present": true, "adr0003_compliant": true, "dag_score": 4.5, "orphan_tasks": 0, "pass": true },
        "execute":       { "auditor_exit": 0, "tests_pass": true, "skill_fired": true, "skill_in_expected_set": true, "skill_score": 4.5, "pass": true },
        "living_memory": { "t_final_ran": true, "t_final_agy_cli": true, "delta_precision": 1.0, "pass": true }
      },
      "configs": {
        "with_dag_flow": { "total_tokens": 45000, "duration_ms": 180000 },
        "baseline":      { "total_tokens": 89000, "duration_ms": 260000 }
      },
      "overall_pass": true
    }
  ],
  "summary": {
    "scenarios_passed": 6,
    "scenarios_total": 6,
    "overall_pass_rate": 1.0,
    "avg_token_savings_vs_baseline": "49%",
    "avg_code_quality_score": 4.3,
    "skill_injection_relevance_avg": 4.6,
    "adr0003_compliance_rate": 1.0
  }
}
```

---

## Eval Viewer Integration

Use `skill-creator/eval-viewer/generate_review.py` (already in repo):

```bash
python .agents/skills/skill-creator/eval-viewer/generate_review.py \
  research/benchmarks/e2e-v0.1.0/workspace/run-latest/ \
  --skill-name "dag-flow-e2e-v0.1.0" \
  --benchmark research/benchmarks/e2e-v0.1.0/workspace/run-latest/summary/benchmark.json
```

**Outputs tab:** per-scenario side-by-side — `with_dag_flow` outputs vs `baseline` outputs
**Benchmark tab:** per-phase metric scorecards across all 6 scenarios

---

## Execution Plan (Sequential)

```
Step 1: Infrastructure (Day 1, ~2-3h)
  1.1  Create targets/taskflow-api/ skeleton
  1.2  Create all 6 scenario.json + assertions.json
  1.3  Create S4 brownfield seed/ (40+ files)
  1.4  Create S6 bug-injection.patch
  1.5  Write harness scripts (run_scenario.sh, grade_scenario.py, judge_scenario.py, aggregate_report.py)

Step 2: Run Scenarios Sequentially (~4-6h total, each ~45-60min)
  2.1  S1: auth-jwt
  2.2  S2: rbac-roles (depends on S1 outputs)
  2.3  S3: file-upload (fresh target, independent)
  2.4  S4: brownfield-discovery (seeded target)
  2.5  S5: ambiguous-spec (fresh target)
  2.6  S6: quick-mode-hotfix (S1 + bug injected)

Step 3: Grading (~1h)
  3.1  Run grade_scenario.py for all 6
  3.2  Dispatch Gemini 2.5 Flash judges for all qualitative criteria
  3.3  Aggregate into benchmark.json + benchmark.md

Step 4: Review
  4.1  Launch eval viewer
  4.2  Review outputs + benchmark tab
  4.3  Commit final results to research/benchmarks/e2e-v0.1.0/reports/
```

---

## Files to Create/Modify

| Path | Status | Purpose |
|---|---|---|
| `research/benchmarks/e2e-v0.1.0/targets/taskflow-api/` | **NEW** | Controlled target skeleton |
| `research/benchmarks/e2e-v0.1.0/scenarios/s{1-6}/scenario.json` | **NEW** | 6 scenario definitions |
| `research/benchmarks/e2e-v0.1.0/scenarios/s{1-6}/assertions.json` | **NEW** | Automated gate definitions |
| `research/benchmarks/e2e-v0.1.0/scenarios/s4-brownfield/seed/` | **NEW** | 40+ pre-populated files |
| `research/benchmarks/e2e-v0.1.0/scenarios/s6-quick-mode-hotfix/bug-injection.patch` | **NEW** | Injected bug |
| `research/benchmarks/e2e-v0.1.0/harness/run_scenario.sh` | **NEW** | Single scenario harness |
| `research/benchmarks/e2e-v0.1.0/harness/run_all.sh` | **NEW** | Sequential runner |
| `research/benchmarks/e2e-v0.1.0/harness/grade_scenario.py` | **NEW** | Automated gate grader |
| `research/benchmarks/e2e-v0.1.0/harness/judge_scenario.py` | **NEW** | Gemini 2.5 Flash judge |
| `research/benchmarks/e2e-v0.1.0/harness/aggregate_report.py` | **NEW** | Report aggregator |
| `evals/evals.json` | **MODIFY** | Register 6 new scenario entries |
