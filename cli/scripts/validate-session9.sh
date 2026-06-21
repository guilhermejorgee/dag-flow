#!/usr/bin/env bash
# Session 9 validation — Task 19 dag manifest scaffold
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CLI_ROOT/.." && pwd)"

FAKE_BIN="$(mktemp -d)"
SCAFFOLD_RUNTIME="$(mktemp -d)/acme-runtime"
INIT_TARGET="$(mktemp -d)"
AGY_INIT_TARGET="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN" "$INIT_TARGET" "$AGY_INIT_TARGET" "$(dirname "$SCAFFOLD_RUNTIME")" "$(dirname "$AGY_RUNTIME")"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"
run_dag() { node "$CLI_ROOT/dist/index.js" "$@"; }

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

echo "=== [critical] build + typecheck ==="
cd "$CLI_ROOT"
npm run build --silent
npm run typecheck
pass "build + typecheck"

echo "=== [critical] jest manifest-scaffold suite ==="
npm test -- --runInBand manifest-scaffold.test.ts
pass "manifest-scaffold jest"

echo "=== E2E: scaffold cursor happy path ==="
run_dag manifest scaffold --extends=cursor --output="$SCAFFOLD_RUNTIME"
test -f "$SCAFFOLD_RUNTIME/manifest.json" || fail "manifest.json missing"
test -f "$SCAFFOLD_RUNTIME/partials/spawn-subagent.md" || fail "spawn partial missing"
python3 - <<PY
import json
m = json.load(open("$SCAFFOLD_RUNTIME/manifest.json"))
assert m["extends"] == "cursor"
assert m["runtime_id"] == "acme-runtime"
assert m["worker"]["worker_validation_status"] == "pending"
PY
pass "cursor scaffold structure"

echo "=== E2E: scaffold without --extends errors ==="
SCAFFOLD_ERR=$(run_dag manifest scaffold --output="$SCAFFOLD_RUNTIME/err" 2>&1) && fail "expected missing --extends to fail"
echo "$SCAFFOLD_ERR" | grep -q -- '--extends is required' || fail "missing extends message"
echo "$SCAFFOLD_ERR" | grep -q 'antigravity, cursor' || fail "built-in list missing"
pass "missing --extends error"

echo "=== E2E: scaffold unknown extends errors ==="
SCAFFOLD_BAD=$(run_dag manifest scaffold --extends=claude --output="$SCAFFOLD_RUNTIME/bad" 2>&1) && fail "expected unknown extends to fail"
echo "$SCAFFOLD_BAD" | grep -q 'Unknown built-in runtime "claude"' || fail "unknown extends message"
pass "unknown --extends error"

echo "=== E2E: scaffold antigravity copies three partials ==="
AGY_RUNTIME="$(mktemp -d)/agy-custom"
run_dag manifest scaffold --extends=antigravity --output="$AGY_RUNTIME"
for f in spawn-subagent.md spawn-subagent-skill.md spawn-subagent-quick.md; do
  test -f "$AGY_RUNTIME/partials/$f" || fail "missing partial $f"
done
pass "antigravity scaffold partials"

echo "=== E2E: scaffold antigravity → dag init boot_file tier ==="
run_dag init --orchestrator="$AGY_RUNTIME" --target="$AGY_INIT_TARGET" --project-scaffold=false
test -f "$AGY_INIT_TARGET/.agents/skills/dag-flow/SKILL.md" || fail "antigravity skill missing"
test -f "$AGY_INIT_TARGET/GEMINI.md" || fail "GEMINI.md boot file missing"
grep -q 'run_command' "$AGY_INIT_TARGET/.agents/skills/dag-flow/references/tasks.md" || fail "antigravity tools missing"
pass "antigravity scaffold init"

echo "=== E2E: scaffold → dag init external orchestrator ==="
run_dag init --orchestrator="$SCAFFOLD_RUNTIME" --target="$INIT_TARGET" --project-scaffold=false
test -f "$INIT_TARGET/.cursor/skills/dag-flow/SKILL.md" || fail "compiled skill missing"
grep -q 'Shell' "$INIT_TARGET/.cursor/skills/dag-flow/references/tasks.md" || fail "orchestrator tools missing"
grep -q 'cursor agent' "$INIT_TARGET/.cursor/skills/dag-flow/references/tasks.md" || fail "worker CLI missing"
! grep -q '<<<DAG:' "$INIT_TARGET/.cursor/skills/dag-flow/references/tasks.md" || fail "unresolved placeholders"
test -f "$INIT_TARGET/.cursor/hooks.json" || fail "hooks.json not wired for scaffolded cursor manifest"
grep -q 'dag-flow-guard' "$INIT_TARGET/.cursor/hooks.json" || fail "dag-flow guard hook missing"
pass "scaffolded manifest drives dag init"

echo "=== regression: manifest-resolver extends ==="
npm test -- --runInBand manifest-resolver.test.ts
pass "manifest-resolver regression"

echo ""
echo "=========================================="
echo "✅ Session 9 validation complete (all checks)"
echo "=========================================="
