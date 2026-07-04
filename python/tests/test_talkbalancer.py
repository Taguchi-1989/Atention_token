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

    def test_unimplemented_mode_rejected(self):
        """未実装モード(transcript/balance)は 400 で拒否し、セッションを作らない。

        UI 無効化だけに頼らないサーバー側の多層防御（10.1 プライバシー）。
        404 ではなく 400 を返す（フロントは 404 をデモモード切替に使うため）。
        """
        for mode in ("transcript", "balance"):
            res = client.post("/api/talkbalancer/session", json={"mode": mode})
            assert res.status_code == 400, mode
            # セッションは作られていない
            assert client.get("/api/talkbalancer/session").json()["active"] is False, mode

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

    def test_start_session_records_agreed_at(self):
        res = client.post("/api/talkbalancer/session", json={
            "title": "t", "mode": "volume_only", "agreedAt": "2026-07-04T10:00:00+00:00",
        })
        assert res.status_code == 201
        assert res.json()["session"]["agreedAt"] == "2026-07-04T10:00:00+00:00"
        res = client.get("/api/talkbalancer/session")
        assert res.json()["session"]["agreedAt"] == "2026-07-04T10:00:00+00:00"

    def test_start_session_without_agreed_at(self):
        res = client.post("/api/talkbalancer/session", json={})
        assert res.status_code == 201
        assert res.json()["session"]["agreedAt"] is None

    def test_new_session_replaces_agreed_at(self):
        client.post("/api/talkbalancer/session", json={
            "title": "t", "mode": "volume_only", "agreedAt": "2026-07-04T10:00:00+00:00",
        })
        res = client.post("/api/talkbalancer/session", json={"title": "t2", "mode": "volume_only"})
        assert res.status_code == 201
        assert res.json()["session"]["agreedAt"] is None


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


class TestReport:
    """終了前に確認する一時レポート。終了後は残らない。"""

    def test_report_without_session(self):
        res = client.get("/api/talkbalancer/report")
        assert res.status_code == 200
        assert res.json() == {"active": False, "session": None}

    def test_report_summarizes_active_session(self):
        client.post("/api/talkbalancer/session", json={"title": "送別会"})
        client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        client.post("/api/talkbalancer/alerts", json={"type": "sensitive_topic"})
        client.post("/api/talkbalancer/metrics", json={"rms": 0.12, "peak": 0.2})

        res = client.get("/api/talkbalancer/report")
        assert res.status_code == 200
        body = res.json()
        assert body["active"] is True
        assert body["session"]["title"] == "送別会"
        assert body["totalAlerts"] == 2
        assert body["manualAlerts"] == 2
        assert body["autoAlerts"] == 0
        assert body["alertCounts"]["too_loud"] == 1
        assert body["alertCounts"]["sensitive_topic"] == 1
        assert len(body["latestAlerts"]) == 2
        assert body["analysis"]["samples"] == 1
        assert body["privacy"] == {
            "recording": False,
            "transcription": False,
            "cloudUpload": False,
            "savePolicy": "none",
        }

    def test_report_deleted_after_end_session(self):
        client.post("/api/talkbalancer/session", json={})
        client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        client.delete("/api/talkbalancer/session")
        res = client.get("/api/talkbalancer/report")
        assert res.json() == {"active": False, "session": None}

    def test_privacy_derived_from_mode(self):
        """レポートの privacy は解析モードから算出される（ハードコードでない）。"""
        client.post("/api/talkbalancer/session", json={"mode": "volume_only"})
        privacy = client.get("/api/talkbalancer/report").json()["privacy"]
        assert privacy == {
            "recording": False,
            "transcription": False,
            "cloudUpload": False,
            "savePolicy": "none",
        }

    def test_privacy_mapping_matches_frontend(self):
        """_privacy_for_mode はフロント derivePrivacy と同一マッピング。

        transcript は API 経由で開始できない（400 拒否）ため直接呼んで検証し、
        将来 transcript 解禁時に表示と実態が一致することを担保する。
        """
        from attention_ledger.api import talkbalancer as tb

        assert tb._privacy_for_mode("volume_only") == {
            "recording": False, "transcription": False,
            "cloudUpload": False, "savePolicy": "none",
        }
        assert tb._privacy_for_mode("transcript") == {
            "recording": True, "transcription": True,
            "cloudUpload": False, "savePolicy": "none",
        }


class TestMetricsAndAnalysis:
    """F-07 音量・騒音解析 / Step 3 WebSocket / Step 4 会話密度メーター。"""

    def test_analysis_empty(self):
        res = client.get("/api/talkbalancer/analysis")
        assert res.status_code == 200
        body = res.json()
        assert body["samples"] == 0
        assert body["noiseCategory"] == "quiet"
        assert body["comfortScore"] == 100

    def test_metrics_require_session(self):
        res = client.post("/api/talkbalancer/metrics", json={"rms": 0.05})
        assert res.status_code == 409

    def test_metrics_validation(self):
        client.post("/api/talkbalancer/session", json={})
        res = client.post("/api/talkbalancer/metrics", json={"rms": 1.5})
        assert res.status_code == 422

    def test_rest_metrics_analysis(self):
        client.post("/api/talkbalancer/session", json={})
        # 静かなフレームを送る
        for _ in range(5):
            res = client.post("/api/talkbalancer/metrics", json={"rms": 0.005, "peak": 0.01})
        body = res.json()
        assert body["samples"] == 5
        assert body["noiseCategory"] == "quiet"
        assert body["comfortScore"] == 100
        # 大きめの音（直近5秒平均で判定されるため複数フレーム送る）
        for _ in range(20):
            res = client.post("/api/talkbalancer/metrics", json={"rms": 0.3, "peak": 0.5})
        body = res.json()
        assert body["noiseCategory"] in ("loud", "very_loud")
        assert body["comfortScore"] < 100
        # 会話密度: 大きいフレームは発話扱い
        assert body["speechDensity1m"] > 0

    def test_session_reset_clears_metrics(self):
        client.post("/api/talkbalancer/session", json={})
        client.post("/api/talkbalancer/metrics", json={"rms": 0.1})
        client.post("/api/talkbalancer/session", json={"title": "reset"})
        res = client.get("/api/talkbalancer/analysis")
        assert res.json()["samples"] == 0

    def test_websocket_roundtrip(self):
        client.post("/api/talkbalancer/session", json={})
        with client.websocket_connect("/api/talkbalancer/ws/metrics") as ws:
            ws.send_json({"rms": 0.05, "peak": 0.1})
            data = ws.receive_json()
            assert data["samples"] == 1
            assert "comfortScore" in data
            ws.send_json({"rms": "bad"})
            assert "error" in ws.receive_json()
            ws.send_json({"rms": 0.05})
            assert ws.receive_json()["samples"] == 2

    def test_websocket_requires_session(self):
        with client.websocket_connect("/api/talkbalancer/ws/metrics") as ws:
            data = ws.receive_json()
            assert "error" in data

    def test_auto_too_loud_alert(self, monkeypatch):
        """騒音が30秒続いたら too_loud の自動アラートが1回だけ出る。"""
        from attention_ledger.api import talkbalancer as tb

        client.post("/api/talkbalancer/session", json={})
        now = 1000.0
        with tb._lock:
            for i in range(40):  # 40秒ぶんの大音量フレーム
                tb._ingest_metric_locked(tb.MetricIn(rms=0.3, peak=0.5), now + i)
        res = client.get("/api/talkbalancer/alerts")
        autos = [a for a in res.json()["alerts"] if a["source"] == "auto"]
        assert len(autos) == 1
        assert autos[0]["type"] == "too_loud"
        # クールダウン中は再発行されない
        with tb._lock:
            for i in range(40, 80):
                tb._ingest_metric_locked(tb.MetricIn(rms=0.3, peak=0.5), now + i)
        res = client.get("/api/talkbalancer/alerts")
        autos = [a for a in res.json()["alerts"] if a["source"] == "auto"]
        assert len(autos) == 1
