from pydantic import BaseModel, Field


class AudioTranscriptionResponse(BaseModel):
    success: bool = True
    detected_language: str
    detected_language_name: str
    transcribed_text: str = Field(..., min_length=1)