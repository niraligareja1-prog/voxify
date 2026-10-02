"""
Security helpers.

Step 2: security headers added to every response.
Step 4 (Authentication) will add token verification here.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds basic protective headers to every API response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"      # no MIME sniffing
        response.headers["X-Frame-Options"] = "DENY"                # no clickjacking
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"              # API data is never cached
        return response
