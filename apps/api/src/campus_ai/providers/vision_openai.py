"""OpenAI-compatible multimodal provider implementation."""

import json
from typing import Any

import httpx

from campus_ai.core.config import Settings
from campus_ai.providers.vision_base import (
    Detection,
    VisionProvider,
    VisionProviderError,
    VisionResult,
)


_SYSTEM_PROMPT = (
    "你是图像识别助手。识别图像中的主要物体，并只返回 JSON 数组。"
    "每项包含中文 label、0 到 1 的 confidence，可选归一化 bbox [x,y,w,h]。"
    "最多返回 5 项，按置信度降序排列。"
)


class OpenAIVisionProvider(VisionProvider):
    name = "openai"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @property
    def configured(self) -> bool:
        return self._settings.vision_configured

    async def recognize(
        self,
        *,
        image_b64: str,
        mime_type: str,
        prompt: str | None = None,
    ) -> VisionResult:
        if not self.configured:
            raise VisionProviderError("vision provider is not configured")

        system = _SYSTEM_PROMPT if not prompt else f"{_SYSTEM_PROMPT}\n补充要求：{prompt}"
        payload: dict[str, Any] = {
            "model": self._settings.vision_openai_model,
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请识别图中的主要物体。"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_b64}"
                            },
                        },
                    ],
                },
            ],
            "max_tokens": 800,
            "temperature": 0.2,
        }
        headers = {
            "Authorization": f"Bearer {self._settings.vision_openai_api_key}",
            "Content-Type": "application/json",
        }
        url = (
            f"{self._settings.vision_openai_base_url.rstrip('/')}"
            "/chat/completions"
        )
        try:
            async with httpx.AsyncClient(
                timeout=self._settings.vision_openai_timeout_seconds
            ) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as error:
            raise VisionProviderError("vision model request failed") from error
        return self._parse(str(content))

    def _parse(self, content: str) -> VisionResult:
        text = content.strip()
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
        try:
            raw = json.loads(text)
        except json.JSONDecodeError as error:
            raise VisionProviderError("vision model returned invalid JSON") from error

        if isinstance(raw, dict):
            raw = raw.get("detections")
        if not isinstance(raw, list):
            raise VisionProviderError("vision model returned an invalid structure")

        detections: list[Detection] = []
        for item in raw[:5]:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label", "")).strip()
            if not label:
                continue
            try:
                confidence = max(0.0, min(1.0, float(item.get("confidence", 0))))
            except (TypeError, ValueError):
                confidence = 0.0
            bbox = None
            raw_bbox = item.get("bbox")
            if isinstance(raw_bbox, (list, tuple)) and len(raw_bbox) >= 4:
                try:
                    bbox = tuple(float(value) for value in raw_bbox[:4])
                except (TypeError, ValueError):
                    bbox = None
            detections.append(
                Detection(label=label, confidence=confidence, bbox=bbox)  # type: ignore[arg-type]
            )
        if not detections:
            raise VisionProviderError("vision model returned no recognizable objects")
        return VisionResult(
            detections=detections,
            model=self._settings.vision_openai_model,
            provider=self.name,
        )
