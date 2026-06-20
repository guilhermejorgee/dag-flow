---
status: accepted
---

# Per-Runtime Worker Permission Flags

We extend [ADR-0003](./0003-worker-unsandboxed-cli-execution.md): workers stay unsandboxed for autonomous MCP, shell, and Auditor execution, but **each Worker Runtime declares its own CLI permission flags** in the runtime manifest — there is no shared `--dangerously-skip-permissions` across all workers.

**Context:** Multi-runtime compilation (`dag init`) spawns different worker CLIs from `dag-config.json` `command_template`. Spike S2 (2026-06-20) showed `cursor agent` has no `--dangerously-skip-permissions`; headless workers need `--print` plus `--trust --force --approve-mcps` for parity with ADR-0003 intent. Readers of ADR-0003 alone might wrongly assume every worker uses the `agy` flag.

**Decision — flags in manifest `command_template` and Category A templates:**

| Worker | Permission flags | Notes |
|--------|------------------|-------|
| `agy` (Antigravity) | `--dangerously-skip-permissions` | Unchanged from ADR-0003 |
| `cursor agent` | `--print --output-format text --trust --force --approve-mcps` | Required for headless + MCP; spike-validated 2026-06-20 |
| `claude` (future) | `--dangerously-skip-permissions` + `-p` | Deferred post-V1; same family as `agy` |

`AUDITOR_COMMAND_TEMPLATE` and `dag_runner.py` invocations must use the **same flag prefix** as `command_template` for that worker.

**Considered options:** Reuse `--dangerously-skip-permissions` on Cursor (impossible — flag does not exist); rely on `--print` alone (works in warm workspaces but not guaranteed for cold/CI — rejected).

**Consequences:** Same security trade-off as ADR-0003 applies per runtime. Manifest authors must spike new workers before `worker_validation_status: validated`. Operational detail: TDD §5.12–5.13.
