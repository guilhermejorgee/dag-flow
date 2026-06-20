---
status: accepted
---

# Orchestrator / Worker Split

`dag init` accepts `--orchestrator` and optional `--worker` (defaults to orchestrator). Installed **`dag-config.json`** records `_meta.orchestrator`, `_meta.worker`, `dag_flow_version`, `schema_version`, and `worker.command_template` (argv array with `<<<PROMPT>>>` placeholder).

`dag_runner.py` loads `dag-config.json` adjacent to Compiled Skill scripts and fails explicitly if missing. `dag update` recompiles markdown but **preserves** the `worker` section unless the user re-inits with new flags.

**Considered options:** Hardcode worker CLI in Python (rejected); placeholders inside Python source (rejected — JSON is debuggable and syntax-safe).

**Consequences:** Dual-manifest compilation (ADR-0011) is the compile-time mirror of these two CLI flags. Permission flags per worker live in manifest templates — see ADR-0017.
