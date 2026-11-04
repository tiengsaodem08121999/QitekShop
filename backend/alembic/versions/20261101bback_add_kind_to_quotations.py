"""add kind to quotations (sale / buyback)

A buyback (báo giá thu cũ) records goods bought back from a customer. It holds
only trade-in lines, so it reuses their stock import and price sync. Every
existing quotation is a sale.

Revision ID: 20261101bback
Revises: 20261101dlvat
Create Date: 2026-11-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261101bback'
down_revision: Union[str, Sequence[str], None] = '20261101dlvat'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(bind, table: str, column: str) -> bool:
    return column in {c['name'] for c in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_column(bind, 'quotations', 'kind'):
        op.add_column('quotations', sa.Column(
            'kind', sa.Enum('sale', 'buyback', name='quotationkind'),
            nullable=False, server_default='sale',
        ))


def downgrade() -> None:
    bind = op.get_bind()
    if _has_column(bind, 'quotations', 'kind'):
        op.drop_column('quotations', 'kind')
