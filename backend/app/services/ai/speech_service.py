from pathlib import Path
from typing import Optional

import av
from faster_whisper import WhisperModel

try:
    from ai4bharat.transliteration import XlitEngine
except ImportError:
    XlitEngine = None


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
    _xlit_engine = None

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

            # Try deterministic decoding first, then slightly warmer
            # fallbacks when Whisper detects a poor/repetitive decode.
            temperature=(0.0, 0.2, 0.4, 0.6),

            # Speech -> text only
            task="transcribe",

            # Automatic language detection
            language=None,

            # Important for short clips: carrying previous decoded text
            # can cause repeated/hallucinated phrases.
            condition_on_previous_text=False,

            no_speech_threshold=0.6,

            compression_ratio_threshold=2.0,

            # Reduce repeated-token loops on noisy/very short recordings.
            repetition_penalty=1.15,
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
        # Native-script second pass for Indian languages
        # ----------------------------------------------------
        # Whisper can occasionally return Indian-language speech in
        # Latin transliteration instead of native Indic script.
        # IndicTrans2 expects the native Indic script.
        if whisper_language in {"gu", "hi", "mr", "ta"}:

            native_prompts = {
                "gu": "આજે હું ગુજરાતી ભાષામાં સ્પષ્ટ રીતે વાત કરી રહ્યો છું.",
                "hi": "आज मैं हिंदी भाषा में स्पष्ट रूप से बात कर रहा हूँ।",
                "mr": "आज मी मराठी भाषेत स्पष्टपणे बोलत आहे.",
                "ta": "இன்று நான் தமிழ் மொழியில் தெளிவாக பேசுகிறேன்.",
            }

            native_segments, _ = model.transcribe(
                str(path),
                language=whisper_language,
                task="transcribe",
                beam_size=5,
                best_of=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500},
                temperature=(0.0, 0.2, 0.4),
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
                compression_ratio_threshold=2.0,
                repetition_penalty=1.15,
                initial_prompt=native_prompts[whisper_language],
            )

            native_parts = []
            for segment in native_segments:
                segment_text = segment.text.strip()
                if segment_text:
                    native_parts.append(segment_text)

            native_text = " ".join(native_parts).strip()
            if native_text:
                transcribed_text = native_text

        # ----------------------------------------------------
        # Roman Indic -> native Indic normalization
        # ----------------------------------------------------
        # Whisper may recognize Gujarati/Hindi/etc. correctly but emit
        # the result in Latin characters. IndicTrans2 expects native script.
        if whisper_language in {"gu", "hi", "mr", "ta"}:
            latin_chars = sum(
                ch.isascii() and ch.isalpha()
                for ch in transcribed_text
            )
            native_chars = sum(
                (not ch.isascii()) and ch.isalpha()
                for ch in transcribed_text
            )

            if latin_chars > native_chars:
                if XlitEngine is None:
                    print("IndicXlit is not installed; keeping Whisper text.")
                else:
                    try:
                        if cls._xlit_engine is None:
                            print("Loading AI4Bharat IndicXlit...")
                            cls._xlit_engine = XlitEngine(
                                lang2use=whisper_language
                            )

                        roman_text = transcribed_text
                        converted = cls._xlit_engine.translit_sentence(
                            roman_text,
                            lang_code=whisper_language,
                            beam_width=10,
                        )

                        if isinstance(converted, str) and converted.strip():
                            print(
                                f'IndicXlit [{whisper_language}]: '
                                f'"{roman_text}" -> "{converted}"'
                            )
                            transcribed_text = converted.strip()

                    except Exception as error:
                        print(f"IndicXlit normalization failed: {error}")

        print(f"Whisper transcription [{whisper_language}]: {transcribed_text}")
        # ----------------------------------------------------
        # Result
        # ----------------------------------------------------

        return {
            "detected_language": language_code,
            "detected_language_name": language_name,
            "transcribed_text": transcribed_text,
        }