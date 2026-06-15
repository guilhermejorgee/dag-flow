# Implementation Plan: Cognitive Hardening & JSON DAG Migration

## 1. Background & Motivation (Crucial Context for the Executing Agent)

### The Origin: The `parallel-runner` Failure Mode
During previous executions, the Subagent Planner generated non-production-ready DAG tables. It suffered from:
1. **Context Blindness:** Omitting essential input files required to execute the tasks.
2. **Validation Weakness:** Substituting required LLM-as-a-judge (`agy`) validation gates with purely syntactical checkers (like `bash -n`), completely failing to validate architectural intent.

### The Root Cause: Overconfidence & Markdown Fragility
Highly intelligent models suffer from **Overconfidence Bias**. They optimize workflows by skipping required cognitive ceremonies (like carefully writing `agy` prompts). Furthermore, the `dag-flow` system was relying on **Markdown tables** to act as the Execution Graph, coupled with fragile pure-bash (`awk`/`grep`) validation scripts.
* **Markdown tables** are great for human prose but terrible as an Abstract Syntax Tree (AST). They encourage "Monolithic Dumping" (the LLM writing without thinking) and cannot natively enforce strict nested data schemas (e.g., arrays for files).
* **Pure Bash Parsing** of these tables is brittle and prone to failure when columns have spaces or variable widths.

### The Strategic Pivot: JSON DAG & Cognitive Tracing
After a deep "Grilling Session" with the Architect, we identified that prompt engineering alone leads to "few-shot ossification". We reached a combined two-pronged architectural solution:
1. **The "Brain" (Cognitive Hardening via PAGRL):** Force the Subagent Planner to emit an XML trace (`<PAGRL phase="TaskPlanning">`) *before* generating the tasks. This forces a conversational Chain-of-Thought where the model explicitly reasons about *why* a specific validation gate is chosen. To ensure adherence, this XML is extracted, saved to the Staging Area, and physically validated via OS-Gates.
2. **The "Body" (JSON DAG):** Abandon Markdown tables entirely for the execution engine. The generated artifact will be a strict `dag.json`. This natively enforces input/output file arrays, eliminates regex fragility in the gates, and allows us to embed a `"cognitive_rationale"` field directly into the JSON task payload, merging reflection and execution.

---

## 2. Detailed Execution Plan (What, Where, Why)

### A. Core Architecture Migration (Markdown to JSON DAG)
**Why:** To establish a deterministic, machine-readable AST that enforces schema adherence natively and enables robust Python-based validation.
**Target Files & Actions:**
- **`references/tasks.md`:** 
  - Rewrite instructions: The Subagent Planner must output a `dag.json` code block, not a markdown table.
  - Define the strict JSON schema for tasks: `id`, `description`, `dependencies` (array), `input_files` (array), `output_files` (array), `done_when_gate` (string).
  - **Crucial Requirement:** Add `"cognitive_rationale"` as a mandatory field in the JSON task schema. The model must explain its validation strategy (Structural syntax test vs Cognitive `agy` judge) *before* the `done_when_gate` field.

- **`scripts/extract_json_dag.py` (NEW):**
  - Create a Python script to parse the Subagent's text response, cleanly extract the ````json` block, and save it to `.specs/staging/[feature]/dag.json`.

- **`scripts/write_dag.sh`:**
  - Remove all legacy `grep`/`awk` column-counting logic.
  - Instead, execute `python3 scripts/validate_dag_coherence.py` to structurally validate the extracted JSON DAG.

- **`scripts/validate_dag_coherence.py` (NEW):**
  - **What:** Create a Python script to structurally validate the extracted `dag.json`.
  - **Why:** To intercept model hallucinations and "Context Blindness" before execution starts, preventing token burn on impossible tasks.
  - **How (Mandatory Rules):**
    1. **Input/Output Coherence Check:** Assert that any file listed in a task's `output_files` that *already exists on disk* MUST also be listed in `input_files`. (If the model modifies an existing file, it must request its content first).
    2. **Reverse Coherence Check (Anti-Hallucination):** Assert that every file in `input_files` MUST either (a) exist physically on disk at the time of validation, or (b) be declared as an `output_file` of a *prior dependency task* in the DAG. If the model hallucinates an input file path, the runner would crash; this check forces the plan to be physically viable from the start.

### B. OS-Level Gating of Cognitive Traces
**Why:** Models ignore prompt instructions over time. We use OS-level bash locks to physically reject unthinking tasks from reaching the execution vault.
**Target Files & Actions:**
- **`references/tasks.md`:**
  - Mandate the Subagent Planner to emit a `<PAGRL phase="TaskPlanning">` XML block at the start of its response.
  - Define the schema to include `<TasksCount>` and explicit guidelines on when to use Structural (Tests) vs Cognitive (`agy`) validation.
- **`scripts/write_dag.sh`:**
  - The Orchestrator will extract this XML block and save it to `.specs/staging/[feature]/planner.pagrl.xml`.
  - `write_dag.sh` must assert that this XML file exists and structurally validate it by calling `python3 scripts/validate_pagrl.py --phase TaskPlanning`.

### C. Execution Engine & State Mutation Updates
**Why:** With the shift to `dag.json`, tools like `auditor` and `update_task_status` must manipulate JSON. We **must not** rely on `jq` (as it introduces external binary dependencies breaking portability) or Bash redirection (e.g., `> tmp && mv tmp`), which is not atomic and will cause file corruption or race conditions when parallel workers try to update the DAG simultaneously. Instead, the entire execution and mutation layer must be standardized on Python. Bash is strictly reserved for physical OS-Level Gating (changing permissions).

**Target Files & Actions:**
- **`dag_runner.py`:**
  - **What/How:** Refactor the execution engine to load and parse `dag.json` instead of regex-parsing markdown tables.
  - **Runtime State Separation (NEW):** When execution starts, the runner MUST copy the pristine blueprint from `.specs/dags/[ID].json` into a mutable execution folder `.specs/runs/[ID]/dag.json`. The Vault (`.specs/dags/`) remains `chmod 555` and is never mutated during or after execution. The `runs/` folder holds the live state and the isolated task logs.
- **`scripts/auditor.py` (MIGRATED from `.sh`):**
  - **What:** Completely rewrite the auditor in Python.
  - **Why:** Python natively parses JSON without requiring `jq`. It centralizes execution logic in one language.
  - **How:** Load `.specs/runs/[ID]/dag.json`, extract the `done_when_gate` for the given task, and execute it. Manage the success/fail flow natively in Python.
- **`scripts/update_task_status.py` (MIGRATED from `.sh`):**
  - **What:** Completely rewrite the task status updater in Python.
  - **Why:** To prevent "Permission Denied" race conditions on the locked `.specs/dags/` vault.
  - **How:** It mutates ONLY the active `.specs/runs/[ID]/dag.json`. It uses `fcntl.flock` to acquire an exclusive lock before reading, updates the status, writes to a temporary file, and uses atomic `os.replace`. This guarantees 100% thread-safe state mutation.
- **`references/escalation-phase.md` (UPDATE):**
  - **What:** Update the reference instructions for the Orchestrator's Escalation Phase.
  - **Why:** Since the live execution state moved from the Vault (`.specs/dags/`) to the Runtime folder (`.specs/runs/`), the Orchestrator needs to know where to find the logs and where to mutate the state during a hotfix.
  - **How:** Explicitly modify the escalation protocol to instruct that:
    1. Failure logs are strictly read from `.specs/runs/[ID]/logs/T[X].log`.
    2. The Double Verification step must use `python3 scripts/auditor.py <task_id> .specs/runs/[ID]/dag.json`.
    3. The task resumption command must use `python3 scripts/update_task_status.py .specs/runs/[ID]/dag.json <task_id> Done`.

### D. Mass Migration (Backward Compatibility)
**Why:** We must not break existing Disjoint Flows or historical executions currently stored as `.md` files in `.specs/dags/`. We chose a "Mass Migration" approach over "Dual Support" to keep the runner code clean and avoid technical debt.
**Target File & Actions:**
- **`scripts/migrate_dags_to_json.py` (NEW):**
  - Write a one-off migration script that walks through `.specs/dags/*.md`.
  - Parse the legacy markdown tables using regex/string splitting.
  - Convert them into the new `dag.json` JSON DAG schema.
  - Save the `.json` files and physically delete the legacy `.md` files.

### E. Living Memory Update
**Why:** To record this architectural pivot into the domain dictionary and historical decision log.
**Target File:**
- **`docs/adr/0008-cognitive-hardening-and-json-dag.md` (NEW):**
  - Document the deprecation of Markdown tables, the introduction of JSON DAGs, the embedded `cognitive_rationale`, and the Planner PAGRL OS-Gate.

---

## 3. Verification Plan (Done When)
1. **Migration Verification:** `scripts/migrate_dags_to_json.py` successfully converts an existing `.md` DAG to JSON without data loss.
2. **Runner Tests:** Unit tests in `test_dag_runner.py` pass with JSON loading.
3. **Gate Rigidity:** `scripts/validate_dag_coherence.py` correctly throws a fatal error when tested against a dummy JSON missing a required existing input file.
4. **End-to-End Dry-Run:** `scripts/write_dag.sh` correctly intercepts execution if the staging area is missing `planner.pagrl.xml` or contains a malformed JSON DAG.
