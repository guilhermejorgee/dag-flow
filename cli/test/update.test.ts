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
import {
  parseUpdateArgs,
  PendingDagGuardError,
  runUpdate,
  UpdateError,
} from '../src/commands/update.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXTERNAL_MANIFEST = path.join(TEST_DIR, 'fixtures', 'manifest-resolver', 'external-nested');

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-update-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function initAntigravity(target: string, skillInstallPath = 'skills'): void {
  const binDir = makeFakeBinDir(['context-mode', 'rtk']);
  runInit(
    [
      '--orchestrator=antigravity',
      `--target=${target}`,
      `--skill-install-path=${skillInstallPath}`,
      '--project-scaffold=false',
    ],
    { pathEnv: binDir },
  );
}

function skillDir(target: string, skillInstallPath = 'skills'): string {
  return path.join(target, skillInstallPath, 'dag-flow');
}

function writeVaultDag(target: string, filename: string, tasks: unknown[]): void {
  const vaultDir = path.join(target, '.specs', 'dags');
  mkdirSync(vaultDir, { recursive: true });
  writeFileSync(path.join(vaultDir, filename), `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
}

describe('dag update', () => {
  describe('parseUpdateArgs', () => {
    it('parses target and skill-install-path', () => {
      const options = parseUpdateArgs([
        '--target=/tmp/dag-update',
        '--skill-install-path=custom/skills',
      ]);
      expect(options.target).toBe('/tmp/dag-update');
      expect(options.skillInstallPath).toBe('custom/skills');
    });
  });

  it('errors when compiled skill is missing', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-'));
    expect(() =>
      runUpdate([`--target=${target}`, '--skill-install-path=skills']),
    ).toThrow(UpdateError);
  });

  it('guard runs before recompile — vault Failed leaves skill untouched', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-'));
    initAntigravity(target);
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Failed' }]);

    const skillPath = path.join(skillDir(target), 'SKILL.md');
    const marker = '<!-- UPDATE_GUARD_SHOULD_NOT_TOUCH -->';
    writeFileSync(skillPath, marker, 'utf8');
    const mtimeBefore = statSync(skillPath).mtimeMs;

    expect(() =>
      runUpdate([`--target=${target}`, '--skill-install-path=skills']),
    ).toThrow(PendingDagGuardError);
    expect(readFileSync(skillPath, 'utf8')).toBe(marker);
    expect(statSync(skillPath).mtimeMs).toBe(mtimeBefore);
  });

  it('guard runs before recompile — vault Not Done leaves skill untouched', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-'));
    initAntigravity(target);
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Not Done' }]);

    const skillPath = path.join(skillDir(target), 'SKILL.md');
    const marker = '<!-- NOT_DONE_GUARD_SHOULD_NOT_TOUCH -->';
    writeFileSync(skillPath, marker, 'utf8');
    const mtimeBefore = statSync(skillPath).mtimeMs;

    expect(() =>
      runUpdate([`--target=${target}`, '--skill-install-path=skills']),
    ).toThrow(PendingDagGuardError);
    expect(readFileSync(skillPath, 'utf8')).toBe(marker);
    expect(statSync(skillPath).mtimeMs).toBe(mtimeBefore);
  });

  it('preserves custom worker.command_template across update', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-'));
    initAntigravity(target);
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done' }]);

    const configPath = path.join(skillDir(target), 'dag-config.json');
    const customWorker = {
      command_template: ['custom-worker', '--prompt', '<<<PROMPT>>>'],
      worker_validation_status: 'validated',
    };
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    config.worker = customWorker;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

    runUpdate([`--target=${target}`, '--skill-install-path=skills']);

    const after = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(after.worker).toEqual(customWorker);
    expect(after._meta.dag_flow_version).toBe(DAG_FLOW_VERSION);
    expect(after._meta.orchestrator).toBe('antigravity');
  });

  it('recompiles markdown and copies whitelisted scripts', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-'));
    initAntigravity(target);
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done' }]);

    const outputDir = skillDir(target);
    writeFileSync(path.join(outputDir, 'SKILL.md'), '# stale marker', 'utf8');

    runUpdate([`--target=${target}`, '--skill-install-path=skills']);

    const skill = readFileSync(path.join(outputDir, 'SKILL.md'), 'utf8');
    expect(skill).not.toContain('stale marker');
    expect(skill.length).toBeGreaterThan(100);
    expect(existsSync(path.join(outputDir, 'scripts', 'dag_runner.py'))).toBe(true);
  });

  it('discovers default .agents/skills install without --skill-install-path', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-'));
    const binDir = makeFakeBinDir(['context-mode', 'rtk']);
    runInit(
      [
        '--orchestrator=antigravity',
        `--target=${target}`,
        '--project-scaffold=false',
      ],
      { pathEnv: binDir },
    );
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done' }]);

    expect(() => runUpdate([`--target=${target}`])).not.toThrow();
    expect(existsSync(path.join(target, '.agents/skills/dag-flow/SKILL.md'))).toBe(true);
  });

  it('boot_file re-wire stays idempotent across two updates', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-'));
    initAntigravity(target);
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done' }]);

    runUpdate([`--target=${target}`, '--skill-install-path=skills']);
    runUpdate([`--target=${target}`, '--skill-install-path=skills']);

    const gemini = readFileSync(path.join(target, 'GEMINI.md'), 'utf8');
    const markerCount = (gemini.match(/dag-flow-hook/g) ?? []).length;
    expect(markerCount).toBe(1);
    expect(gemini).toContain('cognitive guard rule');
  });

  it('update re-resolves external orchestrator path stored in dag-config (A2 round-trip)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-update-external-'));
    const binDir = makeFakeBinDir(['context-mode', 'rtk']);
    runInit(
      [
        `--orchestrator=${EXTERNAL_MANIFEST}`,
        `--target=${target}`,
        '--skill-install-path=skills',
        '--project-scaffold=false',
      ],
      { pathEnv: binDir },
    );
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done' }]);

    expect(() =>
      runUpdate([`--target=${target}`, '--skill-install-path=skills']),
    ).not.toThrow();

    const config = JSON.parse(
      readFileSync(path.join(skillDir(target), 'dag-config.json'), 'utf8'),
    );
    expect(config._meta.orchestrator).toBe(EXTERNAL_MANIFEST);
    expect(config._meta.worker).toBe(EXTERNAL_MANIFEST);
  });
});
