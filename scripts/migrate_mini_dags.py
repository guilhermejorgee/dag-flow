import json
import os
import glob

def process_file(md_path):
    with open(md_path, 'r') as f:
        lines = f.readlines()
    
    tasks = []
    for line in lines:
        if line.startswith('| T'):
            parts = [p.strip() for p in line.split('|')[1:-1]]
            tid = parts[0]
            desc = parts[1]
            deps = []
            if parts[2] != 'None':
                deps = [d.strip() for d in parts[2].split(',')]
            
            tasks.append({
                "id": tid,
                "description": desc,
                "dependencies": deps,
                "status": "pending"
            })
    
    json_path = md_path[:-3] + '.json'
    with open(json_path, 'w') as f:
        json.dump(tasks, f, indent=2)
    os.remove(md_path)
    print(f"Migrated {md_path} to {json_path}")

for f in glob.glob("docs/benchmarks/data/e2e-v0.2.0/scenarios/*/with_dag_flow/.specs/dags/*.md"):
    process_file(f)

