import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from campus_ai.core.config import get_settings
from campus_ai.modules.ai_companion.schemas import (
    AnnotateTextRequest,
    AnnotateTextResponse,
    GenerateKnowledgeCardRequest,
    GenerateKnowledgeCardResponse,
    StudyChatRequest,
    StudyChatResponse,
)
from campus_ai.modules.ai_companion.service import AICompanionService
from campus_ai.providers.base import AICompletion, AICompletionRequest, AIMessage
from campus_ai.providers.service import AIService
from campus_ai.providers.structured import StructuredOutputError


router = APIRouter(prefix="/ai", tags=["ai"])


def _sse_event(event: str, data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    return f"event: {event}\ndata: {payload}\n\n"


class DemoCompletionRequest(BaseModel):
    prompt: str = Field(min_length=2, max_length=2000)


class AIStatusResponse(BaseModel):
    provider: str
    configured: bool
    mock_fallback_enabled: bool


@router.get("/status", response_model=AIStatusResponse)
def ai_status() -> AIStatusResponse:
    settings = get_settings()
    service = AIService(settings)
    return AIStatusResponse(
        provider=service.provider_name,
        configured=service.provider_configured,
        mock_fallback_enabled=settings.allow_mock_fallback,
    )


@router.post("/demo-completion", response_model=AICompletion)
async def demo_completion(payload: DemoCompletionRequest) -> AICompletion:
    settings = get_settings()
    service = AIService(settings)
    request = AICompletionRequest(
        messages=[
            AIMessage(
                role="system",
                content=(
                    "你是校园可生长知识空间中的学习引导助手。"
                    "回答应简洁、可验证，并给出下一步探索方向。"
                    "使用 Markdown，但不要使用表格；总长度控制在 260 个中文字符以内，"
                    "最多包含三个要点和一个追问。"
                ),
            ),
            AIMessage(role="user", content=payload.prompt),
        ],
        max_tokens=360,
    )
    try:
        return await service.complete(request)
    except Exception as error:
        raise HTTPException(status_code=502, detail="AI Provider 暂时不可用。") from error


@router.post("/study-chat", response_model=StudyChatResponse)
async def study_chat(payload: StudyChatRequest) -> StudyChatResponse:
    try:
        return await AICompanionService(get_settings()).chat(payload)
    except StructuredOutputError as error:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AI_STRUCTURED_OUTPUT_INVALID",
                "message": "模型输出未通过结构化合同校验。",
            },
        ) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="AI Provider 暂时不可用。") from error


@router.post("/study-chat/stream")
async def stream_study_chat(payload: StudyChatRequest) -> StreamingResponse:
    service = AICompanionService(get_settings())

    async def event_source():
        try:
            async for event, data in service.stream_chat_events(payload):
                yield _sse_event(event, data)
        except Exception:
            yield _sse_event(
                "error",
                {
                    "code": "AI_STREAM_FAILED",
                    "message": "DeepSeek 流式回答暂时不可用，请稍后重试。",
                },
            )

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/annotate-text", response_model=AnnotateTextResponse)
async def annotate_text(payload: AnnotateTextRequest) -> AnnotateTextResponse:
    return await AICompanionService(get_settings()).annotate_text(
        payload.text,
        source_context=payload.source_context,
        learner_context=payload.learner_context,
    )


@router.post("/knowledge-card", response_model=GenerateKnowledgeCardResponse)
async def generate_knowledge_card(
    payload: GenerateKnowledgeCardRequest,
) -> GenerateKnowledgeCardResponse:
    try:
        return await AICompanionService(get_settings()).generate_card(payload)
    except StructuredOutputError as error:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "AI_STRUCTURED_OUTPUT_INVALID",
                "message": "知识卡片未通过结构化合同校验。",
            },
        ) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail="AI Provider 暂时不可用。") from error
