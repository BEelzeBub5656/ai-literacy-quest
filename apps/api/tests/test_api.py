from contextlib import asynccontextmanager

from httpx import ASGITransport, AsyncClient
import pytest

from campus_ai.core.config import Settings, get_settings
from campus_ai.main import app
from campus_ai.providers.base import AICompletionRequest, AIMessage
from campus_ai.providers.service import AIService


@pytest.fixture(autouse=True)
def force_mock_provider_for_tests(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AI_PROVIDER", "mock")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@asynccontextmanager
async def api_client():
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client


@pytest.mark.asyncio
async def test_health() -> None:
    async with api_client() as client:
        health = await client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_mock_ai_completion() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/ai/demo-completion",
            json={"prompt": "什么是 Agent 的工具调用？"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["provider"] == "mock"
        assert payload["content"]


@pytest.mark.asyncio
async def test_structured_study_chat_and_knowledge_card() -> None:
    async with api_client() as client:
        chat = await client.post(
            "/api/v1/ai/study-chat",
            json={
                "conversation_id": "conversation-test",
                "messages": [
                    {
                        "id": "message-user-1",
                        "role": "user",
                        "content": "Agent、Tool 和 Middleware 有什么关系？",
                    }
                ],
            },
        )
        assert chat.status_code == 200
        chat_payload = chat.json()
        assert chat_payload["output"]["schema_version"] == "1.0"
        assert len(chat_payload["output"]["keywords"]) == 3
        assert len(chat_payload["output"]["reasoning_steps"]) >= 2
        assert chat_payload["output"]["keywords"][0]["id"]

        card = await client.post(
            "/api/v1/ai/knowledge-card",
            json={
                "selected_text": "Middleware",
                "source_message_id": chat_payload["message_id"],
                "source_message_content": chat_payload["output"]["answer_markdown"],
                "parent_card_id": None,
                "keyword_context": "Middleware",
            },
        )
        assert card.status_code == 200
        card_payload = card.json()["card"]
        assert card_payload["selected_text"] == "Middleware"
        assert card_payload["source_message_id"] == chat_payload["message_id"]
        assert len(card_payload["reasoning_steps"]) >= 2
        assert len(card_payload["keywords"]) == 3


@pytest.mark.asyncio
async def test_streaming_study_chat_emits_reasoning_then_answer() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/ai/study-chat/stream",
            json={
                "conversation_id": "conversation-stream-test",
                "messages": [
                    {
                        "id": "message-user-stream-1",
                        "role": "user",
                        "content": "解释 Agent 的工具调用。",
                    }
                ],
            },
        )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    body = response.text
    assert body.index("event: reasoning_delta") < body.index("event: answer_start")
    assert body.index("event: answer_start") < body.index("event: answer_delta")
    assert "event: keywords" in body
    assert "event: done" in body


@pytest.mark.asyncio
async def test_unconfigured_longcat_falls_back_to_mock() -> None:
    settings = Settings(
        ai_provider="longcat",
        longcat_api_key=None,
        allow_mock_fallback=True,
    )
    service = AIService(settings)
    result = await service.complete(
        AICompletionRequest(messages=[AIMessage(role="user", content="解释 Agent")])
    )
    assert result.provider == "mock"
    assert result.fallback_used is True
