import { execSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { isCompiledSkillScript } from '../src/compiler/runtime-compiler.js';
import { runInit } from '../src/commands/init.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');

const ANTIGRAVITY_GOLDEN = path.join(CLI_ROOT, 'test/fixtures/antigravity-parity-golden');
const CURSOR_GOLDEN = path.join(CLI_ROOT, 'test/fixtures/cursor-parity-golden');

const ANTIGRAVITY_LEAK_IN_CURSOR = [
  /\bagy\b/,
  /\brun_command\b/,
  /\bview_file\b/,
  /\bdefine_subagent\b/,
  /--dangerously-skip-permissions/,
] as const;

const CURSOR_LEAK_IN_ANTIGRAVITY = [/\bcursor agent\b/] as const;

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-golden-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function listRelativeFiles(dir: string, base = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(full, base));
    } else if (entry.isFile()) {
      files.push(path.relative(base, full));
    }
  }
  return files.sort();
}

function readTree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const rel of listRelativeFiles(dir)) {
    out.set(rel, readFileSync(path.join(dir, rel), 'utf8'));
  }
  return out;
}

function assertCompiledMatchesGolden(
  compiledDir: string,
  goldenDir: string,
  excludeBasenames: string[] = ['dag-config.json'],
): void {
  const golden = readTree(goldenDir);
  const compiled = readTree(compiledDir);

  const compiledFiltered = new Map(
    [...compiled.entries()].filter(([rel]) => !excludeBasenames.includes(path.basename(rel))),
  );

  expect([...compiledFiltered.keys()].sort()).toEqual([...golden.keys()].sort());
  for (const [rel, expected] of golden) {
    expect(compiledFiltered.get(rel)).toBe(expected);
  }
}

function collectMarkdownText(dir: string): string {
  return [...readTree(dir).entries()]
    .filter(([rel]) => rel.endsWith('.md'))
    .map(([, content]) => content)
    .join('\n');
}

function initCompiledSkill(orchestrator: 'antigravity' | 'cursor'): string {
  const target = mkdtempSync(path.join(tmpdir(), `dag-golden-init-${orchestrator}-`));
  const binDir = makeFakeBinDir(['context-mode', 'rtk']);
  runInit(
    [`--orchestrator=${orchestrator}`, `--target=${target}`, '--project-scaffold=false'],
    { pathEnv: binDir },
  );
  const skillRel =
    orchestrator === 'cursor' ? '.cursor/skills/dag-flow' : '.agents/skills/dag-flow';
  return path.join(target, skillRel);
}

describe('golden gate parity', () => {
  describe('fixture structure', () => {
    it.each([
      ['antigravity', ANTIGRAVITY_GOLDEN],
      ['cursor', CURSOR_GOLDEN],
    ] as const)('%s golden exists with SKILL, references, scripts only', (_runtime, goldenDir) => {
      expect(existsSync(goldenDir)).toBe(true);
      expect(existsSync(path.join(goldenDir, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(goldenDir, 'references'))).toBe(true);
      expect(existsSync(path.join(goldenDir, 'scripts'))).toBe(true);
      expect(existsSync(path.join(goldenDir, 'dag-config.json'))).toBe(false);
      expect(existsSync(path.join(goldenDir, 'README.md'))).toBe(false);

      const topLevel = readdirSync(goldenDir).sort();
      expect(topLevel).toEqual(['SKILL.md', 'references', 'scripts']);

      const scripts = readdirSync(path.join(goldenDir, 'scripts')).sort();
      expect(scripts.filter(isCompiledSkillScript).sort()).toEqual(scripts);
    });

    it('cursor and antigravity goldens share script whitelist but differ in compiled markdown', () => {
      const agyScripts = readdirSync(path.join(ANTIGRAVITY_GOLDEN, 'scripts')).sort();
      const cursorScripts = readdirSync(path.join(CURSOR_GOLDEN, 'scripts')).sort();
      expect(cursorScripts).toEqual(agyScripts);

      const agyRefs = listRelativeFiles(path.join(ANTIGRAVITY_GOLDEN, 'references')).sort();
      const cursorRefs = listRelativeFiles(path.join(CURSOR_GOLDEN, 'references')).sort();
      expect(cursorRefs).toEqual(agyRefs);

      expect(readFileSync(path.join(ANTIGRAVITY_GOLDEN, 'SKILL.md'), 'utf8')).not.toBe(
        readFileSync(path.join(CURSOR_GOLDEN, 'SKILL.md'), 'utf8'),
      );
      expect(readFileSync(path.join(ANTIGRAVITY_GOLDEN, 'references/tasks.md'), 'utf8')).not.toBe(
        readFileSync(path.join(CURSOR_GOLDEN, 'references/tasks.md'), 'utf8'),
      );
    });
  });

  describe('cursor golden invariants', () => {
    it('tasks.md contains cursor agent worker CLI', () => {
      const tasks = readFileSync(path.join(CURSOR_GOLDEN, 'references/tasks.md'), 'utf8');
      expect(tasks).toMatch(/cursor agent/);
    });

    it('SKILL.md contains Shell orchestrator tool', () => {
      const skill = readFileSync(path.join(CURSOR_GOLDEN, 'SKILL.md'), 'utf8');
      expect(skill).toMatch(/\bShell\b/);
    });

    it('has no antigravity runtime leak in golden tree', () => {
      const joined = collectMarkdownText(CURSOR_GOLDEN);
      for (const pattern of ANTIGRAVITY_LEAK_IN_CURSOR) {
        expect(joined).not.toMatch(pattern);
      }
    });
  });

  describe('antigravity golden invariants', () => {
    it('tasks.md contains agy worker CLI', () => {
      const tasks = readFileSync(path.join(ANTIGRAVITY_GOLDEN, 'references/tasks.md'), 'utf8');
      expect(tasks).toMatch(/\bagy\b/);
      expect(tasks).toMatch(/--dangerously-skip-permissions/);
    });

    it('has no cursor runtime leak in golden tree', () => {
      const joined = collectMarkdownText(ANTIGRAVITY_GOLDEN);
      for (const pattern of CURSOR_LEAK_IN_ANTIGRAVITY) {
        expect(joined).not.toMatch(pattern);
      }
    });
  });

  describe('dag init matches golden fixtures', () => {
    it('antigravity init output matches antigravity-parity-golden', () => {
      const compiledDir = initCompiledSkill('antigravity');
      assertCompiledMatchesGolden(compiledDir, ANTIGRAVITY_GOLDEN);
      expect(existsSync(path.join(compiledDir, 'dag-config.json'))).toBe(true);
    });

    it('cursor init output matches cursor-parity-golden', () => {
      const compiledDir = initCompiledSkill('cursor');
      assertCompiledMatchesGolden(compiledDir, CURSOR_GOLDEN);
      expect(existsSync(path.join(compiledDir, 'dag-config.json'))).toBe(true);
    });
  });

  describe('parity shell scripts', () => {
    it.each([
      ['verify-antigravity-parity.sh', '.agents/skills/dag-flow', 'Gate de ouro falhou'],
      ['verify-cursor-parity.sh', '.cursor/skills/dag-flow', 'Gate de ouro Cursor falhou'],
    ] as const)('%s conforms to TDD §5.11', (scriptName, compiledPath, failMsg) => {
      const scriptPath = path.join(CLI_ROOT, 'scripts', scriptName);
      const script = readFileSync(scriptPath, 'utf8');

      expect(statSync(scriptPath).mode & 0o111).not.toBe(0);
      expect(script).toMatch(/^#!\/usr\/bin\/env bash/m);
      expect(script).toContain('command -v dag');
      expect(script).toContain(`COMPILED="$OUT/${compiledPath}"`);
      expect(script).toContain('--exclude=dag-config.json');
      expect(script).toContain(failMsg);
      expect(script).not.toMatch(/node dist\/index\.js/);
      expect(script).not.toMatch(/--skill-install-path/);
      expect(script).not.toMatch(/exclude=README/);
      expect(script).not.toMatch(/^npm run build/m);
    });

    describe('executes on PATH via npm link', () => {
      beforeAll(() => {
        execSync('npm run build', { cwd: CLI_ROOT, stdio: 'pipe' });
        execSync('npm link', { cwd: CLI_ROOT, stdio: 'pipe' });
      });

      it.each([
        ['verify-antigravity-parity.sh', 'Paridade Antigravity OK'],
        ['verify-cursor-parity.sh', 'Paridade Cursor OK'],
      ] as const)('%s exits 0', (scriptName, successMsg) => {
        const result = spawnSync('bash', [path.join(CLI_ROOT, 'scripts', scriptName)], {
          cwd: REPO_ROOT,
          encoding: 'utf8',
          env: process.env,
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toContain(successMsg);
      });
    });
  });

  describe('npm scripts and CI wiring', () => {
    it('package.json golden-gate runs both runtime scripts', () => {
      const pkg = JSON.parse(readFileSync(path.join(CLI_ROOT, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts['golden-gate:antigravity']).toContain('verify-antigravity-parity.sh');
      expect(pkg.scripts['golden-gate:cursor']).toContain('verify-cursor-parity.sh');
      expect(pkg.scripts['golden-gate']).toMatch(/golden-gate:antigravity/);
      expect(pkg.scripts['golden-gate']).toMatch(/golden-gate:cursor/);
      expect(pkg.scripts['golden-gate']).toMatch(/npm link/);
    });

    it('CI workflow runs npm link and both parity scripts', () => {
      const workflow = readFileSync(
        path.join(REPO_ROOT, '.github/workflows/cli-golden-gate.yml'),
        'utf8',
      );
      expect(workflow).toMatch(/npm link/);
      expect(workflow).toContain('verify-antigravity-parity.sh');
      expect(workflow).toContain('verify-cursor-parity.sh');
    });

    it('TDD §5.11 documents cursor path and fixture', () => {
      const tdd = readFileSync(
        path.join(REPO_ROOT, 'docs/design/tdd-multi-runtime-support.md'),
        'utf8',
      );
      expect(tdd).toContain('cli/test/fixtures/cursor-parity-golden/');
      expect(tdd).toContain('$OUT/.cursor/skills/dag-flow');
      expect(tdd).toContain('verify-cursor-parity.sh');
      expect(tdd).not.toMatch(/\$OUT\/skills\/dag-flow/);
      expect(tdd).toContain('$OUT/.agents/skills/dag-flow');
    });
  });
});
