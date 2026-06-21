#!/usr/bin/env bash
# Session 8 validation — Task 18 cursor manifest + session 6 golden debt + spikes S1/S2
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CLI_ROOT/.." && pwd)"

FAKE_BIN="$(mktemp -d)"
TARGET_CURSOR="$(mktemp -d)"
TARGET_DUAL="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN" "$TARGET_CURSOR" "$TARGET_DUAL"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\n' > "$FAKE_BIN/rtk"
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

echo "=== [critical] session 6 golden gate ==="
./scripts/verify-antigravity-parity.sh

echo "=== [critical] source skill grep negative (Task 3) ==="
if rg -l 'agy|run_command|view_file|define_subagent' "$REPO_ROOT/SKILL.md" "$REPO_ROOT/references/" 2>/dev/null; then
  fail "source skill still has hardcoded runtime coupling"
fi
pass "source skill grep negative"

echo "=== [critical] jest full suite ==="
npm test -- --runInBand

echo "=== [critical] python dag_runner tests (Task 12) ==="
python3 "$REPO_ROOT/scripts/test_dag_runner.py" >/dev/null
pass "test_dag_runner.py"

echo "=== S1 spike: agy worker PASS ==="
AGY_OUT=$(agy --dangerously-skip-permissions --prompt "Respond EXACTLY: PASS" 2>&1) || fail "agy spike non-zero exit"
echo "$AGY_OUT" | grep -q 'PASS' || fail "agy spike stdout missing PASS"
pass "S1 agy spike"

echo "=== S2 spike: cursor agent worker PASS ==="
CURSOR_OUT=$(cursor agent --print --output-format text --trust --force --approve-mcps -p "Respond EXACTLY: PASS" 2>&1) || fail "cursor agent spike non-zero exit"
echo "$CURSOR_OUT" | grep -q 'PASS' || fail "cursor agent spike stdout missing PASS"
pass "S2 cursor agent spike"

echo "=== E2E: dag init --orchestrator=cursor ==="
run_dag init --orchestrator=cursor --target="$TARGET_CURSOR" --project-scaffold=false
test -f "$TARGET_CURSOR/.cursor/skills/dag-flow/SKILL.md" || fail "cursor skill missing"
test -f "$TARGET_CURSOR/.cursor/skills/dag-flow/references/tasks.md" || fail "cursor references/tasks.md missing"
grep -q 'Shell' "$TARGET_CURSOR/.cursor/skills/dag-flow/references/tasks.md" || fail "Shell tool missing"
grep -q 'Task' "$TARGET_CURSOR/.cursor/skills/dag-flow/references/tasks.md" || fail "Task tool missing"
grep -q 'cursor agent' "$TARGET_CURSOR/.cursor/skills/dag-flow/references/tasks.md" || fail "cursor agent gates missing"
grep -q 'dangerously-skip-permissions' "$TARGET_CURSOR/.cursor/skills/dag-flow/references/tasks.md" && fail "agy leak in cursor compile"
! grep -q '<<<DAG:' "$TARGET_CURSOR/.cursor/skills/dag-flow/references/tasks.md" || fail "unresolved placeholders in tasks.md"
python3 - <<PY
import json
c = json.load(open("$TARGET_CURSOR/.cursor/skills/dag-flow/dag-config.json"))
assert c["_meta"]["orchestrator"] == "cursor"
assert c["_meta"]["worker"] == "cursor"
tpl = c["worker"]["command_template"]
assert tpl[:2] == ["cursor", "agent"]
for flag in ["--print", "--trust", "--force", "--approve-mcps", "-p"]:
    assert flag in tpl, flag
assert "--dangerously-skip-permissions" not in tpl
PY
pass "cursor init E2E"

echo "=== E2E: dual-manifest cursor orchestrator + antigravity worker ==="
run_dag init --orchestrator=cursor --worker=antigravity --target="$TARGET_DUAL" --project-scaffold=false
python3 - <<PY
import json
c = json.load(open("$TARGET_DUAL/.cursor/skills/dag-flow/dag-config.json"))
assert c["_meta"]["orchestrator"] == "cursor"
assert c["_meta"]["worker"] == "antigravity"
assert c["worker"]["command_template"][0] == "agy"
PY
grep -q 'agy --dangerously-skip-permissions' "$TARGET_DUAL/.cursor/skills/dag-flow/references/tasks.md" || fail "dual: worker CLI missing"
grep -q 'Shell' "$TARGET_DUAL/.cursor/skills/dag-flow/references/tasks.md" || fail "dual: orchestrator tool missing"
! grep -q 'cursor agent' "$TARGET_DUAL/.cursor/skills/dag-flow/references/tasks.md" || fail "dual: orchestrator worker CLI leaked"
pass "dual-manifest E2E"

echo "=== npm pack ships cursor manifest ==="
npm pack --dry-run 2>&1 | grep -q 'manifests/cursor/manifest.json' || fail "cursor manifest not in pack"
pass "npm pack cursor manifest"

echo "=== session 4 regression (init infra still green) ==="
./scripts/validate-session4.sh >/dev/null
pass "session 4 regression"

echo ""
echo "=========================================="
echo "✅ Session 8 validation complete (all checks)"
echo "=========================================="
