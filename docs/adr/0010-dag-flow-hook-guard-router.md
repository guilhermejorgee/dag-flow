---
status: accepted
---

# dag-flow Hook (Guard + Router)

We implement the dag-flow Hook as **`cli/hooks/dag-flow-guard.mjs`** in the npm CLI package — not in the Compiled Skill. **Guard** blocks writes to functional code paths (`src/`, `lib/`, `api/`, `test/`) unless `DAG_FLOW_WORKER=1` (set by `dag_runner.py` when spawning workers). **Router** on block classifies the user prompt as Quick Mode vs Specify and emits one adaptive message — no session-state detection.

**Hook Wiring Tier** (orchestrator manifest, not runtime name branches): **`pre_tool_use`** — idempotent upsert into `HOOK_CONFIG_PATH` at `HOOK_EVENT` by stable `HOOK_ENTRY_ID` (physical Guard). **`boot_file`** — idempotent append to `BOOT_FILE` with marker `<!-- dag-flow-hook -->` (cognitive rule only). **`none`** — skip wiring; CLI warns. V1: `cursor` → `pre_tool_use`; `antigravity` → `boot_file`.

**Considered options:** Per-runtime `if (cursor)` / `if (antigravity)` in CLI (rejected — use tier protocol); overwrite entire `hooks.json` (rejected — upsert only the `HOOK_ENTRY_ID` entry); shell script in repo root `hooks/dag-flow-src-guard.sh` (rejected — lives in npm CLI).

**Consequences:** `dag init` and `dag update` share the same wiring protocol. Custom manifests inherit tier via `extends`. Tier `boot_file` is honest degradation — no physical enforcement (see limitations in TDD D11).
