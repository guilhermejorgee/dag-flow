# dag-flow: Quick Mode (Bug Fixes & Hot-Patches)

Quick Mode is the explicit hotfix path: a compressed flow for runtime regressions and reported bugs. It is not a shortcut to be self-selected by the orchestrator - it is a route the user opens by invoking one of the canonical trigger phrases below. Specify and Design remain the default for all other feature requests (see SKILL.md, Default Policy).

## Trigger

Quick Mode opens **only** when the user's prompt literally contains one of the canonical phrases:

- 'Fix bug'
- 'Hotfix'
- 'Hot-patch'
- 'Quick mode'

This list is **closed**. Variants and paraphrases ('patch this regression', 'apply a quick fix', 'it's just a small bug') do not qualify. If the user's intent seems hotfix-shaped but they have not used a canonical phrase, the correct action is to enter Specify per the Default Policy and, if appropriate, ask the user whether they prefer to invoke Quick Mode explicitly.

The literal token 'ESCALATION' is also accepted as a `<TriggerPhrase>` value, but only when entry comes from step 2 of the Escalation Phase (see `references/escalation-phase.md`). It cannot be invoked by the user directly.

## Entry Gate (Counted PAGRL)

Before any diagnosis, the orchestrator MUST emit an entry-gate PAGRL that proves Quick Mode was authorized.

| Field | Type | Why it exists |
|---|---|---|
| `<UserExplicitlyInvokedQuickMode>` | boolean | True only if the user's prompt literally contains one of the canonical trigger phrases, or if entry is via Escalation. |
| `<TriggerPhrase>` | string | The exact substring from the user's prompt that matched a canonical trigger, or the literal `ESCALATION` for escalation entry. The value `NONE` is permitted but forces abort. |
| `<Decision>` | enum | One of `ProceedToDiagnosis`, `AbortToSpecify`. |

**Schema example (legitimate user-invoked entry):**

```xml
<PAGRL phase="QuickModeEntry">
  <UserExplicitlyInvokedQuickMode>true</UserExplicitlyInvokedQuickMode>
  <TriggerPhrase>Fix bug</TriggerPhrase>
  <Decision>ProceedToDiagnosis</Decision>
</PAGRL>
```

**Schema example (escalation entry):**

```xml
<PAGRL phase="QuickModeEntry">
  <UserExplicitlyInvokedQuickMode>true</UserExplicitlyInvokedQuickMode>
  <TriggerPhrase>ESCALATION</TriggerPhrase>
  <Decision>ProceedToDiagnosis</Decision>
</PAGRL>
```

**Schema example (illegitimate attempt - must abort):**

```xml
<PAGRL phase="QuickModeEntry">
  <UserExplicitlyInvokedQuickMode>false</UserExplicitlyInvokedQuickMode>
  <TriggerPhrase>NONE</TriggerPhrase>
  <Decision>AbortToSpecify</Decision>
</PAGRL>
```

### Advancement Rule

You may only proceed to the Diagnosis step when `<UserExplicitlyInvokedQuickMode>` is `true` AND `<TriggerPhrase>` matches one of the canonical triggers (or equals `ESCALATION` for escalation entry). Otherwise, the only valid action is to set `<Decision>` to `AbortToSpecify` and surface to the user that Quick Mode was not authorized.

## The Process

### 1. Diagnosis (Second PAGRL)

This PAGRL is the *second* one in Quick Mode - it follows the entry gate above. By the time you reach this step, you have already proven user authorization. The diagnosis PAGRL focuses on root-cause hypothesis, not on entry permission.
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

**Skill Injection Rule:**
After outputting the `<PAGRL>`, the Orchestrator MUST use the `search_skills` tool based on the diagnosis to find relevant local skills for the worker. Only after receiving the search results, it should generate the Mini-DAG table.

**Artifact Generation & Gating:**
The physical vault `.specs/dags/` is locked (`chmod 555`). You cannot write to it directly.

When generating a Quick Mode DAG, you MUST:
1. Write BOTH your entry PAGRL (`quickmode-entry.pagrl.xml`) and your diagnosis PAGRL (`quickmode-diagnosis.pagrl.xml`) to `.specs/staging/[issue_id]/`.
2. Write the Mini-DAG table to `.specs/staging/[issue_id]/dag.md`.
3. Use the `run_command` tool to execute `scripts/write_dag.sh [issue_id] --phase quick-mode`. This script runs Python validation against both XML files and, if successful, moves the DAG into the physically locked vault.

**Output format for the dag.md table:**
1. **Diagnosis Summary:** Brief explanation of the root cause.
2. **Mini-DAG Table (9 columns):**
   `| ID | Description | Context Ref | Skill | Depends On | Input Files | Output Files | Done When (Gate) | Status |`
   - *Note on `Context Ref`:* The Orchestrator MUST populate this column with a rich, self-contained summary of the diagnostic failure (since there is no spec.md in Quick Mode). For `T-Final`, use `Orchestrator Rule`.
   - *Note on `Depends On`:* You MUST include this column to avoid breaking the DAG Runner parser. Fill it sequentially (e.g., T2 depends on T1).
   - *Note on `Done When`:* 
     - **For Mechanical Tasks:** Use atomic test commands (e.g., `npm test file.test.ts` or `npx eslint file.ts`).
     - **For Non-Mechanical Tasks (LLM-as-a-judge):** Use the Zero-Context Auditor template: `agy --dangerously-skip-permissions --prompt "Role: Independent Auditor. Evaluate if the code in [OUTPUT_FILES] strictly obeys this rule: '[CONTEXT_REF]'. Do not read external context files. Respond EXACTLY with PASS or FAIL: <reason>"`. The Orchestrator MUST replace `[CONTEXT_REF]` with the rich text from the Context Ref column.
   - *Note on Living Memory (T-Final):* The final task MUST be `T-Final`. Its `Done When` gate must execute `agy --dangerously-skip-permissions --prompt "Call ctx_index for .specs/dags/[issue_id].md and [modified_files]."` to sync the index.

*Note on In-Code Documentation:* Instruct the worker to leave an explicit inline code comment explaining the hotfix logic. This enables automated multi-dev onboarding without bloating `CONTEXT.md`.

*Note on Tokens (Financial Firewall):* Be extremely precise with `Input Files`. The automated runner will inject only these files into the stateless worker to save tokens.

### 3. Execution & Auto-Healing
The Orchestrator's job concludes with the generation of the Mini-DAG. Instruct the user to run the automated script:

```bash
<path-to-skill>/scripts/run_dag.sh .specs/dags/[issue_id].md
```

The bash script takes over, spawning stateless workers, running the verification gates, and auto-healing any failures via terminal loops without polluting the Orchestrator's context window.
