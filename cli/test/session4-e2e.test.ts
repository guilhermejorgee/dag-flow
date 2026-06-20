import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, jest } from '@jest/globals';
import { hookConfigUpsert } from '../src/hooks/hook-config-upsert.js';
import { wireHooks } from '../src/hooks/wire-hooks.js';
import { ensureProjectScaffold } from '../src/scaffold/project-scaffold.js';
import type { OrchestratorConfig } from '../src/compiler/manifest-types.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');

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

describe('session4 e2e', () => {
  it('hook upsert preserves real repo hooks.json third-party entries', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-s4-hooks-'));
    mkdirSync(path.join(target, '.cursor'), { recursive: true });
    copyFileSync(
      path.join(REPO_ROOT, '.cursor/hooks.json'),
      path.join(target, '.cursor/hooks.json'),
    );

    const before = JSON.parse(readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'));
    const beforeCount = before.hooks.preToolUse.length;

    hookConfigUpsert({ target, orchestrator: CURSOR_ORCHESTRATOR, packageRoot: CLI_ROOT });
    hookConfigUpsert({ target, orchestrator: CURSOR_ORCHESTRATOR, packageRoot: CLI_ROOT });

    const after = JSON.parse(readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'));
    expect(after.hooks.sessionStart).toEqual(before.hooks.sessionStart);
    expect(after.hooks.preToolUse.some((e: { command: string }) => e.command.includes('tool-routing'))).toBe(
      true,
    );
    expect(
      after.hooks.preToolUse.filter(
        (e: { id?: string; command: string }) =>
          e.id === 'dag-flow-guard' || e.command.includes('dag-flow-guard'),
      ),
    ).toHaveLength(1);
    expect(after.hooks.preToolUse).toHaveLength(beforeCount + 1);
  });

  it('tier none emits console.warn and skips wiring', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    wireHooks({
      target: mkdtempSync(path.join(tmpdir(), 'dag-s4-none-')),
      orchestrator: {
        manifest: {
          schema_version: 1,
          runtime_id: 'test-none',
          extends: null,
          orchestrator: {
            hook_wiring_tier: 'none',
            hook_config_path: null,
            hook_event: null,
            hook_entry_id: null,
            boot_file: null,
            skill_install_path: '.skills',
            placeholders: {},
          },
          worker: {
            command_template: [],
            worker_validation_status: 'pending',
            auditor_wrapper: null,
            placeholders: {},
          },
        },
        manifestDirs: [],
      },
      packageRoot: CLI_ROOT,
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('none'));
    warn.mockRestore();
  });

  it('scaffold chmod drift correction preserves nested content', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-s4-scaffold-'));
    const featuresDir = path.join(target, '.specs', 'features', 'auth');
    mkdirSync(featuresDir, { recursive: true });
    writeFileSync(path.join(featuresDir, 'spec.md'), '# kept', 'utf8');
    chmodSync(path.join(target, '.specs', 'features'), 0o777);

    ensureProjectScaffold(target);

    expect(statSync(path.join(target, '.specs', 'features')).mode & 0o777).toBe(0o555);
    expect(readFileSync(path.join(featuresDir, 'spec.md'), 'utf8')).toBe('# kept');
  });
});
