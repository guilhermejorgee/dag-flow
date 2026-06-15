#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
DAG_JSON="$STAGING_DIR/dag.json"
PAGRL_XML="$STAGING_DIR/tasks.pagrl.xml"
if [ "$PHASE" = "quick-mode" ]; then
  # For quick mode, the gate checks both entry and diagnosis
  ENTRY_XML="$STAGING_DIR/quickmode-entry.pagrl.xml"
  DIAGNOSIS_XML="$STAGING_DIR/quickmode-diagnosis.pagrl.xml"
  
  if [ ! -f "$DAG_JSON" ] || [ ! -f "$ENTRY_XML" ] || [ ! -f "$DIAGNOSIS_XML" ]; then
    echo "❌ Error: dag.json, quickmode-entry.pagrl.xml, and quickmode-diagnosis.pagrl.xml must exist in $STAGING_DIR"
    exit 1
  fi
  
  echo "🔍 Validating PAGRL schema for phase: quick-mode-entry"
  python3 "$SCRIPT_DIR/validate_pagrl.py" --phase quick-mode-entry "$ENTRY_XML"
  
  echo "🔍 Validating PAGRL schema for phase: quick-mode-diagnosis"
  python3 "$SCRIPT_DIR/validate_pagrl.py" --phase quick-mode-diagnosis "$DIAGNOSIS_XML"
else
  if [ ! -f "$DAG_JSON" ] || [ ! -f "$PAGRL_XML" ]; then
    echo "❌ Error: dag.json and tasks.pagrl.xml must exist in $STAGING_DIR"
    exit 1
  fi
  
  echo "🔍 Validating PAGRL schema for phase: TaskPlanning"
  python3 "$SCRIPT_DIR/validate_pagrl.py" --phase TaskPlanning "$PAGRL_XML"
fi

echo "🔍 Extracting JSON DAG..."
python3 "$SCRIPT_DIR/extract_json_dag.py" "$DAG_JSON" "$DAG_JSON"

echo "🔍 Validating DAG coherence..."
python3 "$SCRIPT_DIR/validate_dag_coherence.py" "$DAG_JSON"

# Write file (elevate permissions, write, lock is handled by trap)
TARGET_PATH=".specs/dags/$ID.json"

chmod 755 .specs/dags 2>/dev/null || true
trap 'chmod 555 .specs/dags 2>/dev/null || true' EXIT ERR

cp "$DAG_JSON" "$TARGET_PATH"

echo "✅ DAG securely written to $TARGET_PATH"
