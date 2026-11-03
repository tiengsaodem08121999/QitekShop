"""add delivered_at to quotations

The dashboard's sales-profit chart counts a quotation's lines in the month it was
delivered. Existing delivered quotations are backfilled from their earliest
warranty start (set to the hand-over day in practice), else their creation day.

Revision ID: 20261101dlvat
Revises: 20261101rsold
Create Date: 2026-11-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261101dlvat'
down_revision: Union[str, Sequence[str], None] = '20261101rsold'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, 'quotations', 'delivered_at'):
        op.add_column('quotations', sa.Column('delivered_at', sa.Date(), nullable=True))
    op.execute(
        """
        UPDATE quotations q
        SET q.delivered_at = COALESCE(
            (SELECT MIN(qi.warranty_start) FROM quotation_items qi
             WHERE qi.quotation_id = q.id AND qi.is_trade_in = 0),
            DATE(q.created_at)
        )
        WHERE q.status = 'delivered' AND q.delivered_at IS NULL
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'quotations', 'delivered_at'):
        op.drop_column('quotations', 'delivered_at')
