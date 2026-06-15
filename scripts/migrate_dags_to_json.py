#!/usr/bin/env python3
import os
import glob
import re
import json

def parse_markdown_table(filepath):
    tasks = []
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in lines:
        if re.match(r'^\|\s*T[0-9A-Za-z-]*\s*\|', line):
            parts = [p.strip() for p in line.split('|')[1:-1]]
            if len(parts) >= 9:
                t_id, desc, context_ref, skill, deps, inputs, outputs, gate, status = parts[:9]
                
                dep_list = [d.strip() for d in deps.split(',')] if deps and deps != 'None' else []
                
                def parse_files(f_str):
                    if not f_str or f_str == 'None' or f_str == 'N/A':
                        return []
                    cleaned = f_str.replace('`', '')
                    return [s.strip() for s in cleaned.split(',') if s.strip()]
                
                in_files = parse_files(inputs)
                out_files = parse_files(outputs)
                
                tasks.append({
                    "id": t_id,
                    "description": desc,
                    "context_ref": context_ref,
                    "skill": skill,
                    "dependencies": dep_list,
                    "input_files": in_files,
                    "output_files": out_files,
                    "cognitive_rationale": "Legacy DAG migration. Pre-JSON rationale not recorded.",
                    "done_when_gate": gate.replace('`', ''),
                    "status": status
                })
    return tasks

def main():
    dags_dir = os.path.join(".specs", "dags")
    if not os.path.exists(dags_dir):
        print(f"Directory {dags_dir} does not exist. Skipping.")
        return

    md_files = glob.glob(os.path.join(dags_dir, "*.md"))
    
    if not md_files:
        print("No .md DAGs found to migrate.")
        return
        
    os.system(f"chmod 755 {dags_dir}")
    
    try:
        for md_file in md_files:
            print(f"Migrating {md_file}...")
            tasks = parse_markdown_table(md_file)
            
            if not tasks:
                print(f"Warning: No valid tasks parsed from {md_file}. Skipping.")
                continue
                
            json_path = md_file[:-3] + ".json"
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(tasks, f, indent=2)
                
            os.remove(md_file)
            print(f"✅ Converted to {json_path} and removed legacy file.")
    finally:
        os.system(f"chmod 555 {dags_dir}")

if __name__ == "__main__":
    main()
