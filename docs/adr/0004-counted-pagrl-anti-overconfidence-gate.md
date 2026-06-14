# 4. Counted PAGRL as Anti-Overconfidence Gate

Date: 2026-06-11

## Status

Accepted

## Context

Benchmarks of dag-flow against large frontier models (notably Gemini 3.1 Pro High) revealed a consistent failure pattern: the model would skip the Specify phase entirely (zero Q&A turns), hallucinate project-specific values (file size limits, MIME types), skip the loading of `references/tasks.md`, and improvise the tasks output to the console rather than writing the strict markdown table to `.specs/features/[feature]/tasks.md`. The full diagnostic, including investigation of RLHF-induced overconfidence and semantic gravity in pretraining, is documented in `docs/design/Otimização Do Projeto Dag-Flow.md`.

The original skill relied on prose-level rules ("Anti-Hallucination", "you MUST read references/tasks.md") to enforce phase discipline. These rules competed in token weight against the model's RLHF-trained tendency to "be helpful immediately", and they lost. The skill also contained a "Bypass Check" section that granted the orchestrator discretion to skip the Design phase for "Pattern-Conforming" features (CRUD endpoints, UI components, bug fixes). Two failure modes were observed:

1. The discretion leaked. The model generalized "Design is skippable when I judge it unnecessary" into "Specify and Tasks are skippable when I judge them unnecessary."
2. The illustrative examples ossified into a closed enumeration. Any feature outside the listed cross-cutting concerns was automatically classified as Pattern-Conforming.

We considered three classes of solution from the research document: (a) negative-persona reinforcement of the prompt, (b) counted PAGRL - converting the existing PAGRL block into a structured schema with countable fields whose values create structural contradiction with illegitimate `<Decision>` values, and (c) deterministic gates implemented in shell scripts that intercept artifact writes.

## Decision

We adopted (b) and rejected (a) and (c) for this iteration.

The PAGRL block, previously free prose inside XML tags, becomes a per-phase schema with required fields. Each field exists to block a specific failure mode: `<UnresolvedAmbiguities>` and `<AssumedValues>` block hallucination of requirements; `<ReferencesRead>` blocks self-deception about which manuals were loaded; `<ArtifactPath>` blocks console-dumping; `<TableSchemaSource>` blocks recall of table format from pretraining; `<UserExplicitlyInvokedQuickMode>` and `<TriggerPhrase>` block self-promotion of feature requests into Quick Mode. Advancement between phases is bound to specific field values, not to the orchestrator's textual judgment.

We also removed the Bypass Check entirely. Specify -> Design -> Tasks is uniform; the depth of `design.md` is proportional to the architectural decisions the feature requires (with N/A justified per section), but every feature passes through Design. We added a Default Policy stating that any feature request enters Specify by default, with Quick Mode as the only opt-out and Quick Mode itself gated by a counted entry PAGRL.

We rejected (a) - negative persona - because prose-level reinforcement is the same class of mechanism that already failed (the existing "Anti-Hallucination" rule). Models confidently ignore retorical pressure when their internal probability gradient pushes the other way. Negative persona also has a known sobrecorrection effect (model asks excessive questions on trivial features) and contaminates the general tone of the skill.

We rejected (c) - shell-level gates - because it changes the topology of dag-flow from "purely cognitive orchestration" to "sandboxed validation", introducing a third script alongside `run_dag.sh` and `auditor.sh`. The simplicity of dag-flow is a load-bearing property and we are not willing to sacrifice it for a marginal robustness gain when (b) has not yet been validated. (c) remains available as a future iteration if benchmarks after (b) still show failures.

## Consequences

- **Positive:** the failure modes observed in benchmark `s3-file-upload` are blocked at the schema level: assumed values must be listed and therefore cannot be silently inserted; reference files must be declared and therefore cannot be silently skipped; the artifact path must be a valid `.specs/...` location and therefore cannot be `console`. Trust in dag-flow as a production-grade workflow for organizations is increased because the trace of any feature contains an auditable record of which assumptions were made on what evidence.
- **Positive:** removing the Bypass Check eliminates the meta-permission that leaked across phases. The workflow becomes uniform; the model has no rule to generalize from.
- **Negative:** every feature, including trivial ones, now produces a non-empty `design.md` (with N/A justified per section). This is a small token cost relative to the failure cost it replaces.
- **Negative:** the orchestrator's PAGRL emissions are longer and more structured. This costs tokens per turn; the cost is acceptable for the determinism it buys, and is concentrated in the orchestrator (which runs cheaply) rather than the workers (which do not run PAGRL).
- **Future:** if benchmarks after this change still show phase-skipping or format-improvising, escalate to (c) - shell-level gates intercepting writes to `.specs/...`. This iteration was deliberately the cheapest, simplest step.
