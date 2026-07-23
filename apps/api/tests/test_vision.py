from base64 import b64encode
from contextlib import asynccontextmanager
from io import BytesIO

from httpx import ASGITransport, AsyncClient
from PIL import Image
import pytest

from campus_ai.core.config import get_settings
from campus_ai.main import app


@pytest.fixture(autouse=True)
def force_mock_vision(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("VISION_PROVIDER", "mock")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@asynccontextmanager
async def api_client():
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


def encoded_image(
    width: int = 96,
    height: int = 96,
    image_format: str = "JPEG",
) -> str:
    stream = BytesIO()
    Image.new("RGB", (width, height), color=(78, 87, 200)).save(
        stream,
        format=image_format,
    )
    return b64encode(stream.getvalue()).decode("ascii")


@pytest.mark.asyncio
async def test_recognize_valid_jpeg_with_mock_provider() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/vision/recognize",
            json={"image": encoded_image(), "mime_type": "image/jpeg"},
        )
    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "mock"
    assert 2 <= len(payload["detections"]) <= 4
    assert 0 <= payload["detections"][0]["confidence"] <= 1


@pytest.mark.asyncio
async def test_recognize_rejects_non_jpeg_payload() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/vision/recognize",
            json={"image": encoded_image(image_format="PNG"), "mime_type": "image/jpeg"},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_recognize_rejects_dimensions_over_limit() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/vision/recognize",
            json={"image": encoded_image(width=2049, height=64), "mime_type": "image/jpeg"},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_recognize_rejects_invalid_base64() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/vision/recognize",
            json={"image": "not-valid-base64", "mime_type": "image/jpeg"},
        )
    assert response.status_code == 422
