import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InventoryStatus(str, enum.Enum):
    in_stock = "in_stock"
    sold = "sold"
    returned = "returned"
    # On its way to the customer, money not received yet: not sold, but no longer
    # offered (hidden from the quotation picker and the public stock page).
    shipping = "shipping"


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    condition: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    # Price we plan to sell at: typed in when importing, or a trade-in's resale price.
    expected_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 0), nullable=True)
    # Actual sale price: set only when the unit is sold (quotation delivered, or a
    # Finance income transaction); null while the unit is unsold.
    selling_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 0), nullable=True)
    supplier: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Customer-facing note, shown only on the public stock page (/kho-hang).
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[InventoryStatus] = mapped_column(
        Enum(InventoryStatus), default=InventoryStatus.in_stock, server_default="in_stock"
    )
    transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
