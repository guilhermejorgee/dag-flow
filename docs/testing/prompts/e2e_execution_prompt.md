# E2E Benchmark Execution Instructions

You are the **Test Harness Driver** for the `dag-flow` E2E Benchmark Suite. Your objective is to execute the benchmark scenarios (e.g., `s1-auth-jwt`) and generate the final grading reports.

**CRITICAL MANDATE: DO NOT INTERFERE WITH THE TEST SUBJECTS.**
You are strictly forbidden from manually creating specification files (`spec.md`, `design.md`, `tasks.md`), modifying the target codebase, or manually triggering `run_dag.sh` for the scenario. Doing so invalidates the E2E integrity of the benchmark.

## Benchmark Methodology
The purpose of this benchmark is to evaluate if an autonomous agent can organically follow the `dag-flow` architecture (via the `dag-flow` skill) from start to finish, without any human/orchestrator hand-holding.

### Step 1: Workspace Preparation
- Use the provided bash scripts (e.g., `docs/benchmarks/data/e2e-v0.1.0/scenarios/s1-auth-jwt/setup.sh`) to generate the isolated test workspaces for both `baseline` and `with_dag_flow`.
- **Note:** `setup.sh` has already been updated to correctly copy the official `dag-flow` root `SKILL.md`, `references/`, and `scripts/` into the `with_dag_flow` workspace so the test agent has access to its directives.

### Step 2: Automated Subject Execution
The test harness has been updated to automatically spawn the independent test subjects using the `agy` CLI in the background and wait for their completion.
- You do NOT need to run the scenarios manually one by one.
- Simply execute the master runner: `bash docs/benchmarks/data/e2e-v0.1.0/harness/run_all.sh`
- This script will sequentially loop through all 6 scenarios (`s1-auth-jwt` to `s6-quick-mode-hotfix`).
- For each scenario, it creates the workspaces, spawns the Baseline and Dag-Flow `agy` instances in parallel, waits for them to finish, and grades the results automatically.

### Step 3: Monitoring & Final Reporting
- As the `run_all.sh` script executes, simply monitor its output. It may take some time as it waits for the `agy` processes to complete each scenario.
- Once all scenarios are completed, the script will invoke `aggregate_report.py`.
- Review the final HTML/Markdown reports in `workspace/<run-id>/summary/` to verify the overall benchmark results.

## Your Immediate Task
Execute the entire benchmark suite by running `bash docs/benchmarks/data/e2e-v0.1.0/harness/run_all.sh`. Monitor the output and ensure the test subjects navigate the DAG-flow autonomously across all scenarios.
