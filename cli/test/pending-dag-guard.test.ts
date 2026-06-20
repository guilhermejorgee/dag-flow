import { mkdirSync, mkdtempSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import {
  assertNoPendingDags,
  PendingDagGuardError,
  scanVaultDags,
} from '../src/guards/pending-dag-guard.js';

function writeVaultDag(target: string, filename: string, tasks: unknown[]): void {
  const vaultDir = path.join(target, '.specs', 'dags');
  mkdirSync(vaultDir, { recursive: true });
  writeFileSync(path.join(vaultDir, filename), `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
}

describe('pending-dag-guard', () => {
  it('passes when vault directory is missing', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    expect(scanVaultDags(target)).toEqual({ ok: true, violations: [] });
    expect(() => assertNoPendingDags(target)).not.toThrow();
  });

  it('passes when all tasks are Done', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    writeVaultDag(target, 'feature-a.json', [
      { id: 'T1', status: 'Done' },
      { id: 'T2', status: 'Done' },
    ]);
    expect(scanVaultDags(target).ok).toBe(true);
    expect(() => assertNoPendingDags(target)).not.toThrow();
  });

  it('blocks Pending tasks', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    writeVaultDag(target, 'feature-a.json', [{ id: 'T1', status: 'Pending' }]);
    const result = scanVaultDags(target);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([
      expect.objectContaining({ taskId: 'T1', status: 'Pending' }),
    ]);
    expect(() => assertNoPendingDags(target)).toThrow(PendingDagGuardError);
  });

  it('blocks Failed tasks (ADR-0012)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    writeVaultDag(target, 'feature-a.json', [{ id: 'T3', status: 'Failed' }]);
    expect(scanVaultDags(target).ok).toBe(false);
    expect(() => assertNoPendingDags(target)).toThrow(/incomplete tasks/);
  });

  it('blocks absent status (defaults Pending)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    writeVaultDag(target, 'feature-a.json', [{ id: 'T1' }]);
    const result = scanVaultDags(target);
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.status).toBe('Pending');
  });

  it('scans every vault JSON file', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    writeVaultDag(target, 'done.json', [{ id: 'T1', status: 'Done' }]);
    writeVaultDag(target, 'blocked.json', [{ id: 'T2', status: 'Failed' }]);
    const result = scanVaultDags(target);
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.taskId).toBe('T2');
  });

  it('passes empty vault directory', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    mkdirSync(path.join(target, '.specs', 'dags'), { recursive: true });
    expect(scanVaultDags(target).ok).toBe(true);
  });

  it('ignores non-json files in vault', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    const vaultDir = path.join(target, '.specs', 'dags');
    mkdirSync(vaultDir, { recursive: true });
    writeFileSync(path.join(vaultDir, 'notes.txt'), 'not a dag', 'utf8');
    writeVaultDag(target, 'ok.json', [{ id: 'T1', status: 'Done' }]);
    expect(scanVaultDags(target).ok).toBe(true);
  });

  it('treats status containing Done as complete (dag_runner parity)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    writeVaultDag(target, 'feature.json', [{ id: 'T1', status: 'Done (verified)' }]);
    expect(scanVaultDags(target).ok).toBe(true);
  });

  it('throws on invalid vault JSON', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    const vaultDir = path.join(target, '.specs', 'dags');
    mkdirSync(vaultDir, { recursive: true });
    writeFileSync(path.join(vaultDir, 'broken.json'), '{not json', 'utf8');
    expect(() => scanVaultDags(target)).toThrow(PendingDagGuardError);
  });

  it('throws when vault file is not a JSON array', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    const vaultDir = path.join(target, '.specs', 'dags');
    mkdirSync(vaultDir, { recursive: true });
    writeFileSync(path.join(vaultDir, 'object.json'), '{"id":"T1"}', 'utf8');
    expect(() => scanVaultDags(target)).toThrow(/must be a JSON array/);
  });

  it('reads vault JSON even when file is read-only (chmod 444)', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-'));
    writeVaultDag(target, 'locked.json', [{ id: 'T1', status: 'Pending' }]);
    const vaultFile = path.join(target, '.specs', 'dags', 'locked.json');
    chmodSync(vaultFile, 0o444);
    expect(scanVaultDags(target).ok).toBe(false);
  });
});
