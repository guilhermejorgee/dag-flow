# 1. Intentional Manual Execution

Date: 2026-06-08

## Status

Accepted

## Context

We evaluated a proposal (`docs/design/implement-with-context-mode.md`) to achieve "Level 5 Autonomy" by having the Orchestrator autonomously run the DAG execution script (`run_dag.sh`) using the `context-mode` MCP sandbox (`ctx_execute`). 
While this approach successfully shields the Orchestrator's context window from terminal noise, it introduces a severe flaw: all execution logs and real-time streaming are hidden inside the sandbox. The user is left completely blind to the progress of the worker agents and the auto-healing loops.

## Decision

We intentionally REJECTED autonomous execution via `context-mode`. 
The DAG execution MUST remain a manual step. The Orchestrator must generate the `.md` specification and then explicitly instruct the user to run the execution script in their own visible terminal.

## Consequences

- **Positive:** Developer Experience (DX) is preserved. Real-time observability allows the user to trust the process, monitor progress, and intervene if a worker enters a destructive or infinite loop.
- **Negative:** The framework remains at "Level 4 Autonomy", requiring a manual human action to bridge the planning phase and the execution phase.
