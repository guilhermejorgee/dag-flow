import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from '@jest/globals';
import { extractUserPrompt, classifyRoute } from '../hooks/dag-flow-guard.mjs';
import { hookConfigUpsert } from '../src/hooks/hook-config-upsert.js';
import type { OrchestratorConfig } from '../src/compiler/manifest-types.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const GUARD_SCRIPT = path.join(TEST_DIR, '..', 'hooks', 'dag-flow-guard.mjs');

interface GuardResult {
  stdout: string;
  stderr: string;
  status: number | null;
  parsed: { permission?: string; user_message?: string; agent_message?: string };
}

function invokeGuard(
  payload: unknown,
  env: Record<string, string | undefined> = {},
): GuardResult {
  const mergedEnv = { ...process.env, ...env };
  delete mergedEnv.DAG_FLOW_WORKER;
  if ('DAG_FLOW_WORKER' in env) {
    mergedEnv.DAG_FLOW_WORKER = env.DAG_FLOW_WORKER;
  }

  const result = spawnSync(process.execPath, [GUARD_SCRIPT], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    encoding: 'utf8',
    env: mergedEnv,
  });

  const stdout = (result.stdout ?? '').trim();
  let parsed: GuardResult['parsed'] = {};
  if (stdout) {
    try {
      parsed = JSON.parse(stdout) as GuardResult['parsed'];
    } catch {
      parsed = {};
    }
  }

  return {
    stdout,
    stderr: (result.stderr ?? '').trim(),
    status: result.status,
    parsed,
  };
}

afterEach(() => {
  delete process.env.DAG_FLOW_WORKER;
});

describe('hook guard integration (subprocess)', () => {
  it('denies Write to src/ with adaptive Quick Mode message', () => {
    const res = invokeGuard({
      tool_name: 'Write',
      tool_input: { path: 'src/routes/auth.js' },
      user_message: 'Fix bug: /login returns 500',
    });

    expect(res.parsed.permission).toBe('deny');
    expect(res.parsed.user_message).toContain('src/routes/auth.js');
    expect(res.parsed.user_message).toContain('Quick Mode (hotfix)');
    expect(res.parsed.agent_message).toBe(res.parsed.user_message);
  });

  it('denies StrReplace to lib/ with Specify message for feature requests', () => {
    const res = invokeGuard({
      tool_name: 'StrReplace',
      tool_input: { path: 'lib/auth.ts' },
      prompt: 'Implement new OAuth provider',
    });

    expect(res.parsed.permission).toBe('deny');
    expect(res.parsed.user_message).toContain('Specify (feature)');
    expect(res.parsed.user_message).toContain('references/specify.md');
  });

  it.each(['Write', 'StrReplace', 'EditNotebook', 'Delete', 'ApplyPatch'])(
    'denies %s on guarded paths',
    (toolName) => {
      const toolInput =
        toolName === 'EditNotebook'
          ? { target_notebook: 'test/notebook.ipynb' }
          : { path: 'api/handler.go' };

      const res = invokeGuard({
        tool_name: toolName,
        tool_input: toolInput,
        user_message: 'Fix bug',
      });

      expect(res.parsed.permission).toBe('deny');
    },
  );

  it('allows Write to staging and docs', () => {
    for (const target of ['.specs/staging/issue/dag.json', 'docs/adr/0010.md', 'CONTEXT.md']) {
      const res = invokeGuard({
        tool_name: 'Write',
        tool_input: { path: target },
        user_message: 'draft spec',
      });
      expect(res.parsed.permission).toBe('allow');
    }
  });

  it('allows Read and Shell on guarded paths', () => {
    for (const tool of ['Read', 'Shell', 'Grep']) {
      const res = invokeGuard({
        tool_name: tool,
        tool_input: { path: 'src/secret.ts', command: 'npm test' },
        user_message: 'inspect code',
      });
      expect(res.parsed.permission).toBe('allow');
    }
  });

  it('bypasses guard when DAG_FLOW_WORKER=1', () => {
    const res = invokeGuard(
      {
        tool_name: 'Write',
        tool_input: { path: 'src/worker-patch.js' },
        user_message: 'worker task',
      },
      { DAG_FLOW_WORKER: '1' },
    );

    expect(res.parsed.permission).toBe('allow');
  });

  it('fails open on invalid JSON', () => {
    const res = invokeGuard('{not json');
    expect(res.parsed.permission).toBe('allow');
  });

  it('allows write tools with empty or missing path', () => {
    const res = invokeGuard({
      tool_name: 'Write',
      tool_input: {},
      user_message: 'Fix bug',
    });
    expect(res.parsed.permission).toBe('allow');
  });

  it('normalizes Windows-style guarded paths', () => {
    const res = invokeGuard({
      tool_name: 'Write',
      tool_input: { path: 'src\\routes\\auth.js' },
      user_message: 'Fix bug',
    });
    expect(res.parsed.permission).toBe('deny');
  });

  it('matches nested project paths containing guarded segments', () => {
    const res = invokeGuard({
      tool_name: 'Write',
      tool_input: { path: '/home/user/proj/packages/api/handler.ts' },
      user_message: 'Fix bug',
    });
    expect(res.parsed.permission).toBe('deny');
  });

  it('does not treat unrelated path segments as guarded', () => {
    const res = invokeGuard({
      tool_name: 'Write',
      tool_input: { path: 'vendor/some-src/not-guarded.js' },
      user_message: 'Fix bug',
    });
    expect(res.parsed.permission).toBe('allow');
  });

  it('guards test/ but not tests/ or __tests__/ (TDD segment list)', () => {
    expect(invokeGuard({
      tool_name: 'Write',
      tool_input: { path: 'test/unit.test.js' },
      user_message: 'Fix bug',
    }).parsed.permission).toBe('deny');

    expect(invokeGuard({
      tool_name: 'Write',
      tool_input: { path: 'tests/integration.test.js' },
      user_message: 'Fix bug',
    }).parsed.permission).toBe('allow');

    expect(invokeGuard({
      tool_name: 'Write',
      tool_input: { path: '__tests__/foo.test.js' },
      user_message: 'Fix bug',
    }).parsed.permission).toBe('allow');
  });

  it('uses D11 block template fields on deny', () => {
    const res = invokeGuard({
      tool_name: 'Write',
      tool_input: { path: 'src/x.js' },
      user_message: 'Fix bug',
    });
    const msg = res.parsed.user_message ?? '';
    expect(msg).toMatch(/❌ Edição direta em src\/x\.js bloqueada/);
    expect(msg).toContain('Já no dag-flow?');
    expect(msg).toContain('write_dag.sh');
  });
});

describe('extractUserPrompt', () => {
  it('prefers first non-empty known field', () => {
    expect(
      extractUserPrompt({
        user_message: 'from user_message',
        prompt: 'from prompt',
      }),
    ).toBe('from user_message');
  });

  it.each(['prompt', 'user_query', 'user_prompt', 'last_user_message'] as const)(
    'falls back to %s',
    (field) => {
      expect(extractUserPrompt({ [field]: `via ${field}` })).toBe(`via ${field}`);
    },
  );

  it('returns empty string when no prompt fields exist — routes Specify', () => {
    expect(extractUserPrompt({ tool_name: 'Write' })).toBe('');
    expect(classifyRoute('')).toBe('specify');
  });
});

describe('hook wiring E2E', () => {
  const CURSOR_ORCHESTRATOR: OrchestratorConfig = {
    hook_wiring_tier: 'pre_tool_use',
    hook_config_path: '.cursor/hooks.json',
    hook_event: 'preToolUse',
    hook_entry_id: 'dag-flow-guard',
    hook_config_adapter: 'cursor',
    boot_file: null,
    skill_install_path: '.cursor/skills',
    placeholders: {},
  };

  it('upserted absolute command path is spawnable and denies src writes', () => {
    const target = mkdtempSync(path.join(tmpdir(), 'dag-guard-wire-'));
    mkdirSync(path.join(target, '.cursor'), { recursive: true });

    hookConfigUpsert({
      target,
      orchestrator: CURSOR_ORCHESTRATOR,
      packageRoot: path.join(TEST_DIR, '..'),
    });

    const config = JSON.parse(readFileSync(path.join(target, '.cursor/hooks.json'), 'utf8'));
    const guardEntry = config.hooks.preToolUse.find(
      (e: { id?: string }) => e.id === 'dag-flow-guard',
    );
    expect(guardEntry?.command).toBeTruthy();

    const wired = spawnSync(process.execPath, [guardEntry.command], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { path: 'src/wired.js' },
        user_message: 'Fix bug',
      }),
      encoding: 'utf8',
      env: { ...process.env, DAG_FLOW_WORKER: undefined },
    });
    const out = JSON.parse((wired.stdout ?? '').trim()) as { permission: string };
    expect(out.permission).toBe('deny');
  });
});
