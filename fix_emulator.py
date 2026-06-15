import re

with open("docs/benchmarks/data/e2e-v0.2.0/harness/run_escalation_session.py", "r") as f:
    code = f.read()

replacement = """                                words = line.split()
                                dag_arg = None
                                for w in words:
                                    if w.endswith(".json"):
                                        if "specs/dags" in w:
                                            dag_arg = w
                                        else:
                                            dag_arg = ".specs/dags/" + w.split("/")[-1]
                                        break
                                
                                import glob
                                if not dag_arg:
                                    dags = glob.glob(f"{workspace_dir}/.specs/dags/*.json")
                                    if dags:
                                        dag_arg = ".specs/dags/" + dags[0].split("/")[-1]
                                    else:
                                        dag_arg = ".specs/dags/s1-escalation.json"

"""

code = re.sub(r'                                words = line\.split\(\)\n                                dag_arg = "\.specs/dags/s1-escalation\.json"\n                                for w in words:\n                                    if w\.endswith\("\.json"\) and "specs/dags" in w:\n                                        dag_arg = w\n                                        break\n', replacement, code)

with open("docs/benchmarks/data/e2e-v0.2.0/harness/run_escalation_session.py", "w") as f:
    f.write(code)
