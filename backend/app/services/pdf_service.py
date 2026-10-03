from __future__ import annotations



import os

import re
import json
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from typing import Dict, List, Tuple



import fitz

from app.translation import translate_with_indictrans2

# ============================================================

# LANGUAGE CONFIG

# ============================================================



LANGUAGE_MAP = {

    "en-IN": "en",

    "hi-IN": "hi",

    "gu-IN": "gu",

    "mr-IN": "mr",

    "ta-IN": "ta",

}





LANGUAGE_NAMES = {

    "en-IN": "English",

    "hi-IN": "Hindi",

    "gu-IN": "Gujarati",

    "mr-IN": "Marathi",

    "ta-IN": "Tamil",

}





# ============================================================

# FONT SEARCH

# ============================================================



FONT_CANDIDATES = {

    # Prefer Noto fonts. Nirmala UI is a Windows fallback for Indian scripts.
    "gu-IN": [
        r"C:\Windows\Fonts\NotoSansGujarati-Regular.ttf",
        r"C:\Windows\Fonts\NotoSansGujarati[wght].ttf",
        r"C:\Windows\Fonts\Nirmala.ttf",
        r"C:\Windows\Fonts\NirmalaUI.ttf",
    ],

    "hi-IN": [
        r"C:\Windows\Fonts\NotoSansDevanagari-Regular.ttf",
        r"C:\Windows\Fonts\NotoSansDevanagari[wght].ttf",
        r"C:\Windows\Fonts\Nirmala.ttf",
        r"C:\Windows\Fonts\NirmalaUI.ttf",
    ],

    "mr-IN": [
        r"C:\Windows\Fonts\NotoSansDevanagari-Regular.ttf",
        r"C:\Windows\Fonts\NotoSansDevanagari[wght].ttf",
        r"C:\Windows\Fonts\Nirmala.ttf",
        r"C:\Windows\Fonts\NirmalaUI.ttf",
    ],

    "ta-IN": [
        r"C:\Windows\Fonts\NotoSansTamil-Regular.ttf",
        r"C:\Windows\Fonts\NotoSansTamil[wght].ttf",
        r"C:\Windows\Fonts\Nirmala.ttf",
        r"C:\Windows\Fonts\NirmalaUI.ttf",
    ],

    "en-IN": [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\Arial.ttf",
        r"C:\Windows\Fonts\NotoSans-Regular.ttf",
    ],
}



def find_font(target_language: str) -> str | None:

    """

    Find a Unicode font installed on Windows.



    If the required Noto font is unavailable, return None.

    """



    candidates = FONT_CANDIDATES.get(

        target_language,

        FONT_CANDIDATES["en-IN"],

    )



    for font_path in candidates:

        if os.path.exists(font_path):

            return font_path



    return None





# ============================================================

# TEXT HELPERS

# ============================================================



def clean_text(text: str) -> str:

    """

    Normalize extracted PDF text while preserving

    meaningful line breaks.

    """



    if not text:

        return ""



    text = text.replace("\u00a0", " ")

    text = text.replace("\r", "\n")



    # Normalize tabs / repeated spaces.

    text = re.sub(r"[ \t]+", " ", text)



    # Keep a maximum of two consecutive newlines.

    text = re.sub(r"\n{3,}", "\n\n", text)



    return text.strip()





def should_translate(text: str) -> bool:

    """

    Ignore blocks containing no meaningful text.

    """



    if not text:

        return False



    return bool(

        re.search(

            r"\w|[^\x00-\x7F]",

            text,

        )

    )





def split_for_translation(

    text: str,

    max_chars: int = 3000,

) -> List[str]:

    """

    Split long text into manageable translation chunks.

    """



    text = clean_text(text)



    if not text:

        return []



    if len(text) <= max_chars:

        return [text]



    paragraphs = re.split(

        r"\n\s*\n",

        text,

    )



    chunks: List[str] = []

    current = ""



    for paragraph in paragraphs:

        paragraph = paragraph.strip()



        if not paragraph:

            continue



        if (

            current

            and len(current) + len(paragraph) + 2 <= max_chars

        ):

            current = (

                f"{current}\n\n{paragraph}"

            )

            continue



        if current:

            chunks.append(current)



        # Very long paragraph.

        if len(paragraph) > max_chars:

            for i in range(

                0,

                len(paragraph),

                max_chars,

            ):

                chunks.append(

                    paragraph[

                        i:i + max_chars

                    ]

                )



            current = ""



        else:

            current = paragraph



    if current:

        chunks.append(current)



    return chunks





# ============================================================

# TRANSLATOR

# ============================================================



def _mymemory_translate_request(
    text: str,
    source: str,
    target: str,
) -> str:
    """
    Translate one small text chunk through the MyMemory REST API.

    MyMemory's public GET API has a small query-size limit, so
    callers keep chunks below the limit.
    """

    if not text:
        return ""

    langpair = f"{source}|{target}"

    query = urlencode(
        {
            "q": text,
            "langpair": langpair,
            "mt": "1",
        }
    )

    url = (
        "https://api.mymemory.translated.net/get?"
        + query
    )

    request = Request(
        url,
        headers={
            "User-Agent": "Voxify/1.0",
            "Accept": "application/json",
        },
        method="GET",
    )

    try:
        with urlopen(
            request,
            timeout=30,
        ) as response:
            raw_response = response.read().decode(
                "utf-8",
                errors="replace",
            )

        data = json.loads(raw_response)

    except HTTPError as exc:
        raise RuntimeError(
            f"MyMemory HTTP error {exc.code}"
        ) from exc

    except URLError as exc:
        raise RuntimeError(
            f"MyMemory network error: {exc.reason}"
        ) from exc

    except Exception as exc:
        raise RuntimeError(
            f"MyMemory request failed: {exc}"
        ) from exc

    response_status = data.get(
        "responseStatus"
    )

    if response_status not in (
        200,
        "200",
        None,
    ):
        details = data.get(
            "responseDetails"
        )

        raise RuntimeError(
            "MyMemory returned an error: "
            f"{details or response_status}"
        )

    response_data = data.get(
        "responseData",
        {},
    )

    translated = response_data.get(
        "translatedText",
        "",
    )

    if translated is None:
        translated = ""

    translated = str(
        translated
    ).strip()

    if not translated:
        raise RuntimeError(
            "MyMemory returned an empty translation."
        )

    return translated


def _split_mymemory_chunks(
    text: str,
    max_bytes: int = 450,
) -> List[str]:
    """
    Split text into chunks that stay safely below
    MyMemory's approximately 500-byte request limit.
    """

    if not text:
        return []

    chunks: List[str] = []
    current = ""

    for piece in re.split(
        r"(\s+)",
        text,
    ):
        if not piece:
            continue

        candidate = current + piece

        if (
            current
            and len(candidate.encode("utf-8"))
            > max_bytes
        ):
            chunks.append(
                current.strip()
            )
            current = piece
        else:
            current = candidate

    if current.strip():
        chunks.append(
            current.strip()
        )

    return chunks


def _google_translate(
    text: str,
    source: str,
    target: str,
) -> str:
    """
    Compatibility wrapper for the PDF translation pipeline.

    PDF translation uses the same AI4Bharat IndicTrans2 engine as
    the main Voxify text translation feature. The old function name
    is kept so the rest of the PDF service remains compatible.

    The input text is split into smaller chunks because IndicTrans2
    has a bounded token window. Each chunk is translated locally,
    so PDF translation does not depend on the rate-limited MyMemory
    service.
    """

    if not text:
        return ""

    if source == target:
        return text

    language_codes = {
        "en": "en-IN",
        "hi": "hi-IN",
        "gu": "gu-IN",
        "mr": "mr-IN",
        "ta": "ta-IN",
    }

    source_code = language_codes.get(source)
    target_code = language_codes.get(target)

    if not source_code or not target_code:
        raise ValueError(
            f"Unsupported PDF translation pair: {source}->{target}"
        )

    chunks = split_for_translation(text, max_chars=1200)
    translated_chunks: List[str] = []

    for chunk in chunks:
        translated = translate_with_indictrans2(
            chunk,
            source_code,
            target_code,
        )

        if translated:
            translated_chunks.append(translated.strip())

    return "\\n\\n".join(translated_chunks).strip()

# ============================================================

# BATCH TRANSLATION

# ============================================================



def translate_blocks(
    texts: List[str],
    source_language: str,
    target_language: str,
) -> List[str]:
    """
    Translate PDF text blocks in their original order.

    Duplicate blocks are cached locally to reduce model calls, while
    each unique block is translated independently so internal PDF
    markers cannot be changed by the translation model.
    """

    if not texts:
        return []

    source = LANGUAGE_MAP.get(source_language)
    target = LANGUAGE_MAP.get(target_language)

    if not source or not target:
        raise ValueError("Unsupported PDF translation language.")

    if source == target:
        return texts[:]

    translated_map: Dict[str, str] = {}

    for text in texts:
        if text in translated_map:
            continue

        cleaned = clean_text(text)
        if not cleaned:
            translated_map[text] = ""
            continue

        translated_map[text] = _google_translate(
            cleaned,
            source,
            target,
        )

    return [
        translated_map.get(text, text)
        for text in texts
    ]



# ============================================================

# SINGLE TEXT TRANSLATION

# ============================================================



def translate_text(

    text: str,

    source_language: str,

    target_language: str,

) -> str:

    """

    Translate one piece of text.



    This function is kept for compatibility with other

    Voxify modules.

    """



    text = clean_text(text)



    if not text:

        return ""



    if source_language == target_language:

        return text



    chunks = split_for_translation(

        text,

        max_chars=3000,

    )



    if not chunks:

        return ""



    translated_chunks = translate_blocks(

        chunks,

        source_language,

        target_language,

    )



    return "\n\n".join(

        translated_chunks

    )





# ============================================================

# FONT SIZE CALCULATION

# ============================================================



def calculate_font_size(

    text: str,

    rect: fitz.Rect,

    original_size: float,

    font_path: str | None,

) -> float:

    """

    Estimate a suitable font size without inserting text

    into the page during the calculation.

    """



    if not text:

        return max(

            6.0,

            original_size,

        )



    original_size = max(

        6.0,

        float(original_size),

    )



    width = max(

        1.0,

        rect.width,

    )



    height = max(

        1.0,

        rect.height,

    )



    # --------------------------------------------------------

    # Calculate text width using actual font.

    # --------------------------------------------------------



    try:

        if font_path:

            font = fitz.Font(

                fontfile=font_path

            )



            lines = text.splitlines()



            longest_width = 0.0



            for line in lines:

                if not line:

                    continue



                line_width = font.text_length(

                    line,

                    fontsize=original_size,

                )



                longest_width = max(

                    longest_width,

                    line_width,

                )



            if longest_width > width:

                ratio = (

                    width

                    / longest_width

                )



                estimated = (

                    original_size

                    * ratio

                    * 0.95

                )



                original_size = min(

                    original_size,

                    estimated,

                )



    except Exception:

        pass



    # --------------------------------------------------------

    # Estimate number of lines.

    # --------------------------------------------------------



    line_count = max(

        1,

        len(text.splitlines()),

    )



    estimated_height = (

        line_count

        * original_size

        * 1.25

    )



    if estimated_height > height:

        ratio = (

            height

            / estimated_height

        )



        estimated = (

            original_size

            * ratio

            * 0.92

        )



        original_size = min(

            original_size,

            estimated,

        )



    return max(

        6.0,

        min(

            30.0,

            original_size,

        ),

    )





# ============================================================

# BLOCK EXTRACTION

# ============================================================



def extract_text_blocks(

    page: fitz.Page,

) -> List[Dict]:

    """

    Extract text blocks with their original coordinates

    and approximate font size.

    """



    page_dict = page.get_text(

        "dict",

        flags=fitz.TEXTFLAGS_TEXT,

    )



    blocks: List[Dict] = []



    for block in page_dict.get(

        "blocks",

        [],

    ):



        if block.get("type") != 0:

            continue



        lines = block.get(

            "lines",

            [],

        )



        spans = []



        for line in lines:



            for span in line.get(

                "spans",

                [],

            ):



                text = span.get(

                    "text",

                    "",

                )



                if text.strip():

                    spans.append(

                        span

                    )



        if not spans:

            continue



        text_parts = [

            span.get(

                "text",

                "",

            )

            for span in spans

        ]



        text = "".join(

            text_parts

        )



        text = clean_text(

            text

        )



        if not should_translate(

            text

        ):

            continue



        bbox = block.get(

            "bbox"

        )



        if not bbox or len(bbox) != 4:

            continue



        original_size = 11.0



        for span in spans:



            try:

                original_size = float(

                    span.get(

                        "size",

                        11,

                    )

                )



                break



            except Exception:

                pass



        blocks.append(

            {

                "rect": fitz.Rect(

                    bbox

                ),

                "text": text,

                "font_size": original_size,

            }

        )



    return blocks





# ============================================================

# PAGE TRANSLATION

# ============================================================



def translate_page(

    page: fitz.Page,

    source_language: str,

    target_language: str,

) -> Tuple[str, str]:

    """

    Translate one PDF page while keeping text approximately

    at its original positions.



    Images and drawings are retained.

    """



    blocks = extract_text_blocks(

        page

    )



    original_parts: List[str] = []

    translated_parts: List[str] = []



    if not blocks:

        return "", ""



    # --------------------------------------------------------

    # Find Unicode font.

    # --------------------------------------------------------



    font_path = find_font(

        target_language

    )



    font_name = "VoxifyUnicode"



    if font_path:

        try:

            page.insert_font(

                fontname=font_name,

                fontfile=font_path,

            )



        except Exception as exc:

            if target_language in {"gu-IN", "hi-IN", "mr-IN", "ta-IN"}:
                raise RuntimeError(
                    f"Unicode font could not be embedded for {LANGUAGE_NAMES.get(target_language, target_language)}: {exc}"
                ) from exc

            font_path = None



    if not font_path:

        # Do not silently use Helvetica for Indian scripts; it has no
        # Gujarati/Devanagari/Tamil glyphs and causes ????? in the PDF.
        if target_language in {"gu-IN", "hi-IN", "mr-IN", "ta-IN"}:
            raise RuntimeError(
                f"No Unicode font was found for {LANGUAGE_NAMES.get(target_language, target_language)}. "
                "Install Noto Sans for the target script or ensure Windows Nirmala.ttf is available."
            )

        font_name = "helv"



    # --------------------------------------------------------

    # Translate ALL blocks in batch.

    # --------------------------------------------------------



    original_texts = [

        block["text"]

        for block in blocks

    ]



    translated_texts = translate_blocks(

        original_texts,

        source_language,

        target_language,

    )



    translated_blocks = []



    for block, translated in zip(

        blocks,

        translated_texts,

    ):



        original = block[

            "text"

        ]



        translated = clean_text(

            translated

        )



        if not translated:

            translated = original



        translated_blocks.append(

            {

                **block,

                "translated": translated,

            }

        )



        original_parts.append(

            original

        )



        translated_parts.append(

            translated

        )



    # --------------------------------------------------------

    # Redact ONLY original text areas.

    #

    # Images and graphics remain.

    # --------------------------------------------------------



    for block in translated_blocks:



        rect = block[

            "rect"

        ]



        redact_rect = fitz.Rect(

            rect.x0 - 0.5,

            rect.y0 - 0.5,

            rect.x1 + 0.5,

            rect.y1 + 0.5,

        )



        page.add_redact_annot(

            redact_rect,

            fill=(1, 1, 1),

        )



    page.apply_redactions(

        images=fitz.PDF_REDACT_IMAGE_NONE,

        graphics=fitz.PDF_REDACT_LINE_ART_NONE,

        text=fitz.PDF_REDACT_TEXT_REMOVE,

    )



    # --------------------------------------------------------

    # Insert translated text at original coordinates.

    # --------------------------------------------------------



    for block in translated_blocks:



        rect = block[

            "rect"

        ]



        translated = block[

            "translated"

        ]



        if not translated:

            continue



        font_size = calculate_font_size(

            text=translated,

            rect=rect,

            original_size=block[

                "font_size"

            ],

            font_path=font_path,

        )



        # PyMuPDF returns a negative value when insert_textbox cannot fit
        # the text. The original implementation ignored that return value;
        # after redaction this can produce a PDF with blank text areas.
        candidate_rects = [
            fitz.Rect(rect),
            fitz.Rect(
                rect.x0,
                rect.y0,
                rect.x1,
                min(
                    page.rect.y1 - 2,
                    rect.y0 + max(rect.height * 2.5, font_size * 2.5),
                ),
            ),
            fitz.Rect(
                rect.x0,
                rect.y0,
                rect.x1,
                min(
                    page.rect.y1 - 2,
                    rect.y0 + max(rect.height * 4.0, font_size * 4.0),
                ),
            ),
        ]

        inserted = False
        last_result = None

        for candidate in candidate_rects:
            try:
                result = page.insert_textbox(
                    candidate,
                    translated,
                    fontsize=font_size,
                    fontname=font_name,
                    fontfile=font_path if font_path else None,
                    color=(0, 0, 0),
                    align=fitz.TEXT_ALIGN_LEFT,
                    overlay=True,
                )
                last_result = result

                if result >= 0:
                    inserted = True
                    break

            except Exception as exc:
                last_result = repr(exc)

        # Final fallback: draw from the original top-left point so a failed
        # textbox fit can never silently leave a redacted/blank text area.
        if not inserted:
            try:
                baseline = rect.y0 + max(font_size, 7.0)
                result = page.insert_text(
                    fitz.Point(rect.x0, baseline),
                    translated,
                    fontsize=font_size,
                    fontname=font_name,
                    fontfile=font_path if font_path else None,
                    color=(0, 0, 0),
                    overlay=True,
                )
                inserted = True
                last_result = result
            except Exception as exc:
                last_result = repr(exc)

        if not inserted:
            raise RuntimeError(
                f"Could not render translated text on page {page.number + 1}: {last_result}"
            )


    return (

        "\n\n".join(

            original_parts

        ),

        "\n\n".join(

            translated_parts

        ),

    )





# ============================================================

# COMPLETE PDF TRANSLATION

# ============================================================



def translate_pdf(

    pdf_bytes: bytes,

    source_language: str,

    target_language: str,

) -> Tuple[bytes, str, str]:

    """

    Translate a complete PDF.



    The PDF is modified directly with PyMuPDF so:



    - page count remains the same

    - page dimensions remain the same

    - images remain

    - drawings remain

    - text is replaced approximately at original positions

    """



    if not pdf_bytes:

        raise ValueError(

            "The uploaded PDF is empty."

        )



    if source_language not in LANGUAGE_MAP:

        raise ValueError(

            f"Unsupported source language: "

            f"{source_language}"

        )



    if target_language not in LANGUAGE_MAP:

        raise ValueError(

            f"Unsupported target language: "

            f"{target_language}"

        )



    if source_language == target_language:

        raise ValueError(

            "Source and target languages cannot be the same."

        )



    # ========================================================

    # OPEN PDF

    # ========================================================



    try:



        document = fitz.open(

            stream=pdf_bytes,

            filetype="pdf",

        )



    except Exception as exc:



        raise ValueError(

            "The uploaded file is not a valid PDF."

        ) from exc



    if document.page_count == 0:



        document.close()



        raise ValueError(

            "The PDF does not contain any pages."

        )



    all_original: List[str] = []

    all_translated: List[str] = []



    try:



        # ====================================================

        # PROCESS EACH PAGE

        # ====================================================



        for page_number, page in enumerate(

            document,

            start=1,

        ):



            print(

                f"Translating PDF page "

                f"{page_number}/"

                f"{document.page_count}"

            )



            original, translated = translate_page(

                page,

                source_language,

                target_language,

            )



            if original:

                all_original.append(

                    original

                )



            if translated:

                all_translated.append(

                    translated

                )



        # ====================================================

        # SAVE PDF

        # ====================================================



        output = document.tobytes(

            garbage=4,

            deflate=True,

            clean=True,

        )



    finally:



        document.close()



    return (

        output,

        "\n\n".join(

            all_original

        ),

        "\n\n".join(

            all_translated

        ),

    )