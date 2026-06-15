# Theory & Neurocognitive Paradigm

**dag-flow** is built on a foundation of cognitive science, systems engineering, and deliberate constraint design. To understand *why* dag-flow works, it is essential to understand the systemic failures it was designed to solve.

---

## 1. The Collapse of Traditional SDDs

Traditional Multi-Agent Systems (MAS) and Software-Defined Development (SDD) flows fail predictably when applied to complex projects. This failure isn't a limitation of the models themselves, but a failure of the architecture surrounding them.

### Context Exhaustion and Cognitive Laziness
In traditional flows, sub-agents frequently return raw error logs, stack traces, and verbose operational noise directly into the orchestrator's context window. This accumulation saturates the central agent's memory. As the context window fills with noise, the orchestrator begins to ignore architectural guidelines and bypass quality gates—a phenomenon known as **Reward Hacking** or cognitive laziness.

### Epistemic Vulnerability
Models are inherently complacent; they will accept vague requirements and attempt to build them anyway. Because traditional tasks are not mathematically isolated, models fill logical gaps with structural probabilistic hallucinations. These hallucinations often compile successfully but result in catastrophic systemic failures during late-stage integration.

### Synchronization Chaos (Race Conditions)
Linear task lists allow a model to attempt implementation of a feature whose dependency is still being constructed by another agent in parallel. This lack of dependency awareness generates rework, cyclical errors, and deadlocks.

---

## 2. The Neurocognitive Paradigm

To overcome these deficiencies, **dag-flow** abandons the monolithic agent approach. Instead, it implements a model directly inspired by cognitive neuroscience, enforcing a strict separation between executive control and motor function.

### The Prefrontal Cortex (Executive Control)
The **Orchestrator** acts purely in systemic analysis, governance, and architectural decomposition. 
- **Physical revocation:** Its motor access to source files is completely revoked. It cannot write code.
- **Function:** It reasons, interrogates, and plans.

### The Motor System (Execution)
The manual labor is dispatched to "dumb", stateless, and amnesic **Workers**.
- **Function:** They receive atomic directives and strict, limited I/O permissions.
- **Lifecycle:** They are born, they alter the code, and they die. They have no memory of past tasks.

---

## 3. Universal Governance Mechanisms

The system does not operate through free-form trial and error, but through rigorous inhibition and Socratic orchestration.

### The Two-Phase Common Ground Flow (Socratic Interrogation)
Early versions of `dag-flow` relied on syntactic validations (e.g. self-reported `<QuestionsAsked>` tags) to enforce Socratic interrogation. However, extensive stress-testing revealed the **Socratic Bypass**: models would hallucinate questions and simulate user responses in the same turn, bypassing the cognitive pause. 
To eradicate this, `dag-flow` abandoned syntactic tags in favor of a **Physical Turn Break**. The *Specify* phase is divided into two distinct, physically separated steps:
1. **Phase 1 (Surface):** The Orchestrator halts execution, generates a `common_ground.md` file surfacing all implicit assumptions, and forces a hard turn break.
2. **Phase 2 (Steer):** The Orchestrator is mathematically prohibited from proceeding to architecture generation until a human explicitly inputs "Approved".

### The Determinism Rule (Context Blindness)
LLMs suffer from *Context Blindness*—a cognitive failure where semantic instructions ("rewrite the auth middleware to use JWT") lead to destructive regressions in surrounding code. `dag-flow` institutionalizes the **Determinism Rule**: no agent is permitted to perform subjective *string matching* or semantic codebase rewrites. All refactoring and architectural shifts must be delegated through strict physical coordinates (exact line numbers, regex, or AST manipulation).

### PAGRL (Pre-Action Governance Reasoning Loop)
This is a mandatory inhibitory mechanism. Before acting, the model is forced to explicitly declare its intention via a systemic trace (`<PAGRL>`), confronting its desired action with the established architectural rules. This prevents spontaneous deviation from the plan.

### Semantic Gravity and OS-Level Gating
Extensive benchmarking revealed a vulnerability in large language models: **Overconfidence and Few-Shot Ossification**. When a model recognizes a familiar pattern (like "build an auth system"), the gravitational pull of its pretraining data overrides local prompt instructions. No matter how strongly a prompt demands a specific format (e.g., "You MUST output a 9-column markdown table"), the model will eventually improvise. 

To combat this, `dag-flow` implements **Topology Separation and OS-Level Gating**. Instead of relying purely on the LLM's semantic discipline to place files correctly and format them properly, `dag-flow` physically locks the executable DAG directory (`.specs/dags/`) via OS permissions (`chmod 555`). The model is forced to pipe its output through a deterministic bash script (`scripts/write_dag.sh`) that acts as a hard physical gate. If the model hallucinates the schema, the script rejects the input and crashes, providing immediate structural contradiction and forcing a reflexive correction.

---

## 4. Language Alignment Theory

A core tenet of dag-flow is the protection of the domain's language.

### Ubiquitous Language Enforcement
The system dynamically generates a strict glossary (`CONTEXT.md`). This eliminates semantic noise by explicitly forbidding synonyms through inhibitory triggers (e.g., `_Avoid:_`).

### Canonical Protection
This mechanism confines all extractions, negotiations, and systemic nomenclature to the native linguistic rails established by the human developer. It prevents semantic drift and cross-cultural noise during the Orchestrator's interrogation phase.

---

## Original Research

The principles outlined above are summaries. The complete, original research documents detailing the architectural investigations, vulnerability reports, and paradigm shifts that led to the creation of dag-flow are preserved in their original language (Portuguese) in the `/docs/design/` directory.

- See [Design Documents](./design/) for a guide to the original papers.
