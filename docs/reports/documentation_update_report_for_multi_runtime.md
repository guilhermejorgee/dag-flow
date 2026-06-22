# Documentation Update Report — Multi-Runtime V1

## Scope Confirmation

**Folders NOT read:** `evals/` (benchmarks + mocked `node_modules`), `.agents/skills/` (deprecated manual install artifacts).

**Zero files were modified.** This is a read-only analysis.

**New installation process (confirmed from source):**

```bash
# 1. Global prerequisites (checked at runtime by dag init)
npm install -g context-mode
cargo install rtk-ai

# 2. Clone + build both packages
git clone https://github.com/guilhermejorgee/dag-flow.git
cd dag-flow
cd mcp && npm install && npm run build && npm link && cd ..
cd cli && npm install && npm run build && npm link && cd ..

# 3. Initialize in your project (installs Compiled Skill + scaffold + hooks)
cd /path/to/your-project
dag init --orchestrator=cursor   # or --orchestrator=antigravity
```

---

## Layer 1 — `README.md`

### README.md

**Current State:** Lines 1–80 (badges, intro, problem statement, solution, mermaid diagrams, topology separation, Quick Mode, benchmark section) are architecturally accurate and well-written. The Quick Start section (lines 82–121) is **partially updated**: it already removed `setup_indexer.sh` and added a deprecation note (lines 112–113), but the critical "Wire Your Agent" subsection (lines 104–113) still contains the old manual copy-to-`.agents/skills/` instruction as the primary path, with `dag init` mentioned only as a future alternative.

---

**To Delete:**


| Location | Content                                                                                                                                                                | Why                                                                                                                                                                                                                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line 106 | `"Copy this repository into your orchestrator's skills directory (e.g. .agents/skills/dag-flow/) until dag init ships — track [multi-runtime implementation plan]..."` | `dag init` has shipped. The interim copy instruction is now wrong. It installs the raw Source Skill (with `<<<DAG:>>>` placeholders unresolved) instead of the Compiled Skill.                                                                 |
| Line 108 | `"**Project topology:** Create .specs/staging/ (chmod 755), .specs/features/ and .specs/dags/ (chmod 555), or use dag init when available."`                           | `dag init` always creates the full Project Scaffold now. Manual topology creation is no longer the primary path — it's the fallback for edge cases only. The "or use dag init when available" qualifier should become the primary instruction. |


---

**To Preserve:**


| Lines   | Content                                                                                                                                            | Why                                                                                                                    |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1–80    | Introduction, badges, problem/solution framing, both mermaid diagrams, benchmark table, topology/Quick Mode explanation                            | Core identity of the project. Conceptually accurate. Contains the key "why" that justifies the project.                |
| 85–90   | Prerequisites block (Node.js, context-mode, rtk)                                                                                                   | Correct and complete. These are still global prerequisites that `dag init` validates at startup (Decision D4).         |
| 91–100  | `git clone` + MCP build steps                                                                                                                      | Accurate — MCP install is independent of dag-flow CLI install.                                                         |
| 103–104 | Skills MCP wiring note                                                                                                                             | Accurate — MCP path is runtime-specific and user-configured.                                                           |
| 112–113 | Deprecation note on `setup_indexer.sh`                                                                                                             | Accurate and important for users migrating from old installations. Can be kept or absorbed into the new install steps. |
| 114–121 | Step 4 "Run Your First Feature" section                                                                                                            | Accurate — the runtime workflow (Specify → run_dag.sh) is unchanged.                                                   |
| 124–179 | All remaining sections: Core Feature Pipeline, Standalone Operations, Core Toolchain, Documentation links, Contributing, Research, Author, License | All accurate and architecture-invariant.                                                                               |


---

**To Add/Rewrite:**

The "Step 2: Setup the Project" and "Step 3: Wire Your Agent" sections need to be unified and rewritten. The following structure is proposed:

**Step 2 (rewrite):** Extend the current `git clone` block to also build and link the `dag` CLI:

```bash
git clone https://github.com/guilhermejorgee/dag-flow.git
cd dag-flow

# Skills MCP (local — not on npm registry)
cd mcp && npm install && npm run build && npm link && cd ..

# dag CLI (local — not on npm registry)
cd cli && npm install && npm run build && npm link && cd ..
```

**Step 3 (rewrite):** Replace the "Wire Your Agent" subsection entirely. The new content should cover:

1. **Skills MCP:** (preserve existing bullet — it's accurate)
2. **dag-flow skill (new primary path):** Replace the copy-to-`.agents/skills/` instruction with `dag init`. Explain that `dag init` checks for prerequisites, installs the Compiled Skill (placeholders resolved for the chosen runtime) into the orchestrator's skill path, creates the Project Scaffold, and wires the dag-flow Hook. Show the canonical invocations:
  ```bash
   dag init --orchestrator=cursor       # for Cursor
   dag init --orchestrator=antigravity  # for Antigravity (agy)
  ```
3. **What `dag init` produces (new sub-note):** A short bullet list explaining:
  - Compiled Skill → `{orchestrator-skill-path}/dag-flow/` (e.g., `.cursor/skills/dag-flow/`)
  - Project Scaffold → `.specs/staging/` (755), `.specs/features/` (555), `.specs/dags/` (555)
  - `dag-config.json` → contains worker `command_template` used by `dag_runner.py`
  - Hook wiring → `dag-flow-guard` entry in `.cursor/hooks.json` (Cursor) or append to `GEMINI.md` (Antigravity)
4. **Indexing note:** (preserve as-is — context-mode is a prerequisite, not dag-flow's responsibility)

---

## Layer 1 — `docs/getting-started.md`

### docs/getting-started.md

**Current State:** A fuller version of the README Quick Start. Has the same structural problem: Section 3 "Runtime Integration → dag-flow skill" (lines 54–68) is the primary outdated area. It still instructs users to manually copy artifacts to `.agents/skills/dag-flow/` with "Until `dag init` ships…" language. The manual `mkdir`/`chmod` block is shown as the primary path. Section 4 "Run Your First Feature" (lines 78–109) is mostly accurate, but Step 5 (Delta Update) contains language that implies `context-mode` auto-syncs via an "indexing hook" — this refers to old `setup_indexer.sh` behavior and is now misleading.

---

**To Delete:**


| Location      | Content                                                                                                                                 | Why                                                                                                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lines 54–56   | `"Until dag init ships... copy this repository's skill artifacts into your orchestrator's skills path (e.g. .agents/skills/dag-flow/)"` | `dag init` has shipped. Instruction installs Source Skill with unresolved placeholders. The conditional "Until … ships" is no longer true.                                                                                                                                |
| Lines 60–66   | The primary manual `mkdir`/`chmod` block as main instruction                                                                            | `dag init` creates the Project Scaffold deterministically and idempotently. Manual topology creation should be removed as the primary instruction.                                                                                                                        |
| Line 68       | `"Or use dag init when available."`                                                                                                     | The "or when available" qualifier must be removed. `dag init` is the current primary path, not an alternative.                                                                                                                                                            |
| Lines 107–108 | `"When the final task (T-Final) completes, the indexing hook will silently update the context-mode database"`                           | Refers to `setup_indexer.sh` behavior that has been removed. The T-Final task still exists (it's a task in the DAG), but it does not trigger an "indexing hook" automatically — `context-mode` is a user-managed prerequisite. This sentence creates a false expectation. |
| Line 11       | Gemini CLI listed as an Agent CLI option                                                                                                | `gemini-cli` (the standalone Google CLI) is discontinued as a dag-flow runtime. Default Gemini path is Antigravity (`agy`). The list should be updated.                                                                                                                   |
| Line 83       | `"Open your AI Agent (e.g., Antigravity or Claude Code)"`                                                                               | Claude Code is not a V1 built-in runtime. Cursor is. Should reference Cursor.                                                                                                                                                                                             |


---

**To Preserve:**


| Lines  | Content                                                                 | Why                                                                                            |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 5–24   | Prerequisites section (Node.js, Git, global tools)                      | Accurate and complete.                                                                         |
| 30–44  | Section 2 "Project Installation" (MCP setup)                            | Accurate. MCP install is independent of the CLI.                                               |
| 50–53  | Skills MCP wiring note                                                  | Accurate.                                                                                      |
| 70–74  | Indexing note about `setup_indexer.sh` removal                          | Accurate migration context — preserve.                                                         |
| 78–105 | Steps 1–4 of "Run Your First Feature" (Specify, Design, Tasks, Execute) | Core workflow is runtime-agnostic and accurate. The Specify/Execute/auditor flow is unchanged. |


---

**To Add/Rewrite:**

**Section 3 — Runtime Integration (full rewrite):**

The section needs to be restructured into two sub-sections:

1. **Skills MCP:** (preserve the existing paragraph verbatim)
2. **dag-flow Skill via `dag init` (new primary section):**
  - First, build and link the CLI (if not done in Section 2 — ideally Section 2 is also extended here to include CLI setup):
  - Run `dag init` in the target project:
    ```bash
    cd /path/to/your-project
    dag init --orchestrator=cursor       # Cursor IDE
    dag init --orchestrator=antigravity  # Antigravity (agy)
    ```
  - What `dag init` does (bullets): prerequisites gate (aborts if context-mode or rtk not in PATH), compiles Source Skill with runtime-specific placeholders resolved, installs to `{skill-path}/dag-flow/`, creates Project Scaffold, wires dag-flow Hook, writes `dag-config.json`.
  - Explain `dag init --force` for reinstall and `dag update` for upgrades.

**Section 4, Step 5 (rewrite Delta Update sentence):** Remove the "indexing hook" language. Replace with accurate description: "The T-Final task instructs the executing worker to update the `context-mode` FTS5 index with the modified files, keeping your Orchestrator's Living Memory in sync for the next session."

**Prerequisites, line 11 (minor update):** Remove "Gemini CLI" from the list. The correct V1 list is: `(Antigravity/agy, Cursor)`. If including future/external options: add a note that custom runtimes can be added via `dag manifest scaffold --extends`.

---

## Layer 2 — New `docs/cli-reference.md`

### docs/cli-reference.md (New Document)

**Current State:** Does not exist. There is no existing CLI reference documentation anywhere in `docs/`. The CLI is only described via the planning documents (`multi-runtime-implementation-plan.md`, `tdd-multi-runtime-support.md`) which are implementation-oriented, not user-oriented.

**To Delete:** N/A (new file)

**To Preserve:** N/A (new file)

**To Add/Rewrite:** The following structure should be created:

---

#### Proposed Structure

**Section 1 — Overview**

One paragraph explaining the compilation model:

> `dag` is the npm CLI for dag-flow. It acts as a **Runtime Compiler**: it takes the Source Skill (this repository, with `<<<DAG:NAME>>>` placeholders) and a **Runtime Manifest** that describes your orchestrator/worker pair, and produces a **Compiled Skill** — a fully resolved copy of the skill files, configured for your specific runtime. It also creates the Project Scaffold, wires the dag-flow Hook, and writes `dag-config.json` for `dag_runner.py`.

**Section 2 — Installation**

```bash
git clone https://github.com/guilhermejorgee/dag-flow.git
cd dag-flow/cli
npm install
npm run build
npm link        # exposes the `dag` bin globally
```

Note: Not published to npm registry in V1. `npm link` (or `npm install -g /path/to/cli`) required so the hook upsert can resolve the absolute path of `dag-flow-guard.mjs`.

**Section 3 — `dag init`**

*Synopsis:*

```
dag init [--orchestrator=<id>] [--worker=<id>] [--target=<path>] [--force]
         [--project-scaffold=false] [--skill-install-path=<path>]
```

*Flags table (derived from `cli/src/commands/init.ts`):*


| Flag                          | Default                     | Description                                                                                                                       |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `--orchestrator=<id>`         | `antigravity`               | Built-in or external manifest for the Orchestrator runtime                                                                        |
| `--worker=<id>`               | Same as `--orchestrator`    | Built-in or external manifest for the Worker runtime. Use when orchestrator ≠ worker (e.g., `--orchestrator=cursor --worker=agy`) |
| `--target=<path>`             | `process.cwd()`             | Root of the project to initialize                                                                                                 |
| `--force`                     | false                       | Overwrite an existing Compiled Skill (warning: local edits are lost)                                                              |
| `--project-scaffold=false`    | (scaffold is on by default) | Skip creating `.specs/` directories. Used in tests and CI                                                                         |
| `--skill-install-path=<path>` | From manifest               | Override the install path from the manifest. Mainly for isolated tests                                                            |


*Behavior (in order):*

1. **Prerequisites gate (D4):** Checks that `context-mode` and `rtk` are in PATH. Aborts with a clear error if either is missing.
2. **Idempotency guard (D5):** Checks if `{target}/{skill_install_path}/dag-flow/` already exists. If it does and `--force` is absent, aborts with: `"Use dag update to upgrade, or dag init --force to overwrite (loses local edits)."` If `--force` is set, warns and overwrites.
3. **Manifest resolution:** Resolves orchestrator manifest (built-in by ID or external by path). If `--worker` differs from `--orchestrator`, resolves worker manifest separately; otherwise reuses the same manifest.
4. **Compilation:** Two-pass Runtime Compiler:
  - Pass 1: resolves `orchestrator.partials` (e.g., spawn-subagent blocks)
  - Pass 2: resolves scalar placeholders (Category A from worker manifest; B/C from orchestrator manifest)
  - Output: zero `<<<DAG:` strings remaining
  - Scripts: copies only the whitelist (`dag_runner.py`, `auditor.py`, `run_dag.sh`, `commit_spec.sh`, `commit_design.sh`, `write_dag.sh`, `update_task_status.py`, `validate_*.py`, `extract_json_dag.py`). Does NOT copy `migrate_*.py`, `test_*.py`.
5. **Project Scaffold (D5b):** Unless `--project-scaffold=false`:
  - `mkdir -p .specs/staging && chmod 755`
  - `mkdir -p .specs/features && chmod 555`
  - `mkdir -p .specs/dags && chmod 555`
  - Idempotent: preserves existing content; corrects chmod drift.
6. **Hook wiring (D11):** Reads `orchestrator.hook_wiring_tier` from manifest:
  - `pre_tool_use` → idempotent upsert into `HOOK_CONFIG_PATH` (e.g., `.cursor/hooks.json`) by stable `HOOK_ENTRY_ID = "dag-flow-guard"`. Only updates the `dag-flow-guard` entry; never touches other hook entries.
  - `boot_file` → idempotent append to `BOOT_FILE` (e.g., `GEMINI.md`) using HTML comment marker `<!-- dag-flow-hook -->`. If marker exists, replaces the block; otherwise appends.
  - `none` → skip with `console.warn`.
7. `**dag-config.json`:** Writes to the installed skill directory (see structure below).

---

**Section 4 — `dag update*`*

*Synopsis:*

```
dag update [--target=<path>] [--skill-install-path=<path>]
```

*Flags:*


| Flag                          | Default         | Description                                                       |
| ----------------------------- | --------------- | ----------------------------------------------------------------- |
| `--target=<path>`             | `process.cwd()` | Root of the project to update                                     |
| `--skill-install-path=<path>` | Auto-detected   | Override skill path. Used when not using a standard install path. |


*Behavior (in order):*

1. **Pending DAG Guard** ← detailed below
2. Locate the installed Compiled Skill by checking `dag-config.json` in candidate paths (`.agents/skills/dag-flow/` and `.cursor/skills/dag-flow/`).
3. Read `dag-config.json` to discover the orchestrator and worker runtime IDs.
4. Resolve orchestrator and worker manifests from those IDs.
5. Recompile markdown files (same two-pass process as `dag init`). Does NOT create the Project Scaffold again (scaffold is init-only).
6. Write a new `dag-config.json` preserving `worker.command_template` from the existing config, only updating `_meta.dag_flow_version` to the current CLI version.
7. Re-wire hooks using the same idempotent upsert protocol as `dag init`.

---

**Sub-section: The Pending DAG Guard**

The Pending DAG Guard is the first thing `dag update` does — before any recompilation. It exists to prevent a specific class of inconsistency: *a DAG generated with skill version N being executed after the skill is updated to version N+1*.

**Mechanism (from `cli/src/guards/pending-dag-guard.ts`):**

1. Reads every `*.json` file in `.specs/dags/` (the vault).
2. Parses each file as a JSON array of task objects.
3. For each task, checks whether `task.status === "Done"`. Any other value — including `"Pending"`, `"Failed"`, or absent (defaults to `"Pending"`) — is a **violation**.
4. If violations exist, throws `PendingDagGuardError` with an abort message listing each violating file, task ID, and status, plus a resolution hint: *"Resolve via Escalation Phase or remove the vault DAG before updating."*
5. If `.specs/dags/` does not exist, the guard passes (no DAGs = no violation).

**Why `Failed` blocks the same as `Pending`:**

A `Failed` task means the DAG is in Escalation Phase — the user is still trying to recover it. That recovery relies on the worker CLI templates embedded in the DAG's `done_when_gate` commands. If the Compiled Skill is updated mid-recovery, those templates are replaced with new ones from the updated manifest, creating a state where old DAG tasks reference templates from a different skill version. The result is worse than a stale skill. The user must resolve or remove the DAG before proceeding.

**Why abort totally (not just warn):**

Partial update — new skill + still-live DAG — is architecturally more dangerous than an outdated skill. A outdated skill is *consistently* outdated. A mixed state is unpredictably broken.

**Resolution paths:**

- Complete all tasks (they all show `"Done"`) then run `dag update`.
- If a DAG is irrecoverably failed: delete the `.json` file from `.specs/dags/` (temporarily `chmod 777 .specs/dags/` to remove it), then run `dag update`.

---

**Section 5 — `dag manifest scaffold*`*

*Synopsis:*

```
dag manifest scaffold --extends=<built-in-id> --output=<path>
```

*Flags:*


| Flag              | Required                    | Description                                                                                                                                 |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--extends=<id>`  | **YES** — errors without it | The built-in runtime to inherit from. Errors with list of available built-ins if omitted or unknown. V1 built-ins: `antigravity`, `cursor`. |
| `--output=<path>` | **YES**                     | Output directory. Its basename becomes the `runtime_id` of the new manifest.                                                                |


*Behavior (from `cli/src/commands/manifest/scaffold.ts`):*

1. Validates `--extends` is a known built-in. Errors clearly if not.
2. Resolves the parent manifest.
3. Derives `runtime_id` from `path.basename(options.output)`.
4. Deep-merges parent manifest into child. Inherits all orchestrator/worker fields. Sets `worker_validation_status: "pending"` — the user must validate their worker CLI outputs `PASS` before marking it `"validated"`.
5. Sets `RUNTIME_NAME` placeholder to a formatted version of the `runtime_id` (e.g., `"my-runtime"` → `"My Runtime"`).
6. Copies parent's partial files into `{output}/partials/` — so the child starts with working spawn templates and can override them individually.
7. Writes `manifest.json` to the output directory.

*Error cases:*

- No `--extends` → `"Error: --extends is required. Built-in runtimes: antigravity, cursor"`
- Unknown `--extends` value → `"Error: Unknown built-in runtime "{id}". Built-in runtimes: antigravity, cursor"`
- `manifest.json` already exists at output → `"Manifest already exists at {path}"`
- Output path basename is invalid (`.`, `..`, `/`) → error

*After scaffolding, the user must:*

1. Edit `manifest.json` to configure `worker.command_template`, `orchestrator.placeholders`, and hook wiring fields for their specific runtime.
2. Validate the worker CLI produces `PASS` in stdout and exits 0 (see Worker Runtime Validation Spike in TDD §5.12).
3. Change `worker_validation_status` from `"pending"` to `"validated"`.
4. Override partial files in `partials/` as needed for runtime-specific spawn syntax.
5. Run `dag init --orchestrator=./path/to/my-runtime/` (external manifests are identified by paths starting with `/` or `.`).

---

**Section 6 — `dag-config.json` Reference**

This file is written by `dag init` and read by `dag_runner.py` to know which CLI command to use when spawning workers.

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


| Field                     | Description                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `_meta.orchestrator`      | The runtime ID of the installed orchestrator manifest                                                  |
| `_meta.worker`            | The runtime ID of the worker manifest (may differ from orchestrator)                                   |
| `_meta.dag_flow_version`  | Version of the `dag` CLI that produced this file. Updated by `dag update`.                             |
| `_meta.schema_version`    | Always `1` in V1                                                                                       |
| `worker.command_template` | Array of CLI arguments. `<<<PROMPT>>>` is replaced with the task prompt at runtime by `dag_runner.py`. |


`dag update` **preserves** `worker.command_template` — it never overwrites it. User customizations to the worker command survive upgrades. Only `_meta.dag_flow_version` changes on update.

---

**Section 7 — Built-in Runtimes (V1)**


| ID            | Orchestrator        | Worker                                                                     | Hook Tier                                     | Skill Install Path |
| ------------- | ------------------- | -------------------------------------------------------------------------- | --------------------------------------------- | ------------------ |
| `antigravity` | Antigravity (`agy`) | `agy --dangerously-skip-permissions`                                       | `boot_file` (appends to `GEMINI.md`)          | `.agents/skills`   |
| `cursor`      | Cursor IDE          | `cursor agent --print --output-format text --trust --force --approve-mcps` | `pre_tool_use` (upserts `.cursor/hooks.json`) | `.cursor/skills`   |


Note: `claude` is not a V1 built-in (deferred post-V1). Users can create a custom `claude` manifest via `dag manifest scaffold --extends=cursor`.

---

## Layer 3 — `SKILL.md` and `docs/adr/`

### SKILL.md

**Current State:** Already in V1 Source Skill state. The placeholders `<<<DAG:TOOL_VIEW_FILE>>>`, `<<<DAG:TOOL_RUN_COMMAND>>>`, `<<<DAG:SPAWN_SUBAGENT_SKILL_BLOCK>>>` are correctly present throughout. The Discovery section (lines 95–101) is already **inline** — it contains the ~5-line protocol (`ctx_search` only, synthesize into `CONTEXT.md`) with no reference to `references/discovery.md`. This means **Decision D9 is already implemented** in `SKILL.md`.

---

**To Delete:** Nothing remaining. The key deletions (hardcoded `agy`, `run_command`, `define_subagent`, `view_file`, and the `discovery.md` link) are already gone.

**To Preserve:** Everything. The current file is the correct V1 Source Skill state.

**To Add/Rewrite:** Nothing required in `SKILL.md` itself based on this analysis.

---

**Orphan `discovery.md` references in other docs:**

A grep across all markdown files reveals that `discovery.md` is still referenced in several documents:


| File                                                           | Nature of Reference                                                                      | Action Needed?                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `docs/planning/multi-runtime-implementation-plan.md` (Task 21) | Describes the *task* of deleting `references/discovery.md` — historical planning content | **No** — this is correct historical context; it describes the deletion as a task |
| `docs/reports/multi-runtime-v1-audit-report.md`                | Likely references the V1 change decision                                                 | **No** — audit/report docs reference the change, not dead links to the file      |
| `docs/planning/archive/` (multiple)                            | Historical planning documents                                                            | **No** — archive docs are expected to reference past state                       |
| `CONTEXT.md` line 14                                           | Says *"Protocol lives inline in SKILL.md — no separate `references/discovery.md`"*       | **Correct** — this is an accurate, intentional reference                         |
| `docs/design/tdd-multi-runtime-support.md` D9 section          | Explains the decision to eliminate the file                                              | **Correct** — architectural rationale doc                                        |


**Conclusion:** There are **no orphan links** to `references/discovery.md` in any active user-facing documentation. The file is gone, SKILL.md has the inline protocol, and CONTEXT.md accurately notes the absence.

---

### `docs/adr/` — ADRs 0010–0017

**Current State:** All 17 ADRs (0001–0017) exist in `docs/adr/`. ADRs 0010–0017, covering the Multi-Runtime V1 architecture, have `status: accepted` frontmatter (confirmed for 0010 and 0016; the implementation plan marks all as pre-created with `status: accepted`).

**To Delete:** Nothing.

**To Preserve:** All ADR files as-is.

**To Add/Rewrite:** The primary gap is that no user-facing document lists or indexes the ADRs. The `docs/architecture/architecture.md` and `README.md` reference ADRs conceptually but contain no enumeration. For someone reading the documentation, there is no way to discover which ADRs exist or what they cover without browsing the directory directly.

Two options exist (the report identifies the gap; implementation plan chooses the approach):

**Option A — Add an ADR index section to `docs/architecture/architecture.md`:**
Add a new section (e.g., "## 6. Architecture Decision Records") with a table mapping ADR numbers to titles and short one-line descriptions. This is the minimal change.

**Option B — Create `docs/adr/README.md` (or `index.md`):**
A dedicated ADR index file listing all 17 decisions, grouped by epoch (0001–0009: original architecture; 0010–0017: Multi-Runtime V1).

The new ADRs that are not visible to anyone reading existing docs are:


| ADR  | Title (from filename)               | Topic                                                                               |
| ---- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| 0010 | dag-flow Hook Guard + Router        | Guard/Router tiers, upsert algorithm, boot_file marker                              |
| 0011 | Dual Manifest Compilation           | Category A from worker vs B/C from orchestrator                                     |
| 0012 | Pending DAG Guard                   | Vault as source of truth; Failed = blocks                                           |
| 0013 | Manifest Inheritance                | `extends` deep merge, cycle detection                                               |
| 0014 | Orchestrator/Worker Split           | `--worker` flag, `dag-config.json` schema                                           |
| 0015 | Compiled Skill Scripts Whitelist    | What goes in the installed skill; golden gate rebaseline                            |
| 0016 | V1 Runtime Scope                    | `antigravity` + `cursor`; `claude` deferred post-V1                                 |
| 0017 | Per-Runtime Worker Permission Flags | `--dangerously-skip-permissions` (agy) vs `--trust --force --approve-mcps` (cursor) |


Recommendation: At minimum, update `docs/architecture/architecture.md` to add an ADR index section with these 17 entries. This surfaces the V1 decisions to anyone reading the architecture documentation.

---

## Cross-Cutting Summary


| Doc                                 | Status                                                                                                   | Priority               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| `README.md`                         | Needs update — interim `dag init` language → full `dag init` instructions                                | High                   |
| `docs/getting-started.md`           | Needs update — replace manual copy/chmod with `dag init` as primary path                                 | High                   |
| `docs/cli-reference.md`             | Needs creation — no CLI docs exist; `dag init`, `dag update`, `dag manifest scaffold`, `dag-config.json` | High                   |
| `SKILL.md`                          | Already V1-correct — no changes needed                                                                   | None                   |
| `references/discovery.md`           | Already deleted — no orphan links in active docs                                                         | None                   |
| `docs/adr/0010–0017`                | Exist and `status: accepted` — not indexed in user-facing docs                                           | Medium — add ADR index |
| `docs/architecture/architecture.md` | No V1 ADRs listed — add ADR index section                                                                | Medium                 |
| `CONTEXT.md`                        | Already updated — no changes needed                                                                      | None                   |


