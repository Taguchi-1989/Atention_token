import array
import math

from attention_ledger.api.local_audio_ai import LocalAudioAI


def tone_pcm(frequency: float, seconds: float = 1.0, sample_rate: int = 16000) -> bytes:
    values = array.array("h", (
        int(12000 * math.sin(2 * math.pi * frequency * index / sample_rate))
        for index in range(int(seconds * sample_rate))
    ))
    return values.tobytes()


def test_acoustic_speaker_tracker_ignores_silence(monkeypatch):
    monkeypatch.setenv("TB_SPEAKER_ENGINE", "acoustic")
    tracker = LocalAudioAI()
    assert tracker.classify_speaker(bytes(16000 * 2), 16000, 4) is None


def test_acoustic_speaker_tracker_keeps_a_voice_cluster(monkeypatch):
    monkeypatch.setenv("TB_SPEAKER_ENGINE", "acoustic")
    tracker = LocalAudioAI()
    first = tracker.classify_speaker(tone_pcm(220), 16000, 4)
    second = tracker.classify_speaker(tone_pcm(220), 16000, 4)
    assert first is not None
    assert second is not None
    assert first.key == second.key == "voice_1"
    assert tracker.clusters()[0]["sampleCount"] == 2
