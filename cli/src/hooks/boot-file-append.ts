import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { OrchestratorConfig } from '../compiler/manifest-types.js';

export const BOOT_FILE_MARKER = '<!-- dag-flow-hook -->';

export const BOOT_FILE_RULE_TEXT = `# dag-flow — cognitive guard rule

Do NOT edit files under \`src/\`, \`lib/\`, \`api/\`, or \`test/\` directly during orchestration.
Use dag-flow Quick Mode or Specify, then execute changes via DAG gates and \`run_dag.sh\`.`;

export class BootFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootFileError';
  }
}

export interface BootFileAppendOptions {
  target: string;
  orchestrator: OrchestratorConfig;
}

function buildHookBlock(): string {
  return `${BOOT_FILE_MARKER}\n${BOOT_FILE_RULE_TEXT}`;
}

/**
 * Tier boot_file — idempotent append/replace at BOOT_FILE marker.
 */
export function bootFileAppend(options: BootFileAppendOptions): void {
  const { target, orchestrator } = options;
  const bootFile = orchestrator.boot_file;

  if (!bootFile) {
    throw new BootFileError('boot_file tier requires orchestrator.boot_file');
  }

  const bootPath = path.join(target, bootFile);
  const block = buildHookBlock();

  if (!existsSync(bootPath)) {
    writeFileSync(bootPath, `${block}\n`, 'utf8');
    return;
  }

  const content = readFileSync(bootPath, 'utf8');
  const markerIndex = content.indexOf(BOOT_FILE_MARKER);

  if (markerIndex === -1) {
    const separator = content.endsWith('\n') || content.length === 0 ? '' : '\n';
    writeFileSync(bootPath, `${content}${separator}${block}\n`, 'utf8');
    return;
  }

  const before = content.slice(0, markerIndex);
  writeFileSync(bootPath, `${before}${block}\n`, 'utf8');
}
