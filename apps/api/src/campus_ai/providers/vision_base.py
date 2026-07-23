"""Provider-neutral contracts for multimodal object recognition."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    bbox: tuple[float, float, float, float] | None = None


@dataclass(frozen=True)
class VisionResult:
    detections: list[Detection]
    model: str
    provider: str


class VisionProviderError(RuntimeError):
    """Raised when a vision provider cannot produce a valid result."""


class VisionProvider(ABC):
    name: str = "base"

    @property
    @abstractmethod
    def configured(self) -> bool:
        pass

    @abstractmethod
    async def recognize(
        self,
        *,
        image_b64: str,
        mime_type: str,
        prompt: str | None = None,
    ) -> VisionResult:
        pass
