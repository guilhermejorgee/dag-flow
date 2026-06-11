#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# run_scenario.sh — E2E Benchmark harness
#
# Usage:
#   bash run_scenario.sh [--dry-run] [--mode dag_flow|baseline|both] <scenario_id> [workspace_dir]
#
# Modes:
#   dag_flow  — runs only the dag-flow Socratic session (default)
#   baseline  — runs only the plain baseline agent (one-shot, no skill)
#   both      — runs both sequentially (dag_flow first, then baseline)
# ---------------------------------------------------------------------------

DRY_RUN=0
MODE="dag_flow"

# Parse flags
while [[ "$1" == --* ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --mode)    MODE="$2"; shift 2 ;;
    *)         echo "Unknown flag: $1"; exit 1 ;;
  esac
done

SCENARIO_ID=$1
WORKSPACE_DIR=${2:-"workspace/run-$(date +%s)"}

if [ -z "$SCENARIO_ID" ]; then
  echo "Usage: $0 [--dry-run] [--mode dag_flow|baseline|both] <scenario_id> [workspace_dir]"
  exit 1
fi

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCENARIO_JSON="$BASE_DIR/scenarios/$SCENARIO_ID/scenario.json"

echo "Running scenario: $SCENARIO_ID (mode=$MODE)"
RUN_DIR="$WORKSPACE_DIR/$SCENARIO_ID"
mkdir -p "$RUN_DIR"

# ---------------------------------------------------------------------------
# Setup workspaces
# ---------------------------------------------------------------------------

SETUP_WORKSPACE_SH="$BASE_DIR/harness/setup_workspace.sh"

if [[ "$MODE" == "dag_flow" || "$MODE" == "both" ]]; then
  echo "Setting up with_dag_flow workspace..."
  mkdir -p "$RUN_DIR/with_dag_flow"
  bash "$SETUP_WORKSPACE_SH" "$BASE_DIR/scenarios/$SCENARIO_ID" "$RUN_DIR/with_dag_flow" 1
fi

if [[ "$MODE" == "baseline" || "$MODE" == "both" ]]; then
  echo "Setting up baseline workspace..."
  mkdir -p "$RUN_DIR/baseline"
  bash "$SETUP_WORKSPACE_SH" "$BASE_DIR/scenarios/$SCENARIO_ID" "$RUN_DIR/baseline" 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run complete."
  exit 0
fi

if [ ! -f "$SCENARIO_JSON" ]; then
  echo "ERROR: scenario.json not found at $SCENARIO_JSON"
  exit 1
fi

# ---------------------------------------------------------------------------
# Run dag-flow Socratic session
# ---------------------------------------------------------------------------

if [[ "$MODE" == "dag_flow" || "$MODE" == "both" ]]; then
  echo "Starting dag-flow Socratic session..."
  python3.13 "$BASE_DIR/harness/run_socratic_session.py" \
    --workspace "$RUN_DIR/with_dag_flow" \
    --scenario-json "$SCENARIO_JSON" \
    --mode dag_flow \
    --max-interactions 20 \
    --dag-flow-model "Gemini 3.1 Pro (High)" \
    --emulator-model "Gemini 3.5 Flash (Low)" \
    --log-file "$RUN_DIR/socratic_dag_flow.log"
  echo "dag-flow session complete."
fi

# ---------------------------------------------------------------------------
# Run baseline agent (one-shot, no skill, no Socratic loop)
# ---------------------------------------------------------------------------

if [[ "$MODE" == "baseline" || "$MODE" == "both" ]]; then
  BASE_PROMPT=$(python3 -c "import json, sys; print(json.load(open(sys.argv[1]))['baseline_prompt'])" "$SCENARIO_JSON")
  echo "Starting baseline agent (one-shot)..."
  (cd "$RUN_DIR/baseline" && agy --dangerously-skip-permissions --print "$BASE_PROMPT")
  echo "Baseline agent complete."
fi

# ---------------------------------------------------------------------------
# Grade
# ---------------------------------------------------------------------------

python3 "$BASE_DIR/harness/grade_scenario.py" "$SCENARIO_ID" "$WORKSPACE_DIR" --mode "$MODE"
python3 "$BASE_DIR/harness/judge_scenario.py" "$SCENARIO_ID" "$WORKSPACE_DIR" &
JUDGE_PID=$!
echo "Judge process started with PID $JUDGE_PID"
