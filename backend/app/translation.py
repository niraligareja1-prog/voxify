import asyncio
from functools import lru_cache
from typing import Tuple

import torch
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from IndicTransToolkit.processor import IndicProcessor


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/translation",
    tags=["Translation"],
)


# ============================================================
# CONSTANTS
# ============================================================

MAX_TEXT_SIZE = 5 * 1024 * 1024
MAX_INPUT_TOKENS = 256
MAX_OUTPUT_TOKENS = 256
MAX_MODELS_IN_CACHE = 3


# ============================================================
# DEVICE
# ============================================================

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


# ============================================================
# INDIC TRANS 2 MODELS
# ============================================================

EN_INDIC_MODEL = "ai4bharat/indictrans2-en-indic-dist-200M"
INDIC_EN_MODEL = "ai4bharat/indictrans2-indic-en-dist-200M"
INDIC_INDIC_MODEL = "ai4bharat/indictrans2-indic-indic-dist-320M"


# ============================================================
# LANGUAGE MAP
# ============================================================

LANGUAGE_MAP = {
    "en-IN": "eng_Latn",
    "hi-IN": "hin_Deva",
    "gu-IN": "guj_Gujr",
    "mr-IN": "mar_Deva",
    "ta-IN": "tam_Taml",
}

LANGUAGE_NAMES = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "gu-IN": "Gujarati",
    "mr-IN": "Marathi",
    "ta-IN": "Tamil",
}


# ============================================================
# INDIC PROCESSOR
# ============================================================

# Official IndicTrans2 preprocessing/postprocessing.
# This is important for correct Indic scripts and Unicode output.
IP = IndicProcessor(inference=True)


# ============================================================
# MODEL CACHE
# ============================================================

@lru_cache(maxsize=MAX_MODELS_IN_CACHE)
def load_model(model_name: str):
    """
    Load an IndicTrans2 tokenizer/model only when required.
    Loaded models are cached for subsequent requests.
    """

    print()
    print("======================================")
    print("VOXIFY INDIC TRANS 2")
    print("Loading model...")
    print("Model:", model_name)
    print("Device:", DEVICE)
    print("======================================")

    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
    )

    model = AutoModelForSeq2SeqLM.from_pretrained(
        model_name,
        trust_remote_code=True,
    )

    model.to(DEVICE)
    model.eval()

    print("Model loaded successfully.")
    print("======================================")
    print()

    return tokenizer, model


# ============================================================
# MODEL TYPE
# ============================================================

def get_model_type(
    source_language: str,
    target_language: str,
) -> Tuple[str, str]:

    if source_language not in LANGUAGE_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported source language: {source_language}",
        )

    if target_language not in LANGUAGE_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: {target_language}",
        )

    source_is_english = source_language == "en-IN"
    target_is_english = target_language == "en-IN"

    # English -> Indic
    if source_is_english and not target_is_english:
        return "en-indic", EN_INDIC_MODEL

    # Indic -> English
    if not source_is_english and target_is_english:
        return "indic-en", INDIC_EN_MODEL

    # Indic -> Indic
    return "indic-indic", INDIC_INDIC_MODEL


# ============================================================
# LANGUAGE VALIDATION
# ============================================================

def get_model_language(language: str) -> str:

    if language not in LANGUAGE_MAP:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language code: {language}",
        )

    return LANGUAGE_MAP[language]


# ============================================================
# CORE INDIC TRANS 2 TRANSLATION
# ============================================================

def translate_with_indictrans2(
    text: str,
    source_language: str,
    target_language: str,
) -> str:

    source_code = get_model_language(source_language)
    target_code = get_model_language(target_language)

    # ========================================================
    # SAME LANGUAGE
    # ========================================================

    if source_language == target_language:
        return text.strip()

    # ========================================================
    # SELECT MODEL
    # ========================================================

    model_type, model_name = get_model_type(
        source_language,
        target_language,
    )

    print()
    print("Translation model:", model_type)
    print("Model name:", model_name)
    print("Source:", source_code)
    print("Target:", target_code)

    # ========================================================
    # LOAD CACHED MODEL
    # ========================================================

    tokenizer, model = load_model(model_name)

    # ========================================================
    # OFFICIAL INDIC TRANS 2 PREPROCESSING
    # ========================================================

    sentences = [text.strip()]

    processed_batch = IP.preprocess_batch(
        sentences,
        src_lang=source_code,
        tgt_lang=target_code,
        visualize=False,
    )

    # ========================================================
    # TOKENIZATION
    # ========================================================

    inputs = tokenizer(
        processed_batch,
        padding="longest",
        truncation=True,
        max_length=MAX_INPUT_TOKENS,
        return_tensors="pt",
    )

    inputs = {
        key: value.to(DEVICE)
        for key, value in inputs.items()
    }

    # ========================================================
    # GENERATION
    # ========================================================

    with torch.inference_mode():

        generated_tokens = model.generate(
            **inputs,
            use_cache=True,
            max_length=MAX_OUTPUT_TOKENS,
            num_beams=5,
            num_return_sequences=1,
        )

    # ========================================================
    # TARGET VOCABULARY DECODE
    # ========================================================

    with tokenizer.as_target_tokenizer():

        decoded = tokenizer.batch_decode(
            generated_tokens,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        )

    # ========================================================
    # OFFICIAL INDIC TRANS 2 POSTPROCESSING
    # ========================================================

    translated_batch = IP.postprocess_batch(
        decoded,
        lang=target_code,
    )

    translated_text = translated_batch[0].strip()

    return translated_text


def translate_batch_with_indictrans2(
    texts: list[str],
    source_language: str,
    target_language: str,
) -> list[str]:
    """Translate multiple short PDF blocks in one model generation batch."""
    if not texts:
        return []

    source_code = get_model_language(source_language)
    target_code = get_model_language(target_language)
    if source_language == target_language:
        return [text.strip() for text in texts]

    _, model_name = get_model_type(source_language, target_language)
    tokenizer, model = load_model(model_name)

    processed = IP.preprocess_batch(
        [text.strip() for text in texts],
        src_lang=source_code,
        tgt_lang=target_code,
        visualize=False,
    )
    inputs = tokenizer(
        processed,
        padding=True,
        truncation=True,
        max_length=MAX_INPUT_TOKENS,
        return_tensors="pt",
    )
    inputs = {key: value.to(DEVICE) for key, value in inputs.items()}

    with torch.inference_mode():
        generated = model.generate(
            **inputs,
            use_cache=True,
            max_length=MAX_OUTPUT_TOKENS,
            num_beams=5,
            num_return_sequences=1,
        )

    with tokenizer.as_target_tokenizer():
        decoded = tokenizer.batch_decode(
            generated,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        )

    return [
        value.strip()
        for value in IP.postprocess_batch(decoded, lang=target_code)
    ]


# ============================================================
# BACKWARD-COMPATIBLE WRAPPER
# ============================================================

def translate_fast(
    text: str,
    source_language: str,
    target_language: str,
) -> str:
    """
    Compatibility wrapper for existing routes such as image.py.

    Translation provider remains IndicTrans2 only.
    No GoogleTranslator or MyMemory is used.
    """

    return translate_with_indictrans2(
        text,
        source_language,
        target_language,
    )


# ============================================================
# REQUEST MODEL
# ============================================================

class TextTranslationRequest(BaseModel):
    text: str
    source_language: str
    target_language: str


# ============================================================
# HEALTH CHECK
# ============================================================

@router.get("/health")
async def translation_health():

    cache_info = load_model.cache_info()

    return {
        "success": True,
        "service": "Voxify Translation",
        "provider": "IndicTrans2",
        "device": DEVICE,
        "models": {
            "en_indic": EN_INDIC_MODEL,
            "indic_en": INDIC_EN_MODEL,
            "indic_indic": INDIC_INDIC_MODEL,
        },
        "supported_languages": list(LANGUAGE_MAP.keys()),
        "language_names": LANGUAGE_NAMES,
        "cache": {
            "max_models": cache_info.maxsize,
            "loaded_models": cache_info.currsize,
            "hits": cache_info.hits,
            "misses": cache_info.misses,
        },
    }


# ============================================================
# TEXT TRANSLATION
# ============================================================

@router.post("/text")
async def translate_text(
    request: TextTranslationRequest,
):

    try:

        # ------------------------------------------------------
        # VALIDATE TEXT
        # ------------------------------------------------------

        if not request.text or not request.text.strip():
            raise HTTPException(
                status_code=400,
                detail="Text cannot be empty.",
            )

        # ------------------------------------------------------
        # MAXIMUM TEXT SIZE
        # ------------------------------------------------------

        if len(request.text.encode("utf-8")) > MAX_TEXT_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Text exceeds the maximum allowed size of 5 MB.",
            )

        # ------------------------------------------------------
        # VALIDATE LANGUAGES
        # ------------------------------------------------------

        source_code = get_model_language(
            request.source_language,
        )

        target_code = get_model_language(
            request.target_language,
        )

        # ------------------------------------------------------
        # SAME LANGUAGE
        # ------------------------------------------------------

        if request.source_language == request.target_language:

            return {
                "success": True,
                "provider": "IndicTrans2",
                "model": None,
                "model_type": "same-language",
                "source_language": request.source_language,
                "target_language": request.target_language,
                "source_code": source_code,
                "target_code": target_code,
                "original_text": request.text,
                "translated_text": request.text,
            }

        # ------------------------------------------------------
        # SELECT MODEL
        # ------------------------------------------------------

        model_type, model_name = get_model_type(
            request.source_language,
            request.target_language,
        )

        # ------------------------------------------------------
        # LOG
        # ------------------------------------------------------

        print()
        print("======================================")
        print("VOXIFY TEXT TRANSLATION")
        print("======================================")

        print(
            "Source:",
            request.source_language,
            "(",
            source_code,
            ")",
        )

        print(
            "Target:",
            request.target_language,
            "(",
            target_code,
            ")",
        )

        print("Model type:", model_type)
        print("Model:", model_name)
        print("Characters:", len(request.text))
        print("======================================")

        # ------------------------------------------------------
        # RUN MODEL OUTSIDE EVENT LOOP
        # ------------------------------------------------------

        translated_text = await asyncio.to_thread(
            translate_with_indictrans2,
            request.text,
            request.source_language,
            request.target_language,
        )

        # ------------------------------------------------------
        # EMPTY TRANSLATION CHECK
        # ------------------------------------------------------

        if not translated_text:
            raise HTTPException(
                status_code=500,
                detail="IndicTrans2 returned an empty translation.",
            )

        # ------------------------------------------------------
        # SUCCESS
        # ------------------------------------------------------

        print("Translation completed.")
        print("Result:", translated_text)
        print("======================================")
        print()

        return {
            "success": True,
            "provider": "IndicTrans2",
            "model": model_name,
            "model_type": model_type,
            "source_language": request.source_language,
            "target_language": request.target_language,
            "source_code": source_code,
            "target_code": target_code,
            "original_text": request.text,
            "translated_text": translated_text,
        }

    except HTTPException:
        raise

    except Exception as e:

        print()
        print("======================================")
        print("TRANSLATION ERROR")
        print("======================================")
        print("Error type:", type(e).__name__)
        print("Error:", str(e))
        print("======================================")
        print()

        raise HTTPException(
            status_code=500,
            detail="Text translation failed: " + str(e),
        )
