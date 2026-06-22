#!/usr/bin/env bash
# Session 4 validation — critical → basic (does not modify repo .cursor/hooks.json)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CLI_ROOT/.." && pwd)"

FAKE_BIN="$(mktemp -d)"
EMPTY_BIN="$(mktemp -d)"
TARGET="$(mktemp -d)"
TARGET2="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN" "$EMPTY_BIN" "$TARGET" "$TARGET2"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"

export PATH="$FAKE_BIN:$PATH"
run_dag() { node "$CLI_ROOT/dist/index.js" "$@"; }

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

echo "=== [critical] golden gate ==="
cd "$CLI_ROOT"
npm run build --silent
npm link --silent
./scripts/verify-antigravity-parity.sh
./scripts/verify-cursor-parity.sh

echo "=== [critical] jest suite ==="
npm test -- --runInBand

echo "=== [critical] typecheck ==="
npm run typecheck

echo "=== E2E-1: prerequisites abort (no context-mode/rtk on PATH) ==="
PREREQ_OUT=$(PATH="/usr/bin:/bin:/usr/local/bin:$EMPTY_BIN" run_dag init --orchestrator=antigravity --target="$TARGET" --project-scaffold=false 2>&1) || true
if echo "$PREREQ_OUT" | grep -q "context-mode"; then
  pass "prerequisites abort without context-mode/rtk"
else
  fail "prerequisites gate"
fi

echo "=== E2E-2: full init + project scaffold (default) ==="
run_dag init --orchestrator=antigravity --target="$TARGET" --skill-install-path=skills
for spec in "staging:755" "features:555" "dags:555"; do
  d="${spec%%:*}"
  m="${spec##*:}"
  actual=$(stat -c '%a' "$TARGET/.specs/$d")
  [[ "$actual" == "$m" ]] || fail ".specs/$d chmod expected $m got $actual"
  pass ".specs/$d chmod $m"
done

echo "=== E2E-3: dag-config.json schema ==="
python3 - <<PY
import json
c = json.load(open("$TARGET/skills/dag-flow/dag-config.json"))
assert c["_meta"]["orchestrator"] == "antigravity"
assert c["_meta"]["worker"] == "antigravity"
assert c["_meta"]["dag_flow_version"] == "2.0.0"
assert c["worker"]["command_template"][0] == "agy"
PY
pass "dag-config.json schema"

echo "=== E2E-4: boot_file GEMINI.md ==="
grep -q 'dag-flow-hook' "$TARGET/GEMINI.md" || fail "GEMINI.md missing marker"
grep -q 'cognitive guard rule' "$TARGET/GEMINI.md" || fail "GEMINI.md missing rule text"
pass "GEMINI.md boot_file block present"

echo "=== E2E-5: boot_file re-wire idempotent ==="
run_dag init --orchestrator=antigravity --target="$TARGET" --skill-install-path=skills --project-scaffold=false --force >/dev/null
markers=$(grep -c 'dag-flow-hook' "$TARGET/GEMINI.md" || true)
[[ "$markers" -eq 1 ]] || fail "boot_file marker count=$markers (expected 1)"
pass "boot_file single marker after re-init"

echo "=== E2E-6: idempotency without --force ==="
IDEM_OUT=$(run_dag init --orchestrator=antigravity --target="$TARGET" --skill-install-path=skills --project-scaffold=false 2>&1) || true
if echo "$IDEM_OUT" | grep -q "already exists"; then
  pass "idempotency abort"
else
  fail "idempotency abort message"
fi

echo "=== E2E-7: --force overwrite ==="
FORCE_OUT=$(run_dag init --orchestrator=antigravity --target="$TARGET" --skill-install-path=skills --project-scaffold=false --force 2>&1)
echo "$FORCE_OUT" | grep -q "Overwriting" || fail "--force warning"
test -f "$TARGET/skills/dag-flow/SKILL.md" || fail "--force output missing"
pass "--force overwrites with warning"

echo "=== E2E-8: --project-scaffold=false skips .specs ==="
run_dag init --orchestrator=antigravity --target="$TARGET2" --skill-install-path=skills --project-scaffold=false
[[ ! -d "$TARGET2/.specs" ]] || fail ".specs should not exist"
pass "project-scaffold=false skips .specs"

echo "=== E2E-9/10/11/12: jest session4-e2e (scaffold drift, hook upsert, tier none) ==="
npm test -- --runInBand --testPathPattern=session4-e2e
pass "session4-e2e integration tests"

echo "=== E2E-13: dag-flow-guard.mjs Guard+Router (not stub) ==="
test -f "$CLI_ROOT/hooks/dag-flow-guard.mjs" || fail "guard missing"
grep -q 'STUB for Task 11' "$CLI_ROOT/hooks/dag-flow-guard.mjs" && fail "guard still stub"
npm test -- --runInBand --testPathPattern=hook-router
pass "dag-flow-guard.mjs Guard+Router + hook-router tests"

echo "=== E2E-14: user-requested init target ==="
USER_TARGET="/tmp/dag-test-s4"
rm -rf "$USER_TARGET"
run_dag init --orchestrator=antigravity --target="$USER_TARGET" --project-scaffold=false
test -f "$USER_TARGET/.agents/skills/dag-flow/SKILL.md" || fail "user target skill missing"
test -f "$USER_TARGET/.agents/skills/dag-flow/dag-config.json" || fail "user target config missing"
pass "dag init --target=/tmp/dag-test-s4 --project-scaffold=false"

echo ""
echo "=========================================="
echo "✅ Session 4 validation complete (all checks)"
echo "=========================================="
