#!/usr/bin/env bash
# Session 10 validation — Tasks 21–22: discovery inline + setup_indexer removal
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CLI_ROOT/.." && pwd)"

FAKE_BIN="$(mktemp -d)"
INIT_OUT="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN" "$INIT_OUT"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

echo "=== [critical] build + typecheck ==="
cd "$CLI_ROOT"
npm run build --silent
npm run typecheck
pass "build + typecheck"

echo "=== [critical] session 10 jest suite ==="
npm test -- --runInBand session10-cleanup.test.ts
pass "session10-cleanup jest"

echo "=== [critical] golden gate regression ==="
npm link --silent
"$CLI_ROOT/scripts/verify-antigravity-parity.sh"
pass "antigravity parity golden gate"

echo "=== source artifact guards ==="
test ! -f "$REPO_ROOT/references/discovery.md" || fail "references/discovery.md still exists"
test ! -f "$REPO_ROOT/hooks/setup_indexer.sh" || fail "hooks/setup_indexer.sh still exists"
! rg -q 'discovery\.md' "$REPO_ROOT/SKILL.md" || fail "SKILL.md still links discovery.md"
rg -q 'ctx_search' "$REPO_ROOT/SKILL.md" || fail "SKILL.md missing inline ctx_search protocol"
pass "source artifacts clean"

echo "=== E2E: dag init antigravity compiled skill ==="
node "$CLI_ROOT/dist/index.js" init \
  --orchestrator=antigravity \
  --target="$INIT_OUT" \
  --skill-install-path=skills \
  --project-scaffold=false
test ! -f "$INIT_OUT/skills/dag-flow/references/discovery.md" || fail "compiled discovery.md leaked"
! rg -q 'discovery\.md' "$INIT_OUT/skills/dag-flow/SKILL.md" || fail "compiled SKILL links discovery.md"
rg -q 'Protocol:' "$INIT_OUT/skills/dag-flow/SKILL.md" || fail "compiled SKILL missing Protocol block"
pass "antigravity init compile"

echo "=== E2E: dag init cursor compiled skill ==="
CURSOR_OUT="$(mktemp -d)"
node "$CLI_ROOT/dist/index.js" init \
  --orchestrator=cursor \
  --target="$CURSOR_OUT" \
  --project-scaffold=false
test ! -f "$CURSOR_OUT/.cursor/skills/dag-flow/references/discovery.md" || fail "cursor compiled discovery.md leaked"
! rg -q 'discovery\.md' "$CURSOR_OUT/.cursor/skills/dag-flow/SKILL.md" || fail "cursor SKILL links discovery.md"
pass "cursor init compile"

echo "=== docs: setup_indexer not primary install path ==="
for f in README.md docs/getting-started.md docs/examples.md docs/architecture/architecture.md; do
  if rg -q 'run.*hooks/setup_indexer\.sh|^\s*[0-9]+\.\s+.*setup_indexer' "$REPO_ROOT/$f" 2>/dev/null; then
    fail "$f still instructs setup_indexer as primary step"
  fi
done
rg -q 'Removed:.*setup_indexer' "$REPO_ROOT/README.md" || fail "README missing removal note"
rg -q 'Removed:.*setup_indexer' "$REPO_ROOT/docs/getting-started.md" || fail "getting-started missing removal note"
pass "user docs migration-only setup_indexer mentions"

echo "=== regression: runtime-compiler + cursor-manifest ==="
npm test -- --runInBand runtime-compiler.test.ts cursor-manifest.test.ts
pass "compiler regression"

echo ""
echo "=========================================="
echo "✅ Session 10 validation complete (all checks)"
echo "=========================================="
