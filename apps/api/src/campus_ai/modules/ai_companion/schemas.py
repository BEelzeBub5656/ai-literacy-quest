from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StudyChatMessage(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class ReasoningStep(StrictModel):
    step: int = Field(ge=1, le=5)
    title: str = Field(min_length=2, max_length=40)
    explanation: str = Field(min_length=4, max_length=320)
    based_on: list[str] = Field(min_length=1, max_length=5)


class KeywordDraft(StrictModel):
    text: str = Field(min_length=1, max_length=24)
    normalized_text: str = Field(min_length=1, max_length=48)
    definition: str = Field(min_length=4, max_length=160)
    selection_reason: str = Field(min_length=4, max_length=180)
    confidence: float = Field(ge=0, le=1)


class StudyAssistantDraft(StrictModel):
    schema_version: Literal["1.0"]
    answer_markdown: str = Field(min_length=8, max_length=5000)
    reasoning_summary: str = Field(min_length=8, max_length=500)
    reasoning_steps: list[ReasoningStep] = Field(min_length=2, max_length=5)
    assumptions: list[str] = Field(default_factory=list, max_length=5)
    uncertainties: list[str] = Field(default_factory=list, max_length=5)
    keywords: list[KeywordDraft] = Field(min_length=3, max_length=6)
    follow_up_questions: list[str] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def validate_steps_and_keywords(self) -> "StudyAssistantDraft":
        expected_steps = list(range(1, len(self.reasoning_steps) + 1))
        actual_steps = [item.step for item in self.reasoning_steps]
        if actual_steps != expected_steps:
            raise ValueError("reasoning_steps 必须从 1 开始连续编号")

        normalized = [item.normalized_text.casefold() for item in self.keywords]
        if len(normalized) != len(set(normalized)):
            raise ValueError("keywords 规范化后不得重复")
        return self


class KeywordItem(KeywordDraft):
    id: str = Field(min_length=1, max_length=80)


class StudyAssistantOutput(StrictModel):
    schema_version: Literal["1.0"]
    answer_markdown: str
    reasoning_summary: str
    reasoning_steps: list[ReasoningStep]
    assumptions: list[str]
    uncertainties: list[str]
    keywords: list[KeywordItem]
    follow_up_questions: list[str]


class StudyChatRequest(StrictModel):
    conversation_id: str = Field(min_length=1, max_length=80)
    messages: list[StudyChatMessage] = Field(min_length=1, max_length=24)

    @model_validator(mode="after")
    def require_latest_user_message(self) -> "StudyChatRequest":
        if self.messages[-1].role != "user":
            raise ValueError("最后一条消息必须来自用户")
        return self


class StudyChatResponse(StrictModel):
    conversation_id: str
    message_id: str
    provider: str
    model: str
    fallback_used: bool
    output: StudyAssistantOutput


class InlineKeywordDraft(StrictModel):
    text: str = Field(min_length=1, max_length=30)
    normalized_text: str = Field(min_length=1, max_length=60)
    importance: int = Field(ge=1, le=3)


class InlineKeywordCollection(StrictModel):
    keywords: list[InlineKeywordDraft] = Field(default_factory=list, max_length=8)


class EvidenceRef(StrictModel):
    type: Literal["message", "card", "course", "concept"]
    id: str = Field(min_length=1, max_length=100)


class KnowledgeCardDraft(StrictModel):
    schema_version: Literal["1.0"]
    title: str = Field(min_length=2, max_length=24)
    plain_explanation: str = Field(min_length=8, max_length=180)
    reasoning_summary: str = Field(min_length=8, max_length=240)
    reasoning_steps: list[ReasoningStep] = Field(min_length=1, max_length=3)
    key_points: list[str] = Field(min_length=2, max_length=3)
    keywords: list[KeywordDraft] = Field(min_length=2, max_length=4)
    assumptions: list[str] = Field(default_factory=list, max_length=5)
    uncertainties: list[str] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def validate_steps_and_keywords(self) -> "KnowledgeCardDraft":
        expected_steps = list(range(1, len(self.reasoning_steps) + 1))
        actual_steps = [item.step for item in self.reasoning_steps]
        if actual_steps != expected_steps:
            raise ValueError("reasoning_steps 必须从 1 开始连续编号")
        normalized = [item.normalized_text.casefold() for item in self.keywords]
        if len(normalized) != len(set(normalized)):
            raise ValueError("keywords 规范化后不得重复")
        return self


class GenerateKnowledgeCardRequest(StrictModel):
    selected_text: str = Field(min_length=1, max_length=1000)
    source_message_id: str = Field(min_length=1, max_length=80)
    source_message_content: str = Field(min_length=1, max_length=8000)
    parent_card_id: str | None = Field(default=None, max_length=80)
    keyword_context: str | None = Field(default=None, max_length=80)


class KnowledgeCardOutput(StrictModel):
    schema_version: Literal["1.0"]
    card_id: str
    parent_card_id: str | None
    source_message_id: str
    selected_text: str
    title: str
    plain_explanation: str
    reasoning_summary: str
    reasoning_steps: list[ReasoningStep]
    key_points: list[str]
    keywords: list[KeywordItem]
    evidence_refs: list[EvidenceRef]
    assumptions: list[str]
    uncertainties: list[str]


class GenerateKnowledgeCardResponse(StrictModel):
    provider: str
    model: str
    fallback_used: bool
    card: KnowledgeCardOutput
