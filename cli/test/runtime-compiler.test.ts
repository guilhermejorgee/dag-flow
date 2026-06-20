import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { resolveManifest } from '../src/compiler/manifest-resolver.js';
import {
  applyPartialsPass,
  applyScalarsPass,
  compileMarkdown,
  compileRuntimeSkill,
  isCompiledSkillScript,
  validateNoRemainingPlaceholders,
} from '../src/compiler/runtime-compiler.js';
import type { ResolvedManifest } from '../src/compiler/manifest-types.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');

function makeResolved(manifestDirs: string[], overrides?: Partial<ResolvedManifest['manifest']>): ResolvedManifest {
  const base = resolveManifest('antigravity', { packageRoot: CLI_ROOT });
  return {
    manifest: { ...base.manifest, ...overrides },
    manifestDirs,
  };
}

describe('runtime-compiler', () => {
  describe('isCompiledSkillScript', () => {
    it('allows whitelist scripts and validate_*.py', () => {
      expect(isCompiledSkillScript('dag_runner.py')).toBe(true);
      expect(isCompiledSkillScript('validate_dag_coherence.py')).toBe(true);
      expect(isCompiledSkillScript('validate_pagrl.py')).toBe(true);
    });

    it('excludes migrate_* and test_*', () => {
      expect(isCompiledSkillScript('migrate_dags_to_json.py')).toBe(false);
      expect(isCompiledSkillScript('test_dag_runner.py')).toBe(false);
    });

    it('excludes non-whitelisted scripts', () => {
      expect(isCompiledSkillScript('random_helper.py')).toBe(false);
    });
  });

  describe('two-pass compilation', () => {
    const partialsDir = path.join(TEST_DIR, 'fixtures', 'compiler-partials');
    const orchestrator: ResolvedManifest = {
      manifest: {
        schema_version: 1,
        runtime_id: 'test',
        extends: null,
        orchestrator: {
          hook_wiring_tier: 'none',
          hook_config_path: null,
          hook_event: null,
          hook_entry_id: null,
          boot_file: null,
          skill_install_path: '.skills',
          partials: { SPAWN_SUBAGENT_BLOCK: 'spawn-subagent.md' },
          placeholders: {
            TOOL_RUN_COMMAND: 'run_command',
            TOOL_VIEW_FILE: 'view_file',
            RUNTIME_NAME: 'Antigravity',
          },
        },
        worker: {
          command_template: ['agy'],
          worker_validation_status: 'validated',
          auditor_wrapper: null,
          placeholders: {
            CLI_COMMAND_PREFIX: 'agy --dangerously-skip-permissions',
            AUDITOR_COMMAND_TEMPLATE: 'agy audit template',
          },
        },
      },
      manifestDirs: [partialsDir],
    };
    const worker = orchestrator;

    it('pass 1 injects partial before pass 2 resolves nested scalar', () => {
      mkdirSync(path.join(partialsDir, 'partials'), { recursive: true });
      writeFileSync(
        path.join(partialsDir, 'partials', 'spawn-subagent.md'),
        'Spawn via <<<DAG:RUNTIME_NAME>>> runtime.\n',
      );

      const source = 'Step: <<<DAG:SPAWN_SUBAGENT_BLOCK>>>';
      const afterP1 = applyPartialsPass(source, orchestrator);
      expect(afterP1).toContain('<<<DAG:RUNTIME_NAME>>>');
      expect(afterP1).not.toContain('<<<DAG:SPAWN_SUBAGENT_BLOCK>>>');

      const compiled = applyScalarsPass(afterP1, orchestrator, worker);
      expect(compiled).toBe('Step: Spawn via Antigravity runtime.');
      validateNoRemainingPlaceholders(compiled);
    });

    it('compileMarkdown rejects unresolved placeholders', () => {
      expect(() =>
        compileMarkdown('missing <<<DAG:UNKNOWN>>>', orchestrator, worker),
      ).toThrow(/Unresolved/);
    });
  });

  describe('compileRuntimeSkill', () => {
    it('copies only whitelisted scripts and compiles markdown', () => {
      const sourceRoot = mkdtempSync(path.join(tmpdir(), 'dag-source-'));
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-out-'));

      writeFileSync(
        path.join(sourceRoot, 'SKILL.md'),
        'Tool: <<<DAG:TOOL_RUN_COMMAND>>> | CLI: <<<DAG:CLI_COMMAND_PREFIX>>>\n',
      );
      mkdirSync(path.join(sourceRoot, 'references'), { recursive: true });
      writeFileSync(
        path.join(sourceRoot, 'references', 'tasks.md'),
        'Runtime: <<<DAG:RUNTIME_NAME>>>\n',
      );
      mkdirSync(path.join(sourceRoot, 'scripts'), { recursive: true });
      writeFileSync(path.join(sourceRoot, 'scripts', 'dag_runner.py'), '# runner\n');
      writeFileSync(path.join(sourceRoot, 'scripts', 'test_dag_runner.py'), '# test\n');
      writeFileSync(path.join(sourceRoot, 'scripts', 'migrate_dags.py'), '# migrate\n');

      const orchestrator = makeResolved([path.join(CLI_ROOT, 'manifests', 'antigravity')]);
      const worker = orchestrator;

      const result = compileRuntimeSkill({
        sourceSkillRoot: sourceRoot,
        orchestrator,
        worker,
        outputDir,
      });

      const skillOut = readFileSync(path.join(outputDir, 'SKILL.md'), 'utf8');
      const tasksOut = readFileSync(path.join(outputDir, 'references', 'tasks.md'), 'utf8');
      expect(skillOut).toContain('Tool: run_command');
      expect(skillOut).toContain('CLI: agy --dangerously-skip-permissions');
      expect(skillOut).not.toMatch(/<<<DAG:/);
      expect(tasksOut).toContain('Runtime: Antigravity');
      expect(tasksOut).not.toMatch(/<<<DAG:/);

      const scripts = readdirSync(path.join(outputDir, 'scripts')).sort();
      expect(scripts).toEqual(['dag_runner.py']);
      expect(result.scripts).toEqual(['dag_runner.py']);
    });

    it('matches repo scripts whitelist against golden fixture set', () => {
      const goldenScriptsDir = path.join(
        REPO_ROOT,
        'cli/test/fixtures/antigravity-parity-golden/scripts',
      );
      const goldenScripts = readdirSync(goldenScriptsDir).sort();
      const allowed = goldenScripts.filter(isCompiledSkillScript).sort();
      expect(allowed).toEqual(goldenScripts);
    });
  });
});
