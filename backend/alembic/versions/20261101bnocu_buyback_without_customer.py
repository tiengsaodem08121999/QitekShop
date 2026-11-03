"""quotations.customer_id nullable: a buyback has no customer

NOTE: the buyback feature was removed from the code, but this revision had
already been applied to a database, so it must stay in the chain (deleting it
makes `alembic upgrade head` fail with "Can't locate revision"). The extra
column/nullability is unused by the code and harmless.

Revision ID: 20261101bnocu
Revises: 20261101bback
Create Date: 2026-11-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '20261101bnocu'
down_revision: Union[str, Sequence[str], None] = '20261101bback'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('quotations', 'customer_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column('quotations', 'customer_id', existing_type=sa.Integer(), nullable=False)
