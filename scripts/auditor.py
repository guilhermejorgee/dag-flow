#!/usr/bin/env python3
import sys
import json
import subprocess
import os

def run_auditor(task_id, dag_file):
    print(f"Initializing Independent Auditor for Task: {task_id}")
    
    if not os.path.exists(dag_file):
        print(f"❌ Auditor Error: Could not find DAG file {dag_file}")
        sys.exit(1)
        
    with open(dag_file, 'r', encoding='utf-8') as f:
        tasks = json.load(f)
        
    target_task = None
    for t in tasks:
        if t.get('id') == task_id:
            target_task = t
            break
            
    if not target_task:
        print(f"❌ Auditor Error: Could not find Task {task_id} in {dag_file}.")
        sys.exit(1)
        
    gate_command = target_task.get('done_when_gate', '').strip()
    if not gate_command:
        print(f"❌ Auditor Error: Could not find 'Done When' gate command for {task_id}.")
        sys.exit(1)
        
    print(f"Running Execution Gate: {gate_command}")
    
    # Ensure ~/.local/bin is in PATH so rtk can be found
    env = os.environ.copy()
    local_bin = os.path.expanduser("~/.local/bin")
    if os.path.exists(local_bin) and local_bin not in env.get("PATH", "").split(os.path.pathsep):
        env["PATH"] = local_bin + os.path.pathsep + env.get("PATH", "")

    if gate_command.startswith("! "):
        cmd = f"! rtk {gate_command[2:]}"
    else:
        cmd = f"rtk {gate_command}"
    
    try:
        result = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
        exit_code = result.returncode
        eval_output = result.stdout
    except Exception as e:
        eval_output = str(e)
        exit_code = 1
        
    if exit_code == 0 and "PASS" in eval_output:
        print("✅ Tests Passed.")
        print(f"Update dag.json -> {task_id} Status: 🟢 Done")
        sys.exit(0)
    elif exit_code == 0:
        print("❌ Execution Gate Failed: exit 0 but stdout missing PASS (D6 contract)")
        print("--- Test Output ---")
        print(eval_output)
        print("-------------------")
        sys.exit(1)
    else:
        print(f"❌ Execution Gate Failed (Exit Code: {exit_code})")
        print("--- Test Output ---")
        print(eval_output)
        print("-------------------")
        print("Triggering Backprop Reflex. Task remains 🔴 Pending.")
        print("Provide this log to the Worker Subagent for the next iteration.")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: auditor.py <task_id> <dag_file>")
        sys.exit(1)
        
    run_auditor(sys.argv[1], sys.argv[2])
