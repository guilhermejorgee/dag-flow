import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { BOOT_FILE_MARKER, bootFileAppend } from '../src/hooks/boot-file-append.js';
import type { OrchestratorConfig } from '../src/compiler/manifest-types.js';

const ANTIGRAVITY_ORCHESTRATOR: OrchestratorConfig = {
  hook_wiring_tier: 'boot_file',
  hook_config_path: null,
  hook_event: null,
  hook_entry_id: null,
  boot_file: 'GEMINI.md',
  skill_install_path: '.agents/skills',
  placeholders: {},
};

describe('boot-file-append', () => {
  it('creates boot file with marker when missing', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-boot-'));
    bootFileAppend({ target, orchestrator: ANTIGRAVITY_ORCHESTRATOR });

    const content = readFileSync(path.join(target, 'GEMINI.md'), 'utf8');
    expect(content).toContain(BOOT_FILE_MARKER);
    expect(content).toContain('cognitive guard rule');
  });

  it('appends marker block without duplicating on re-run', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-boot-'));
    writeFileSync(path.join(target, 'GEMINI.md'), '# existing\n', 'utf8');

    bootFileAppend({ target, orchestrator: ANTIGRAVITY_ORCHESTRATOR });
    bootFileAppend({ target, orchestrator: ANTIGRAVITY_ORCHESTRATOR });

    const content = readFileSync(path.join(target, 'GEMINI.md'), 'utf8');
    expect(content.match(new RegExp(BOOT_FILE_MARKER, 'g'))).toHaveLength(1);
    expect(content.startsWith('# existing')).toBe(true);
  });
});
