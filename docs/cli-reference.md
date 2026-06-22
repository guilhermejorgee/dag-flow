# CLI Reference

The `dag` command is the npm CLI for dag-flow. It acts as a **Runtime Compiler**: it takes the Source Skill (this repository, with `<<<DAG:NAME>>>` placeholders) and a **Runtime Manifest** that describes your orchestrator/worker pair, and produces a **Compiled Skill** — a fully resolved copy of the skill files configured for your specific runtime. It also creates the Project Scaffold, wires the dag-flow Hook, and writes `dag-config.json` for `dag_runner.py`.

---

## Installation

The CLI is not published to the npm registry in V1. Build and link from the repository:

```bash
git clone https://github.com/guilhermejorgee/dag-flow.git
cd dag-flow/cli
npm install
npm run build
npm link        # exposes the `dag` bin globally
```

`npm link` (or `npm install -g /path/to/cli`) is required so hook upsert can resolve the absolute path of `dag-flow-guard.mjs`.

Global prerequisites checked at `dag init` runtime:

```bash
npm install -g context-mode
cargo install rtk-ai
```

---

## `dag init`

Initialize a project with a Compiled Skill, Project Scaffold, hook wiring, and `dag-config.json`.

### Synopsis

```
dag init [--orchestrator=<id>] [--worker=<id>] [--target=<path>] [--force]
         [--project-scaffold=false] [--skill-install-path=<path>]
```

### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--orchestrator=<id>` | `antigravity` | Built-in runtime ID or external manifest path |
| `--worker=<id>` | Same as `--orchestrator` | Worker runtime when orchestrator ≠ worker (e.g. `--orchestrator=cursor --worker=antigravity`) |
| `--target=<path>` | `process.cwd()` | Root of the project to initialize |
| `--force` | false | Overwrite an existing Compiled Skill (warning: local edits are lost) |
| `--project-scaffold=false` | scaffold on | Skip creating `.specs/` directories (tests, CI) |
| `--skill-install-path=<path>` | From manifest | Override install path from manifest (mainly for isolated tests) |

External manifests are identified by paths containing `/` or `.` (e.g. `dag init --orchestrator=./my-runtime/`).

### Behavior (in order)

1. **Prerequisites gate** — Checks that `context-mode` and `rtk` are on PATH. Aborts with a clear error if either is missing.
2. **Idempotency guard** — If `{target}/{skill_install_path}/dag-flow/` already exists and `--force` is absent, aborts with: *"Use `dag update` to upgrade, or `dag init --force` to overwrite (loses local edits)."* With `--force`, warns and overwrites.
3. **Manifest resolution** — Resolves orchestrator manifest (built-in by ID or external by path). If `--worker` differs from `--orchestrator`, resolves worker manifest separately; otherwise reuses the same manifest.
4. **Compilation** — Two-pass Runtime Compiler:
   - Pass 1: resolves `orchestrator.partials` (e.g. spawn-subagent blocks)
   - Pass 2: resolves scalar placeholders (Category A from worker manifest; B/C from orchestrator manifest)
   - Output: zero `<<<DAG:` strings remaining
   - Scripts: copies only the whitelist (`dag_runner.py`, `auditor.py`, `run_dag.sh`, `commit_spec.sh`, `commit_design.sh`, `write_dag.sh`, `update_task_status.py`, `validate_pagrl.py`, `validate_dag_coherence.py`, `extract_json_dag.py`). Does **not** copy `migrate_*.py`, `test_*.py`.
5. **Project Scaffold** — Unless `--project-scaffold=false`:
   - `mkdir -p .specs/staging && chmod 755`
   - `mkdir -p .specs/features && chmod 555`
   - `mkdir -p .specs/dags && chmod 555`
   - Idempotent: preserves existing content; corrects chmod drift.
6. **Hook wiring** — Reads `orchestrator.hook_wiring_tier` from manifest:
   - `pre_tool_use` → idempotent upsert into hook config (e.g. `.cursor/hooks.json`) by stable entry ID `dag-flow-guard`. Only updates the dag-flow entry; never touches other hooks.
   - `boot_file` → idempotent append to boot file (e.g. `GEMINI.md`) using HTML comment marker `<!-- dag-flow-hook -->`. Replaces the block if marker exists; otherwise appends.
   - `none` → skip with warning.
7. **`dag-config.json`** — Written to the installed skill directory (see [dag-config.json](#dag-configjson)).

### Examples

```bash
dag init --orchestrator=cursor
dag init --orchestrator=antigravity --target=/path/to/project
dag init --orchestrator=cursor --worker=antigravity
dag init --force --orchestrator=cursor
```

---

## `dag update`

Recompile the installed Compiled Skill and re-wire hooks without recreating the Project Scaffold.

### Synopsis

```
dag update [--target=<path>] [--skill-install-path=<path>]
```

### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--target=<path>` | `process.cwd()` | Root of the project to update |
| `--skill-install-path=<path>` | Auto-detected | Override skill path when not using a standard install location |

### Behavior (in order)

1. **Pending DAG Guard** — see [Pending DAG Guard](#pending-dag-guard) below.
2. Locate the installed Compiled Skill by checking `dag-config.json` in `.agents/skills/dag-flow/` and `.cursor/skills/dag-flow/` (or `--skill-install-path`).
3. Read `dag-config.json` to discover orchestrator and worker runtime IDs.
4. Resolve orchestrator and worker manifests from those IDs.
5. Recompile markdown files (same two-pass process as `dag init`). Does **not** recreate the Project Scaffold.
6. Write a new `dag-config.json` preserving `worker.command_template` from the existing config; only updates `_meta.dag_flow_version` to the current CLI version.
7. Re-wire hooks using the same idempotent upsert protocol as `dag init`.

---

### Pending DAG Guard

The Pending DAG Guard is the first step of `dag update` — before any recompilation. It prevents a DAG generated with skill version N from being executed after the skill is updated to version N+1.

**Mechanism:**

1. Reads every `*.json` file in `.specs/dags/` (the vault).
2. Parses each file as a JSON array of task objects.
3. For each task, checks whether `task.status === "Done"`. Any other value — including `"Pending"`, `"Failed"`, or absent (defaults to `"Pending"`) — is a **violation**.
4. If violations exist, aborts with a message listing each violating file, task ID, and status, plus: *"Resolve via Escalation Phase or remove the vault DAG before updating."*
5. If `.specs/dags/` does not exist, the guard passes.

**Why `Failed` blocks the same as `Pending`:**

A `Failed` task means the DAG is in Escalation Phase — recovery relies on worker CLI templates embedded in the DAG's `done_when_gate` commands. Updating the Compiled Skill mid-recovery replaces those templates, creating unpredictable breakage.

**Why abort (not warn):**

Partial update — new skill plus a still-live DAG — is more dangerous than an outdated but consistent skill.

**Resolution paths:**

- Complete all tasks (all show `"Done"`), then run `dag update`.
- If a DAG is irrecoverably failed: delete the `.json` file from `.specs/dags/` (temporarily `chmod 777 .specs/dags/` to remove it), then run `dag update`.

---

## `dag manifest scaffold`

Create a custom runtime manifest by inheriting from a built-in.

### Synopsis

```
dag manifest scaffold --extends=<built-in-id> --output=<path>
```

### Flags

| Flag | Required | Description |
| --- | --- | --- |
| `--extends=<id>` | **Yes** | Built-in runtime to inherit from. V1 built-ins: `antigravity`, `cursor`. |
| `--output=<path>` | **Yes** | Output directory. Its basename becomes the `runtime_id` of the new manifest. |

### Behavior

1. Validates `--extends` is a known built-in.
2. Resolves the parent manifest.
3. Derives `runtime_id` from `path.basename(output)`.
4. Deep-merges parent manifest into child. Sets `worker_validation_status: "pending"` until you validate your worker CLI.
5. Sets `RUNTIME_NAME` placeholder from the `runtime_id` (e.g. `my-runtime` → `My Runtime`).
6. Copies parent partial files into `{output}/partials/`.
7. Writes `manifest.json` to the output directory.

### Error cases

- No `--extends` → `Error: --extends is required. Built-in runtimes: antigravity, cursor`
- Unknown `--extends` → `Error: Unknown built-in runtime "{id}". Built-in runtimes: antigravity, cursor`
- `manifest.json` already exists at output → `Manifest already exists at {path}`
- Invalid output basename (`.`, `..`, `/`) → error

### After scaffolding

1. Edit `manifest.json` — configure `worker.command_template`, `orchestrator.placeholders`, and hook wiring.
2. Validate the worker CLI produces `PASS` on stdout and exits 0.
3. Change `worker_validation_status` from `"pending"` to `"validated"`.
4. Override partial files in `partials/` as needed.
5. Run `dag init --orchestrator=./path/to/my-runtime/`.

---

## `dag-config.json`

Written by `dag init` into the Compiled Skill directory. Read by `dag_runner.py` to spawn workers.

```json
{
  "_meta": {
    "orchestrator": "cursor",
    "worker": "cursor",
    "dag_flow_version": "2.0.0",
    "schema_version": 1
  },
  "worker": {
    "command_template": [
      "cursor", "agent", "--print",
      "--output-format", "text",
      "--trust", "--force", "--approve-mcps",
      "-p", "<<<PROMPT>>>"
    ]
  }
}
```

| Field | Description |
| --- | --- |
| `_meta.orchestrator` | Runtime ID of the installed orchestrator manifest |
| `_meta.worker` | Runtime ID of the worker manifest (may differ from orchestrator) |
| `_meta.dag_flow_version` | Version stamp of the `dag` CLI that last ran `init` or `update`. Set automatically — compare against your installed CLI to know if `dag update` is needed. V1 ships as `2.0.0`. |
| `_meta.schema_version` | Always `1` in V1 |
| `worker.command_template` | CLI argument array. `<<<PROMPT>>>` is replaced with the task prompt at runtime by `dag_runner.py`. |

`dag update` **preserves** `worker.command_template` — user customizations survive upgrades. Only `_meta.dag_flow_version` changes on update.

---

## Built-in Runtimes (V1)

| ID | Orchestrator | Worker | Hook tier | Skill install path |
| --- | --- | --- | --- | --- |
| `antigravity` | Antigravity (`agy`) | `agy --dangerously-skip-permissions` | `boot_file` (appends to `GEMINI.md`) | `.agents/skills` |
| `cursor` | Cursor IDE | `cursor agent --print --output-format text --trust --force --approve-mcps` | `pre_tool_use` (upserts `.cursor/hooks.json`) | `.cursor/skills` |

`claude` is not a V1 built-in (deferred post-V1). Create a custom manifest via `dag manifest scaffold --extends=cursor`.

---

## Advanced: manual project topology

`dag init` creates scaffold by default. To skip it (`--project-scaffold=false`) or manage layout yourself:

```bash
mkdir -p .specs/staging .specs/features .specs/dags
chmod 755 .specs/staging
chmod 555 .specs/features .specs/dags
```

You are responsible for correct permissions. The Orchestrator, Bash gates, and Pending DAG Guard assume this layout. Manual setup does not install a Compiled Skill or wire hooks — use `dag init` for that.
