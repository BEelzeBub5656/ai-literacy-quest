from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from campus_ai.core.config import PROJECT_ROOT, get_settings


settings = get_settings()

if settings.resolved_database_url.startswith("sqlite"):
    (PROJECT_ROOT / "data").mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if settings.resolved_database_url.startswith("sqlite") else {}
engine = create_engine(settings.resolved_database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
