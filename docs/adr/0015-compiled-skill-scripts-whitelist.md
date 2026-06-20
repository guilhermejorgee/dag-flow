---
status: accepted
---

# Compiled Skill Scripts Whitelist

The runtime compiler copies only an explicit **whitelist** of `scripts/` into the Compiled Skill — operational pipeline files, not dev tooling.

**Include:** `dag_runner.py`, `auditor.py`, `run_dag.sh`, `commit_spec.sh`, `commit_design.sh`, `write_dag.sh`, `update_task_status.py`, `validate_*.py`, `validate_pagrl.py`, `extract_json_dag.py`.

**Exclude:** `migrate_*.py`, `test_*.py`, and any other scripts not on the whitelist.

**Golden gate:** `verify-antigravity-parity.sh` diffs compiled output against `cli/test/fixtures/antigravity-parity-golden/` — **not** a full manual repo copy to `.agents/skills/`. `dag-config.json` is excluded from the diff (new artifact).

**Considered options:** Copy entire `scripts/` tree (rejected — manual install was defective process, not spec); blacklist-only filtering (rejected — whitelist is explicit and auditable).

**Consequences:** Users never receive migrate/test scripts in the installed skill. Parity baseline was rebaselined to this set.
