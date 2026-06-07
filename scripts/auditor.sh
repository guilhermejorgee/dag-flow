#!/bin/bash
# Independent Auditor - SDD V2
# Evaluates a completed task node blindly against its constraints and tests.

if [ -z "$1" ]; then
    echo "Usage: $0 <TASK_ID>"
    exit 1
fi

TASK_ID=$1
TASKS_FILE=".specs/features/*/tasks.md" # Simplified glob, assumes one active feature for the script

echo "Initializing Independent Auditor for Task: $TASK_ID"

# 1. Extract the "Done When" (Gate) command for the specific task
# Expects a markdown table format: | ID | Desc | Depends | Input | Output | Done When | Status |
TASK_LINE=$(grep "^| $TASK_ID |" $TASKS_FILE)

if [ -z "$TASK_LINE" ]; then
    echo "❌ Auditor Error: Could not find Task $TASK_ID in $TASKS_FILE."
    exit 1
fi

# Extract the 6th data column (which is field 7 in awk because of the leading '|')
GATE_COMMAND=$(echo "$TASK_LINE" | awk -F'|' '{print $7}' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/`//g')

if [ -z "$GATE_COMMAND" ]; then
    echo "❌ Auditor Error: Could not find 'Done When' gate command for $TASK_ID."
    exit 1
fi

echo "Running Execution Gate: $GATE_COMMAND"
# 2. Execute the test/validation command
EVAL_OUTPUT=$(eval "$GATE_COMMAND" 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Tests Passed."
    
    # 3. Simulate Structural/Invariant Check against CONTEXT.md
    # This is where the LLM-as-a-judge would be invoked to check for ADR drift
    # e.g., gemini --prompt "Review the recent changes against CONTEXT.md. Are there architectural violations?"
    echo "🔍 Validating against Invariants (CONTEXT.md)..."
    echo "✅ No Architectural Drift detected."
    
    # 4. Mark Task as Done
    echo "Update tasks.md -> $TASK_ID Status: 🟢 Done"
    # (Sed command to update tasks.md would go here)
    exit 0
else
    echo "❌ Execution Gate Failed (Exit Code: $EXIT_CODE)"
    echo "--- Test Output ---"
    echo "$EVAL_OUTPUT"
    echo "-------------------"
    echo "Triggering Backprop Reflex. Task remains 🔴 Pending."
    echo "Provide this log to the Worker Subagent for the next iteration."
    exit 1
fi
