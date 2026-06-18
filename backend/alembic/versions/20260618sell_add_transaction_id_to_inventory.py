"""add transaction_id to inventory_items

Revision ID: 20260618sell
Revises: 20260617logo
Create Date: 2026-06-18 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260618sell'
down_revision: Union[str, Sequence[str], None] = '20260617logo'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, 'inventory_items', 'transaction_id'):
        op.add_column('inventory_items',
                      sa.Column('transaction_id', sa.Integer(), nullable=True))
        op.create_index('ix_inventory_items_transaction_id',
                        'inventory_items', ['transaction_id'])
        op.create_foreign_key('fk_inventory_items_transaction_id',
                              'inventory_items', 'transactions',
                              ['transaction_id'], ['id'])


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'inventory_items', 'transaction_id'):
        op.drop_constraint('fk_inventory_items_transaction_id',
                           'inventory_items', type_='foreignkey')
        op.drop_index('ix_inventory_items_transaction_id',
                      table_name='inventory_items')
        op.drop_column('inventory_items', 'transaction_id')
