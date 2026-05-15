"""add resale_price to quotation_items

Revision ID: 53005094fc19
Revises: 5114191c61e2
Create Date: 2026-05-15 08:12:42.969695

Adds quotation_items.resale_price (NUMERIC(12, 0) NOT NULL DEFAULT 0).

Semantics: only meaningful for trade-in items (is_trade_in=True). Existing
rows backfill to 0, which preserves the prior profit formula (the new
formula adds + total_trade_in_resale, and 0 leaves it unchanged).
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '53005094fc19'
down_revision: Union[str, Sequence[str], None] = '5114191c61e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quotation_items",
        sa.Column(
            "resale_price",
            sa.Numeric(12, 0),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("quotation_items", "resale_price")
