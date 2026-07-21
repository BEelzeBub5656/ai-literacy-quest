from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _discover_project_root() -> Path:
    current_file = Path(__file__).resolve()
    for parent in current_file.parents:
        if (parent / ".env.example").exists():
            return parent
    for parent in current_file.parents:
        if (parent / "pyproject.toml").exists():
            return parent
    return Path.cwd()


PROJECT_ROOT = _discover_project_root()


def _read_external_env(path_value: str | None) -> dict[str, str]:
    """Read a small dotenv file without copying secrets into this project."""
    if not path_value:
        return {}
    path = Path(path_value).expanduser()
    if not path.is_file():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class Settings(BaseSettings):
    """Validated runtime configuration loaded from the project-level .env file."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_debug: bool = True
    app_version: str = "0.1.0"

    database_url: str = "sqlite:///./data/campus_ai.db"
    cors_origins: str = "http://localhost:5173"

    ai_provider: Literal["mock", "longcat", "deepseek"] = "mock"
    allow_mock_fallback: bool = True

    longcat_api_key: str | None = None
    longcat_base_url: str = "https://api.longcat.chat/openai"
    longcat_model: str = "LongCat-2.0"
    longcat_timeout_seconds: float = 45.0

    deepseek_env_file: str | None = None
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"
    deepseek_timeout_seconds: float = 90.0
    deepseek_reasoning_effort: Literal["low", "medium", "high"] = "high"

    @property
    def external_deepseek_values(self) -> dict[str, str]:
        return _read_external_env(self.deepseek_env_file)

    @property
    def resolved_deepseek_api_key(self) -> str | None:
        return self.deepseek_api_key or self.external_deepseek_values.get(
            "DEEPSEEK_API_KEY"
        )

    @property
    def resolved_deepseek_base_url(self) -> str:
        return self.external_deepseek_values.get(
            "DEEPSEEK_BASE_URL",
            self.deepseek_base_url,
        )

    @property
    def resolved_deepseek_model(self) -> str:
        return self.external_deepseek_values.get(
            "DEEPSEEK_MODEL",
            self.deepseek_model,
        )

    @computed_field
    @property
    def cors_origin_list(self) -> list[str]:
        origins = {
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        }
        if self.app_env == "development":
            origins.update(
                {
                    "http://localhost:5173",
                    "http://localhost:8081",
                    "http://127.0.0.1:5173",
                    "http://127.0.0.1:8081",
                }
            )
        return sorted(origins)

    @computed_field
    @property
    def longcat_configured(self) -> bool:
        return bool(
            self.longcat_api_key
            and self.longcat_base_url
            and self.longcat_model
        )

    @computed_field
    @property
    def deepseek_configured(self) -> bool:
        return bool(
            self.resolved_deepseek_api_key
            and self.resolved_deepseek_base_url
            and self.resolved_deepseek_model
        )

    @computed_field
    @property
    def resolved_database_url(self) -> str:
        """Resolve the demo SQLite path from the repository root, not the shell cwd."""
        prefix = "sqlite:///./"
        if self.database_url.startswith(prefix):
            relative_path = self.database_url.removeprefix(prefix)
            absolute_path = (PROJECT_ROOT / relative_path).resolve().as_posix()
            return f"sqlite:///{absolute_path}"
        return self.database_url


@lru_cache
def get_settings() -> Settings:
    return Settings()
