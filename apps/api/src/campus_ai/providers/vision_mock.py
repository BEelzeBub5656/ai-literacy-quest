"""Deterministic local vision provider used for development and tests."""

import hashlib
import random

from campus_ai.providers.vision_base import Detection, VisionProvider, VisionResult


_CANDIDATES: list[tuple[str, float]] = [
    ("猫", 0.92),
    ("绿植", 0.81),
    ("书包", 0.79),
    ("水杯", 0.74),
    ("笔记本", 0.83),
    ("钢笔", 0.77),
    ("苹果", 0.69),
    ("台灯", 0.71),
    ("键盘", 0.85),
    ("篮球", 0.76),
]


class MockVisionProvider(VisionProvider):
    name = "mock"

    @property
    def configured(self) -> bool:
        return True

    async def recognize(
        self,
        *,
        image_b64: str,
        mime_type: str,
        prompt: str | None = None,
    ) -> VisionResult:
        digest = hashlib.sha256(image_b64.encode("utf-8")).hexdigest()
        rng = random.Random(int(digest[:8], 16))
        chosen = rng.sample(_CANDIDATES, rng.randint(2, 4))
        detections = [
            Detection(label=label, confidence=confidence)
            for label, confidence in sorted(chosen, key=lambda item: -item[1])
        ]
        return VisionResult(
            detections=detections,
            model="deterministic-vision-demo",
            provider=self.name,
        )
