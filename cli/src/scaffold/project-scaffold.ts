import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SPECS_DIRS: Array<{ name: string; mode: number }> = [
  { name: 'staging', mode: 0o755 },
  { name: 'features', mode: 0o555 },
  { name: 'dags', mode: 0o555 },
];

function ensureDirWithMode(dirPath: string, mode: number): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true, mode });
    return;
  }
  chmodSync(dirPath, mode);
}

/**
 * D5b — bootstrap `.specs/{staging,features,dags}` with correct chmod.
 * Idempotent: preserves content; fixes chmod drift.
 */
export function ensureProjectScaffold(target: string): void {
  const specsRoot = path.join(target, '.specs');
  mkdirSync(specsRoot, { recursive: true });

  for (const { name, mode } of SPECS_DIRS) {
    ensureDirWithMode(path.join(specsRoot, name), mode);
  }
}
