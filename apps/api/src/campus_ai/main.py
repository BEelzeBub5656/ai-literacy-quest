from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from campus_ai.api.router import api_router
from campus_ai.core.config import get_settings
from campus_ai.db.base import Base
from campus_ai.db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    yield


settings = get_settings()

app = FastAPI(
    title="知芽校园 API",
    description="中小学 AI 通识教育 — 移动端 AI 伴学知识卡片平台",
    version=settings.app_version,
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"name": "知芽校园 API", "docs": "/docs"}
