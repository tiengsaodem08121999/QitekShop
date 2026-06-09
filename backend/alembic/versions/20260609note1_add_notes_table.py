"""add notes table (idempotent)

Revision ID: 20260609note1
Revises: 20260608note0
Create Date: 2026-06-09 00:00:00.000000

Creates the `notes` table holding the single shared scratchpad note. Idempotent:
the table is created only when missing, so `alembic upgrade head` succeeds on a
fresh DB and on a DB that already has the table as residue.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260609note1"
down_revision: Union[str, Sequence[str], None] = "20260608note0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return insp.has_table(name)


def upgrade() -> None:
    if not _has_table("notes"):
        op.create_table(
            "notes",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("content", sa.Text(), nullable=True),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    if _has_table("notes"):
        op.drop_table("notes")
