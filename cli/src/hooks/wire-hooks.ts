import type { ResolvedManifest } from '../compiler/manifest-types.js';
import { bootFileAppend } from './boot-file-append.js';
import { hookConfigUpsert } from './hook-config-upsert.js';

export interface WireHooksOptions {
  target: string;
  orchestrator: ResolvedManifest;
  packageRoot: string;
}

/**
 * D11/D12 — wire hooks per orchestrator manifest tier (no runtime-name branches).
 */
export function wireHooks(options: WireHooksOptions): void {
  const { target, orchestrator, packageRoot } = options;
  const orch = orchestrator.manifest.orchestrator;
  const tier = orch.hook_wiring_tier;

  switch (tier) {
    case 'pre_tool_use':
      hookConfigUpsert({ target, orchestrator: orch, packageRoot });
      return;
    case 'boot_file':
      bootFileAppend({ target, orchestrator: orch });
      return;
    case 'none':
      console.warn(
        `dag init: hook_wiring_tier "none" for ${orchestrator.manifest.runtime_id} — skipping hook wiring`,
      );
      return;
    default: {
      const exhaustive: never = tier;
      throw new Error(`Unknown hook_wiring_tier: ${exhaustive}`);
    }
  }
}
