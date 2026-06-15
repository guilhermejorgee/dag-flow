# Design: parallel-runner

## Solution Components
- `dag_runner.py`: A Python script that parses `tasks.md`, uses an adjacency list to build the dependency graph. It will use Python's `asyncio` and `asyncio.create_subprocess_exec` to spawn workers concurrently.
- `Worker Pool`: An `asyncio.Semaphore(MAX_WORKERS)` to limit concurrency (default 3, overridable by `DAG_FLOW_MAX_WORKERS` environment variable).
- `Isolated Logging`: Subprocesses will have stdout/stderr redirected to opened file handles for `.specs/dags/logs/T[ID].log`.
- `run_dag.sh`: Modified to be a CLI wrapper delegating directly to `dag_runner.py`.

## Patterns Reused
- CLI execution via `run_dag.sh` (existing pattern for user interaction).
- Auditor validation: `auditor.sh` is still executed after the `agy` worker finishes, per task.

## New Patterns Introduced
- Async Subprocess Orchestration: Replaces synchronous bash loop.
- Isolated File Logging: stdout/stderr is no longer streamed to the terminal, but written to per-task log files.

## Cross-Cutting Concerns
- Observability: Handled by Isolated File Logging. Main terminal only shows status changes (Running, Done, Failed).
- Error Handling: Implements Drain-running. If a task fails (attempts exhausted), a global `CancellationToken` or event is set, preventing new tasks from acquiring the Semaphore, but allowing running tasks to finish.
- Rate Limiting: Handled implicitly by the Worker Pool semaphore limiting the number of concurrent `agy` processes hitting the LLM.

## ADRs Required
- N/A: The core architectural shift from sequential bash to parallel Python was already decided and documented in the Specify Phase via `CONTEXT.md` definitions. The implementation specifics do not represent a new fundamental trade-off requiring a separate ADR.

## Confidence
High confidence. The `asyncio` module with `Semaphore` and `create_subprocess_exec` is a standard, robust pattern for this exact problem space.
