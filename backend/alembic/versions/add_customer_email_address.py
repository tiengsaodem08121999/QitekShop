"""add email and address to customers

Revision ID: a1b2c3d4e5f6
Revises: 00dbb94f096d
Create Date: 2026-03-13 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '00dbb94f096d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('email', sa.String(length=100), nullable=True))
    op.add_column('customers', sa.Column('address', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('customers', 'address')
    op.drop_column('customers', 'email')
