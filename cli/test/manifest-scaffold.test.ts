import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runInit } from '../src/commands/init.js';
import {
  ManifestScaffoldError,
  parseScaffoldArgs,
  scaffoldManifest,
} from '../src/commands/manifest/scaffold.js';
import { resolveManifest } from '../src/compiler/manifest-resolver.js';
import {
  compileRuntimeSkill,
  validateNoRemainingPlaceholders,
} from '../src/compiler/runtime-compiler.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');
const CLI_BIN = path.join(CLI_ROOT, 'dist', 'index.js');
const CURSOR_PARTIALS = path.join(CLI_ROOT, 'manifests', 'cursor', 'partials');
const ANTIGRAVITY_PARTIALS = path.join(CLI_ROOT, 'manifests', 'antigravity', 'partials');

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function runCli(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI_BIN, ...args], { encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('dag manifest scaffold', () => {
  describe('parseScaffoldArgs', () => {
    it('parses --extends and --output with absolute path', () => {
      const options = parseScaffoldArgs([
        '--extends=cursor',
        '--output=/tmp/my-runtime',
      ]);
      expect(options.extendsId).toBe('cursor');
      expect(options.output).toBe('/tmp/my-runtime');
    });

    it('resolves relative --output against cwd', () => {
      const options = parseScaffoldArgs(['--extends=cursor', '--output=./my-runtime']);
      expect(options.output).toBe(path.resolve('./my-runtime'));
    });

    it('errors without --extends', () => {
      expect(() => parseScaffoldArgs(['--output=/tmp/x'])).toThrow(ManifestScaffoldError);
      expect(() => parseScaffoldArgs(['--output=/tmp/x'])).toThrow(
        '--extends is required. Built-in runtimes: antigravity, cursor',
      );
    });

    it('errors without --output', () => {
      expect(() => parseScaffoldArgs(['--extends=cursor'])).toThrow(ManifestScaffoldError);
      expect(() => parseScaffoldArgs(['--extends=cursor'])).toThrow('--output is required');
    });
  });

  describe('scaffoldManifest errors', () => {
    it('rejects unknown built-in extends id', () => {
      const outputDir = path.join(mkdtempSync(path.join(tmpdir(), 'dag-scaffold-err-')), 'x');
      expect(() => scaffoldManifest({ extendsId: 'claude', output: outputDir })).toThrow(
        'Unknown built-in runtime "claude". Built-in runtimes: antigravity, cursor',
      );
    });

    it('rejects empty extends id', () => {
      const outputDir = path.join(mkdtempSync(path.join(tmpdir(), 'dag-scaffold-err-')), 'x');
      expect(() => scaffoldManifest({ extendsId: '', output: outputDir })).toThrow(
        'Unknown built-in runtime ""',
      );
    });

    it('rejects output path without runtime directory name', () => {
      expect(() => scaffoldManifest({ extendsId: 'cursor', output: '.' })).toThrow(
        'output path must name the runtime directory',
      );
    });

    it('rejects filesystem root as output', () => {
      expect(() => scaffoldManifest({ extendsId: 'cursor', output: '/' })).toThrow(
        'output path must name the runtime directory',
      );
    });

    it('refuses to overwrite existing manifest.json', () => {
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-exists-'));
      writeFileSync(path.join(outputDir, 'manifest.json'), '{}\n', 'utf8');

      expect(() => scaffoldManifest({ extendsId: 'cursor', output: outputDir })).toThrow(
        `Manifest already exists at ${path.join(outputDir, 'manifest.json')}`,
      );
    });
  });

  describe('scaffoldManifest cursor', () => {
    it('writes manifest.json, deduped partials, and resolves via extends', () => {
      const base = mkdtempSync(path.join(tmpdir(), 'dag-manifest-scaffold-'));
      const outputDir = path.join(base, 'my-runtime');

      const created = scaffoldManifest({ extendsId: 'cursor', output: outputDir });
      expect(created).toBe(outputDir);

      const manifest = JSON.parse(readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'));
      expect(manifest.extends).toBe('cursor');
      expect(manifest.runtime_id).toBe('my-runtime');
      expect(manifest.orchestrator.placeholders.RUNTIME_NAME).toBe('My Runtime');
      expect(manifest.worker.worker_validation_status).toBe('pending');
      expect(manifest.orchestrator.partials.SPAWN_SUBAGENT_BLOCK).toBe('spawn-subagent.md');

      const partialPath = path.join(outputDir, 'partials', 'spawn-subagent.md');
      expect(existsSync(partialPath)).toBe(true);
      expect(readFileSync(partialPath, 'utf8')).toBe(
        readFileSync(path.join(CURSOR_PARTIALS, 'spawn-subagent.md'), 'utf8'),
      );
      expect(existsSync(path.join(outputDir, 'partials', 'spawn-subagent-skill.md'))).toBe(false);

      const resolved = resolveManifest(outputDir, { packageRoot: CLI_ROOT });
      expect(resolved.manifest.runtime_id).toBe('my-runtime');
      expect(resolved.manifest.orchestrator.placeholders.TOOL_SPAWN_SUBAGENT).toBe('Task');
      expect(resolved.manifestDirs).toEqual([
        outputDir,
        path.join(CLI_ROOT, 'manifests', 'cursor'),
      ]);
    });

    it('formats runtime_id with underscores into RUNTIME_NAME', () => {
      const base = mkdtempSync(path.join(tmpdir(), 'dag-manifest-scaffold-'));
      const outputDir = path.join(base, 'my_custom_runtime');

      scaffoldManifest({ extendsId: 'cursor', output: outputDir });
      const manifest = JSON.parse(readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'));
      expect(manifest.orchestrator.placeholders.RUNTIME_NAME).toBe('My Custom Runtime');
    });
  });

  describe('scaffoldManifest antigravity', () => {
    it('copies all three unique spawn partial files', () => {
      const outputDir = path.join(mkdtempSync(path.join(tmpdir(), 'dag-scaffold-agy-')), 'agy-custom');

      scaffoldManifest({ extendsId: 'antigravity', output: outputDir });

      const manifest = JSON.parse(readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'));
      expect(manifest.extends).toBe('antigravity');
      expect(manifest.runtime_id).toBe('agy-custom');
      expect(manifest.orchestrator.partials).toEqual({
        SPAWN_SUBAGENT_BLOCK: 'spawn-subagent.md',
        SPAWN_SUBAGENT_SKILL_BLOCK: 'spawn-subagent-skill.md',
        SPAWN_SUBAGENT_QUICK_BLOCK: 'spawn-subagent-quick.md',
      });

      for (const partial of [
        'spawn-subagent.md',
        'spawn-subagent-skill.md',
        'spawn-subagent-quick.md',
      ]) {
        const target = path.join(outputDir, 'partials', partial);
        expect(readFileSync(target, 'utf8')).toBe(
          readFileSync(path.join(ANTIGRAVITY_PARTIALS, partial), 'utf8'),
        );
      }
    });
  });

  describe('§5.8 child partial override', () => {
    it('uses scaffolded partial content over parent when edited', () => {
      const outputDir = path.join(mkdtempSync(path.join(tmpdir(), 'dag-scaffold-override-')), 'custom');
      scaffoldManifest({ extendsId: 'cursor', output: outputDir });

      const marker = 'CUSTOM_SPAWN_MARKER_FOR_SESSION9';
      writeFileSync(path.join(outputDir, 'partials', 'spawn-subagent.md'), `${marker}\n`, 'utf8');

      const resolved = resolveManifest(outputDir, { packageRoot: CLI_ROOT });
      const outputCompileDir = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-compile-'));
      compileRuntimeSkill({
        sourceSkillRoot: REPO_ROOT,
        orchestrator: resolved,
        worker: resolved,
        outputDir: outputCompileDir,
      });

      const tasks = readFileSync(path.join(outputCompileDir, 'references/tasks.md'), 'utf8');
      expect(tasks).toContain(marker);
      validateNoRemainingPlaceholders(tasks, 'references/tasks.md');
    });
  });

  describe('integration: scaffold → dag init', () => {
    it('compiles installed skill from external scaffolded manifest path', () => {
      const base = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-init-'));
      const runtimeDir = path.join(base, 'acme-runtime');
      scaffoldManifest({ extendsId: 'cursor', output: runtimeDir });

      const target = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-target-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      runInit(
        [`--orchestrator=${runtimeDir}`, `--target=${target}`, '--project-scaffold=false'],
        { pathEnv: binDir },
      );

      const skillDir = path.join(target, '.cursor/skills/dag-flow');
      expect(existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);

      const tasks = readFileSync(path.join(skillDir, 'references/tasks.md'), 'utf8');
      expect(tasks).toContain('`Shell`');
      expect(tasks).toContain('`Task`');
      expect(tasks).toContain('cursor agent');
      validateNoRemainingPlaceholders(tasks, 'references/tasks.md');

      const config = JSON.parse(readFileSync(path.join(skillDir, 'dag-config.json'), 'utf8'));
      expect(config._meta.orchestrator).toBe(runtimeDir);
      expect(config._meta.worker).toBe('acme-runtime');
    });

    it('wires inherited pre_tool_use hooks for scaffolded cursor manifest', () => {
      const base = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-hooks-'));
      const runtimeDir = path.join(base, 'hooked-runtime');
      scaffoldManifest({ extendsId: 'cursor', output: runtimeDir });

      const target = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-hooks-target-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      runInit(
        [`--orchestrator=${runtimeDir}`, `--target=${target}`, '--project-scaffold=false'],
        { pathEnv: binDir },
      );

      const hooksPath = path.join(target, '.cursor/hooks.json');
      expect(existsSync(hooksPath)).toBe(true);

      const hooks = JSON.parse(readFileSync(hooksPath, 'utf8')) as {
        hooks: { preToolUse: Array<{ id?: string; command: string }> };
      };
      expect(
        hooks.hooks.preToolUse.some(
          (entry) => entry.id === 'dag-flow-guard' || entry.command.includes('dag-flow-guard'),
        ),
      ).toBe(true);
    });

    it('compiles antigravity-tier scaffold via boot_file wiring', () => {
      const base = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-agy-init-'));
      const runtimeDir = path.join(base, 'agy-custom');
      scaffoldManifest({ extendsId: 'antigravity', output: runtimeDir });

      const target = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-agy-target-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      runInit(
        [`--orchestrator=${runtimeDir}`, `--target=${target}`, '--project-scaffold=false'],
        { pathEnv: binDir },
      );

      const skillDir = path.join(target, '.agents/skills/dag-flow');
      expect(existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(target, 'GEMINI.md'))).toBe(true);

      const tasks = readFileSync(path.join(skillDir, 'references/tasks.md'), 'utf8');
      expect(tasks).toContain('run_command');
      expect(tasks).toContain('agy --dangerously-skip-permissions');
      validateNoRemainingPlaceholders(tasks, 'references/tasks.md');
    });
  });

  describe('CLI (dist binary)', () => {
    it('happy path writes scaffold output', () => {
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-cli-scaffold-'));

      const result = runCli([
        'manifest',
        'scaffold',
        '--extends=cursor',
        `--output=${outputDir}`,
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain(`Scaffolded runtime manifest at ${outputDir}`);
      expect(existsSync(path.join(outputDir, 'manifest.json'))).toBe(true);
      expect(existsSync(path.join(outputDir, 'partials', 'spawn-subagent.md'))).toBe(true);
    });

    it('errors without --extends and lists built-ins', () => {
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-cli-scaffold-err-'));

      const result = runCli(['manifest', 'scaffold', `--output=${outputDir}`]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('--extends is required');
      expect(result.stderr).toContain('antigravity, cursor');
      expect(existsSync(path.join(outputDir, 'manifest.json'))).toBe(false);
    });

    it('errors without --output', () => {
      const result = runCli(['manifest', 'scaffold', '--extends=cursor']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('--output is required');
    });

    it('errors on unknown --extends', () => {
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-cli-scaffold-bad-ext-'));
      const result = runCli([
        'manifest',
        'scaffold',
        '--extends=claude',
        `--output=${outputDir}`,
      ]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Unknown built-in runtime "claude"');
      expect(existsSync(path.join(outputDir, 'manifest.json'))).toBe(false);
    });

    it('scaffolds antigravity via CLI', () => {
      const outputDir = path.join(mkdtempSync(path.join(tmpdir(), 'dag-cli-scaffold-agy-')), 'custom-agy');
      mkdirSync(path.dirname(outputDir), { recursive: true });

      const result = runCli([
        'manifest',
        'scaffold',
        '--extends=antigravity',
        `--output=${outputDir}`,
      ]);
      expect(result.status).toBe(0);
      expect(existsSync(path.join(outputDir, 'partials', 'spawn-subagent-quick.md'))).toBe(true);
    });
  });
});
