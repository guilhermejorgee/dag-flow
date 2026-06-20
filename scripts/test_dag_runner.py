import unittest
import os
import json
import tempfile
import asyncio
import stat
from unittest.mock import patch, AsyncMock

import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import dag_runner
import update_task_status

_REAL_SUBPROCESS_EXEC = dag_runner.asyncio.create_subprocess_exec


def _pending_task(task_id="T1"):
    return {
        "id": task_id,
        "description": "Task 1",
        "context_ref": "Ref",
        "skill": "None",
        "dependencies": [],
        "input_files": [],
        "output_files": [],
        "done_when_gate": "gate",
        "status": "Pending",
    }


class TestDagRunner(unittest.TestCase):
    def setUp(self):
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.config_path = os.path.join(self.script_dir, "dag-config.json")
        self.config_backup = None
        if os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config_backup = f.read()
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "_meta": {"worker": "agy", "schema_version": 1},
                    "worker": {
                        "command_template": [
                            "agy",
                            "--dangerously-skip-permissions",
                            "--prompt",
                            "<<<PROMPT>>>",
                        ]
                    },
                },
                f,
            )

        self.temp_file = tempfile.NamedTemporaryFile(
            mode="w+", delete=False, suffix=".json", encoding="utf-8"
        )
        json.dump(
            [
                {
                    "id": "T1",
                    "description": "Task 1",
                    "context_ref": "Ref 1",
                    "skill": "None",
                    "dependencies": [],
                    "input_files": ["in1"],
                    "output_files": ["out1"],
                    "done_when_gate": "gate1",
                    "status": "Pending",
                },
                {
                    "id": "T2",
                    "description": "Task 2",
                    "context_ref": "Ref 2",
                    "skill": "None",
                    "dependencies": ["T1"],
                    "input_files": ["in2"],
                    "output_files": ["out2"],
                    "done_when_gate": "gate2",
                    "status": "Pending",
                },
                {
                    "id": "T3",
                    "description": "Task 3",
                    "context_ref": "Ref 3",
                    "skill": "None",
                    "dependencies": ["T1"],
                    "input_files": ["in3"],
                    "output_files": ["out3"],
                    "done_when_gate": "gate3",
                    "status": "Pending",
                },
                {
                    "id": "T4",
                    "description": "Task 4",
                    "context_ref": "Ref 4",
                    "skill": "None",
                    "dependencies": ["T2", "T3"],
                    "input_files": ["in4"],
                    "output_files": ["out4"],
                    "done_when_gate": "gate4",
                    "status": "Pending",
                },
            ],
            self.temp_file,
        )
        self.temp_file.close()

        self.runner = dag_runner.DagRunner(self.temp_file.name)

    def tearDown(self):
        os.unlink(self.temp_file.name)
        if self.config_backup is not None:
            with open(self.config_path, "w", encoding="utf-8") as f:
                f.write(self.config_backup)
        elif os.path.exists(self.config_path):
            os.unlink(self.config_path)

    def _with_vault_fixture(self, callback):
        with tempfile.TemporaryDirectory() as tmp:
            cwd = os.getcwd()
            os.chdir(tmp)
            try:
                os.makedirs(".specs/dags", exist_ok=True)
                os.chmod(".specs/dags", stat.S_IRWXU | stat.S_IRGRP | stat.S_IROTH)
                vault_file = os.path.join(".specs", "dags", "feature.json")
                tasks = [_pending_task()]
                with open(vault_file, "w", encoding="utf-8") as f:
                    json.dump(tasks, f)
                os.chmod(
                    ".specs/dags",
                    stat.S_IRUSR
                    | stat.S_IXUSR
                    | stat.S_IRGRP
                    | stat.S_IXGRP
                    | stat.S_IROTH
                    | stat.S_IXOTH,
                )
                callback(vault_file, tasks)
            finally:
                os.chdir(cwd)

    def test_parse_tasks(self):
        self.runner.parse_tasks()

        self.assertEqual(len(self.runner.tasks), 4)
        self.assertEqual(self.runner.in_degree["T1"], 0)
        self.assertEqual(self.runner.in_degree["T2"], 1)
        self.assertEqual(self.runner.in_degree["T3"], 1)
        self.assertEqual(self.runner.in_degree["T4"], 2)
        self.assertIn("T2", self.runner.graph["T1"])
        self.assertIn("T3", self.runner.graph["T1"])
        self.assertIn("T4", self.runner.graph["T2"])
        self.assertIn("T4", self.runner.graph["T3"])

    def test_build_worker_cmd_replaces_prompt_placeholder(self):
        cmd = self.runner.build_worker_cmd("hello worker")
        self.assertEqual(cmd[-1], "hello worker")
        self.assertNotIn("<<<PROMPT>>>", cmd)

    def test_missing_dag_config_exits(self):
        os.unlink(self.config_path)
        with self.assertRaises(SystemExit) as ctx:
            dag_runner.DagRunner(self.temp_file.name)
        self.assertEqual(ctx.exception.code, 1)

    def test_missing_command_template_exits(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"worker": {}}, f)
        with self.assertRaises(SystemExit) as ctx:
            dag_runner.DagRunner(self.temp_file.name)
        self.assertEqual(ctx.exception.code, 1)

    def test_empty_command_template_exits(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"worker": {"command_template": []}}, f)
        with self.assertRaises(SystemExit) as ctx:
            dag_runner.DagRunner(self.temp_file.name)
        self.assertEqual(ctx.exception.code, 1)

    @patch("dag_runner.DagRunner.run_task", new_callable=AsyncMock)
    def test_execute_dag_topological_order(self, mock_run_task):
        mock_run_task.return_value = True

        self.runner.parse_tasks()
        asyncio.run(self.runner.execute_dag())

        self.assertEqual(len(self.runner.completed), 4)
        self.assertEqual(mock_run_task.call_count, 4)

    @patch("dag_runner.asyncio.create_subprocess_exec", new_callable=AsyncMock)
    def test_worker_spawn_sets_dag_flow_worker_env(self, mock_exec):
        mock_proc = AsyncMock()
        mock_proc.wait = AsyncMock(return_value=0)
        mock_proc.communicate = AsyncMock(return_value=(b"PASS\n", None))
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc

        task = dag_runner.Task(
            "T1", "desc", "ref", "None", [], [], [], "echo PASS", "Pending"
        )

        with patch.object(self.runner, "update_status", new_callable=AsyncMock) as mock_update:
            asyncio.run(self.runner.run_task(task))
            worker_calls = [
                c
                for c in mock_exec.call_args_list
                if c.kwargs.get("env", {}).get("DAG_FLOW_WORKER") == "1"
            ]
            self.assertEqual(len(worker_calls), 1)
            auditor_calls = [
                c for c in mock_exec.call_args_list if "env" not in c.kwargs
            ]
            self.assertGreaterEqual(len(auditor_calls), 1)
            mock_update.assert_called_with("T1", "Done")

    def test_runner_update_status_syncs_vault_and_runs(self):
        def exercise(vault_file, _tasks):
            runner = dag_runner.DagRunner(vault_file)
            asyncio.run(runner.update_status("T1", "Done"))

            with open(vault_file, "r", encoding="utf-8") as f:
                vault_tasks = json.load(f)
            with open(runner.tasks_file, "r", encoding="utf-8") as f:
                runs_tasks = json.load(f)

            self.assertEqual(vault_tasks[0]["status"], "Done")
            self.assertEqual(runs_tasks[0]["status"], "Done")
            mode = os.stat(".specs/dags").st_mode & 0o777
            self.assertEqual(mode, 0o555)

        self._with_vault_fixture(exercise)

    @patch("dag_runner.asyncio.create_subprocess_exec", new_callable=AsyncMock)
    def test_update_status_skips_duplicate_when_same_file(self, mock_exec):
        mock_proc = AsyncMock()
        mock_proc.communicate = AsyncMock(return_value=(b"ok\n", None))
        mock_proc.returncode = 0
        mock_exec.return_value = mock_proc

        runner = dag_runner.DagRunner(self.temp_file.name)
        runner.vault_file = runner.tasks_file
        asyncio.run(runner.update_status("T1", "Done"))

        self.assertEqual(mock_exec.call_count, 1)

    @patch("dag_runner.asyncio.create_subprocess_exec", new_callable=AsyncMock)
    def test_run_task_failed_updates_vault(self, mock_exec):
        def make_proc(returncode=0, stdout=b""):
            proc = AsyncMock()
            proc.wait = AsyncMock(return_value=0)
            proc.communicate = AsyncMock(return_value=(stdout, None))
            proc.returncode = returncode
            return proc

        async def exec_side_effect(*args, **kwargs):
            cmd = [str(arg) for arg in args]
            if any("update_task_status.py" in part for part in cmd):
                return await _REAL_SUBPROCESS_EXEC(*args, **kwargs)
            if any("auditor.py" in part for part in cmd):
                return make_proc(1, b"FAIL\n")
            return make_proc(0)

        mock_exec.side_effect = exec_side_effect

        def exercise(vault_file, _tasks):
            runner = dag_runner.DagRunner(vault_file)
            task = dag_runner.Task(
                "T1", "desc", "ref", "None", [], [], [], "echo PASS", "Pending"
            )
            asyncio.run(runner.run_task(task))

            with open(vault_file, "r", encoding="utf-8") as f:
                vault_tasks = json.load(f)
            with open(runner.tasks_file, "r", encoding="utf-8") as f:
                runs_tasks = json.load(f)

            self.assertEqual(vault_tasks[0]["status"], "Failed")
            self.assertEqual(runs_tasks[0]["status"], "Failed")
            self.assertEqual(task.attempts, 3)
            update_calls = [
                call
                for call in mock_exec.call_args_list
                if any("update_task_status.py" in str(arg) for arg in call.args)
            ]
            self.assertEqual(len(update_calls), 2)

        self._with_vault_fixture(exercise)

    def test_runner_update_status_writes_failed_to_vault(self):
        def exercise(vault_file, _tasks):
            runner = dag_runner.DagRunner(vault_file)
            asyncio.run(runner.update_status("T1", "Failed"))

            with open(vault_file, "r", encoding="utf-8") as f:
                vault_tasks = json.load(f)
            with open(runner.tasks_file, "r", encoding="utf-8") as f:
                runs_tasks = json.load(f)

            self.assertEqual(vault_tasks[0]["status"], "Failed")
            self.assertEqual(runs_tasks[0]["status"], "Failed")

        self._with_vault_fixture(exercise)

    def test_vault_status_sync(self):
        def exercise(vault_file, tasks):
            runs_dir = os.path.join(".specs", "runs", "feature")
            os.makedirs(runs_dir, exist_ok=True)
            runs_file = os.path.join(runs_dir, "dag.json")
            with open(runs_file, "w", encoding="utf-8") as f:
                json.dump(tasks, f)

            update_task_status.update_status(vault_file, "T1", "Done")
            update_task_status.update_status(runs_file, "T1", "Done")

            with open(vault_file, "r", encoding="utf-8") as f:
                vault_tasks = json.load(f)
            with open(runs_file, "r", encoding="utf-8") as f:
                runs_tasks = json.load(f)

            self.assertEqual(vault_tasks[0]["status"], "Done")
            self.assertEqual(runs_tasks[0]["status"], "Done")
            mode = os.stat(".specs/dags").st_mode & 0o777
            self.assertEqual(mode, 0o555)

        self._with_vault_fixture(exercise)


if __name__ == "__main__":
    unittest.main()
