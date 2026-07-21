from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from campus_ai.core.config import get_settings
from campus_ai.providers.service import AIService


router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    ai_provider: str
    ai_provider_configured: bool
    mock_fallback_enabled: bool


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    settings = get_settings()
    service = AIService(settings)
    return HealthResponse(
        status="ok",
        service="campus-ai-api",
        version=settings.app_version,
        ai_provider=service.provider_name,
        ai_provider_configured=service.provider_configured,
        mock_fallback_enabled=settings.allow_mock_fallback,
    )

