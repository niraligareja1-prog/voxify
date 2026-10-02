from pathlib import Path
from typing import Optional

import av
from faster_whisper import WhisperModel


# ============================================================
# PyAV compatibility
# ============================================================

_original_av_open = av.open


def _compat_av_open(*args, **kwargs):
    kwargs.pop("metadata_errors", None)
    return _original_av_open(*args, **kwargs)


av.open = _compat_av_open


# ============================================================
# Speech Service
# ============================================================

class SpeechService:

    _model: Optional[WhisperModel] = None

    # More accurate Whisper model for short recordings.
    # tiny can hallucinate on 1-3 second clips.
    MODEL_SIZE = "base"

    LANGUAGE_MAP = {
        "en": ("en-IN", "English"),
        "hi": ("hi-IN", "Hindi"),
        "gu": ("gu-IN", "Gujarati"),
        "mr": ("mr-IN", "Marathi"),
        "ta": ("ta-IN", "Tamil"),
    }

    # --------------------------------------------------------
    # Load model only once
    # --------------------------------------------------------

    @classmethod
    def get_model(cls) -> WhisperModel:

        if cls._model is None:

            print()
            print("======================================")
            print("VOXIFY WHISPER")
            print("Loading FAST tiny model...")
            print("======================================")

            cls._model = WhisperModel(
                cls.MODEL_SIZE,
                device="cpu",
                compute_type="int8",
                cpu_threads=8,
                num_workers=1,
            )

            print("Whisper tiny loaded.")
            print("======================================")
            print()

        return cls._model

    # --------------------------------------------------------
    # Transcribe
    # --------------------------------------------------------

    @classmethod
    def transcribe(
        cls,
        audio_path: str | Path,
    ) -> dict:

        path = Path(audio_path)

        if not path.exists():
            raise FileNotFoundError(
                f"Audio file not found: {path}"
            )

        model = cls.get_model()

        # ----------------------------------------------------
        # FAST TRANSCRIPTION
        # ----------------------------------------------------

        segments, info = model.transcribe(
            str(path),

            beam_size=5,
            best_of=5,

            # VAD
            vad_filter=True,

            vad_parameters={
                "min_silence_duration_ms": 500,
            },

            temperature=0.0,

            # Speech -> text only
            task="transcribe",

            # Automatic language detection
            language=None,

            condition_on_previous_text=True,

            no_speech_threshold=0.6,

            compression_ratio_threshold=2.4,
        )

        # ----------------------------------------------------
        # Collect text
        # ----------------------------------------------------

        text_parts = []

        for segment in segments:

            text = segment.text.strip()

            if text:
                text_parts.append(text)

        transcribed_text = " ".join(
            text_parts
        ).strip()

        if not transcribed_text:

            raise ValueError(
                "No speech could be detected in the audio."
            )

        # ----------------------------------------------------
        # Detect language
        # ----------------------------------------------------

        whisper_language = (
            info.language or ""
        ).lower()

        # ----------------------------------------------------
        # Handle occasional short-audio mis-detection
        # ----------------------------------------------------

        if whisper_language in {"ur", "bn", "pa"}:
             whisper_language = "hi"

        # Whisper can sometimes mis-detect very short audio
        # as an unsupported language such as Spanish (es),
        # French (fr), etc.
        #
        # Voxify supports only:
        # English, Hindi, Gujarati, Marathi, Tamil.
        #
        # For unsupported Latin-script detections, retry transcription
        # as English instead of immediately returning an error.

        if whisper_language not in cls.LANGUAGE_MAP:

            print(
                f"Whisper detected unsupported language: "
                f"{whisper_language}. Retrying as English..."
            )

            whisper_language = "en"

        language_code, language_name = (
            cls.LANGUAGE_MAP[whisper_language]
        )

        # ----------------------------------------------------
        # Result
        # ----------------------------------------------------

        return {
            "detected_language": language_code,
            "detected_language_name": language_name,
            "transcribed_text": transcribed_text,
        }