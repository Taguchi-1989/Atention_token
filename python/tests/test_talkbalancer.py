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
        assert body["participants"] == []

    def test_start_session(self):
        res = client.post("/api/talkbalancer/session",
                          json={"title": "テスト飲み会", "mode": "volume_only", "participantCount": 3})
        assert res.status_code == 201
        body = res.json()
        assert body["active"] is True
        assert body["session"]["title"] == "テスト飲み会"
        assert body["session"]["mode"] == "volume_only"
        assert [p["name"] for p in body["participants"]] == ["Aさん", "Bさん", "Cさん"]
        # 10.1 プライバシー: MVP は保存なし固定
        assert body["session"]["savePolicy"] == "none"

        current = client.get("/api/talkbalancer/session").json()
        assert current["participants"] == body["participants"]

    def test_start_session_defaults(self):
        res = client.post("/api/talkbalancer/session", json={})
        assert res.status_code == 201
        assert res.json()["session"]["mode"] == "volume_only"
        assert len(res.json()["participants"]) == 4

    def test_start_session_accepts_participant_names(self):
        res = client.post("/api/talkbalancer/session",
                          json={"participantNames": ["田中", "佐藤", "鈴木"]})
        assert res.status_code == 201
        assert [p["name"] for p in res.json()["participants"]] == ["田中", "佐藤", "鈴木"]

    def test_invalid_mode_rejected(self):
        res = client.post("/api/talkbalancer/session", json={"mode": "spy_mode"})
        assert res.status_code == 422

    def test_start_session_accepts_balance_and_transcript_modes(self):
        res = client.post("/api/talkbalancer/session", json={"mode": "balance"})
        assert res.status_code == 201
        assert res.json()["session"]["mode"] == "balance"

        res = client.post("/api/talkbalancer/session", json={"mode": "transcript"})
        assert res.status_code == 201
        assert res.json()["session"]["mode"] == "transcript"

    def test_end_session_deletes_data(self):
        client.post("/api/talkbalancer/session", json={"mode": "transcript"})
        client.post("/api/talkbalancer/alerts", json={"type": "too_loud"})
        client.post("/api/talkbalancer/speaker-events",
                    json={"participantId": "speaker_1", "durationSec": 15})
        client.post("/api/talkbalancer/transcript-notes", json={"text": "一時メモ"})
        client.post("/api/talkbalancer/metrics", json={"rms": 0.1})
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
        assert client.get("/api/talkbalancer/speaker-stats").json()["totalSeconds"] == 0
        assert client.get("/api/talkbalancer/transcript-notes").json()["notes"] == []
        assert client.get("/api/talkbalancer/analysis").json()["samples"] == 0
        participants = client.get("/api/talkbalancer/participants").json()["participants"]
        assert len(participants) == 4


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
            "localAudioProcessing": False,
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
            "localAudioProcessing": False,
            "cloudUpload": False,
            "savePolicy": "none",
        }

    def test_privacy_mapping_matches_frontend(self):
        """_privacy_for_mode はフロント derivePrivacy と同一マッピング。"""
        from attention_ledger.api import talkbalancer as tb

        assert tb._privacy_for_mode("volume_only") == {
            "recording": False, "transcription": False,
            "localAudioProcessing": False,
            "cloudUpload": False, "savePolicy": "none",
        }
        assert tb._privacy_for_mode("transcript") == {
            "recording": False, "transcription": True,
            "localAudioProcessing": True,
            "cloudUpload": False, "savePolicy": "none",
        }


class TestSpeakerBalance:
    """参加者登録と話者別バランス可視化用の集計。"""

    def test_update_participants_requires_session(self):
        res = client.put("/api/talkbalancer/participants", json={"names": ["A", "B"]})
        assert res.status_code == 409

    def test_update_participants(self):
        client.post("/api/talkbalancer/session", json={})
        res = client.put("/api/talkbalancer/participants", json={"names": ["田中", "佐藤"]})
        assert res.status_code == 200
        body = res.json()
        assert [p["name"] for p in body["participants"]] == ["田中", "佐藤"]

    def test_speaker_event_requires_session(self):
        res = client.post("/api/talkbalancer/speaker-events",
                          json={"participantId": "speaker_1", "durationSec": 15})
        assert res.status_code == 409

    def test_speaker_event_updates_total_and_recent(self):
        client.post("/api/talkbalancer/session", json={"participantNames": ["田中", "佐藤"]})
        res = client.post("/api/talkbalancer/speaker-events",
                          json={"participantId": "speaker_1", "durationSec": 30})
        assert res.status_code == 201
        stats = res.json()["stats"]
        assert stats["totalSeconds"] == 30
        assert stats["recent5mSeconds"] == 30
        assert stats["total"][0]["seconds"] == 30
        assert stats["total"][0]["share"] == 1
        assert stats["total"][1]["seconds"] == 0

    def test_speaker_duration_validation(self):
        client.post("/api/talkbalancer/session", json={"participantCount": 1})
        for duration in (0, 301, 1.5):
            res = client.post("/api/talkbalancer/speaker-events",
                              json={"participantId": "speaker_1", "durationSec": duration})
            assert res.status_code == 422

    def test_participant_label_update_preserves_speaker_history(self):
        client.post("/api/talkbalancer/session", json={"participantNames": ["A", "B"]})
        client.post("/api/talkbalancer/speaker-events",
                    json={"participantId": "speaker_1", "durationSec": 30})

        client.put("/api/talkbalancer/participants", json={"names": ["田中", "佐藤"]})
        stats = client.get("/api/talkbalancer/speaker-stats").json()

        assert stats["totalSeconds"] == 30
        assert stats["total"][0]["name"] == "田中"
        assert stats["total"][0]["seconds"] == 30

    def test_unknown_speaker_rejected(self):
        client.post("/api/talkbalancer/session", json={"participantCount": 2})
        res = client.post("/api/talkbalancer/speaker-events",
                          json={"participantId": "speaker_99", "durationSec": 15})
        assert res.status_code == 404

    def test_batch_speaker_events(self):
        client.post("/api/talkbalancer/session", json={"participantNames": ["田中", "佐藤"]})
        res = client.post("/api/talkbalancer/speaker-events/batch", json={"events": [
            {"participantId": "speaker_1", "durationSec": 20},
            {"participantId": "speaker_2", "durationSec": 10},
        ]})
        assert res.status_code == 201
        body = res.json()
        assert len(body["events"]) == 2
        assert body["stats"]["totalSeconds"] == 30
        assert body["stats"]["total"][0]["share"] == 0.6667
        assert body["stats"]["total"][1]["share"] == 0.3333

    def test_recent_5m_window(self):
        from attention_ledger.api import talkbalancer as tb

        client.post("/api/talkbalancer/session", json={"participantNames": ["田中", "佐藤"]})
        with tb._lock:
            old = tb.SpeakerEvent(
                id="old",
                sessionId=tb._session.id,
                participantId="speaker_1",
                timestamp="2024-01-01T00:00:00+00:00",
                durationSec=60,
                source="manual",
            )
            tb._speaker_events.append(old)
            tb._record_speaker_event_locked(tb.SpeakerEventCreate(participantId="speaker_2", durationSec=30))

        res = client.get("/api/talkbalancer/speaker-stats")
        body = res.json()
        assert body["totalSeconds"] == 90
        assert body["recent5mSeconds"] == 30
        assert body["total"][0]["seconds"] == 60
        assert body["recent5m"][0]["seconds"] == 0
        assert body["recent5m"][1]["seconds"] == 30


class TestTranscriptNotes:
    """モードCの文字起こしメモ。録音保存ではなくメモリ内の一時データ。"""

    def test_transcript_notes_require_session(self):
        res = client.post("/api/talkbalancer/transcript-notes", json={"text": "乾杯の挨拶"})
        assert res.status_code == 409

    def test_transcript_notes_only_work_in_mode_c(self):
        client.post("/api/talkbalancer/session", json={"mode": "balance"})
        res = client.post("/api/talkbalancer/transcript-notes", json={"text": "二次会の相談"})
        assert res.status_code == 409

    def test_post_and_list_transcript_note(self):
        client.post("/api/talkbalancer/session",
                    json={"mode": "transcript", "participantNames": ["田中", "佐藤"]})
        res = client.post("/api/talkbalancer/transcript-notes",
                          json={"participantId": "speaker_1", "text": " 二次会は駅前候補 "})
        assert res.status_code == 201
        note = res.json()["note"]
        assert note["text"] == "二次会は駅前候補"
        assert note["participantName"] == "田中"

        res = client.get("/api/talkbalancer/transcript-notes")
        body = res.json()
        assert body["enabled"] is True
        assert len(body["notes"]) == 1

    def test_blank_transcript_note_is_rejected(self):
        client.post("/api/talkbalancer/session", json={"mode": "transcript"})
        res = client.post("/api/talkbalancer/transcript-notes", json={"text": "   "})
        assert res.status_code == 422

    def test_report_includes_transcript_notes_and_privacy(self):
        client.post("/api/talkbalancer/session", json={"mode": "transcript"})
        client.post("/api/talkbalancer/transcript-notes", json={"text": "締めの時間を確認"})
        res = client.get("/api/talkbalancer/report")
        body = res.json()
        assert body["privacy"]["transcription"] is True
        assert body["transcriptNotes"][0]["text"] == "締めの時間を確認"


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


class TestLocalTranscription:
    def test_status_and_privacy_are_explicit(self):
        client.post("/api/talkbalancer/session", json={"mode": "transcript"})
        status = client.get("/api/talkbalancer/transcription/status").json()
        assert status["state"] == "off"
        assert status["audioRetention"] == "memory-only"
        assert status["cloudUpload"] is False

        report = client.get("/api/talkbalancer/report").json()
        assert report["privacy"]["localAudioProcessing"] is True
        assert report["privacy"]["recording"] is False
        assert report["privacy"]["cloudUpload"] is False

    def test_transcription_websocket_detects_anonymous_speaker(self, monkeypatch):
        import array
        import math

        monkeypatch.setenv("TB_SPEAKER_ENGINE", "acoustic")

        client.post("/api/talkbalancer/session", json={
            "mode": "transcript",
            "participantNames": ["田中", "佐藤"],
        })
        pcm = array.array("h", (
            int(12000 * math.sin(2 * math.pi * 220 * index / 16000))
            for index in range(16000 * 3)
        )).tobytes()

        with client.websocket_connect("/api/talkbalancer/ws/transcription") as ws:
            initial = ws.receive_json()
            assert initial["type"] == "transcription_status"
            ws.send_json({"type": "start", "sourceId": "test-source", "sampleRate": 16000})
            assert ws.receive_json()["state"] in ("listening", "unavailable")
            ws.send_bytes(pcm)
            speaker = ws.receive_json()
            assert speaker["type"] == "speaker_status"
            assert speaker["currentSpeakerKey"] == "voice_1"
            assert speaker["currentSpeakerName"] == "話者1"

        mapped = client.put(
            "/api/talkbalancer/transcription/speakers/voice_1",
            json={"participantId": "speaker_1"},
        )
        assert mapped.status_code == 200
        cluster = mapped.json()["clusters"][0]
        assert cluster["participantId"] == "speaker_1"
        assert cluster["name"] == "田中"

        with client.websocket_connect("/api/talkbalancer/ws/transcription") as ws:
            ws.receive_json()
            ws.send_json({"type": "start", "sourceId": "mapped-test", "sampleRate": 16000})
            ws.receive_json()
            ws.send_bytes(pcm)
            assert ws.receive_json()["currentSpeakerName"] == "田中"
        stats = client.get("/api/talkbalancer/speaker-stats").json()
        assert stats["total"][0]["seconds"] == 3
        assert stats["latestEvent"]["source"] == "auto"

    def test_speaker_mapping_rejects_unknown_cluster(self):
        client.post("/api/talkbalancer/session", json={"mode": "transcript"})
        res = client.put(
            "/api/talkbalancer/transcription/speakers/voice_99",
            json={"participantId": "speaker_1"},
        )
        assert res.status_code == 404
