import unittest
import os
import tempfile
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

# Add scripts directory to path to import dag_runner
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import dag_runner

class TestDagRunner(unittest.TestCase):
    def setUp(self):
        # Create a temporary tasks.md file
        self.temp_file = tempfile.NamedTemporaryFile(mode='w+', delete=False, encoding='utf-8')
        mock_dag = """
| ID | Description | Context Ref | Skill | Depends On | Input Files | Output Files | Done When (Gate) | Status |
|---|---|---|---|---|---|---|---|---|
| T1 | Task 1 | Ref 1 | None | None | `in1` | `out1` | `gate1` | Pending |
| T2 | Task 2 | Ref 2 | None | T1 | `in2` | `out2` | `gate2` | Pending |
| T3 | Task 3 | Ref 3 | None | T1 | `in3` | `out3` | `gate3` | Pending |
| T4 | Task 4 | Ref 4 | None | T2, T3 | `in4` | `out4` | `gate4` | Pending |
"""
        self.temp_file.write(mock_dag)
        self.temp_file.close()
        
        self.runner = dag_runner.DagRunner(self.temp_file.name)

    def tearDown(self):
        os.unlink(self.temp_file.name)

    def test_parse_tasks(self):
        self.runner.parse_tasks()
        
        # Verify tasks are parsed
        self.assertEqual(len(self.runner.tasks), 4)
        
        # Verify in-degrees (dependencies count)
        self.assertEqual(self.runner.in_degree["T1"], 0)
        self.assertEqual(self.runner.in_degree["T2"], 1)
        self.assertEqual(self.runner.in_degree["T3"], 1)
        self.assertEqual(self.runner.in_degree["T4"], 2)
        
        # Verify directed graph mapping (who depends on me)
        self.assertIn("T2", self.runner.graph["T1"])
        self.assertIn("T3", self.runner.graph["T1"])
        self.assertIn("T4", self.runner.graph["T2"])
        self.assertIn("T4", self.runner.graph["T3"])

    @patch('dag_runner.DagRunner.run_task', new_callable=AsyncMock)
    def test_execute_dag_topological_order(self, mock_run_task):
        # Mock run_task to immediately return True (success)
        mock_run_task.return_value = True
        
        self.runner.parse_tasks()
        
        # Execute the DAG synchronously for the test
        asyncio.run(self.runner.execute_dag())
        
        # Verify all tasks were processed
        self.assertEqual(len(self.runner.completed), 4)
        
        # Verify run_task was called 4 times
        self.assertEqual(mock_run_task.call_count, 4)

if __name__ == '__main__':
    unittest.main()
