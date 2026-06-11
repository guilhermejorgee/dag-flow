#!/usr/bin/env python3.13
"""
run_socratic_session.py

Drives an interactive agy session (dag-flow or baseline) and emulates a real
user answering the agent's Socratic questions.

WHY pyte?
---------
agy uses the bubbletea TUI framework, which redraws the full terminal on every
token.  Reading the raw byte stream (pexpect read_nonblocking) gives you a
jumbled mix of ANSI codes, partial redraws, and variable-position content.

Instead, we feed every byte into a pyte VT100 terminal emulator.  pyte tracks
cursor movements, redraws, and scrolling — it always gives us the CURRENT
screen state as clean text rows.  This makes question detection simple and
robust regardless of how much content is on screen.

Architecture
------------
    pexpect.spawn(agy -i)     ← creates the pseudo-TTY (bubbletea needs a real
          ↓ raw bytes           TTY); keeps the session alive; injects answers
    pyte.Screen / ByteStream  ← emulates VT100, produces clean screen snapshots
          ↓ screen snapshot
    find_question()           ← pattern-based: looks for lines ending with ?
                                that are not TUI chrome; skips already-answered
          ↓ question text       questions via an answered_questions set
    call_user_emulator()      ← separate one-shot agy --print call (light model)
          ↓ answer text
    child.sendline(answer)    ← injected into the pseudo-TTY

Usage
-----
    python3.13 run_socratic_session.py \\
        --workspace <path>    \\
        --scenario-json <path/scenario.json> \\
        [--mode dag_flow|baseline] \\
        [--max-interactions 20] \\
        [--emulator-model "Gemini 3.5 Flash (Low)"] \\
        [--log-file <path>]
"""

from __future__ import annotations

import argparse
import glob as globmod
import hashlib
import json
import os
import re
import subprocess
import sys
import time

import pexpect
import pyte

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Terminal dimensions given to agy.  Wide columns give more room for content
# without line-wrapping; 50 rows is plenty for the bubbletea viewport.
COLS, ROWS = 220, 50

# Seconds the screen must remain unchanged before we consider the agent idle.
STABLE_SECONDS = 8

# Maximum seconds to wait for the screen to stabilise in one cycle.
# Design-phase generation can take 2-3 minutes of near-silence.
MAX_WAIT_PER_CYCLE = 300

# Maximum total session time (30 minutes).
MAX_TOTAL_SECONDS = 1800

# Safety cap on the number of Q&A interactions.
MAX_INTERACTIONS = 20

# Signals that indicate the agent has completed the Tasks/Execute phase.
# Checked in screen content AND on the filesystem.
FINISHED_SIGNALS = [
    "tasks.md",
    "run_dag.sh",
    "Execute Phase",
    "Execution Manifest",
    "DAG is ready",
    "Worker prompt",
]

# TUI chrome patterns — lines matching these are display artefacts, not content.
_CHROME_RE = re.compile(
    r"^\s*$"                        # blank
    r"|^[─\-=]{3,}"                # divider lines (─────)
    r"|^\s*>\s*$"                   # bare input prompt (>)
    r"|\? for shortcuts"           # bubbletea shortcuts bar
    r"|Antigravity CLI"            # header logo text
    r"|guilhermejorgee@gmail"      # user email in header
    r"|▄▀|▀▄|▀▀"                   # logo block characters
    r"|Google AI Pro"              # subscription label
)

# Tool-call indicator lines (not questions, not content we care about).
_TOOL_CALL_RE = re.compile(r"^[●•]\s|^ListDir\(|^Read\(|^Create\(|^Write\(|^Edit\(|^context-mode/")

# Survey dialog from agy — must be dismissed before we can send an answer.
_SURVEY_RE = re.compile(r"\[1\].*\[2\].*\[0\]|How.s the CLI experience")


# ---------------------------------------------------------------------------
# Screen helpers
# ---------------------------------------------------------------------------


def _content_lines(screen: pyte.Screen) -> list[str]:
    """
    Return the visible content lines from the current screen state,
    stripped of TUI chrome (header, dividers, input box, shortcuts bar)
    and tool-call indicator lines.
    """
    lines = []
    for row in screen.display:
        s = row.rstrip()
        if not s:
            continue
        if _CHROME_RE.search(s):
            continue
        if _TOOL_CALL_RE.search(s):
            continue
        lines.append(s)
    return lines


def _screen_hash(screen: pyte.Screen) -> str:
    """Stable hash of the current screen state for change detection."""
    digest = hashlib.md5("\n".join(screen.display).encode()).hexdigest()
    return digest


def find_question(screen: pyte.Screen, answered: set) -> tuple[str, str] | None:
    """
    Find the next unanswered question on screen.

    Returns (question_key, full_context) or None.
      question_key  — stable ID for deduplication (last question-ending line)
      full_context  — complete question text to pass to the emulator, including
                      PAGRL <Decision> context when available

    Multi-line handling: bubbletea wraps long lines across rows.  We reconstruct
    the full question by collecting all consecutive content lines that form the
    question paragraph (everything after </PAGRL> that isn't a user reply).
    """
    lines = _content_lines(screen)
    if not lines:
        return None

    # --- Extract PAGRL Decision for emulator context ---
    pagrl_decision = ""
    decision_re = re.compile(r"<Decision>(.*?)(?:</Decision>|$)", re.DOTALL)
    pagrl_end_idx = -1
    for i, line in enumerate(lines):
        m = decision_re.search(line)
        if m:
            pagrl_decision = m.group(1).strip().rstrip("<").strip()
        if "</PAGRL>" in line:
            pagrl_end_idx = i

    # --- Identify the question paragraph ---
    # Lines AFTER </PAGRL> that are not user replies (> prefix) form the question.
    # If no PAGRL block, take the last non-user paragraph.
    if pagrl_end_idx >= 0:
        candidate_lines = lines[pagrl_end_idx + 1 :]
    else:
        # Fallback: last 6 content lines
        candidate_lines = lines[-6:]

    # Drop user-reply lines (lines starting with >) — these are the input field
    # content or chat history replies, not the agent's question.
    question_lines = [l.strip() for l in candidate_lines if not l.strip().startswith(">")
                      and not _CHROME_RE.search(l)]

    # Must have at least one line containing ?
    if not any("?" in l for l in question_lines):
        return None

    # Join the paragraph into a single string (handles line-wrapped questions)
    full_question = " ".join(question_lines).strip()

    # Stable key = last question-ending segment (for deduplication)
    q_key = next((l for l in reversed(question_lines) if l.endswith("?")), full_question)

    if q_key in answered:
        return None

    # Build context for the emulator
    if pagrl_decision:
        full_context = f"{pagrl_decision}\n\n{full_question}"
    else:
        full_context = full_question

    return q_key, full_context


def is_finished(screen: pyte.Screen, workspace_dir: str) -> bool:
    """
    Return True if the agent has completed the Tasks/Execute phase.

    Two signals are checked:
      1. Any tasks.md anywhere under .specs/ exists on disk (glob search).
      2. Screen content contains a FINISHED_SIGNAL string.

    The filesystem check is the more reliable signal — it works even if the
    agent completed silently without printing a status message.  We use a
    recursive glob because dag-flow scopes output under .specs/features/<name>/.
    """
    # Filesystem check (primary) — recursive glob for any tasks.md under .specs/
    specs_dir = os.path.join(workspace_dir, ".specs")
    if os.path.isdir(specs_dir):
        matches = globmod.glob(os.path.join(specs_dir, "**", "tasks.md"), recursive=True)
        if matches:
            return True

    # Screen content check (secondary)
    content = "\n".join(_content_lines(screen))
    return any(sig in content for sig in FINISHED_SIGNALS)


# ---------------------------------------------------------------------------
# Screen stability
# ---------------------------------------------------------------------------


def wait_for_stable(
    child: pexpect.spawn,
    screen: pyte.Screen,
    stream: pyte.ByteStream,
    stable_seconds: int = STABLE_SECONDS,
    max_wait: int = MAX_WAIT_PER_CYCLE,
) -> tuple[bool, bool]:
    """
    Feed bytes from the pexpect child into the pyte screen until the screen
    has not changed for `stable_seconds` seconds.

    Returns:
        (stable, eof)
          stable — True if screen stabilised within max_wait
          eof    — True if the agy process exited
    """
    last_hash: str | None = None
    stable_since: float | None = None
    deadline = time.time() + max_wait

    while time.time() < deadline:
        try:
            chunk = child.read_nonblocking(size=8192, timeout=1)
            if chunk:
                stream.feed(chunk)
        except pexpect.TIMEOUT:
            pass
        except pexpect.EOF:
            return True, True

        current_hash = _screen_hash(screen)
        if current_hash != last_hash:
            last_hash = current_hash
            stable_since = time.time()
        elif stable_since is not None:
            if time.time() - stable_since >= stable_seconds:
                return True, False

    return False, False  # max_wait exceeded without stabilising


# ---------------------------------------------------------------------------
# User emulator
# ---------------------------------------------------------------------------


def call_user_emulator(question: str, user_context: dict, model: str) -> str:
    """
    Ask a lightweight model to answer the dag-flow agent's question.

    The emulator is positioned as a developer who requested a feature and is
    now answering the architect's clarifying questions.  It has no awareness
    of the benchmark, the dag-flow skill, or the harness.
    """
    persona = user_context.get("persona", "a backend developer")
    requirements = user_context.get("feature_requirements", {})
    style = user_context.get("answering_style", "Direct and concise. One answer only.")

    prompt = (
        f"You are {persona}. "
        f"You asked your team's software architect to implement a new feature for you. "
        f"They are now asking you a clarifying question before they start. "
        f"Answer naturally based on what you know about the feature.\n\n"
        f"What you know about the feature:\n"
        f"{json.dumps(requirements, indent=2)}\n\n"
        f"Answering style: {style}\n\n"
        f'The architect\'s question: "{question}"\n\n'
        f"Give a short, direct answer (1-3 sentences). "
        f"Do not mention specs, documents, or benchmarks."
    )

    try:
        result = subprocess.run(
            ["agy", "--model", model, "--dangerously-skip-permissions", "--print", prompt],
            capture_output=True,
            text=True,
            timeout=90,
        )
        answer = result.stdout.strip()
    except subprocess.TimeoutExpired:
        answer = ""

    if not answer:
        # Fallback: use the first requirement value as a terse answer
        vals = list(requirements.values())
        answer = str(vals[0]) if vals else "Use sensible defaults."

    return answer


# ---------------------------------------------------------------------------
# Core session runner
# ---------------------------------------------------------------------------


def run_session(
    workspace_dir: str,
    initial_prompt: str,
    user_context: dict,
    emulator_model: str,
    log_path: str,
    mode: str,
    dag_flow_model: str | None = None,
) -> list[dict]:
    """
    Spawn an interactive agy session and drive it turn-by-turn.

    dag_flow mode → prompt prefixed with 'Use the dag-flow skill to:'
    baseline mode → prompt sent as-is (no skill prefix)
    dag_flow_model → optional model override for the dag-flow agent
    """
    if mode == "dag_flow":
        full_prompt = f"Use the dag-flow skill to: {initial_prompt}"
    else:
        full_prompt = initial_prompt

    model_flag = f'--model "{dag_flow_model}" ' if dag_flow_model else ""
    print(f"[socratic] Starting {mode} session in {workspace_dir}")
    print(f"[socratic] Model: {dag_flow_model or 'agy default'}")
    print(f"[socratic] Prompt: {full_prompt[:100]}...")

    # Initialise pyte terminal emulator
    screen = pyte.Screen(COLS, ROWS)
    stream = pyte.ByteStream(screen)

    # Spawn agy in interactive mode.
    # - encoding=None → raw bytes mode, required by pyte.ByteStream
    # - dimensions=(ROWS, COLS) → tell agy the terminal size
    # - echo=False → suppress input echo
    child = pexpect.spawn(
        f'agy --dangerously-skip-permissions {model_flag}-i "{full_prompt}"',
        cwd=workspace_dir,
        encoding=None,
        timeout=MAX_WAIT_PER_CYCLE,
        echo=False,
        dimensions=(ROWS, COLS),
    )

    transcript: list[dict] = []
    answered_questions: set[str] = set()
    interactions = 0
    session_start = time.time()

    with open(log_path, "wb") as raw_log:
        # Patch child to also write raw bytes to our log
        original_read = child.read_nonblocking

        def _read_and_log(size=1, timeout=-1):
            data = original_read(size=size, timeout=timeout)
            if data:
                raw_log.write(data)
                raw_log.flush()
            return data

        child.read_nonblocking = _read_and_log

        while (
            interactions < MAX_INTERACTIONS
            and time.time() - session_start < MAX_TOTAL_SECONDS
        ):
            print(f"[socratic] Waiting for screen to stabilise (interaction #{interactions + 1})...")

            stable, eof = wait_for_stable(child, screen, stream)

            if eof:
                print("[socratic] Agent process ended (EOF).")
                transcript.append({"event": "eof"})
                break

            if not stable:
                print("[socratic] Screen did not stabilise within time limit. Agent may be stuck.")
                transcript.append({"event": "timeout"})
                break

            # --- Print current content for debugging ---
            content = _content_lines(screen)
            print(f"[socratic] Screen content ({len(content)} lines):")
            for ln in content[-8:]:  # last 8 content lines
                print(f"  | {ln[:120]}")

            # --- Check if finished ---
            if is_finished(screen, workspace_dir):
                print("[socratic] ✓ Agent finished (tasks.md found or Execute phase detected).")
                transcript.append({"event": "finished"})
                child.sendline("/exit")
                time.sleep(1)
                child.close(force=True)
                break

            # --- Find new question ---
            result = find_question(screen, answered_questions)
            if result:
                q_key, full_context = result
                print(f"[socratic] Agent asked: {full_context[:200]}")

                answer = call_user_emulator(full_context, user_context, emulator_model)
                print(f"[socratic] Emulator answers: {answer[:120]}")

                answered_questions.add(q_key)
                transcript.append({
                    "interaction": interactions + 1,
                    "question": full_context,
                    "answer": answer,
                })
                # Use \r (carriage return) — bubbletea requires CR to submit,
                # NOT \n which inserts a newline inside the input field.
                child.send(answer.encode() + b"\r")
                interactions += 1
            else:
                # Screen is stable but no new question — agent is between phases
                # (e.g., running tools, writing files, API call in flight).
                cursor_row = screen.cursor.y

                # Check for survey dialog — dismiss with '0' (Skip) so it
                # doesn't block the next interaction.
                raw_display = "\n".join(screen.display)
                if _SURVEY_RE.search(raw_display):
                    print("[socratic] Survey detected — dismissing with '0' (Skip).")
                    child.send(b"0\r")
                    time.sleep(1)
                    transcript.append({"event": "survey_dismissed"})
                    continue

                # Reduced-verbosity dump: just cursor row + last 8 visible rows.
                print(f"[socratic] Screen stable, no question yet. Cursor=row {cursor_row}.")
                for i, row in enumerate(screen.display):
                    s = row.rstrip()
                    if i == cursor_row:
                        print(f"  [{i:2}]: {s[:110]} ◀ CURSOR")
                transcript.append({"event": "waiting", "content_lines": len(content),
                                   "cursor": {"row": cursor_row}})
                time.sleep(3)

    if child.isalive():
        child.close(force=True)

    return transcript


# ---------------------------------------------------------------------------
# Transcript writer
# ---------------------------------------------------------------------------


def write_transcript(transcript: list[dict], log_path: str) -> None:
    path = log_path.replace(".log", "_transcript.json")
    with open(path, "w") as f:
        json.dump(transcript, f, indent=2, ensure_ascii=False)
    print(f"[socratic] Transcript saved to {path}")


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run a Socratic agy session for the E2E benchmark."
    )
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--scenario-json", required=True)
    parser.add_argument("--mode", choices=["dag_flow", "baseline"], default="dag_flow")
    parser.add_argument("--max-interactions", type=int, default=MAX_INTERACTIONS)
    parser.add_argument("--emulator-model", default="Gemini 3.5 Flash (Low)")
    parser.add_argument("--dag-flow-model", default=None,
                        help="Model for the dag-flow agent (e.g. 'Gemini 3.1 Pro (High)')")
    parser.add_argument("--log-file", default=None)
    args = parser.parse_args()

    with open(args.scenario_json) as f:
        scenario = json.load(f)

    user_context = scenario.get("user_context", {})
    if not user_context:
        print("[socratic] WARNING: No user_context in scenario.json — emulator will use defaults.")

    prompt = scenario.get(
        "dag_flow_prompt" if args.mode == "dag_flow" else "baseline_prompt", ""
    )

    log_path = args.log_file or os.path.join(
        os.path.dirname(args.workspace),
        f"socratic_{args.mode}.log",
    )

    transcript = run_session(
        workspace_dir=os.path.abspath(args.workspace),
        initial_prompt=prompt,
        user_context=user_context,
        emulator_model=args.emulator_model,
        dag_flow_model=args.dag_flow_model,
        log_path=log_path,
        mode=args.mode,
    )

    q_and_a = [t for t in transcript if "question" in t]
    write_transcript(transcript, log_path)
    print(f"[socratic] Session complete. {len(q_and_a)} Q&A interactions recorded.")
    sys.exit(0)


if __name__ == "__main__":
    main()
