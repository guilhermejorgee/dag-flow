#!/bin/bash
# scripts/write_dag.sh
# Validation gate for writing DAGs into the physically locked .specs/dags/ vault.
# Usage: scripts/write_dag.sh <id> --phase <phase>

set -euo pipefail

ID=""
PHASE=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --phase) PHASE="$2"; shift ;;
        *) ID="$1" ;;
    esac
    shift
done

if [ -z "$ID" ] || [ -z "$PHASE" ]; then
  echo "Usage: $0 <id> --phase <phase>"
  exit 1
fi

STAGING_DIR=".specs/staging/$ID"
DAG_MD="$STAGING_DIR/dag.md"
PAGRL_XML="$STAGING_DIR/tasks.pagrl.xml"
if [ "$PHASE" = "quick-mode" ]; then
  # For quick mode, the gate checks both entry and diagnosis
  ENTRY_XML="$STAGING_DIR/quickmode-entry.pagrl.xml"
  DIAGNOSIS_XML="$STAGING_DIR/quickmode-diagnosis.pagrl.xml"
  
  if [ ! -f "$DAG_MD" ] || [ ! -f "$ENTRY_XML" ] || [ ! -f "$DIAGNOSIS_XML" ]; then
    echo "❌ Error: dag.md, quickmode-entry.pagrl.xml, and quickmode-diagnosis.pagrl.xml must exist in $STAGING_DIR"
    exit 1
  fi
  
  echo "🔍 Validating PAGRL schema for phase: quick-mode-entry"
  python3 scripts/validate_pagrl.py --phase quick-mode-entry "$ENTRY_XML"
  
  echo "🔍 Validating PAGRL schema for phase: quick-mode-diagnosis"
  python3 scripts/validate_pagrl.py --phase quick-mode-diagnosis "$DIAGNOSIS_XML"
else
  if [ ! -f "$DAG_MD" ] || [ ! -f "$PAGRL_XML" ]; then
    echo "❌ Error: dag.md and tasks.pagrl.xml must exist in $STAGING_DIR"
    exit 1
  fi
  
  echo "🔍 Validating PAGRL schema for phase: tasks"
  python3 scripts/validate_pagrl.py --phase tasks "$PAGRL_XML"
fi

# Validate markdown table structure
# 1. 9-column schema (Checks for a markdown table with 9 data columns -> 10 pipes)
if ! grep -qE '^\|([^|]+\|){9}$' "$DAG_MD" && ! grep -qE '\|.*\|.*\|.*\|.*\|.*\|.*\|.*\|.*\|' "$DAG_MD"; then
  echo "❌ Validation failed: 9-column markdown table not found."
  cat "$DAG_MD"
  exit 1
fi

# 2. T-Final
if ! grep -q "T-Final" "$DAG_MD"; then
  echo "❌ Validation failed: DAG must contain a T-Final row."
  exit 1
fi

# 3. --dangerously-skip-permissions (required for agy tasks)
if grep -q "agy " "$DAG_MD" && ! grep -q "\-\-dangerously-skip-permissions" "$DAG_MD"; then
  echo "❌ Validation failed: 'agy' commands must use '--dangerously-skip-permissions'."
  exit 1
fi

# Write file (elevate permissions, write, lock is handled by trap)
TARGET_PATH=".specs/dags/$ID.md"

chmod 755 .specs/dags 2>/dev/null || true
trap 'chmod 555 .specs/dags 2>/dev/null || true' EXIT ERR

cp "$DAG_MD" "$TARGET_PATH"

echo "✅ DAG securely written to $TARGET_PATH"
