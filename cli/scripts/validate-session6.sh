#!/usr/bin/env bash
# Session 6 validation — guard + dag update (automated gaps beyond plan unit tests)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FAKE_BIN="$(mktemp -d)"
TARGET="$(mktemp -d)"
TARGET_BLOCKED="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN" "$TARGET" "$TARGET_BLOCKED"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"

export PATH="$FAKE_BIN:$PATH"
run_dag() { node "$CLI_ROOT/dist/index.js" "$@"; }

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

echo "=== [critical] build + jest session6 suites ==="
cd "$CLI_ROOT"
npm run build --silent
npm test -- --runInBand --testPathPattern='pending-dag-guard|update|cli-routing'

echo "=== E2E-1: init baseline for update ==="
run_dag init --orchestrator=antigravity --target="$TARGET" --skill-install-path=skills --project-scaffold=false
test -f "$TARGET/skills/dag-flow/dag-config.json" || fail "missing dag-config after init"

echo "=== E2E-2: guard blocks CLI update (exit 1) with Failed vault ==="
mkdir -p "$TARGET_BLOCKED/.specs/dags"
run_dag init --orchestrator=antigravity --target="$TARGET_BLOCKED" --skill-install-path=skills --project-scaffold=false
printf '[{"id":"T1","status":"Failed"}]\n' > "$TARGET_BLOCKED/.specs/dags/feature.json"
BLOCKED_OUT=$(run_dag update --target="$TARGET_BLOCKED" --skill-install-path=skills 2>&1) && fail "update should abort on Failed vault"
echo "$BLOCKED_OUT" | grep -q "incomplete tasks" || fail "guard message missing"
pass "CLI guard abort on Failed vault"

echo "=== E2E-3: worker preservation through CLI update ==="
python3 - <<PY
import json
p = "$TARGET/skills/dag-flow/dag-config.json"
c = json.load(open(p))
c["worker"] = {"command_template": ["session6-custom", "--prompt", "<<<PROMPT>>>"], "extra": "kept"}
json.dump(c, open(p, "w"), indent=2)
PY
mkdir -p "$TARGET/.specs/dags"
printf '[{"id":"T1","status":"Done"}]\n' > "$TARGET/.specs/dags/feature.json"
run_dag update --target="$TARGET" --skill-install-path=skills
python3 - <<PY
import json
c = json.load(open("$TARGET/skills/dag-flow/dag-config.json"))
assert c["worker"]["command_template"][0] == "session6-custom", c["worker"]
assert c["worker"].get("extra") == "kept"
assert c["_meta"]["dag_flow_version"] == "2.0.0"
PY
pass "worker section preserved via CLI"

echo "=== E2E-4: two CLI updates → single boot_file marker ==="
run_dag update --target="$TARGET" --skill-install-path=skills
markers=$(grep -c 'dag-flow-hook' "$TARGET/GEMINI.md" || true)
[[ "$markers" -eq 1 ]] || fail "boot_file marker count=$markers (expected 1)"
pass "hook re-wire idempotent"

echo "=== E2E-5: update without install path discovers .agents/skills ==="
TARGET_DEFAULT="$(mktemp -d)"
trap 'rm -rf "$FAKE_BIN" "$TARGET" "$TARGET_BLOCKED" "$TARGET_DEFAULT"' EXIT
run_dag init --orchestrator=antigravity --target="$TARGET_DEFAULT" --project-scaffold=false
mkdir -p "$TARGET_DEFAULT/.specs/dags"
printf '[{"id":"T1","status":"Done"}]\n' > "$TARGET_DEFAULT/.specs/dags/feature.json"
run_dag update --target="$TARGET_DEFAULT"
test -f "$TARGET_DEFAULT/.agents/skills/dag-flow/SKILL.md" || fail "default path update failed"
pass "default skill path discovery"

echo ""
echo "=========================================="
echo "✅ Session 6 validation complete"
echo "=========================================="
