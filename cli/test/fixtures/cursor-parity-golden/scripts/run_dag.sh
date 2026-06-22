#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Independent DAG Runner - DAG-FLOW
# CLI Wrapper delegating to python dag_runner.py

TASKS_FILE="${1:-}"

if [ -z "$TASKS_FILE" ]; then
    DAG_COUNT=$(ls .specs/dags/*.json 2>/dev/null | wc -l || echo 0)
    if [ "$DAG_COUNT" -eq 1 ]; then
        TASKS_FILE=$(ls .specs/dags/*.json)
        echo "Auto-detected DAG: $TASKS_FILE"
    else
        echo "Usage: $0 <path/to/dag.json>"
        echo "Note: Looks in .specs/dags/ automatically if only filename is provided."
        exit 1
    fi
fi

if [ ! -f "$TASKS_FILE" ] && [ -f ".specs/dags/$TASKS_FILE" ]; then
    TASKS_FILE=".specs/dags/$TASKS_FILE"
fi

if [ ! -f "$TASKS_FILE" ]; then
    echo "❌ Error: Could not find tasks file: $TASKS_FILE"
    exit 1
fi

python3 "$SCRIPT_DIR/dag_runner.py" "$TASKS_FILE"
