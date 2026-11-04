"""add note to inventory_items

A customer-facing note per stock item, shown only on the public stock page
(/kho-hang). Existing items start without a note.

Revision ID: 20261103inote
Revises: 20261103shipg
Create Date: 2026-11-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261103inote'
down_revision: Union[str, Sequence[str], None] = '20261103shipg'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, 'inventory_items', 'note'):
        op.add_column('inventory_items', sa.Column('note', sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'inventory_items', 'note'):
        op.drop_column('inventory_items', 'note')
