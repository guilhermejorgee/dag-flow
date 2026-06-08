# dag-flow: Tasks Phase (The DAG Generator)

The **Tasks Phase** is the bridge between specification/architecture and execution. The Orchestrator translates `.specs/features/[feature]/spec.md` (and `design.md`, if created) into an executable Directed Acyclic Graph (DAG) for the automated DAG Runner. The Orchestrator NEVER executes these tasks itself.

## Trigger
Automatically follows the completion of the Design Phase.

## Core Mechanics

### 1. Reading the Specs and Design
The Orchestrator reads `.specs/features/[feature]/spec.md` and (if it exists) `.specs/features/[feature]/design.md` to understand the business requirements, technical architecture, constraints, and required components.

### 2. Generating the DAG Table
The Orchestrator breaks down the requirements and design into isolated, atomic tasks. These tasks must have strict dependencies.

**Output to `.specs/features/[feature]/tasks.md`:**
A visual markdown table representing the DAG:

| ID | Description | Context Ref | Depends On | Input Files | Output Files | Done When (Gate) | Status |
|---|---|---|---|---|---|---|---|
| T1 | Implement DB schema | Spec: Database rules | None | `src/schema.ts` | `src/schema.ts` | `npx eslint src/schema.ts` | Pending |
| T2 | Create Auth Middleware | Design: Use JWT | None | `src/auth.ts` | `src/auth.ts` | `npx tsc --noEmit` | Pending |
| T3 | Implement API Endpoint | Spec: User creation | T1, T2 | `src/schema.ts`, `src/auth.ts` | `src/api.ts` | `npm test src/api.test.ts` | Pending |
| T-Final | Map Delta Update | Orchestrator Rule | T3 | `N/A` | `N/A` | `gemini --prompt "Update context-mode indexing ONLY for src/api.ts and src/auth.ts. Update agentmemory invariants if architecture changed."` | Pending |

**The Traceability Rule (Context Ref):**
The Orchestrator MUST map every functional task to a specific rule in `spec.md` and every architectural task to a decision in `design.md`. This column provides the *Reason* for the task. It MUST be a **self-contained, highly detailed summary** of the exact rule to be evaluated (e.g., "The table must use UUID v4. The cache must use Redis per ADR-002." rather than just "Database rules"). This ensures the stateless Auditor can validate the code without reading the full spec files.

**The "Done When" Gate (Test-Driven Auditing):**
This column is **MANDATORY for every single task**. Without an executable gate, the DAG Runner cannot verify completion and the workflow will break. This column is NOT for vague descriptions (e.g., "Tests pass"). It MUST be the **exact, executable terminal command** the Bash Auditor will run. 

**For Mechanical Tasks:**
- Use atomic test commands: `npm test path/to/specific.test.ts` or `npx eslint src/schema.ts`.

**For Architectural/Complex Tasks (LLM-as-a-judge):**
- If the task implements a complex rule or architectural decision that cannot be verified by tests, you MUST use the following exact `gemini` command template in the `Done When` column. Replace the bracketed variables. Do NOT instruct the Auditor to read external context files, as the summarized `Context Ref` is sufficient:
`gemini --prompt "Role: Independent Auditor. Evaluate if the code in [OUTPUT_FILES] strictly obeys this rule: '[CONTEXT_REF]'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>"`

### 3. The Financial Firewall (Token Economy)
The `Input Files` column is critical. Because the DAG Runner spawns *stateless* background workers, every file listed is read from scratch.
- **Rule:** Be surgically precise. Never use wildcards like `src/*`. Only list the exact files needed to complete the task. This guarantees parallel execution is exponentially cheaper than keeping a monolithic session alive.

### 4. Living Memory (The Delta Update Task)
To ensure the project map does not rot, the Orchestrator MUST inject a final task (`T-Final`) into every DAG table. 
- **The Token-Efficient Delta:** The Orchestrator MUST NOT ask for a full codebase re-scan. It must pass its exact architectural intent and list ONLY the newly modified folders/files for `ctx_index`.
- This ensures the Map stays fresh with zero token waste and preserves the high-level design intent.

### 5. Handoff to Execution (DAG Runner)
The Orchestrator DOES NOT generate raw CLI prompts. Instead, it instructs the user to invoke the automated DAG Runner:

```bash
./dag-flow/v2/scripts/run_dag.sh .specs/features/[feature]/tasks.md
```

**What happens next (out of the Orchestrator's sight):**
- The Bash script parses the table.
- It spawns isolated Gemini CLI workers in parallel for tasks with no dependencies.
- Upon worker completion, the script automatically triggers the Auditor (`Done When` gate).
- If the Auditor fails, the script triggers an Auto-Healing loop, re-invoking the worker with the error logs.
- The Orchestrator stays completely clean, preserving its context window for high-level architecture.
