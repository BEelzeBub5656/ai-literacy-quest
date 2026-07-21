"""create card details and sources

Revision ID: 20260720_0003
Revises: 20260720_0002
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260720_0003"
down_revision: str | None = "20260720_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_card_details",
        sa.Column("card_id", sa.String(length=64), nullable=False),
        sa.Column("topic_summary", sa.Text(), nullable=False),
        sa.Column("blocks_json", sa.JSON(), nullable=False),
        sa.Column("created_by_type", sa.String(length=24), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["card_id"], ["knowledge_cards.id"]),
        sa.PrimaryKeyConstraint("card_id"),
    )
    op.create_table(
        "knowledge_card_sources",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("card_id", sa.String(length=64), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("locator", sa.String(length=200), nullable=False),
        sa.Column("quote_text", sa.Text(), nullable=False),
        sa.Column("url", sa.String(length=800), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["card_id"], ["knowledge_cards.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_knowledge_card_sources_card_id",
        "knowledge_card_sources",
        ["card_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_knowledge_card_sources_card_id", table_name="knowledge_card_sources"
    )
    op.drop_table("knowledge_card_sources")
    op.drop_table("knowledge_card_details")
