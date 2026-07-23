from campus_ai.core.config import Settings
from campus_ai.providers.vision_base import VisionProvider
from campus_ai.providers.vision_mock import MockVisionProvider
from campus_ai.providers.vision_openai import OpenAIVisionProvider


def build_vision_provider(settings: Settings) -> VisionProvider:
    if settings.vision_provider == "openai":
        return OpenAIVisionProvider(settings)
    return MockVisionProvider()
