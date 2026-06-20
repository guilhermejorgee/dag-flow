import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DAG_FLOW_VERSION } from '../constants.js';
import { getPackageRoot, resolveManifest } from '../compiler/manifest-resolver.js';
import { compileRuntimeSkill } from '../compiler/runtime-compiler.js';
import { assertNoPendingDags, PendingDagGuardError } from '../guards/pending-dag-guard.js';
import { wireHooks } from '../hooks/wire-hooks.js';

export class UpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpdateError';
  }
}

export interface UpdateOptions {
  target: string;
  skillInstallPath?: string;
}

interface DagConfigMeta {
  orchestrator: string;
  worker: string;
  dag_flow_version?: string;
  schema_version?: number;
}

interface DagConfig {
  _meta: DagConfigMeta;
  worker: {
    command_template: string[];
    [key: string]: unknown;
  };
}

const DEFAULT_SKILL_CANDIDATES = ['.agents/skills', '.cursor/skills'];

export function parseUpdateArgs(args: string[]): UpdateOptions {
  let target = process.cwd();
  let skillInstallPath: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--target=')) {
      target = path.resolve(arg.slice('--target='.length));
    } else if (arg.startsWith('--skill-install-path=')) {
      skillInstallPath = arg.slice('--skill-install-path='.length);
    }
  }

  return { target, skillInstallPath };
}

function readDagConfig(configPath: string): DagConfig {
  if (!existsSync(configPath)) {
    throw new UpdateError(`dag-config.json not found at ${configPath}`);
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as DagConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new UpdateError(`Invalid dag-config.json at ${configPath}: ${message}`);
  }
}

function locateInstalledSkill(
  target: string,
  skillInstallPath?: string,
): { outputDir: string; config: DagConfig } {
  const candidates = skillInstallPath
    ? [path.join(target, skillInstallPath, 'dag-flow')]
    : DEFAULT_SKILL_CANDIDATES.map((dir) => path.join(target, dir, 'dag-flow'));

  for (const outputDir of candidates) {
    const configPath = path.join(outputDir, 'dag-config.json');
    if (existsSync(configPath)) {
      return { outputDir, config: readDagConfig(configPath) };
    }
  }

  throw new UpdateError(
    'Compiled Skill not found. Run `dag init` first, or pass --skill-install-path=.',
  );
}

function writeDagConfig(
  outputDir: string,
  existing: DagConfig,
): void {
  const config = {
    _meta: {
      ...existing._meta,
      dag_flow_version: DAG_FLOW_VERSION,
      schema_version: existing._meta.schema_version ?? 1,
    },
    worker: existing.worker,
  };
  writeFileSync(path.join(outputDir, 'dag-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

/**
 * §5.6 — guard → recompile → preserve worker → re-wire hooks.
 */
export function runUpdate(args: string[]): void {
  const options = parseUpdateArgs(args);
  assertNoPendingDags(options.target);

  const packageRoot = getPackageRoot();
  const repoRoot = path.dirname(packageRoot);
  const { outputDir, config } = locateInstalledSkill(options.target, options.skillInstallPath);

  if (!config._meta?.orchestrator || !config._meta?.worker) {
    throw new UpdateError('dag-config.json _meta missing orchestrator or worker runtime id');
  }
  if (!config.worker?.command_template) {
    throw new UpdateError('dag-config.json worker.command_template missing — cannot preserve worker');
  }

  const orchestratorManifest = resolveManifest(config._meta.orchestrator, { packageRoot });
  const workerManifest =
    config._meta.worker === config._meta.orchestrator
      ? orchestratorManifest
      : resolveManifest(config._meta.worker, { packageRoot });

  compileRuntimeSkill({
    sourceSkillRoot: repoRoot,
    orchestrator: orchestratorManifest,
    worker: workerManifest,
    outputDir,
  });

  writeDagConfig(outputDir, config);

  wireHooks({
    target: options.target,
    orchestrator: orchestratorManifest,
    packageRoot,
  });
}

export { PendingDagGuardError };
