"""

Voxify - PDF Translation API

"""



from __future__ import annotations



import base64

import re

import fitz



from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from fastapi.responses import JSONResponse



from app.services.pdf_service import (

    LANGUAGE_NAMES,

    translate_pdf,

)





router = APIRouter(

    prefix="/translation",

    tags=["PDF Translation"],

)





# ============================================================

# CONFIGURATION

# ============================================================



MAX_PDF_SIZE = 20 * 1024 * 1024





# Internal language codes used by Voxify

SUPPORTED_LANGUAGES = {

    "en-IN",

    "hi-IN",

    "gu-IN",

    "mr-IN",

    "ta-IN",

}





# Accept both frontend names and internal language codes.

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





DISPLAY_LANGUAGE_NAMES = {

    "en-IN": "English",

    "hi-IN": "Hindi",

    "gu-IN": "Gujarati",

    "mr-IN": "Marathi",

    "ta-IN": "Tamil",

}





# ============================================================

# HELPERS

# ============================================================



def normalize_language(language: str) -> str:

    """

    Convert frontend language names/codes into Voxify

    internal language codes.



    Examples:

        English  -> en-IN

        english  -> en-IN

        en       -> en-IN

        en-IN    -> en-IN

        Gujarati -> gu-IN

        gu       -> gu-IN

    """



    if not language:

        return ""



    value = language.strip()



    # Already a supported internal code

    if value in SUPPORTED_LANGUAGES:

        return value



    # Case-insensitive alias lookup

    normalized = LANGUAGE_ALIASES.get(

        value.lower()

    )



    if normalized:

        return normalized



    return ""





def safe_filename(filename: str) -> str:

    """

    Keep the original PDF filename safe.

    """



    filename = filename or "document.pdf"



    filename = re.sub(

        r"[^A-Za-z0-9._-]",

        "_",

        filename,

    )



    if not filename.lower().endswith(".pdf"):

        filename += ".pdf"



    return filename





def translated_filename(filename: str) -> str:

    """

    Create the output filename.



    Example:

        document.pdf

        ->

        document_translated.pdf

    """



    filename = safe_filename(filename)



    if filename.lower().endswith(".pdf"):

        filename = filename[:-4]



    return f"{filename}_translated.pdf"





# ============================================================

# PDF TRANSLATION

# ============================================================



@router.post("/file")

async def translate_pdf_file(

    file: UploadFile = File(...),

    source_language: str = Form(...),

    target_language: str = Form(...),

):

    """

    Translate a PDF while preserving its page structure.



    Returns the translated PDF as Base64 so the existing

    pdf.html frontend can download it.

    """



    # ========================================================

    # VALIDATE FILE

    # ========================================================



    if not file.filename:

        raise HTTPException(

            status_code=400,

            detail="Please select a PDF file.",

        )



    if not file.filename.lower().endswith(".pdf"):

        raise HTTPException(

            status_code=400,

            detail="Only PDF files are supported.",

        )



    if (

        file.content_type

        and file.content_type != "application/pdf"

    ):

        raise HTTPException(

            status_code=400,

            detail="The uploaded file is not a PDF.",

        )



    # ========================================================

    # NORMALIZE LANGUAGES

    # ========================================================



    original_source_language = source_language

    original_target_language = target_language



    source_language = normalize_language(

        source_language

    )



    target_language = normalize_language(

        target_language

    )



    # ========================================================

    # VALIDATE SOURCE LANGUAGE

    # ========================================================



    if not source_language:

        raise HTTPException(

            status_code=400,

            detail=(

                f"Unsupported source language: "

                f"{original_source_language}. "

                f"Supported languages: "

                f"English, Hindi, Gujarati, Marathi, Tamil."

            ),

        )



    # ========================================================

    # VALIDATE TARGET LANGUAGE

    # ========================================================



    if not target_language:

        raise HTTPException(

            status_code=400,

            detail=(

                f"Unsupported target language: "

                f"{original_target_language}. "

                f"Supported languages: "

                f"English, Hindi, Gujarati, Marathi, Tamil."

            ),

        )



    # ========================================================

    # SAME LANGUAGE CHECK

    # ========================================================



    if source_language == target_language:

        raise HTTPException(

            status_code=400,

            detail=(

                "Source and target languages "

                "cannot be the same."

            ),

        )



    # ========================================================

    # READ FILE

    # ========================================================



    try:

        pdf_bytes = await file.read()



    except Exception as exc:

        raise HTTPException(

            status_code=400,

            detail="Could not read the uploaded PDF.",

        ) from exc



    # ========================================================

    # EMPTY FILE CHECK

    # ========================================================



    if not pdf_bytes:

        raise HTTPException(

            status_code=400,

            detail="The uploaded PDF is empty.",

        )



    # ========================================================

    # FILE SIZE CHECK

    # ========================================================



    if len(pdf_bytes) > MAX_PDF_SIZE:

        raise HTTPException(

            status_code=413,

            detail="PDF files must be 20 MB or smaller.",

        )



    # ========================================================

    # TRANSLATE PDF

    # ========================================================



    try:



        translated_bytes, original_text, translated_text = (

            translate_pdf(

                pdf_bytes=pdf_bytes,

                source_language=source_language,

                target_language=target_language,

            )

        )



    except ValueError as exc:



        raise HTTPException(

            status_code=400,

            detail=str(exc),

        ) from exc



    except Exception as exc:



        # Keep internal stack traces out of the API response.

        print(

            "PDF translation error:",

            repr(exc),

        )



        raise HTTPException(

            status_code=500,

            detail=(

                "PDF translation failed. "

                "Please try again."

            ),

        ) from exc



    # ========================================================

    # CHECK TRANSLATED PDF

    # ========================================================



    if not translated_bytes:

        raise HTTPException(

            status_code=500,

            detail="The translated PDF is empty.",

        )



    # ========================================================

    # CONVERT PDF TO BASE64

    # ========================================================



    translated_base64 = base64.b64encode(

        translated_bytes

    ).decode("ascii")



    # ========================================================

    # OUTPUT FILENAME

    # ========================================================



    output_filename = translated_filename(

        file.filename

    )



    # ========================================================

    # LANGUAGE DISPLAY NAMES

    # ========================================================



    source_language_name = DISPLAY_LANGUAGE_NAMES.get(

        source_language,

        LANGUAGE_NAMES.get(

            source_language,

            source_language,

        ),

    )



    target_language_name = DISPLAY_LANGUAGE_NAMES.get(

        target_language,

        LANGUAGE_NAMES.get(

            target_language,

            target_language,

        ),

    )



    # ========================================================

    # RESPONSE

    # ========================================================



    return JSONResponse(

        content={

            "success": True,



            "filename": output_filename,



            "source_language": source_language,

            "source_language_name": source_language_name,



            "target_language": target_language,

            "target_language_name": target_language_name,



            "translated_pdf_base64": translated_base64,



            "original_text": original_text,



            "translated_text": translated_text,



            "message": (

                "PDF translated successfully "

                "while preserving the document structure."

            ),

        }

    )

# ============================================================
# PDF SUMMARISATION
# ============================================================

def _extract_pdf_text_for_summary(pdf_bytes: bytes) -> str:
    """Extract readable text from a PDF for summarisation."""
    try:
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError("The uploaded file is not a valid PDF.") from exc

    if document.page_count == 0:
        document.close()
        raise ValueError("The PDF does not contain any pages.")

    pages = []
    try:
        for page in document:
            page_text = page.get_text("text") or ""
            page_text = re.sub(r"[ \t]+", " ", page_text)
            page_text = re.sub(r"\n{3,}", "\n\n", page_text)
            page_text = page_text.strip()
            if page_text:
                pages.append(page_text)
    finally:
        document.close()

    return "\n\n".join(pages).strip()


def _split_summary_sentences(text: str) -> list[str]:
    """Split extracted PDF text into reasonably clean sentences."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []

    parts = re.split(r"(?<=[.!?।॥])\s+", text)

    sentences = []
    for part in parts:
        part = part.strip(" \t\r\n-•")
        if len(part) >= 35:
            sentences.append(part)

    return sentences


def _extractive_summary(text: str, max_sentences: int = 8) -> str:
    """Create a deterministic extractive summary locally."""
    sentences = _split_summary_sentences(text)

    if not sentences:
        return " ".join(text.split()[:180]).strip()

    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    stop_words = {
        "the", "and", "for", "that", "this", "with", "from", "are", "was",
        "were", "have", "has", "had", "will", "would", "could", "should",
        "into", "about", "there", "their", "they", "them", "then", "than",
        "also", "which", "when", "where", "what", "while", "been", "being",
        "you", "your", "our", "but", "not", "can", "may", "its", "his",
        "her", "who", "how", "all", "more", "most", "such", "only",
        "में", "और", "का", "की", "के", "से", "को", "यह", "है", "था", "थे",
        "एक", "पर", "इस", "कि", "लिए", "तो", "भी", "ने",
    }

    words = re.findall(
        r"\b[\w\u0900-\u097F\u0A80-\u0AFF\u0B80-\u0BFF]+\b",
        text.lower(),
    )

    frequencies = {}
    for word in words:
        if len(word) < 3 or word in stop_words:
            continue
        frequencies[word] = frequencies.get(word, 0) + 1

    if not frequencies:
        return " ".join(sentences[:max_sentences])

    maximum = max(frequencies.values())
    frequencies = {
        word: count / maximum
        for word, count in frequencies.items()
    }

    scored = []
    total = len(sentences)

    for index, sentence in enumerate(sentences):
        sentence_words = re.findall(
            r"\b[\w\u0900-\u097F\u0A80-\u0AFF\u0B80-\u0BFF]+\b",
            sentence.lower(),
        )

        meaningful = [
            word
            for word in sentence_words
            if len(word) >= 3 and word not in stop_words
        ]

        frequency_score = (
            sum(frequencies.get(word, 0.0) for word in meaningful)
            / len(meaningful)
            if meaningful
            else 0.0
        )

        position_score = 1.0 - (index / max(total, 1)) * 0.35
        length_score = min(len(meaningful) / 18.0, 1.0)

        score = (
            frequency_score * 0.65
            + position_score * 0.20
            + length_score * 0.15
        )

        scored.append((score, index, sentence))

    selected = sorted(
        scored,
        key=lambda item: item[0],
        reverse=True,
    )[:max_sentences]

    selected.sort(key=lambda item: item[1])

    return " ".join(item[2] for item in selected).strip()


@router.post("/summarise")
async def summarise_pdf_file(
    file: UploadFile = File(...),
    max_sentences: int = Form(8),
):
    """
    Summarise a PDF document.

    This first version performs local extractive summarisation.
    Scanned/image-only PDFs require OCR.
    """
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Please select a PDF file.",
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported.",
        )

    if (
        file.content_type
        and file.content_type != "application/pdf"
    ):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a PDF.",
        )

    try:
        pdf_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Could not read the uploaded PDF.",
        ) from exc

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded PDF is empty.",
        )

    if len(pdf_bytes) > MAX_PDF_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF files must be 20 MB or smaller.",
        )

    try:
        extracted_text = _extract_pdf_text_for_summary(pdf_bytes)

        if not extracted_text:
            raise ValueError(
                "No selectable text was found in this PDF. "
                "Scanned/image-only PDFs require OCR before summarisation."
            )

        max_sentences = max(3, min(int(max_sentences), 20))

        summary = _extractive_summary(
            extracted_text,
            max_sentences=max_sentences,
        )

        if not summary:
            raise ValueError(
                "Could not generate a summary from this PDF."
            )

        return JSONResponse(
            content={
                "success": True,
                "filename": file.filename,
                "summary": summary,
                "extracted_text": extracted_text,
                "message": "PDF summarised successfully.",
            }
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        print("PDF summarisation error:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="PDF summarisation failed. Please try again.",
        ) from exc
