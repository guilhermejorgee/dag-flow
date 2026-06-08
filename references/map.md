# dag-flow: Map Phase (The Context Cartographer)

The **Map Phase** is the foundational prerequisite of dag-flow in brownfield (existing) projects. It ensures the Orchestrator has an accurate, token-efficient understanding of the codebase's existing architecture, sub-contexts, and invariants before any feature specification begins.

## Trigger

**Automatic.** The Orchestrator MUST perform a Pre-Action Governance Reasoning Loop (PAGRL) at the very start of any session or the Specify Phase. 
It queries `agentmemory` for the project's architectural map. If no map exists (indicating it's blind to the project's state), the Map Phase is triggered automatically, halting user interaction until the cartography is complete.

## Core Mechanics

### 1. The Sandbox Crawler (`ctx_execute`)
The Orchestrator does NOT read source code files directly into its context window. Instead, it writes a pure JavaScript script (using Node.js `fs` and `path`) and executes it via `context-mode`'s `ctx_execute`. 

Because modern projects are often monorepos containing varied stacks (code, IaC, docs) and architectures (Hexagonal, MVC, scripts), the crawler acts as a recursive boundary detector:
- **Find Sub-Contexts:** Scans the directory tree (ignoring `.git`, `node_modules`, `dist`, etc.) for local boundary markers like `package.json`, `Cargo.toml`, `terraform/`, or isolated `docs/` folders.
- **Detect Architectural Signatures:** Within each boundary, it looks for structural patterns (e.g., `domain/`, `application/`, `infrastructure/` indicates Hexagonal architecture; `controllers/`, `views/` indicates MVC).

### 2. Output Routing (The Token Economy)
To remain financially viable and protect the context window, the crawler's output is split into two distinct storage layers:

- **High-Level State (`agentmemory`):** The Orchestrator saves the "Context Map" (which sub-projects exist, their inferred architectures, and core invariants) into persistent memory. This also acts as the flag that prevents the Map Phase from running again unnecessarily.
- **Dense Mapping (`ctx_index`):** The heavy, file-by-file dependency graphs, module boundaries, and exported interfaces are sent directly to the local FTS5 database via `ctx_index`. The Orchestrator can later retrieve specific parts of this map using `ctx_search` when needed.

### 3. Focus on Invariants
The ultimate goal of the Map Phase is to identify what *cannot change*. By establishing the architectural rules of the existing codebase, the Orchestrator ensures that new specifications (during the Specify Phase) do not violate the system's established structural integrity.

### 4. Continuous Cartography (Living Memory via Delta Updates)
The project map must not rot as new code is written, but full codebase re-scans are a catastrophic token waste. To guarantee continuity efficiently, the Map Phase uses **Delta Updates**:
- During Phase 4 (Tasks), the Orchestrator automatically injects a final `T-Final` task into the DAG (`tasks.md`).
- Because the Orchestrator just designed the feature, it knows exactly what changed. It writes a hyper-specific Delta prompt (e.g., *"Index ONLY the new src/billing folder into context-mode, and add 'Billing' to agentmemory invariants."*).
- This approach guarantees the memory stays perfectly in sync with the Orchestrator's architectural intent, while burning near-zero tokens by avoiding full codebase crawls.

## Exit Condition
The Map phase concludes when `agentmemory` is populated with the high-level Context Map and the detailed structural data is indexed in `context-mode`. The system then automatically advances to (or resumes) the **Specify Phase**.
