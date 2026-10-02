"""
Voxify backend - application entry point.

Run (from the backend/ folder):
    uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager

from app.api.routes.storage import router as storage_router

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.profile import router as profile_router
from app.api.router import api_router
from app.api.routes.audio import router as audio_router
from app.api.routes.history import router as history_router
from app.api.routes.image import router as image_router
from app.api.routes.pdf import router as pdf_router
from app.core.config import get_settings
from app.core.security import SecurityHeadersMiddleware
from app.text_to_audio import router as text_to_audio_router
from app.translation import router as translation_router
from app.utils.exceptions import register_exception_handlers


# ==========================================
# Settings
# ==========================================

settings = get_settings()


# ==========================================
# Logging
# ==========================================

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

logger = logging.getLogger("voxify")


# ==========================================
# Application Lifespan
# ==========================================

@asynccontextmanager
async def lifespan(_: FastAPI):

    logger.info(
        "Starting %s v%s (%s)",
        settings.app_name,
        settings.app_version,
        settings.app_env,
    )

    yield

    logger.info(
        "Shutting down %s",
        settings.app_name,
    )


# ==========================================
# Create FastAPI Application
# ==========================================

def create_app() -> FastAPI:

    app = FastAPI(
        title=f"{settings.app_name} API",
        description="AI Powered Multilingual Content Processing Platform",
        version=settings.app_version,
        lifespan=lifespan,

        # API documentation
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
    )


    # ======================================
    # Security Headers
    # ======================================

    app.add_middleware(
        SecurityHeadersMiddleware
    )


    # ======================================
    # CORS
    # ======================================

    app.add_middleware(
        CORSMiddleware,

        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
        ],

        # Development LAN support: allow private-network frontend hosts
        # on the Vite/static frontend ports without hard-coding one DHCP IP.
        allow_origin_regex=r"^https?://(?:(?:localhost)|(?:127\.0\.0\.1)|(?:10\.\d+\.\d+\.\d+)|(?:192\.168\.\d+\.\d+)|(?:172\.(?:1[6-9]|2\d|3[0-1])\.\d+\.\d+)):(?:5173|5500)$",

        allow_credentials=True,

        allow_methods=[
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],

        allow_headers=[
            "Authorization",
            "Content-Type",
        ],
    )


    # ======================================
    # Exception Handlers
    # ======================================

    register_exception_handlers(app)


    # ======================================
    # Existing API Routes
    # ======================================

    app.include_router(
        api_router,
        prefix=""
    )


    # ======================================
    # Translation API
    # ======================================

    app.include_router(
        translation_router,
        prefix="/api/v1"
    )


    # ======================================
    # Text to Audio API
    # ======================================

    app.include_router(
        text_to_audio_router,
        prefix="/api/v1"
    )


    # ======================================
    # Audio API
    # ======================================

    app.include_router(
        audio_router,
        prefix="/api/v1"
    )


    # ======================================
    # PDF API
    # ======================================

    app.include_router(
        pdf_router,
        prefix="/api/v1",
    )


    # ======================================
    # Image API
    # ======================================

    app.include_router(
        image_router,
        prefix="/api/v1",
    )


    # ======================================
    # History API
    # ======================================

    app.include_router(
        history_router,
        prefix="/api/v1",
    )

    app.include_router(
        profile_router,
        prefix="/api/v1",
    )

    app.include_router(
        storage_router,
          prefix="/api/v1",
    )
    # ======================================
    # Root API
    # ======================================

    @app.get(
        "/",
        include_in_schema=False
    )
    def root():

        return {
            "app": settings.app_name,
            "version": settings.app_version,
            "docs": (
                None
                if settings.is_production
                else "/docs"
            ),
            "health": "/api/v1/health",
        }


    return app


# ==========================================
# Application Instance
# ==========================================

app = create_app()