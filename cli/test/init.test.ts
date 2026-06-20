import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { InitError, parseInitArgs, runInit } from '../src/commands/init.js';
import { PrerequisitesError } from '../src/prerequisites.js';

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-init-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
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
});
