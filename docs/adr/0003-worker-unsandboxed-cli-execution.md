---
status: accepted
---

# Unsandboxed CLI Execution for Workers

We decided to replace all agent CLI invocations (workers in `run_dag.sh`, plus Auditor and `T-Final` tasks in DAG templates) from `gemini` to `agy --dangerously-skip-permissions` to allow stateless execution to autonomously interact with local MCP servers.

**Context:** The workers need to use the `dag-flow-skills` MCP server to fetch skills during task execution. Similarly, the Independent Auditor and `T-Final` (Living Memory Delta Update) tasks require autonomous execution of tools like `ctx_index` and `memory_save`. Switching to `agy` with the `--dangerously-skip-permissions` flag bypasses all sandbox restrictions, allowing the agents to call MCP tools and execute shell scripts without human interaction.

**Consequences:** While this enables fully autonomous skill execution for workers, it breaks the principle of least privilege. A hallucinated worker or a compromised/malicious local skill could theoretically execute arbitrary shell commands or access the file system unrestricted. We accept this trade-off in favor of automation, relying on the Orchestrator's precise task generation to constrain worker behavior.
