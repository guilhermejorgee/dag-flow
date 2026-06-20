#!/usr/bin/env node
/**
 * Cursor sessionStart — caveman rules from project skill + ~/.cursor flag file.
 * No Claude Code paths or binaries.
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { getDefaultMode, readFlag, safeWriteFlag, getFlagPath } = require(
  join(dirname(fileURLToPath(import.meta.url)), "caveman", "caveman-config.js"),
);

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      buf += chunk;
    });
    process.stdin.on("end", () => resolve(buf));
  });
}

function skillContext(workspaceRoot, mode) {
  const candidates = [
    join(workspaceRoot, ".cursor", "skills", "caveman", "SKILL.md"),
    join(workspaceRoot, ".agents", "skills", "caveman", "SKILL.md"),
  ];
  const skillPath = candidates.find((p) => existsSync(p));
  if (!skillPath) {
    return (
      `CAVEMAN MODE ACTIVE (${mode}). Drop articles/filler/pleasantries/hedging. ` +
      "Fragments OK. Code/commits/security: write normal. Off: stop caveman / normal mode."
    );
  }
  const body = readFileSync(skillPath, "utf8").replace(/^---[\s\S]*?---\s*/, "");
  return `CAVEMAN MODE ACTIVE — level: ${mode}\n\n${body}`;
}

function emitContext(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    process.stdout.write("{}\n");
    return;
  }
  process.stdout.write(JSON.stringify({ additional_context: trimmed }) + "\n");
}

const raw = await readStdin();
let workspaceRoot = process.cwd();
try {
  const input = JSON.parse(raw || "{}");
  workspaceRoot = input.workspace_roots?.[0] || workspaceRoot;
} catch {
  // keep cwd fallback
}

const flagPath = getFlagPath();
const defaultMode = getDefaultMode();
let activeMode = readFlag(flagPath);

if (!activeMode && defaultMode !== "off") {
  safeWriteFlag(flagPath, defaultMode);
  activeMode = defaultMode;
}

if (activeMode) {
  emitContext(skillContext(workspaceRoot, activeMode));
  process.exit(0);
}

process.stdout.write("{}\n");
