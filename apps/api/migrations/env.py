from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from campus_ai.core.config import PROJECT_ROOT, get_settings
from campus_ai.db.base import Base
from campus_ai.modules.identity import models as identity_models  # noqa: F401
from campus_ai.modules.knowledge_space import models as knowledge_models  # noqa: F401


config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
if settings.resolved_database_url.startswith("sqlite"):
    (PROJECT_ROOT / "data").mkdir(parents=True, exist_ok=True)
config.set_main_option("sqlalchemy.url", settings.resolved_database_url)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
