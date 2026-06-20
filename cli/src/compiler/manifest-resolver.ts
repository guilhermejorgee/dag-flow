import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ManifestLocation, ResolvedManifest, RuntimeManifest } from './manifest-types.js';

const BUILTIN_MANIFESTS_DIR = 'manifests';

export class ManifestResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestResolverError';
  }
}

/** Package root (`cli/`) — walks up until `manifests/` is found. */
export function getPackageRoot(fromUrl: string = import.meta.url): string {
  let dir = path.dirname(fileURLToPath(fromUrl));
  while (true) {
    if (existsSync(path.join(dir, BUILTIN_MANIFESTS_DIR))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  const fallback = path.dirname(fileURLToPath(fromUrl));
  const base = path.basename(fallback);
  if (base === 'dist' || base === 'src') {
    return path.dirname(fallback);
  }
  return fallback;
}

export function isExternalManifestRef(ref: string): boolean {
  return ref.startsWith('/') || ref.startsWith('.');
}

export function locateManifest(
  manifestRef: string,
  packageRoot: string,
): ManifestLocation {
  if (isExternalManifestRef(manifestRef)) {
    const resolved = path.resolve(manifestRef);
    const manifestDir = resolved.endsWith('.json')
      ? path.dirname(resolved)
      : resolved;
    const manifestPath = resolved.endsWith('.json')
      ? resolved
      : path.join(manifestDir, 'manifest.json');
    return { manifestDir, manifestPath };
  }

  const manifestDir = path.join(packageRoot, BUILTIN_MANIFESTS_DIR, manifestRef);
  const manifestPath = path.join(manifestDir, 'manifest.json');
  return { manifestDir, manifestPath };
}

function loadManifestFile(manifestPath: string): RuntimeManifest {
  if (!existsSync(manifestPath)) {
    throw new ManifestResolverError(`Manifest not found: ${manifestPath}`);
  }
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8')) as RuntimeManifest;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ManifestResolverError(`Invalid manifest JSON at ${manifestPath}: ${message}`);
  }
}

function deepMergeRecords(
  parent: Record<string, string> | undefined,
  child: Record<string, string> | undefined,
): Record<string, string> {
  return { ...parent, ...child };
}

/** Deep-merge parent ← child; child fields win. */
export function mergeManifests(
  parent: RuntimeManifest,
  child: RuntimeManifest,
): RuntimeManifest {
  return {
    schema_version: child.schema_version ?? parent.schema_version,
    runtime_id: child.runtime_id ?? parent.runtime_id,
    extends: child.extends,
    orchestrator: {
      ...parent.orchestrator,
      ...child.orchestrator,
      partials: deepMergeRecords(parent.orchestrator.partials, child.orchestrator.partials),
      placeholders: deepMergeRecords(
        parent.orchestrator.placeholders,
        child.orchestrator.placeholders,
      ),
    },
    worker: {
      ...parent.worker,
      ...child.worker,
      placeholders: deepMergeRecords(parent.worker.placeholders, child.worker.placeholders),
    },
  };
}

/**
 * Resolve a built-in id or external manifest path, applying `extends` deep-merge.
 * Returns merged manifest and child-first dirs for partial file lookup.
 */
export function resolveManifest(
  manifestRef: string,
  options?: { packageRoot?: string },
  visited: Set<string> = new Set(),
): ResolvedManifest {
  const packageRoot = options?.packageRoot ?? getPackageRoot();
  const location = locateManifest(manifestRef, packageRoot);

  if (visited.has(location.manifestDir)) {
    throw new ManifestResolverError(
      `Circular extends chain detected at ${manifestRef} (${location.manifestDir})`,
    );
  }
  visited.add(location.manifestDir);

  const manifest = loadManifestFile(location.manifestPath);
  const manifestDirs = [location.manifestDir];

  if (!manifest.extends) {
    return { manifest, manifestDirs };
  }

  const parent = resolveManifest(manifest.extends, { packageRoot }, visited);
  return {
    manifest: mergeManifests(parent.manifest, manifest),
    manifestDirs: [...manifestDirs, ...parent.manifestDirs],
  };
}

export const BUILT_IN_RUNTIMES = ['antigravity', 'cursor'] as const;
