# Specification: DAG Validator Gate & Topology Separation

## Background
Benchmark e2e-0.1.0 (Scenario 3) failed because the Orchestrator hallucinated the DAG table format. Following ADR-0004's escalation path, a physical "shell-level gate" is required to intercept and validate DAG writes.

## Requirements
1. **Physical Block**: The Orchestrator must be physically prevented from using standard text-editing tools (`write_to_file`) to create or modify DAG tables.
2. **Topology Separation**:
   - `spec.md` and `design.md` remain in `.specs/features/[feature]/` (open permissions).
   - DAG tables move to a dedicated directory `.specs/dags/` which is permanently locked to read-only (`chmod 555`) in the repository.
3. **DAG Validator Gate**:
   - A dedicated shell script (`scripts/write_dag.sh`) must be introduced as the sole mechanism to write to `.specs/dags/`.
   - The script temporarily elevates permissions (`chmod 755`), validates the incoming Markdown via `stdin`, writes the file, and restores lock (`chmod 555`).
   - Validation must ensure exactly 9 columns, presence of the `T-Final` task, and presence of the `--dangerously-skip-permissions` flag.
4. **Tool Revocation**:
   - The Orchestrator guidelines (`references/tasks.md` and `SKILL.md`) must explicitly document the `.specs/dags/` path and the use of the `write_dag.sh` wrapper.
   - Counted PAGRL schema must be updated to force the model to declare the write tool.
5. **Satellite Script Updates**:
   - Benchmark harnesses, `run_dag.sh`, and `auditor.sh` must be updated to source the DAG table from `.specs/dags/[feature].md` instead of `.specs/features/[feature]/tasks.md`.
