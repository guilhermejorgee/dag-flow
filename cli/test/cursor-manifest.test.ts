import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { resolveManifest } from '../src/compiler/manifest-resolver.js';
import {
  compileRuntimeSkill,
  isCompiledSkillScript,
  validateNoRemainingPlaceholders,
} from '../src/compiler/runtime-compiler.js';
import { runInit } from '../src/commands/init.js';
import { runUpdate } from '../src/commands/update.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');

const CURSOR_WORKER_FLAGS = [
  '--print',
  '--output-format',
  'text',
  '--trust',
  '--force',
  '--approve-mcps',
] as const;

const ANTIGRAVITY_LEAK_PATTERNS = [
  /\bagy\b/,
  /\brun_command\b/,
  /\bview_file\b/,
  /\bdefine_subagent\b/,
  /--dangerously-skip-permissions/,
] as const;

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-cursor-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function collectMarkdownFiles(dir: string, base = dir): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(full, base));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function readAllCompiledMarkdown(skillDir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of collectMarkdownFiles(skillDir)) {
    out[path.relative(skillDir, file)] = readFileSync(file, 'utf8');
  }
  return out;
}

function initCursor(target: string, options?: { copyHooks?: boolean }): string {
  if (options?.copyHooks) {
    mkdirSync(path.join(target, '.cursor'), { recursive: true });
    copyFileSync(
      path.join(REPO_ROOT, '.cursor/hooks.json'),
      path.join(target, '.cursor/hooks.json'),
    );
  }

  const binDir = makeFakeBinDir(['context-mode', 'rtk']);
  runInit(
    ['--orchestrator=cursor', `--target=${target}`, '--project-scaffold=false'],
    { pathEnv: binDir },
  );
  return path.join(target, '.cursor/skills/dag-flow');
}

describe('cursor built-in manifest', () => {
  describe('manifest resolution', () => {
    it('resolves built-in cursor manifest per TDD §5.7 / ADR-0017', () => {
      const resolved = resolveManifest('cursor', { packageRoot: CLI_ROOT });
      const { manifest } = resolved;

      expect(manifest.runtime_id).toBe('cursor');
      expect(manifest.extends).toBeNull();
      expect(manifest.orchestrator.hook_wiring_tier).toBe('pre_tool_use');
      expect(manifest.orchestrator.hook_config_path).toBe('.cursor/hooks.json');
      expect(manifest.orchestrator.hook_event).toBe('preToolUse');
      expect(manifest.orchestrator.hook_entry_id).toBe('dag-flow-guard');
      expect(manifest.orchestrator.hook_config_adapter).toBe('cursor');
      expect(manifest.orchestrator.boot_file).toBeNull();
      expect(manifest.orchestrator.skill_install_path).toBe('.cursor/skills');
      expect(manifest.orchestrator.placeholders).toEqual({
        TOOL_RUN_COMMAND: 'Shell',
        TOOL_VIEW_FILE: 'Read',
        TOOL_SPAWN_SUBAGENT: 'Task',
        RUNTIME_NAME: 'Cursor',
      });
      expect(manifest.worker.worker_validation_status).toBe('validated');
      expect(manifest.worker.auditor_wrapper).toBeNull();
      expect(manifest.worker.command_template).toEqual([
        'cursor',
        'agent',
        ...CURSOR_WORKER_FLAGS,
        '-p',
        '<<<PROMPT>>>',
      ]);
      expect(manifest.worker.placeholders.CLI_COMMAND_BINARY).toBe('cursor agent');
      expect(manifest.worker.placeholders.CLI_PROMPT_FLAG).toBe('-p');
      expect(manifest.worker.placeholders.CLI_COMMAND_PREFIX).toBe(
        'cursor agent --print --output-format text --trust --force --approve-mcps',
      );
      expect(manifest.worker.placeholders.AUDITOR_COMMAND_TEMPLATE).toMatch(
        /^cursor agent --print --output-format text --trust --force --approve-mcps -p /,
      );
      expect(resolved.manifestDirs[0]).toBe(path.join(CLI_ROOT, 'manifests', 'cursor'));
    });

    it('declares spawn partials for all three injection sites', () => {
      const { manifest } = resolveManifest('cursor', { packageRoot: CLI_ROOT });
      expect(manifest.orchestrator.partials).toEqual({
        SPAWN_SUBAGENT_BLOCK: 'spawn-subagent.md',
        SPAWN_SUBAGENT_SKILL_BLOCK: 'spawn-subagent.md',
        SPAWN_SUBAGENT_QUICK_BLOCK: 'spawn-subagent.md',
      });
    });
  });

  describe('full source skill compilation', () => {
    it('compiles repo source skill with zero unresolved placeholders', () => {
      const manifest = resolveManifest('cursor', { packageRoot: CLI_ROOT });
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-cursor-compile-'));

      const result = compileRuntimeSkill({
        sourceSkillRoot: REPO_ROOT,
        orchestrator: manifest,
        worker: manifest,
        outputDir,
      });

      expect(result.markdownFiles.length).toBeGreaterThanOrEqual(8);
      for (const rel of result.markdownFiles) {
        const content = readFileSync(path.join(outputDir, rel), 'utf8');
        validateNoRemainingPlaceholders(content, rel);
      }
    });

    it('uses Cursor orchestrator tools and worker CLI in compiled output', () => {
      const manifest = resolveManifest('cursor', { packageRoot: CLI_ROOT });
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-cursor-out-'));
      compileRuntimeSkill({
        sourceSkillRoot: REPO_ROOT,
        orchestrator: manifest,
        worker: manifest,
        outputDir,
      });

      const compiled = readAllCompiledMarkdown(outputDir);
      const tasks = compiled['references/tasks.md'];
      const skill = compiled['SKILL.md'];
      const quick = compiled['references/quick-mode.md'];
      const planner = compiled['references/planner-template.md'];

      expect(tasks).toContain('`Read`');
      expect(tasks).toContain('`Shell`');
      expect(tasks).toMatch(/`Task`/);
      expect(tasks).toContain('cursor agent');
      expect(skill).toContain('`Read`');
      expect(skill).toContain('`Shell`');
      expect(quick).toMatch(/`Task`/);
      expect(planner).toContain('`Read`');
      expect(planner).toContain('`Task`');

      const joined = Object.values(compiled).join('\n');
      for (const pattern of ANTIGRAVITY_LEAK_PATTERNS) {
        expect(joined).not.toMatch(pattern);
      }
    });

    it('injects spawn partial at tasks.md step 3', () => {
      const manifest = resolveManifest('cursor', { packageRoot: CLI_ROOT });
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-cursor-spawn-'));
      compileRuntimeSkill({
        sourceSkillRoot: REPO_ROOT,
        orchestrator: manifest,
        worker: manifest,
        outputDir,
      });

      const tasks = readFileSync(path.join(outputDir, 'references/tasks.md'), 'utf8');
      expect(tasks).toMatch(
        /3\. Spawn a Subagent Planner \(`Task` with `subagent_type=generalPurpose`\)/,
      );
      expect(tasks).toContain('references/planner-template.md');
    });

    it('AUDITOR_COMMAND_TEMPLATE shares CLI_COMMAND_PREFIX flag prefix', () => {
      const { manifest } = resolveManifest('cursor', { packageRoot: CLI_ROOT });
      const prefix = manifest.worker.placeholders.CLI_COMMAND_PREFIX;
      const auditor = manifest.worker.placeholders.AUDITOR_COMMAND_TEMPLATE;
      expect(auditor.startsWith(prefix)).toBe(true);
    });

    it('copies the same operational script whitelist as antigravity parity golden', () => {
      const manifest = resolveManifest('cursor', { packageRoot: CLI_ROOT });
      const outputDir = mkdtempSync(path.join(tmpdir(), 'dag-cursor-scripts-'));
      const goldenScriptsDir = path.join(
        REPO_ROOT,
        'cli/test/fixtures/antigravity-parity-golden/scripts',
      );

      const result = compileRuntimeSkill({
        sourceSkillRoot: REPO_ROOT,
        orchestrator: manifest,
        worker: manifest,
        outputDir,
      });

      const goldenScripts = readdirSync(goldenScriptsDir).sort();
      const expected = goldenScripts.filter(isCompiledSkillScript).sort();
      expect(result.scripts.sort()).toEqual(expected);
    });
  });

  describe('dag init integration', () => {
    it('installs compiled skill at .cursor/skills/dag-flow/', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-init-'));
      const skillDir = initCursor(target);

      expect(existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(skillDir, 'references/tasks.md'))).toBe(true);
      expect(existsSync(path.join(skillDir, 'scripts/dag_runner.py'))).toBe(true);
    });

    it('writes dag-config.json with cursor orchestrator and worker metadata', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-config-'));
      const skillDir = initCursor(target);
      const config = JSON.parse(readFileSync(path.join(skillDir, 'dag-config.json'), 'utf8'));

      expect(config._meta.orchestrator).toBe('cursor');
      expect(config._meta.worker).toBe('cursor');
      expect(config._meta.schema_version).toBe(1);
      expect(config.worker.command_template).toEqual([
        'cursor',
        'agent',
        ...CURSOR_WORKER_FLAGS,
        '-p',
        '<<<PROMPT>>>',
      ]);
    });

    it('wires preToolUse guard without removing third-party hooks', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-hooks-'));
      initCursor(target, { copyHooks: true });

      const config = JSON.parse(
        readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'),
      ) as {
        hooks: { preToolUse: Array<{ id?: string; command: string }> };
      };

      expect(
        config.hooks.preToolUse.some((e) => e.command.includes('tool-routing')),
      ).toBe(true);
      expect(
        config.hooks.preToolUse.filter(
          (e) => e.id === 'dag-flow-guard' || e.command.includes('dag-flow-guard'),
        ),
      ).toHaveLength(1);
    });

    it('does not create GEMINI.md boot file (pre_tool_use tier, not boot_file)', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-boot-'));
      initCursor(target);
      expect(existsSync(path.join(target, 'GEMINI.md'))).toBe(false);
    });

    it('idempotent double init with --force recompiles without duplicate guard entries', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-idem-'));
      initCursor(target, { copyHooks: true });

      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      runInit(
        [
          '--orchestrator=cursor',
          `--target=${target}`,
          '--project-scaffold=false',
          '--force',
        ],
        { pathEnv: binDir },
      );

      const config = JSON.parse(
        readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'),
      ) as {
        hooks: { preToolUse: Array<{ id?: string; command: string }> };
      };
      expect(
        config.hooks.preToolUse.filter(
          (e) => e.id === 'dag-flow-guard' || e.command.includes('dag-flow-guard'),
        ),
      ).toHaveLength(1);
    });

    it('gate templates use CLI_PROMPT_FLAG (-p for cursor, not agy --prompt)', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-prompt-flag-'));
      const skillDir = initCursor(target);
      const tasks = readFileSync(path.join(skillDir, 'references/tasks.md'), 'utf8');
      const config = JSON.parse(readFileSync(path.join(skillDir, 'dag-config.json'), 'utf8'));

      expect(tasks).toContain(
        'cursor agent --print --output-format text --trust --force --approve-mcps -p \\"Call ctx_index for src/schema.ts.\\"',
      );
      expect(tasks).not.toContain('--prompt');
      expect(config.worker.command_template).toContain('-p');
    });

    it('dual-manifest init uses cursor orchestrator tools and antigravity worker CLI', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-dual-'));
      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      runInit(
        [
          '--orchestrator=cursor',
          '--worker=antigravity',
          `--target=${target}`,
          '--project-scaffold=false',
        ],
        { pathEnv: binDir },
      );

      const skillDir = path.join(target, '.cursor/skills/dag-flow');
      const config = JSON.parse(readFileSync(path.join(skillDir, 'dag-config.json'), 'utf8'));
      const tasks = readFileSync(path.join(skillDir, 'references/tasks.md'), 'utf8');

      expect(config._meta.orchestrator).toBe('cursor');
      expect(config._meta.worker).toBe('antigravity');
      expect(config.worker.command_template[0]).toBe('agy');
      expect(tasks).toContain('`Shell`');
      expect(tasks).toContain('`Task`');
      expect(tasks).toContain('agy --dangerously-skip-permissions');
      expect(tasks).not.toContain('cursor agent');
      expect(existsSync(path.join(skillDir, 'references/planner-template.md'))).toBe(true);
    });

    it('dag update recompiles cursor skill in .cursor/skills/dag-flow/', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-cursor-update-'));
      const skillDir = initCursor(target);
      const marker = '<!-- CURSOR_UPDATE_MARKER -->';
      writeFileSync(path.join(skillDir, 'SKILL.md'), marker, 'utf8');

      const binDir = makeFakeBinDir(['context-mode', 'rtk']);
      runUpdate([`--target=${target}`], { pathEnv: binDir });

      const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
      expect(skill).not.toContain(marker);
      expect(skill).toContain('`Shell`');
      expect(readFileSync(path.join(skillDir, 'dag-config.json'), 'utf8')).toContain('"worker": "cursor"');
    });
  });
});
