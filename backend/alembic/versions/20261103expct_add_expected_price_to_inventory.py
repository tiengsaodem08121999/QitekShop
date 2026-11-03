"""add expected_price to inventory_items

Splits a stock item's price in two:
  - expected_price (giá bán dự kiến): typed in when importing, or a trade-in's
    resale price;
  - selling_price (giá bán): the actual sale price, set only when the unit is
    sold (quotation delivered, or a Finance income transaction).

Backfill, run once when the column is added: every item's old selling price is
copied to expected_price (0 counts as unpriced). For items that are not sold,
the old selling price was only ever an expected one, so it is cleared.

Revision ID: 20261103expct
Revises: 20261101bnocu
Create Date: 2026-11-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261103expct'
down_revision: Union[str, Sequence[str], None] = '20261101bnocu'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'inventory_items', 'expected_price'):
        return
    op.add_column('inventory_items',
                  sa.Column('expected_price', sa.Numeric(12, 0), nullable=True))
    op.execute(
        "UPDATE inventory_items SET expected_price = NULLIF(selling_price, 0)"
    )
    op.execute(
        "UPDATE inventory_items SET selling_price = NULL WHERE status <> 'sold'"
    )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'inventory_items', 'expected_price'):
        # Unsold items get their expected price back as the single price.
        op.execute(
            "UPDATE inventory_items SET selling_price = expected_price WHERE status <> 'sold'"
        )
        op.drop_column('inventory_items', 'expected_price')
