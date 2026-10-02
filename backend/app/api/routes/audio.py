import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.audio import AudioTranscriptionResponse
from app.services.ai.speech_service import SpeechService


router = APIRouter(
    prefix="/audio",
    tags=["Audio"],
)


ALLOWED_AUDIO_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".ogg",
    ".webm",
    ".flac",
    ".aac",
}


@router.post(
    "/transcribe",
    response_model=AudioTranscriptionResponse,
)
async def transcribe_audio(
    file: UploadFile = File(...),
):
    """
    Upload an audio file and automatically detect the spoken language,
    then return the transcribed text.
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Audio file is required.",
        )

    extension = Path(file.filename).suffix.lower()

    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. Supported formats: "
                "wav, mp3, m4a, ogg, webm, flac, aac."
            ),
        )

    temp_path = None

    try:
        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded audio file is empty.",
            )

        with tempfile.NamedTemporaryFile(
            suffix=extension,
            delete=False,
        ) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name

        result = SpeechService.transcribe(temp_path)

        return AudioTranscriptionResponse(
            success=True,
            detected_language=result["detected_language"],
            detected_language_name=result["detected_language_name"],
            transcribed_text=result["transcribed_text"],
        )

    except HTTPException:
        raise

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        ) from error

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Audio transcription failed: {error}",
        ) from error

    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass