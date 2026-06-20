# 🔌 @dag-flow/skills-mcp

High-speed, stateless MCP (Model Context Protocol) server for retrieving skills. Optimized for automated, non-graphical interface CLI shells and containerized workflows.

> **Not on the npm registry.** Install from this repository: `npm install && npm run build` in `mcp/`, then `npm link` or use an absolute path to `main.js`. See [local install guide](../docs/planning/multi-runtime-implementation-plan.md#q3--instalação-local-npm-link).

---

## 🚀 CLI Execution

This MCP server communicates over standard input/output (`stdio`).

### Local built bundle (recommended)

```bash
npm run build   # outputs main.js in this directory
node main.js
```

---

## 🤖 Integration into Automated Workflows (e.g. `dag-flow`)

In automated workflows, stateless workers are executed concurrently using CLI-based agent wrappers like `agy` or `cursor agent`.

To enable the worker agent to discover and load skills, the MCP server must be declared in the agent's runtime configurations.

### Configuration for CLI Agents

#### A. Gemini CLI / Antigravity (`~/.gemini/antigravity-cli/mcp/`)

```json
{
  "mcpServers": {
    "dag-flow-skills": {
      "command": "node",
      "args": ["/absolute/path/to/dag-flow/mcp/main.js"]
    }
  }
}
```

After `npm link` in `mcp/`, you may use `"command": "agent-skills-mcp"` if that bin is on the runtime's PATH.

#### B. Claude Code CLI

```bash
claude mcp add dag-flow-skills -- node /absolute/path/to/dag-flow/mcp/main.js
```

---

## 🛠️ Diagnostics & Manual Shell Testing

```bash
npm run build
npx @modelcontextprotocol/inspector node main.js
```

| Tool | Purpose | Primary Inputs |
| :--- | :--- | :--- |
| `list_skills` | Compact category-grouped skill list | `explicit_request: true` |
| `search_skills` | Fuzzy search by task intent | `query` (string) |
| `read_skill` | Fetch `SKILL.md` and reference list | `skill_name` (string) |
| `fetch_skill_files` | Fetch reference file contents | `skill_name`, `file_paths` (array) |

---

## ⚡ Stderr Logging & Protocol Isolation

> [!IMPORTANT]
> MCP uses `stdout` for JSON-RPC only. Operational logs go to **`stderr`**.

---

## 🛠️ Local Development

### Requirements

* Node.js ≥ 24

### Build

```bash
npm ci          # or npm install
npm run build   # esbuild → main.js
npm run start:dev   # build + MCP Inspector
```

Optional global link for local development:

```bash
npm link
which agent-skills-mcp
```
