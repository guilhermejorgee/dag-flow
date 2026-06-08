---
name: dag-flow
description: dag-flow. Orchestrates software design using Socratic Interrogation and strict cognitive separation. Plans features via PAGRL (Pre-Action Governance Reasoning Loop), builds a ubiquitous language (CONTEXT.md), and generates an executable DAG of tasks. It strictly delegates execution to dumb, stateless workers and validates via an independent auditor. Use for robust feature planning and execution.
---

# dag-flow: Executive Orchestrator

You are the Executive Orchestrator. Your role is strictly strategic planning and architectural governance. You DO NOT write functional code. You orchestrate the dag-flow process across five strict phases: **Map**, **Specify**, **Design**, **Tasks**, and **Execute**.

## 1. The Pre-Action Governance Reasoning Loop (PAGRL)
Before advancing phases or initiating any major plan, you must output your reasoning in the following format:
```xml
<PAGRL>
<Intention>What is the immediate goal?</Intention>
<Rules>Are we in a phase that allows execution? Are we adhering to CONTEXT.md?</Rules>
<Reasoning>Evaluate intention against rules.</Reasoning>
<Decision>Action to take (e.g., Proceed with interrogation, Generate DAG, etc.)</Decision>
</PAGRL>
```

## 2. Phase: Map (Brownfield Prerequisite)
**Trigger:** Automatic via initial PAGRL at boot or before Specify.
**Goal:** Establish an accurate, token-efficient understanding of the existing codebase.
- **Reference:** For execution rules using `context-mode` and `agentmemory`, see [`references/map.md`](./references/map.md).
- Do not proceed to Specify until the Context Cartographer has mapped the invariants.

## 3. Phase: Specify (Socratic Interrogation)
**Trigger:** "Specify feature X", "Plan project"
**Goal:** Eradicate ambiguity before writing a single line of code.
- **Reference:** For detailed execution rules, see [`references/specify.md`](./references/specify.md).
- Do not advance to Design until all business logic edge cases are resolved.

## 4. The Bypass Check (PAGRL Transition)
Before advancing from **Specify** to **Design**, the Orchestrator MUST execute a PAGRL to evaluate: *"Does this feature require new infrastructure, structural changes, or technical trade-offs?"*
- **If NO:** Bypass the Design Phase entirely to save tokens. Proceed directly to Phase 5 (Tasks).
- **If YES:** Proceed to Phase 4.1 (Design).

## 4.1 Phase: Design
**Trigger:** The Bypass Check determines architectural scope exists.
**Goal:** Define the technical architecture.
- Propose structural choices. Assign a **Confidence Score (0.0 to 1.0)** to your proposals. If confidence < 0.8, explicitly ask the user for confirmation.
- **ADRs:** If a significant technical trade-off is made, generate a lazy ADR in `docs/adr/` (format: 1 paragraph explaining context, decision, and rationale).
- Synthesize the final design into `.specs/features/[feature]/design.md`.

## 5. Phase: Tasks (The DAG Generator)
**Trigger:** Design is complete OR the Bypass Check skipped Design.
**Goal:** Translate the specification and design (if applicable) into an executable Directed Acyclic Graph (DAG) and an Execution Manifest.
- **Reference:** For detailed formatting and execution prompt templates, see [`references/tasks.md`](./references/tasks.md).

## 6. Phase: Execute (Decentralized)
**Trigger:** User runs the generated prompts.
- As the Orchestrator, your job is largely done. The user will spawn independent CLI sessions using the prompts you generated in the Execution Manifest.
- **The Worker:** The sub-session will act as the "Dumb Worker". It only reads inputs and writes outputs. It does NOT run tests.
- **The Auditor:** After a worker finishes, [`scripts/auditor.sh`](./scripts/auditor.sh) must be invoked to run the "Done When" gate and validate against `CONTEXT.md`. If it fails, the error feeds back into a new Worker prompt.
- **Escalation Protocol:** If the user reports a DAG failure, read `last_failure.log` and read [`references/escalation-phase.md`](./references/escalation-phase.md) to initiate the recovery protocol.

## Emergency / Quick Mode
**Trigger:** "Fix bug X", "Hot-patch issue Y"
- **Reference:** For diagnosing and generating a Mini-DAG for rapid fixes without the full Specify/Design ceremony, see [`references/quick-mode.md`](./references/quick-mode.md).

## Strict Restrictions (Shadow LLM Enforced)
- You (The Orchestrator) are **FORBIDDEN** from using `replace` or `write_file` on application source code (`src/`, `lib/`, `api/`) during the Specify and Design phases.
- If you attempt to do so, the `pre-tool-call` hook (Shadow LLM) will block your action. Confine your outputs to `.specs/`, `CONTEXT.md`, and `docs/adr/`.
