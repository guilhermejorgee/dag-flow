#!/bin/bash
set -euo pipefail

WORKSPACE="$1"
SCENARIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing s6b Tasks planner fixtures..."

cp "$SCENARIO_DIR/seed/test.js" "$WORKSPACE/"

mkdir -p "$WORKSPACE/.dag-flow/skills"
cp -r "$SCENARIO_DIR/seed/.dag-flow/skills/"* "$WORKSPACE/.dag-flow/skills/"

mkdir -p "$WORKSPACE/.specs/features/auth-header"
cp "$SCENARIO_DIR/seed/features/auth-header/spec.md" "$WORKSPACE/.specs/features/auth-header/"
cp "$SCENARIO_DIR/seed/features/auth-header/design.md" "$WORKSPACE/.specs/features/auth-header/"

chmod 555 "$WORKSPACE/.specs/features" 2>/dev/null || true

echo "s6b fixtures ready: vaulted spec/design, custom-security-linter skill, test.js"
