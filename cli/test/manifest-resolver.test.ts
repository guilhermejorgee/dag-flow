import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import {
  isExternalManifestRef,
  locateManifest,
  ManifestResolverError,
  mergeManifests,
  resolveManifest,
} from '../src/compiler/manifest-resolver.js';
import type { RuntimeManifest } from '../src/compiler/manifest-types.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(TEST_DIR, 'fixtures', 'manifest-resolver');
const CLI_ROOT = path.join(TEST_DIR, '..');

function writeManifest(dir: string, manifest: RuntimeManifest): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

describe('manifest-resolver', () => {
  describe('isExternalManifestRef', () => {
    it.each([
      ['antigravity', false],
      ['cursor', false],
      ['/abs/path/to/runtime', true],
      ['./rel/runtime', true],
      ['my-company/my-runtime', true],
      ['runtime.v2', true],
    ])('ref %s → %s', (ref, expected) => {
      expect(isExternalManifestRef(ref)).toBe(expected);
    });
  });

  describe('locateManifest', () => {
    it('maps built-in id to package manifests directory', () => {
      const location = locateManifest('cursor', CLI_ROOT);
      expect(location.manifestDir).toBe(path.join(CLI_ROOT, 'manifests', 'cursor'));
      expect(location.manifestPath).toBe(
        path.join(CLI_ROOT, 'manifests', 'cursor', 'manifest.json'),
      );
    });

    it('maps external directory ref to filesystem manifest.json', () => {
      const externalDir = path.join(FIXTURES, 'external-nested');
      const location = locateManifest(externalDir, CLI_ROOT);
      expect(location.manifestDir).toBe(path.resolve(externalDir));
      expect(location.manifestPath).toBe(path.join(path.resolve(externalDir), 'manifest.json'));
    });

    it('maps external .json ref directly to manifest file', () => {
      const manifestPath = path.join(FIXTURES, 'external-nested', 'manifest.json');
      const location = locateManifest(manifestPath, CLI_ROOT);
      expect(location.manifestDir).toBe(path.dirname(path.resolve(manifestPath)));
      expect(location.manifestPath).toBe(path.resolve(manifestPath));
    });

    it('maps audit-style nested ref my-company/my-runtime to filesystem', () => {
      const base = mkdtempSync(path.join(tmpdir(), 'dag-manifest-locate-'));
      const runtimeDir = path.join(base, 'my-company', 'my-runtime');
      writeManifest(runtimeDir, {
        schema_version: 1,
        runtime_id: 'nested-audit',
        extends: null,
        orchestrator: {
          hook_wiring_tier: 'none',
          hook_config_path: null,
          hook_event: null,
          hook_entry_id: null,
          boot_file: null,
          skill_install_path: '.skills',
          placeholders: { TOOL_RUN_COMMAND: 'x', TOOL_VIEW_FILE: 'y', RUNTIME_NAME: 'Nested' },
        },
        worker: {
          command_template: ['cli'],
          worker_validation_status: 'validated',
          auditor_wrapper: null,
          placeholders: { CLI_COMMAND_PREFIX: 'cli', AUDITOR_COMMAND_TEMPLATE: 'audit' },
        },
      });

      const ref = path.join('my-company', 'my-runtime');
      const location = locateManifest(path.join(base, ref), CLI_ROOT);
      expect(location.manifestDir).toBe(runtimeDir);
      expect(location.manifestPath).toBe(path.join(runtimeDir, 'manifest.json'));
    });
  });

  it('resolves built-in antigravity manifest', () => {
    const resolved = resolveManifest('antigravity', { packageRoot: CLI_ROOT });
    expect(resolved.manifest.runtime_id).toBe('antigravity');
    expect(resolved.manifest.orchestrator.placeholders.TOOL_RUN_COMMAND).toBe('run_command');
    expect(resolved.manifest.worker.placeholders.CLI_COMMAND_PREFIX).toBe(
      'agy --dangerously-skip-permissions',
    );
    expect(resolved.manifestDirs[0]).toBe(path.join(CLI_ROOT, 'manifests', 'antigravity'));
  });

  it('deep-merges extends with child override', () => {
    const parentDir = path.join(FIXTURES, 'parent');
    const childDir = path.join(FIXTURES, 'child-override');

    writeManifest(parentDir, {
      schema_version: 1,
      runtime_id: 'parent',
      extends: null,
      orchestrator: {
        hook_wiring_tier: 'none',
        hook_config_path: null,
        hook_event: null,
        hook_entry_id: null,
        boot_file: null,
        skill_install_path: '.parent/skills',
        partials: { SPAWN_SUBAGENT_BLOCK: 'spawn-subagent.md' },
        placeholders: {
          TOOL_RUN_COMMAND: 'parent_tool',
          TOOL_VIEW_FILE: 'parent_view',
          RUNTIME_NAME: 'Parent',
        },
      },
      worker: {
        command_template: ['parent-cli', '-p', '<<<PROMPT>>>'],
        worker_validation_status: 'validated',
        auditor_wrapper: null,
        placeholders: {
          CLI_COMMAND_PREFIX: 'parent-cli',
          AUDITOR_COMMAND_TEMPLATE: 'parent-auditor',
        },
      },
    });

    writeManifest(childDir, {
      schema_version: 1,
      runtime_id: 'child',
      extends: parentDir,
      orchestrator: {
        hook_wiring_tier: 'pre_tool_use',
        hook_config_path: '.cursor/hooks.json',
        hook_event: 'preToolUse',
        hook_entry_id: 'dag-flow-guard',
        boot_file: null,
        skill_install_path: '.cursor/skills',
        partials: { SPAWN_SUBAGENT_BLOCK: 'spawn-custom.md' },
        placeholders: {
          TOOL_RUN_COMMAND: 'Shell',
          RUNTIME_NAME: 'Child',
        },
      },
      worker: {
        command_template: ['child-cli', '-p', '<<<PROMPT>>>'],
        worker_validation_status: 'validated',
        auditor_wrapper: null,
        placeholders: {
          CLI_COMMAND_PREFIX: 'child-cli',
        },
      },
    });

    const resolved = resolveManifest(childDir, { packageRoot: CLI_ROOT });

    expect(resolved.manifest.runtime_id).toBe('child');
    expect(resolved.manifest.orchestrator.hook_wiring_tier).toBe('pre_tool_use');
    expect(resolved.manifest.orchestrator.placeholders.TOOL_RUN_COMMAND).toBe('Shell');
    expect(resolved.manifest.orchestrator.placeholders.TOOL_VIEW_FILE).toBe('parent_view');
    expect(resolved.manifest.orchestrator.placeholders.RUNTIME_NAME).toBe('Child');
    expect(resolved.manifest.orchestrator.partials?.SPAWN_SUBAGENT_BLOCK).toBe(
      'spawn-custom.md',
    );
    expect(resolved.manifest.worker.placeholders.CLI_COMMAND_PREFIX).toBe('child-cli');
    expect(resolved.manifest.worker.placeholders.AUDITOR_COMMAND_TEMPLATE).toBe('parent-auditor');
    expect(resolved.manifestDirs).toEqual([childDir, parentDir]);
  });

  it('detects circular extends', () => {
    const aDir = path.join(FIXTURES, 'cycle-a');
    const bDir = path.join(FIXTURES, 'cycle-b');

    const baseOrchestrator = {
      hook_wiring_tier: 'none' as const,
      hook_config_path: null,
      hook_event: null,
      hook_entry_id: null,
      boot_file: null,
      skill_install_path: '.skills',
      placeholders: { TOOL_RUN_COMMAND: 'x', TOOL_VIEW_FILE: 'y', RUNTIME_NAME: 'Z' },
    };
    const baseWorker = {
      command_template: ['cli'],
      worker_validation_status: 'validated' as const,
      auditor_wrapper: null,
      placeholders: { CLI_COMMAND_PREFIX: 'cli', AUDITOR_COMMAND_TEMPLATE: 'audit' },
    };

    writeManifest(aDir, {
      schema_version: 1,
      runtime_id: 'cycle-a',
      extends: bDir,
      orchestrator: baseOrchestrator,
      worker: baseWorker,
    });
    writeManifest(bDir, {
      schema_version: 1,
      runtime_id: 'cycle-b',
      extends: aDir,
      orchestrator: baseOrchestrator,
      worker: baseWorker,
    });

    expect(() => resolveManifest(aDir, { packageRoot: CLI_ROOT })).toThrow(
      ManifestResolverError,
    );
  });

  it('mergeManifests preserves nested placeholder maps', () => {
    const parent: RuntimeManifest = {
      schema_version: 1,
      runtime_id: 'parent',
      extends: null,
      orchestrator: {
        hook_wiring_tier: 'none',
        hook_config_path: null,
        hook_event: null,
        hook_entry_id: null,
        boot_file: null,
        skill_install_path: '.skills',
        placeholders: { TOOL_RUN_COMMAND: 'a', TOOL_VIEW_FILE: 'b', RUNTIME_NAME: 'P' },
      },
      worker: {
        command_template: ['p'],
        worker_validation_status: 'validated',
        auditor_wrapper: null,
        placeholders: { CLI_COMMAND_PREFIX: 'p-cli', AUDITOR_COMMAND_TEMPLATE: 'p-audit' },
      },
    };
    const child: RuntimeManifest = {
      schema_version: 1,
      runtime_id: 'child',
      extends: 'parent',
      orchestrator: {
        hook_wiring_tier: 'none',
        hook_config_path: null,
        hook_event: null,
        hook_entry_id: null,
        boot_file: null,
        skill_install_path: '.skills',
        placeholders: { TOOL_RUN_COMMAND: 'override' },
      },
      worker: {
        command_template: ['c'],
        worker_validation_status: 'validated',
        auditor_wrapper: null,
        placeholders: { CLI_COMMAND_PREFIX: 'c-cli' },
      },
    };

    const merged = mergeManifests(parent, child);
    expect(merged.orchestrator.placeholders).toEqual({
      TOOL_RUN_COMMAND: 'override',
      TOOL_VIEW_FILE: 'b',
      RUNTIME_NAME: 'P',
    });
    expect(merged.worker.placeholders).toEqual({
      CLI_COMMAND_PREFIX: 'c-cli',
      AUDITOR_COMMAND_TEMPLATE: 'p-audit',
    });
  });

  it('resolves external nested path via slash ref, not bare id', () => {
    const externalDir = path.join(FIXTURES, 'external-nested');
    const slashRef = path.join('fixtures', 'manifest-resolver', 'external-nested');
    const resolved = resolveManifest(path.join(TEST_DIR, slashRef), { packageRoot: CLI_ROOT });
    expect(resolved.manifest.runtime_id).toBe('external-nested');
    expect(resolved.manifestDirs[0]).toBe(externalDir);

    expect(() => resolveManifest('external-nested', { packageRoot: CLI_ROOT })).toThrow(
      ManifestResolverError,
    );
  });

  it('resolves external manifest via direct .json path', () => {
    const manifestPath = path.join(FIXTURES, 'external-nested', 'manifest.json');
    const resolved = resolveManifest(manifestPath, { packageRoot: CLI_ROOT });
    expect(resolved.manifest.runtime_id).toBe('external-nested');
    expect(resolved.manifestDirs[0]).toBe(path.join(FIXTURES, 'external-nested'));
  });

  it('resolves audit example my-company/my-runtime from filesystem', () => {
    const base = mkdtempSync(path.join(tmpdir(), 'dag-manifest-resolve-'));
    const runtimeDir = path.join(base, 'my-company', 'my-runtime');
    writeManifest(runtimeDir, {
      schema_version: 1,
      runtime_id: 'audit-nested',
      extends: null,
      orchestrator: {
        hook_wiring_tier: 'none',
        hook_config_path: null,
        hook_event: null,
        hook_entry_id: null,
        boot_file: null,
        skill_install_path: '.skills',
        placeholders: { TOOL_RUN_COMMAND: 'x', TOOL_VIEW_FILE: 'y', RUNTIME_NAME: 'Audit' },
      },
      worker: {
        command_template: ['cli'],
        worker_validation_status: 'validated',
        auditor_wrapper: null,
        placeholders: { CLI_COMMAND_PREFIX: 'cli', AUDITOR_COMMAND_TEMPLATE: 'audit' },
      },
    });

    const resolved = resolveManifest(path.join(base, 'my-company', 'my-runtime'), {
      packageRoot: CLI_ROOT,
    });
    expect(resolved.manifest.runtime_id).toBe('audit-nested');
    expect(resolved.manifestDirs[0]).toBe(runtimeDir);
  });
});
