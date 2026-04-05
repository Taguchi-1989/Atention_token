"""API endpoint tests using FastAPI TestClient."""

import os
import tempfile
import pytest
from fastapi.testclient import TestClient

# Set test DB path before importing app
_test_db = tempfile.mktemp(suffix=".db")
os.environ["ATTENTION_LEDGER_DB_PATH"] = _test_db

from attention_ledger.api.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_db():
    """Ensure clean DB for each test."""
    yield
    # DB is reused within tests in order, cleaned after all tests
    pass


class TestHealth:
    def test_health(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


class TestTasks:
    def test_list_tasks(self):
        res = client.get("/tasks")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        # Should find at least the sample tasks
        assert len(data) >= 1
        assert "task_id" in data[0]
        assert "description" in data[0]

    def test_run_task_not_found(self):
        res = client.post(
            "/tasks/nonexistent_task/run",
            json={"baseline_id": "BL-TEST", "mock": True},
        )
        assert res.status_code == 404

    def test_task_status_empty(self):
        res = client.get("/tasks/some_task/status")
        assert res.status_code == 200
        assert res.json()["logs"] == []


class TestBaselines:
    def test_create_baseline(self):
        res = client.post("/baselines", json={
            "baseline_id": "BL-TEST-API",
            "model": "test-model",
            "engine": "mock",
            "temperature": 0.0,
        })
        assert res.status_code == 200
        data = res.json()
        assert data["baseline_id"] == "BL-TEST-API"
        assert data["model"] == "test-model"

    def test_list_baselines(self):
        res = client.get("/baselines")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        # Should contain the one we just created
        ids = [b["baseline_id"] for b in data]
        assert "BL-TEST-API" in ids

    def test_delete_baseline(self):
        res = client.delete("/baselines/BL-TEST-API")
        assert res.status_code == 200
        assert res.json()["status"] == "deleted"

    def test_delete_baseline_not_found(self):
        res = client.delete("/baselines/NONEXISTENT")
        assert res.status_code == 404


class TestRuns:
    def test_list_runs_empty(self):
        res = client.get("/runs")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_history_alias(self):
        res = client.get("/history")
        assert res.status_code == 200
        assert isinstance(res.json(), list)


class TestStats:
    def test_get_stats(self):
        res = client.get("/stats")
        assert res.status_code == 200
        data = res.json()
        assert "total_runs" in data
        assert "success_runs" in data
        assert "unique_tasks" in data
        assert "total_baselines" in data
        assert "total_tokens" in data


class TestConfig:
    def test_get_config(self):
        res = client.get("/config")
        assert res.status_code == 200
        data = res.json()
        assert "ollama_url" in data
        assert "model_name" in data
        assert "temperature" in data

    def test_update_config(self):
        res = client.put("/config", json={
            "ollama_url": "http://localhost:11434",
            "model_name": "test-model",
            "temperature": 0.5,
        })
        assert res.status_code == 200
        assert res.json()["config"]["model_name"] == "test-model"

        # Verify it persisted
        res2 = client.get("/config")
        assert res2.json()["model_name"] == "test-model"


class TestMetricsDiff:
    def test_diff_missing_data(self):
        res = client.get("/metrics/diff", params={
            "task_id": "nonexistent",
            "baseline_a": "A",
            "baseline_b": "B",
        })
        assert res.status_code == 404


class TestSus:
    def test_submit_sus_invalid_responses(self):
        res = client.post("/sus", json={
            "run_id": 1,
            "responses": [1, 2],  # Too few
        })
        assert res.status_code == 400

    def test_submit_sus_run_not_found(self):
        res = client.post("/sus", json={
            "run_id": 99999,
            "responses": [4, 2, 4, 2, 4, 2, 4, 2, 4, 2],
        })
        assert res.status_code == 404

    def test_submit_sus_missing_run_id(self):
        """Verify old task_id/baseline_id format is rejected."""
        res = client.post("/sus", json={
            "task_id": "test",
            "baseline_id": "BL-X",
            "responses": [4, 2, 4, 2, 4, 2, 4, 2, 4, 2],
        })
        assert res.status_code == 422  # Pydantic validation error (run_id missing)
