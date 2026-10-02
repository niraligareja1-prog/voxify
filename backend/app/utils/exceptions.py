"""
Custom exceptions + global error handlers.

Inside any route or service you can simply write:

    raise NotFoundError("History item not found")

and the client always receives the same JSON shape:

    {"success": false, "error": {"code": "NOT_FOUND", "message": "...", "details": null}}
"""
import logging
from typing import Any, Optional

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("voxify")


class AppException(Exception):
    """Base class for all expected (handled) errors."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.details = details


class BadRequestError(AppException):
    status_code = 400
    code = "BAD_REQUEST"


class UnauthorizedError(AppException):
    status_code = 401
    code = "UNAUTHORIZED"


class ForbiddenError(AppException):
    status_code = 403
    code = "FORBIDDEN"


class NotFoundError(AppException):
    status_code = 404
    code = "NOT_FOUND"


class FileTooLargeError(AppException):
    status_code = 413
    code = "FILE_TOO_LARGE"


class UnsupportedMediaError(AppException):
    status_code = 415
    code = "UNSUPPORTED_FILE_TYPE"


class UnsupportedLanguageError(AppException):
    status_code = 422
    code = "UNSUPPORTED_LANGUAGE"


class ExternalServiceError(AppException):
    """An AI model / third-party service failed."""
    status_code = 502
    code = "EXTERNAL_SERVICE_ERROR"


def _error_response(status_code: int, code: str, message: str, details: Any = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "error": {"code": code, "message": message, "details": details}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global handlers to the FastAPI app."""

    @app.exception_handler(AppException)
    async def handle_app_exception(_: Request, exc: AppException):
        return _error_response(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        # Turn FastAPI's raw error list into a simple, readable list
        details = [
            {"field": ".".join(str(p) for p in err["loc"] if p != "body"), "message": err["msg"]}
            for err in exc.errors()
        ]
        return _error_response(422, "VALIDATION_ERROR", "Invalid request data", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException):
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        return _error_response(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        # Full error goes to the server log only - the user never sees internals
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return _error_response(500, "INTERNAL_ERROR", "Something went wrong. Please try again later.")
