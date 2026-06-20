import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { ensureProjectScaffold } from '../src/scaffold/project-scaffold.js';

describe('project-scaffold', () => {
  it('creates .specs dirs with correct chmod', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-'));
    ensureProjectScaffold(target);

    expect(statSync(path.join(target, '.specs', 'staging')).mode & 0o777).toBe(0o755);
    expect(statSync(path.join(target, '.specs', 'features')).mode & 0o777).toBe(0o555);
    expect(statSync(path.join(target, '.specs', 'dags')).mode & 0o777).toBe(0o555);
  });

  it('preserves content and fixes chmod drift', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-scaffold-'));
    const featuresDir = path.join(target, '.specs', 'features', 'auth');
    mkdirSync(featuresDir, { recursive: true });
    writeFileSync(path.join(featuresDir, 'spec.md'), '# spec', 'utf8');
    chmodSync(path.join(target, '.specs', 'features'), 0o777);

    ensureProjectScaffold(target);

    expect(statSync(path.join(target, '.specs', 'features')).mode & 0o777).toBe(0o555);
    expect(readFileSync(path.join(featuresDir, 'spec.md'), 'utf8')).toBe('# spec');
  });
});
