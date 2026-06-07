#!/bin/bash
# SelfDefend Shadow LLM - Pre-Tool-Call Hook for SDD V2
# This script enforces the strict separation of concerns by preventing the Executive Orchestrator 
# from mutating application state during the planning phases.

TOOL_NAME="$1"
TOOL_ARGS="$2"

# Define forbidden tools during planning
FORBIDDEN_TOOLS=("write_file" "replace")

# Define protected directories (application source)
PROTECTED_DIRS=("src/" "lib/" "api/" "app/" "components/")

# Function to check if a tool is in the forbidden list
is_forbidden_tool() {
    local e
    for e in "${FORBIDDEN_TOOLS[@]}"; do
        if [[ "$e" == "$1" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to check if the target path is in a protected directory
is_protected_path() {
    local target_path="$1"
    local e
    for e in "${PROTECTED_DIRS[@]}"; do
        if [[ "$target_path" == *"$e"* ]]; then
            return 0
        fi
    done
    return 1
}

# Read current SDD Phase (Default to Specify if not set)
CURRENT_PHASE="Specify"
if [ -f ".sdd/state.json" ]; then
    CURRENT_PHASE=$(cat .sdd/state.json | grep -o '"phase": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
fi

# Main Logic
if [[ "$CURRENT_PHASE" == "Specify" || "$CURRENT_PHASE" == "Design" ]]; then
    if is_forbidden_tool "$TOOL_NAME"; then
        
        # Extract file path from args (crude JSON parsing for demo purposes)
        TARGET_FILE=$(echo "$TOOL_ARGS" | grep -o '"file_path": *"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
        
        if is_protected_path "$TARGET_FILE"; then
            echo "[SHADOW LLM BLOCK] Governance Violation!" >&2
            echo "Current Phase is '$CURRENT_PHASE'. The Executive Orchestrator is FORBIDDEN from modifying application source code ($TARGET_FILE)." >&2
            echo "You must limit your writes to .specs/, docs/adr/, or CONTEXT.md." >&2
            echo "Please run the PAGRL loop and delegate execution to the DAG." >&2
            exit 1
        fi
    fi
fi

# Allow execution if not blocked
exit 0
