# 6. Staging Area and Subagent Relay

Date: 2026-06-13

## Status

Accepted

## Context

Following the implementation of ADR-0005 (OS-Level Gating), the Orchestrator still exhibited "Few-shot ossification" and prompt disobedience. While `.specs/dags/` was locked, the Orchestrator was observed doing three things:
1. Attempting to write directly to `.specs/dags/` despite instructions, causing permission failures.
2. Wrapping the Counted PAGRL XML in unpredictable markdown blocks (e.g. ` ```xml `), which broke simple shell `grep` validators.
3. Polluting the open `.specs/features/` directory by mixing raw XML cognitive traces into the final Markdown artifacts.

We needed a tighter quarantine mechanism to intercept both the XML and the Markdown before they touch the final physical vaults, and a way to physically prevent the Orchestrator from even attempting to write the DAG.

## Decision

We are expanding the physical topology separation and introducing a Subagent Relay:

1. **Double Vaulting**: The `.specs/features/` directory is now locked (`chmod 555`) just like `.specs/dags/`.
2. **Staging Area**: A new `.specs/staging/` directory (`chmod 755`) is introduced. It serves as the sole quarantine drop-zone for the Orchestrator's drafts and XML traces.
3. **Python Regex Gating**: Instead of simple shell checks, we introduced `scripts/validate_pagrl.py` which uses raw string-slicing to extract the `<PAGRL>` block regardless of markdown wrappers. Bash gates (`commit_spec.sh`, `commit_design.sh`, `write_dag.sh`) use this Python script before moving files from staging to the vault.
4. **Subagent Relay**: To prevent the Orchestrator from breaking the `.specs/dags/` lock, the Tasks Phase is now delegated to a stateless `Subagent Planner` spawned with `enable_write_tools=false`. The Subagent generates the table and passes it back via message, and the Orchestrator writes it to staging.

## Consequences

- **Positive**: Complete physical immunity against prompt disobedience. The Orchestrator's cognitive trace is physically segregated from the clean Markdown artifact.
- **Positive**: The Subagent Relay ensures that the entity generating the DAG has absolutely no filesystem write permissions, eliminating rogue writes.
- **Positive**: Python slicing makes the XML validation bulletproof against formatting hallucinations.
- **Negative**: Adds multiple scripts (`commit_spec.sh`, `commit_design.sh`, `validate_pagrl.py`) and introduces a subagent handoff step, increasing the architectural complexity of the DAG-Flow orchestrator.
