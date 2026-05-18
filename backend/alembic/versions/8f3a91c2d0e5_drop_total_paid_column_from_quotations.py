"""drop total_paid column from quotations

Revision ID: 8f3a91c2d0e5
Revises: 53005094fc19
Create Date: 2026-05-18 15:10:00.000000

Removes the denormalized quotations.total_paid column. The service layer now
computes total_paid from SUM(payments.amount WHERE payment_type='payment')
on read, eliminating a race condition between concurrent payment writes that
could silently lose updates.

Downgrade re-adds the column and backfills from the same SUM.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "8f3a91c2d0e5"
down_revision: Union[str, Sequence[str], None] = "53005094fc19"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("quotations", "total_paid")


def downgrade() -> None:
    op.add_column(
        "quotations",
        sa.Column(
            "total_paid",
            sa.Numeric(12, 0),
            nullable=False,
            server_default="0",
        ),
    )
    op.execute(
        """
        UPDATE quotations q
        SET total_paid = COALESCE((
            SELECT SUM(p.amount) FROM payments p
            WHERE p.quotation_id = q.id AND p.payment_type = 'payment'
        ), 0)
        """
    )
