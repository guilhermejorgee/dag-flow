import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import auditor


class TestAuditorPassContract(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.dag_file = os.path.join(self.temp_dir, "dag.json")
        with open(self.dag_file, "w", encoding="utf-8") as f:
            json.dump(
                [{"id": "T1", "done_when_gate": "echo PASS", "status": "Pending"}],
                f,
            )

    def tearDown(self):
        import shutil

        shutil.rmtree(self.temp_dir)

    @patch("auditor.subprocess.run")
    def test_exit_zero_with_pass_succeeds(self, mock_run):
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "PASS\n"

        with self.assertRaises(SystemExit) as ctx:
            auditor.run_auditor("T1", self.dag_file)
        self.assertEqual(ctx.exception.code, 0)

    @patch("auditor.subprocess.run")
    def test_exit_zero_without_pass_fails(self, mock_run):
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "ok\n"

        with self.assertRaises(SystemExit) as ctx:
            auditor.run_auditor("T1", self.dag_file)
        self.assertEqual(ctx.exception.code, 1)

    @patch("auditor.subprocess.run")
    def test_exit_zero_with_lowercase_pass_fails(self, mock_run):
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "pass\n"

        with self.assertRaises(SystemExit) as ctx:
            auditor.run_auditor("T1", self.dag_file)
        self.assertEqual(ctx.exception.code, 1)

    @patch("auditor.subprocess.run")
    def test_exit_nonzero_fails(self, mock_run):
        mock_run.return_value.returncode = 1
        mock_run.return_value.stdout = "FAIL\n"

        with self.assertRaises(SystemExit) as ctx:
            auditor.run_auditor("T1", self.dag_file)
        self.assertEqual(ctx.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
