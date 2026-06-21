#!/usr/bin/env bash
# V1 Checkpoint — full automated verification (replaces human review gate)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CLI_ROOT/.." && pwd)"

FAKE_BIN="$(mktemp -d)"
COMPILED_SMOKE="$(mktemp -d)"
trap 'chmod 755 "${COMPILED_VAULT:-}" 2>/dev/null || true; rm -rf "$FAKE_BIN" "$COMPILED_SMOKE"' EXIT

printf '#!/bin/sh\n' > "$FAKE_BIN/context-mode"
printf '#!/bin/sh\nexec "$@"\n' > "$FAKE_BIN/rtk"
chmod +x "$FAKE_BIN/context-mode" "$FAKE_BIN/rtk"
export PATH="$FAKE_BIN:$PATH"
run_dag() { node "$CLI_ROOT/dist/index.js" "$@"; }

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

echo "╔══════════════════════════════════════════╗"
echo "║  V1 CHECKPOINT — automated verification  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo "=== [1/8] Session 10 cleanup (Tasks 21–22) ==="
"$CLI_ROOT/scripts/validate-session10.sh" | tail -3
pass "session 10"

echo "=== [2/8] dag update matrix (Session 6) ==="
"$CLI_ROOT/scripts/validate-session6.sh" | tail -3
pass "dag update antigravity"

echo "=== [3/8] Python: dag_runner + auditor + vault smoke ==="
cd "$CLI_ROOT" && npm run build --silent
python3 "$REPO_ROOT/scripts/test_dag_runner.py" >/dev/null
pass "test_dag_runner.py (12 tests)"
python3 "$REPO_ROOT/scripts/test_auditor.py" >/dev/null
pass "test_auditor.py (PASS contract)"
bash "$REPO_ROOT/scripts/smoke_session5.sh" >/dev/null
pass "smoke_session5 (vault 555 dual-write)"

echo "=== [4/8] ADRs 0010–0017 accepted ==="
for slug in \
  0010-dag-flow-hook-guard-router.md \
  0011-dual-manifest-compilation.md \
  0012-pending-dag-guard.md \
  0013-manifest-inheritance.md \
  0014-orchestrator-worker-split.md \
  0015-compiled-skill-scripts-whitelist.md \
  0016-v1-runtime-scope.md \
  0017-per-runtime-worker-permission-flags.md
do
  adr="$REPO_ROOT/docs/adr/$slug"
  test -f "$adr" || fail "missing ADR $slug"
  rg -q '^status:\s*accepted' "$adr" || fail "ADR not accepted: $slug"
done
pass "ADRs 0010–0017"

echo "=== [5/8] Guard: blocks src/, bypass DAG_FLOW_WORKER=1 ==="
cd "$CLI_ROOT"
npm test -- --runInBand hook-guard.test.ts >/dev/null
pass "hook-guard subprocess (Cursor preToolUse wiring)"

echo "=== [6/8] V1 checkpoint jest (init/update matrix + ADRs) ==="
npm test -- --runInBand v1-checkpoint.test.ts
pass "v1-checkpoint.test.ts"

echo "=== [7/8] Compiled skill dag_runner E2E (installed scripts) ==="
run_dag init --orchestrator=antigravity --target="$COMPILED_SMOKE" --skill-install-path=skills --project-scaffold=false
COMPILED_SCRIPTS="$COMPILED_SMOKE/skills/dag-flow/scripts"
COMPILED_CONFIG="$COMPILED_SCRIPTS/dag-config.json"
cat >"$COMPILED_CONFIG" <<'EOF'
{
  "_meta": { "worker": "v1-smoke", "schema_version": 1 },
  "worker": { "command_template": ["true"] }
}
EOF
COMPILED_VAULT="$COMPILED_SMOKE/.specs/dags"
mkdir -p "$COMPILED_VAULT"
chmod 755 "$COMPILED_VAULT"
cat >"$COMPILED_VAULT/v1-smoke.json" <<'EOF'
[{"id":"T1","description":"V1 smoke","context_ref":"v1","skill":"None","dependencies":[],"input_files":[],"output_files":[],"done_when_gate":"echo PASS","status":"Pending"}]
EOF
chmod 555 "$COMPILED_VAULT"
cd "$COMPILED_SMOKE"
python3 "$COMPILED_SCRIPTS/dag_runner.py" ".specs/dags/v1-smoke.json" >/dev/null
VAULT_DONE=$(python3 -c "import json; print(json.load(open('.specs/dags/v1-smoke.json'))[0]['status'])")
RUNS_DONE=$(python3 -c "import json; print(json.load(open('.specs/runs/v1-smoke/dag.json'))[0]['status'])")
VAULT_MODE=$(stat -c '%a' .specs/dags)
[[ "$VAULT_DONE" == "Done" ]] || fail "compiled dag_runner vault status=$VAULT_DONE"
[[ "$RUNS_DONE" == "Done" ]] || fail "compiled dag_runner runs status=$RUNS_DONE"
[[ "$VAULT_MODE" == "555" ]] || fail "compiled dag_runner vault mode=$VAULT_MODE"
chmod 755 "$COMPILED_VAULT" 2>/dev/null || true
pass "compiled skill dag_runner + auditor via installed scripts"

echo "=== [8/8] Full jest regression (130+ tests) ==="
cd "$CLI_ROOT"
npm test -- --runInBand >/dev/null
pass "full jest suite"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✅ V1 CHECKPOINT COMPLETE               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Verified:"
echo "  • Golden gate + discovery inline + setup_indexer removed"
echo "  • dag init + dag update (antigravity + cursor)"
echo "  • dag_runner vault dual-write + auditor PASS contract"
echo "  • Guard blocks src/lib/api/test; DAG_FLOW_WORKER=1 bypass"
echo "  • ADRs 0010–0017 status: accepted"
echo "  • Compiled skill scripts E2E"
