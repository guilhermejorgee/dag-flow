# DAG-Flow Cognitive Hardening: Implementation Plan
**Status:** Approved for Execution
**Target:** Executing Agent
**Context:** This plan resolves vulnerabilities identified in `docs/reports/dag-flow-postmortem.md` related to "LLM Complacency". You are to execute this plan exactly as specified.

## 1. Architectural Context & Rationale (The "Why")

The `dag-flow` system relies on "Pessimistic Verification". Currently, the system suffers from three vulnerabilities:
1. **Bypass Socrático & Vazamento de Ambiguidade:** The Specify phase required `<QuestionsAsked>1</QuestionsAsked>`. LLMs bypassed this by hallucinating `1` without asking anything. We realized syntactic XML validation (Bash checking tags) cannot force cognitive honesty.
   - *Definitive Solution:* Implement the **"Two-Phase Common Ground Flow"**. Abolish syntactic checks for questions. Instead, physically split the Specify Phase into two turns. Turn 1: The Orchestrator MUST surface its assumptions (`common_ground.md`) and is FORBIDDEN from running `commit_spec.sh`. It must halt and wait for user approval. Turn 2: Only after human validation, the Orchestrator generates the final spec and runs the gate.
2. **Semantic Gate Falho:** The Tasks phase uses an LLM Auditor (`agy`) to verify text refactoring. The LLM Auditor suffers from Context Blindness and misses residual code.
   - *Solution:* Forbid the use of `agy` for pure string presence/absence checks. Mandate deterministic bash gates (`grep`, `jq`) for textual operations.

---

## 2. Execution Instructions (The "What")

You must modify the following 4 files. Do not modify application code.

### File 1: `scripts/validate_pagrl.py`
**Goal:** Remove the flawed syntactic gate.
- Locate the `validate_specify(root: ET.Element):` function (around line 53).
- **Remove** the block that extracts and validates `QuestionsAsked` as an integer `>= 1`.
- Do not replace it with any new tag validation. The Socratic enforcement is now handled by the physical Turn Break.

### File 2: `references/specify.md`
**Goal:** Redesign the Specify Phase to enforce the Two-Phase Common Ground Flow.
- **Remove:** Any mention of `<QuestionsAsked>`.
- **Rewrite the Phase Execution Rules:** Split the execution into two explicit steps:
  - **Step 1 (Surface):** The Orchestrator generates a `common_ground.md` file in `.specs/staging/[feature]/` detailing: Explicit Directives, Surfaced Assumptions, Paths Not Taken, and Unresolved Ambiguities. The Orchestrator is **STRICTLY FORBIDDEN** from running `commit_spec.sh` at this stage. It must halt execution entirely and ask the user for approval.
  - **Step 2 (Steer & Commit):** After the user says "Approved" (or provides corrections) in the chat, the Orchestrator incorporates the feedback, generates `spec.md` and `spec.pagrl.xml`, and finally executes `commit_spec.sh`.
- **Add Determinism Rule for `<UnresolvedAmbiguities>`:** Add the following strict reflection principle to Step 1:
  *"When planning code changes, reflect critically on the nature of the target: does its location depend on human semantic interpretation, or is it mathematically deducible by a blind machine? Any reliance on subjective interpretation classifies the target as ambiguous. You MUST map semantic intents to absolute literal coordinates (deterministic strings, regular expressions, or AST nodes) before advancing to Design. If the exact coordinates are unknown, you must halt the phase advancement and mandatorily declare the gap in the `<UnresolvedAmbiguities>` block."*

### File 3: `references/tasks.md`
**Goal:** Fix the Semantic Gate failure by hardening the instructions for the Subagent Planner.
- Locate the section **"For Architectural/Complex Tasks (LLM-as-a-judge):"** (around line 107).
- **Add a strict warning/rule:** 
  - "CRITICAL: You are STRICTLY FORBIDDEN from using the LLM Auditor (`agy`) to verify the presence, absence, or replacement of strings, or for purely textual refactoring. LLMs suffer from Context Blindness."
  - "For any task involving text replacement or string verification, you MUST use deterministic shell commands in `done_when_gate` (e.g., `grep -q 'target' file` or `! grep -q 'target' file`)."
  - Keep the `agy` command template only for semantic rules (e.g., "Does this follow SOLID principles?").

### File 4: `SKILL.md` (Root Skill)
**Goal:** Synchronize the Root Skill with the Two-Phase Common Ground Flow.
- Locate the explanation of the Specify Phase (around line 42).
- **Update the Artifact Generation step:** Explicitly state that the Orchestrator must generate `common_ground.md` and wait for user approval *before* generating `spec.md` and running the gate.
- Remove references to `<QuestionsAsked>` in the PAGRL explanation (around line 16) and replace the example with a generic structural contradiction (e.g., `<ADRsRequired>1</ADRsRequired>` and `<Decision>SkipADRs</Decision>`).

---

## 3. Verification & Testing

Once you have applied the modifications:
1. Create a dummy XML file (`test_specify.xml`) that has `<ImplicitAssumptions>Assuming X</ImplicitAssumptions>` but tries to use `<Decision>WriteSpec</Decision>`. 
2. Run `python3 scripts/validate_pagrl.py --phase specify test_specify.xml`. It **MUST FAIL**.
3. Change the XML to `<ImplicitAssumptions>None</ImplicitAssumptions>` and run it again. It **MUST PASS**.
4. Delete the test XML file.
5. Create a `walkthrough.md` detailing the exact code lines changed.
