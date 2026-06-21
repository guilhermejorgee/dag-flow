import { existsSync } from 'node:fs';
import path from 'node:path';
import { getPackageRoot, resolveManifest } from '../compiler/manifest-resolver.js';
import { compileRuntimeSkill } from '../compiler/runtime-compiler.js';
import { wireHooks } from '../hooks/wire-hooks.js';
import { checkPrerequisites } from '../prerequisites.js';
import { ensureProjectScaffold } from '../scaffold/project-scaffold.js';
import { DAG_FLOW_VERSION } from '../constants.js';
import { mkdirSync, writeFileSync } from 'node:fs';

export interface InitOptions {
  orchestrator: string;
  worker: string;
  target: string;
  projectScaffold: boolean;
  skillInstallPath?: string;
  force: boolean;
  pathEnv?: string;
}

export class InitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitError';
  }
}

export function parseInitArgs(args: string[]): InitOptions {
  let orchestrator = 'antigravity';
  let worker: string | undefined;
  let target = process.cwd();
  let projectScaffold = true;
  let skillInstallPath: string | undefined;
  let force = false;

  for (const arg of args) {
    if (arg.startsWith('--orchestrator=')) {
      orchestrator = arg.slice('--orchestrator='.length);
    } else if (arg.startsWith('--worker=')) {
      worker = arg.slice('--worker='.length);
    } else if (arg.startsWith('--target=')) {
      target = path.resolve(arg.slice('--target='.length));
    } else if (arg.startsWith('--skill-install-path=')) {
      skillInstallPath = arg.slice('--skill-install-path='.length);
    } else if (arg === '--project-scaffold=false') {
      projectScaffold = false;
    } else if (arg === '--project-scaffold=true') {
      projectScaffold = true;
    } else if (arg === '--force') {
      force = true;
    }
  }

  return {
    orchestrator,
    worker: worker ?? orchestrator,
    target,
    projectScaffold,
    skillInstallPath,
    force,
  };
}

function writeDagConfig(
  outputDir: string,
  orchestratorRef: string,
  workerRef: string,
  workerManifest: ReturnType<typeof resolveManifest>,
): void {
  const config = {
    _meta: {
      orchestrator: orchestratorRef,
      worker: workerRef,
      dag_flow_version: DAG_FLOW_VERSION,
      schema_version: 1,
    },
    worker: {
      command_template: workerManifest.manifest.worker.command_template,
    },
  };
  writeFileSync(path.join(outputDir, 'dag-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function assertCompiledSkillAbsent(outputDir: string, force: boolean): void {
  if (!existsSync(outputDir)) {
    return;
  }

  if (!force) {
    throw new InitError(
      `Compiled Skill already exists at ${outputDir}. ` +
        'Use `dag update` to upgrade, or `dag init --force` to overwrite (loses local edits).',
    );
  }

  console.warn(`⚠️  Overwriting existing Compiled Skill at ${outputDir}`);
}

export function runInit(args: string[], env: { pathEnv?: string } = {}): void {
  const options = parseInitArgs(args);
  const pathEnv = env.pathEnv ?? options.pathEnv;

  checkPrerequisites({ pathEnv });

  const packageRoot = getPackageRoot();
  const repoRoot = path.dirname(packageRoot);

  const orchestratorManifest = resolveManifest(options.orchestrator, { packageRoot });
  const installPath =
    options.skillInstallPath ?? orchestratorManifest.manifest.orchestrator.skill_install_path;
  const outputDir = path.join(options.target, installPath, 'dag-flow');

  assertCompiledSkillAbsent(outputDir, options.force);

  const workerManifest =
    options.worker === options.orchestrator
      ? orchestratorManifest
      : resolveManifest(options.worker, { packageRoot });
  mkdirSync(outputDir, { recursive: true });

  compileRuntimeSkill({
    sourceSkillRoot: repoRoot,
    orchestrator: orchestratorManifest,
    worker: workerManifest,
    outputDir,
  });

  if (options.projectScaffold) {
    ensureProjectScaffold(options.target);
  }

  wireHooks({
    target: options.target,
    orchestrator: orchestratorManifest,
    packageRoot,
  });

  writeDagConfig(outputDir, options.orchestrator, options.worker, workerManifest);
}
