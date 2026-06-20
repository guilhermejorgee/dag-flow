import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { OrchestratorConfig } from '../compiler/manifest-types.js';
import { getHookConfigAdapter, type HookConfig, type HookConfigEntry } from './adapters/cursor.js';

export class HookWiringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HookWiringError';
  }
}

export interface HookConfigUpsertOptions {
  target: string;
  orchestrator: OrchestratorConfig;
  packageRoot: string;
}

function resolveHookCommand(packageRoot: string): string {
  const hookPath = path.join(packageRoot, 'hooks', 'dag-flow-guard.mjs');
  if (!existsSync(hookPath)) {
    throw new HookWiringError(`Hook script not found: ${hookPath}`);
  }
  return path.resolve(hookPath);
}

function findExistingEntry(
  entries: HookConfigEntry[],
  hookEntryId: string,
): HookConfigEntry | undefined {
  return entries.find(
    (entry) => entry.id === hookEntryId || entry.command.includes('dag-flow-guard'),
  );
}

/**
 * §5.10 — upsert dag-flow-guard entry without touching third-party hooks.
 */
export function hookConfigUpsert(options: HookConfigUpsertOptions): void {
  const { target, orchestrator, packageRoot } = options;
  const hookConfigPath = orchestrator.hook_config_path;
  const hookEvent = orchestrator.hook_event;
  const hookEntryId = orchestrator.hook_entry_id;

  if (!hookConfigPath || !hookEvent || !hookEntryId) {
    throw new HookWiringError(
      'pre_tool_use tier requires hook_config_path, hook_event, and hook_entry_id',
    );
  }

  const adapter = getHookConfigAdapter(orchestrator.hook_config_adapter);
  const configPath = path.join(target, hookConfigPath);
  const hookCommand = resolveHookCommand(packageRoot);

  let config: HookConfig;
  if (!existsSync(configPath)) {
    config = adapter.emptyConfig();
  } else {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8')) as HookConfig;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new HookWiringError(`Invalid hook config JSON at ${configPath}: ${message}`);
    }
  }

  if (!config.hooks) {
    config.hooks = {};
  }
  if (!config.hooks[hookEvent]) {
    config.hooks[hookEvent] = [];
  }

  const entries = config.hooks[hookEvent];
  const existing = findExistingEntry(entries, hookEntryId);

  const newEntry = adapter.augmentNewEntry({
    id: hookEntryId,
    command: hookCommand,
    timeout: 15,
  });

  if (existing) {
    existing.command = newEntry.command;
    existing.timeout = newEntry.timeout;
    if (!existing.id) {
      existing.id = hookEntryId;
    }
  } else {
    entries.push(newEntry);
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
