# Comprehensive Implementation Plan: Deterministic File System Gating & Subagent Relay

**Author/Context:** Generated via `grill-with-docs` session to resolve "Few-shot ossification" and LLM prompt disobedience.
**Target Audience:** The Execution Agent. 
**CRITICAL:** Do NOT rely on prior conversational memory. Execute this plan exactly as written. This document contains the full context and precise implementation requirements.

## 1. Context & Motivation (Why we are doing this)
LLM agents suffer from "Overconfidence" and "Few-shot ossification". When given plain text instructions like "You MUST NOT advance to Tasks until you read X", they routinely ignore them. 
To solve this, we introduced the "Counted PAGRL" (ADR-0004) - an XML schema the LLM must emit before advancing. Countable fields (like `<UncreatedADRs>` or `<AssumedValues>`) create structural contradictions if the LLM tries to lie or hallucinate.
**The Problem:** Relying on the LLM to police its own PAGRL via prompt rules is flawed. If the LLM improvises, it writes malformed DAGs directly to the physical repository, breaking the automation pipeline.
**The Solution (ADR-0005): File System Physics.** We are physically locking the destination directories (`.specs/features/` and `.specs/dags/`) with `chmod 555`. The LLM cannot write to them directly. It must write drafts to a `.specs/staging/` area and invoke bash scripts. These scripts use a Python parser to mathematically validate the PAGRL XML. Only if validation passes do the scripts temporarily unlock the vault and move the artifacts.

## 2. File System & Data Structure
- **The Vaults (chmod 555):** `.specs/features/[feature]/` and `.specs/dags/`.
- **The Staging Area (chmod 755):** `.specs/staging/[feature]/`. (Used 755 for security, as all runs belong to the same user).
- **Artifact Segregation:** The LLM must NEVER pollute the final markdown artifacts with its XML cognitive trace. For every step, the LLM generates TWO files in the staging area:
  1. The clean markdown artifact (e.g., `spec.md`).
  2. The cognitive trace XML (e.g., `spec.pagrl.xml`).
  Both files are moved into the vault side-by-side by the gate scripts. This preserves the audit trail (ADR-0004) without ruining human readability.

## 3. The 4-Phase Architecture

### Phase 1: Specify
- **Actor:** Main Agent (natively handling the Socratic chat).
- **Action:** Generates `.specs/staging/[feature]/spec.md` (pure business rules) and `.specs/staging/[feature]/spec.pagrl.xml` (the Counted PAGRL).
- **Gate:** Executes `scripts/commit_spec.sh [feature]` (using `run_command` tool).
- **Validation:** Script runs `validate_pagrl.py --phase specify .specs/staging/[feature]/spec.pagrl.xml`.
- **Success:** Script `chmod 755` the vault, moves BOTH files to `.specs/features/[feature]/`, and restores `chmod 555`.

### Phase 2: Design
- **Actor:** Main Agent (retaining the rich conversational semantic gravity).
- **Action:** Generates `.specs/staging/[feature]/design.md` and `.specs/staging/[feature]/design.pagrl.xml`.
- **Gate:** Executes `scripts/commit_design.sh [feature]` (using `run_command` tool).
- **Validation:** Script runs `validate_pagrl.py --phase design`. If PASS, moves BOTH files to the vault.

### Phase 3: Tasks (The Planner Subagent)
- **Actor 1 (Main Agent):** Generates `.specs/staging/[feature]/tasks.pagrl.xml` to prove `<UncreatedADRs>` is empty (i.e. ADRs were created). Then spawns the Subagent Planner.
- **Actor 2 (Subagent Planner):** Spawned via a custom definition (`define_subagent`) with `enable_mcp_tools=true` (to run `search_skills`) and `enable_write_tools=false` (clean-room safety). 
- **Subagent Context:** Its prompt MUST instruct it to read `references/tasks.md` first. Then it reads `spec.md`, `design.md`, the global `CONTEXT.md`, and newly created ADRs in `docs/adr/`.
- **Subagent Action:** Generates the DAG table, uses `search_skills` via MCP, and sends the raw markdown table to the Main Agent via internal message.
- **Actor 1 (Main Agent):** Receives the message, writes the table to `.specs/staging/[feature]/dag.md`.
- **Gate:** Executes `scripts/write_dag.sh [feature] --phase tasks` (using `run_command` tool).
- **Validation:** `write_dag.sh` validates `tasks.pagrl.xml` via python, then validates the Markdown table structure (9 columns), then vaults the DAG to `.specs/dags/[feature].md` and archives the XML.

### Alternate Path: Quick Mode & Escalation Phase
- **Actor:** Main Agent.
- **Action:** Quick Mode (and Escalation Phase) require TWO PAGRLs according to `references/quick-mode.md`: 
  1. Entry Gate (to prove authorization or Escalation trigger). Emits `.specs/staging/[issue_id]/quickmode-entry.pagrl.xml`.
  2. Diagnosis (to form hypothesis without touching code). Emits `.specs/staging/[issue_id]/quickmode-diagnosis.pagrl.xml`.
- **Gate:** Main Agent generates Mini-DAG, writes to `.specs/staging/[issue_id]/dag.md`. Executes `scripts/write_dag.sh [issue_id] --phase quick-mode`.
- **Validation:** Script must run `validate_pagrl.py` for BOTH `quickmode-entry` and `quickmode-diagnosis`.

## 4. Execution Requirements (Tasks for the Executing Agent)

### A. Create `scripts/validate_pagrl.py`
- Must accept `--phase <phase>` and `<xml_file_path>`.
- **CRITICAL XML EXTRACTION:** LLMs wrap XML in markdown (\`\`\`xml ... \`\`\`) and sometimes make mistakes. The python script MUST slice the string from the first occurrence of `<PAGRL` to the last occurrence of `</PAGRL>` to safely extract raw XML, ignoring external markdown, before feeding it to `xml.etree.ElementTree`.
- **Validation Rules (must hardcode logic to check these XML text values):**
  - `--phase specify`: `<QuestionsAsked>` >= 1, `<MissingContextTerms>` is empty, `<UnresolvedAmbiguities>` is empty, `<AssumedValues>` is empty, `<Decision>` == WriteSpec.
  - `--phase design`: `<UnjustifiedDecisions>` is empty, `<Decision>` == WriteDesign.
  - `--phase tasks`: `<UncreatedADRs>` is empty, `<TableSchemaSource>` != memory, `<Decision>` == WriteTasksTable.
  - `--phase quick-mode-entry`: `<UserExplicitlyInvokedQuickMode>` == true, `<TriggerPhrase>` != NONE (must accept `ESCALATION`).
  - `--phase quick-mode-diagnosis`: `<Decision>` == Generate a Mini-DAG for the hot-patch.
- Emit Exit Code 0 on success, Exit Code 1 on validation failure. Print the specific reason for failure to stdout so the LLM can self-correct.

### B. Create/Update Shell Gate Scripts
- **Create `scripts/commit_spec.sh`** and **`scripts/commit_design.sh`**.
- **Update `scripts/write_dag.sh`**: Modify to accept the feature name and the `--phase` argument. It must first run the python validation on the corresponding `.pagrl.xml` files. Only if Python exits 0 does it proceed to validate the markdown table.
- **Create `scripts/update_task_status.sh`**: The Orchestrator needs to update a task's status to `Done` during the Escalation Phase without violating the `555` vault lock. This script must accept `<dag_file> <task_id> <status>`, temporarily unlock the vault (`chmod 755`), use `sed` to update the markdown table, and restore the lock.
- **Update `scripts/run_dag.sh`**: Must be modified so that its internal `sed -i` commands (that update `Pending` to `Done` or `Failed`) temporarily unlock `.specs/dags/` (`chmod 755`) and then re-lock it (`chmod 555`). Otherwise, the script will crash trying to write to the locked vault.
- **Security:** All scripts must gracefully handle missing files, elevate permissions on the vault (`chmod 755`), copy/move BOTH the `.md` and `.xml` files, and infallibly restore the lock (`chmod 555`) using a bash `trap`.

### C. Update Documentation
- **`SKILL.md`**: 
  - Remove the rhetorical prompt-level "don't transition" begging. 
  - Add strict instructions for the Orchestrator to use `.specs/staging/`.
  - EXPLICITLY INSTRUCT the Orchestrator to use the `run_command` tool to execute `scripts/commit_spec.sh`, `scripts/commit_design.sh`, `scripts/write_dag.sh`, and `scripts/update_task_status.sh`.
  - Define the Subagent Phase 3 handoff explicitly.
- **`references/specify.md`, `design.md`, `tasks.md`, `quick-mode.md`, `escalation-phase.md`**: Update the "Exit Condition" sections to point to the new Bash gates and the physical segregation of `.md` and `.pagrl.xml` in `.specs/staging/`. Also update Escalation Phase to instruct the Orchestrator to use `scripts/update_task_status.sh` when marking a hotfix resolved.
