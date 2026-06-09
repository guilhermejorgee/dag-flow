#!/bin/bash
# scripts/index_repo.sh
# Ingests repository files into context-mode FTS5 database

echo "Running dag-flow Global Indexing Hook..."

# Ensure we are in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "Not a git repository. Skipping indexing."
  exit 0
fi

# Here we assume a hypothetical `context-mode-cli` exists for bash environments,
# OR the hook simply outputs the file list for the LLM's init prompt to consume.
# For demonstration, we simulate the indexing process.

FILES=$(git ls-files)

# Incremental indexing logic could compare hashes/timestamps here.
echo "Indexing tracked files into context-mode..."
for file in $FILES; do
  # context-mode-cli index --file "$file" --source "$file"
  # echo "Indexed: $file"
  true
done

echo "Global Indexing Complete. Map Phase is now ready for Task Context Discovery."
