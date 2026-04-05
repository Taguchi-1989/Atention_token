"""Tests for TaskLoader."""
import os
import tempfile
import textwrap
import pytest
from attention_ledger.core.task.loader import TaskLoader
from attention_ledger.core.task.model import TaskScenario


VALID_YAML = textwrap.dedent("""\
    task_id: TEST_TASK_001
    description: A simple test task
    start_condition: home_loaded
    goal_condition: form_submitted
    input_data:
      name: Alice
      amount: 500
""")


def test_load_from_file_valid(tmp_path):
    task_file = tmp_path / "task.yaml"
    task_file.write_text(VALID_YAML, encoding="utf-8")

    task = TaskLoader.load_from_file(str(task_file))

    assert isinstance(task, TaskScenario)
    assert task.task_id == "TEST_TASK_001"
    assert task.description == "A simple test task"
    assert task.input_data["amount"] == 500


def test_load_from_file_not_found():
    with pytest.raises(FileNotFoundError):
        TaskLoader.load_from_file("/nonexistent/path/task.yaml")


def test_load_all_from_dir(tmp_path):
    (tmp_path / "t1.yaml").write_text(VALID_YAML, encoding="utf-8")
    yaml2 = VALID_YAML.replace("TEST_TASK_001", "TEST_TASK_002")
    (tmp_path / "t2.yaml").write_text(yaml2, encoding="utf-8")

    tasks = TaskLoader.load_all_from_dir(str(tmp_path))

    assert len(tasks) == 2
    ids = {t.task_id for t in tasks}
    assert ids == {"TEST_TASK_001", "TEST_TASK_002"}


def test_load_all_from_dir_not_found():
    with pytest.raises(ValueError, match="Directory not found"):
        TaskLoader.load_all_from_dir("/nonexistent/dir")


def test_load_all_skips_bad_yaml(tmp_path):
    (tmp_path / "good.yaml").write_text(VALID_YAML, encoding="utf-8")
    (tmp_path / "bad.yaml").write_text("not: valid: yaml: [[[", encoding="utf-8")

    # Should not raise; bad file is skipped with a warning
    tasks = TaskLoader.load_all_from_dir(str(tmp_path))
    assert len(tasks) == 1
    assert tasks[0].task_id == "TEST_TASK_001"
