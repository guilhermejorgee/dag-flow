# Offload Global Indexing to Hook or Session Rule

We decided to remove the responsibility of global repository indexing from the Orchestrator's Map phase and offload it to a pre-boot `dag-flow` hook (or a mandatory session initialization rule for agent runtimes like Antigravity that lack native hook support). This prevents the LLM from hallucinating file reads or exhausting its context window on large codebases, ensuring `context-mode` FTS5 is populated incrementally before the Orchestrator even starts, leaving the Map phase strictly for Task Context Discovery.
