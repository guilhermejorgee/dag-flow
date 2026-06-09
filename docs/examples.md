# dag-flow Examples

To understand the strict separation of concerns in `dag-flow`, it helps to see the exact timeline of artifacts generated during different scenarios.

---

## Example 1: New Feature (Shopping Cart)

Here is a timeline of how `dag-flow` handles a request to build a new feature.

### 1. The Specify Phase (What are we building?)
**User:** *"Specify a new feature: a shopping cart."*

The Orchestrator uses Socratic Interrogation focused purely on business rules: *"Does the cart expire? What do we call the items?"*

**Artifacts Generated:**
- The Orchestrator updates the ubiquitous dictionary (`CONTEXT.md`) with the new nomenclature.
- The business rules are consolidated into `.specs/features/cart/spec.md`.
*(Note: No technical decisions have been made yet, and no code has been written).*

### 2. The Bypass Check (PAGRL Transition)
The Orchestrator pauses to run the internal PAGRL check: *"Does this business rule require new infrastructure?"*
- If the cart is just local state in the UI, it bypasses the Design Phase.
- Because the cart needs to persist across devices but requires low latency, it advances to Design.

### 3. The Design Phase (How are we building it?)
The Orchestrator makes a technical proposition: *"I propose using Redis instead of the primary SQL database to maintain low latency for UI interactions."*

**Artifacts Generated:**
- The Orchestrator detects the critical trade-off (latency vs volatility) and generates `docs/adr/0004-redis-cart-store.md`.
- The technical blueprint is saved to `.specs/features/cart/design.md`.

### 4. The Tasks Phase (The Execution Order)
The Orchestrator translates the `spec.md` and `design.md` into an executable Directed Acyclic Graph (DAG). 

**Artifacts Generated:**
- `.specs/features/cart/tasks.md`

To ensure **Systemic Traceability**, the Orchestrator fills the `Context Ref` column for every task. This blind-proofs the process: the worker doesn't need to read the full specification; it only reads the summarized rule for its atomic task. 
The Orchestrator also injects `T-Final` (the Delta Update) to map the new files back into the system's memory.

---

## Example 2: The Emergency Flow (Quick Mode / Hotfix)

When a critical bug appears, the heavy ceremony of Spec and Design is bypassed, but the execution safety is retained.

**User:** *"Quick Mode: Fix the login bug that fails with a timeout."*

### 1. The Diagnosis Phase
The Orchestrator uses PAGRL to isolate the failure without touching the code.

**Artifacts Generated:**
- `.specs/hotfixes/login-timeout.md` is generated, containing a brief diagnosis and a simplified, sequential Mini-DAG.

### 2. The Execution Phase
The user manually invokes the DAG runner:
```bash
./scripts/run_dag.sh .specs/hotfixes/login-timeout.md
```

The stateless worker fixes the bug in the source code. Because it is Quick Mode, the worker is instructed to insert a **mandatory in-code comment** explaining the rationale of the fix for future developers (since there is no formal `spec.md`).

### 3. Living Memory Sync
The final task of the Mini-DAG (`T-Final`) runs silently. The local vector database (`context-mode`) ingests the modified code. The Orchestrator's memory is instantly updated for future interactions without requiring a full repository scan.

---

## Example 3: Brownfield Onboarding (The Map Phase)

What happens when a new developer clones an existing `dag-flow` project?

1. The developer clones the repo and runs `./hooks/setup_indexer.sh`.
2. The developer opens their Agent and types: *"Specify a new feature..."*
3. The Orchestrator wakes up. It checks `agentmemory` and realizes it is "blind" (it has no architectural map of the project).
4. **The Map Phase automatically triggers.** The Orchestrator uses the `context-mode` MCP to surgically search the codebase for invariants, `package.json`, and structural boundaries.
5. The Orchestrator populates its `agentmemory` with the discovered Context Map.
6. Only after the mapping is complete does it respond to the user: *"Map complete. Now, regarding your feature..."*

This guarantees perfectly synchronized team onboarding without human intervention.
