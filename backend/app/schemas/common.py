"""Response shapes shared by every module."""
from typing import Any, Optional

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    """Every error from the API has exactly this shape."""
    success: bool = False
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str
    environment: str
    timestamp: str
