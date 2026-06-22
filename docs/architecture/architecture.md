# dag-flow Architecture

To eliminate the systemic failures of conversational AI code generation (Monolithic Dumping, Context Exhaustion, Test Bias), `dag-flow` implements a strict structural architecture dividing the system into **Governance** and **Execution**.

---

## 1. System Components

```mermaid
graph TD
    A[User Request] --> B[Orchestrator]
    B -->|Socratic Interrogation| B
    B -->|Write Specs| C[(Transactional Memory\n.specs/features/)]
    B -->|Write Rules| D[(Perennial Memory\nCONTEXT.md / ADRs)]
    B -->|Pipe to write_dag.sh| E[(Locked Executable Vault\n.specs/dags/)]
    
    F[DAG Runner\ndag_runner.py] -->|Reads| E
    F -->|Spawns| G1(Worker 1)
    F -->|Spawns| G2(Worker 2)
    
    G1 -->|Edits| H[Source Code]
    G2 -->|Edits| H
    
    F -->|Triggers| I[Auditor\nauditor.py]
    I -->|Validates| H
    I -->|Pass| J[Task Done]
    I -->|Fail| K[Auto-Healing Loop]
    K -->|Backprop| G1
    
    L[Skills MCP Server] -.->|Injects Instructions| G1
```

### The Orchestrator
The executive controller. It does **not** write application code. Its role is purely analytical:
- It interrogates the user to eradicate ambiguity.
- It designs the architecture and documents decisions.
- It generates the execution DAG, piping it strictly through `write_dag.sh`.
- It is shielded from raw execution logs to protect its context window.

### The Stateless Workers
The motor system. Spawned by the DAG Runner via CLI.
- They are completely "dumb" and amnesic. They don't know the full architecture; they only know their specific task and the files they are allowed to touch.
- This creates the **Financial Firewall**: executing complex features is exponentially cheaper because workers only load the exact tokens they need for their atomic task.

### The DAG Runner (`dag_runner.py`)
The asynchronous Python engine that parses the `.specs/dags/*.json` table.
- Dispatches workers in parallel based on task dependencies.
- Handles the Auto-Healing Loop (feeding errors back to the worker).
- Runs the Auditor for verification.

### The Independent Auditor (`auditor.py`)
The gatekeeper. It executes the `Done When` command defined in the JSON DAG.
- **Mechanical Tasks:** Runs standard test commands (e.g., `npm test`).
- **Architectural Tasks:** Uses a Zero-Context LLM judge to verify if the code adheres to the systemic rules, without reading the full specification.

### Dynamic Skill Injection (`dag-flow-skills` MCP Server)
A core innovation of `dag-flow` is **dynamic specialization**. Stateless workers are deliberately "dumb" by default to save tokens. However, the Orchestrator identifies the specific technical domains required for each atomic task.

When the DAG Runner dispatches a worker, the worker first queries the local **Skills MCP Server**. If the task involves modifying a Chrome Extension, the worker injects the `chrome-extensions` skill. If it involves complex modern CSS, it injects `modern-web-guidance`. 
This guarantees that the worker has Senior-level expertise *exactly tailored to its specific challenge*, without bloating the Orchestrator's context window.

### Topology Separation & OS-Level Gating
A core philosophy of `dag-flow` is that **prompt instructions are insufficient to contain large LLMs**. Due to "Semantic Gravity" and pretraining bias, large models inevitably ignore instructions like "You MUST output a 9-column table" or "Do NOT write to this folder".
To combat this Overconfidence, `dag-flow` relies on **physical OS-level boundaries**. 
- **Topology Separation:** Human-readable specifications are stored in open directories (`.specs/features/`), completely isolated from executable graphs.
- **Physical Lock:** Executable JSON DAGs are stored in a physically locked directory (`.specs/dags/` set to `chmod 555`). 
- **The Interceptor Gate:** The Orchestrator is forbidden and unable to write to the locked directory. It must pipe its output through `scripts/write_dag.sh`, an interceptor that validates the JSON schema before elevating permissions and saving it. If the model hallucinates the format, the script errors, forcing a structural contradiction and self-correction.

---

## 2. The Core Pipeline & Operations

The architecture separates the core feature development pipeline from standalone administrative and emergency operations.

### The Core Feature Pipeline
The pipeline flows through 4 distinct sequential phases:

1. **Specify (The Eradicator):** Executed via the **Two-Phase Common Ground Flow**. The Orchestrator halts to surface assumptions into `common_ground.md`, forces a human Turn Break for approval, and only then steers the generation of `spec.md` and `CONTEXT.md`.
2. **Design (The Architect):** Identifies trade-offs, defines infrastructure, and generates Architecture Decision Records (`docs/adr/`).
3. **Tasks (The Engineer):** Converts the Spec and Design into the executable Directed Acyclic Graph, piping it through `write_dag.sh`.
4. **Execute (The Factory Floor):** The decentralized execution phase where `dag_runner.py` takes over and coordinates the Workers and Auditor concurrently.

### Standalone Operations
These are executed independently of the core pipeline.

- **Discovery (The Context Discoverer):** A manual initialization operation. Synthesizes the system's baseline architecture into `CONTEXT.md` (for brownfield projects). Not part of the feature pipeline.
- **Quick Mode (The Emergency Flow):** A streamlined diagnostic operation for hotfixes. Completely bypasses the Specify/Design ceremony to generate a Mini-DAG.

---

## 3. The Memory Architecture

`dag-flow` treats memory as files on disk rather than ephemeral LLM chat history. Memory is strictly divided into two categories:

### ⏳ Transactional Memory (The Action)
Stored in `.specs/features/*/`. Includes `spec.md` and `design.md`. The executable DAG itself is locked in `.specs/dags/`.
These are operational drafts. Once the DAG Runner completes the feature, these artifacts lose their active utility. The system deliberately ignores them in future interactions to prevent context exhaustion.

### 💎 Perennial Memory (The Law)
Stored at the root (`CONTEXT.md`) and in `docs/adr/`.
This is the system's eternal jurisprudence. 
- `CONTEXT.md` explicitly defines the domain language and forbids synonyms.
- `ADRs` record why architectural choices were made.
These files survive forever. The Orchestrator references them in all future sessions to ensure new features don't violate past rules.

---

## 4. Living Memory (The Delta Update Synergy)

A common flaw in agentic coding is the need to constantly re-scan the entire codebase to understand the current state. This burns massive amounts of tokens and degrades the LLM's reasoning due to context window saturation.

`dag-flow` solves this via the **Living Memory ecosystem**, powered by physical files and `context-mode`:

1. **The Discovery Phase (Initialization):** On explicit user request only, the Orchestrator does not read every file natively. Dense indexing is handled out-of-band by `context-mode` (user-installed prerequisite). The Orchestrator uses `ctx_search` to surgically query the pre-populated FTS5 index, synthesizing highly compressed Architectural Invariants into `CONTEXT.md`.
2. **The T-Final Task (Delta Update):** When the Orchestrator generates the JSON DAG, it injects a final task at the end (`T-Final`). Because the Orchestrator just planned the feature, it knows *exactly* which files will be modified by the workers. 
3. **The Silent Sync:** Once the workers finish, the `T-Final` task instructs the indexer to update *only* those specific modified files. 

The system memory stays perfectly synchronized with the architecture in real-time, achieving an evolving, living memory with near-zero token waste.

---

## 5. Quick Mode (The Emergency Flow)

While the full Governance loop (Discovery -> Specify -> Design -> Tasks) provides mathematical certainty, it is too heavy for emergency hotfixes. 

**Quick Mode** is a dedicated architectural pathway designed for rapid response:
- **Diagnostic Bypass:** It completely bypasses the Specification and Design ceremonies.
- **The Mini-DAG:** The Orchestrator diagnoses the bug directly and pipes a streamlined DAG containing only the immediate fix and the Auditor test to the `write_dag.sh` gate.
- **In-Code Accountability:** Because there is no formal `spec.md` generated, Quick Mode workers are subject to a strict rule: they *must* leave a mandatory in-code comment explaining the rationale of the hotfix.

This ensures that even when the system moves fast, it never compromises architectural traceability.

---

## 6. Architecture Decision Records

ADRs capture *why* architectural choices were made. They live in [`docs/adr/`](../adr/) and are referenced by the Orchestrator alongside `CONTEXT.md`.

### Epoch 1 — Core Architecture (0001–0009)

| ADR | Title | Summary |
|:---|:---|:---|
| [0001](../adr/0001-intentional-manual-execution.md) | Intentional Manual Execution | The human runs `run_dag.sh`; the Orchestrator does not auto-execute workers. |
| [0002](../adr/0002-offload-global-indexing-to-hook.md) | Offload Global Indexing | Discovery indexing is out-of-band via `context-mode`, not mass native file reads. |
| [0003](../adr/0003-worker-unsandboxed-cli-execution.md) | Unsandboxed CLI Execution | Workers run via real CLI subprocesses with runtime-specific permission flags. |
| [0004](../adr/0004-counted-pagrl-anti-overconfidence-gate.md) | Counted PAGRL Gate | PAGRL XML validation blocks overconfident Orchestrator output before vault commit. |
| [0005](../adr/0005-os-level-gating-and-topology-separation.md) | OS-Level Gating | Physical `chmod` boundaries and Bash gates prevent LLM vault hallucination. |
| [0006](../adr/0006-staging-area-and-subagent-relay.md) | Staging Area & Subagent Relay | Drafts in `.specs/staging/`; DAG planning delegated to a read-only subagent. |
| [0007](../adr/0007-deprecate-agentmemory.md) | Deprecate agentmemory | Replaced by file-based perennial memory (`CONTEXT.md`, ADRs). |
| [0008](../adr/0008-cognitive-hardening-and-json-dag.md) | Cognitive Hardening & JSON DAG | Executable vault uses JSON AST DAGs, not markdown tables. |
| [0009](../adr/0009-two-phase-common-ground-flow.md) | Two-Phase Common Ground | Surface & Steer specify flow with mandatory human turn break. |

### Epoch 2 — Multi-Runtime V1 (0010–0017)

| ADR | Title | Summary |
|:---|:---|:---|
| [0010](../adr/0010-dag-flow-hook-guard-router.md) | dag-flow Hook (Guard + Router) | Guard blocks non-worker writes; Router classifies Quick Mode vs Specify. |
| [0011](../adr/0011-dual-manifest-compilation.md) | Dual Manifest Compilation | Category A placeholders from worker manifest; B/C from orchestrator. |
| [0012](../adr/0012-pending-dag-guard.md) | Pending DAG Guard | `dag update` aborts when vault DAGs have non-Done tasks (including Failed). |
| [0013](../adr/0013-manifest-inheritance.md) | Manifest Inheritance | `extends` deep-merge with cycle detection for custom runtimes. |
| [0014](../adr/0014-orchestrator-worker-split.md) | Orchestrator / Worker Split | `--worker` flag; `dag-config.json` records both runtime IDs. |
| [0015](../adr/0015-compiled-skill-scripts-whitelist.md) | Compiled Skill Scripts Whitelist | Only operational scripts ship in the installed skill. |
| [0016](../adr/0016-v1-runtime-scope.md) | V1 Runtime Scope | Built-ins: `antigravity` + `cursor`; `claude` deferred. New built-ins: [implementation guide](../guides/new-runtime-implementation-guide.md). |
| [0017](../adr/0017-per-runtime-worker-permission-flags.md) | Per-Runtime Permission Flags | `agy --dangerously-skip-permissions` vs Cursor `--trust --force --approve-mcps`. |
