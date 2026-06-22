# dag-flow: Design Phase

The **Design Phase** is mandatory for every feature. It exists to make architectural decisions visible before they are committed to code, and to ensure that "no architectural change" is *named and justified* rather than silently assumed.

## Trigger

Automatically follows the completion of the Specify Phase. There is no bypass: every feature passes through Design, regardless of perceived complexity.

## Core Principle: Depth Proportional to Decisions

The depth of `design.md` is proportional to the architectural decisions the feature requires - not to the perceived complexity of the feature. A feature that genuinely reuses existing patterns produces a short `design.md` where most sections are explicitly marked N/A with justification. A feature that introduces a new cross-cutting concern produces a longer one. **The shape of the file is uniform; the depth of each section is variable.**

This rule replaces the old "Bypass Check" mechanism, which has been removed from the workflow because it taught the model that phases are skippable when judged unnecessary - a generalization that leaked from Design into Specify and Tasks.

## Required Sections

Every `design.md` MUST contain the following sections, in order. Each section accepts 'N/A' only when accompanied by a justification.

```markdown
# Design: [feature name]

## Solution Components
[List the concrete technical mechanisms, boundaries, and interfaces to be implemented. Define the discrete units of code or data structures that will materialize the business logic. Do not use abstract patterns here; name the actual structural components that the execution phase will build.]

## Patterns Reused
[List existing patterns this feature builds on. Reference files or modules where each pattern is currently implemented. If none - i.e., this feature introduces only new code with no reuse - explain why no existing pattern applies.]

## New Patterns Introduced
[List any new patterns this feature establishes that other parts of the codebase will need to follow. If 'N/A', justify: "This feature introduces no new pattern; it strictly conforms to <named existing pattern>."]

## Cross-Cutting Concerns
[Address auth, authorization, logging, rate limiting, observability, error handling conventions, and any other concern that crosses module boundaries. For each concern, state how this feature interacts with it. 'N/A' is acceptable per concern, but each 'N/A' requires a sentence: "<concern>: N/A - <reason>".]

## ADRs Required
[List ADRs that this design produces. If none, justify: "No architectural trade-off was made that meets the ADR criteria (hard to reverse + surprising + real trade-off)."]

## Confidence
[A single sentence assessing the confidence in this design. If confidence is low, name what specifically is uncertain - do not write a number. The 0.0-1.0 confidence score from previous versions of this skill has been removed because thresholds invite theatrical self-grading.]
```

## Counted PAGRL (Schema)

PAGRL in the Design phase has its own field set, attacking the failure characteristic of this phase: writing a `design.md` of vague prose that hides absent reasoning.

| Field | Type | Why it exists |
|---|---|---|
| `<ReferencesRead>` | comma-separated list | Must include `references/design.md` and `references/specify.md` (the latter so the design is grounded in the spec, not in the prompt). |
| `<SolutionComponents>` | list of `<item>` elements | Forces the model to explicitly list the concrete structural components/mechanisms to be built, ensuring the design is not just abstract patterns. |
| `<PatternsReused>` | list of `<item>` elements | Mirrors the `## Patterns Reused` section. Empty list with no justification is a flag. |
| `<NewPatternsIntroduced>` | list of `<item>` elements | Mirrors `## New Patterns Introduced`. Non-empty list signals cross-cutting impact and may require an ADR. |
| `<ADRsRequired>` | list of `<item>` elements | Mirrors `## ADRs Required`. Each item is a one-line ADR title that the orchestrator must create before advancing to Tasks. |
| `<UnjustifiedDecisions>` | list of `<item>` elements | Lists any decision in the current `design.md` draft that lacks a stated rationale. Must be empty to advance. |
| `<Decision>` | enum | One of 'ContinueDesign', 'WriteDesign', 'AbortToUser'. Cannot be 'WriteDesign' while `<UnjustifiedDecisions>` is non-empty. |

**Schema example:**

```xml
<PAGRL phase="Design">
  <ReferencesRead>references/design.md, references/specify.md</ReferencesRead>
  <SolutionComponents>
    <item>Authentication middleware component</item>
    <item>Login and Registration endpoints</item>
  </SolutionComponents>
  <PatternsReused>
    <item>Express middleware pattern (existing src/middleware/)</item>
  </PatternsReused>
  <NewPatternsIntroduced>
    <!-- empty: feature reuses existing patterns -->
  </NewPatternsIntroduced>
  <ADRsRequired>
    <!-- empty -->
  </ADRsRequired>
  <UnjustifiedDecisions>
    <!-- empty -->
  </UnjustifiedDecisions>
  <Decision>WriteDesign</Decision>
</PAGRL>
```

## Advancement Rule

The physical vault `.specs/features/` is locked (`chmod 555`). You cannot write to it directly.

You may only advance when **all** of the following hold in your most recent `<PAGRL phase="Design">`:

- `<ReferencesRead>` includes both `references/design.md` and `references/specify.md`
- `<UnjustifiedDecisions>` is empty
- `<Decision>` is 'WriteDesign'

When advancing, you MUST:
1. Write `design.md` and `design.pagrl.xml` to the staging area `.specs/staging/[feature]/`.
2. Use the `Shell` tool to execute `<path-to-skill>/scripts/commit_design.sh [feature]`. This script runs Python validation against your XML and, if successful, moves the files into the physically locked vault.

You may only advance to the Tasks phase after the gate script succeeds and every item in `<ADRsRequired>` has been created in `docs/adr/`.

## Zero Execution

During the Design Phase, the Orchestrator is FORBIDDEN from modifying any functional application code (`src/`, `lib/`, etc.). All writes must be confined to `.specs/staging/`, `docs/adr/`, and (if a new domain term emerges) `CONTEXT.md`.

## Exit Condition

The Design Phase concludes when `design.md` has been successfully vaulted via `<path-to-skill>/scripts/commit_design.sh`, all required ADRs exist in `docs/adr/`, and the most recent PAGRL has `<Decision>WriteDesign</Decision>` with all advancement-rule conditions met.
