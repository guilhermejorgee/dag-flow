import sys
import json
import os
import argparse
from datetime import datetime

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace_dir")
    parser.add_argument("--mode", choices=["dag_flow", "baseline", "both"], default="dag_flow")
    args = parser.parse_args()

    workspace_dir = args.workspace_dir
    mode = args.mode

    scenarios = [
        "s1-auth-jwt", "s2-rbac-roles", "s3-file-upload",
        "s4-brownfield", "s5-ambiguous-spec", "s6-quick-mode-hotfix",
    ]

    report = {
        "version": "v0.2.0",
        "mode": mode,
        "run_timestamp": datetime.now().isoformat(),
        "scenarios": [],
        "summary": {},
    }

    passed_count = 0
    for s in scenarios:
        s_dir = os.path.join(workspace_dir, s)

        # Prefer mode-specific grading file, fall back to legacy grading.json
        grade_file = os.path.join(s_dir, f"grading_{mode}.json")
        if not os.path.exists(grade_file):
            grade_file = os.path.join(s_dir, "grading.json")

        passed = False
        failures = []
        if os.path.exists(grade_file):
            with open(grade_file) as f:
                data = json.load(f)
                grading = data.get("expectations", [])
                passed = all(g.get("passed", False) for g in grading)
                failures = [g["text"] for g in grading if not g.get("passed")]

        if passed:
            passed_count += 1

        # Check if Socratic transcript exists (dag_flow mode only)
        transcript_path = os.path.join(s_dir, "socratic_dag_flow_transcript.json")
        socratic_turns = 0
        if os.path.exists(transcript_path):
            with open(transcript_path) as f:
                transcript = json.load(f)
            socratic_turns = len([t for t in transcript if "emulator_answer" in t])

        report["scenarios"].append({
            "id": s,
            "passed": passed,
            "failures": failures,
            "socratic_turns": socratic_turns,
        })

    report["summary"] = {
        "scenarios_passed": passed_count,
        "scenarios_total": len(scenarios),
        "overall_pass_rate": round(passed_count / len(scenarios), 3) if scenarios else 0,
    }

    summary_dir = os.path.join(workspace_dir, "summary")
    os.makedirs(summary_dir, exist_ok=True)

    out_json = os.path.join(summary_dir, f"benchmark_{mode}.json")
    out_md = os.path.join(summary_dir, f"benchmark_{mode}.md")

    # Also write legacy benchmark.json for backward compat
    with open(os.path.join(summary_dir, "benchmark.json"), "w") as f:
        json.dump(report, f, indent=2)

    with open(out_json, "w") as f:
        json.dump(report, f, indent=2)

    with open(out_md, "w") as f:
        f.write(f"# Benchmark Report — mode: {mode}\n\n")
        f.write(f"**Run:** {report['run_timestamp']}\n\n")
        f.write(f"**Passed:** {passed_count}/{len(scenarios)} ({report['summary']['overall_pass_rate']*100:.0f}%)\n\n")
        f.write("| Scenario | Result | Socratic Turns | Failures |\n")
        f.write("|---|---|---|---|\n")
        for s in report["scenarios"]:
            icon = "✅" if s["passed"] else "❌"
            turns = s["socratic_turns"] if mode != "baseline" else "—"
            failures = "<br>".join(s["failures"]) if s["failures"] else "—"
            f.write(f"| {s['id']} | {icon} | {turns} | {failures} |\n")

    print(f"\nBenchmark report written to {out_md}")
    print(f"Passed: {passed_count}/{len(scenarios)}")
    for s in report["scenarios"]:
        icon = "✅" if s["passed"] else "❌"
        print(f"  {icon} {s['id']} (socratic_turns={s['socratic_turns']})")

if __name__ == "__main__":
    main()
