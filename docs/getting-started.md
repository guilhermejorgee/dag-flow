# Getting Started with dag-flow

This guide will walk you through setting up `dag-flow` and running your first orchestrated feature.

## 1. Prerequisites

Before installing `dag-flow`, ensure your environment meets the core infrastructure requirements:

- **Node.js** (v22+)
- **Git**
- An **Agent CLI runtime** — V1 built-ins: **Antigravity** (`agy`) or **Cursor**. Custom runtimes can be added via [`dag manifest scaffold`](cli-reference.md#dag-manifest-scaffold).

### Required Ecosystem Tools
`dag-flow` relies on a strict token-economy and virtualized context window. Install the required global dependencies:

```bash
# 1. Install context-mode (Provides the sandboxed indexer)
npm install -g context-mode

# 2. Install RTK (Rust Token Killer - Proxies terminal output)
# Note: Ensure you do not have reachingforthejack/rtk installed
# See https://github.com/rtk-ai/rtk for full install options
cargo install rtk-ai
```

`dag init` validates that both `context-mode` and `rtk` are on PATH before proceeding.

---

## 2. Project Installation

Clone the repository and build the local packages (neither is on the npm registry in V1):

```bash
git clone https://github.com/guilhermejorgee/dag-flow.git
cd dag-flow

# Skills MCP Server
cd mcp
npm install
npm run build
npm link    # optional: exposes agent-skills-mcp globally
cd ..

# dag CLI
cd cli
npm install
npm run build
npm link    # exposes the `dag` bin globally
cd ..
```

See [mcp/README.md](../mcp/README.md) for MCP wiring examples.

---

## 3. Runtime Integration

### Skills MCP

Configure your agent runtime with the **absolute path** to `mcp/main.js` (or `agent-skills-mcp` after `npm link`). Examples: [mcp/README.md](../mcp/README.md).

### dag-flow Skill via `dag init`

In your target project root, run `dag init` to compile and install the Agent Skill for your orchestrator:

```bash
cd /path/to/your-project
dag init --orchestrator=cursor       # Cursor IDE
dag init --orchestrator=antigravity  # Antigravity (agy)
```

**What `dag init` does:**

1. **Prerequisites gate** — aborts if `context-mode` or `rtk` are missing from PATH.
2. **Runtime compilation** — resolves `<<<DAG:>>>` placeholders from the runtime manifest and installs a **Compiled Skill** (not the raw repository).
3. **Project Scaffold** — creates `.specs/staging/` (`chmod 755`), `.specs/features/` and `.specs/dags/` (`chmod 555`), idempotently.
4. **Hook wiring** — installs the dag-flow Guard+Router (`dag-flow-guard` in `.cursor/hooks.json` for Cursor, or an HTML-comment block in `GEMINI.md` for Antigravity).
5. **`dag-config.json`** — writes worker `command_template` for `dag_runner.py`.

Use `dag init --force` to overwrite an existing Compiled Skill (local edits are lost). After upgrading the CLI, run `dag update` to recompile markdown and re-wire hooks while preserving your worker command. Full flag reference: [CLI Reference](cli-reference.md).

When orchestrator and worker differ (e.g. Cursor orchestrator with Antigravity workers):

```bash
dag init --orchestrator=cursor --worker=antigravity
```

### Indexing (`context-mode`)

Install and configure `context-mode` separately (prerequisite §1). It is **not** part of dag-flow install.

> **Removed:** `hooks/setup_indexer.sh` mixed dag-flow bootstrap with context-mode indexing. Use `dag init` for project scaffold; install `context-mode` separately (§1).

<details>
<summary><strong>Advanced: manual project topology</strong> (optional — use <code>dag init</code> instead)</summary>

If you skip scaffold creation (`dag init --project-scaffold=false`, common in CI) or prefer to manage layout yourself:

```bash
mkdir -p .specs/staging .specs/features .specs/dags
chmod 755 .specs/staging
chmod 555 .specs/features .specs/dags
```

You are responsible for correct permissions and layout. Copying this repository into a skills directory without `dag init` installs the unresolved **Source Skill** — placeholders will not be resolved and hooks will not be wired.

</details>

---

## 4. Run Your First Feature

Now that the system is configured, you can invoke the Orchestrator to plan and execute a feature.

### Step 1: Trigger the Orchestrator
Open your AI Agent (e.g., Cursor or Antigravity) in the project root and prompt it:

> *"Specify a new feature: I want a user login system with JWT."*

### Step 2: Socratic Interrogation (Specify Phase)
The Orchestrator will **not** write code immediately. It will ask you clarifying questions (e.g., *"How long should the JWT be valid?"*). Answer its questions until it is satisfied. 
Watch as it generates `CONTEXT.md` and `.specs/features/user-login/spec.md`.

### Step 3: DAG Generation (Tasks Phase)
Once the specification is complete, the Orchestrator will output an executable JSON AST DAG. Because the `.specs/dags/` folder is physically locked by the OS (`chmod 555`) to prevent LLM hallucination, the Orchestrator will automatically pipe this JSON through the `scripts/write_dag.sh` gate to safely save it as `.specs/dags/user-login.json`. It will then stop and hand control back to you.

### Step 4: Decentralized Execution (Implement Phase)
You are now ready to execute the plan. Run the independent DAG runner in your terminal:

```bash
./scripts/run_dag.sh .specs/dags/user-login.json
```

**What happens next?**
- You will see the script spawn "dumb" workers in parallel.
- The workers will write the code.
- The `auditor.py` script will run the "Done When" test gates.
- If a test fails, the runner will automatically feed the error back to the worker until it passes.

### Step 5: Delta Update (Living Memory)
When the final task (`T-Final`) completes, the executing worker updates the `context-mode` FTS5 index with the modified files listed in the DAG — keeping your Orchestrator's Living Memory in sync for the next session. This is a deliberate task in the graph, not an automatic background hook.
