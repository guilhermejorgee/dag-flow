#!/usr/bin/env python3
"""Unit tests for validate_pagrl.py — no pytest dependency."""

import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
VALIDATOR = SCRIPT_DIR / "validate_pagrl.py"


def run_validator(phase: str, xml_content: str) -> int:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".pagrl.xml", delete=False, encoding="utf-8"
    ) as f:
        f.write(xml_content)
        path = f.name
    result = subprocess.run(
        [sys.executable, str(VALIDATOR), "--phase", phase, path],
        capture_output=True,
        text=True,
    )
    Path(path).unlink(missing_ok=True)
    return result.returncode


DIAGNOSIS_PASS = """<PAGRL phase="quick-mode-diagnosis">
  <ReferencesRead>references/quick-mode.md</ReferencesRead>
  <FilesInspected>src/routes/auth.js, test.js</FilesInspected>
  <Intention>Test</Intention>
  <Reasoning>Test</Reasoning>
  <Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>"""

DIAGNOSIS_MISSING_FILES = """<PAGRL phase="quick-mode-diagnosis">
  <ReferencesRead>references/quick-mode.md</ReferencesRead>
  <Intention>Test</Intention>
  <Reasoning>Test</Reasoning>
  <Decision>Generate a Mini-DAG for the hot-patch.</Decision>
</PAGRL>"""

DAG_PLANNER_PROCEED = """<PAGRL phase="DagPlanner">
  <DomainsIdentified>auth, nodejs</DomainsIdentified>
  <SkillsApplied/>
  <EscalationDecision>Proceed</EscalationDecision>
  <OpenDecisions/>
  <GateReasoning>Unit test available</GateReasoning>
  <TasksCount>2</TasksCount>
</PAGRL>"""

DAG_PLANNER_ESCALATE_EMPTY = """<PAGRL phase="DagPlanner">
  <DomainsIdentified>auth</DomainsIdentified>
  <EscalationDecision>Escalate</EscalationDecision>
  <OpenDecisions/>
  <GateReasoning>N/A</GateReasoning>
  <TasksCount>1</TasksCount>
</PAGRL>"""

DAG_PLANNER_ZERO_TASKS = """<PAGRL phase="DagPlanner">
  <DomainsIdentified>auth</DomainsIdentified>
  <EscalationDecision>Proceed</EscalationDecision>
  <OpenDecisions/>
  <GateReasoning>N/A</GateReasoning>
  <TasksCount>0</TasksCount>
</PAGRL>"""


def test(name: str, phase: str, fixture: str, expect_pass: bool) -> None:
    rc = run_validator(phase, fixture)
    passed = rc == 0
    if passed != expect_pass:
        print(f"FAIL: {name} — expected {'PASS' if expect_pass else 'FAIL'}, got {'PASS' if passed else 'FAIL'}")
        sys.exit(1)
    print(f"PASS: {name}")


def main() -> None:
    test("diagnosis missing FilesInspected", "quick-mode-diagnosis", DIAGNOSIS_MISSING_FILES, False)
    test("diagnosis complete", "quick-mode-diagnosis", DIAGNOSIS_PASS, True)
    test("dag-planner Escalate empty OpenDecisions", "dag-planner", DAG_PLANNER_ESCALATE_EMPTY, False)
    test("dag-planner Proceed valid", "dag-planner", DAG_PLANNER_PROCEED, True)
    test("dag-planner TasksCount=0", "dag-planner", DAG_PLANNER_ZERO_TASKS, False)
    print("ALL PASSED")


if __name__ == "__main__":
    main()
