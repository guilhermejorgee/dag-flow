#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT="$(mktemp -d)"
FAKE_BIN="$(mktemp -d)"
trap 'rm -rf "$OUT" "$FAKE_BIN"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"

if ! command -v dag >/dev/null 2>&1; then
  echo "❌ dag not on PATH — run: cd cli && npm run build && npm link" >&2
  exit 1
fi

dag init --orchestrator=cursor --target="$OUT" --project-scaffold=false

GOLDEN="$CLI_ROOT/test/fixtures/cursor-parity-golden"
COMPILED="$OUT/.cursor/skills/dag-flow"

diff -ru "$GOLDEN" "$COMPILED" \
  --exclude=dag-config.json \
  || { echo "❌ Gate de ouro Cursor falhou"; exit 1; }

echo "✅ Paridade Cursor OK"
