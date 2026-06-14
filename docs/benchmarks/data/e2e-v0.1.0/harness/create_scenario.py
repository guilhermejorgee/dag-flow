#!/usr/bin/env python3
import os
import json

def prompt(text, default=""):
    if default:
        val = input(f"{text} [{default}]: ").strip()
    else:
        val = input(f"{text}: ").strip()
    return val if val else default

def main():
    print("=== Create E2E Benchmark Scenario ===")
    
    scenario_id = ""
    while not scenario_id:
        scenario_id = prompt("Scenario ID (e.g., s7-new-feature)")
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scenario_dir = os.path.join(base_dir, "scenarios", scenario_id)
    
    if os.path.exists(scenario_dir):
        print(f"Error: Scenario {scenario_id} already exists at {scenario_dir}")
        return
        
    target_state = prompt("Target state (fresh/brownfield)", "fresh")
    target_app = prompt("Target app", "taskflow-api")
    depends_on = ""
    if target_state != "fresh" and target_state != "brownfield":
        depends_on = prompt("Depends on which previous scenario? (e.g., s1-auth-jwt)", "")
        
    dag_flow_prompt = prompt("dag-flow Agent Prompt")
    baseline_prompt = prompt("Baseline Agent Prompt", dag_flow_prompt)
    
    persona = prompt("User Persona", "a backend developer building a REST API")
    answering_style = prompt("Answering Style", "Short and decisive.")
    
    scenario_json = {
        "scenario_id": scenario_id,
        "target_state": target_state,
        "target": target_app
    }
    
    if depends_on:
        scenario_json["depends_on"] = depends_on
        
    scenario_json.update({
        "dag_flow_prompt": dag_flow_prompt,
        "baseline_prompt": baseline_prompt,
        "user_context": {
            "persona": persona,
            "feature_requirements": {
                "example_requirement": "value"
            },
            "answering_style": answering_style
        },
        "expected_artifacts": [],
        "phases_exercised": ["discovery", "specify", "design", "implement", "audit"],
        "adr0003_check": True
    })
    
    assertions_json = [
        {
            "id": "example-assertion",
            "type": "glob_exists",
            "file_pattern": "src/**/*.js",
            "description": "Example assertion checking if JS files exist"
        }
    ]
    
    os.makedirs(scenario_dir, exist_ok=True)
    
    with open(os.path.join(scenario_dir, "scenario.json"), "w") as f:
        json.dump(scenario_json, f, indent=2)
        
    with open(os.path.join(scenario_dir, "assertions.json"), "w") as f:
        json.dump(assertions_json, f, indent=2)
        
    print(f"\n✅ Scenario {scenario_id} created successfully!")
    print(f"Directory: {scenario_dir}")
    print("Don't forget to update 'feature_requirements', 'expected_artifacts', and assertions.json!")

if __name__ == "__main__":
    main()
