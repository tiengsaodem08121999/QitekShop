"""add serial_number to quotation_items

Revision ID: 7e4b2a1f3c8d
Revises: 8f3a91c2d0e5
Create Date: 2026-05-18 15:30:00.000000

Adds quotation_items.serial_number (VARCHAR(100) NULL). Optional field for
recording the product serial number — only meaningful for items with one
(typically non-trade-in products with a SKU).
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "7e4b2a1f3c8d"
down_revision: Union[str, Sequence[str], None] = "8f3a91c2d0e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quotation_items",
        sa.Column("serial_number", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quotation_items", "serial_number")
