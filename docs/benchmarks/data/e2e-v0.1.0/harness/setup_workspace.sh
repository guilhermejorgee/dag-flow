#!/bin/bash
set -e

# Usage: bash setup_workspace.sh <scenario_dir> <workspace_dir> <inject_dag_flow_skill>

SCENARIO_DIR=$1
WORKSPACE=$2
INJECT_SKILL=${3:-0}

if [ -z "$WORKSPACE" ]; then
  echo "Usage: $0 <scenario_dir> <workspace_dir> [inject_dag_flow_skill]"
  exit 1
fi

mkdir -p "$WORKSPACE"

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCENARIO_JSON="$SCENARIO_DIR/scenario.json"

# Read target state and app from scenario.json
TARGET_STATE=$(python3 -c "import sys, json; data=json.load(open(sys.argv[1])); print(data.get('target_state', 'fresh'))" "$SCENARIO_JSON" 2>/dev/null || echo "fresh")
TARGET_APP=$(python3 -c "import sys, json; data=json.load(open(sys.argv[1])); print(data.get('target', 'taskflow-api'))" "$SCENARIO_JSON" 2>/dev/null || echo "taskflow-api")
DEPENDS_ON=$(python3 -c "import sys, json; data=json.load(open(sys.argv[1])); print(data.get('depends_on', ''))" "$SCENARIO_JSON" 2>/dev/null || echo "")

echo "Setting up workspace '$WORKSPACE' (target_state=$TARGET_STATE, target_app=$TARGET_APP)"

# 1. Base files copying
if [ -n "$DEPENDS_ON" ]; then
  # Inherit from a previous scenario's output
  # Assumes workspace structure: workspace_root/scenario_id/with_dag_flow
  WORKSPACE_ROOT="$(dirname "$(dirname "$WORKSPACE")")"
  WORKSPACE_NAME="$(basename "$WORKSPACE")"
  SOURCE_WORKSPACE="$WORKSPACE_ROOT/$DEPENDS_ON/$WORKSPACE_NAME"
  
  if [ ! -d "$SOURCE_WORKSPACE" ]; then
    echo "Error: Dependent workspace not found at $SOURCE_WORKSPACE"
    exit 1
  fi
  
  cp -r "$SOURCE_WORKSPACE/"* "$WORKSPACE/"
  cp -r "$SOURCE_WORKSPACE/".eslintrc.json "$WORKSPACE/" 2>/dev/null || true
else
  # Fresh target
  TARGET_DIR="$BASE_DIR/targets/$TARGET_APP"
  if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target app directory not found at $TARGET_DIR"
    exit 1
  fi
  
  cp -r "$TARGET_DIR/"* "$WORKSPACE/"
  cp -r "$TARGET_DIR/".eslintrc.json "$WORKSPACE/" 2>/dev/null || true
  rm -rf "$WORKSPACE/node_modules" "$WORKSPACE/package-lock.json" 2>/dev/null || true
  if [ -f "$WORKSPACE/package.json" ]; then
    echo "Installing dependencies in workspace..."
    (cd "$WORKSPACE" && npm install --silent)
  fi
fi

# 2. Seed files (for brownfield)
if [ "$TARGET_STATE" == "brownfield" ] && [ -d "$SCENARIO_DIR/seed" ]; then
  echo "Injecting seed files..."
  for file in "$SCENARIO_DIR/seed/"*; do
    if [ -e "$file" ] && [ "$(basename "$file")" != "dags" ]; then
      cp -r "$file" "$WORKSPACE/src/"
    fi
  done
fi

# 3. Seed dags (for execution scenarios)
if [ -d "$SCENARIO_DIR/seed/dags" ]; then
  echo "Injecting seed DAGs..."
  mkdir -p "$WORKSPACE/.specs/dags"
  cp -r "$SCENARIO_DIR/seed/dags/"* "$WORKSPACE/.specs/dags/" 2>/dev/null || true
fi

# 3. Inject dag-flow skill
if [ "$INJECT_SKILL" -eq 1 ]; then
  echo "Injecting dag-flow skill..."
  PROJECT_ROOT="$(cd "$BASE_DIR/../../../../" && pwd)"
  mkdir -p "$WORKSPACE/.agents/skills/dag-flow"
  if [ -f "$PROJECT_ROOT/SKILL.md" ]; then
    cp "$PROJECT_ROOT/SKILL.md" "$WORKSPACE/.agents/skills/dag-flow/"
  fi
  cp -r "$PROJECT_ROOT/references" "$WORKSPACE/.agents/skills/dag-flow/" 2>/dev/null || true
  cp -r "$PROJECT_ROOT/scripts" "$WORKSPACE/.agents/skills/dag-flow/" 2>/dev/null || true
  
  # Double Vaulting Setup
  mkdir -p "$WORKSPACE/.specs/features"
  chmod 555 "$WORKSPACE/.specs/features"
  mkdir -p "$WORKSPACE/.specs/staging"
  chmod 755 "$WORKSPACE/.specs/staging"
  mkdir -p "$WORKSPACE/.specs/dags"
  chmod 555 "$WORKSPACE/.specs/dags"
  
  # Ensure bash gates are executable
  if [ -d "$WORKSPACE/.agents/skills/dag-flow/scripts" ]; then
    chmod +x "$WORKSPACE/.agents/skills/dag-flow/scripts"/*.sh "$WORKSPACE/.agents/skills/dag-flow/scripts"/*.py 2>/dev/null || true
  fi
fi

# 4. Indexing baseline stub (context-mode is a user prerequisite — not dag-flow install)
export hook_indexing_ms=100

# 5. Initialize git repo to ensure git ls-files works for context indexing
(
  cd "$WORKSPACE"
  echo "node_modules/" > .gitignore
  echo "package-lock.json" >> .gitignore
  git init
  git add .
  git config user.email "test@example.com"
  git config user.name "Test User"
  git commit -m "Initial commit" || true
)

# 6. Post-setup hook
if [ -f "$SCENARIO_DIR/post_setup.sh" ]; then
  echo "Running post_setup.sh hook..."
  bash "$SCENARIO_DIR/post_setup.sh" "$WORKSPACE"
fi

echo "Workspace setup complete."
