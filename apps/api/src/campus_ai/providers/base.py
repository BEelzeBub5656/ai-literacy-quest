from abc import ABC, abstractmethod
from typing import Literal

from pydantic import BaseModel, Field


class AIMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class AICompletionRequest(BaseModel):
    messages: list[AIMessage] = Field(min_length=1)
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=700, ge=32, le=4096)


class AICompletion(BaseModel):
    provider: str
    model: str
    content: str
    fallback_used: bool = False


class AIProvider(ABC):
    name: str

    @property
    @abstractmethod
    def configured(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    async def complete(self, request: AICompletionRequest) -> AICompletion:
        raise NotImplementedError

