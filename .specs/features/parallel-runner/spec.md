# Parallel Execution Engine (DAG Runner)

## Problem Statement
The current `run_dag.sh` executes tasks strictly sequentially. To support concurrent independent tasks (e.g., benchmark `e2e-v0.2.0`), we need true topological parallelism based on the `Depends On` column in the DAG table.

## Requirements
- Parse the DAG markdown table to build a directed dependency graph.
- Execute tasks with satisfied dependencies concurrently.
- Replace the pure bash `while` loop with a Python `dag_runner.py` executor.
- Isolate stdout/stderr into separate log files (`.specs/dags/logs/T[ID].log`) to prevent terminal interleaving and race conditions during failure.
- Implement a Fail-safe/Drain-running policy: if a task fails 3 times, let running parallel tasks finish gracefully before halting the DAG. No new tasks should be dispatched.
- Implement a Worker Pool concurrency limit, defaulting to 3 concurrent tasks to prevent resource exhaustion, configurable via environment variable.
