---
status: accepted
---

# Pending DAG Guard

`dag update` aborts if **any** task in **any** file under `.specs/dags/*.json` (the vault) is not `Done` — including `Pending`, `Failed`, or missing status. The vault is the source of truth, not `.specs/runs/` alone.

**Why `Failed` blocks:** Updating the Compiled Skill while a DAG is in Escalation mixes new auditor templates with an execution from the previous skill generation — worse than staying on an older skill until the user resolves or removes the vault DAG.

**Runner obligation:** `dag_runner.py` / `update_task_status.py` must update the **vault** copy (with temporary `chmod` unlock per Bash Gate pattern), not only the run copy under `.specs/runs/`.

**Considered options:** Warn-only on pending DAGs (rejected — partial upgrade); check file existence only (rejected — false positives forever); scan only `runs/` (rejected — ignores never-executed vault DAGs).

**Consequences:** Total abort on guard failure — no partial skill upgrade.
