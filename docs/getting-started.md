# Getting Started with dag-flow

This guide will walk you through setting up `dag-flow` and running your first orchestrated feature.

## 1. Prerequisites

Before installing `dag-flow`, ensure your environment meets the core infrastructure requirements:

- **Node.js** (v22+)
- **Git**
- An **Agent CLI runtime** (Antigravity, Claude Code, Gemini CLI, or Cursor)

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

---

## 2. Project Installation

Clone the repository to act as your base template or integrate it into your existing project:

```bash
git clone https://github.com/guilhermejorgee/dag-flow.git
cd dag-flow

# Setup the Skills MCP Server (local — not on npm registry)
cd mcp
npm install
npm run build
npm link    # optional: exposes agent-skills-mcp globally
cd ..
```

See [local install (`npm link`)](../planning/multi-runtime-implementation-plan.md#q3--instalação-local-npm-link).

---

## 3. Runtime Integration

### Skills MCP

Configure your agent runtime with the **absolute path** to `mcp/main.js` (or `agent-skills-mcp` after `npm link`). Examples: [mcp/README.md](../mcp/README.md).

### dag-flow skill

Until `dag init` ships ([implementation plan](../planning/multi-runtime-implementation-plan.md)), copy this repository's skill artifacts into your orchestrator's skills path (e.g. `.agents/skills/dag-flow/`).

### Project topology

Create the vault layout manually:

```bash
mkdir -p .specs/staging .specs/features .specs/dags
chmod 755 .specs/staging
chmod 555 .specs/features .specs/dags
```

Or use `dag init` when the CLI is available.

### Indexing (`context-mode`)

Install and configure `context-mode` separately (prerequisite §1). It is **not** part of dag-flow install.

> **Removed:** `hooks/setup_indexer.sh` mixed dag-flow bootstrap with context-mode indexing. Use `dag init` for project scaffold; install `context-mode` separately (§1).

---

## 4. Run Your First Feature

Now that the system is configured, you can invoke the Orchestrator to plan and execute a feature.

### Step 1: Trigger the Orchestrator
Open your AI Agent (e.g., Antigravity or Claude Code) in the project root and prompt it:

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
When the final task (`T-Final`) completes, the indexing hook will silently update the `context-mode` database with the new files. Your Orchestrator is now perfectly in sync for your next feature request!
