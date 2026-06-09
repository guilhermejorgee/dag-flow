# dag-flow: Map Phase (The Context Cartographer)

The **Map Phase** is the foundational prerequisite of dag-flow in brownfield (existing) projects. It ensures the Orchestrator has an accurate, token-efficient understanding of the codebase's existing architecture, sub-contexts, and invariants before any feature specification begins.

## Trigger

**Automatic.** The Orchestrator MUST perform a Pre-Action Governance Reasoning Loop (PAGRL) at the very start of any session or the Specify Phase. 
It queries `agentmemory` for the project's architectural map. If no map exists (indicating it's blind to the project's state), the Map Phase is triggered automatically, halting user interaction until the cartography is complete.

## Core Mechanics

### 1. Task Context Discovery (`ctx_search`)
The Orchestrator does NOT crawl or read source code files natively. Instead, it relies on the **Global Indexing Hook** (installed via `scripts/setup_indexer.sh`), which populates the `context-mode` FTS5 database before the session even starts. 

The Orchestrator's job during the Map Phase is purely surgical discovery. It uses `ctx_search` to query the pre-populated FTS5 index for architectural markers (like `package.json`, `Cargo.toml`, `terraform/`, or structural patterns like `domain/`, `controllers/`).

### 2. Output Routing (The Token Economy)
To remain financially viable and protect the context window, the Map Phase consolidates its findings into persistent storage:

- **High-Level State (`agentmemory`):** The Orchestrator synthesizes its search results into a "Context Map" (which sub-projects exist, their inferred architectures, and core invariants) and saves it into persistent memory. This acts as the flag that prevents the Map Phase from running again unnecessarily.
- **Dense Mapping:** (Already handled out-of-band by the pre-boot hook using `ctx_index`, keeping the Orchestrator's context window pristine).

### 3. Focus on Invariants
The ultimate goal of the Map Phase is to identify what *cannot change*. By establishing the architectural rules of the existing codebase, the Orchestrator ensures that new specifications (during the Specify Phase) do not violate the system's established structural integrity.

### 4. Continuous Cartography (Living Memory via Delta Updates)
The project map must not rot as new code is written, but full codebase re-scans are a catastrophic token waste. To guarantee continuity efficiently, the Map Phase uses **Delta Updates**:
- During Phase 4 (Tasks), the Orchestrator automatically injects a final `T-Final` task into the DAG (`tasks.md`).
- Because the Orchestrator just designed the feature, it knows exactly what changed. It writes a hyper-specific Delta prompt (e.g., *"Index ONLY the new src/billing folder into context-mode, and add 'Billing' to agentmemory invariants."*).
- This approach guarantees the memory stays perfectly in sync with the Orchestrator's architectural intent, while burning near-zero tokens by avoiding full codebase crawls.

## Exit Condition
The Map phase concludes when `agentmemory` is populated with the high-level Context Map and the detailed structural data is indexed in `context-mode`. The system then automatically advances to (or resumes) the **Specify Phase**.
