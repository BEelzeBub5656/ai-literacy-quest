from collections.abc import AsyncIterator
from uuid import uuid4

from campus_ai.core.config import Settings
from campus_ai.modules.ai_companion.schemas import (
    EvidenceRef,
    GenerateKnowledgeCardRequest,
    GenerateKnowledgeCardResponse,
    InlineKeywordCollection,
    KeywordItem,
    KnowledgeCardDraft,
    KnowledgeCardOutput,
    StudyAssistantDraft,
    StudyAssistantOutput,
    StudyChatRequest,
    StudyChatResponse,
)
from campus_ai.providers.base import AIMessage
from campus_ai.providers.base import AICompletionRequest
from campus_ai.providers.deepseek import DeepSeekAIProvider
from campus_ai.providers.service import AIService
from campus_ai.providers.structured import generate_structured


def _keyword_items(drafts: list, prefix: str) -> list[KeywordItem]:
    return [
        KeywordItem(id=f"{prefix}-{index}-{uuid4().hex[:8]}", **draft.model_dump())
        for index, draft in enumerate(drafts, start=1)
    ]


class AICompanionService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._ai_service = AIService(settings)

    async def stream_chat_events(
        self,
        request: StudyChatRequest,
    ) -> AsyncIterator[tuple[str, dict]]:
        """Stream provider reasoning first, then the answer and inline keywords."""
        message_id = f"msg-ai-{uuid4().hex}"
        model_name = (
            self._settings.resolved_deepseek_model
            if self._settings.ai_provider == "deepseek"
            else "deterministic-demo"
        )
        yield (
            "meta",
            {
                "conversation_id": request.conversation_id,
                "message_id": message_id,
                "provider": self._settings.ai_provider,
                "model": model_name,
            },
        )

        answer_parts: list[str] = []
        reasoning_chars = 0
        answer_started = False
        finish_reason: str | None = None

        if self._settings.ai_provider == "deepseek":
            provider = DeepSeekAIProvider(self._settings)
            provider_request = AICompletionRequest(
                messages=[
                    AIMessage(
                        role="system",
                        content=(
                            "你是一个友好、自然的 AI 伴学助手。"
                            "请正常与用户对话；需要解释时清晰、准确即可。"
                        ),
                    ),
                    *[
                        AIMessage(role=message.role, content=message.content)
                        for message in request.messages[-16:]
                    ],
                ],
                temperature=0.6,
                max_tokens=3000,
            )
            async for chunk in provider.stream(provider_request):
                if chunk.reasoning_content:
                    reasoning_chars += len(chunk.reasoning_content)
                    yield "reasoning_delta", {"text": chunk.reasoning_content}
                if chunk.content:
                    if not answer_started:
                        answer_started = True
                        yield "answer_start", {}
                    answer_parts.append(chunk.content)
                    yield "answer_delta", {"text": chunk.content}
                if chunk.finish_reason:
                    finish_reason = chunk.finish_reason
        else:
            mock_reasoning = "我会先理解你的问题，再组织一个自然、清晰的回答。"
            mock_answer = (
                "Agent 可以把模型的判断与外部工具连接起来。"
                "工具调用负责执行具体动作，中间件则负责日志、重试与权限等治理。"
            )
            for text in (mock_reasoning[:12], mock_reasoning[12:]):
                reasoning_chars += len(text)
                yield "reasoning_delta", {"text": text}
            yield "answer_start", {}
            for text in (mock_answer[:24], mock_answer[24:]):
                answer_parts.append(text)
                yield "answer_delta", {"text": text}
            answer_started = True
            finish_reason = "stop"

        answer = "".join(answer_parts).strip()
        if not answer_started or not answer:
            raise RuntimeError("模型没有返回最终正文。")

        keywords = await self._extract_inline_keywords(answer)
        yield "keywords", {"items": [item.model_dump() for item in keywords.keywords]}
        yield (
            "done",
            {
                "finish_reason": finish_reason or "stop",
                "reasoning_chars": reasoning_chars,
                "answer_chars": len(answer),
            },
        )

    async def _extract_inline_keywords(self, answer: str) -> InlineKeywordCollection:
        try:
            completion = await generate_structured(
                self._ai_service,
                output_kind="stream_keywords",
                schema=InlineKeywordCollection,
                messages=[
                    AIMessage(
                        role="system",
                        content=(
                            "从回答正文中挑选真正值得继续探索的关键词。"
                            "关键词必须原样出现在正文里；importance 为 1 到 3，越重要越大。"
                        ),
                    ),
                    AIMessage(role="user", content=answer),
                ],
                max_tokens=500,
                max_attempts=1,
            )
            return completion.value
        except Exception:
            return InlineKeywordCollection()

    async def chat(self, request: StudyChatRequest) -> StudyChatResponse:
        conversation_messages = [
            AIMessage(role=message.role, content=message.content)
            for message in request.messages[-12:]
        ]
        completion = await generate_structured(
            self._ai_service,
            output_kind="study_chat",
            schema=StudyAssistantDraft,
            messages=[
                AIMessage(
                    role="system",
                    content=(
                        "你是校园 AI 伴学导师。基于完整对话回答当前问题，"
                        "解释准确、循序渐进，并选择真正值得继续探索的关键词。"
                        "based_on 优先引用用户消息 ID；无法确定的内容放入 uncertainties。"
                    ),
                ),
                *conversation_messages,
            ],
        )
        draft = completion.value
        message_id = f"msg-ai-{uuid4().hex}"
        output = StudyAssistantOutput(
            **draft.model_dump(exclude={"keywords"}),
            keywords=_keyword_items(draft.keywords, message_id),
        )
        return StudyChatResponse(
            conversation_id=request.conversation_id,
            message_id=message_id,
            provider=completion.provider,
            model=completion.model,
            fallback_used=completion.fallback_used,
            output=output,
        )

    async def generate_card(
        self,
        request: GenerateKnowledgeCardRequest,
    ) -> GenerateKnowledgeCardResponse:
        prompt = (
            "请把下面的选中文本制作成适合移动端学习的知识卡片。\n"
            f"选中文本：{request.selected_text}\n"
            f"来源消息：{request.source_message_content}\n"
        )
        if request.keyword_context:
            prompt += f"触发关键词：{request.keyword_context}\n"

        completion = await generate_structured(
            self._ai_service,
            output_kind="knowledge_card",
            schema=KnowledgeCardDraft,
            messages=[
                AIMessage(
                    role="system",
                    content=(
                        "你是移动端知识卡片编辑器。知识卡只负责提炼，不负责展开讲课。"
                        "标题不超过 12 个中文字符；plain_explanation 用 50 至 90 个中文字符"
                        "概括一个核心结论；只保留 2 至 3 条简短 key_points。"
                        "reasoning_steps 仅记录 1 至 3 条可审计的来源说明，"
                        "不要展示或声称展示隐藏思维链。"
                    ),
                ),
                AIMessage(role="user", content=prompt),
            ],
            max_tokens=900,
        )
        draft = completion.value
        card_id = f"card-{uuid4().hex}"
        card = KnowledgeCardOutput(
            **draft.model_dump(exclude={"keywords"}),
            card_id=card_id,
            parent_card_id=request.parent_card_id,
            source_message_id=request.source_message_id,
            selected_text=request.selected_text,
            keywords=_keyword_items(draft.keywords, card_id),
            evidence_refs=[EvidenceRef(type="message", id=request.source_message_id)],
        )
        return GenerateKnowledgeCardResponse(
            provider=completion.provider,
            model=completion.model,
            fallback_used=completion.fallback_used,
            card=card,
        )
