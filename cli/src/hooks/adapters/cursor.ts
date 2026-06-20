export interface HookConfigEntry {
  id?: string;
  command: string;
  timeout?: number;
  matcher?: string;
  [key: string]: unknown;
}

export interface HookConfig {
  version?: number;
  hooks: Record<string, HookConfigEntry[]>;
}

export interface CursorHookAdapter {
  emptyConfig(): HookConfig;
  augmentNewEntry(entry: HookConfigEntry): HookConfigEntry;
}

export const cursorHookAdapter: CursorHookAdapter = {
  emptyConfig(): HookConfig {
    return { version: 1, hooks: {} };
  },
  augmentNewEntry(entry: HookConfigEntry): HookConfigEntry {
    return entry;
  },
};

export function getHookConfigAdapter(name: string | null | undefined): CursorHookAdapter {
  if (!name || name === 'cursor') {
    return cursorHookAdapter;
  }
  throw new Error(`Unknown hook_config_adapter: ${name}`);
}
