from fastapi import APIRouter

from campus_ai.api.v1 import ai, health


api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(ai.router)
