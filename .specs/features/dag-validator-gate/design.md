# Design: DAG Validator Gate & Topology Separation

## Solution Components
- **OS Permission Trap**: `.specs/dags/` initialized with `chmod 555`.
- **Validation Wrapper**: `scripts/write_dag.sh` taking Markdown from `stdin`.
- **Reference Updates**: Changes to `SKILL.md` and `references/tasks.md` to document the trap and the wrapper.

## Patterns Reused
N/A - This introduces a new OS-level gating pattern not previously used in dag-flow orchestration.

## New Patterns Introduced
- **Shell-level Gate**: Using OS permissions (`chmod 555` -> `755` -> `555`) to enforce tool usage.
- **Topology Separation**: Splitting executable artifacts (DAGs) from free-text artifacts (Specs).

## Cross-Cutting Concerns
- Error Handling: `write_dag.sh` must return non-zero exit codes with actionable lint errors so the Orchestrator can auto-correct.

## ADRs Required
- `0005-os-level-gating-and-topology-separation`

## Confidence
High. The physical lock makes bypass impossible without explicit, logged malicious intent (running chmod directly), which is easily audited.
