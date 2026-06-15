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

# Setup the Skills MCP Server
cd mcp
npm install
npm run build
cd ..
```

---

## 3. Runtime Integration

`dag-flow` must connect to your chosen LLM runtime. We provide a setup script that automatically configures the **Global Indexing Hook** for your specific agent.

Run the setup script from the root of the project:

```bash
./hooks/setup_indexer.sh --runtime <your-runtime>
```

**Supported runtimes:**
- `antigravity` (Generates a `GEMINI.md` boot rule)
- `claude` (Registers the sessionstart hook via Claude Code)
- `gemini-cli` (Registers the sessionstart hook via Gemini CLI)
- `cursor` (Generates an `.mdc` rule for Cursor)
- `codex` / `vscode-copilot`

*(Follow any on-screen instructions provided by the script to restart your runtime).*

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
