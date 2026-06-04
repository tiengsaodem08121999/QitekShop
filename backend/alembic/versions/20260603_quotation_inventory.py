"""quotation_inventory links + flag + delivered status

Revision ID: 20260603qinv
Revises: 20260603inv0
Create Date: 2026-06-03 11:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260603qinv'
down_revision: Union[str, Sequence[str], None] = '20260603inv0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('quotation_items', sa.Column('inventory_item_id', sa.Integer(), nullable=True))
    op.create_index('ix_quotation_items_inventory_item_id', 'quotation_items', ['inventory_item_id'])
    op.create_foreign_key(
        'fk_quotation_items_inventory_item_id', 'quotation_items',
        'inventory_items', ['inventory_item_id'], ['id'], ondelete='SET NULL',
    )
    op.add_column('returns', sa.Column('inventory_item_id', sa.Integer(), nullable=True))
    op.create_index('ix_returns_inventory_item_id', 'returns', ['inventory_item_id'])
    op.create_foreign_key(
        'fk_returns_inventory_item_id', 'returns',
        'inventory_items', ['inventory_item_id'], ['id'], ondelete='SET NULL',
    )
    op.execute("ALTER TABLE quotations MODIFY status ENUM('draft','confirmed','delivered') NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE quotations MODIFY status ENUM('draft','confirmed') NOT NULL")
    op.drop_constraint('fk_returns_inventory_item_id', 'returns', type_='foreignkey')
    op.drop_index('ix_returns_inventory_item_id', table_name='returns')
    op.drop_column('returns', 'inventory_item_id')
    op.drop_constraint('fk_quotation_items_inventory_item_id', 'quotation_items', type_='foreignkey')
    op.drop_index('ix_quotation_items_inventory_item_id', table_name='quotation_items')
    op.drop_column('quotation_items', 'inventory_item_id')
