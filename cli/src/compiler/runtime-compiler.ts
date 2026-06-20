import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ResolvedManifest } from './manifest-types.js';

const PLACEHOLDER_PATTERN = /<<<DAG:([A-Z0-9_]+)>>>/g;

/** Explicit whitelist per TDD §5.9 / ADR-0015. */
export const COMPILED_SKILL_SCRIPT_ALLOWLIST = new Set([
  'dag_runner.py',
  'auditor.py',
  'run_dag.sh',
  'commit_spec.sh',
  'commit_design.sh',
  'write_dag.sh',
  'update_task_status.py',
  'validate_pagrl.py',
  'extract_json_dag.py',
  'validate_dag_coherence.py',
]);

export class CompilerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompilerError';
  }
}

export interface CompileOptions {
  sourceSkillRoot: string;
  orchestrator: ResolvedManifest;
  worker: ResolvedManifest;
  outputDir: string;
}

export function isCompiledSkillScript(filename: string): boolean {
  if (filename.startsWith('migrate_') || filename.startsWith('test_')) {
    return false;
  }
  if (COMPILED_SKILL_SCRIPT_ALLOWLIST.has(filename)) {
    return true;
  }
  if (filename.startsWith('validate_') && filename.endsWith('.py')) {
    return true;
  }
  return false;
}

function readPartialContent(
  partialFilename: string,
  manifestDirs: string[],
): string {
  for (const dir of manifestDirs) {
    const partialPath = path.join(dir, 'partials', partialFilename);
    if (existsSync(partialPath)) {
      return readFileSync(partialPath, 'utf8');
    }
  }
  throw new CompilerError(`Partial file not found: partials/${partialFilename}`);
}

/** Pass 1: inject orchestrator partials into <<<DAG:KEY>>> placeholders. */
export function applyPartialsPass(
  content: string,
  orchestrator: ResolvedManifest,
): string {
  const partials = orchestrator.manifest.orchestrator.partials ?? {};
  let result = content;

  for (const [placeholderKey, partialFilename] of Object.entries(partials)) {
    const token = `<<<DAG:${placeholderKey}>>>`;
    if (!result.includes(token)) {
      continue;
    }
    const partialContent = readPartialContent(partialFilename, orchestrator.manifestDirs).replace(
      /\n$/,
      '',
    );
    result = result.split(token).join(partialContent);
  }

  return result;
}

/** Pass 2: replace scalar placeholders from orchestrator (B/C) and worker (A). */
export function applyScalarsPass(
  content: string,
  orchestrator: ResolvedManifest,
  worker: ResolvedManifest,
): string {
  const placeholders: Record<string, string> = {
    ...worker.manifest.worker.placeholders,
    ...orchestrator.manifest.orchestrator.placeholders,
  };

  let result = content;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.split(`<<<DAG:${key}>>>`).join(value);
  }
  return result;
}

export function compileMarkdown(
  content: string,
  orchestrator: ResolvedManifest,
  worker: ResolvedManifest,
): string {
  const afterPartials = applyPartialsPass(content, orchestrator);
  const compiled = applyScalarsPass(afterPartials, orchestrator, worker);
  validateNoRemainingPlaceholders(compiled);
  return compiled;
}

export function validateNoRemainingPlaceholders(content: string, fileLabel = 'output'): void {
  const matches = [...content.matchAll(PLACEHOLDER_PATTERN)];
  if (matches.length > 0) {
    const keys = [...new Set(matches.map((m) => m[1]))].join(', ');
    throw new CompilerError(
      `Unresolved <<<DAG:>>> placeholders in ${fileLabel}: ${keys}`,
    );
  }
}

function compileMarkdownFile(
  sourcePath: string,
  destPath: string,
  orchestrator: ResolvedManifest,
  worker: ResolvedManifest,
): void {
  const source = readFileSync(sourcePath, 'utf8');
  const compiled = compileMarkdown(source, orchestrator, worker);
  mkdirSync(path.dirname(destPath), { recursive: true });
  writeFileSync(destPath, compiled, 'utf8');
}

function copyWhitelistedScripts(sourceScriptsDir: string, destScriptsDir: string): string[] {
  if (!existsSync(sourceScriptsDir)) {
    throw new CompilerError(`Source scripts directory not found: ${sourceScriptsDir}`);
  }

  mkdirSync(destScriptsDir, { recursive: true });
  const copied: string[] = [];

  for (const entry of readdirSync(sourceScriptsDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }
    if (!isCompiledSkillScript(entry.name)) {
      continue;
    }
    copyFileSync(
      path.join(sourceScriptsDir, entry.name),
      path.join(destScriptsDir, entry.name),
    );
    copied.push(entry.name);
  }

  return copied;
}

/**
 * Compile Source Skill markdown + whitelisted scripts into outputDir.
 * Does not write dag-config.json (dag init responsibility).
 */
export function compileRuntimeSkill(options: CompileOptions): {
  markdownFiles: string[];
  scripts: string[];
} {
  const { sourceSkillRoot, orchestrator, worker, outputDir } = options;
  const markdownFiles: string[] = [];

  const skillSrc = path.join(sourceSkillRoot, 'SKILL.md');
  if (!existsSync(skillSrc)) {
    throw new CompilerError(`SKILL.md not found at ${sourceSkillRoot}`);
  }
  const skillDest = path.join(outputDir, 'SKILL.md');
  compileMarkdownFile(skillSrc, skillDest, orchestrator, worker);
  markdownFiles.push('SKILL.md');

  const refsSrc = path.join(sourceSkillRoot, 'references');
  if (existsSync(refsSrc)) {
    for (const entry of readdirSync(refsSrc, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }
      const rel = path.join('references', entry.name);
      compileMarkdownFile(
        path.join(refsSrc, entry.name),
        path.join(outputDir, rel),
        orchestrator,
        worker,
      );
      markdownFiles.push(rel);
    }
  }

  const scripts = copyWhitelistedScripts(
    path.join(sourceSkillRoot, 'scripts'),
    path.join(outputDir, 'scripts'),
  );

  return { markdownFiles, scripts };
}
