#!/bin/bash
# hooks/setup_indexer.sh
# Configures dag-flow Global Indexing for the target agent runtime.
#
# For runtimes with native hook support (claude, codex, cursor, gemini-cli,
# vscode-copilot), this script verifies that context-mode is installed and
# wires its official sessionstart hook — which performs real FTS5 indexing.
#
# For Antigravity (no native hook API), a GEMINI.md rule is generated instead,
# instructing the LLM to run indexing via MCP tool at session boot.
#
# Usage: hooks/setup_indexer.sh --runtime <antigravity|claude|codex|cursor|gemini-cli|vscode-copilot>

set -euo pipefail

# Initialize locked DAG directory idempotently
mkdir -p .specs/dags && chmod 555 .specs/dags

SUPPORTED_RUNTIMES="antigravity | claude | codex | cursor | gemini-cli | vscode-copilot"

if [ "${1:-}" != "--runtime" ] || [ -z "${2:-}" ]; then
  echo "Usage: $0 --runtime <$SUPPORTED_RUNTIMES>"
  exit 1
fi

RUNTIME_NAME="$2"

# ---------------------------------------------------------------------------
# Helper: check context-mode is installed and return its root
# ---------------------------------------------------------------------------
require_context_mode() {
  if ! command -v context-mode &> /dev/null; then
    echo ""
    echo "❌  context-mode is not installed."
    echo "    Run: npm install -g context-mode"
    echo "    Then re-run this script."
    echo ""
    exit 1
  fi

  CM_ROOT="$(npm root -g)/context-mode"
  if [ ! -d "$CM_ROOT" ]; then
    echo "❌  context-mode package not found at: $CM_ROOT"
    echo "    Try reinstalling: npm install -g context-mode"
    exit 1
  fi

  echo "$CM_ROOT"
}

# ---------------------------------------------------------------------------
# Runtimes
# ---------------------------------------------------------------------------
echo "⚙️  Configuring dag-flow Global Indexing for runtime: $RUNTIME_NAME"

case "$RUNTIME_NAME" in

  # ---------- Antigravity: no native hook API — use a GEMINI.md rule --------
  "antigravity")
    cat << 'EOF' > GEMINI.md
# dag-flow-indexing — MANDATORY initialization rule

Boot requirement. You MUST execute a Global Indexing of the repository at the start of the session if not already done. Use `mcp__context-mode__ctx_batch_execute` to populate FTS5. Unrouted Map crawls are FORBIDDEN.
EOF
    echo "✅  Created GEMINI.md — LLM will index via MCP tool at session boot."
    ;;

  # ---------- Claude Code ---------------------------------------------------
  "claude")
    CM_ROOT="$(require_context_mode)"
    CONFIGS_DIR="$CM_ROOT/configs/claude"

    # Wire the sessionstart hook via context-mode's official CLI
    context-mode hook claude sessionstart

    # Optionally copy routing instructions if not already present
    if [ ! -f "CLAUDE.md" ] && [ -f "$CONFIGS_DIR/CLAUDE.md" ]; then
      cp "$CONFIGS_DIR/CLAUDE.md" CLAUDE.md
      echo "   Copied CLAUDE.md routing instructions."
    fi

    echo "✅  Claude Code: sessionstart hook registered via context-mode."
    echo "    Restart Claude Code to activate."
    ;;

  # ---------- Codex CLI -----------------------------------------------------
  "codex")
    CM_ROOT="$(require_context_mode)"
    CONFIGS_DIR="$CM_ROOT/configs/codex"

    context-mode hook codex sessionstart

    if [ ! -f "AGENTS.md" ] && [ -f "$CONFIGS_DIR/AGENTS.md" ]; then
      cp "$CONFIGS_DIR/AGENTS.md" AGENTS.md
      echo "   Copied AGENTS.md routing instructions."
    fi

    echo "✅  Codex CLI: sessionstart hook registered via context-mode."
    ;;

  # ---------- Cursor --------------------------------------------------------
  "cursor")
    CM_ROOT="$(require_context_mode)"
    CONFIGS_DIR="$CM_ROOT/configs/cursor"

    context-mode hook cursor sessionstart

    # Cursor uses an .mdc rules file for routing (sessionStart hook is rejected
    # by Cursor's validator — see context-mode issue #485)
    mkdir -p .cursor/rules
    if [ ! -f ".cursor/rules/context-mode.mdc" ] && [ -f "$CONFIGS_DIR/context-mode.mdc" ]; then
      cp "$CONFIGS_DIR/context-mode.mdc" .cursor/rules/context-mode.mdc
      echo "   Copied .cursor/rules/context-mode.mdc routing rules."
    fi

    echo "✅  Cursor: hooks registered via context-mode."
    echo "    Note: sessionStart hook is currently unsupported by Cursor."
    echo "    Routing is enforced via .cursor/rules/context-mode.mdc instead."
    ;;

  # ---------- Gemini CLI ----------------------------------------------------
  "gemini-cli")
    CM_ROOT="$(require_context_mode)"
    CONFIGS_DIR="$CM_ROOT/configs/gemini-cli"

    context-mode hook gemini-cli sessionstart

    if [ ! -f "GEMINI.md" ] && [ -f "$CONFIGS_DIR/GEMINI.md" ]; then
      cp "$CONFIGS_DIR/GEMINI.md" GEMINI.md
      echo "   Copied GEMINI.md routing instructions."
    fi

    echo "✅  Gemini CLI: sessionstart hook registered via context-mode."
    echo "    Restart Gemini CLI to activate."
    ;;

  # ---------- VS Code Copilot -----------------------------------------------
  "vscode-copilot")
    CM_ROOT="$(require_context_mode)"
    CONFIGS_DIR="$CM_ROOT/configs/vscode-copilot"

    context-mode hook vscode-copilot sessionstart

    if [ ! -f ".github/copilot-instructions.md" ] && [ -f "$CONFIGS_DIR/copilot-instructions.md" ]; then
      mkdir -p .github
      cp "$CONFIGS_DIR/copilot-instructions.md" .github/copilot-instructions.md
      echo "   Copied .github/copilot-instructions.md routing instructions."
    fi

    echo "✅  VS Code Copilot: sessionstart hook registered via context-mode."
    echo "    Restart VS Code to activate."
    ;;

  *)
    echo "❌  Unsupported runtime: '$RUNTIME_NAME'"
    echo "    Supported: $SUPPORTED_RUNTIMES"
    exit 1
    ;;

esac
