# Implement Physical OS-Level Gates & Topology Separation

Following the e2e-0.1.0 benchmark failure, we are enacting Solution (C) from ADR-0004. This implementation will physically lock `.specs/dags/` and route writes through a shell-level validation gate.

## User Review Required
> [!IMPORTANT]
> This plan changes the execution architecture and introduces a new root directory `.specs/dags/`. Please review the scope of script updates to ensure no integrations are missed.

## Open Questions
None. The Socratic discovery resolved all ambiguities via `grill-with-docs`.

## Proposed Changes

### 1. Ubiquitous Language
#### [MODIFY] [CONTEXT.md](file:///home/guilherme/Área de trabalho/Repos/dag-flow/CONTEXT.md)
Added definitions for `DAG Validator Gate` and `Topology Separation`.

### 2. Physical Directories & Boot Hook
#### [NEW] `.specs/dags/`
#### [MODIFY] [scripts/setup_indexer.sh](file:///home/guilherme/Área de trabalho/Repos/dag-flow/scripts/setup_indexer.sh)
Inject `mkdir -p .specs/dags && chmod 555 .specs/dags` into the boot script. This guarantees the physical lock is armed idempotently before any LLM execution, bypassing Git's inability to track folder permissions.

### 3. Shell-Level Gate
#### [NEW] [scripts/write_dag.sh](file:///home/guilherme/Área de trabalho/Repos/dag-flow/scripts/write_dag.sh)
Create the validation script that accepts markdown via stdin, elevates permissions, validates the 9-column schema, `T-Final`, and `--dangerously-skip-permissions`, writes the file to `.specs/dags/`, and restores lock.
**Safety**: Inject `trap 'chmod 555 .specs/dags' EXIT` to guarantee the vault is locked even if the script crashes or is interrupted.

### 4. Orchestrator Memory & Constraints
#### [MODIFY] [SKILL.md](file:///home/guilherme/Área de trabalho/Repos/dag-flow/SKILL.md)
Update guidelines to mention the separation of paths and the restriction on editing `.specs/dags/`.
#### [MODIFY] [references/tasks.md](file:///home/guilherme/Área de trabalho/Repos/dag-flow/references/tasks.md)
Update `ArtifactPath` PAGRL rules and output instructions to use `scripts/write_dag.sh`.
#### [MODIFY] [references/quick-mode.md](file:///home/guilherme/Área de trabalho/Repos/dag-flow/references/quick-mode.md)
Update the Mini-DAG output path instructions.

### 5. Satellite Scripts & Harness
#### [MODIFY] [scripts/run_dag.sh](file:///home/guilherme/Área de trabalho/Repos/dag-flow/scripts/run_dag.sh)
Change default input paths.
#### [MODIFY] [scripts/auditor.sh](file:///home/guilherme/Área de trabalho/Repos/dag-flow/scripts/auditor.sh)
Change artifact lookup paths if applicable.
#### [MODIFY] [evals/*](file:///home/guilherme/Área de trabalho/Repos/dag-flow/evals)
Update all benchmark runner scripts to target `.specs/dags/` when asserting output.

### 6. Architectural Decision Record
#### [NEW] [docs/adr/0005-os-level-gating-and-topology-separation.md](file:///home/guilherme/Área de trabalho/Repos/dag-flow/docs/adr/0005-os-level-gating-and-topology-separation.md)
Record the decision to abandon pure prose orchestration in favor of physical execution trapping.

## Verification Plan
1. **Physical Lock Test:** Run `touch .specs/dags/test.md` as standard user and confirm `Permission denied`.
2. **Gate Validation Test:** Pass a malformed markdown table to `scripts/write_dag.sh` and confirm it exits with code 1 and no file is created.
3. **Happy Path Test:** Pass a valid 9-column table to `scripts/write_dag.sh` and confirm the file is saved correctly.
4. **E2E Benchmark:** Re-run the `e2e-0.1.0` benchmark and confirm all assertions pass.
