---
status: accepted
---

# V1 Runtime Scope

**V1 ships two built-in runtimes:** `antigravity` (golden-gate parity with legacy behavior) and `cursor` (first post-infra multi-runtime target). **`claude` is deferred post-V1** — no built-in manifest, no dedicated implementation phase. Users may add it later via `dag manifest scaffold --extends=cursor` and custom worker CLI.

**gemini-cli** is not a built-in — discontinued; default Gemini path is Antigravity (`agy`).

**Worker validation spike** gates **per-worker manifest publication** only (`worker_validation_status: validated`) — not shared infrastructure. V1 spikes closed for `agy` and `cursor agent` (TDD §12 S1/S2).

**Considered options:** Three mandatory built-ins including `claude` in V1 (rejected — product priority is Cursor after infra); global spike blocking all phases until every CLI is validated (rejected).

**Consequences:** Compiler, `dag init`, scaffold, and Antigravity parity proceed without `claude` CLI. MCP (`mcp/`) unchanged — serves Task Skills, not the Compiled dag-flow skill.
