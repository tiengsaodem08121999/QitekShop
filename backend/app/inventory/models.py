import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, Enum, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InventoryStatus(str, enum.Enum):
    in_stock = "in_stock"
    sold = "sold"
    returned = "returned"


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200))
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    condition: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    selling_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 0), nullable=True)
    supplier: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[InventoryStatus] = mapped_column(
        Enum(InventoryStatus), default=InventoryStatus.in_stock, server_default="in_stock"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
