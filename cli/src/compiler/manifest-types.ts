export type HookWiringTier = 'pre_tool_use' | 'boot_file' | 'none';

export interface OrchestratorConfig {
  hook_wiring_tier: HookWiringTier;
  hook_config_path: string | null;
  hook_event: string | null;
  hook_entry_id: string | null;
  hook_config_adapter?: string | null;
  boot_file: string | null;
  skill_install_path: string;
  partials?: Record<string, string>;
  placeholders: Record<string, string>;
}

export interface WorkerConfig {
  command_template: string[];
  worker_validation_status: 'validated' | 'pending' | 'failed';
  auditor_wrapper: string | null;
  placeholders: Record<string, string>;
}

export interface RuntimeManifest {
  schema_version: number;
  runtime_id: string;
  extends: string | null;
  orchestrator: OrchestratorConfig;
  worker: WorkerConfig;
}

export interface ResolvedManifest {
  manifest: RuntimeManifest;
  /** Child-first manifest directories for partial file lookup. */
  manifestDirs: string[];
}

export interface ManifestLocation {
  manifestDir: string;
  manifestPath: string;
}
