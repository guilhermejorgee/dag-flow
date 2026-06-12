# dag-flow: Specify Phase

## Calibration

Project-specific values (limits, types, paths, names, identifiers) are never inferable from training data. When absent from the user's input, they must be elicited via Socratic interrogation. This applies even when a default value would be "obvious" - *obvious to the model* and *correct for this project* are different things, and the model has no way to distinguish them without asking.

The **Specify Phase** represents the bedrock of dag-flow. Its core objective is to systematically eradicate ambiguity before a single line of architecture or code is written.

## Trigger
"Specify feature X", "Plan project", or initiating a new major feature.
(Note: per the Default Policy in SKILL.md, *any* feature request enters Specify by default, regardless of phrasing. The phrases above are explicit triggers; absence of an explicit trigger does not exempt a feature request from Specify.)

## Core Mechanics

### 1. Socratic Interrogation
The Orchestrator assumes the role of an adversarial systems analyst. Rather than accepting vague requirements, you must recursively drill down into the user's intent.

**The Golden Rule:** You must ask exactly **ONE architectural or business-logic question per turn**.
- Do not overwhelm the user with a list of questions.
- Wait for the user's answer before asking the next question.
- Do not make assumptions about edge cases. Ask.

### 2. Live Dictionary Building (`CONTEXT.md`)
As the Socratic Interrogation progresses and the user defines domain concepts, the Orchestrator MUST immediately update the `CONTEXT.md` file in the project root. This ensures a ubiquitous language is maintained from the start.

**Caveman Syntax for `CONTEXT.md`:**
Definitions must be ultra-concise (Caveman format): Max 2 sentences describing what it *is*, followed by an `_Avoid_` list to prevent synonym drift.

*Example Update:*
```markdown
# Domain Dictionary

**WorkflowInstance**: Instance of an executing state machine containing current state and variables. _Avoid_: execution, run, process.
**Gate**: Boolean verification check executed by the Auditor. _Avoid_: validator, check, test.
```

### 3. Counted PAGRL (Schema)

PAGRL in the Specify phase is not free prose. It is a structured XML block with countable or enumerable fields. Each field exists to block a specific failure mode observed in benchmarks:

| Field | Type | Why it exists |
|---|---|---|
| `<ReferencesRead>` | comma-separated list | Forces explicit acknowledgment of which reference files were loaded this turn. The Tasks-phase failure where the model improvised the table format originated in skipping reference loading; declaring an empty list here is a visible self-incrimination. |
| `<QuestionsAsked>` | non-negative integer | Counts Socratic questions asked so far in this Specify session. Cannot be lied about while still claiming to have advanced. |
| `<MissingContextTerms>` | list of `<item>` elements | Lists any core domain entities or concepts discussed that are not yet defined in `CONTEXT.md`. Must be empty to advance. Forces the model to create/update `CONTEXT.md` on fresh repositories. |
| `<UnresolvedAmbiguities>` | list of `<item>` elements | Lists every ambiguity the model is aware of and has not yet resolved. Must be empty to advance. |
| `<AssumedValues>` | list of `<item>` elements | **Direct antidote to the file-upload benchmark.** Lists every project-specific value (limits, types, paths) the model is about to use without explicit user input. Must be empty to advance. If the model is tempted to assume "5MB", it must list "5MB for max file size" here - and listing it forces it to be elicited instead. |
| `<EvidenceSource>` | per-decision tag | For each non-trivial decision in the current spec draft, declares the source: `user_input`, `reference_file:<path>`, or `inference`. The value `inference` is a flag - it tells the orchestrator (and the human reviewing the trace) that something was decided without ground. |
| `<Decision>` | enum | One of 'ContinueInterrogation', 'WriteSpec', 'AbortToUser'. Cannot be 'WriteSpec' while `<UnresolvedAmbiguities>` or `<AssumedValues>` is non-empty. |

**Schema example (this is the format every PAGRL turn in Specify must follow):**

```xml
<PAGRL phase="Specify">
  <ReferencesRead>references/specify.md</ReferencesRead>
  <QuestionsAsked>2</QuestionsAsked>
  <MissingContextTerms>
    <item>S3 Bucket</item>
  </MissingContextTerms>
  <UnresolvedAmbiguities>
    <item>Max file size not specified</item>
    <item>Allowed MIME types not specified</item>
  </UnresolvedAmbiguities>
  <AssumedValues>
    <!-- empty: model has not assumed anything yet -->
  </AssumedValues>
  <EvidenceSource>
    <decision name="upload destination">user_input</decision>
  </EvidenceSource>
  <Decision>ContinueInterrogation</Decision>
</PAGRL>
```

### Advancement Rule

You may only write `.specs/features/[feature]/spec.md` when **all** of the following hold in your most recent `<PAGRL phase="Specify">`:

- `<QuestionsAsked>` ≥ 1
- `<MissingContextTerms>` is empty
- `<UnresolvedAmbiguities>` is empty
- `<AssumedValues>` is empty
- `<Decision>` is `WriteSpec`

If any of these fails, the only valid action is to ask another Socratic question (or, if blocked, set `<Decision>` to `AbortToUser` and surface the blocker explicitly).

### 4. Zero Execution
During the Specify Phase, the Orchestrator is **FORBIDDEN** from modifying any functional application code (`src/`, `lib/`, etc.). All writes must be confined to `.specs/` and `CONTEXT.md`.

## Exit Condition
The Specify phase concludes only when all edge cases, domain entities, and requirements are unambiguously resolved. The system then automatically advances to the **Design Phase**.
