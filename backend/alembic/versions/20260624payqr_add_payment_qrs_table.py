"""add payment_qrs table

Revision ID: 20260624payqr
Revises: 20260618sell
Create Date: 2026-06-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

revision: str = "20260624payqr"
down_revision: Union[str, Sequence[str], None] = "20260618sell"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payment_qrs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("image", mysql.LONGTEXT().with_variant(sa.Text(), "sqlite"), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("payment_qrs")
