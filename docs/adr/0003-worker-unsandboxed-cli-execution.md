---
status: accepted
---

# Unsandboxed CLI Execution for Workers

We decided to replace the worker CLI invocation in `run_dag.sh` from `gemini --approval-mode auto_edit` to `agy --dangerously-skip-permissions` to allow stateless workers to autonomously interact with local MCP servers.

**Context:** The workers need to use the `dag-flow-skills` MCP server to fetch skills during task execution. The previous `gemini` CLI invoked a sandbox mode (`auto_edit` still required permissions for certain actions). Switching to `agy` with the `--dangerously-skip-permissions` flag bypasses all sandbox restrictions, allowing the worker to call MCP tools and execute shell scripts fetched from skills without human interaction.

**Consequences:** While this enables fully autonomous skill execution for workers, it breaks the principle of least privilege. A hallucinated worker or a compromised/malicious local skill could theoretically execute arbitrary shell commands or access the file system unrestricted. We accept this trade-off in favor of automation, relying on the Orchestrator's precise task generation to constrain worker behavior.
