"""backfill status for legacy quotations (delivered / confirmed)

The pre-inventory system only had draft/confirmed, and the imported production
data has all legacy quotations sitting in 'draft'. Reclassify them to match
reality now that the inventory feature adds a 'delivered' state:

  - id 20, 21      -> confirmed  (xác nhận, chưa giao hàng)
  - id 1..18       -> delivered  (đã giao hàng)

One-time data backfill targeted by explicit id, so it only ever touches these
known legacy rows and never any quotation created after deployment. A no-op on a
fresh install (no matching ids).

Revision ID: 20260605dlv0
Revises: 20260603qinv
Create Date: 2026-06-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = '20260605dlv0'
down_revision: Union[str, Sequence[str], None] = '20260603qinv'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Legacy quotation ids present in the imported production data (id 19 does not exist).
_CONFIRMED_IDS = "(20, 21)"
_DELIVERED_IDS = "(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18)"
_ALL_LEGACY_IDS = "(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21)"


def upgrade() -> None:
    op.execute(f"UPDATE quotations SET status = 'confirmed' WHERE id IN {_CONFIRMED_IDS}")
    op.execute(f"UPDATE quotations SET status = 'delivered' WHERE id IN {_DELIVERED_IDS}")


def downgrade() -> None:
    # Restore the legacy rows to their original 'draft' state. Must run before any
    # downgrade of 20260603qinv (which narrows the enum back to draft/confirmed).
    op.execute(f"UPDATE quotations SET status = 'draft' WHERE id IN {_ALL_LEGACY_IDS}")
