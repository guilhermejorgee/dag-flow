#!/usr/bin/env python3
import sys
import json
import os

def check_dag_coherence(dag_path):
    try:
        with open(dag_path, 'r', encoding='utf-8') as f:
            tasks = json.load(f)
    except Exception as e:
        print(f"❌ Error reading DAG: {e}")
        sys.exit(1)

    if not isinstance(tasks, list):
        print("❌ Error: DAG must be a JSON array.")
        sys.exit(1)

    required_fields = {
        'id': str,
        'description': str,
        'context_ref': str,
        'skill': str,
        'dependencies': list,
        'input_files': list,
        'output_files': list,
        'cognitive_rationale': str,
        'done_when_gate': str
    }

    errors = []
    task_map = {}

    # Initial Pass: Schema validation and map building
    for i, task in enumerate(tasks):
        if not isinstance(task, dict):
            errors.append(f"Task at index {i} is not a JSON object.")
            continue
            
        task_id = task.get('id', f"Unknown-{i}")
        
        for field, f_type in required_fields.items():
            if field not in task:
                errors.append(f"Task {task_id}: Missing required field '{field}'.")
            elif not isinstance(task[field], f_type):
                errors.append(f"Task {task_id}: Field '{field}' must be of type {f_type.__name__}.")
                
        if task_id in task_map:
            errors.append(f"Duplicate Task ID: {task_id}")
            
        task_map[task_id] = task

    if errors:
        print("❌ DAG Schema Validation Failed:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    # helper: get all outputs of a task and its dependencies transitively
    def get_prior_outputs(task_id, visited=None):
        if visited is None:
            visited = set()
        if task_id in visited:
            return set()
        visited.add(task_id)
        
        task = task_map.get(task_id)
        if not task:
            return set()
            
        outputs = set(task.get('output_files', []))
        for dep in task.get('dependencies', []):
            outputs.update(get_prior_outputs(dep, visited))
        return outputs

    # Coherence Passes
    for task in tasks:
        task_id = task['id']
        inputs = set(task['input_files'])
        outputs = set(task['output_files'])
        deps = task['dependencies']
        
        # 1. Input/Output Coherence Check
        for out_file in outputs:
            if os.path.exists(out_file) and os.path.isfile(out_file):
                if out_file not in inputs:
                    errors.append(f"Task {task_id}: Output file '{out_file}' already exists on disk but is not listed in input_files. Modification requires reading.")
                    
        # 2. Reverse Coherence Check
        prior_outputs = set()
        for dep in deps:
            if dep not in task_map:
                errors.append(f"Task {task_id}: Dependency '{dep}' not found in DAG.")
            else:
                prior_outputs.update(get_prior_outputs(dep))
                
        for in_file in inputs:
            if not os.path.exists(in_file):
                if in_file not in prior_outputs:
                    errors.append(f"Task {task_id}: Input file '{in_file}' does not exist on disk and is not produced by any dependency.")
                    
    if errors:
        print("❌ DAG Coherence Validation Failed:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("✅ DAG Coherence Validation Passed.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: validate_dag_coherence.py <dag.json>")
        sys.exit(1)
    check_dag_coherence(sys.argv[1])
