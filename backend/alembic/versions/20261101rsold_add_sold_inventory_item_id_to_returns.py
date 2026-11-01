"""add sold_inventory_item_id to returns

Pins a return to the exact sale line it refers to, so returning one of several
same-name lines no longer marks all of them as returned.

Revision ID: 20261101rsold
Revises: 20260624payqr
Create Date: 2026-11-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261101rsold'
down_revision: Union[str, Sequence[str], None] = '20260624payqr'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, 'returns', 'sold_inventory_item_id'):
        op.add_column('returns',
                      sa.Column('sold_inventory_item_id', sa.Integer(), nullable=True))
        op.create_foreign_key('fk_returns_sold_inventory_item_id',
                              'returns', 'inventory_items',
                              ['sold_inventory_item_id'], ['id'], ondelete='SET NULL')
    # Backfill: the restocked unit copied the serial of the sale line it came from.
    op.execute(
        """
        UPDATE returns r
        JOIN inventory_items rs ON rs.id = r.inventory_item_id
        JOIN quotation_items qi
          ON qi.quotation_id = r.quotation_id
         AND qi.is_trade_in = 0
         AND qi.name = r.item_name
         AND qi.inventory_item_id IS NOT NULL
         AND qi.serial_number = rs.serial_number
        SET r.sold_inventory_item_id = qi.inventory_item_id
        WHERE r.sold_inventory_item_id IS NULL
          AND rs.serial_number IS NOT NULL
          AND rs.serial_number <> ''
        """
    )


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'returns', 'sold_inventory_item_id'):
        op.drop_constraint('fk_returns_sold_inventory_item_id',
                           'returns', type_='foreignkey')
        op.drop_column('returns', 'sold_inventory_item_id')
