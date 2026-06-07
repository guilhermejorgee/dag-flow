# SDD V2: Tasks Phase (The DAG Generator)

The **Tasks Phase** is the bridge between architecture and execution. The Orchestrator translates the finalized `design.md` into an executable Directed Acyclic Graph (DAG) for the automated DAG Runner. The Orchestrator NEVER executes these tasks itself.

## Trigger
Automatically follows the completion of the Design Phase.

## Core Mechanics

### 1. Reading the Design
The Orchestrator reads `.specs/features/[feature]/design.md` to understand the technical architecture, constraints, and required components.

### 2. Generating the DAG Table
The Orchestrator breaks down the design into isolated, atomic tasks. These tasks must have strict dependencies.

**Output to `.specs/features/[feature]/tasks.md`:**
A visual markdown table representing the DAG:

| ID | Description | Depends On | Input Files | Output Files | Done When (Gate) | Status |
|---|---|---|---|---|---|---|
| T1 | Implement DB schema | None | `src/schema.ts` | `src/schema.ts` | `npx eslint src/schema.ts` | Pending |
| T2 | Create Auth Middleware | None | `src/auth.ts` | `src/auth.ts` | `npx tsc --noEmit` | Pending |
| T3 | Implement API Endpoint | T1, T2 | `src/schema.ts`, `src/auth.ts` | `src/api.ts` | `npm test src/api.test.ts` | Pending |

**The "Done When" Gate (Test-Driven Auditing):**
This column is **MANDATORY for every single task**. Without an executable gate, the DAG Runner cannot verify completion and the workflow will break. This column is NOT for vague descriptions (e.g., "Tests pass"). It MUST be the **exact, executable terminal command** the Bash Auditor will run. 
- **Atomic Testing:** Do not run the entire test suite (`npm test`). Specify the exact test file (`npm test path/to/specific.test.ts`) so the stateless Worker only gets the relevant error logs.
- **Progressive Validation:** Early tasks might just use linters (`eslint`) or compilers (`tsc`). Integration tasks use integration tests. The final DAG tasks use E2E commands.

### 3. The Financial Firewall (Token Economy)
The `Input Files` column is critical. Because the DAG Runner spawns *stateless* background workers, every file listed is read from scratch.
- **Rule:** Be surgically precise. Never use wildcards like `src/*`. Only list the exact files needed to complete the task. This guarantees parallel execution is exponentially cheaper than keeping a monolithic session alive.

### 4. Handoff to Execution (DAG Runner)
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
