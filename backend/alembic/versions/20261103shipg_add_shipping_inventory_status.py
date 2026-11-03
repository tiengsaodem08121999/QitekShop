"""add 'shipping' to inventory_items.status

A unit on its way to the customer (money not received yet): not sold, but no
longer offered for sale. Existing rows keep their status.

Revision ID: 20261103shipg
Revises: 20261103expct
Create Date: 2026-11-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261103shipg'
down_revision: Union[str, Sequence[str], None] = '20261103expct'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _status_type(bind) -> str:
    for c in sa.inspect(bind).get_columns('inventory_items'):
        if c['name'] == 'status':
            return str(getattr(c['type'], 'enums', c['type']))
    return ''


def upgrade() -> None:
    bind = op.get_bind()
    if 'shipping' in _status_type(bind):
        return
    op.execute(
        "ALTER TABLE inventory_items MODIFY status "
        "ENUM('in_stock','sold','returned','shipping') NOT NULL DEFAULT 'in_stock'"
    )


def downgrade() -> None:
    # Units still being shipped go back to plain in-stock before the value is dropped.
    op.execute("UPDATE inventory_items SET status = 'in_stock' WHERE status = 'shipping'")
    op.execute(
        "ALTER TABLE inventory_items MODIFY status "
        "ENUM('in_stock','sold','returned') NOT NULL DEFAULT 'in_stock'"
    )
