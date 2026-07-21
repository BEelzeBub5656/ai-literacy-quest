from campus_ai.core.config import Settings
from campus_ai.providers.base import AIProvider
from campus_ai.providers.deepseek import DeepSeekAIProvider
from campus_ai.providers.longcat import LongCatAIProvider
from campus_ai.providers.mock import MockAIProvider


def build_ai_provider(settings: Settings) -> AIProvider:
    if settings.ai_provider == "deepseek":
        return DeepSeekAIProvider(settings)
    if settings.ai_provider == "longcat":
        return LongCatAIProvider(settings)
    return MockAIProvider()
