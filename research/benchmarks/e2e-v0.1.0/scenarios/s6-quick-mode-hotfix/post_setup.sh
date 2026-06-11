#!/bin/bash
set -e

WORKSPACE=$1
if [ -z "$WORKSPACE" ]; then
  echo "Usage: $0 <workspace_dir>"
  exit 1
fi

echo "Running scenario 6 post_setup: injecting bcrypt bug"
find "$WORKSPACE" -type f -name "*.js" -exec sed -i 's/await bcrypt\.compare/bcrypt.compare/g' {} +
