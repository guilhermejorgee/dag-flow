# Escalation Phase Architecture

This plan resolves the architectural gap identified in `research/recovery-escalation-gap.md` (how the AI Orchestrator recovers when a task fails) while strictly adhering to `docs/adr/0001-intentional-manual-execution.md` (which mandates that all execution must be triggered manually by the user to preserve observability and trust). 

By combining these two constraints, this protocol establishes a "Double Verification" strategy using isolated Quick Mode Mini-DAGs, where the Orchestrator plans the recovery and the User manually executes both the hotfix scripts and the final auditor validations.

## User Review Required

Please review the proposed workflow for the Orchestrator and the changes to the shell scripts. Confirm if the `last_failure.log` path logic makes sense.

## Proposed Changes

### 1. Script Infrastructure

We will update the bash scripts to support the new handoff and double verification mechanics.

#### [MODIFY] [run_dag.sh](file:///home/guilherme/%C3%81rea%20de%20trabalho/Repos/dag-flow/scripts/run_dag.sh)
- **Error Handoff**: When a task fails after 3 attempts, instead of just exiting, the script will write the final `LAST_ERROR` to `$(dirname "$TASKS_FILE")/last_failure.log`.
- **User Guidance**: Add an `echo` statement right before the script exits, explicitly telling the user where the error log is located (e.g., `echo "🚨 Error logged to $(dirname "$TASKS_FILE")/last_failure.log. Show this path to the Orchestrator."`).
- **Pass Context**: Update the call to `auditor.sh` to explicitly pass the `TASKS_FILE` path as the second argument, ensuring it works for both main features and hotfixes.

#### [MODIFY] [auditor.sh](file:///home/guilherme/%C3%81rea%20de%20trabalho/Repos/dag-flow/scripts/auditor.sh)
- **Dynamic File Path**: Remove the hardcoded `.specs/features/*/tasks.md` glob. Accept `TASKS_FILE` as `$2`.

### 2. Orchestrator Protocol Documentation

We will update the AI's instructions to officially document this workflow.

#### [MODIFY] [SKILL.md](file:///home/guilherme/Área de trabalho/Repos/dag-flow/SKILL.md)
- Update Phase 6 (Execute) to add a trigger rule: "If the user reports a DAG failure, read `last_failure.log` and read `references/escalation-phase.md` to initiate the recovery protocol."

#### [NEW] [escalation-phase.md](file:///home/guilherme/%C3%81rea%20de%20trabalho/Repos/dag-flow/references/escalation-phase.md)
Document the official protocol:
1. When the User reports a failure, the Orchestrator reads `last_failure.log` in that directory.
2. Orchestrator generates a Quick Mode Mini-DAG (`.specs/hotfixes/<task-id>/tasks.md`) to fix the specific error.
3. Orchestrator instructs the **User** to run `./scripts/run_dag.sh <hotfix-tasks.md>`.
4. User reports success.
5. **Double Verify:** Orchestrator instructs the **User** to run `./scripts/auditor.sh <Task-ID> <main-tasks.md>` directly to manually verify the hotfix against the main gate.
6. User reports the result.
   - If PASS: Orchestrator marks main task `Done` in `tasks.md` and instructs the **User** to resume `./scripts/run_dag.sh <main-tasks.md>`.
   - If FAIL: Orchestrator reads the new error from the user, wipes the old Mini-DAG, and generates a new one.

#### [MODIFY] [recovery-escalation-gap.md](file:///home/guilherme/%C3%81rea%20de%20trabalho/Repos/dag-flow/research/recovery-escalation-gap.md)
- Update to reflect that the gap has been resolved and point to `escalation-phase.md`.

## Verification Plan

### Manual Verification
1. Introduce an intentional failure in a dummy `tasks.md` to trigger the `last_failure.log` generation.
2. Run `auditor.sh` manually on a Mini-DAG format and a main DAG format to ensure the `Done When` column is extracted correctly regardless of spacing.
