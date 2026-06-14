#!/bin/bash
# scripts/update_task_status.sh
# Safely updates a task status in the physically locked .specs/dags/ vault.

set -euo pipefail

DAG_FILE="${1:-}"
TASK_ID="${2:-}"
STATUS="${3:-}"

if [ -z "$STATUS" ]; then
  echo "Usage: $0 <dag_file> <task_id> <status>"
  exit 1
fi

if [ ! -f "$DAG_FILE" ] && [ -f ".specs/dags/$DAG_FILE" ]; then
  DAG_FILE=".specs/dags/$DAG_FILE"
fi

if [ ! -f "$DAG_FILE" ]; then
  echo "❌ Error: Could not find DAG file $DAG_FILE"
  exit 1
fi

# Extract the directory of the DAG file (the vault)
VAULT_DIR="$(dirname "$DAG_FILE")"

# Unlock vault
chmod 755 "$VAULT_DIR" 2>/dev/null || true
trap 'chmod 555 "$VAULT_DIR" 2>/dev/null || true' EXIT ERR

# Update the status (the last column before the final |)
sed -i "s/^\(|[[:space:]]*$TASK_ID[[:space:]]*|.*|\)[^|]*[[:space:]]*|[[:space:]]*$/\1 $STATUS |/" "$DAG_FILE"

echo "✅ Task $TASK_ID updated to '$STATUS' in $DAG_FILE"
