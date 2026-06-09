"""TalkBalancer API tests (Step 1 手動アラートMVP)."""

import pytest
from fastapi.testclient import TestClient

from attention_ledger.api.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_session():
    """各テストの前後でセッションを破棄してメモリ内状態をリセットする。"""
    client.delete("/api/talkbalancer/session")
    yield
    client.delete("/api/talkbalancer/session")


class TestSessionLifecycle:
    def test_no_session_initially(self):
        res = client.get("/api/talkbalancer/session")
        assert res.status_code == 200
        body = res.json()
        assert body["active"] is False
        assert body["session"] is None

    def test_start_session(self):
        res = client.post("/api/talkbalancer/session",
                          json={"title": "テスト飲み会", "mode": "volume_only"})
        assert res.status_code == 201
        body = res.json()
        assert body["active"] is True
        assert body["session"]["title"] == "テスト飲み会"
        assert body["session"]["mode"] == "volume_only"
        # 10.1 プライバシー: MVP は保存なし固定
        assert body["session"]["savePolicy"] == "none"

    def test_start_session_defaults(self):
        res = client.post("/api/talkbalancer/session", json={})
        assert res.status_code == 201
        assert res.json()["session"]["mode"] == "volume_only"

    def test_invalid_mode_rejected(self):
        res = client.post("/api/talkbalancer/session", json={"mode": "spy_mode"})
        assert res.status_code == 422

    def test_end_session_deletes_data(self):
        client.post("/api/talkbalancer/session", json={})
        client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        res = client.delete("/api/talkbalancer/session")
        assert res.status_code == 200
        assert res.json()["deleted"] is True
        # アラートも消えている
        res = client.get("/api/talkbalancer/alerts")
        assert res.json()["alerts"] == []
        assert res.json()["seq"] == 0


class TestAlerts:
    def test_alert_requires_session(self):
        res = client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        assert res.status_code == 409

    def test_post_alert_returns_polite_message(self):
        client.post("/api/talkbalancer/session", json={})
        res = client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        assert res.status_code == 201
        alert = res.json()
        assert alert["seq"] == 1
        assert alert["source"] == "manual"
        assert alert["severity"] == "info"
        assert "店内音量が高め" in alert["message"]

    def test_sensitive_topic_is_notice(self):
        client.post("/api/talkbalancer/session", json={})
        res = client.post("/api/talkbalancer/alerts", json={"type": "sensitive_topic"})
        assert res.json()["severity"] == "notice"

    def test_all_remote_buttons(self):
        """F-05 幹事リモコンの9ボタン全てにアラート文言がある。"""
        client.post("/api/talkbalancer/session", json={})
        types = ["talk_too_much", "too_loud", "same_story", "preaching",
                 "sensitive_topic", "pass_around", "topic_shift",
                 "drink_water", "take_break"]
        for t in types:
            res = client.post("/api/talkbalancer/alerts", json={"type": t})
            assert res.status_code == 201, t
            assert res.json()["message"], t

    def test_unknown_type_rejected(self):
        client.post("/api/talkbalancer/session", json={})
        res = client.post("/api/talkbalancer/alerts", json={"type": "shame_publicly"})
        assert res.status_code == 422

    def test_polling_with_after(self):
        client.post("/api/talkbalancer/session", json={})
        client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        client.post("/api/talkbalancer/alerts", json={"type": "same_story"})

        res = client.get("/api/talkbalancer/alerts")
        body = res.json()
        assert body["seq"] == 2
        assert len(body["alerts"]) == 2

        # after=1 → 2件目のみ
        res = client.get("/api/talkbalancer/alerts", params={"after": 1})
        body = res.json()
        assert len(body["alerts"]) == 1
        assert body["alerts"][0]["type"] == "same_story"

        # after=seq → 新着なし
        res = client.get("/api/talkbalancer/alerts", params={"after": 2})
        assert res.json()["alerts"] == []

    def test_new_session_resets_alerts(self):
        client.post("/api/talkbalancer/session", json={})
        client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        client.post("/api/talkbalancer/session", json={"title": "二次会"})
        res = client.get("/api/talkbalancer/alerts")
        assert res.json()["alerts"] == []
        assert res.json()["seq"] == 0
