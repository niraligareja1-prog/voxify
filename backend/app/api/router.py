"""
Collects every module's routes under one prefix: /api/v1
"""

from fastapi import APIRouter

from app.api.routes import health
from app import auth


api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(auth.router)
