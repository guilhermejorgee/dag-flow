---
name: 00-dag-flow-orchestrator
description: "MANDATORY ROOT SKILL: You MUST read this skill FIRST for ALL feature requests, bug fixes, or architecture planning (even if you see other relevant skills like backend or UI). Orchestrates project and feature planning with 4 strict phases (Specify, Design, Tasks, Execute) using Socratic Interrogation and Counted PAGRL. Creates executable JSON AST DAGs, builds a ubiquitous language (CONTEXT.md), and strictly delegates execution to stateless CLI sessions. Use when: (1) Implementing new features/APIs, (2) Applying quick bug fixes (Mini-DAG), (3) Discovering/mapping existing architecture, (4) Planning complex workflows. Triggers on: 'implement', 'build', 'add', 'create', 'fix bug', 'hotfix', 'specify feature', 'design', 'tasks', 'map project', 'plan architecture', 'discovery'. Do NOT write code before reading this skill."
---

# dag-flow: Executive Orchestrator

**📍 PATH RESOLUTION:** This skill is an Agent Skill. All `references/` and `scripts/` mentioned in this document are located *inside* the folder where this SKILL.md file resides. You must dynamically resolve this path when executing scripts or reading references (e.g., if you are reading `SKILL.md` from `/path/to/skill/SKILL.md`, use `bash /path/to/skill/scripts/write_dag.sh`). Do NOT assume they are in the project's root.

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

## Ubiquitous Language & Living Memory

`dag-flow` manages state via two distinct mechanisms:
1. **Ubiquitous Language (`CONTEXT.md`):** The human-readable domain dictionary. You initialize and update this immediately during the **Specify Phase** as new business terms emerge.
2. **Living Memory (Architectural Invariants):** The high-level technical state stored in physical markdown files. You initialize this in the **Discovery Phase** and update it during the **Design Phase**.

## Default Policy

Any feature request - regardless of phrasing - enters the Specify phase by default. This applies to prompts using verbs like "Implement", "Build", "Add", "Create", and to prompts that do not use any explicit verb at all. The orchestrator does not classify prompts to decide whether Specify is needed; Specify is the default, and the only opt-out is the user explicitly invoking Quick Mode via one of the canonical trigger phrases listed in `references/quick-mode.md`.

This rule exists because earlier versions of this skill granted the orchestrator discretion to bypass phases for "trivial" features. In benchmark traces, large models reliably abused this discretion by self-classifying as trivial whenever the request matched their pretraining distribution - which is precisely when overconfidence is highest and Socratic interrogation is most needed.

## 1. Phase: Specify (Socratic Interrogation)

**Trigger:** Any feature request (per Default Policy), including but not limited to "Specify feature X", "Plan project", "Implement Y", "Add Z".

**Goal:** Eradicate ambiguity before writing a single line of code.

- **Reference:** You MUST use the `view_file` tool to read [`references/specify.md`](/references/specify.md) before executing this phase, including its `## Calibration` section. **Why:** the calibration sentence and the counted PAGRL schema defined there are not summarizable; relying on memory drops the load-bearing fields and you will fail the advancement rule.
- **Artifact Generation:** Write the spec (`spec.md`) and the Counted PAGRL (`spec.pagrl.xml`) strictly to `.specs/staging/[feature]/`.
- **Gate Execution:** You MUST explicitly use the `run_command` tool to execute `<path-to-skill>/scripts/commit_spec.sh [feature]`. This script runs Python validation and moves the files to the physically locked `.specs/features/` vault.

## 2. Phase: Design

**Trigger:** Automatically follows the completion of the Specify Phase. There is no bypass.

**Goal:** Make architectural decisions visible before they are committed to code, including for features that reuse existing patterns (which produce a short `design.md` with N/A justified, not a skipped phase).

- **Reference:** You MUST use the `view_file` tool to read [`references/design.md`](/references/design.md) before executing this phase. **Why:** the required-sections template and the counted PAGRL schema for Design live there. The depth of `design.md` is proportional to the architectural decisions the feature requires; the *shape* (which sections must appear) is uniform.
- **ADRs:** any item declared in `<ADRsRequired>` of the Design PAGRL must be created in `docs/adr/` before advancing to Tasks.
- **Artifact Generation:** Write the design (`design.md`) and the Counted PAGRL (`design.pagrl.xml`) strictly to `.specs/staging/[feature]/`.
- **Gate Execution:** You MUST explicitly use the `run_command` tool to execute `<path-to-skill>/scripts/commit_design.sh [feature]`. This script runs Python validation and moves the files to the physically locked `.specs/features/` vault.

## 3. Phase: Tasks (The DAG Generator)

**Trigger:** Design is complete (every feature has a Design Phase; see Decision Default Policy).

**Goal:** Translate the specification and design into an executable Directed Acyclic Graph (DAG) formatted as a strict JSON AST Array.

- **Reference:** You MUST use the `view_file` tool to read [`references/tasks.md`](/references/tasks.md) for detailed formatting and execution prompt templates, including its `## Counted PAGRL (Schema)` section. **Why:** the JSON schema is not memorable from pretraining - claiming to know it from memory is the failure mode the `<DagSchemaSource>` field is designed to detect.
- **Subagent Relay (Crucial):** To protect the physical vault, the JSON DAG is generated by a Subagent without write permissions. First, write your `tasks.pagrl.xml` to `.specs/staging/[feature]/`. Then, spawn a Subagent Planner (`define_subagent`) with `enable_mcp_tools=true` and `enable_write_tools=false`. Instruct it to read `references/tasks.md`, the spec, the design, and generate the JSON AST, passing it back to you via message.
- **Gate Execution:** Once you receive the JSON, write it to `.specs/staging/[feature]/dag.json`. You MUST explicitly use the `run_command` tool to execute `<path-to-skill>/scripts/write_dag.sh [feature] --phase tasks`. This runs Python validation on your XML and safely commits the DAG to `.specs/dags/`.

## 4. Phase: Execute (Decentralized)

**Trigger:** User runs the generated DAG script.

- As the Orchestrator, your job is largely done. The user will spawn independent CLI sessions using the script you generated in Phase 3.
- **The CLI Session:** the sub-session will act as a stateless execution layer. It only reads inputs and writes outputs. It does NOT run tests.
- **The Auditor:** after an execution finishes, `<path-to-skill>/scripts/auditor.py` must be invoked to run the "Done When" gate and validate against `CONTEXT.md`. If it fails, the error feeds back into a new prompt.
- **Escalation Protocol:** if the user reports a DAG failure, identify the failed task and read its log file in the `logs/` directory and read [`references/escalation-phase.md`](/references/escalation-phase.md) to initiate the recovery protocol. When instructed to update a task's status to Done, you MUST explicitly use the `run_command` tool to execute `python3 <path-to-skill>/scripts/update_task_status.py <dag_file> <task_id> Done`, as the vault is locked.

## Standalone Operations

These operations are executed independently and are not part of the core feature pipeline.

### Discovery (Project Mapping)

**Trigger:** User explicitly says "Map this project", "Do a discovery", "Map architecture".

**Goal:** Establish an accurate, token-efficient understanding of the existing codebase.

- **Reference:** You MUST use the `view_file` tool to read [`references/discovery.md`](/references/discovery.md) for execution rules using `context-mode`. **Why:** standard directory listings are too expensive and inaccurate for deep architectural context.

### Emergency / Quick Mode

**Trigger:** **Only** when the user's prompt literally contains one of the canonical phrases listed in [`references/quick-mode.md`](/references/quick-mode.md). Quick Mode is the **only** exception to the Default Policy.

- **Entry Gate:** before any diagnosis, you MUST emit a `<PAGRL phase="QuickModeEntry">` block proving authorization, per the schema in `references/quick-mode.md`. Self-classifying a request as a hotfix when the user did not use a canonical trigger is forbidden.
- **Artifact Generation & Gating:** Write the Mini-DAG to `.specs/staging/[issue_id]/dag.json`. You MUST emit TWO XML files: `quickmode-entry.pagrl.xml` and `quickmode-diagnosis.pagrl.xml` in the same staging folder. Then use `run_command` to execute `<path-to-skill>/scripts/write_dag.sh [issue_id] --phase quick-mode`.
- **Reference:** see [`references/quick-mode.md`](/references/quick-mode.md). **Why:** full ceremonies for 1-line bug fixes waste tokens, but uncontrolled direct file editing breaks the DAG architecture. Mini-DAGs are the required bridge.

## Strict Restrictions

- You (The Orchestrator) are **FORBIDDEN** from using file-editing tools on application source code (`src/`, `lib/`, `api/`) during the Specify and Design phases.
- You are **FORBIDDEN** from directly editing files in the physically locked `.specs/dags/` and `.specs/features/` directories. You MUST write to `.specs/staging/` and use `run_command` to invoke the `commit_*.sh` and `write_dag.sh` gate scripts.
- Confine your direct outputs to `.specs/features/`, `CONTEXT.md`, and `docs/adr/`.
