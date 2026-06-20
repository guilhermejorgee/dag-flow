# Contributing to dag-flow

First off, thank you for considering contributing to dag-flow! It's people like you that make open-source software such a great community.

## 🧠 Project Philosophy

`dag-flow` is heavily rooted in cognitive science, systems engineering, and strict architectural constraints. Before contributing, please familiarize yourself with the [Theory & Neurocognitive Paradigm](docs/theory.md) and the [Architecture](docs/architecture/architecture.md). 

**The Golden Rule of dag-flow:** *The Orchestrator plans; the Worker executes. They must never mix.*

## 🐛 How to Report Bugs

When submitting a bug report, please include:
1. **Your Runtime:** Are you using Claude Code, Cursor, Gemini CLI, or Antigravity?
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
   - `docs/design/` — Original research papers, findings, and design documents (Portuguese).
   - `scripts/` — The core executors (`dag_runner.py`, `auditor.sh`, `run_dag.sh` wrapper).
   - `hooks/` — Integration scripts for agent runtimes.
   - `mcp/` — The bundled Model Context Protocol server.
   - `SKILL.md` / `references/` — LLM-facing internal prompts.

3. **Install MCP Dependencies (if working on the server):**
   ```bash
   cd mcp
   npm install
   npm run build
   ```

4. **Testing the MCP:**
   ```bash
   npm run build
   npx @modelcontextprotocol/inspector node main.js
   ```
   *(The MCP package has no `npm test` script yet — Jest config exists for future tests.)*

## 📝 Code Style & Conventions

- **Python Scripts:** Follow standard `asyncio` patterns for the DAG engine.
- **Bash Scripts:** Use `set -euo pipefail` where applicable. Ensure commands are POSIX-compliant where possible.
- **TypeScript (MCP / CLI):** Standard TypeScript conventions. MCP builds with **esbuild** (`npm run build` → `main.js`). Future `cli/` package uses esbuild + Jest — see [implementation plan](docs/planning/multi-runtime-implementation-plan.md).
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
