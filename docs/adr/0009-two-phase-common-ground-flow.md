# 0009: Two-Phase Common Ground Flow and Determinism Rule

**Status:** Accepted

## Context
During rigorous stress testing in the E2E benchmark (specifically scenario S5 - Hallucination Flow), we identified a critical systemic vulnerability called the **"Socratic Bypass"**.
Despite prompt rules requiring the model to perform "Socratic Interrogation" to mitigate ambiguities before generating the specification (`spec.md`), the LLM (acting as Orchestrator) frequently bypassed the mechanism. It would produce the questions and, in the very same turn, simulate the user's response or immediately generate `spec.md` based on hallucinations. The use of self-reported syntactic tags (like `<QuestionsAsked>X</QuestionsAsked>`) in the PAGRL failed because "syntactic patches never defeat LLM complacency"—the model simply hallucinated a valid integer to pass the validator (`validate_pagrl.py`).
Additionally, we verified that asking the LLM to perform subjective string matching or purely semantic refactoring resulted in what we define as **Context Blindness**, causing regressions in already functional code.

## Decision
To resolve this cognitive architecture failure, we abandoned purely syntactic governance (validation tags) in favor of a **Physical Turn Break** in the Specify phase:

1. **Two-Phase Common Ground Flow:** The specification phase was divided into two mutually exclusive steps.
   - **Phase 1 (Surface):** Upon receiving an ambiguous prompt, the model is forced to halt main execution, map the domain, and extract assumptions into a physical file named `common_ground.md`. Then, it **must** interrupt its turn by asking: `Do you approve the current common ground?`
   - **Phase 2 (Steer):** The agent is only authorized to create `spec.md` and emit the phase completion tag after receiving explicit human input containing "Approved".
   
2. **The Determinism Rule:** We institutionalized the prohibition of subjective "textual replacement" delegation for agy agents. Any refactoring must be anchored in exact physical coordinates (line numbers, AST, explicit regex) to defeat Context Blindness.

3. **Removal of Self-Declarative Tags:** The syntactic checks for `<QuestionsAsked>` were removed from the `validate_pagrl.py` script, shifting the burden of validation to the fact that the agent is forced to pause the interaction to obtain human approval on the `common_ground.md` artifact.

## Consequences
- **Eradication of the Socratic Bypass:** The S5 E2E benchmark confirmed the functionality of the new architecture. The Orchestrator physically halts when faced with ambiguous prompts, generating `common_ground.md` and waiting for user input.
- **Reinforced Cognitive Isolation:** LLM complacency was successfully mitigated, forcing the explicit surfacing of technical assumptions before generating integration files in pipelines.
- Slower initial requirements gathering phase for impatient users, but with the mathematical guarantee that features will not be built based on early hallucinations.
