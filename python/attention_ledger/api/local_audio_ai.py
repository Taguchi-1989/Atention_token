"""Local-only speech transcription and online speaker tracking for TalkBalancer.

Audio is accepted as in-memory mono PCM16.  This module never writes audio to
disk and never calls a speech API.  The optional models are downloaded once,
then inference runs on the user's local PC.
"""

from __future__ import annotations

import array
import importlib.util
import math
import os
import threading
from dataclasses import dataclass
from typing import Optional


def _module_available(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except ModuleNotFoundError:
        return False


@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    confidence: float
    language: str


@dataclass(frozen=True)
class SpeakerResult:
    key: str
    confidence: float
    engine: str


class LocalAudioAI:
    """Lazy local models plus a small online speaker-clustering state."""

    def __init__(self) -> None:
        self._model_lock = threading.Lock()
        self._whisper = None
        self._speaker_inference = None
        self._speaker_backend = "acoustic"
        self._speaker_error: Optional[str] = None
        self._centroids: list[list[float]] = []
        self._cluster_counts: list[int] = []

    def reset(self) -> None:
        """Forget session-specific voices without unloading reusable models."""
        self._centroids = []
        self._cluster_counts = []

    @property
    def transcription_available(self) -> bool:
        return _module_available("faster_whisper")

    @property
    def transcription_model(self) -> str:
        return os.getenv("TB_WHISPER_MODEL", "small")

    @property
    def speaker_engine(self) -> str:
        requested = os.getenv("TB_SPEAKER_ENGINE", "auto").lower()
        if requested in {"auto", "pyannote"} and _module_available("pyannote.audio"):
            return "pyannote" if self._speaker_error is None else "acoustic"
        return "acoustic"

    @property
    def speaker_error(self) -> Optional[str]:
        return self._speaker_error

    def _load_whisper(self):
        if self._whisper is not None:
            return self._whisper
        with self._model_lock:
            if self._whisper is not None:
                return self._whisper
            if not self.transcription_available:
                raise RuntimeError("faster-whisper がインストールされていません")
            from faster_whisper import WhisperModel

            device = os.getenv("TB_WHISPER_DEVICE", "cpu")
            default_compute = "float16" if device == "cuda" else "int8"
            compute_type = os.getenv("TB_WHISPER_COMPUTE_TYPE", default_compute)
            self._whisper = WhisperModel(
                self.transcription_model,
                device=device,
                compute_type=compute_type,
            )
        return self._whisper

    @staticmethod
    def _pcm_to_samples(pcm: bytes) -> list[float]:
        values = array.array("h")
        values.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
        return [value / 32768.0 for value in values]

    def transcribe(self, pcm: bytes, sample_rate: int = 16000) -> TranscriptionResult:
        if sample_rate != 16000:
            raise ValueError("文字起こし入力は16kHz PCMのみ対応しています")
        model = self._load_whisper()
        import numpy as np

        audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
        if audio.size < sample_rate:
            return TranscriptionResult(text="", confidence=0.0, language="ja")
        segments, info = model.transcribe(
            audio,
            language="ja",
            task="transcribe",
            beam_size=1,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 350},
            condition_on_previous_text=False,
        )
        collected = list(segments)
        text = "".join(segment.text for segment in collected).strip()
        if collected:
            avg_logprob = sum(segment.avg_logprob for segment in collected) / len(collected)
            confidence = max(0.0, min(1.0, math.exp(avg_logprob)))
        else:
            confidence = 0.0
        return TranscriptionResult(
            text=text,
            confidence=round(confidence, 3),
            language=getattr(info, "language", "ja") or "ja",
        )

    def _pyannote_embedding(self, pcm: bytes, sample_rate: int) -> Optional[list[float]]:
        if self.speaker_engine != "pyannote":
            return None
        try:
            import numpy as np
            import torch
            if self._speaker_inference is None:
                with self._model_lock:
                    if self._speaker_inference is None:
                        os.environ.setdefault("PYANNOTE_METRICS_ENABLED", "0")
                        from pyannote.audio import Inference, Model
                        model_name = os.getenv(
                            "TB_SPEAKER_MODEL",
                            "pyannote/wespeaker-voxceleb-resnet34-LM",
                        )
                        model = Model.from_pretrained(model_name)
                        self._speaker_inference = Inference(model, window="whole")
            audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
            waveform = torch.from_numpy(audio).unsqueeze(0)
            embedding = self._speaker_inference({"waveform": waveform, "sample_rate": sample_rate})
            values = np.asarray(embedding).reshape(-1).astype(float).tolist()
            return self._normalize(values)
        except Exception as exc:  # optional model failure must not stop the session
            self._speaker_error = str(exc)[:240]
            self._speaker_backend = "acoustic"
            return None

    @staticmethod
    def _normalize(values: list[float]) -> list[float]:
        norm = math.sqrt(sum(value * value for value in values))
        if norm <= 1e-12:
            return values
        return [value / norm for value in values]

    @classmethod
    def _acoustic_embedding(cls, pcm: bytes, sample_rate: int) -> Optional[list[float]]:
        """Privacy-safe fallback for clean turn-taking; not biometric identity."""
        samples = cls._pcm_to_samples(pcm)
        if len(samples) < sample_rate // 2:
            return None
        mean = sum(samples) / len(samples)
        samples = [sample - mean for sample in samples]
        rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
        if rms < 0.008:
            return None

        stride = max(1, len(samples) // 24000)
        reduced = samples[::stride]
        effective_rate = sample_rate / stride
        zcr = sum(1 for a, b in zip(reduced, reduced[1:]) if (a < 0) != (b < 0)) / max(1, len(reduced) - 1)

        def goertzel(freq: float) -> float:
            omega = 2.0 * math.pi * freq / effective_rate
            coeff = 2.0 * math.cos(omega)
            s1 = 0.0
            s2 = 0.0
            for sample in reduced:
                s0 = sample + coeff * s1 - s2
                s2, s1 = s1, s0
            power = s1 * s1 + s2 * s2 - coeff * s1 * s2
            return math.log1p(max(0.0, power) / max(1, len(reduced)))

        bands = [goertzel(freq) for freq in (90, 140, 220, 350, 550, 850, 1300, 2000, 3000)]
        features = [math.log1p(rms * 100), zcr * 10, *bands]
        return cls._normalize(features)

    @staticmethod
    def _cosine_distance(a: list[float], b: list[float]) -> float:
        if len(a) != len(b):
            return 1.0
        return 1.0 - sum(x * y for x, y in zip(a, b))

    def classify_speaker(self, pcm: bytes, sample_rate: int, max_speakers: int) -> Optional[SpeakerResult]:
        embedding = self._pyannote_embedding(pcm, sample_rate)
        engine = "pyannote" if embedding is not None else "acoustic"
        if embedding is None:
            embedding = self._acoustic_embedding(pcm, sample_rate)
        if embedding is None:
            return None

        # Short online embeddings vary more than offline full-meeting embeddings.
        # 3-second windows with 0.65 separated two installed Japanese TTS voices
        # while keeping each voice stable in the local integration check.
        threshold = float(os.getenv("TB_SPEAKER_DISTANCE", "0.65" if engine == "pyannote" else "0.10"))
        distances = [self._cosine_distance(embedding, centroid) for centroid in self._centroids]
        nearest = min(range(len(distances)), key=distances.__getitem__) if distances else None
        can_create = len(self._centroids) < max(1, max_speakers)

        if nearest is None or (distances[nearest] > threshold and can_create):
            index = len(self._centroids)
            self._centroids.append(embedding)
            self._cluster_counts.append(1)
            confidence = 0.55
        else:
            index = nearest if nearest is not None else 0
            count = self._cluster_counts[index]
            old = self._centroids[index]
            updated = [(old_value * count + value) / (count + 1) for old_value, value in zip(old, embedding)]
            self._centroids[index] = self._normalize(updated)
            self._cluster_counts[index] = count + 1
            distance = distances[index] if distances else threshold
            confidence = max(0.35, min(0.99, 1.0 - distance / max(threshold, 1e-6)))

        self._speaker_backend = engine
        return SpeakerResult(key=f"voice_{index + 1}", confidence=round(confidence, 3), engine=engine)

    def clusters(self) -> list[dict]:
        return [
            {"key": f"voice_{index + 1}", "sampleCount": count}
            for index, count in enumerate(self._cluster_counts)
        ]
