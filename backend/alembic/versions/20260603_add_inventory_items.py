"""add_inventory_items

Revision ID: 20260603inv0
Revises: 7e4b2a1f3c8d
Create Date: 2026-06-03 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20260603inv0'
down_revision: Union[str, Sequence[str], None] = '7e4b2a1f3c8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inventory_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('serial_number', sa.String(length=100), nullable=True),
        sa.Column('purchase_price', sa.Numeric(precision=12, scale=0), server_default='0', nullable=False),
        sa.Column('selling_price', sa.Numeric(precision=12, scale=0), nullable=True),
        sa.Column('supplier', sa.String(length=200), nullable=True),
        sa.Column('status', sa.Enum('in_stock', 'sold', 'returned', name='inventorystatus'),
                  server_default='in_stock', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_items_name', 'inventory_items', ['name'])
    op.create_index('ix_inventory_items_serial_number', 'inventory_items', ['serial_number'])


def downgrade() -> None:
    op.drop_index('ix_inventory_items_serial_number', table_name='inventory_items')
    op.drop_index('ix_inventory_items_name', table_name='inventory_items')
    op.drop_table('inventory_items')
    op.execute("DROP TYPE IF EXISTS inventorystatus")
