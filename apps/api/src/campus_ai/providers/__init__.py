"""AI provider adapters."""

from campus_ai.providers.base import AICompletion, AICompletionRequest, AIProvider
from campus_ai.providers.factory import build_ai_provider

__all__ = ["AICompletion", "AICompletionRequest", "AIProvider", "build_ai_provider"]

