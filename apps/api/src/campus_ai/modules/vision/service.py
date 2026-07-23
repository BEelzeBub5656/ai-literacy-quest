from campus_ai.core.config import Settings
from campus_ai.modules.vision.schemas import (
    DetectionOut,
    RecognizeRequest,
    RecognizeResponse,
)
from campus_ai.providers.vision_base import VisionProviderError, VisionResult
from campus_ai.providers.vision_factory import build_vision_provider
from campus_ai.providers.vision_mock import MockVisionProvider


class VisionService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._provider = build_vision_provider(settings)

    async def recognize(self, request: RecognizeRequest) -> RecognizeResponse:
        try:
            result = await self._provider.recognize(
                image_b64=request.image,
                mime_type=request.mime_type,
                prompt=request.prompt,
            )
            return self._to_response(result, fallback_used=False)
        except VisionProviderError:
            if not self._settings.allow_mock_fallback or self._provider.name == "mock":
                raise
            fallback = await MockVisionProvider().recognize(
                image_b64=request.image,
                mime_type=request.mime_type,
                prompt=request.prompt,
            )
            return self._to_response(fallback, fallback_used=True)

    @staticmethod
    def _to_response(
        result: VisionResult,
        *,
        fallback_used: bool,
    ) -> RecognizeResponse:
        return RecognizeResponse(
            provider=result.provider,
            model=result.model,
            fallback_used=fallback_used,
            detections=[
                DetectionOut(
                    label=detection.label,
                    confidence=detection.confidence,
                    bbox=detection.bbox,
                )
                for detection in result.detections
            ],
        )
