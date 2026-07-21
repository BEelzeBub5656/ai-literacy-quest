"""create demo personas

Revision ID: 20260720_0001
Revises:
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260720_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "demo_personas",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=24), nullable=False),
        sa.Column("display_name", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("primary_action", sa.String(length=120), nullable=False),
        sa.Column("accent_color", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_demo_personas_role", "demo_personas", ["role"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_demo_personas_role", table_name="demo_personas")
    op.drop_table("demo_personas")

