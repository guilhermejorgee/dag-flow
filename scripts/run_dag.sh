#!/bin/bash
# Independent DAG Runner - DAG-FLOW
# Parses tasks.md, executes stateless Gemini CLI workers, runs auditor, and auto-heals.

TASKS_FILE="${1:-}"

if [ -z "$TASKS_FILE" ]; then
    # Auto-find the only DAG if not specified
    DAG_COUNT=$(ls .specs/dags/*.md 2>/dev/null | wc -l || echo 0)
    if [ "$DAG_COUNT" -eq 1 ]; then
        TASKS_FILE=$(ls .specs/dags/*.md)
        echo "Auto-detected DAG: $TASKS_FILE"
    else
        echo "Usage: $0 <path/to/dag.md>"
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

echo "🚀 Starting DAG Runner for $TASKS_FILE"

# Extract tasks (skip header rows and non-task rows)
# We assume format: | ID | Description | Context Ref | Skill | Depends On | Input Files | Output Files | Done When (Gate) | Status |
grep "^| *T[0-9A-Za-z-]* *|" "$TASKS_FILE" | grep -v "ID" > /tmp/dag_tasks.tmp

while IFS="|" read -u 3 -r empty id desc context_ref skill deps inputs outputs gate status; do
    id=$(echo "$id" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    desc=$(echo "$desc" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    context_ref=$(echo "$context_ref" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    skill=$(echo "$skill" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    deps=$(echo "$deps" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    inputs=$(echo "$inputs" | sed 's/`//g' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    outputs=$(echo "$outputs" | sed 's/`//g' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    gate=$(echo "$gate" | sed 's/`//g' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    status=$(echo "$status" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    if [ -z "$id" ]; then continue; fi

    if [[ "$status" == *"Done"* ]]; then
        echo "⏭️  Skipping Task $id (Already Done)"
        continue
    fi

    echo "========================================"
    echo "⚙️  Executing Task $id: $desc"
    
    ATTEMPT=1
    MAX_ATTEMPTS=3
    SUCCESS=0
    LAST_ERROR=""

    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        echo "🔄 Attempt $ATTEMPT/$MAX_ATTEMPTS for $id..."
        
        # Build prompt
        PROMPT="Execute SDD Task $id. Role: Stateless Worker. Reason: $context_ref. Context: $inputs. Edit: $outputs. Goal: $desc. Do not run tests. Do not update tasks.md."
        if [ -n "$skill" ] && [ "$skill" != "None" ]; then
            PROMPT="$PROMPT Load the skill '$skill' using read_skill from the dag-flow-skills MCP before starting your edit."
        fi
        if [ ! -z "$LAST_ERROR" ]; then
            PROMPT="$PROMPT The previous attempt failed. Fix this error: $LAST_ERROR"
        fi

        # Spawn Worker
        echo "🤖 Spawning Antigravity CLI Worker (Unsandboxed)..."
        agy --dangerously-skip-permissions --prompt "$PROMPT"
        
        # Run Auditor
        echo "🔬 Running Auditor for Task $id..."
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        "$SCRIPT_DIR/auditor.sh" "$id" "$TASKS_FILE" > /tmp/auditor_out.txt 2>&1
        AUDIT_CODE=$?

        if [ $AUDIT_CODE -eq 0 ]; then
            echo "✅ Task $id PASSED the verification gate!"
            SUCCESS=1
            break
        else
            LAST_ERROR=$(cat /tmp/auditor_out.txt)
            echo "❌ Task $id FAILED the verification gate. Error snippet:"
            echo "$LAST_ERROR"
            ATTEMPT=$((ATTEMPT + 1))
        fi
    done

    if [ $SUCCESS -eq 1 ]; then
        # Update Status to Done
        chmod 755 "$(dirname "$TASKS_FILE")" 2>/dev/null || true
        sed -i "s#^| *$id *|.*|.*Pending.*#| $id | $desc | $context_ref | $skill | $deps | \`$inputs\` | \`$outputs\` | \`$gate\` | Done |#" "$TASKS_FILE"
        sed -i "s#^| *$id *|.*|.*Failed.*#| $id | $desc | $context_ref | $skill | $deps | \`$inputs\` | \`$outputs\` | \`$gate\` | Done |#" "$TASKS_FILE"
        chmod 555 "$(dirname "$TASKS_FILE")" 2>/dev/null || true
    else
        echo "🚨 Task $id failed after $MAX_ATTEMPTS attempts. Halting DAG execution."
        chmod 755 "$(dirname "$TASKS_FILE")" 2>/dev/null || true
        sed -i "s#^| *$id *|.*|.*Pending.*#| $id | $desc | $context_ref | $skill | $deps | \`$inputs\` | \`$outputs\` | \`$gate\` | Failed |#" "$TASKS_FILE"
        chmod 555 "$(dirname "$TASKS_FILE")" 2>/dev/null || true
        
        # Error Handoff for Orchestrator Escalation Phase
        LOG_PATH="$(dirname "$TASKS_FILE")/last_failure.log"
        echo "$LAST_ERROR" > "$LOG_PATH"
        echo "🚨 Error logged to $LOG_PATH. Show this path to the Orchestrator."
        
        exit 1
    fi

done 3< /tmp/dag_tasks.tmp

echo "🎉 All tasks executed successfully!"
