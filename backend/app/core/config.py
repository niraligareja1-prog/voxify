"""
Central application settings.

All values come from environment variables / the ".env" file, so no
secret or environment-specific value is ever hard-coded in the code.
Usage anywhere in the backend:

    from app.core.config import get_settings
    settings = get_settings()
"""

from functools import lru_cache
from typing import Dict, List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# ============================================================
# Supported Languages
# ============================================================

SUPPORTED_LANGUAGES: Dict[str, str] = {
    "en": "English",
    "gu": "Gujarati",
    "hi": "Hindi",
    "mr": "Marathi",
    "ta": "Tamil",
}


MB = 1024 * 1024


# ============================================================
# Settings
# ============================================================

class Settings(BaseSettings):

    # --------------------------------------------------------
    # App
    # --------------------------------------------------------

    app_name: str = "Voxify"
    app_version: str = "1.0.0"
    app_env: str = "development"
    debug: bool = False

    # --------------------------------------------------------
    # Server
    # --------------------------------------------------------

    host: str = "127.0.0.1"
    port: int = 8000

    # --------------------------------------------------------
    # CORS
    # --------------------------------------------------------

    cors_origins: str = (
        "http://127.0.0.1:5500,"
        "http://localhost:5500,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173"
    )

    # --------------------------------------------------------
    # Upload limits
    # --------------------------------------------------------

    max_video_mb: int = Field(50, gt=0)
    max_audio_mb: int = Field(25, gt=0)
    max_pdf_mb: int = Field(20, gt=0)
    max_image_mb: int = Field(10, gt=0)
    max_text_file_mb: int = Field(5, gt=0)

    # --------------------------------------------------------
    # Pydantic Settings
    # --------------------------------------------------------

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ========================================================
    # Helpers
    # ========================================================

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origins_list(self) -> List[str]:
        """
        Convert comma-separated CORS origins into a clean list.

        During development we always allow both React/Vite origins:
            http://localhost:5173
            http://127.0.0.1:5173
        """

        origins = [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

        # React + Vite development origins
        if not self.is_production:
            development_origins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
            ]

            for origin in development_origins:
                if origin not in origins:
                    origins.append(origin)

        return origins

    @property
    def max_upload_bytes(self) -> Dict[str, int]:
        """Size limits per file type, in bytes."""

        return {
            "video": self.max_video_mb * MB,
            "audio": self.max_audio_mb * MB,
            "pdf": self.max_pdf_mb * MB,
            "image": self.max_image_mb * MB,
            "text": self.max_text_file_mb * MB,
        }


# ============================================================
# Cached Settings
# ============================================================

@lru_cache
def get_settings() -> Settings:
    """Create Settings once and reuse it."""

    return Settings()