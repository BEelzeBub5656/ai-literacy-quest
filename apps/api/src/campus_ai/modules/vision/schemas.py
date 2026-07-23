"""Validated contracts for the object-recognition endpoint."""

from base64 import b64decode
from binascii import Error as Base64Error
from io import BytesIO
from typing import Literal

from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, model_validator


MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_DIMENSION = 2048
MIN_IMAGE_DIMENSION = 32


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RecognizeRequest(StrictModel):
    image: str = Field(min_length=4, max_length=12_000_000)
    mime_type: Literal["image/jpeg"] = "image/jpeg"
    prompt: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_jpeg(self) -> "RecognizeRequest":
        try:
            raw = b64decode(self.image, validate=True)
        except (Base64Error, ValueError) as error:
            raise ValueError("image must be valid Base64 data") from error

        if not raw:
            raise ValueError("image must not be empty")
        if len(raw) > MAX_IMAGE_BYTES:
            raise ValueError("decoded image must not exceed 8 MiB")
        if not raw.startswith(b"\xff\xd8\xff"):
            raise ValueError("only JPEG images are supported")

        try:
            with Image.open(BytesIO(raw)) as image:
                width, height = image.size
                image_format = image.format
                image.verify()
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
        ) as error:
            raise ValueError("image is not a readable JPEG") from error

        if image_format != "JPEG":
            raise ValueError("only JPEG images are supported")
        if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
            raise ValueError("image dimensions must be at least 32 x 32")
        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            raise ValueError("image dimensions must not exceed 2048 x 2048")
        return self


class DetectionOut(StrictModel):
    label: str = Field(min_length=1, max_length=80)
    confidence: float = Field(ge=0, le=1)
    bbox: tuple[float, float, float, float] | None = None


class RecognizeResponse(StrictModel):
    provider: str
    model: str
    fallback_used: bool
    detections: list[DetectionOut]
