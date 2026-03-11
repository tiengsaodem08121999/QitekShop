# backend/app/quotation/schemas.py
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, model_validator

from app.quotation.models import QuotationStatus


# --- Customer ---

class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    notes: str | None = None


class CustomerResponse(BaseModel):
    id: int
    name: str
    phone: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Quotation Item ---

class DecimalModel(BaseModel):
    """Base model that serializes Decimal as float for JSON compatibility."""
    model_config = {"from_attributes": True, "json_encoders": {Decimal: float}}


class QuotationItemCreate(DecimalModel):
    is_trade_in: bool = False
    name: str
    condition: str | None = None
    purchase_price: Decimal = 0
    selling_price: Decimal = 0
    warranty: str | None = None
    warranty_start: date | None = None
    delivery_date: date | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_trade_in(self):
        if self.is_trade_in:
            self.selling_price = Decimal(0)
            self.condition = None
        return self


class QuotationItemResponse(DecimalModel):
    id: int
    is_trade_in: bool
    name: str
    condition: str | None
    purchase_price: Decimal
    selling_price: Decimal
    warranty: str | None
    warranty_start: date | None
    delivery_date: date | None
    notes: str | None

    model_config = {"from_attributes": True}


# --- Quotation ---

class QuotationCreate(BaseModel):
    customer_id: int | None = None
    new_customer: CustomerCreate | None = None
    items: list[QuotationItemCreate] = []

    @model_validator(mode="after")
    def require_customer(self):
        if not self.customer_id and not self.new_customer:
            raise ValueError("Either customer_id or new_customer is required")
        return self


class QuotationUpdate(BaseModel):
    total_paid: Decimal | None = None
    items: list[QuotationItemCreate] | None = None


class QuotationResponse(DecimalModel):
    id: int
    customer: CustomerResponse
    status: QuotationStatus
    total_amount: Decimal
    total_paid: Decimal
    total_trade_in: Decimal
    remaining: Decimal
    total_purchase: Decimal
    profit: Decimal
    items: list[QuotationItemResponse]
    created_by: int
    created_at: datetime
    updated_at: datetime


class QuotationListItem(DecimalModel):
    id: int
    customer_name: str
    customer_id: int
    status: QuotationStatus
    total_amount: Decimal
    total_paid: Decimal
    total_trade_in: Decimal
    remaining: Decimal
    created_at: datetime


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    limit: int
