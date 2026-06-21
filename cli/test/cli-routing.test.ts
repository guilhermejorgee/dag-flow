import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const CLI_BIN = path.join(CLI_ROOT, 'dist', 'index.js');

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-cli-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function runCli(args: string[], env: Record<string, string> = {}): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(process.execPath, [CLI_BIN, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('CLI routing (dist binary)', () => {
  it('passes all flags after update to runUpdate (not as spurious subcommand)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-cli-update-'));
    const binDir = makeFakeBinDir(['context-mode', 'rtk']);

    const init = runCli(
      [
        'init',
        '--orchestrator=antigravity',
        `--target=${target}`,
        '--skill-install-path=skills',
        '--project-scaffold=false',
      ],
      { PATH: `${binDir}:${process.env.PATH ?? ''}` },
    );
    expect(init.status).toBe(0);

    const vaultDir = path.join(target, '.specs', 'dags');
    mkdirSync(vaultDir, { recursive: true });
    writeFileSync(
      path.join(vaultDir, 'feature.json'),
      `${JSON.stringify([{ id: 'T1', status: 'Failed' }])}\n`,
      'utf8',
    );

    const blocked = runCli(
      ['update', `--target=${target}`, '--skill-install-path=skills'],
      { PATH: `${binDir}:${process.env.PATH ?? ''}` },
    );
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain('incomplete tasks');
    expect(blocked.stderr).not.toContain('Compiled Skill not found');
  });

  it('blocks update when vault has Not Done status (strict guard via dist binary)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-cli-not-done-'));
    const binDir = makeFakeBinDir(['context-mode', 'rtk']);

    const init = runCli(
      [
        'init',
        '--orchestrator=antigravity',
        `--target=${target}`,
        '--skill-install-path=skills',
        '--project-scaffold=false',
      ],
      { PATH: `${binDir}:${process.env.PATH ?? ''}` },
    );
    expect(init.status).toBe(0);

    const vaultDir = path.join(target, '.specs', 'dags');
    mkdirSync(vaultDir, { recursive: true });
    writeFileSync(
      path.join(vaultDir, 'feature.json'),
      `${JSON.stringify([{ id: 'T1', status: 'Not Done' }])}\n`,
      'utf8',
    );

    const blocked = runCli(
      ['update', `--target=${target}`, '--skill-install-path=skills'],
      { PATH: `${binDir}:${process.env.PATH ?? ''}` },
    );
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain('incomplete tasks');
    expect(blocked.stderr).toContain('Not Done');
  });

  describe('init step order via dist binary (A1 / D5)', () => {
    function seedSkill(target: string, installPath: string): void {
      const outputDir = path.join(target, installPath, 'dag-flow');
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, 'SKILL.md'), '# existing', 'utf8');
    }

    it('surfaces InitError when compiled skill exists and worker manifest is invalid', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cli-a1-idem-'));
      seedSkill(target, '.agents/skills');
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      const result = runCli(
        [
          'init',
          '--orchestrator=antigravity',
          '--worker=__nonexistent__',
          `--target=${target}`,
          '--project-scaffold=false',
        ],
        { PATH: `${binDir}:${process.env.PATH ?? ''}` },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('dag update');
      expect(result.stderr).toContain(path.join(target, '.agents/skills/dag-flow'));
      expect(result.stderr).not.toContain('Manifest not found');
      expect(result.stdout).toBe('');
    });

    it('surfaces ManifestResolverError when worker is invalid and output dir is absent', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cli-a1-worker-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      const result = runCli(
        [
          'init',
          '--orchestrator=antigravity',
          '--worker=__nonexistent__',
          `--target=${target}`,
          '--project-scaffold=false',
        ],
        { PATH: `${binDir}:${process.env.PATH ?? ''}` },
      );

      expect(result.status).toBe(1);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toContain('Manifest not found');
      expect(combined).not.toContain('dag update');
    });

    it('surfaces ManifestResolverError for invalid orchestrator before idempotency', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cli-a1-orch-'));
      seedSkill(target, 'skills');
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      const result = runCli(
        [
          'init',
          '--orchestrator=__nonexistent__',
          `--target=${target}`,
          '--skill-install-path=skills',
          '--project-scaffold=false',
        ],
        { PATH: `${binDir}:${process.env.PATH ?? ''}` },
      );

      expect(result.status).toBe(1);
      const combined = `${result.stdout}\n${result.stderr}`;
      expect(combined).toContain('Manifest not found');
      expect(combined).not.toContain('dag update');
    });
  });
});
