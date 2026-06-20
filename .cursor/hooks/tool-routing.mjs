#!/usr/bin/env node
/**
 * Unified Cursor preToolUse router: codegraph (AST navigation) vs context-mode (heavy output).
 * Exactly one guidance source per event — never both agent_messages on the same tool call.
 */
import { spawnSync } from "node:child_process";
import { closeSync, constants, existsSync, mkdirSync, openSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { tmpdir } from "node:os";

const LARGE_FILE_BYTES = 50_000;

const INDEXED_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".pyw",
  ".sh",
  ".bash",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".vue",
  ".svelte",
]);

const SKIP_EXTS = new Set([
  ".md",
  ".mdc",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".toml",
  ".lock",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".sql",
  ".db",
  ".sqlite",
  ".zip",
  ".gz",
  ".wasm",
]);

const SKIP_DIRS =
  /(?:^|\/)(?:node_modules|\.git|dist|build|coverage|\.venv|venv|__pycache__|\.next|\.turbo)(?:\/|$)/;

function readStdin() {
  return new Promise((res) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => {
      buf += c;
    });
    process.stdin.on("end", () => res(buf));
  });
}

function emitEmpty() {
  process.stdout.write(JSON.stringify({ agent_message: "" }) + "\n");
}

function emitMessage(message) {
  process.stdout.write(JSON.stringify({ agent_message: message }) + "\n");
}

function guidanceDir(sessionId) {
  return resolve(tmpdir(), `dag-flow-tool-routing-${sessionId}`);
}

function guidanceOnce(key, sessionId) {
  const dir = guidanceDir(sessionId);
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return false;
  }
  const marker = resolve(dir, key);
  try {
    const fd = openSync(
      marker,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
      0o600,
    );
    closeSync(fd);
    return true;
  } catch (e) {
    if (e && e.code === "EEXIST") return false;
    return false;
  }
}

function getSessionId(input) {
  return (
    input.conversation_id ||
    input.generation_id ||
    input.session_id ||
    `ppid-${process.ppid}`
  );
}

function getProjectDir(input) {
  const root = input.workspace_roots?.[0];
  return root ? resolve(root) : process.cwd();
}

function hasCodegraphIndex(projectDir) {
  return existsSync(resolve(projectDir, ".codegraph"));
}

function isIndexableSource(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!ext || SKIP_EXTS.has(ext)) return false;
  if (!INDEXED_EXTS.has(ext)) return false;
  if (SKIP_DIRS.test(filePath)) return false;
  return true;
}

function isLargeFile(filePath) {
  try {
    const st = statSync(filePath);
    return st.isFile() && st.size > LARGE_FILE_BYTES;
  } catch {
    return false;
  }
}

function readTarget(toolInput) {
  return toolInput.path ?? toolInput.file_path ?? toolInput.target_file ?? "";
}

function grepPattern(toolInput) {
  return String(toolInput.pattern ?? toolInput.query ?? toolInput.regex ?? "");
}

function isGrepAnalysis(pattern, toolInput) {
  if (toolInput.output_mode === "count" || toolInput.output_mode === "files_with_matches") {
    return toolInput.output_mode === "count";
  }
  const headLimit = Number(toolInput.head_limit ?? toolInput["-m"] ?? 0);
  if (Number.isFinite(headLimit) && headLimit > 100) return true;
  if (toolInput.multiline === true) return true;
  if (!pattern) return false;
  if (pattern.includes("\n")) return true;
  if (pattern.length > 120) return true;
  if (/[|*+?^{}\[\]()]/.test(pattern) && pattern.length > 40) return true;
  return false;
}

function isGrepNavigation(pattern) {
  if (!pattern || pattern.length > 100) return false;
  return /^[\w.$/\s-]+$/.test(pattern);
}

function classifyRead(filePath, projectDir) {
  if (!filePath) return "context-mode";
  if (!hasCodegraphIndex(projectDir)) return "context-mode";
  if (!isIndexableSource(filePath)) return "context-mode";
  if (isLargeFile(filePath)) return "context-mode";
  return "codegraph";
}

function classifyGrep(pattern, toolInput, projectDir) {
  if (isGrepAnalysis(pattern, toolInput)) return "context-mode";
  if (!hasCodegraphIndex(projectDir)) return "context-mode";
  if (isGrepNavigation(pattern)) return "codegraph";
  return "context-mode";
}

function codegraphReadMessage(filePath) {
  const name = basename(filePath);
  return (
    "<tool_routing source=\"codegraph\">\n" +
    `Indexed source (${name}). Use MCP codegraph_node(file: path) instead of Read — ` +
    "same <n>\\t<line> output plus dependents. " +
    "Understand an area: codegraph_explore first.\n" +
    "Fall back to Read only when codegraph shows a stale-index banner or file is not indexed.\n" +
    "Do NOT Grep to re-verify codegraph.\n" +
    "</tool_routing>"
  );
}

function codegraphGrepMessage(pattern) {
  const preview = pattern.length > 60 ? `${pattern.slice(0, 57)}...` : pattern;
  return (
    "<tool_routing source=\"codegraph\">\n" +
    `Navigation search ("${preview}"). Prefer codegraph_search or codegraph_explore over Grep on indexed code.\n` +
    "Use ctx_execute / ctx_batch_execute only to count, filter, or aggregate large match sets.\n" +
    "</tool_routing>"
  );
}

function delegateContextMode(raw) {
  const result = spawnSync("context-mode", ["hook", "cursor", "pretooluse"], {
    input: raw,
    encoding: "utf8",
    timeout: 10_000,
  });
  const out = (result.stdout || "").trim();
  if (out) {
    process.stdout.write(`${out}\n`);
    return;
  }
  emitEmpty();
}

const raw = await readStdin();
let input = {};
try {
  input = JSON.parse(raw || "{}");
} catch {
  emitEmpty();
  process.exit(0);
}

const tool = input.tool_name ?? "";
const toolInput = input.tool_input ?? {};
const sessionId = getSessionId(input);
const projectDir = getProjectDir(input);

// Already on the right MCP tool — no nudge.
if (tool.startsWith("MCP:")) {
  if (/codegraph/i.test(tool) || /ctx_/i.test(tool)) {
    emitEmpty();
    process.exit(0);
  }
  delegateContextMode(raw);
  process.exit(0);
}

if (tool === "Read") {
  const filePath = readTarget(toolInput);
  const route = classifyRead(filePath, projectDir);
  if (route === "codegraph" && guidanceOnce("codegraph-read", sessionId)) {
    emitMessage(codegraphReadMessage(filePath));
    process.exit(0);
  }
  if (route === "codegraph") {
    emitEmpty();
    process.exit(0);
  }
  delegateContextMode(raw);
  process.exit(0);
}

if (tool === "Grep") {
  const pattern = grepPattern(toolInput);
  const route = classifyGrep(pattern, toolInput, projectDir);
  if (route === "codegraph" && guidanceOnce("codegraph-grep", sessionId)) {
    emitMessage(codegraphGrepMessage(pattern));
    process.exit(0);
  }
  if (route === "codegraph") {
    emitEmpty();
    process.exit(0);
  }
  delegateContextMode(raw);
  process.exit(0);
}

delegateContextMode(raw);
