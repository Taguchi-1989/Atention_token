import array
import importlib.util
import os
import re
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from attention_ledger.api import talkbalancer as tb
from attention_ledger.api.main import app


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "audio"
WAV_PATH = FIXTURE_DIR / "voicevox-zundamon-transcription.wav"
CREDIT_PATH = FIXTURE_DIR / "README.md"


def _read_fixture() -> tuple[wave._wave_params, bytes]:
    with wave.open(str(WAV_PATH), "rb") as wav:
        return wav.getparams(), wav.readframes(wav.getnframes())


def test_voicevox_fixture_format_and_credit():
    params, pcm = _read_fixture()

    assert params.nchannels == 1
    assert params.framerate == 16000
    assert params.sampwidth == 2
    assert 10.0 <= params.nframes / params.framerate <= 11.0

    samples = array.array("h")
    samples.frombytes(pcm)
    assert max(abs(sample) for sample in samples) > 1000
    assert "VOICEVOX:ずんだもん" in CREDIT_PATH.read_text(encoding="utf-8")


@pytest.mark.audio_ai
@pytest.mark.skipif(
    os.getenv("TB_RUN_AUDIO_AI") != "1",
    reason="set TB_RUN_AUDIO_AI=1 to run the local Whisper fixture test",
)
def test_voicevox_fixture_transcribes_through_websocket(monkeypatch):
    if importlib.util.find_spec("faster_whisper") is None:
        pytest.skip("faster-whisper is not installed")

    monkeypatch.setenv("TB_WHISPER_DEVICE", os.getenv("TB_WHISPER_DEVICE", "cpu"))
    monkeypatch.setenv("TB_WHISPER_COMPUTE_TYPE", os.getenv("TB_WHISPER_COMPUTE_TYPE", "int8"))
    monkeypatch.setattr(tb, "_TRANSCRIPTION_CHUNK_SEC", 10)
    params, pcm = _read_fixture()
    client = TestClient(app)

    client.delete("/api/talkbalancer/session")
    try:
        created = client.post(
            "/api/talkbalancer/session",
            json={
                "mode": "transcript",
                "title": "VOICEVOX保存音声E2E",
                "participantNames": ["ずんだもん"],
            },
        )
        assert created.status_code == 201

        completed = None
        seen_processing = False
        with client.websocket_connect("/api/talkbalancer/ws/transcription") as ws:
            assert ws.receive_json()["state"] == "starting"
            ws.send_json({"type": "start", "sourceId": "voicevox-fixture", "sampleRate": 16000})
            assert ws.receive_json()["state"] == "listening"
            ws.send_bytes(pcm)

            for _ in range(8):
                message = ws.receive_json()
                if message.get("state") == "processing":
                    seen_processing = True
                if seen_processing and message.get("state") == "listening":
                    completed = message
                    break

        assert completed is not None
        assert completed["confidence"] >= 0.5
        notes = client.get("/api/talkbalancer/transcript-notes").json()["notes"]
        assert len(notes) == 1
        assert notes[0]["source"] == "auto"
        normalized = re.sub(r"[\s、。,.]", "", notes[0]["text"])

        for expected in ("本日の二次会", "新宿駅", "参加人数", "電話", "予約"):
            assert expected in normalized
    finally:
        client.delete("/api/talkbalancer/session")
