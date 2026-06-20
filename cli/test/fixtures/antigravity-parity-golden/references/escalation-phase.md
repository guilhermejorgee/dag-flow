# dag-flow: Escalation Phase (Double Verification)

The Escalation Phase is triggered when a worker task fails repeatedly (reaches the maximum of 3 attempts) under the Python concurrent execution model.

## Concurrent Execution & Parallel Error Handling

The DAG runner (`dag_runner.py`) executes tasks concurrently, dispatching independent tasks to parallel workers (controlled by `DAG_FLOW_MAX_WORKERS`, defaulting to 3). This concurrent architecture implements specific parallel error handling and logging behaviors:

### 1. Parallel Log Locations
* Every task execution writes its outputs and Auditor checks to its own isolated log file.
* Log path: `.specs/runs/[ID]/logs/[Task_ID].log`
* Because multiple tasks run in parallel, logs are updated concurrently. Each task's complete execution trace (including attempts and Auditor results) is kept clean and isolated within its designated file.

### 2. Drain-Running Mechanism
* If any task fails completely (exhausts 3 attempts), it triggers **Drain-running** by setting a cancellation event.
* **No New Dispatches:** The runner stops dispatching new tasks from the dependency queue.
* **Active Tasks Drain:** Already executing/active tasks are permitted to run to completion (either succeeding or failing) so they do not leave the system in an inconsistent or undefined state.
* **Abort:** Once all active tasks finish, the DAG execution terminates with a non-zero exit code.

### 3. Multiple Concurrently Failed Tasks
* During the drain phase, other active tasks might also fail. Each failing task will produce its own `.specs/runs/[ID]/logs/[Task_ID].log` file containing its error trace.
* The Orchestrator must address each failed task individually or sequentially using the double-verification protocol.

This protocol ensures we recover from failures without violating the **Intentional Manual Execution** rule (ADR-0001).

## The Protocol

1. **Failure Report:** When the User reports one or more failures, the Orchestrator reads the corresponding `.specs/runs/[ID]/logs/[Task_ID].log` isolated log file(s) to locate the root causes.
2. **Diagnosis & Planning:** For each failed task, the Orchestrator initiates Quick Mode (writing entry and diagnosis XMLs to `.specs/staging/`) and generates a Mini-DAG targeting the issue, vaulted via `<path-to-skill>/scripts/write_dag.sh <task-id> --phase quick-mode`.
3. **Hotfix Execution:** Orchestrator instructs the **User** to run `<path-to-skill>/<path-to-skill>/scripts/run_dag.sh .specs/dags/<task-id>.json`.
4. **Hotfix Completion:** User reports that the hotfix DAG ran successfully.
5. **Double Verify:** Orchestrator instructs the **User** to directly run `python3 <path-to-skill>/<path-to-skill>/scripts/auditor.py <Task_ID> .specs/runs/[ID]/dag.json` to manually verify the hotfix against the main DAG's gate.
6. **Resolution:**
   - **If PASS:** Orchestrator explicitly updates the main task's status to `Done` by executing `python3 <path-to-skill>/<path-to-skill>/scripts/update_task_status.py .specs/runs/[ID]/dag.json <Task_ID> Done` using the `run_command` tool, then instructs the **User** to resume `<path-to-skill>/<path-to-skill>/scripts/run_dag.sh .specs/runs/[ID]/dag.json`.
   - **If FAIL:** Orchestrator reads the new error from the user, wipes the old Mini-DAG, and generates a new Mini-DAG to continue fixing the issue.

