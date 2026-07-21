import json
from collections.abc import AsyncIterator
from typing import Any

import httpx
from pydantic import BaseModel

from campus_ai.core.config import Settings
from campus_ai.providers.base import AICompletion, AICompletionRequest, AIProvider


class DeepSeekProviderError(RuntimeError):
    """Raised when the DeepSeek API cannot produce a valid response."""


class DeepSeekStreamChunk(BaseModel):
    reasoning_content: str = ""
    content: str = ""
    finish_reason: str | None = None
    usage: dict[str, Any] | None = None


class DeepSeekAIProvider(AIProvider):
    name = "deepseek"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def configured(self) -> bool:
        return self._settings.deepseek_configured

    @property
    def model(self) -> str:
        return self._settings.resolved_deepseek_pro_model

    def _request_model(self, request: AICompletionRequest) -> str:
        return request.model or self.model

    def _url(self) -> str:
        return f"{self._settings.resolved_deepseek_base_url.rstrip('/')}/chat/completions"

    def _headers(self) -> dict[str, str]:
        api_key = self._settings.resolved_deepseek_api_key
        if not api_key:
            raise DeepSeekProviderError("DeepSeek API Key 尚未配置。")
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _payload(
        self,
        request: AICompletionRequest,
        *,
        stream: bool,
        thinking_enabled: bool,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._request_model(request),
            "messages": [message.model_dump() for message in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": stream,
            "thinking": {"type": "enabled" if thinking_enabled else "disabled"},
        }
        if thinking_enabled:
            payload["reasoning_effort"] = self._settings.deepseek_reasoning_effort
        if stream:
            payload["stream_options"] = {"include_usage": True}
        return payload

    async def complete(self, request: AICompletionRequest) -> AICompletion:
        if not self.configured:
            raise DeepSeekProviderError("DeepSeek Provider 尚未完成本地配置。")

        try:
            async with httpx.AsyncClient(
                timeout=self._settings.deepseek_timeout_seconds
            ) as client:
                response = await client.post(
                    self._url(),
                    headers=self._headers(),
                    json=self._payload(
                        request,
                        stream=False,
                        thinking_enabled=False,
                    ),
                )
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise DeepSeekProviderError("DeepSeek 请求失败，请检查网络或服务配置。") from error

        try:
            data = response.json()
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise DeepSeekProviderError("DeepSeek 返回了无法识别的响应结构。") from error

        if not isinstance(content, str) or not content.strip():
            raise DeepSeekProviderError("DeepSeek 返回了空内容。")
        return AICompletion(
            provider=self.name,
            model=self._request_model(request),
            content=content.strip(),
        )

    async def stream(
        self,
        request: AICompletionRequest,
    ) -> AsyncIterator[DeepSeekStreamChunk]:
        """Yield DeepSeek's provider-supplied reasoning and answer deltas."""
        if not self.configured:
            raise DeepSeekProviderError("DeepSeek Provider 尚未完成本地配置。")

        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self._settings.deepseek_timeout_seconds)
            ) as client:
                async with client.stream(
                    "POST",
                    self._url(),
                    headers=self._headers(),
                    json=self._payload(
                        request,
                        stream=True,
                        thinking_enabled=True,
                    ),
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        payload_text = line[5:].strip()
                        if not payload_text or payload_text == "[DONE]":
                            continue
                        try:
                            data = json.loads(payload_text)
                        except json.JSONDecodeError as error:
                            raise DeepSeekProviderError(
                                "DeepSeek 流中出现了无效 JSON。"
                            ) from error

                        choices = data.get("choices") or []
                        choice = choices[0] if choices else {}
                        delta = choice.get("delta") or {}
                        yield DeepSeekStreamChunk(
                            reasoning_content=delta.get("reasoning_content") or "",
                            content=delta.get("content") or "",
                            finish_reason=choice.get("finish_reason"),
                            usage=data.get("usage"),
                        )
        except httpx.HTTPError as error:
            raise DeepSeekProviderError("DeepSeek 流式请求失败。") from error
