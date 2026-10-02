"""
Voxify - Text to Audio API

Translates text into the selected target language using
Voxify's existing IndicTrans2 translation service and then
converts the translated text into MP3 audio using Microsoft
Edge TTS.
"""

import os
import tempfile
from pathlib import Path

import edge_tts
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.translation import translate_with_indictrans2
from app.supabase_client import supabase_admin


router = APIRouter(
    prefix="/text-to-audio",
    tags=["Text to Audio"],
)


# ---------------------------------------------------------
# EDGE TTS VOICES
# ---------------------------------------------------------

VOICE_MAP = {
    "en-IN": "en-IN-NeerjaNeural",
    "hi-IN": "hi-IN-SwaraNeural",
    "gu-IN": "gu-IN-DhwaniNeural",
    "mr-IN": "mr-IN-AarohiNeural",
    "ta-IN": "ta-IN-PallaviNeural",
}


# ---------------------------------------------------------
# SUPPORTED LANGUAGES
# ---------------------------------------------------------

SUPPORTED_LANGUAGES = {
    "en-IN",
    "hi-IN",
    "gu-IN",
    "mr-IN",
    "ta-IN",
}


# ---------------------------------------------------------
# REQUEST MODEL
# ---------------------------------------------------------

class TextToAudioRequest(BaseModel):

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
    )

    language: str = Field(
        ...,
        description=(
            "Target language code: "
            "en-IN, hi-IN, gu-IN, mr-IN, ta-IN"
        ),
    )


async def _save_generated_audio(audio_bytes: bytes, user_id: str, prefix: str) -> dict:
    """Save generated MP3 audio to Supabase Storage and file_uploads."""
    import uuid

    filename = f"{prefix}-{uuid.uuid4()}.mp3"
    storage_path = f"audio/{user_id}/{filename}"

    supabase_admin.storage.from_("voxify-files").upload(
        storage_path,
        audio_bytes,
        file_options={
            "content-type": "audio/mpeg",
            "upsert": "false",
        },
    )

    metadata = supabase_admin.table("file_uploads").insert({
        "user_id": user_id,
        "original_file_name": filename,
        "storage_path": storage_path,
        "mime_type": "audio/mpeg",
        "file_size": len(audio_bytes),
    }).execute()

    if not metadata.data:
        try:
            supabase_admin.storage.from_("voxify-files").remove([storage_path])
        except Exception:
            pass
        raise RuntimeError("Generated audio metadata could not be saved.")

    return {
        "storage_path": storage_path,
        "file_id": metadata.data[0]["id"],
    }


# ---------------------------------------------------------
# DIRECT SPEECH REQUEST
# ---------------------------------------------------------

class SpeechAudioRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = Field(
        ...,
        description="Target speech language code: en-IN, hi-IN, gu-IN, mr-IN, ta-IN",
    )


async def _generate_speech_only(text: str, language: str) -> bytes:
    """Convert already-translated text directly to speech."""
    text = text.strip()
    language = language.strip()

    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported language: {language}. "
                f"Supported languages: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
            ),
        )

    voice = VOICE_MAP[language]

    temp_file = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    output_path = Path(temp_file.name)
    temp_file.close()

    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(output_path))

        if not output_path.exists() or output_path.stat().st_size == 0:
            raise RuntimeError("Generated audio file is empty.")

        return output_path.read_bytes()

    finally:
        try:
            if output_path.exists():
                os.remove(output_path)
        except OSError:
            pass


@router.post("/generate-speech")
async def generate_speech(request: SpeechAudioRequest):
    """
    Convert target-language text to MP3 and save the generated audio
    for the authenticated user when a bearer token is supplied.
    """
    try:
        audio_bytes = await _generate_speech_only(
            request.text,
            request.language,
        )

        storage_path = ""
        file_id = ""

        authorization = getattr(request, "headers", None)
        # This endpoint historically accepts a JSON body only, so storage
        # is handled by the React client when it already has the auth token.

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-store",
                "X-Voxify-Target-Language": request.language,
            },
        )

    except HTTPException:
        raise

    except Exception as error:
        print("Direct speech generation error:", str(error))
        raise HTTPException(
            status_code=500,
            detail=f"Speech generation failed: {error}",
        ) from error


# ---------------------------------------------------------
# SIMPLE INPUT LANGUAGE DETECTION
# ---------------------------------------------------------

def detect_input_language(text: str) -> str:
    """
    Detect the most likely input language from its script.

    Current supported detection:

        Latin       -> English
        Gujarati    -> Gujarati
        Tamil       -> Tamil
        Devanagari  -> Hindi

    Devanagari is shared by Hindi and Marathi, so Marathi
    cannot be reliably distinguished from Hindi from script
    alone.

    This function is intentionally conservative.
    """

    for character in text:

        code = ord(character)

        # Gujarati Unicode block
        if 0x0A80 <= code <= 0x0AFF:
            return "gu-IN"

        # Tamil Unicode block
        if 0x0B80 <= code <= 0x0BFF:
            return "ta-IN"

        # Devanagari Unicode block
        if 0x0900 <= code <= 0x097F:
            return "hi-IN"

    # Default Latin input
    return "en-IN"


# ---------------------------------------------------------
# API ENDPOINT
# ---------------------------------------------------------

@router.post("/generate")
async def generate_audio(request: TextToAudioRequest):

    text = request.text.strip()
    target_language = request.language.strip()

    # -----------------------------------------------------
    # VALIDATE TEXT
    # -----------------------------------------------------

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty.",
        )

    if len(text) > 5000:
        raise HTTPException(
            status_code=400,
            detail="Text cannot be longer than 5000 characters.",
        )

    # -----------------------------------------------------
    # VALIDATE TARGET LANGUAGE
    # -----------------------------------------------------

    if target_language not in SUPPORTED_LANGUAGES:

        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported language: {target_language}. "
                f"Supported languages: "
                f"{', '.join(sorted(SUPPORTED_LANGUAGES))}"
            ),
        )

    voice = VOICE_MAP[target_language]

    # -----------------------------------------------------
    # DETECT INPUT LANGUAGE
    # -----------------------------------------------------

    source_language = detect_input_language(text)

    print()
    print("======================================")
    print("VOXIFY TEXT → AUDIO")
    print("======================================")
    print("Detected source:", source_language)
    print("Target language:", target_language)
    print("Input:", text)

    # -----------------------------------------------------
    # TRANSLATION
    # -----------------------------------------------------

    try:

        translated_text = await __import__(
            "asyncio"
        ).to_thread(
            translate_with_indictrans2,
            text,
            source_language,
            target_language,
        )

    except Exception as error:

        print(
            "Translation error:",
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Translation failed: "
                f"{str(error)}"
            ),
        )

    # -----------------------------------------------------
    # VALIDATE TRANSLATION
    # -----------------------------------------------------

    if not translated_text:
        raise HTTPException(
            status_code=500,
            detail="Translation returned empty text.",
        )

    translated_text = translated_text.strip()

    print("Translated text:", translated_text)

    # -----------------------------------------------------
    # CREATE TEMP MP3 FILE
    # -----------------------------------------------------

    temp_file = tempfile.NamedTemporaryFile(
        suffix=".mp3",
        delete=False,
    )

    output_path = Path(temp_file.name)

    temp_file.close()

    try:

        # -------------------------------------------------
        # TEXT → SPEECH
        #
        # IMPORTANT:
        # We send translated_text to Edge TTS,
        # NOT the original text.
        # -------------------------------------------------

        communicate = edge_tts.Communicate(
            translated_text,
            voice,
        )

        await communicate.save(
            str(output_path)
        )

        # -------------------------------------------------
        # VALIDATE AUDIO
        # -------------------------------------------------

        if not output_path.exists():

            raise RuntimeError(
                "Audio file was not generated."
            )

        file_size = output_path.stat().st_size

        if file_size == 0:

            raise RuntimeError(
                "Generated audio file is empty."
            )

        # -------------------------------------------------
        # READ AUDIO
        # -------------------------------------------------

        audio_bytes = output_path.read_bytes()

        # -------------------------------------------------
        # DELETE TEMP FILE
        # -------------------------------------------------

        try:
            os.remove(output_path)
        except OSError:
            pass

        print("Audio generated successfully.")
        print("Audio bytes:", len(audio_bytes))
        print("======================================")
        print()

        # -------------------------------------------------
        # RETURN AUDIO
        # -------------------------------------------------

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-store",
                "X-Voxify-Source-Language": source_language,
                "X-Voxify-Target-Language": target_language,
            },
        )

    except HTTPException:

        if output_path.exists():

            try:
                os.remove(output_path)
            except OSError:
                pass

        raise

    except Exception as error:

        if output_path.exists():

            try:
                os.remove(output_path)
            except OSError:
                pass

        print(
            "Audio generation error:",
            str(error),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Text to Audio generation failed: "
                f"{str(error)}"
            ),
        )