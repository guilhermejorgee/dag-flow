#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# run_all.sh — runs all E2E benchmark scenarios sequentially
#
# Usage:
#   bash run_all.sh [--dry-run] [--mode dag_flow|baseline|both] [workspace_dir]
#
# Modes:
#   dag_flow  — run Socratic dag-flow sessions only (default)
#   baseline  — run plain baseline agents only
#   both      — run both in the same pass
#
# Typical workflow:
#   1. bash run_all.sh --mode dag_flow   workspace/run-XYZ
#   2. bash run_all.sh --mode baseline   workspace/run-XYZ   (reuses same dir)
#   3. Review reports in workspace/run-XYZ/summary/
# ---------------------------------------------------------------------------

DRY_RUN=0
MODE="dag_flow"

while [[ "$1" == --* ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --mode)    MODE="$2"; shift 2 ;;
    *)         echo "Unknown flag: $1"; exit 1 ;;
  esac
done

WORKSPACE_DIR=${1:-"workspace/run-$(date +%s)"}
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SCENARIOS=("s1-escalation" "s2-happy-path-execution" "s3-quick-mode-hotfix" "s3b-quick-mode-planner" "s4-critical-error-escalation" "s5-parallel-tasks-merge" "s6-skill-invocation" "s6b-tasks-planner-skills")

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Execution plan (mode=$MODE):"
  for s in "${SCENARIOS[@]}"; do
    echo "  -> $s"
  done
  exit 0
fi

mkdir -p "$WORKSPACE_DIR"

for s in "${SCENARIOS[@]}"; do
  echo ""
  echo "================================================================"
  echo "=== Running $s (mode=$MODE) ==="
  echo "================================================================"
  if ! bash "$BASE_DIR/harness/run_scenario.sh" --mode "$MODE" "$s" "$WORKSPACE_DIR"; then
    echo "Scenario $s failed."
    read -p "Continue to next scenario? [y/N] " resp
    if [[ "$resp" != "y" && "$resp" != "Y" ]]; then
      echo "Aborting run_all."
      exit 1
    fi
  fi
done

echo ""
echo "All scenarios completed (mode=$MODE)."
python3 "$BASE_DIR/harness/aggregate_report.py" "$WORKSPACE_DIR" --mode "$MODE"
