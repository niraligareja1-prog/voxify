"""Health check - used to confirm the server is running (and by hosting platforms)."""
from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Server health check")
def health_check() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=settings.app_version,
        environment=settings.app_env,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
