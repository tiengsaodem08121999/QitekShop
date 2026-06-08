"""add note to quotations (idempotent)

Revision ID: 20260608note0
Revises: 20260605dlv0
Create Date: 2026-06-08 00:00:00.000000

Adds quotations.note (TEXT, nullable). Idempotent: the live DB already has this
column as residue from an orphaned migration, so we add it only when missing.
That keeps `alembic upgrade head` from failing with "duplicate column" on the
residue DB while still creating the column on a fresh database.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260608note0"
down_revision: Union[str, Sequence[str], None] = "20260605dlv0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return any(col["name"] == column for col in insp.get_columns(table))


def upgrade() -> None:
    if not _has_column("quotations", "note"):
        op.add_column("quotations", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    if _has_column("quotations", "note"):
        op.drop_column("quotations", "note")
