# SDD V2: Quick Mode (Bug Fixes & Hot-Patches)

Quick Mode bypasses the extensive Spec and Design phases for immediate diagnostic and patching scenarios, while strictly retaining the architectural separation of concerns (PAGRL and automated delegated execution).

## Trigger
"Fix bug X", "Hot-patch issue Y", "Quick mode: Z"

## The Process

### 1. Diagnosis (PAGRL)
Even in an emergency, the Orchestrator NEVER directly edits functional code. Use the Pre-Action Governance Reasoning Loop (PAGRL) to formulate the hypothesis.

```xml
<PAGRL>
<Intention>Diagnose bug X</Intention>
<Rules>Read-only access to source code. Do not write fixes directly.</Rules>
<Reasoning>Evaluate stack trace, logs, and affected files to identify the root cause.</Reasoning>
<Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>
```

### 2. Mini-DAG Generation
Generate a simplified, sequential table. Unlike the full `tasks.md` process, a Mini-DAG typically represents a linear sequence of atomic fixes.

**Output to `.specs/hotfixes/[issue_id].md`:**
1. **Diagnosis Summary:** Brief explanation of the root cause.
2. **Mini-DAG Table:**
   `ID | Description | Input Files | Output Files | Done When (Verification Gate) | Status`

*Note on Tokens (Financial Firewall):* Be extremely precise with `Input Files`. The automated runner will inject only these files into the stateless worker to save tokens.

### 3. Execution & Auto-Healing
The Orchestrator's job concludes with the generation of the Mini-DAG. Instruct the user to run the automated script:

```bash
./dag-flow/v2/scripts/run_dag.sh .specs/hotfixes/[issue_id].md
```

The bash script takes over, spawning stateless workers, running the verification gates, and auto-healing any failures via terminal loops without polluting the Orchestrator's context window.
