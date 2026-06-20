#!/usr/bin/env python3
import sys
import json
import os
import fcntl

def update_status(dag_file, task_id, status):
    if not os.path.exists(dag_file):
        print(f"❌ Error: Could not find DAG file {dag_file}")
        sys.exit(1)
        
    # We use file locking to prevent race conditions when multiple workers
    # try to update their status simultaneously.
    with open(dag_file, 'r+', encoding='utf-8') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        tasks = json.load(f)
        
        updated = False
        for task in tasks:
            if task.get('id') == task_id:
                task['status'] = status
                updated = True
                break
                
        if not updated:
            print(f"❌ Error: Task {task_id} not found in {dag_file}")
            sys.exit(1)
            
        f.seek(0)
        f.truncate()
        json.dump(tasks, f, indent=2)
        fcntl.flock(f, fcntl.LOCK_UN)
        
    print(f"✅ Task {task_id} updated to '{status}' in {dag_file}")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: update_task_status.py <dag_file> <task_id> <status>")
        sys.exit(1)
    update_status(sys.argv[1], sys.argv[2], sys.argv[3])
