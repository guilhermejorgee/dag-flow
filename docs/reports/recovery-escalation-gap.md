# Gap Analysis: Recovery and Escalation in dag-flow

## The Context
During a `grill-with-docs` session, we identified a critical architectural gap in the `dag-flow` framework regarding how failures are handled after the automated execution phase.

Currently, the `scripts/run_dag.sh` script handles "Level 1 Auto-Healing" (retrying failing tasks up to 3 times by spawning stateless Gemini CLI workers). If a task fails 3 times, the script correctly changes the task status in `tasks.md` to `Failed`, halts execution, and prints the final error to the user's terminal.

## The Gap (The Problem)
While the bash script successfully halts and records the failure, the framework completely lacks a defined **Level 2 Escalation Protocol** for the Orchestrator. 

1. **Blindness:** The Orchestrator (the AI agent) runs independently of the user's manual terminal. When the script fails, the Orchestrator is completely blind to the failure. There is no automated hook to feed the terminal error back into the Orchestrator's context.
2. **Lack of Instructions:** `SKILL.md` and the `references/` documentation define 6 distinct phases (Map, Specify, Design, Tasks, Execute, Quick Mode). There is NO documentation instructing the Orchestrator on what to do during a failure scenario.
3. **Unpredictable Behavior:** Without strict instructions, if a user simply says "Task 3 failed", a generic LLM Orchestrator will hallucinate or deduce a recovery process (e.g., arbitrarily editing `tasks.md` or rewriting code directly, which would violate the Shadow LLM restrictions).

## Resolution
This gap was resolved during a `grill-with-docs` session by implementing a **Double Verification** strategy using the Quick Mode Mini-DAGs. 
The official Escalation Phase protocol is now fully documented in `references/escalation-phase.md`.
