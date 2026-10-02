"""
Voxify - Image Translation API

Flow:

Image upload / camera capture
        ↓
Image validation
        ↓
PaddleOCR
        ↓
Extract text
        ↓
Voxify translation service
        ↓
Translated text
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.image_translation_service import process_image
from app.translation import (
    LANGUAGE_NAMES,
    LANGUAGE_MAP,
    translate_fast,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/image",
    tags=["Image Translation"],
)


# ============================================================
# CONSTANTS
# ============================================================

MAX_IMAGE_SIZE = 10 * 1024 * 1024

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


# ============================================================
# LANGUAGE NORMALIZATION
# ============================================================

LANGUAGE_ALIASES = {
    # English
    "english": "en-IN",
    "en": "en-IN",
    "en-in": "en-IN",

    # Hindi
    "hindi": "hi-IN",
    "hi": "hi-IN",
    "hi-in": "hi-IN",

    # Gujarati
    "gujarati": "gu-IN",
    "gu": "gu-IN",
    "gu-in": "gu-IN",

    # Marathi
    "marathi": "mr-IN",
    "mr": "mr-IN",
    "mr-in": "mr-IN",

    # Tamil
    "tamil": "ta-IN",
    "ta": "ta-IN",
    "ta-in": "ta-IN",
}


def normalize_language(
    language: str | None,
    allow_auto: bool = False,
) -> str:

    if not language:
        return "auto" if allow_auto else ""

    value = language.strip()

    if allow_auto and value.lower() == "auto":
        return "auto"

    return LANGUAGE_ALIASES.get(
        value.lower(),
        value,
    )


# ============================================================
# IMAGE TRANSLATION
# ============================================================

@router.post("/translate")
async def translate_image(
    file: UploadFile = File(...),
    source_language: str = Form("auto"),
    target_language: str = Form(...),
):
    """
    Extract text from an image using PaddleOCR and translate it.

    Endpoint:
        POST /api/v1/image/translate

    Form fields:
        file
        source_language
        target_language
    """

    # ========================================================
    # FILE VALIDATION
    # ========================================================

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select an image.",
        )

    content_type = (
        file.content_type or ""
    ).lower().strip()

    if content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported image format. "
                "Please upload JPG, JPEG, PNG or WEBP."
            ),
        )

    # ========================================================
    # READ FILE
    # ========================================================

    try:
        image_bytes = await file.read()

    except Exception as exc:
        print(
            "Image read error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=400,
            detail="Unable to read the uploaded image.",
        ) from exc

    # ========================================================
    # SIZE VALIDATION
    # ========================================================

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image files must be 10 MB or smaller.",
        )

    # ========================================================
    # NORMALIZE LANGUAGES
    # ========================================================

    source_language = normalize_language(
        source_language,
        allow_auto=True,
    )

    target_language = normalize_language(
        target_language,
        allow_auto=False,
    )

    # ========================================================
    # VALIDATE TARGET LANGUAGE
    # ========================================================

    if target_language not in LANGUAGE_MAP:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported target language: "
                f"{target_language}. "
                "Supported languages: "
                "English, Hindi, Gujarati, Marathi, Tamil."
            ),
        )

    # ========================================================
    # OCR SOURCE LANGUAGE
    # ========================================================

    # PaddleOCR currently uses the OCR language configuration
    # available in image_translation_service.py.
    #
    # Auto currently falls back to English OCR.
    # Explicit supported OCR language is passed through.

    ocr_source_language = (
        source_language
        if source_language.lower() != "auto"
        else "en-IN"
    )

    # ========================================================
    # OCR
    # ========================================================

    try:
        ocr_result = process_image(
            image_bytes,
            ocr_source_language,
        )

    except HTTPException:
        raise

    except Exception as exc:
        print()
        print("======================================")
        print("IMAGE OCR ERROR")
        print("======================================")
        print("Error type:", type(exc).__name__)
        print("Error:", str(exc))
        print("======================================")
        print()

        raise HTTPException(
            status_code=500,
            detail=(
                "Image text extraction failed. "
                "Please try another image."
            ),
        ) from exc

    # ========================================================
    # OCR RESPONSE
    # ========================================================

    if not isinstance(ocr_result, dict):
        raise HTTPException(
            status_code=500,
            detail="Image OCR returned an invalid response.",
        )

    extracted_text = (
        ocr_result.get("extracted_text")
        or ocr_result.get("text")
        or ""
    )

    extracted_text = str(
        extracted_text
    ).strip()

    if not extracted_text:
        raise HTTPException(
            status_code=422,
            detail=(
                "No readable text was found in the image. "
                "Please upload a clearer image."
            ),
        )

    # ========================================================
    # SOURCE LANGUAGE
    # ========================================================

    detected_source_language = (
        ocr_result.get("source_language")
        or ocr_result.get("detected_language")
        or (
            source_language
            if source_language.lower() != "auto"
            else "en-IN"
        )
    )

    detected_source_language = normalize_language(
        detected_source_language,
        allow_auto=False,
    )

    if detected_source_language not in LANGUAGE_MAP:
        detected_source_language = "en-IN"

    # ========================================================
    # TRANSLATION
    # ========================================================

    try:

        if (
            detected_source_language
            == target_language
        ):
            translated_text = extracted_text

        else:
            translated_text = translate_fast(
                extracted_text,
                detected_source_language,
                target_language,
            )

    except HTTPException:
        raise

    except Exception as exc:
        print()
        print("======================================")
        print("IMAGE TRANSLATION ERROR")
        print("======================================")
        print("Error type:", type(exc).__name__)
        print("Error:", str(exc))
        print("======================================")
        print()

        raise HTTPException(
            status_code=500,
            detail=(
                "Image translation failed. "
                "Please try again."
            ),
        ) from exc

    # ========================================================
    # EMPTY TRANSLATION CHECK
    # ========================================================

    if not translated_text:
        raise HTTPException(
            status_code=500,
            detail="Image translation returned an empty result.",
        )

    # ========================================================
    # LANGUAGE DISPLAY NAMES
    # ========================================================

    source_language_name = LANGUAGE_NAMES.get(
        detected_source_language,
        detected_source_language,
    )

    target_language_name = LANGUAGE_NAMES.get(
        target_language,
        target_language,
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {
        "success": True,
        "filename": file.filename,

        "source_language": detected_source_language,
        "source_language_name": source_language_name,

        "target_language": target_language,
        "target_language_name": target_language_name,

        "extracted_text": extracted_text,
        "original_text": extracted_text,
        "translated_text": translated_text,

        "message": (
            "Image translated successfully."
        ),
    }