import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import { runInit } from '../src/commands/init.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = path.join(TEST_DIR, '..');
const REPO_ROOT = path.join(CLI_ROOT, '..');
const ANTIGRAVITY_GOLDEN_DIR = path.join(CLI_ROOT, 'test/fixtures/antigravity-parity-golden');
const CURSOR_GOLDEN_DIR = path.join(CLI_ROOT, 'test/fixtures/cursor-parity-golden');
const SOURCE_SKILL = path.join(REPO_ROOT, 'SKILL.md');
const SOURCE_REFS = path.join(REPO_ROOT, 'references');

const DISCOVERY_PROTOCOL_MARKERS = [
  '**Protocol:**',
  'ctx_search',
  'do NOT auto-trigger during Specify',
] as const;

const PRIMARY_DOC_PATHS = [
  'README.md',
  'docs/getting-started.md',
  'docs/examples.md',
  'docs/architecture/architecture.md',
] as const;

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-s10-bin-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

function listMarkdownBasenames(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort();
}

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

function extractReferenceLinks(markdown: string): string[] {
  const matches = markdown.matchAll(/references\/([a-z0-9_-]+\.md)/gi);
  return [...new Set([...matches].map((m) => m[1]!))].sort();
}

function compileRuntime(target: string, orchestrator: 'antigravity' | 'cursor'): string {
  const binDir = makeFakeBinDir(['context-mode', 'rtk']);
  const skillPath =
    orchestrator === 'cursor'
      ? '.cursor/skills/dag-flow'
      : '.agents/skills/dag-flow';

  runInit(
    [
      `--orchestrator=${orchestrator}`,
      `--target=${target}`,
      '--project-scaffold=false',
    ],
    { pathEnv: binDir },
  );
  return path.join(target, skillPath);
}

describe('session 10 cleanup (D9 discovery inline + D10 setup_indexer removal)', () => {
  describe('source skill artifacts', () => {
    it('removes references/discovery.md from the repo', () => {
      expect(existsSync(path.join(REPO_ROOT, 'references/discovery.md'))).toBe(false);
    });

    it('removes hooks/setup_indexer.sh from the repo', () => {
      expect(existsSync(path.join(REPO_ROOT, 'hooks/setup_indexer.sh'))).toBe(false);
    });

    it('inlines discovery protocol in SKILL.md without discovery.md links', () => {
      const skill = readFileSync(SOURCE_SKILL, 'utf8');
      const discoverySection = skill.slice(
        skill.indexOf('### Discovery (Project Mapping)'),
        skill.indexOf('### Emergency / Quick Mode'),
      );

      for (const marker of DISCOVERY_PROTOCOL_MARKERS) {
        expect(discoverySection).toContain(marker);
      }
      expect(skill).not.toMatch(/discovery\.md/i);
      expect(skill).not.toMatch(/setup_indexer/i);
    });

    it('keeps every references/*.md link in SKILL.md resolvable on disk', () => {
      const skill = readFileSync(SOURCE_SKILL, 'utf8');
      const links = extractReferenceLinks(skill);

      expect(links.length).toBeGreaterThan(0);
      for (const ref of links) {
        expect(existsSync(path.join(SOURCE_REFS, ref))).toBe(true);
      }
      expect(links).not.toContain('discovery.md');
    });

    it('matches golden references set (no discovery.md)', () => {
      const sourceRefs = listMarkdownBasenames(SOURCE_REFS);
      const antigravityGoldenRefs = listMarkdownBasenames(
        path.join(ANTIGRAVITY_GOLDEN_DIR, 'references'),
      );
      const cursorGoldenRefs = listMarkdownBasenames(path.join(CURSOR_GOLDEN_DIR, 'references'));

      expect(sourceRefs).toEqual(antigravityGoldenRefs);
      expect(sourceRefs).toEqual(cursorGoldenRefs);
      expect(sourceRefs).not.toContain('discovery.md');
    });
  });

  describe('compiled skill output', () => {
    it('antigravity compile omits discovery.md and preserves inline protocol', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-s10-agy-'));
      const skillDir = compileRuntime(target, 'antigravity');
      const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');

      expect(existsSync(path.join(skillDir, 'references/discovery.md'))).toBe(false);
      expect(skill).not.toMatch(/discovery\.md/i);
      expect(skill).toContain('ctx_search');
      expect(skill).toContain('do NOT auto-trigger during Specify');
    });

    it('cursor compile omits discovery.md and preserves inline protocol', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-s10-cursor-'));
      const skillDir = compileRuntime(target, 'cursor');
      const skill = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');

      expect(existsSync(path.join(skillDir, 'references/discovery.md'))).toBe(false);
      expect(skill).not.toMatch(/discovery\.md/i);
      expect(skill).toContain('ctx_search');
    });

    it('compiled markdown tree has zero discovery.md or setup_indexer references', () => {
      const target = mkdtempSync(path.join(tmpdir(), 'dag-s10-scan-'));
      const skillDir = compileRuntime(target, 'antigravity');

      for (const file of collectMarkdownFiles(skillDir)) {
        const content = readFileSync(file, 'utf8');
        expect(content).not.toMatch(/discovery\.md/i);
        expect(content).not.toMatch(/setup_indexer/i);
      }
    });
  });

  describe('user-facing docs', () => {
    it('does not instruct setup_indexer as a primary install step', () => {
      for (const rel of PRIMARY_DOC_PATHS) {
        const content = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
        const primaryInstall =
          /run\s+[`./]*hooks\/setup_indexer\.sh/i.test(content) ||
          /^\s*\d+\.\s+.*setup_indexer/i.test(content);
        expect({ file: rel, primaryInstall }).toEqual({ file: rel, primaryInstall: false });
      }
    });

    it('documents setup_indexer removal only as migration note in README and getting-started', () => {
      for (const rel of ['README.md', 'docs/getting-started.md'] as const) {
        const content = readFileSync(path.join(REPO_ROOT, rel), 'utf8');
        expect(content).toMatch(/Removed:.*setup_indexer/i);
        expect(content).toMatch(/dag init/i);
        expect(content).toMatch(/context-mode/i);
      }
    });
  });
});
