from contextlib import asynccontextmanager

from httpx import ASGITransport, AsyncClient
import pytest

from campus_ai.core.config import Settings, get_settings
from campus_ai.main import app
from campus_ai.modules.ai_companion.schemas import (
    GenerateKnowledgeCardRequest,
    InlineKeywordCollection,
    InlineKeywordDraft,
    KeywordDraft,
    KnowledgeCardDraft,
    ReasoningStep,
)
from campus_ai.modules.ai_companion.service import AICompanionService
from campus_ai.providers.base import AICompletionRequest, AIMessage
from campus_ai.providers.deepseek import DeepSeekAIProvider
from campus_ai.providers.service import AIService
from campus_ai.providers.structured import StructuredCompletion


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
                "relation": "associate",
            },
        )
        assert card.status_code == 200
        card_payload = card.json()["card"]
        assert card_payload["selected_text"] == "Middleware"
        assert card_payload["source_message_id"] == chat_payload["message_id"]
        assert card_payload["source_type"] == "message"
        assert card_payload["relation"] == "associate"
        assert len(card_payload["reasoning_steps"]) >= 2
        assert len(card_payload["keywords"]) == 3


@pytest.mark.asyncio
async def test_explanation_preview_is_lightweight_and_preserves_relation() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/ai/explanation-preview",
            json={
                "selected_text": "训练数据",
                "source_message_id": "message-source-1",
                "source_message_content": "训练数据会影响模型识别新样本的表现。",
                "parent_preview_id": None,
                "parent_card_id": None,
                "keyword_context": "训练数据",
                "relation": "deepen",
            },
        )
    assert response.status_code == 200
    payload = response.json()
    preview = payload["preview"]
    assert preview["preview_id"].startswith("preview-")
    assert preview["relation"] == "deepen"
    assert preview["explanation"]
    assert "reasoning_steps" not in preview
    assert "key_points" not in preview
    assert "evidence_refs" in preview


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
async def test_annotate_text_endpoint_is_reusable_for_imported_content() -> None:
    async with api_client() as client:
        response = await client.post(
            "/api/v1/ai/annotate-text",
            json={
                "text": "Agent 会通过工具调用完成外部动作。",
                "source_context": "用户导入的网页片段",
                "learner_context": "第一次接触智能体",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert [item["text"] for item in payload["keywords"]] == ["Agent", "工具调用"]


@pytest.mark.asyncio
async def test_annotation_policy_covers_learning_barriers_and_filters_invalid_terms(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, str] = {}

    async def fake_generate_structured(*args, **kwargs):
        messages = kwargs["messages"]
        captured["system"] = messages[0].content
        captured["user"] = messages[1].content
        value = InlineKeywordCollection(
            keywords=[
                InlineKeywordDraft(
                    text="相对论",
                    normalized_text="相对论",
                    importance=3,
                ),
                InlineKeywordDraft(
                    text="E=mc²",
                    normalized_text="e=mc²",
                    importance=3,
                ),
                InlineKeywordDraft(
                    text="爱因斯坦",
                    normalized_text="爱因斯坦",
                    importance=2,
                ),
                InlineKeywordDraft(
                    text="不存在的词",
                    normalized_text="不存在",
                    importance=3,
                ),
                InlineKeywordDraft(
                    text="相对论",
                    normalized_text="相对论",
                    importance=1,
                ),
            ]
        )
        return StructuredCompletion(
            value=value,
            provider="mock",
            model="annotation-test",
            fallback_used=False,
        )

    monkeypatch.setattr(
        "campus_ai.modules.ai_companion.service.generate_structured",
        fake_generate_structured,
    )
    service = AICompanionService(Settings(_env_file=None, ai_provider="mock"))
    response = await service.annotate_text(
        "爱因斯坦提出相对论，并用 E=mc² 描述质量与能量关系。",
        source_context="物理学教材",
        learner_context="初中生",
    )

    assert [item.text for item in response.keywords] == [
        "相对论",
        "E=mc²",
        "爱因斯坦",
    ]
    for category in ("概念", "专业术语", "理论", "公式", "人名", "事件"):
        assert category in captured["system"]
    assert "<source_context>物理学教材</source_context>" in captured["user"]
    assert "<learner_context>初中生</learner_context>" in captured["user"]


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


@pytest.mark.asyncio
async def test_knowledge_card_uses_flash_while_chat_defaults_to_pro(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        _env_file=None,
        ai_provider="deepseek",
        deepseek_api_key="test-key",
        deepseek_model=None,
        deepseek_pro_model="deepseek-pro-test",
        deepseek_flash_model="deepseek-flash-test",
        allow_mock_fallback=False,
    )
    provider = DeepSeekAIProvider(settings)
    chat_request = AICompletionRequest(
        messages=[AIMessage(role="user", content="解释训练数据")]
    )
    assert provider._payload(
        chat_request,
        stream=False,
        thinking_enabled=False,
    )["model"] == "deepseek-pro-test"

    captured: dict[str, str | None] = {}

    async def fake_generate_structured(*args, **kwargs):
        captured["model"] = kwargs.get("model")
        draft = KnowledgeCardDraft(
            schema_version="1.0",
            title="训练数据",
            plain_explanation="训练数据是模型用来发现规律的样本集合。",
            reasoning_summary="根据用户选中的概念提炼核心定义。",
            reasoning_steps=[
                ReasoningStep(
                    step=1,
                    title="提炼定义",
                    explanation="从来源消息中提取概念的核心含义。",
                    based_on=["message-test"],
                )
            ],
            key_points=["决定模型学习范围", "质量影响模型表现"],
            keywords=[
                KeywordDraft(
                    text="样本",
                    normalized_text="样本",
                    definition="用于训练或测试的数据实例。",
                    selection_reason="与训练数据直接相关。",
                    confidence=0.95,
                ),
                KeywordDraft(
                    text="模型",
                    normalized_text="模型",
                    definition="从数据中学习规律的计算系统。",
                    selection_reason="是训练数据的使用者。",
                    confidence=0.92,
                ),
            ],
        )
        return StructuredCompletion(
            value=draft,
            provider="deepseek",
            model=kwargs.get("model") or "missing",
            fallback_used=False,
        )

    monkeypatch.setattr(
        "campus_ai.modules.ai_companion.service.generate_structured",
        fake_generate_structured,
    )
    response = await AICompanionService(settings).generate_card(
        GenerateKnowledgeCardRequest(
            selected_text="训练数据",
            source_message_id="message-test",
            source_message_content="训练数据会影响模型最终学到的规律。",
        )
    )
    assert captured["model"] == "deepseek-flash-test"
    assert response.model == "deepseek-flash-test"
