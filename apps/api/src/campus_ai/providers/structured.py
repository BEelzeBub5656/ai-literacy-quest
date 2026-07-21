import json
from dataclasses import dataclass
from typing import Generic, TypeVar

from pydantic import BaseModel, ValidationError

from campus_ai.providers.base import AICompletionRequest, AIMessage
from campus_ai.providers.service import AIService


SchemaT = TypeVar("SchemaT", bound=BaseModel)


class StructuredOutputError(RuntimeError):
    """Raised when a provider cannot satisfy a structured output contract."""


@dataclass(frozen=True)
class StructuredCompletion(Generic[SchemaT]):
    value: SchemaT
    provider: str
    model: str
    fallback_used: bool


def _parse_json_object(content: str) -> object:
    candidate = content.strip()
    if candidate.startswith("```"):
        lines = candidate.splitlines()
        if len(lines) >= 3 and lines[-1].strip() == "```":
            candidate = "\n".join(lines[1:-1]).strip()
    return json.loads(candidate)


async def generate_structured(
    service: AIService,
    *,
    output_kind: str,
    schema: type[SchemaT],
    messages: list[AIMessage],
    max_tokens: int = 1800,
    max_attempts: int = 3,
) -> StructuredCompletion[SchemaT]:
    schema_json = json.dumps(schema.model_json_schema(), ensure_ascii=False)
    contract_message = AIMessage(
        role="system",
        content=(
            f"CAMPUS_OUTPUT_KIND={output_kind}\n"
            "你必须只输出一个符合下方 JSON Schema 的 JSON 对象。"
            "不得使用 Markdown 代码围栏，不得输出解释性前后缀，不得添加未知字段。"
            "reasoning_steps 是面向学习者的可审计教学解释，不是隐藏思维链。\n"
            f"JSON_SCHEMA={schema_json}"
        ),
    )
    attempt_messages = [contract_message, *messages]
    last_error = "unknown"

    for attempt in range(max_attempts):
        completion = await service.complete(
            AICompletionRequest(
                messages=attempt_messages,
                temperature=0.15,
                max_tokens=max_tokens,
            )
        )
        try:
            raw_value = _parse_json_object(completion.content)
            value = schema.model_validate(raw_value)
            return StructuredCompletion(
                value=value,
                provider=completion.provider,
                model=completion.model,
                fallback_used=completion.fallback_used,
            )
        except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as error:
            last_error = str(error)
            if attempt == max_attempts - 1:
                break
            attempt_messages = [
                contract_message,
                *messages,
                AIMessage(role="assistant", content=completion.content[:6000]),
                AIMessage(
                    role="user",
                    content=(
                        "上一份输出未通过合同校验。请修复后重新输出完整 JSON，"
                        "仍然不要添加任何前后缀。校验摘要："
                        f"{last_error[:1200]}"
                    ),
                ),
            ]

    raise StructuredOutputError(
        f"模型连续 {max_attempts} 次未能生成有效结构化输出：{last_error[:300]}"
    )

