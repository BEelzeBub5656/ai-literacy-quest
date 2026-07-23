import pytest

from campus_ai.core.config import get_settings
from campus_ai.modules.ai_companion.schemas import StudyChatRequest
from campus_ai.modules.ai_companion.service import AICompanionService


@pytest.fixture(autouse=True)
def force_mock_provider_for_tests(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AI_PROVIDER", "mock")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_study_chat_request_accepts_model() -> None:
    request = StudyChatRequest(
        conversation_id="c1",
        messages=[{"id": "m1", "role": "user", "content": "你好"}],
        model="deepseek-reasoner",
    )
    assert request.model == "deepseek-reasoner"


@pytest.mark.asyncio
async def test_stream_meta_reflects_request_model() -> None:
    service = AICompanionService(get_settings())
    request = StudyChatRequest(
        conversation_id="c2",
        messages=[{"id": "m1", "role": "user", "content": "你好"}],
        model="demo-model-x",
    )
    events = [
        (event, data) async for event, data in service.stream_chat_events(request)
    ]
    meta = next(data for event, data in events if event == "meta")
    assert meta["model"] == "demo-model-x"
    assert any(event == "answer_delta" for event, _ in events)
    assert any(event == "done" for event, _ in events)


@pytest.mark.asyncio
async def test_stream_meta_defaults_when_model_omitted() -> None:
    service = AICompanionService(get_settings())
    request = StudyChatRequest(
        conversation_id="c3",
        messages=[{"id": "m1", "role": "user", "content": "你好"}],
    )
    events = [
        (event, data) async for event, data in service.stream_chat_events(request)
    ]
    meta = next(data for event, data in events if event == "meta")
    assert meta["model"] == "deterministic-demo"
