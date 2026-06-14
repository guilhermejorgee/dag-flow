# dag-flow: Escalation Phase (Double Verification)

The Escalation Phase is triggered when a worker task fails repeatedly (e.g., after 3 attempts) and the `run_dag.sh` script halts, producing a `last_failure.log` file. 

This protocol ensures we recover from failures without violating the **Intentional Manual Execution** rule (ADR-0001).

## The Protocol

1. **Failure Report:** When the User reports a failure, the Orchestrator reads the `last_failure.log` in the directory provided by the User.
2. **Diagnosis & Planning:** Orchestrator initiates Quick Mode (writing entry and diagnosis XMLs to `.specs/staging/`) and generates a Mini-DAG targeting the issue, vaulted via `scripts/write_dag.sh <task-id> --phase quick-mode`.
3. **Hotfix Execution:** Orchestrator instructs the **User** to run `<path-to-skill>/scripts/run_dag.sh .specs/dags/<task-id>.md`.
4. **Hotfix Completion:** User reports that the hotfix DAG ran successfully.
5. **Double Verify:** Orchestrator instructs the **User** to directly run `<path-to-skill>/scripts/auditor.sh <Task-ID> <main-tasks.md>` to manually verify the hotfix against the main DAG's gate.
6. **Resolution:**
   - **If PASS:** Orchestrator explicitly updates the main task's status to `Done` by executing `scripts/update_task_status.sh <main-tasks.md> <Task-ID> Done` using the `run_command` tool, then instructs the **User** to resume `<path-to-skill>/scripts/run_dag.sh <main-tasks.md>`.
   - **If FAIL:** Orchestrator reads the new error from the user, wipes the old Mini-DAG, and generates a new Mini-DAG to continue fixing the issue.
