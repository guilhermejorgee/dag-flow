#!/usr/bin/env node
/**
 * Cursor beforeSubmitPrompt → local .cursor/hooks/caveman tracker.
 * Maps block responses to continue:false + user_message.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TRACKER = join(dirname(fileURLToPath(import.meta.url)), "caveman", "caveman-mode-tracker.js");

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

const input = await readStdin();

const result = spawnSync(process.execPath, [TRACKER], {
  input,
  encoding: "utf8",
  timeout: 8000,
});

if (result.error) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

const raw = (result.stdout || "").trim();
if (!raw) {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch {
  process.stdout.write(JSON.stringify({ continue: true }));
  process.exit(0);
}

if (parsed.decision === "block" || parsed.decision === "deny") {
  process.stdout.write(
    JSON.stringify({
      continue: false,
      user_message: parsed.reason || parsed.user_message || "Blocked by caveman hook",
    }),
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ continue: true }));
