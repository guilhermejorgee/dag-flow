import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const VAULT_DIR = path.join('.specs', 'dags');

export class PendingDagGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PendingDagGuardError';
  }
}

export interface PendingDagViolation {
  file: string;
  taskId: string;
  status: string;
}

export interface PendingDagGuardResult {
  ok: boolean;
  violations: PendingDagViolation[];
}

interface VaultTask {
  id?: string;
  status?: string;
}

function isTaskDone(status: string | undefined): boolean {
  const normalized = status ?? 'Pending';
  return normalized.includes('Done');
}

function collectViolationsFromFile(vaultFile: string): PendingDagViolation[] {
  let tasks: VaultTask[];
  try {
    tasks = JSON.parse(readFileSync(vaultFile, 'utf8')) as VaultTask[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PendingDagGuardError(`Invalid vault DAG JSON at ${vaultFile}: ${message}`);
  }

  if (!Array.isArray(tasks)) {
    throw new PendingDagGuardError(`Vault DAG must be a JSON array: ${vaultFile}`);
  }

  const violations: PendingDagViolation[] = [];
  for (const task of tasks) {
    const status = task.status ?? 'Pending';
    if (!isTaskDone(task.status)) {
      violations.push({
        file: vaultFile,
        taskId: task.id ?? '(missing id)',
        status,
      });
    }
  }
  return violations;
}

/**
 * Scan `.specs/dags/*.json` (vault). Blocks when any task is not Done —
 * including Pending, Failed, or absent status (ADR-0012 / TDD D2).
 */
export function scanVaultDags(target: string): PendingDagGuardResult {
  const vaultDir = path.join(target, VAULT_DIR);
  if (!existsSync(vaultDir)) {
    return { ok: true, violations: [] };
  }

  const violations: PendingDagViolation[] = [];
  for (const entry of readdirSync(vaultDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const vaultFile = path.join(vaultDir, entry.name);
    violations.push(...collectViolationsFromFile(vaultFile));
  }

  return { ok: violations.length === 0, violations };
}

export function assertNoPendingDags(target: string): void {
  const result = scanVaultDags(target);
  if (result.ok) {
    return;
  }

  const lines = result.violations.map(
    (v) => `  ${path.basename(v.file)} → ${v.taskId} (${v.status})`,
  );
  throw new PendingDagGuardError(
    'dag update aborted: vault DAG has incomplete tasks (all must be Done).\n' +
      `${lines.join('\n')}\n` +
      'Resolve via Escalation Phase or remove the vault DAG before updating.',
  );
}
