from campus_ai.core.config import Settings
from campus_ai.providers.base import AICompletion, AICompletionRequest
from campus_ai.providers.factory import build_ai_provider
from campus_ai.providers.deepseek import DeepSeekProviderError
from campus_ai.providers.longcat import LongCatProviderError
from campus_ai.providers.mock import MockAIProvider


class AIService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._provider = build_ai_provider(settings)

    @property
    def provider_name(self) -> str:
        return self._provider.name

    @property
    def provider_configured(self) -> bool:
        return self._provider.configured

    async def complete(self, request: AICompletionRequest) -> AICompletion:
        try:
            return await self._provider.complete(request)
        except (LongCatProviderError, DeepSeekProviderError):
            if not self._settings.allow_mock_fallback or self._provider.name == "mock":
                raise
            fallback = await MockAIProvider().complete(request)
            return fallback.model_copy(update={"fallback_used": True})
