"""add condition to inventory_items (idempotent)

Revision ID: 20260616sync
Revises: 20260609note1
Create Date: 2026-06-16 00:00:00.000000

Adds inventory_items.condition (VARCHAR(10) NULL). Additive only — no backfill,
no destructive DDL. Idempotent: the column is added only when missing, so
`alembic upgrade head` succeeds on a fresh DB and on a DB that already has it.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260616sync"
down_revision: Union[str, Sequence[str], None] = "20260609note1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    if "condition" not in _columns("inventory_items"):
        op.add_column("inventory_items", sa.Column("condition", sa.String(length=10), nullable=True))


def downgrade() -> None:
    if "condition" in _columns("inventory_items"):
        op.drop_column("inventory_items", "condition")
