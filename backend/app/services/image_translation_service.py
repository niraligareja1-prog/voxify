from __future__ import annotations

import io
import os
from typing import List

# ============================================================
# PADDLE / ONEDNN CONFIGURATION
# ============================================================

# Must be set before importing Paddle/PaddleOCR.
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_mkldnn"] = "0"

from PIL import Image


# ============================================================
# LANGUAGE CONFIGURATION
# ============================================================

LANGUAGE_MAP = {
    "en-IN": "en",
    "hi-IN": "hi",
    "mr-IN": "mr",
    "ta-IN": "ta",
}

LANGUAGE_NAMES = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "mr-IN": "Marathi",
    "ta-IN": "Tamil",
}


# ============================================================
# OCR LANGUAGE MAP
# ============================================================

OCR_LANGUAGE_MAP = {
    "en-IN": "en",
    "hi-IN": "hi",
    "mr-IN": "mr",
    "ta-IN": "ta",
}


# ============================================================
# OCR ENGINE CACHE
# ============================================================

_ocr_engines = {}


def get_ocr_engine(source_language: str):
    """
    Create/load PaddleOCR lazily.

    OneDNN / MKLDNN is explicitly disabled because the
    installed PaddlePaddle build can fail with:

        OneDnnContext does not have the input Filter
        [operator < fused_conv2d > error]

    This keeps OCR on the normal CPU path.
    """

    if source_language not in OCR_LANGUAGE_MAP:
        source_language = "en-IN"

    if source_language in _ocr_engines:
        return _ocr_engines[source_language]

    try:
        from paddleocr import PaddleOCR

    except ImportError as exc:
        raise RuntimeError(
            "PaddleOCR is not installed. "
            "Run: pip install paddlepaddle && "
            "pip install \"paddleocr<3.0\""
        ) from exc

    ocr_language = OCR_LANGUAGE_MAP[source_language]

    print()
    print("======================================")
    print("       VOXIFY IMAGE OCR")
    print("======================================")
    print("Loading OCR language:", ocr_language)
    print("OneDNN / MKLDNN: DISABLED")

    # --------------------------------------------------------
    # PaddleOCR 2.x configuration
    # --------------------------------------------------------

    try:
        engine = PaddleOCR(
            lang=ocr_language,
            use_angle_cls=True,
            use_mkldnn=False,
            show_log=False,
        )

    except TypeError:
        # Some PaddleOCR versions do not accept show_log.
        try:
            engine = PaddleOCR(
                lang=ocr_language,
                use_angle_cls=True,
                use_mkldnn=False,
            )

        except TypeError:
            # Final compatibility fallback for versions where
            # use_mkldnn is exposed differently.
            engine = PaddleOCR(
                lang=ocr_language,
                use_angle_cls=True,
            )

    _ocr_engines[source_language] = engine

    print("OCR engine loaded:", ocr_language)
    print("======================================")
    print()

    return engine


# ============================================================
# IMAGE VALIDATION
# ============================================================

MAX_IMAGE_SIZE = 10 * 1024 * 1024

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}


def validate_image(
    image_bytes: bytes,
    content_type: str | None = None,
) -> None:

    if not image_bytes:
        raise ValueError(
            "Image file is empty."
        )

    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise ValueError(
            "Image must be 10 MB or smaller."
        )

    if content_type:
        normalized_type = (
            content_type
            .lower()
            .split(";")[0]
            .strip()
        )

        if normalized_type not in SUPPORTED_IMAGE_TYPES:
            raise ValueError(
                "Unsupported image format. "
                "Use JPG, JPEG, PNG or WEBP."
            )


# ============================================================
# PIL IMAGE
# ============================================================

def load_image(
    image_bytes: bytes,
) -> Image.Image:

    try:
        image = Image.open(
            io.BytesIO(image_bytes)
        )

        image.load()

    except Exception as exc:
        raise ValueError(
            "The uploaded file is not a valid image."
        ) from exc

    return image.convert("RGB")


# ============================================================
# OCR RESULT NORMALIZATION
# ============================================================

def _extract_text_from_old_result(
    result,
) -> List[str]:

    texts: List[str] = []

    if not result:
        return texts

    try:

        for page in result:

            if not page:
                continue

            for line in page:

                if not line:
                    continue

                try:
                    text_data = line[1]

                    if isinstance(
                        text_data,
                        (list, tuple),
                    ) and len(text_data) > 0:

                        text = str(
                            text_data[0]
                        ).strip()

                    else:
                        text = str(
                            text_data
                        ).strip()

                    if text:
                        texts.append(text)

                except Exception:
                    continue

    except Exception:
        return texts

    return texts


def _extract_text_from_new_result(
    result,
) -> List[str]:
    """
    Compatibility parser for PaddleOCR result objects
    returned by newer PaddleOCR versions.
    """

    texts: List[str] = []

    if not result:
        return texts

    try:

        # PaddleOCR may return a list of dictionaries / result
        # objects containing rec_texts.
        for item in result:

            if item is None:
                continue

            # Dictionary result.
            if isinstance(item, dict):

                rec_texts = item.get("rec_texts")

                if isinstance(rec_texts, list):

                    for text in rec_texts:

                        text = str(text).strip()

                        if text:
                            texts.append(text)

                    continue

            # PaddleOCR Result object.
            try:
                rec_texts = item.get(
                    "rec_texts"
                )

                if isinstance(rec_texts, list):

                    for text in rec_texts:

                        text = str(text).strip()

                        if text:
                            texts.append(text)

            except Exception:
                pass

    except Exception:
        pass

    return texts


# ============================================================
# OCR RESULT PARSER
# ============================================================

def _normalize_ocr_result(
    result,
) -> List[str]:

    # First try the classic PaddleOCR 2.x format.
    texts = _extract_text_from_old_result(
        result
    )

    if texts:
        return texts

    # Then try newer PaddleOCR result format.
    return _extract_text_from_new_result(
        result
    )


# ============================================================
# OCR
# ============================================================

def extract_text(
    image_bytes,
    source_language: str = "en-IN",
) -> str:
    """
    Extract text from image bytes or a PIL Image.

    Accepts:
        - bytes
        - bytearray
        - PIL.Image.Image
    """

    # --------------------------------------------------------
    # Normalize input
    # --------------------------------------------------------

    if isinstance(
        image_bytes,
        Image.Image,
    ):

        image = image_bytes.convert(
            "RGB"
        )

        buffer = io.BytesIO()

        image.save(
            buffer,
            format="PNG",
        )

        image_bytes = buffer.getvalue()

    elif isinstance(
        image_bytes,
        bytearray,
    ):

        image_bytes = bytes(
            image_bytes
        )

    if not isinstance(
        image_bytes,
        bytes,
    ):
        raise ValueError(
            "Image input must be bytes or a PIL image."
        )

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    validate_image(
        image_bytes
    )

    # --------------------------------------------------------
    # Load image
    # --------------------------------------------------------

    image = load_image(
        image_bytes
    )

    # --------------------------------------------------------
    # OCR engine
    # --------------------------------------------------------

    engine = get_ocr_engine(
        source_language
    )

    # PaddleOCR accepts a numpy image.
    import numpy as np

    image_array = np.array(
        image
    )

    # --------------------------------------------------------
    # OCR inference
    # --------------------------------------------------------

    try:

        result = engine.ocr(
            image_array,
            cls=True,
        )

    except TypeError:

        result = engine.ocr(
            image_array
        )

    # --------------------------------------------------------
    # Parse result
    # --------------------------------------------------------

    texts = _normalize_ocr_result(
        result
    )

    text = "\n".join(
        texts
    ).strip()

    if not text:
        raise RuntimeError(
            "No readable text was found in the image."
        )

    return text


# ============================================================
# MAIN SERVICE
# ============================================================

def process_image(
    image_bytes: bytes,
    source_language: str = "en-IN",
) -> dict:

    text = extract_text(
        image_bytes=image_bytes,
        source_language=source_language,
    )

    return {
        "success": True,
        "source_language": source_language,
        "source_language_name": LANGUAGE_NAMES.get(
            source_language,
            source_language,
        ),
        "extracted_text": text,
    }


# ============================================================
# IMAGE TRANSLATION SERVICE COMPATIBILITY CLASS
# ============================================================

class ImageTranslationService:
    """
    Service wrapper for Voxify Image Translation.
    """

    def __init__(self):
        pass

    def validate(
        self,
        image_bytes: bytes,
    ) -> None:

        validate_image(
            image_bytes
        )

    def load(
        self,
        image_bytes: bytes,
    ):

        return load_image(
            image_bytes
        )

    def extract(
        self,
        image,
        source_language: str | None = None,
    ) -> str:

        language = (
            source_language
            or "en-IN"
        )

        return extract_text(
            image,
            source_language=language,
        )

    def process(
        self,
        image_bytes: bytes,
        source_language: str | None = None,
    ):

        language = (
            source_language
            or "en-IN"
        )

        return process_image(
            image_bytes,
            source_language=language,
        )

    def translate(
        self,
        image_bytes: bytes,
        source_language: str | None = None,
        target_language: str = "en-IN",
    ):

        language = (
            source_language
            or "en-IN"
        )

        return process_image(
            image_bytes,
            source_language=language,
        )