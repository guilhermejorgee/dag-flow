# dag-flow: Discovery Phase (The Context Discoverer)

The **Discovery Phase** is the foundational prerequisite of dag-flow in brownfield (existing) projects. It ensures the Orchestrator has an accurate, token-efficient understanding of the codebase's existing architecture, sub-contexts, and invariants before any feature specification begins.

## Trigger

**Manual / Explicit.** The user must explicitly request a discovery session (e.g., "Do a discovery of this project" or "Map the architecture"). The Orchestrator does NOT trigger this automatically during the Specify phase.
It queries `agentmemory` (using `memory_recall`) to check for existing Architectural Invariants. If they exist, it updates them. If not, it creates them.

## Core Mechanics

### 1. Task Context Discovery (`ctx_search`)
The Orchestrator does NOT crawl or read source code files natively. Instead, it relies on the **Global Indexing Hook** (installed via `scripts/setup_indexer.sh`), which populates the `context-mode` FTS5 database before the session even starts. 

The Orchestrator's job during the Discovery Phase is purely surgical discovery. It uses `ctx_search` to query the pre-populated FTS5 index for architectural markers (like `package.json`, `Cargo.toml`, `terraform/`, or structural patterns like `domain/`, `controllers/`).

### 2. Output Routing (The Token Economy)
To remain financially viable and protect the context window, the Discovery Phase consolidates its findings into persistent storage:

- **Architectural Invariants (`agentmemory`):** The Orchestrator synthesizes its search results into an architectural map (which sub-projects exist, their inferred architectures, and core invariants) and saves it into persistent memory using the `memory_save` MCP tool. This acts as the flag that prevents the Discovery Phase from running again unnecessarily.
- **Dense Mapping:** (Already handled out-of-band by the pre-boot hook using `ctx_index`, keeping the Orchestrator's context window pristine).

### 3. Focus on Invariants
The ultimate goal of the Discovery Phase is to identify what *cannot change*. By establishing the architectural rules of the existing codebase, the Orchestrator ensures that new specifications (during the Specify Phase) do not violate the system's established structural integrity.

## Exit Condition
The Discovery Phase concludes when `agentmemory` is populated with the synthesized Architectural Invariants via the `memory_save` tool. The operation ends here, awaiting the user's next command.
