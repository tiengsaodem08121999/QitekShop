"""add title to quotations: the name a user gives a buyback (báo giá thu cũ)

Buybacks live in `quotations` with kind='buyback' and no customer (20261101bback,
20261101bnocu). Sale quotations are named after their customer and keep a null title.

Revision ID: 20261104bbtit
Revises: 20261103inote
Create Date: 2026-11-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261104bbtit'
down_revision: Union[str, Sequence[str], None] = '20261103inote'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, 'quotations', 'title'):
        op.add_column('quotations', sa.Column('title', sa.String(200), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'quotations', 'title'):
        op.drop_column('quotations', 'title')
