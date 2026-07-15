"""Download and validate TalkBalancer's optional local models."""

import os


def main() -> None:
    os.environ.setdefault("PYANNOTE_METRICS_ENABLED", "0")

    from faster_whisper import WhisperModel

    whisper_name = os.getenv("TB_WHISPER_MODEL", "small")
    whisper_device = os.getenv("TB_WHISPER_DEVICE", "cpu")
    compute_type = os.getenv(
        "TB_WHISPER_COMPUTE_TYPE",
        "float16" if whisper_device == "cuda" else "int8",
    )
    WhisperModel(whisper_name, device=whisper_device, compute_type=compute_type)
    print(f"faster-whisper ready: {whisper_name} ({whisper_device}/{compute_type})", flush=True)

    from pyannote.audio import Model

    speaker_name = os.getenv(
        "TB_SPEAKER_MODEL",
        "pyannote/wespeaker-voxceleb-resnet34-LM",
    )
    Model.from_pretrained(speaker_name)
    print(f"speaker model ready: {speaker_name}", flush=True)


if __name__ == "__main__":
    main()
