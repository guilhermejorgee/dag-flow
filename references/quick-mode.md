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

Before writing this PAGRL, the Orchestrator MUST:
1. Read the affected source file(s) using read-only tools.
2. Read any test files for the affected module (e.g., `test.js`, `*.test.js`, `*.spec.js`).
   Test files define the expected behavior - the fix specification must align with what
   tests check, not with what "would make sense in production" in isolation.
3. Read `CONTEXT.md` if it exists, to use the project's domain language in the diagnosis.

Declare all files read in `<FilesInspected>`. If `test.js` is not in `<FilesInspected>`,
you are declaring you did not read it - and this will be visible in the audit trail.

```xml
<PAGRL phase="quick-mode-diagnosis">
  <ReferencesRead>references/quick-mode.md, CONTEXT.md</ReferencesRead>
  <FilesInspected>src/routes/auth.js, test.js</FilesInspected>
  <Intention>Diagnose: /login returns 500 due to undefinedVar</Intention>
  <Reasoning>
    Read src/routes/auth.js - undefinedVar on line 3 causes ReferenceError (500).
    Read test.js - calls auth({}, res) with empty req, expects res.status(200).
    Fix must remove the guard and call res.status(200) unconditionally.
  </Reasoning>
  <Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>
```

| Campo | Tipo | Por que existe |
|---|---|---|
| `phase="quick-mode-diagnosis"` | atributo XML | Distingue Entry Gate de Diagnosis no audit trail |
| `<ReferencesRead>` | Lista separada por vírgula | Declara protocolos lidos; omitir `CONTEXT.md` é auto-incriminante |
| `<FilesInspected>` | Lista separada por vírgula | Declara código/testes lidos; omitir `test.js` é visível no audit |

### 1.5. Planner Invocation

After completing the Diagnosis PAGRL, the Orchestrator MUST spawn a Subagent Planner
to generate the Mini-DAG JSON. Do NOT generate the JSON inline - this is what produces
weak gates and imprecise task descriptions.

**Step 1 - Load the system prompt template:**
Use the `<<<DAG:TOOL_VIEW_FILE>>>` tool to read `references/planner-template.md` verbatim.
This is the system prompt for the Subagent. Do not paraphrase or reconstruct from memory.

**Step 2 - Compose the user message with this structure:**

```
Context: [paste the quickmode-diagnosis.pagrl.xml content verbatim]
Affected files: [list of file paths from <FilesInspected>]
Error log: [raw stack trace or log content that triggered this hotfix, if available]
CONTEXT.md path: [path to project CONTEXT.md if it exists, e.g. "CONTEXT.md"]
Reference: Read `references/quick-mode.md` for the Mini-DAG JSON schema and field requirements.

Instructions:
1. Call search_skills with queries based on the diagnosis (domain, file types, error type).
2. For each skill found, call read_skill to learn project conventions before writing tasks.
3. Apply skill knowledge to write precise context_ref, execution_prompt, and done_when_gate.
4. If no skill covers the primary domain AND no skill defines a verification pattern for
   this class of change: see "Structural Escalation" below before emitting output.
5. Return your response using the two-block Output Contract from the system prompt:
   `<planner_pagrl>` (PAGRL XML) followed by `<dag_json>` (JSON array). No prose outside
   the tags, no markdown fences.
```

**Step 3 - Spawn:**
<<<DAG:SPAWN_SUBAGENT_QUICK_BLOCK>>>

**Step 4 - Receive and detect:**
The Subagent message contains either (a) both blocks or (b) only `<planner_pagrl>`:

- **If the message contains `<dag_json>`** (normal flow):
  Extract both blocks. Write `planner.pagrl.xml` (inner `<PAGRL>` XML from planner_pagrl block)
  and `dag.json` to `.specs/staging/[issue_id]/`. Run `write_dag.sh`.
  If `write_dag.sh` fails: spawn a **new** Subagent session (same system prompt,
  original user message + broken content + validation error appended). One retry only.
  Do not attempt to fix the JSON or XML manually.

- **If the message contains no `<dag_json>`** (escalation flow):
  Read the `<planner_pagrl>` block to identify the `<OpenDecisions>` listed.
  The Orchestrator conducts a focused Socratic session with the user — ask targeted
  questions about verification strategy and what "done" looks like for the specific
  open decisions. Do NOT ask broad requirements questions (Specify's role).
  After the session, **the Orchestrator writes** the user's answers as a draft skill:
  `.dag-flow/skills/[domain-name]/SKILL.md` (the Subagent cannot write — it has
  `enable_write_tools=false`). Then spawn a **new** Subagent session; `search_skills`
  will find the newly written skill if the skill body contains relevant domain terms.

**Structural Escalation - when to involve the user:**
The Subagent escalates when its `<EscalationDecision>` is `Escalate` — triggered by
either a structural gap OR an open implementation decision:
- No skill covers the primary domain of the failing code, AND the implementation path
  is not obvious from SE baseline alone (open decision)
- No skill defines a verification pattern for this class of change
- The task touches a system boundary (auth, migrations, external APIs) with no coverage

When escalating, the Subagent must name the specific gap in `<OpenDecisions>` — not
"I'm uncertain" but "Cache strategy for session tokens: Redis vs in-memory not defined."
The Subagent returns its `<planner_pagrl>` block **without** `<dag_json>`.

The Orchestrator detects absence of `<dag_json>` and reads `<OpenDecisions>` to conduct
a focused Socratic session with the user. After the session, **the Orchestrator writes**
the draft skill (the Subagent cannot write — `enable_write_tools=false`):
`.dag-flow/skills/[domain-name]/SKILL.md` with frontmatter:

```yaml
---
name: [domain-name]
description: [what this skill teaches]
covers:
  - domain:[primary-domain]
  - boundary:[system-boundary-if-applicable]
  - verification:[test-type]
---
[directives from user's answers — include domain keywords here for search_skills discoverability]
```

**Note on `covers:` and discoverability:** `covers:` is documentary. `search_skills` uses
Fuse.js full-text on `name`, `description`, `triggers`, `category` — NOT the `covers:` field.
Write domain terms in the skill **body** so `search_skills` finds it.

The new Planner session spawned after skill creation will call `search_skills` normally.
The user can improve the skill later with the skill-creator skill.

**Overlapping coverage:** if multiple skills cover the same domain, most-specific wins
(the skill with the most `covers:` claims is applied).

### 2. Mini-DAG Generation
Generate a simplified, sequential JSON AST. Unlike the full `tasks.md` process, a Mini-DAG typically represents a linear sequence of atomic fixes.

**Artifact Generation & Gating:**
Mini-DAG JSON generation is the Subagent Planner's responsibility — see **§1.5 Planner Invocation**.
The Orchestrator MUST NOT generate the JSON inline or call `search_skills` for DAG planning.

The physical vault `.specs/dags/` is locked (`chmod 555`). You cannot write to it directly.

When completing Quick Mode, the Orchestrator MUST have these files in `.specs/staging/[issue_id]/`:
1. `quickmode-entry.pagrl.xml` — entry gate PAGRL
2. `quickmode-diagnosis.pagrl.xml` — diagnosis PAGRL (§1)
3. `planner.pagrl.xml` — extracted from Subagent `<planner_pagrl>` block (§1.5)
4. `dag.json` — extracted from Subagent `<dag_json>` block (§1.5)

Then use `<<<DAG:TOOL_RUN_COMMAND>>>` to execute `<path-to-skill>/scripts/write_dag.sh [issue_id] --phase quick-mode`.

**Output format for the dag.json:**
1. **Diagnosis Summary:** Brief explanation of the root cause (included as comments or in the PAGRL).
2. **Mini-DAG JSON Array:**
   A strict JSON array representing the DAG. Markdown tables are strictly forbidden.
   - *Note on `context_ref`:* The Orchestrator MUST populate this column with a rich, self-contained summary of the diagnostic failure (since there is no spec.md in Quick Mode). For `T-Final`, use `Orchestrator Rule`.
   - *Note on `dependencies`:* You MUST include this field to avoid breaking the DAG Runner parser. Fill it sequentially (e.g., T2 depends on `["T1"]`).
   - *Note on `done_when_gate`:* 
     - **For Mechanical Tasks:** Use atomic test commands (e.g., `npm test file.test.ts` or `npx eslint file.ts`).
     - **For Non-Mechanical Tasks (LLM-as-a-judge):** Use the Zero-Context Auditor template: `<<<DAG:AUDITOR_COMMAND_TEMPLATE>>>`. The Orchestrator MUST replace `[CONTEXT_REF]` with the rich text from the Context Ref column.
   - *Note on Living Memory (T-Final):* The final task MUST be `T-Final`. Its `done_when_gate` must execute `<<<DAG:CLI_COMMAND_PREFIX>>> --prompt "Call ctx_index for .specs/dags/[issue_id].json and [modified_files]."` to sync the index.

*Note on In-Code Documentation:* Instruct the worker to leave an explicit inline code comment explaining the hotfix logic. This enables automated multi-dev onboarding without bloating `CONTEXT.md`.

*Note on Tokens (Financial Firewall):* Be extremely precise with `input_files`. The automated runner will inject only these files into the stateless worker to save tokens.

### 3. Execution & Auto-Healing
The Orchestrator's job concludes with the generation of the Mini-DAG. Instruct the user to run the automated script:

```bash
<path-to-skill>/<path-to-skill>/scripts/run_dag.sh .specs/dags/[issue_id].json
```

The bash script takes over, spawning stateless workers, running the verification gates, and auto-healing any failures via terminal loops without polluting the Orchestrator's context window.
