#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CLI_ROOT/.." && pwd)"
OUT="$(mktemp -d)"
FAKE_BIN="$(mktemp -d)"
trap 'rm -rf "$OUT" "$FAKE_BIN"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"

cd "$CLI_ROOT"
npm run build --silent

node dist/index.js init \
  --orchestrator=antigravity \
  --target="$OUT" \
  --skill-install-path=skills \
  --project-scaffold=false

GOLDEN="$CLI_ROOT/test/fixtures/antigravity-parity-golden"
COMPILED="$OUT/skills/dag-flow"

diff -ru "$GOLDEN" "$COMPILED" \
  --exclude=dag-config.json \
  --exclude=README.md \
  || { echo "❌ Gate de ouro falhou"; exit 1; }

echo "✅ Paridade Antigravity OK"
