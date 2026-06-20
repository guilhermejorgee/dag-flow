import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { checkPrerequisites, PrerequisitesError } from '../src/prerequisites.js';

function makeFakeBinDir(names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dag-prereq-'));
  for (const name of names) {
    const file = path.join(dir, name);
    writeFileSync(file, '#!/bin/sh\n', 'utf8');
    chmodSync(file, 0o755);
  }
  return dir;
}

describe('prerequisites', () => {
  it('passes when context-mode and rtk are on PATH', () => {
    const binDir = makeFakeBinDir(['context-mode', 'rtk']);
    expect(() => checkPrerequisites({ pathEnv: binDir })).not.toThrow();
  });

  it('aborts with clear message when a prerequisite is missing', () => {
    const binDir = makeFakeBinDir(['context-mode']);
    expect(() => checkPrerequisites({ pathEnv: binDir })).toThrow(PrerequisitesError);
    expect(() => checkPrerequisites({ pathEnv: binDir })).toThrow(/context-mode and rtk/);
  });
});
