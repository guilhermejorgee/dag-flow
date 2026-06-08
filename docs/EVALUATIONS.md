# Evaluated Benchmark: The RBAC API Showdown

## 📖 The "Monolithic Dumping" Problem
As Large Language Models (LLMs) expand their context windows, developers increasingly rely on conversational agents to build entire features in a single prompt. While this works for trivial scripts, it fails catastrophically for complex architectures.

We call this **Monolithic Dumping**: The LLM attempts to satisfy all constraints at once, resulting in tightly coupled "spaghetti code", hallucinated variables, and test suites that are biased because the same neural network context that wrote the bug also wrote the test.

To prove that `dag-flow` solves this, we conducted an End-to-End Evaluation.

---

## ⚔️ The Test: Role-Based Access Control (RBAC) API
We asked two isolated agents to build an RBAC system in Node.js/Express. 

**The Requirements:**
- `POST /login` (returns JWT).
- Role hierarchy: Admin, Editor, Viewer.
- Middlewares to decode JWT and guard routes.
- `GET /admin-data` (Admin only) & `GET /editor-data` (Admin/Editor).
- Native unit tests covering authorization failures and successes.

### 🚜 Scenario 1: Baseline Agent (Conversational LLM)
We provided the exact requirements to a top-tier LLM Agent without orchestration skills.

**The Result:** The LLM successfully passed the prompt constraints, but produced a monolithic nightmare. It dumped the database mock, the authentication middleware, the role-guarding logic, and all Express routes into a single ~150-line `app.js` file.
- **Architectural Scalability:** 0/10. If the project scales, the LLM will lose the thread and hallucinate inside the monolith.
- **Test Bias:** High. The agent wrote the code and the tests in the same context window.

### ⚙️ Scenario 2: `dag-flow` (Orchestrated SSD V2)
We provided the exact same requirements to an Agent equipped with the `dag-flow` skill, forcing it to act as an Orchestrator.

**The Result:**
1. **Domain Isolation:** The Orchestrator mapped the requirements and generated a strict `CONTEXT.md` and `spec.md`.
2. **Architectural Design:** It generated a `design.md` deciding to split the logic.
3. **Execution DAG:** It generated an executable `tasks.md` separating the DB, the middlewares, the routes, and the tests into atomic tasks.
4. **Decentralized Workers:** The `run_dag.sh` script dispatched stateless CLI workers to write each file in isolation.
5. **Independent Auditing:** The tests (`api.test.js`) were written by a worker that had *only* the finished `app.js` in its context, eliminating test bias.

**Output Structure:**
```text
.specs/
src/
  ├── db.js          # Isolated persistence
  ├── middleware.js  # Isolated JWT/RBAC guards
  ├── app.js         # Clean Express router
test/
  └── api.test.js    # Unbiased native tests
```

---

## 🏆 Conclusion
`dag-flow` is not just an automation script; it is an **Architectural Skill**. It forces the AI to behave like a Senior Staff Engineer (planning and isolating domains) rather than a Junior Developer blindly typing code.

By breaking the problem into a Directed Acyclic Graph (DAG) of atomic, audited steps, `dag-flow` guarantees that your AI-generated codebase remains modular, scalable, and mathematically verified, regardless of the LLM's context window size.

> **Verify it yourself:** The raw outputs of both agents are preserved in this repository at `research/benchmarks/rbac-api-showdown/`.
