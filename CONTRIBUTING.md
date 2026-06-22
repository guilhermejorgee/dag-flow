# Contributing to dag-flow

First off, thank you for considering contributing to dag-flow! It's people like you that make open-source software such a great community.

## 🧠 Project Philosophy

`dag-flow` is heavily rooted in cognitive science, systems engineering, and strict architectural constraints. Before contributing, please familiarize yourself with the [Theory & Neurocognitive Paradigm](docs/theory.md) and the [Architecture](docs/architecture/architecture.md). 

**The Golden Rule of dag-flow:** *The Orchestrator plans; the Worker executes. They must never mix.*

## 🐛 How to Report Bugs

When submitting a bug report, please include:
1. **Your Runtime:** Cursor, Antigravity (`agy`), or a custom manifest (see [CLI Reference](docs/cli-reference.md)).
2. **The Output Logs:** Provide the isolated `.specs/dags/logs/T[ID].log` if a worker task failed.
3. **The Artifacts:** Provide snippets of the generated `tasks.md` or `.specs/` that caused the issue.
4. **Expected vs Actual Behavior:** Be as specific as possible.

## 💡 How to Suggest Features

Feature requests are welcome! Please open an issue with the `enhancement` label.
If your feature introduces a major structural change or a shift in the cognitive separation paradigm, please draft an **Architecture Decision Record (ADR)** proposal first.

## 🛠️ Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/guilhermejorgee/dag-flow.git
   cd dag-flow
   ```

2. **Understand the Structure:**
   - `docs/` — User-facing documentation (English).
   - `docs/guides/` — Contributor playbooks (English).
   - `docs/design/` — Original research papers, findings, and design documents (Portuguese).
   - `cli/` — Runtime compiler (`dag init`, manifests, golden gates).
   - `scripts/` — The core executors (`dag_runner.py`, `auditor.sh`, `run_dag.sh` wrapper).
   - `hooks/` — Integration scripts for agent runtimes.
   - `mcp/` — The bundled Model Context Protocol server.
   - `SKILL.md` / `references/` — LLM-facing internal prompts.

3. **Install CLI dependencies (if working on multi-runtime):**
   ```bash
   cd cli
   npm install
   npm run build
   npm link
   ```

4. **Install MCP Dependencies (if working on the server):**
   ```bash
   cd mcp
   npm install
   npm run build
   ```

5. **Testing the MCP:**
   ```bash
   npm run build
   npx @modelcontextprotocol/inspector node main.js
   ```
   *(The MCP package has no `npm test` script yet — Jest config exists for future tests.)*

## 🔌 Adding a Built-in Runtime

V1 ships `antigravity` and `cursor`. Adding another **built-in** runtime is a structured process — not just a new manifest file.

Follow the **[New Runtime Implementation Guide](docs/guides/new-runtime-implementation-guide.md)** end to end. Every built-in must have:

- Manifest + worker validation spike (`worker_validation_status: "validated"`)
- Golden fixture captured via `dag init` (not copied from another runtime)
- `cli/scripts/verify-{id}-parity.sh`
- Extensions to `cli/test/golden-gate.test.ts` (central parity contract)
- `cli/test/{id}-manifest.test.ts` for tier/hook/update behavior
- `BUILT_IN_RUNTIMES`, `package.json` `golden-gate:{id}`, and CI workflow step

**Verification before opening a PR:**

```bash
cd cli && npm test
cd cli && npm run golden-gate
```

External manifests (forks, company runtimes) use [`dag manifest scaffold`](docs/cli-reference.md#dag-manifest-scaffold) — Phases 1–3 of the guide apply; built-in CI requirements do not.

## 📝 Code Style & Conventions

- **Python Scripts:** Follow standard `asyncio` patterns for the DAG engine.
- **Bash Scripts:** Use `set -euo pipefail` where applicable. Ensure commands are POSIX-compliant where possible.
- **TypeScript (MCP / CLI):** Standard TypeScript conventions. MCP and CLI build with **esbuild** (`npm run build`). CLI tests use Jest — run `cd cli && npm test` and `npm run golden-gate` before runtime PRs. See [CLI Reference](docs/cli-reference.md) and the [New Runtime Implementation Guide](docs/guides/new-runtime-implementation-guide.md).
- **Documentation:**
  - **User-Facing:** All files in `docs/`, `README.md`, and this file must be written in clear, concise **English**.
  - **Research:** Files in `docs/design/` must be preserved in their original **Portuguese**, as they form the intellectual foundation of the project.
- **LLM Prompts:** Changes to `SKILL.md` or `references/*.md` must be highly token-efficient. Use "Caveman Mode" (ultra-concise grammar) for system rules.

## 📖 The Role of `CONTEXT.md`

When contributing, respect the `CONTEXT.md` file in the root of the project. This file enforces the ubiquitous language of the project. If your PR introduces new concepts, update `CONTEXT.md` with a concise definition and an `_Avoid:_` list.

## 🏛️ Architecture Decision Records (ADRs)

For any significant change to the framework's architecture (e.g., how the Auditor works, how the memory is indexed, changing the T-Final delta update logic), you must document it in `docs/adr/`. 
Follow the format of existing ADRs (Context, Decision, Consequences).

## 🔄 Pull Request Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed the MCP server, ensure `npm run build` succeeds.
4. Ensure your commit messages follow conventional commits (e.g., `feat: add new worker runtime support`, `fix: auditor awk parsing`).
5. Open a PR and describe the "Why" behind your changes.

Thank you for helping build resilient, cognitively-separated AI agents!
