"""add_payment_type_column

Revision ID: f1a2b3c4d5e6
Revises: d5764bf1da78
Create Date: 2026-03-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'd5764bf1da78'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add payment_type column to payments table."""
    op.add_column('payments', sa.Column('payment_type', sa.Enum('payment', 'refund', name='paymenttype'), nullable=False, server_default='payment'))


def downgrade() -> None:
    """Remove payment_type column from payments table."""
    op.drop_column('payments', 'payment_type')
