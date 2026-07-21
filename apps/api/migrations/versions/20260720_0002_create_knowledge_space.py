"""create growable knowledge space

Revision ID: 20260720_0002
Revises: 20260720_0001
Create Date: 2026-07-20
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260720_0002"
down_revision: str | None = "20260720_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "knowledge_workspaces",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_persona_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("course_name", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_persona_id"], ["demo_personas.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_knowledge_workspaces_owner_persona_id",
        "knowledge_workspaces",
        ["owner_persona_id"],
    )
    op.create_table(
        "knowledge_cards",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("card_type", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("position_x", sa.Float(), nullable=False),
        sa.Column("position_y", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["workspace_id"], ["knowledge_workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_knowledge_cards_workspace_id", "knowledge_cards", ["workspace_id"])
    op.create_table(
        "knowledge_edges",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=64), nullable=False),
        sa.Column("source_card_id", sa.String(length=64), nullable=False),
        sa.Column("target_card_id", sa.String(length=64), nullable=False),
        sa.Column("relation_type", sa.String(length=24), nullable=False),
        sa.Column("context_mode", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_card_id"], ["knowledge_cards.id"]),
        sa.ForeignKeyConstraint(["target_card_id"], ["knowledge_cards.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["knowledge_workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "workspace_id", "source_card_id", "target_card_id", name="uq_knowledge_edge_endpoints"
        ),
    )
    op.create_index("ix_knowledge_edges_workspace_id", "knowledge_edges", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_edges_workspace_id", table_name="knowledge_edges")
    op.drop_table("knowledge_edges")
    op.drop_index("ix_knowledge_cards_workspace_id", table_name="knowledge_cards")
    op.drop_table("knowledge_cards")
    op.drop_index(
        "ix_knowledge_workspaces_owner_persona_id", table_name="knowledge_workspaces"
    )
    op.drop_table("knowledge_workspaces")
