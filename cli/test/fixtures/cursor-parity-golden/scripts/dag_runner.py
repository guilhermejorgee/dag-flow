import sys
import os
import json
import asyncio
import shutil
import re
from collections import defaultdict

MAX_WORKERS = int(os.environ.get("DAG_FLOW_MAX_WORKERS", "3"))

class Task:
    def __init__(self, id, desc, context_ref, skill, deps, inputs, outputs, gate, status):
        self.id = id
        self.desc = desc
        self.context_ref = context_ref
        self.skill = skill
        self.deps = deps if isinstance(deps, list) else []
        self.inputs = inputs if isinstance(inputs, list) else []
        self.outputs = outputs if isinstance(outputs, list) else []
        self.gate = gate
        self.status = status
        
        self.attempts = 0
        self.max_attempts = 3
        self.last_error = ""

class DagRunner:
    def __init__(self, vault_file):
        self.vault_file = vault_file
        self.run_id = os.path.splitext(os.path.basename(self.vault_file))[0]
        self.run_dir = os.path.join(".specs", "runs", self.run_id)
        self.tasks_file = os.path.join(self.run_dir, "dag.json")
        self.log_dir = os.path.join(self.run_dir, "logs")
        
        os.makedirs(self.run_dir, exist_ok=True)
        os.makedirs(self.log_dir, exist_ok=True)
        
        if not os.path.exists(self.tasks_file):
            shutil.copy2(self.vault_file, self.tasks_file)
            
        self.tasks = {}
        self.graph = defaultdict(list)
        self.in_degree = defaultdict(int)
        self.completed = set()
        self.failed = set()
        self.cancel_event = asyncio.Event()
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.command_template = self._load_worker_config()

    def _load_worker_config(self):
        config_path = os.path.join(self.script_dir, "dag-config.json")
        if not os.path.exists(config_path):
            print(f"❌ Error: dag-config.json not found at {config_path}")
            sys.exit(1)
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        template = config.get("worker", {}).get("command_template")
        if not template:
            print("❌ Error: worker.command_template missing in dag-config.json")
            sys.exit(1)
        return template

    def build_worker_cmd(self, prompt):
        return [
            arg.replace("<<<PROMPT>>>", prompt) if "<<<PROMPT>>>" in arg else arg
            for arg in self.command_template
        ]

    def parse_tasks(self):
        with open(self.tasks_file, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            
        if content.startswith('['):
            tasks_data = json.loads(content)
        else:
            tasks_data = []
            lines = content.split('\n')
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
                        
                        tasks_data.append({
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
            
        for t_data in tasks_data:
            status = t_data.get('status', 'Pending')
            task = Task(
                id=t_data['id'],
                desc=t_data['description'],
                context_ref=t_data['context_ref'],
                skill=t_data['skill'],
                deps=t_data['dependencies'],
                inputs=t_data['input_files'],
                outputs=t_data['output_files'],
                gate=t_data['done_when_gate'],
                status=status
            )
            if "Done" not in task.status:
                self.tasks[task.id] = task
                        
        for t_id, task in self.tasks.items():
            actual_deps = [d for d in task.deps if d in self.tasks]
            self.in_degree[t_id] = len(actual_deps)
            for dep in actual_deps:
                self.graph[dep].append(t_id)

    async def update_status(self, task_id, status):
        updater = os.path.join(self.script_dir, "update_task_status.py")
        targets = [self.tasks_file]
        if os.path.abspath(self.vault_file) != os.path.abspath(self.tasks_file):
            targets.append(self.vault_file)
        for dag_file in targets:
            cmd = [sys.executable, updater, dag_file, task_id, status]
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
            )
            stdout, _ = await proc.communicate()
            if proc.returncode != 0:
                print(
                    f"❌ Error updating status for {task_id} to {status} in {dag_file}: "
                    f"{stdout.decode('utf-8')}"
                )

    async def run_task(self, task):
        log_path = os.path.join(self.log_dir, f"{task.id}.log")
        
        while task.attempts < task.max_attempts:
            if self.cancel_event.is_set():
                return False
                
            task.attempts += 1
            print(f"[ {task.id}: Attempt {task.attempts}/{task.max_attempts} Running ]")
            
            inputs_str = ", ".join(task.inputs) if task.inputs else "None"
            outputs_str = ", ".join(task.outputs) if task.outputs else "None"
            
            prompt = f"Execute SDD Task {task.id}. Role: Stateless Worker. Reason: {task.context_ref}. Context: {inputs_str}. Edit: {outputs_str}. Goal: {task.desc}. Do not run tests. Do not update tasks.md."
            if task.skill and task.skill != "None":
                prompt += f" Load the skill '{task.skill}' using read_skill from the dag-flow-skills MCP before starting your edit."
            if task.last_error:
                prompt += f" The previous attempt failed. Fix this error: {task.last_error}"

            with open(log_path, 'a', encoding='utf-8') as log_f:
                log_f.write(f"\n--- Attempt {task.attempts} ---\n")
                
                worker_cmd = self.build_worker_cmd(prompt)
                worker_env = os.environ.copy()
                worker_env["DAG_FLOW_WORKER"] = "1"
                worker = await asyncio.create_subprocess_exec(
                    *worker_cmd,
                    stdout=log_f,
                    stderr=asyncio.subprocess.STDOUT,
                    env=worker_env,
                )
                await worker.wait()

                auditor_cmd = [sys.executable, os.path.join(self.script_dir, "auditor.py"), task.id, self.tasks_file]
                auditor = await asyncio.create_subprocess_exec(
                    *auditor_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT
                )
                stdout, _ = await auditor.communicate()
                out_str = stdout.decode('utf-8')
                log_f.write(f"\n--- Auditor Output ---\n{out_str}\n")
                
                if auditor.returncode == 0:
                    print(f"[ {task.id}: ✅ Done ]")
                    await self.update_status(task.id, "Done")
                    return True
                else:
                    task.last_error = out_str
                    print(f"[ {task.id}: ❌ Failed Attempt {task.attempts} ]")

        print(f"[ {task.id}: 🚨 FAILED completely. Triggering Drain-running. Check logs/{task.id}.log ]")
        await self.update_status(task.id, "Failed")
        self.cancel_event.set()
        return False

    async def execute_dag(self):
        self.parse_tasks()
        
        queue = asyncio.Queue()
        for t_id, degree in self.in_degree.items():
            if degree == 0:
                await queue.put(t_id)
                
        running_tasks = set()
        
        async def worker():
            while True:
                t_id = await queue.get()
                if self.cancel_event.is_set():
                    queue.task_done()
                    continue
                    
                task = self.tasks[t_id]
                task_future = asyncio.create_task(self.run_task(task))
                running_tasks.add(task_future)
                
                success = await task_future
                running_tasks.remove(task_future)
                
                if success:
                    self.completed.add(t_id)
                    for neighbor in self.graph[t_id]:
                        self.in_degree[neighbor] -= 1
                        if self.in_degree[neighbor] == 0:
                            await queue.put(neighbor)
                else:
                    self.failed.add(t_id)
                    
                queue.task_done()

        worker_tasks = [asyncio.create_task(worker()) for _ in range(MAX_WORKERS)]
        
        while not queue.empty() or running_tasks:
            if self.cancel_event.is_set():
                break
            await asyncio.sleep(1)
            
        if self.cancel_event.is_set():
            print("🚨 Drain-running: Waiting for executing tasks to finish...")
            if running_tasks:
                await asyncio.gather(*running_tasks)
            print("❌ DAG execution aborted due to failures.")
            for w in worker_tasks:
                w.cancel()
            sys.exit(1)
        elif len(self.completed) < len(self.tasks):
            print(f"❌ DAG execution stopped. Unresolved dependencies or cycles detected. Completed: {len(self.completed)}/{len(self.tasks)}")
            for w in worker_tasks:
                w.cancel()
            sys.exit(1)
        else:
            print("🎉 All tasks executed successfully!")
            
        for w in worker_tasks:
            w.cancel()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 dag_runner.py <tasks_file>")
        sys.exit(1)
        
    runner = DagRunner(sys.argv[1])
    asyncio.run(runner.execute_dag())
