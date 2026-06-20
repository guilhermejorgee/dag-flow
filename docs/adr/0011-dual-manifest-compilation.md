---
status: accepted
---

# Dual Manifest Compilation

When orchestrator and worker runtimes differ, `dag init` resolves **two** Runtime Manifests. **Worker manifest** supplies Category A: `CLI_COMMAND_PREFIX`, `AUDITOR_COMMAND_TEMPLATE`, and `dag-config.json` `command_template`. **Orchestrator manifest** supplies Category B/C (`TOOL_RUN_COMMAND`, `TOOL_VIEW_FILE`, `RUNTIME_NAME`), spawn partials via `orchestrator.partials` (e.g. `SPAWN_SUBAGENT_BLOCK` and runtime-specific variants — TDD §5.2), `SKILL_INSTALL_PATH`, and hook wiring fields.

When `--worker` is omitted, one manifest serves both roles (Antigravity and default Cursor parity).

**Considered options:** Single manifest from orchestrator only (rejected — `done_when_gate` in generated DAGs would use orchestrator CLI while `dag_runner` spawns worker CLI → auditor/runner inconsistency).

**Consequences:** `dag manifest scaffold --extends` and custom runtimes must declare worker CLI separately if it differs from the IDE. Compilation order: partials (pass 1) then scalar placeholders (pass 2).
