---
status: accepted
---

# Manifest Inheritance (`extends`)

Custom Runtime Manifest directories may declare `"extends": "<built-in-id>"` to deep-merge from a built-in manifest. Child fields override parent; child `partials/` override same filename. **`dag manifest scaffold` requires `--extends`** — scaffolding without a base runtime errors with the list of built-ins.

The resolver must **detect cycles** in the `extends` chain and fail explicitly.

**Considered options:** Flat manifests only (rejected — duplicates internal partial knowledge); shallow merge (rejected — nested `placeholders` need deep merge).

**Consequences:** Adding a runtime similar to Cursor or Antigravity is override-only. Built-in manifests remain the reference implementations in `cli/manifests/`.
