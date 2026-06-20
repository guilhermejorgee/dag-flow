import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { hookConfigUpsert } from '../src/hooks/hook-config-upsert.js';
import type { OrchestratorConfig } from '../src/compiler/manifest-types.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');

const CURSOR_ORCHESTRATOR: OrchestratorConfig = {
  hook_wiring_tier: 'pre_tool_use',
  hook_config_path: '.cursor/hooks.json',
  hook_event: 'preToolUse',
  hook_entry_id: 'dag-flow-guard',
  hook_config_adapter: 'cursor',
  boot_file: null,
  skill_install_path: '.cursor/skills',
  placeholders: {},
};

function writeHooksFixture(target: string): void {
  const hooksDir = path.join(target, '.cursor');
  mkdirSync(hooksDir, { recursive: true });
  const hooksPath = path.join(hooksDir, 'hooks.json');
  writeFileSync(
    hooksPath,
    `${JSON.stringify(
      {
        version: 1,
        hooks: {
          sessionStart: [{ command: '.cursor/hooks/caveman-session-start.mjs', timeout: 10 }],
          preToolUse: [
            {
              command: '.cursor/hooks/tool-routing.mjs',
              timeout: 10,
              matcher: 'Shell|Read|Grep',
            },
          ],
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

describe('hook-config-upsert', () => {
  it('adds dag-flow-guard without removing third-party hooks', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-hooks-'));
    writeHooksFixture(target);

    hookConfigUpsert({
      target,
      orchestrator: CURSOR_ORCHESTRATOR,
      packageRoot: CLI_ROOT,
    });

    const config = JSON.parse(readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'));
    const preToolUse = config.hooks.preToolUse;

    expect(preToolUse).toHaveLength(2);
    expect(preToolUse[0].command).toContain('tool-routing.mjs');
    expect(preToolUse[0].matcher).toBe('Shell|Read|Grep');

    const guard = preToolUse.find((entry: { id?: string }) => entry.id === 'dag-flow-guard');
    expect(guard).toBeDefined();
    expect(guard.command).toContain('dag-flow-guard.mjs');
    expect(guard.matcher).toBeUndefined();
  });

  it('updates command on re-upsert without duplicating entries', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-hooks-'));
    writeHooksFixture(target);

    hookConfigUpsert({
      target,
      orchestrator: CURSOR_ORCHESTRATOR,
      packageRoot: CLI_ROOT,
    });

    const guardPath = path.join(CLI_ROOT, 'hooks', 'dag-flow-guard.mjs');
    const original = readFileSync(guardPath, 'utf8');
    writeFileSync(guardPath, `${original}\n// touched\n`, 'utf8');

    try {
      hookConfigUpsert({
        target,
        orchestrator: CURSOR_ORCHESTRATOR,
        packageRoot: CLI_ROOT,
      });

      const config = JSON.parse(readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'));
      const guardEntries = config.hooks.preToolUse.filter((entry: { command: string }) =>
        entry.command.includes('dag-flow-guard'),
      );
      expect(guardEntries).toHaveLength(1);
    } finally {
      writeFileSync(guardPath, original, 'utf8');
    }
  });

  it('creates hooks.json when missing', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-hooks-'));
    mkdirSync(path.join(target, '.cursor'), { recursive: true });

    hookConfigUpsert({
      target,
      orchestrator: CURSOR_ORCHESTRATOR,
      packageRoot: CLI_ROOT,
    });

    const config = JSON.parse(readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'));
    expect(config.hooks.preToolUse).toHaveLength(1);
    expect(config.hooks.preToolUse[0].id).toBe('dag-flow-guard');
  });
});
