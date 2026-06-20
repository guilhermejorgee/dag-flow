#!/usr/bin/env node
/**
 * dag-flow Hook (Guard + Router) — npm CLI package (ADR-0010, TDD D11).
 * Guard: block writes under src/, lib/, api/, test/ unless DAG_FLOW_WORKER=1.
 * Router: on block, classify Quick Mode vs Specify from user prompt.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const CANONICAL_QUICK_PHRASES = ['fix bug', 'hotfix', 'hot-patch', 'quick mode'];

export const GUARDED_SEGMENTS = ['src', 'lib', 'api', 'test'];

const WRITE_TOOLS = new Set(['Write', 'StrReplace', 'EditNotebook', 'Delete', 'ApplyPatch']);

const ERROR_SYMPTOM_RE =
  /\b(error|bug|fail(?:ed|ure|s)?|exception|regression|syntax|stack\s*trace|timeout|undefined|referenceerror|typeerror|500|404|crash|broken)\b/i;

const NEW_REQUIREMENTS_RE =
  /\b(implement|build\s+(?:a\s+)?new|add\s+(?:a\s+)?new|create\s+(?:a\s+)?new|new\s+feature|new\s+endpoint|from\s+scratch|greenfield)\b/i;

/** Closed-list paraphrases — quick-mode.md: do not route to Quick without canonical phrase. */
const QUICK_PARAPHRASE_RE =
  /\b(patch this|quick fix|small bug|apply a quick fix|just a small)\b/i;

const FILE_PATH_RE =
  /(?:^|[\s'"`(])((?:[\w.-]+\/)*[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|rb|php|vue|svelte))(?:[\s'"`),]|$)/gi;

const GUARDED_DIR_PATH_RE = /(?:^|[\s'"`(])((?:src|lib|api|test)\/[\w./-]+)/gi;

function readStdin() {
  return new Promise((res) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buf += chunk;
    });
    process.stdin.on('end', () => res(buf));
  });
}

export function isGuardedWriteTool(toolName) {
  return WRITE_TOOLS.has(toolName);
}

export function isGuardedPath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }
  const normalized = filePath.replace(/\\/g, '/');
  return GUARDED_SEGMENTS.some((seg) => {
    if (normalized === seg || normalized.startsWith(`${seg}/`)) {
      return true;
    }
    return new RegExp(`(^|/)${seg}/`).test(normalized);
  });
}

export function extractUserPrompt(input) {
  if (typeof input === 'string') {
    return input;
  }
  const candidates = [
    input.user_message,
    input.prompt,
    input.user_query,
    input.user_prompt,
    input.last_user_message,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

export function hasCanonicalQuickPhrase(prompt) {
  const lower = prompt.toLowerCase();
  return CANONICAL_QUICK_PHRASES.some((phrase) => lower.includes(phrase));
}

function countMentionedFiles(prompt) {
  const matches = new Set();
  for (const match of prompt.matchAll(FILE_PATH_RE)) {
    matches.add(match[1].toLowerCase());
  }
  for (const match of prompt.matchAll(GUARDED_DIR_PATH_RE)) {
    matches.add(match[1].toLowerCase());
  }
  return matches.size;
}

export function hasErrorOrSymptom(prompt) {
  return ERROR_SYMPTOM_RE.test(prompt);
}

export function hasNewRequirements(prompt) {
  return NEW_REQUIREMENTS_RE.test(prompt);
}

/**
 * Quick if canonical phrase OR (1–2 files + error/symptom + no new requirements).
 * Bias Specify when ambiguous.
 */
export function classifyRoute(prompt) {
  if (hasCanonicalQuickPhrase(prompt)) {
    return 'quick';
  }
  if (QUICK_PARAPHRASE_RE.test(prompt)) {
    return 'specify';
  }
  const fileCount = countMentionedFiles(prompt);
  if (fileCount >= 1 && fileCount <= 2 && hasErrorOrSymptom(prompt) && !hasNewRequirements(prompt)) {
    return 'quick';
  }
  return 'specify';
}

export function buildBlockMessage(blockedPath, prompt) {
  const route = classifyRoute(prompt);
  const classification = route === 'quick' ? 'Quick Mode (hotfix)' : 'Specify (feature)';
  const suggested =
    route === 'quick'
      ? 'Invoke Quick Mode with a canonical phrase (e.g. "Fix bug: <symptom>") and follow `references/quick-mode.md`'
      : 'Start Specify — read `references/specify.md` and engage Socratic interrogation before writing code';
  const alreadyIn =
    'Draft in `.specs/staging/`, vault via `scripts/write_dag.sh` or `commit_*` gates, then run `scripts/run_dag.sh`';

  return (
    `❌ Edição direta em ${blockedPath} bloqueada — dag-flow exige execução via DAG.\n\n` +
    `${classification}:\n` +
    `  → ${suggested}\n\n` +
    `Já no dag-flow?\n` +
    `  → ${alreadyIn}`
  );
}

function readTarget(toolInput) {
  return (
    toolInput.path ??
    toolInput.file_path ??
    toolInput.target_file ??
    toolInput.target_notebook ??
    ''
  );
}

function emitAllow() {
  process.stdout.write(`${JSON.stringify({ permission: 'allow' })}\n`);
}

function emitDeny(message) {
  process.stdout.write(
    `${JSON.stringify({
      permission: 'deny',
      user_message: message,
      agent_message: message,
    })}\n`,
  );
}

export async function runHook(rawInput) {
  if (process.env.DAG_FLOW_WORKER === '1') {
    emitAllow();
    return;
  }

  let input = {};
  try {
    input = JSON.parse(rawInput || '{}');
  } catch {
    emitAllow();
    return;
  }

  const tool = input.tool_name ?? '';
  const toolInput = input.tool_input ?? {};

  if (!isGuardedWriteTool(tool)) {
    emitAllow();
    return;
  }

  const target = readTarget(toolInput);
  if (!isGuardedPath(target)) {
    emitAllow();
    return;
  }

  const prompt = extractUserPrompt(input);
  emitDeny(buildBlockMessage(target, prompt));
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const raw = await readStdin();
  await runHook(raw);
}
