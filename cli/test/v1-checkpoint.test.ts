import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { DAG_FLOW_VERSION } from '../src/constants.js';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');

const V1_ADR_SLUGS = [
  '0010-dag-flow-hook-guard-router.md',
  '0011-dual-manifest-compilation.md',
  '0012-pending-dag-guard.md',
  '0013-manifest-inheritance.md',
  '0014-orchestrator-worker-split.md',
  '0015-compiled-skill-scripts-whitelist.md',
  '0016-v1-runtime-scope.md',
  '0017-per-runtime-worker-permission-flags.md',
] as const;

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-v1-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function writeVaultDag(target: string, filename: string, tasks: unknown[]): void {
  const vaultDir = path.join(target, '.specs', 'dags');
  mkdirSync(vaultDir, { recursive: true });
  chmodSync(vaultDir, 0o755);
  writeFileSync(path.join(vaultDir, filename), `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
}

describe('V1 checkpoint', () => {
  describe('ADRs 0010–0017', () => {
    it.each(V1_ADR_SLUGS)('%s exists with status: accepted', (slug) => {
      const adrPath = path.join(REPO_ROOT, 'docs/adr', slug);
      expect(existsSync(adrPath)).toBe(true);
      const content = readFileSync(adrPath, 'utf8');
      expect(content).toMatch(/^---[\s\S]*?status:\s*accepted/m);
    });
  });

  describe('dag init + update matrix', () => {
    it('antigravity: init scaffold + update recompiles inline discovery', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-v1-agy-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      runInit(
        [
          '--orchestrator=antigravity',
          `--target=${target}`,
          '--skill-install-path=skills',
        ],
        { pathEnv: binDir },
      );

      for (const [dir, mode] of [
        ['staging', '755'],
        ['features', '555'],
        ['dags', '555'],
      ] as const) {
        const modeOct = parseInt(mode, 8);
        expect(statSync(path.join(target, '.specs', dir)).mode & 0o777).toBe(modeOct);
      }

      const skillDir = path.join(target, 'skills', 'dag-flow');
      writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done' }]);
      writeFileSync(path.join(skillDir, 'SKILL.md'), '# stale', 'utf8');

      runUpdate([`--target=${target}`, '--skill-install-path=skills']);

      const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
      expect(skill).not.toContain('stale');
      expect(skill).toContain('ctx_search');
      expect(skill).not.toMatch(/discovery\.md/i);

      const config = JSON.parse(readFileSync(path.join(skillDir, 'dag-config.json'), 'utf8'));
      expect(config._meta.orchestrator).toBe('antigravity');
      expect(config._meta.dag_flow_version).toBe(DAG_FLOW_VERSION);
    });

    it('cursor: init wires guard hook + update preserves worker and recompiles', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-v1-cursor-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      runInit(
        ['--orchestrator=cursor', `--target=${target}`, '--project-scaffold=false'],
        { pathEnv: binDir },
      );

      const skillDir = path.join(target, '.cursor/skills/dag-flow');
      const configPath = path.join(skillDir, 'dag-config.json');
      const customWorker = {
        command_template: ['v1-cursor-worker', '-p', '<<<PROMPT>>>'],
        worker_validation_status: 'validated',
      };
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      config.worker = customWorker;
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

      writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done' }]);
      runUpdate([`--target=${target}`]);

      const after = JSON.parse(readFileSync(configPath, 'utf8'));
      expect(after.worker).toEqual(customWorker);
      expect(after._meta.orchestrator).toBe('cursor');

      const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
      expect(skill).toContain('ctx_search');
      expect(skill).not.toMatch(/discovery\.md/i);

      const hooks = JSON.parse(readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'));
      const guard = hooks.hooks.preToolUse.find(
        (e: { id?: string }) => e.id === 'dag-flow-guard',
      );
      expect(guard?.command).toBeTruthy();
      expect(existsSync(path.join(skillDir, 'scripts/dag_runner.py'))).toBe(true);
      expect(existsSync(path.join(skillDir, 'scripts/auditor.py'))).toBe(true);
    });
  });
});
