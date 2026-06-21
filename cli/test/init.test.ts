import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, jest } from '@jest/globals';
import { InitError, parseInitArgs, runInit } from '../src/commands/init.js';
import { ManifestResolverError } from '../src/compiler/manifest-resolver.js';
import { PrerequisitesError } from '../src/prerequisites.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const EXTERNAL_MANIFEST = path.join(TEST_DIR, 'fixtures', 'manifest-resolver', 'external-nested');
const CHILD_OVERRIDE_MANIFEST = path.join(TEST_DIR, 'fixtures', 'manifest-resolver', 'child-override');

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-init-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function seedCompiledSkill(outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'SKILL.md'), '# existing', 'utf8');
}

describe('dag init', () => {
  describe('parseInitArgs', () => {
    it('parses orchestrator, target, and project-scaffold=false', () => {
      const options = parseInitArgs([
        '--orchestrator=antigravity',
        '--target=/tmp/dag-test',
        '--project-scaffold=false',
      ]);
      expect(options.orchestrator).toBe('antigravity');
      expect(options.target).toBe('/tmp/dag-test');
      expect(options.projectScaffold).toBe(false);
      expect(options.worker).toBe('antigravity');
    });
  });

  it('aborts without prerequisites on PATH', () => {
    expect(() =>
      runInit(
        ['--orchestrator=antigravity', '--target=/tmp/x', '--project-scaffold=false'],
        { pathEnv: '' },
      ),
    ).toThrow(PrerequisitesError);
  });

  it('aborts when compiled skill exists without --force', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
    const outputDir = path.join(target, 'skills', 'dag-flow');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, 'SKILL.md'), '# existing', 'utf8');

    const binDir = makeFakeBinDir(['context-mode', 'rtk']);
    expect(() =>
      runInit(
        [
          '--orchestrator=antigravity',
          `--target=${target}`,
          '--skill-install-path=skills',
          '--project-scaffold=false',
        ],
        { pathEnv: binDir },
      ),
    ).toThrow(InitError);
  });

  describe('init step order (A1 / D5)', () => {
    it('throws ManifestResolverError when worker manifest is invalid and compiled skill is absent', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      expect(() =>
        runInit(
          [
            '--orchestrator=antigravity',
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--skill-install-path=skills',
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(ManifestResolverError);
    });

    it('InitError message guides dag update when compiled skill already exists', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, 'skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      let caught: unknown;
      try {
        runInit(
          [
            '--orchestrator=antigravity',
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--skill-install-path=skills',
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(InitError);
      const message = (caught as InitError).message;
      expect(message).toContain('dag update');
      expect(message).toContain(path.join(target, 'skills', 'dag-flow'));
      expect(message).not.toContain('Manifest not found');
    });

    it('idempotency uses default antigravity skill_install_path without override', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, '.agents/skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      expect(() =>
        runInit(
          [
            '--orchestrator=antigravity',
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(InitError);
    });

    it('idempotency uses merged extends skill_install_path before worker resolve', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, '.external/skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      expect(() =>
        runInit(
          [
            `--orchestrator=${EXTERNAL_MANIFEST}`,
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(InitError);
    });

    it('idempotency uses child-overridden skill_install_path from extends merge', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, '.cursor/skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      expect(() =>
        runInit(
          [
            `--orchestrator=${CHILD_OVERRIDE_MANIFEST}`,
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(InitError);
    });

    it('throws ManifestResolverError for invalid orchestrator even when compiled skill exists', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, 'skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      expect(() =>
        runInit(
          [
            '--orchestrator=__nonexistent__',
            `--target=${target}`,
            '--skill-install-path=skills',
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(ManifestResolverError);
    });

    it('throws ManifestResolverError on invalid worker after --force passes idempotency', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, 'skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() =>
        runInit(
          [
            '--orchestrator=antigravity',
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--skill-install-path=skills',
            '--project-scaffold=false',
            '--force',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(ManifestResolverError);

      warn.mockRestore();
    });

    it('honors --skill-install-path override for idempotency not manifest default', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, '.agents/skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      expect(() =>
        runInit(
          [
            '--orchestrator=antigravity',
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--skill-install-path=skills',
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(ManifestResolverError);
    });

    it('invalid orchestrator fails on orchestrator manifest path when worker defaults match', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      let caught: unknown;
      try {
        runInit(
          [
            '--orchestrator=__nonexistent__',
            `--target=${target}`,
            '--skill-install-path=skills',
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ManifestResolverError);
      expect((caught as ManifestResolverError).message).toContain('manifests/__nonexistent__');
    });

    it('invalid worker fails on worker manifest path only after idempotency gate passes', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      let caught: unknown;
      try {
        runInit(
          [
            '--orchestrator=antigravity',
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--skill-install-path=skills',
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ManifestResolverError);
      expect((caught as ManifestResolverError).message).toContain('manifests/__nonexistent__');
    });

    it('idempotency at cursor default path blocks before invalid worker resolve', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      seedCompiledSkill(path.join(target, '.cursor/skills', 'dag-flow'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      expect(() =>
        runInit(
          [
            '--orchestrator=cursor',
            '--worker=__nonexistent__',
            `--target=${target}`,
            '--project-scaffold=false',
          ],
          { pathEnv: binDir },
        ),
      ).toThrow(InitError);
    });

    it('dual-manifest init succeeds when worker differs and both manifests are valid', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);

      runInit(
        [
          '--orchestrator=antigravity',
          '--worker=cursor',
          `--target=${target}`,
          '--skill-install-path=skills',
          '--project-scaffold=false',
        ],
        { pathEnv: binDir },
      );

      const configPath = path.join(target, 'skills', 'dag-flow', 'dag-config.json');
      expect(existsSync(configPath)).toBe(true);
      const config = JSON.parse(readFileSync(configPath, 'utf8'));
      expect(config._meta.orchestrator).toBe('antigravity');
      expect(config._meta.worker).toBe('cursor');
    });
  });

  it('aborts with InitError when compiled skill exists even if worker manifest is invalid', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
    const outputDir = path.join(target, 'skills', 'dag-flow');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path.join(outputDir, 'SKILL.md'), '# existing', 'utf8');

    const binDir = makeFakeBinDir(['context-mode', 'rtk']);
    expect(() =>
      runInit(
        [
          '--orchestrator=antigravity',
          '--worker=__nonexistent__',
          `--target=${target}`,
          '--skill-install-path=skills',
          '--project-scaffold=false',
        ],
        { pathEnv: binDir },
      ),
    ).toThrow(InitError);
  });

  it('writes dag-config.json after compile', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-init-'));
    const binDir = makeFakeBinDir(['context-mode', 'rtk']);

    runInit(
      [
        '--orchestrator=antigravity',
        `--target=${target}`,
        '--skill-install-path=skills',
        '--project-scaffold=false',
      ],
      { pathEnv: binDir },
    );

    const configPath = path.join(target, 'skills', 'dag-flow', 'dag-config.json');
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(config._meta.orchestrator).toBe('antigravity');
    expect(config.worker.command_template[0]).toBe('agy');
  });

  it('init resolves external orchestrator path containing slash (A2)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-init-external-'));
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

    const configPath = path.join(target, 'skills', 'dag-flow', 'dag-config.json');
    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(config._meta.orchestrator).toBe(EXTERNAL_MANIFEST);
    expect(config._meta.worker).toBe(EXTERNAL_MANIFEST);
  });
});
