# 🔌 @dag-flow/skills-mcp

High-speed, stateless MCP (Model Context Protocol) server for retrieving skills. Optimized for automated, non-graphical interface CLI shells and containerized workflows.

---

## 🚀 CLI Execution & Execution Modes

This MCP server communicates over standard input/output (`stdio`) and can be launched directly from a shell CLI in three ways:

### 1. Local Built Bundle (Recommended for Local Dev/CI)
Run the compiled JavaScript entry point directly using Node.js:
```bash
node dist/main.js
```
> [!NOTE]
> Make sure to compile the TypeScript source files before running. See [Local Development](#-local-development).



---

## 🤖 Integration into Automated Workflows (e.g. `dag-flow`)

In automated workflows, stateless workers are executed concurrently using CLI-based agent wrappers like `agy` or `gemini`:
```bash
agy --dangerously-skip-permissions --prompt "..."
```

To enable the worker agent to discover and load skills, the MCP server must be declared in the agent's runtime configurations.

### Configuration for CLI Agents

#### A. Gemini CLI / Antigravity (`~/.gemini/antigravity-cli/mcp/`)
Create or edit the MCP config file mapping the server:
```json
{
  "mcpServers": {
    "dag-flow-skills": {
      "command": "node",
      "args": ["/absolute/path/to/dag-flow/mcp/dist/main.js"]
    }
  }
}
```

#### B. Claude Code CLI
Register the local binary directly in Claude's global MCP environment:
```bash
claude mcp add dag-flow-skills -- node /absolute/path/to/dag-flow/mcp/dist/main.js
```

---

## 🛠️ Diagnostics & Manual Shell Testing

To test and verify the MCP tools interactively inside a CLI shell before running automated workloads, use the official MCP Inspector:

```bash
# Build and inspect locally
npx @modelcontextprotocol/inspector node dist/main.js
```

This starts a local developer server with a web interface where you can trigger and test the following tools:

| Tool | Purpose | Primary Inputs |
| :--- | :--- | :--- |
| `list_skills` | Retrieve a compact category-grouped list of all available skills | `explicit_request: true` |
| `search_skills` | Fuzzy search the skill index by task intent (e.g. "error handling") | `query` (string) |
| `read_skill` | Fetch the main `SKILL.md` instructions and list of references | `skill_name` (string) |
| `fetch_skill_files` | Retrieve contents of specific reference files (e.g. scripts/docs) | `skill_name`, `file_paths` (array) |

---

## ⚡ Stderr Logging & Protocol Isolation

> [!IMPORTANT]
> Because the MCP protocol relies strictly on `stdout` for JSON-RPC messages, **all operational logs, warnings, registry fetch attempts, and CDN failures are routed to `stderr`**. This prevents stdout pollution and keeps the automated CLI shell pipeline clean.

---

## 🛠️ Local Development

### Requirements
* Node.js $\ge$ 24

### Build and Watch
Compile the TypeScript sources into the runnable `dist/` bundle:
```bash
# Clean install dependencies
npm ci

# Compile once
npm run build

# Start dev server with Inspector
npm run start:dev:mcp
```
