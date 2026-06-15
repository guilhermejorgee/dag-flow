# dag-flow: Tasks Phase (The DAG Generator)

## Counted PAGRL (Schema)

PAGRL in the Tasks phase has its own field set, attacking the failure characteristic of this phase: improvising the artifact format (e.g., dumping tasks to the console instead of writing the strict JSON DAG to `.specs/staging/[feature]/dag.json`).

| Field | Type | Why it exists |
|---|---|---|
| `<ReferencesRead>` | comma-separated list | Must include `references/tasks.md`. The benchmark failure where the model dumped to console originated in skipping this reference; declaring it as not-read here is self-incrimination. |
| `<ArtifactPath>` | string | The exact path where the tasks JSON will be written. Must match `.specs/staging/[feature]/dag.json` (or `.specs/staging/[issue_id]/dag.json` for Quick Mode). The literal string `console` is forbidden. |
| `<UncreatedADRs>` | list of `<item>` elements | Lists any ADRs declared in `design.md` that have not yet been physically created in `docs/adr/`. Must be empty to advance. This is the entry gate auditing the Design phase exit condition. |
| `<DagSchemaSource>` | enum | One of `references/tasks.md`, `references/quick-mode.md`. The value `memory` is forbidden - DAG schema must come from a reference file, not from the model's pretraining. |
| `<TasksCount>` | integer | The total number of tasks planned. Must be > 0. |
| `<Decision>` | enum | One of `WriteJsonDag`, `AbortToUser`. |

**Schema example:**

```xml
<PAGRL phase="TaskPlanning">
  <ReferencesRead>references/tasks.md, references/specify.md, references/design.md</ReferencesRead>
  <ArtifactPath>.specs/staging/file-upload/dag.json</ArtifactPath>
  <UncreatedADRs>
    <!-- empty: all promised ADRs exist -->
  </UncreatedADRs>
  <DagSchemaSource>references/tasks.md</DagSchemaSource>
  <TasksCount>4</TasksCount>
  <Decision>WriteJsonDag</Decision>
</PAGRL>
```

## Advancement Rule

The physical vault `.specs/dags/` is locked (`chmod 555`). You cannot write to it directly.

You may only generate the tasks JSON when **all** of the following hold:

- `<ReferencesRead>` includes `references/tasks.md`
- `<ArtifactPath>` is a valid `.specs/staging/.../dag.json` path (never `console`)
- `<UncreatedADRs>` is empty
- `<DagSchemaSource>` is a reference file path, never `memory`
- `<TasksCount>` is a positive integer
- `<Decision>` is `WriteJsonDag`

When advancing, you MUST:
1. Write your `tasks.pagrl.xml` to the staging area `.specs/staging/[feature]/`.
2. Spawn a Subagent Planner (`define_subagent` with `enable_write_tools=false`) to generate the JSON DAG and send it back to you via message.
3. Write the JSON to `.specs/staging/[feature]/dag.json`.
4. Use the `run_command` tool to execute `<path-to-skill>/scripts/write_dag.sh [feature] --phase tasks`. This script runs Python validation against your XML and JSON, and if successful, moves the DAG into the physically locked vault.

The **Tasks Phase** is the bridge between specification/architecture and execution. The Orchestrator translates `.specs/features/[feature]/spec.md` (and `design.md`, if created) into an executable Directed Acyclic Graph (DAG) for the automated DAG Runner. The Orchestrator NEVER executes these tasks itself.

## Trigger
Automatically follows the completion of the Design Phase.

## Core Mechanics

### 1. Reading the Specs and Design
The Orchestrator reads `.specs/features/[feature]/spec.md` and (if it exists) `.specs/features/[feature]/design.md` to understand the business requirements, technical architecture, constraints, and required components.

### 2. Generating the JSON DAG
The Orchestrator breaks down the requirements and design into isolated, atomic tasks. These tasks must have strict dependencies.

**Output to `.specs/staging/[feature]/dag.json` (before gating):**
A strict JSON array representing the DAG. Markdown tables are strictly forbidden.

```json
[
  {
    "id": "T1",
    "description": "Implement DB schema",
    "context_ref": "Spec: Database rules",
    "skill": "postgres",
    "dependencies": [],
    "input_files": ["src/schema.ts"],
    "output_files": ["src/schema.ts"],
    "cognitive_rationale": "Validating syntax and types ensures base structure is sound. Using eslint and tsc is sufficient; no LLM judge needed.",
    "done_when_gate": "npx eslint src/schema.ts && npx tsc --noEmit"
  },
  {
    "id": "T-Final",
    "description": "Living Memory Delta Update",
    "context_ref": "Orchestrator Rule",
    "skill": "None",
    "dependencies": ["T1"],
    "input_files": [],
    "output_files": [],
    "cognitive_rationale": "Mandatory Delta Update for context-mode. Must use agy to invoke ctx_index.",
    "done_when_gate": "agy --dangerously-skip-permissions --prompt \"Call ctx_index for src/schema.ts.\""
  }
]
```

**The MCP Skill Injection Rule:**
The Orchestrator MUST use a **parallel search** strategy for `search_skills`. Instead of calling it row-by-row (which wastes roundtrips), identify all required technical domains (e.g., "react", "postgres"), execute multiple `search_skills` tool calls simultaneously in a single turn, and then write the entire JSON assigning the found skills to the `skill` field. Use `None` if no specific skill is needed.

**The Traceability Rule (Context Ref):**
The Orchestrator MUST map every functional task to a specific rule in `spec.md` and every architectural task to a decision in `design.md`. This field provides the *Reason* for the task. It MUST be a **self-contained, highly detailed summary** of the exact rule to be evaluated (e.g., "The JSON must use UUID v4. The cache must use Redis per ADR-002." rather than just "Database rules"). This ensures the stateless Auditor can validate the code without reading the full spec files.

**The Cognitive Rationale & "Done When" Gate (Test-Driven Auditing):**
The `cognitive_rationale` and `done_when_gate` fields are **MANDATORY for every single task**. Without an executable gate, the DAG Runner cannot verify completion and the workflow will break. 
Before defining the `done_when_gate`, you MUST populate `cognitive_rationale` to explain *why* you chose the validation strategy.

**For Mechanical Tasks:**
- `cognitive_rationale`: Explain why structural tests are sufficient (e.g., "Schema validation is purely syntactical").
- `done_when_gate`: Use atomic test commands: `npm test path/to/specific.test.ts` or `npx eslint src/schema.ts`.

**For Architectural/Complex Tasks (LLM-as-a-judge):**
- `cognitive_rationale`: Explain why mechanical tests fall short and cognitive validation is needed.
- `done_when_gate`: If the task implements a complex rule or architectural decision that cannot be verified by tests, you MUST use the following exact `agy` command template. Replace the bracketed variables. Do NOT instruct the Auditor to read external context files, as the summarized `context_ref` is sufficient:
`agy --dangerously-skip-permissions --prompt "Role: Independent Auditor. Evaluate if the code in [OUTPUT_FILES] strictly obeys this rule: '[CONTEXT_REF]'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>"`

### 3. The Financial Firewall (Token Economy)
The `input_files` field is critical. Because the DAG Runner spawns *stateless* background workers, every file listed is read from scratch.
- **Rule:** Be surgically precise. Never use wildcards like `src/*`. Only list the exact files needed to complete the task. This guarantees parallel execution is exponentially cheaper than keeping a monolithic session alive.

### 4. Living Memory (The Delta Update Task)
To ensure the project's Architectural Invariants do not rot, the Orchestrator MUST inject a final task (`T-Final`) into every JSON DAG. 
- **The Token-Efficient Delta:** The Orchestrator MUST NOT ask for a full codebase re-scan. It must list ONLY the newly modified folders/files for `ctx_index`.
- **CRITICAL TEMPLATE:** The Orchestrator MUST wrap the prompt in double quotes exactly like this: `agy --dangerously-skip-permissions --prompt "Call ctx_index for src/api.ts."`
- This ensures the search index stays fresh with zero token waste.

### 5. Handoff to Execution (DAG Runner)
The Orchestrator DOES NOT generate raw CLI prompts. Instead, it instructs the user to invoke the automated DAG Runner:

```bash
<path-to-skill>/<path-to-skill>/scripts/run_dag.sh .specs/dags/[feature].json
```

**What happens next (out of the Orchestrator's sight):**
- The Python validator parses the JSON.
- It spawns isolated Gemini CLI workers in parallel for tasks with no dependencies.
- Upon worker completion, the script automatically triggers the Auditor (`Done When` gate).
- If the Auditor fails, the script triggers an Auto-Healing loop, re-invoking the worker with the error logs.
- The Orchestrator stays completely clean, preserving its context window for high-level architecture.
