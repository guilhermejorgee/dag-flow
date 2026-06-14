# Dag-Flow Architectural Update: Handoff for E2E Test Re-evaluation

This document consolidates the recent critical architectural changes made to the `dag-flow` core. Please review the E2E test plan (`research/suite_e2e_implementation_plan.md`) and the test harness to ensure they align with these new rules.

## 1. Global Nomenclature Refactoring
- **"Map Phase" Eradicated:** All legacy references to the "Map Phase" have been completely removed from the project. The phase is now exclusively referred to as the **Discovery Phase** (The Context Discoverer).

## 2. CLI Execution & Permissions (ADR-0003)
- **Unsandboxed CLI Enforcement:** The worker invocation CLI was changed from `gemini` to the Antigravity CLI (`agy`) with explicit sandbox bypassing.
- **Affected Templates:** The templates in `references/tasks.md` and `references/quick-mode.md` have been updated. 
- **The Rule:** The Independent Auditor and the `T-Final` (Living Memory Delta Update) tasks **MUST** be executed using `agy --dangerously-skip-permissions --prompt ...`. This ensures the agents can seamlessly call local MCP tools (like `ctx_index` and `memory_save`) without human approval blocks.

## 3. Decoupling of "Standalone Operations"
- **No Longer a Sequential Phase:** The Discovery Phase and Quick Mode have been removed from the main numerical feature pipeline.
- **The Core Pipeline:** The pipeline is now strictly 4 phases: 
  1. Specify
  2. Design
  3. Tasks
  4. Execute
- **Standalone Operations:** Discovery and Quick Mode are now classified as "Standalone Operations" (administrative/emergency tools) that run completely independent of the feature pipeline.

## 4. Manual Trigger Requirement for Discovery
- **No More Auto-Discovery:** Previously, the Orchestrator would automatically trigger the Discovery phase if `agentmemory` was empty before starting the Specify phase. **This automatic trigger has been removed.**
- **Explicit Invocation:** The Discovery Phase must now be triggered manually and explicitly by the user (e.g., *"Map the architecture of this project"*).
- **Impact on E2E Tests:** Any E2E scenario designed to test the Discovery phase (specifically **S1**, **S2**, and **S4**) must have its automation prompt updated. Instead of just sending *"Specify a new feature..."*, the test harness must send:
  > *"Map the architecture of this project. Then, specify a new feature..."*

## Action Required for Test Agent
1. Review `research/suite_e2e_implementation_plan.md`. The prompts for S1, S2, and S4 have already been updated to include the manual Discovery trigger.
2. Ensure the automated bash harness (`run_scenario.sh`) correctly handles the new two-step prompt for those scenarios.
3. Ensure the grading scripts (`grade_scenario.py`) validate the new `agy --dangerously-skip-permissions` syntax in the generated DAGs.
