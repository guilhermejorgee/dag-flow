"""
Detect when a dag-flow benchmark session can exit.

Screen-only heuristics miss agents that announce completion in prose without '?'
or without magic phrases. Filesystem checks (DAG run logs all Done) are the
reliable signal once execution has actually finished.
"""

from __future__ import annotations

import glob
import os

# Shown on screen when the agent believes the workflow is done.
SCREEN_COMPLETION_SIGNALS = [
    "Benchmark Complete",
    "Escalation Complete",
    "All tasks Done",
    "DAG execution completed successfully",
    "hotfix execution is complete",
    "Hotfix runner executed successfully",
    "hotfix is complete",
    "verification tests passed",
]


def _log_indicates_done(log_path: str) -> bool:
    try:
        with open(log_path, encoding="utf-8", errors="replace") as f:
            body = f.read()
    except OSError:
        return False
    return "🟢 Done" in body or "Status: Done" in body or "Tests Passed." in body


def dag_execution_complete(workspace_dir: str) -> bool:
    """
    True when at least one DAG run exists and every task log in that run is Done.
    """
    runs_root = os.path.join(workspace_dir, ".specs", "runs")
    if not os.path.isdir(runs_root):
        return False

    for run_name in sorted(os.listdir(runs_root)):
        logs_dir = os.path.join(runs_root, run_name, "logs")
        if not os.path.isdir(logs_dir):
            continue
        log_files = sorted(glob.glob(os.path.join(logs_dir, "*.log")))
        if not log_files:
            continue
        if all(_log_indicates_done(p) for p in log_files):
            return True
    return False


def screen_indicates_complete(content: str) -> bool:
    lowered = content.lower()
    return any(sig.lower() in lowered for sig in SCREEN_COMPLETION_SIGNALS)


def session_complete(workspace_dir: str, screen_content: str) -> bool:
    if dag_execution_complete(workspace_dir):
        return True
    return screen_indicates_complete(screen_content)
