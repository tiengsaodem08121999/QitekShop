import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class QuotationStatus(str, enum.Enum):
    draft = "draft"
    confirmed = "confirmed"


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    quotations: Mapped[list["Quotation"]] = relationship(back_populates="customer")


class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    status: Mapped[QuotationStatus] = mapped_column(
        Enum(QuotationStatus), default=QuotationStatus.draft
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    total_paid: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    total_trade_in: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    customer: Mapped["Customer"] = relationship(back_populates="quotations")
    items: Mapped[list["QuotationItem"]] = relationship(
        back_populates="quotation", cascade="all, delete-orphan"
    )


class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    quotation_id: Mapped[int] = mapped_column(ForeignKey("quotations.id"))
    is_trade_in: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String(200))
    condition: Mapped[str | None] = mapped_column(String(10), nullable=True)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    selling_price: Mapped[Decimal] = mapped_column(Numeric(12, 0), default=0)
    warranty: Mapped[str | None] = mapped_column(String(20), nullable=True)
    warranty_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    quotation: Mapped["Quotation"] = relationship(back_populates="items")
