import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BUILT_IN_RUNTIMES,
  getPackageRoot,
  resolveManifest,
} from '../../compiler/manifest-resolver.js';
import type { RuntimeManifest } from '../../compiler/manifest-types.js';

export class ManifestScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestScaffoldError';
  }
}

export interface ScaffoldOptions {
  extendsId: string;
  output: string;
}

function formatRuntimeName(runtimeId: string): string {
  return runtimeId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function parseScaffoldArgs(args: string[]): ScaffoldOptions {
  const extendsFlag = args.find((a) => a.startsWith('--extends='));
  if (!extendsFlag) {
    throw new ManifestScaffoldError(
      `Error: --extends is required. Built-in runtimes: ${BUILT_IN_RUNTIMES.join(', ')}`,
    );
  }

  const outputFlag = args.find((a) => a.startsWith('--output='));
  if (!outputFlag) {
    throw new ManifestScaffoldError('Error: --output is required.');
  }

  return {
    extendsId: extendsFlag.slice('--extends='.length),
    output: path.resolve(outputFlag.slice('--output='.length)),
  };
}

function assertBuiltInRuntime(extendsId: string): void {
  if (!(BUILT_IN_RUNTIMES as readonly string[]).includes(extendsId)) {
    throw new ManifestScaffoldError(
      `Error: Unknown built-in runtime "${extendsId}". Built-in runtimes: ${BUILT_IN_RUNTIMES.join(', ')}`,
    );
  }
}

function buildScaffoldManifest(
  parent: RuntimeManifest,
  extendsId: string,
  runtimeId: string,
): RuntimeManifest {
  const runtimeName = formatRuntimeName(runtimeId);

  return {
    schema_version: parent.schema_version,
    runtime_id: runtimeId,
    extends: extendsId,
    orchestrator: {
      ...parent.orchestrator,
      partials: parent.orchestrator.partials
        ? { ...parent.orchestrator.partials }
        : undefined,
      placeholders: {
        ...parent.orchestrator.placeholders,
        RUNTIME_NAME: runtimeName,
      },
    },
    worker: {
      ...parent.worker,
      worker_validation_status: 'pending',
    },
  };
}

function copyParentPartials(parentManifestDir: string, outputDir: string, manifest: RuntimeManifest): void {
  const partialNames = new Set(Object.values(manifest.orchestrator.partials ?? {}));
  if (partialNames.size === 0) {
    return;
  }

  const partialsDir = path.join(outputDir, 'partials');
  mkdirSync(partialsDir, { recursive: true });

  const parentPartialsDir = path.join(parentManifestDir, 'partials');
  for (const partialName of partialNames) {
    const source = path.join(parentPartialsDir, partialName);
    const target = path.join(partialsDir, partialName);
    if (!existsSync(source)) {
      throw new ManifestScaffoldError(`Parent partial not found: ${source}`);
    }
    copyFileSync(source, target);
  }
}

export function scaffoldManifest(options: ScaffoldOptions): string {
  assertBuiltInRuntime(options.extendsId);

  const packageRoot = getPackageRoot();
  const parent = resolveManifest(options.extendsId, { packageRoot });
  const parentManifestDir = parent.manifestDirs[0];

  const runtimeId = path.basename(options.output);
  if (!runtimeId || runtimeId === '.' || runtimeId === '..' || runtimeId === '/') {
    throw new ManifestScaffoldError(
      `Error: output path must name the runtime directory (got ${options.output})`,
    );
  }

  const outputDir = options.output;
  const manifestPath = path.join(outputDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    throw new ManifestScaffoldError(`Manifest already exists at ${manifestPath}`);
  }

  mkdirSync(outputDir, { recursive: true });

  const manifest = buildScaffoldManifest(parent.manifest, options.extendsId, runtimeId);
  copyParentPartials(parentManifestDir, outputDir, manifest);

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return outputDir;
}

export function runManifestScaffold(args: string[]): void {
  try {
    const options = parseScaffoldArgs(args);
    const outputDir = scaffoldManifest(options);
    console.log(`Scaffolded runtime manifest at ${outputDir}`);
  } catch (error) {
    if (error instanceof ManifestScaffoldError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
