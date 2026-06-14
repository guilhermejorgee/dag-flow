# Enhance Discovery Phase to Support Feature-Impact Discovery

The user identified a critical architectural blind spot: `dag-flow` currently performs *Global Discovery* (mapping invariants) but fails to perform *Feature-Specific Discovery* (mapping the impact surface of a new feature) before starting the Specify phase. As a result, Socratic Interrogation happens in a technical vacuum, focusing purely on business logic without awareness of the existing code constraints.

This plan elevates the Discovery Phase to execute on **every** feature request, mapping the "blast radius" of the requested feature so that the Orchestrator can ask technically grounded Socratic questions.

## User Review Required

> [!IMPORTANT]
> The Orchestrator will now execute `ctx_search` at the start of EVERY feature request (even if the project is already mapped globally) to determine the "blast radius" of the feature *before* it begins Socratic Interrogation. Does this align perfectly with your vision?

## Proposed Changes

---

### Phase Definitions

#### [MODIFY] [SKILL.md](file:///home/guilherme/%C3%81rea%20de%20trabalho/Repos/dag-flow/SKILL.md)
Modify Phase 2 (Discovery) to explicitly mandate a dual-discovery process:
1. **Global Discovery:** (Existing) Runs only if the agent is blind to establish Architectural Invariants.
2. **Feature-Impact Discovery:** (New) Runs on **every** feature request to map the exact files and dependencies affected by the user's request using `ctx_search`.

#### [MODIFY] [references/discovery.md](file:///home/guilherme/%C3%81rea%20de%20trabalho/Repos/dag-flow/references/discovery.md)
Add a dedicated section for **Feature-Impact Discovery**.
- Instruct the Orchestrator to use `ctx_search` to find existing files related to the requested feature.
- Establish the "blast radius" (which files need to be modified, which dependencies exist).
- The Orchestrator must hold this context in its working memory to feed the Specify phase.

#### [MODIFY] [references/specify.md](file:///home/guilherme/%C3%81rea%20de%20trabalho/Repos/dag-flow/references/specify.md)
Update the **Socratic Interrogation** rules.
- The Orchestrator must now use the findings from the Feature-Impact Discovery to ask *code-grounded* questions alongside business rules.
- Explicitly state that Socratic questions must reference the actual files discovered in the previous phase (e.g., "I see `src/auth.js` uses JWT. Should we refactor it?").

## Verification Plan

### Manual Verification
- We will trigger a new feature request on the project.
- We will verify that the Orchestrator's very first action is executing `ctx_search` to investigate the impact surface.
- We will verify that the Orchestrator's first Socratic question incorporates technical awareness of the existing codebase.
