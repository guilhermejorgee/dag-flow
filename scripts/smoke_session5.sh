#!/usr/bin/env bash
# Manual smoke — Session 5: vault chmod 555, dag_runner dual-write, auditor PASS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS="$ROOT/scripts"
CONFIG="$SCRIPTS/dag-config.json"
CONFIG_BACKUP=""
WORK="$(mktemp -d)"
PASS=0

cleanup() {
  if [[ -n "$CONFIG_BACKUP" ]]; then
    printf '%s' "$CONFIG_BACKUP" >"$CONFIG"
  elif [[ -f "$CONFIG" ]]; then
    rm -f "$CONFIG"
  fi
  if [[ -d "$WORK/.specs/dags" ]]; then
    chmod 755 "$WORK/.specs/dags" 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

if [[ -f "$CONFIG" ]]; then
  CONFIG_BACKUP="$(cat "$CONFIG")"
fi

cat >"$CONFIG" <<'EOF'
{
  "_meta": { "worker": "smoke", "schema_version": 1 },
  "worker": {
    "command_template": ["true"]
  }
}
EOF

mkdir -p "$WORK/.specs/dags"
chmod 755 "$WORK/.specs/dags"

cat >"$WORK/.specs/dags/smoke.json" <<'EOF'
[
  {
    "id": "T1",
    "description": "Smoke task",
    "context_ref": "session5",
    "skill": "None",
    "dependencies": [],
    "input_files": [],
    "output_files": [],
    "done_when_gate": "echo PASS",
    "status": "Pending"
  }
]
EOF

chmod 555 "$WORK/.specs/dags"

echo "=== Smoke S5: vault mode before run ==="
stat -c '%a %n' "$WORK/.specs/dags"

cd "$WORK"
if python3 "$SCRIPTS/dag_runner.py" ".specs/dags/smoke.json"; then
  :
else
  echo "FAIL: dag_runner exited non-zero"
  exit 1
fi

VAULT_STATUS="$(python3 -c "import json; print(json.load(open('.specs/dags/smoke.json'))[0]['status'])")"
RUNS_STATUS="$(python3 -c "import json; print(json.load(open('.specs/runs/smoke/dag.json'))[0]['status'])")"
VAULT_MODE="$(stat -c '%a' .specs/dags)"

echo "=== Smoke S5: results ==="
echo "vault status: $VAULT_STATUS"
echo "runs status:  $RUNS_STATUS"
echo "vault mode:   $VAULT_MODE"

if [[ "$VAULT_STATUS" != "Done" ]]; then
  echo "FAIL: vault status expected Done, got $VAULT_STATUS"
  exit 1
fi
if [[ "$RUNS_STATUS" != "Done" ]]; then
  echo "FAIL: runs status expected Done, got $RUNS_STATUS"
  exit 1
fi
if [[ "$VAULT_MODE" != "555" ]]; then
  echo "FAIL: vault mode expected 555, got $VAULT_MODE"
  exit 1
fi

echo "PASS: smoke session 5"
