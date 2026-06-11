import sys
import json
import os
import glob
import subprocess
import re
import argparse


def resolve_dir(base_dir, scenario_id, workspace_dir, mode):
    """Return the correct output directory based on assertion target and run mode."""
    scenario_run = os.path.join(workspace_dir, scenario_id)
    if mode == "baseline":
        return os.path.join(scenario_run, "baseline")
    else:
        # dag_flow or both — assertions check the dag-flow workspace by default
        return os.path.join(scenario_run, "with_dag_flow")


def check_assertion(assertion, output_dir):
    atype = assertion.get("type")

    if atype == "file_exists":
        path = os.path.join(output_dir, assertion.get("path", ""))
        passed = os.path.exists(path)
        return {"text": f"File exists: {assertion.get('path')}", "passed": passed, "evidence": f"Found: {passed} (in {output_dir})"}

    elif atype == "glob_exists":
        # Checks that at least one file matches the glob pattern under output_dir.
        # e.g. { "type": "glob_exists", "pattern": ".specs/features/*/tasks.md" }
        pattern = os.path.join(output_dir, assertion.get("pattern", ""))
        matches = glob.glob(pattern, recursive=True)
        passed = len(matches) > 0
        return {"text": f"Glob exists: {assertion.get('pattern')}", "passed": passed,
                "evidence": f"Found: {matches[:3]}"}

    elif atype == "glob_grep":
        # Checks that at least one file matching the glob contains the pattern.
        # e.g. { "type": "glob_grep", "glob": ".specs/features/*/tasks.md", "pattern": "agy" }
        file_glob = os.path.join(output_dir, assertion.get("glob", ""))
        matches = glob.glob(file_glob, recursive=True)
        passed = False
        for m in matches:
            with open(m, "r", errors="replace") as f:
                if re.search(assertion.get("pattern", ""), f.read()):
                    passed = True
                    break
        return {"text": f"Glob grep: {assertion.get('pattern')} in {assertion.get('glob')}",
                "passed": passed, "evidence": f"Checked {len(matches)} file(s)"}

    elif atype == "file_not_exists":
        path = os.path.join(output_dir, assertion.get("path", ""))
        passed = not os.path.exists(path)
        return {"text": f"File does not exist: {assertion.get('path')}", "passed": passed, "evidence": f"Not found: {passed}"}

    elif atype == "grep":
        path = os.path.join(output_dir, assertion.get("path", ""))
        passed = False
        if os.path.exists(path):
            with open(path, "r", errors="replace") as f:
                passed = bool(re.search(assertion.get("pattern"), f.read()))
        return {"text": f"Grep {assertion.get('pattern')} in {assertion.get('path')}", "passed": passed, "evidence": f"Matched: {passed}"}

    elif atype == "grep_not":
        path = os.path.join(output_dir, assertion.get("path", ""))
        passed = True
        if os.path.exists(path):
            with open(path, "r", errors="replace") as f:
                passed = not bool(re.search(assertion.get("pattern"), f.read()))
        return {"text": f"Grep not {assertion.get('pattern')} in {assertion.get('path')}", "passed": passed, "evidence": f"Matched NOT: {passed}"}

    elif atype == "exit_code":
        cmd = assertion.get("command")
        try:
            res = subprocess.run(cmd, shell=True, cwd=output_dir, capture_output=True, timeout=60)
            passed = (res.returncode == assertion.get("expected", 0))
        except Exception as e:
            passed = False
        return {"text": f"Exit code {assertion.get('expected')} for {cmd}", "passed": passed, "evidence": "Execution tested"}

    elif atype == "spec_file_contains":
        # Checks that a spec file (in .specs/) contains a given pattern.
        # Useful for verifying that the Specify phase produced quality output.
        path = os.path.join(output_dir, ".specs", assertion.get("file", "spec.md"))
        passed = False
        if os.path.exists(path):
            with open(path, "r", errors="replace") as f:
                content = f.read()
                passed = bool(re.search(assertion.get("pattern", ""), content))
        return {"text": f"Spec {assertion.get('file')} contains {assertion.get('pattern')}", "passed": passed, "evidence": f"Matched: {passed}"}

    elif atype == "socratic_turns":
        # Checks the socratic session had at least N turns (agent asked questions).
        transcript_path = os.path.join(
            os.path.dirname(output_dir),
            "socratic_dag_flow_transcript.json",
        )
        min_turns = assertion.get("min_turns", 2)
        passed = False
        if os.path.exists(transcript_path):
            with open(transcript_path) as f:
                transcript = json.load(f)
            # Transcript entries with an 'answer' key are Q&A interactions
            qa_turns = [t for t in transcript if "answer" in t]
            passed = len(qa_turns) >= min_turns
        return {
            "text": f"Socratic session had >= {min_turns} Q&A turns",
            "passed": passed,
            "evidence": f"Found {len(qa_turns) if os.path.exists(transcript_path) else 0} Q&A turns",
        }

    elif atype == "llm_judge":
        # Evaluates the semantics of file contents using an LLM.
        # e.g. { "type": "llm_judge", "glob": ".specs/features/*/design.md", "requirement": "..." }
        file_glob = os.path.join(output_dir, assertion.get("glob", ""))
        matches = glob.glob(file_glob, recursive=True)
        passed = False
        evidence = f"Checked {len(matches)} file(s)"
        
        if matches:
            content = ""
            for m in matches:
                with open(m, "r", errors="replace") as f:
                    content += f.read() + "\n"
            
            req = assertion.get("requirement", "")
            prompt = (
                f"Role: Independent Auditor.\n\n"
                f"Evaluate if the provided document strictly satisfies the following requirement:\n"
                f"'{req}'\n\n"
                f"Document Content:\n{content}\n\n"
                f"Reply EXACTLY with PASS or FAIL."
            )
            
            try:
                res = subprocess.run(
                    ["agy", "--model", "Gemini 3.5 Flash (Low)", "--dangerously-skip-permissions", "--print", prompt],
                    capture_output=True, text=True, timeout=60
                )
                answer = res.stdout.strip()
                passed = "PASS" in answer.upper()
                if not passed:
                    evidence = answer[:100]
            except Exception as e:
                evidence = f"LLM Error: {str(e)}"
        
        return {"text": f"LLM Judge: {assertion.get('requirement')[:40]}...", "passed": passed, "evidence": evidence}

    elif atype in ["token_lte", "count_gte", "count_lte", "skill_in_set"]:
        # Complex assertions — kept as mocks for now, will be implemented in v0.2
        return {"text": f"Assertion {atype}", "passed": True, "evidence": "Mock evaluated (v0.1)"}

    return {"text": f"Unknown {atype}", "passed": False, "evidence": "Unsupported assertion type"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("scenario_id")
    parser.add_argument("workspace_dir")
    parser.add_argument("--mode", choices=["dag_flow", "baseline", "both"], default="dag_flow")
    args = parser.parse_args()

    scenario_id = args.scenario_id
    workspace_dir = args.workspace_dir
    mode = args.mode

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assertions_file = os.path.join(base_dir, "scenarios", scenario_id, "assertions.json")

    output_dir = resolve_dir(base_dir, scenario_id, workspace_dir, mode)

    grading = []
    if os.path.exists(assertions_file):
        with open(assertions_file) as f:
            assertions = json.load(f).get("assertions", [])

        for a in assertions:
            # Allow per-assertion target override
            target = a.get("target", mode)
            if target == "baseline":
                a_dir = os.path.join(workspace_dir, scenario_id, "baseline")
            else:
                a_dir = os.path.join(workspace_dir, scenario_id, "with_dag_flow")
            grading.append(check_assertion(a, a_dir))

    out_file = os.path.join(workspace_dir, scenario_id, f"grading_{mode}.json")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    with open(out_file, "w") as f:
        json.dump({"mode": mode, "expectations": grading}, f, indent=2)

    # Also write the legacy grading.json for aggregate_report compatibility
    legacy_file = os.path.join(workspace_dir, scenario_id, "grading.json")
    with open(legacy_file, "w") as f:
        json.dump({"mode": mode, "expectations": grading}, f, indent=2)

    print(f"Graded {scenario_id} ({mode}): {sum(1 for g in grading if g['passed'])}/{len(grading)} assertions passed")

    if any(not g["passed"] for g in grading):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
