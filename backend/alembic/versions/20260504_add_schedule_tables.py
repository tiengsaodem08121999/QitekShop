"""add_schedule_tables

Revision ID: 20260504aaaa
Revises: f1a2b3c4d5e6
Create Date: 2026-05-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260504aaaa'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'schedule_tags',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('color', sa.String(length=7), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_table(
        'schedule_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column(
            'status',
            sa.Enum('pending', 'in_progress', 'done', 'cancelled', name='eventstatus'),
            server_default='pending',
            nullable=False,
        ),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_schedule_events_date_active', 'schedule_events', ['date', 'is_deleted'])
    op.create_table(
        'schedule_event_tags',
        sa.Column('event_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['event_id'], ['schedule_events.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['schedule_tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('event_id', 'tag_id'),
    )


def downgrade() -> None:
    op.drop_table('schedule_event_tags')
    op.drop_index('ix_schedule_events_date_active', table_name='schedule_events')
    op.drop_table('schedule_events')
    op.drop_table('schedule_tags')
    op.execute('DROP TYPE IF EXISTS eventstatus')
