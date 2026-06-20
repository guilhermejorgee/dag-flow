import { accessSync, constants } from 'node:fs';
import path from 'node:path';

export class PrerequisitesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrerequisitesError';
  }
}

function isExecutableOnPath(command: string, pathEnv: string): boolean {
  const dirs = pathEnv.split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, command);
    try {
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      // try next PATH entry
    }
  }
  return false;
}

export interface PrerequisitesOptions {
  pathEnv?: string;
}

/**
 * D4 — abort if context-mode or rtk are missing from PATH.
 */
export function checkPrerequisites(options: PrerequisitesOptions = {}): void {
  const pathEnv = options.pathEnv ?? process.env.PATH ?? '';
  const missing: string[] = [];

  if (!isExecutableOnPath('context-mode', pathEnv)) {
    missing.push('context-mode');
  }
  if (!isExecutableOnPath('rtk', pathEnv)) {
    missing.push('rtk');
  }

  if (missing.length > 0) {
    throw new PrerequisitesError(
      `dag init requires ${missing.join(' and ')} on PATH (Core Infrastructure). ` +
        'Install context-mode and rtk before running dag init.',
    );
  }
}
