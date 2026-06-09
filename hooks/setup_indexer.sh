#!/bin/bash
# scripts/setup_indexer.sh
# Generates runtime-specific hooks or rules for dag-flow Global Indexing

if [ "$1" != "--runtime" ] || [ -z "$2" ]; then
  echo "Usage: $0 --runtime <claude|antigravity|devin|vscode>"
  exit 1
fi

RUNTIME_NAME=$2
HOOK_SCRIPT="./hooks/index_repo.sh"

echo "Configuring dag-flow Global Indexing for runtime: $RUNTIME_NAME"

case "$RUNTIME_NAME" in
  "antigravity")
    cat << 'EOF' > GEMINI.md
# dag-flow-indexing — MANDATORY initialization rule

Boot requirement. You MUST execute a Global Indexing of the repository at the start of the session if not already done. Use `mcp__context-mode__ctx_batch_execute` to populate FTS5. Unrouted Map crawls are FORBIDDEN.
EOF
    echo "Created GEMINI.md with Global Indexing Rule."
    ;;
    
  "claude")
    cat << EOF > claude.json
{
  "hooks": {
    "init": "$HOOK_SCRIPT"
  }
}
EOF
    echo "Created claude.json with init hook."
    ;;
    
  "devin")
    cat << EOF > devin.toml
[hooks]
init = "$HOOK_SCRIPT"
EOF
    echo "Created devin.toml with init hook."
    ;;
    
  "vscode" | "copilot")
    mkdir -p .vscode
    cat << EOF > .vscode/settings.json
{
  "github.copilot.advanced": {
    "hooks": {
      "pre-run": "$HOOK_SCRIPT"
    }
  }
}
EOF
    echo "Created .vscode/settings.json with pre-run hook."
    ;;
    
  *)
    echo "Unsupported runtime: $RUNTIME_NAME"
    exit 1
    ;;
esac
