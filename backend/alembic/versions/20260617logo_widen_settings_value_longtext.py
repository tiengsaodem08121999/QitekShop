"""widen settings.value to LONGTEXT for base64 logos (MySQL only)

Revision ID: 20260617logo
Revises: 20260616sync
Create Date: 2026-06-17 00:00:00.000000

The shop logo is stored as a base64 data URL in `settings.value`. Plain TEXT
caps at ~64KB which truncates any real image, so widen to LONGTEXT on MySQL.
No-op on non-MySQL dialects (SQLite tests build schema from the models).
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import mysql


revision: str = "20260617logo"
down_revision: Union[str, Sequence[str], None] = "20260616sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "mysql":
        return
    op.alter_column(
        "settings", "value",
        existing_type=mysql.TEXT(),
        type_=mysql.LONGTEXT(),
        existing_nullable=True,
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != "mysql":
        return
    op.alter_column(
        "settings", "value",
        existing_type=mysql.LONGTEXT(),
        type_=mysql.TEXT(),
        existing_nullable=True,
    )
