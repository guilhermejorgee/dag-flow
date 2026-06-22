#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# scripts/commit_design.sh
# Validation gate for writing designs into the physically locked .specs/features/ vault.

set -euo pipefail

FEATURE="$1"
if [ -z "$FEATURE" ]; then
  echo "Usage: $0 <feature_name>"
  exit 1
fi

STAGING_DIR=".specs/staging/$FEATURE"
VAULT_DIR=".specs/features/$FEATURE"

DESIGN_MD="$STAGING_DIR/design.md"
PAGRL_XML="$STAGING_DIR/design.pagrl.xml"

if [ ! -f "$DESIGN_MD" ] || [ ! -f "$PAGRL_XML" ]; then
  echo "❌ Error: Both design.md and design.pagrl.xml must exist in $STAGING_DIR"
  exit 1
fi

# 1. Run Python validation
echo "🔍 Validating PAGRL schema for phase: design"
python3 "$SCRIPT_DIR/validate_pagrl.py" --phase design "$PAGRL_XML"

# 2. Unlock vault, move files, and lock
chmod 755 .specs/features 2>/dev/null || true
mkdir -p "$VAULT_DIR"
chmod 755 "$VAULT_DIR" 2>/dev/null || true

# Trap to guarantee the vault is locked even if the script crashes
trap 'chmod 555 .specs/features 2>/dev/null || true; chmod 555 "$VAULT_DIR" 2>/dev/null || true' EXIT ERR

mv "$DESIGN_MD" "$VAULT_DIR/"
mv "$PAGRL_XML" "$VAULT_DIR/"

echo "✅ Design securely written to $VAULT_DIR"
