# SDD V2: Specify Phase

The **Specify Phase** represents the bedrock of Spec-Driven Development V2. Its core objective is to systematically eradicate ambiguity before a single line of architecture or code is written.

## Trigger
"Specify feature X", "Plan project", or initiating a new major feature.

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

### 3. Usage of PAGRL
Use the Pre-Action Governance Reasoning Loop (PAGRL) before deciding whether to continue interrogation or advance to the Design phase.

```xml
<PAGRL>
<Intention>Assess if feature specification is complete.</Intention>
<Rules>Are there unresolved edge cases? Is the domain fully modeled in CONTEXT.md?</Rules>
<Reasoning>User has not defined the timeout behavior for the new API.</Reasoning>
<Decision>Ask user about timeout handling; do not advance to Design.</Decision>
</PAGRL>
```

### 4. Zero Execution
During the Specify Phase, the Orchestrator is **FORBIDDEN** from modifying any functional application code (`src/`, `lib/`, etc.). The shadow LLM (`pre-tool-call` hook) enforces this restriction. All writes must be confined to `.specs/` and `CONTEXT.md`.

## Exit Condition
The Specify phase concludes only when all edge cases, domain entities, and requirements are unambiguously resolved. The system then automatically advances to the **Design Phase**.
