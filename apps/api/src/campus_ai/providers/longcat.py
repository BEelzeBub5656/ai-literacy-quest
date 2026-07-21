from typing import Any

import httpx

from campus_ai.core.config import Settings
from campus_ai.providers.base import AICompletion, AICompletionRequest, AIProvider


class LongCatProviderError(RuntimeError):
    """Raised when the LongCat-compatible API cannot produce a completion."""


class LongCatAIProvider(AIProvider):
    name = "longcat"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def configured(self) -> bool:
        return self._settings.longcat_configured

    async def complete(self, request: AICompletionRequest) -> AICompletion:
        if not self.configured:
            raise LongCatProviderError("LongCat Provider 尚未完成本地配置。")

        url = f"{self._settings.longcat_base_url.rstrip('/')}/chat/completions"
        payload: dict[str, Any] = {
            "model": self._settings.longcat_model,
            "messages": [message.model_dump() for message in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self._settings.longcat_api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self._settings.longcat_timeout_seconds) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise LongCatProviderError("LongCat 请求失败，请检查网络或服务配置。") from error

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise LongCatProviderError("LongCat 返回了无法识别的响应结构。") from error

        if not isinstance(content, str) or not content.strip():
            raise LongCatProviderError("LongCat 返回了空内容。")

        return AICompletion(
            provider=self.name,
            model=self._settings.longcat_model,
            content=content.strip(),
        )

