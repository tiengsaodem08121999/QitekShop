# backend/app/quotation/schemas.py
import datetime as _dt
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, model_validator

from app.quotation.models import PaymentMethod, PaymentType, QuotationStatus, ReturnReason, WarrantyUnit


# --- Customer ---

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    created_at: _dt.datetime

    model_config = {"from_attributes": True}


# --- Quotation Item ---

class DecimalModel(BaseModel):
    """Base model that serializes Decimal as float for JSON compatibility."""
    model_config = {"from_attributes": True, "json_encoders": {Decimal: float}}


class QuotationItemCreate(DecimalModel):
    is_trade_in: bool = False
    name: str
    condition: Optional[str] = None
    purchase_price: Decimal = 0
    selling_price: Decimal = 0
    resale_price: Decimal = 0
    serial_number: Optional[str] = None
    inventory_item_id: Optional[int] = None
    warranty_count: Optional[int] = None
    warranty_unit: Optional[WarrantyUnit] = None
    warranty_start: Optional[_dt.date] = None
    delivery_date: Optional[_dt.date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_trade_in(self):
        if self.is_trade_in:
            self.selling_price = Decimal(0)
            self.condition = None
        return self

    @model_validator(mode="after")
    def validate_warranty(self):
        if (self.warranty_count is None) != (self.warranty_unit is None):
            raise ValueError("warranty_count and warranty_unit must both be set or both be null")
        if self.warranty_count is not None and not (1 <= self.warranty_count <= 99):
            raise ValueError("warranty_count must be between 1 and 99")
        return self

    @model_validator(mode="after")
    def validate_resale_price(self):
        if self.resale_price < 0:
            raise ValueError("resale_price must be >= 0")
        return self


class QuotationItemResponse(DecimalModel):
    id: int
    is_trade_in: bool
    name: str
    condition: Optional[str]
    purchase_price: Decimal
    selling_price: Decimal
    resale_price: Decimal
    serial_number: Optional[str]
    inventory_item_id: Optional[int] = None
    inventory_conflict: bool = False
    warranty_count: Optional[int]
    warranty_unit: Optional[WarrantyUnit]
    warranty_start: Optional[_dt.date]
    delivery_date: Optional[_dt.date]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class ResaleUpdate(BaseModel):
    """Body for PATCH /quotations/{id}/items/{item_id}/resale.

    Mutates only `resale_price` on a trade-in item. Allowed even when the
    quotation is `confirmed`, because resale recording happens after the
    sale closes.
    """
    resale_price: Decimal

    @model_validator(mode="after")
    def validate_non_negative(self):
        if self.resale_price < 0:
            raise ValueError("resale_price must be >= 0")
        return self


# --- Quotation ---

class QuotationCreate(BaseModel):
    customer_id: Optional[int] = None
    new_customer: Optional[CustomerCreate] = None
    items: List[QuotationItemCreate] = []
    import_trade_ins: bool = False

    @model_validator(mode="after")
    def require_customer(self):
        if not self.customer_id and not self.new_customer:
            raise ValueError("Either customer_id or new_customer is required")
        return self


class QuotationUpdate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    items: Optional[List[QuotationItemCreate]] = None
    import_trade_ins: bool = False


class QuotationResponse(DecimalModel):
    id: int
    customer: CustomerResponse
    status: QuotationStatus
    total_amount: Decimal
    total_paid: Decimal
    total_trade_in: Decimal
    total_trade_in_resale: Decimal
    remaining: Decimal
    total_purchase: Decimal
    profit: Decimal
    cashflow: Decimal
    deletable: bool
    total_refund: Decimal
    total_refund_paid: Decimal
    items: List[QuotationItemResponse]
    payments: List["PaymentResponse"] = []
    returns: List["ReturnResponse"] = []
    created_by: int
    created_at: _dt.datetime
    updated_at: _dt.datetime


# --- Payment ---

class PaymentCreate(BaseModel):
    amount: Decimal
    method: PaymentMethod
    payment_type: PaymentType = PaymentType.payment
    date: Optional[_dt.date] = None
    note: Optional[str] = None
    # When a conflicting item is held by another quotation, set true to unlink
    # those sale lines from stock (treat them as virtual items) and proceed.
    unlink_conflicts: bool = False


class PaymentUpdate(BaseModel):
    amount: Optional[Decimal] = None
    method: Optional[PaymentMethod] = None
    payment_type: Optional[PaymentType] = None
    date: Optional[_dt.date] = None
    note: Optional[str] = None


class PaymentResponse(DecimalModel):
    id: int
    quotation_id: int
    amount: Decimal
    method: PaymentMethod
    payment_type: PaymentType
    date: _dt.date
    note: Optional[str]
    transaction_id: Optional[int]
    created_by: int
    created_at: _dt.datetime
    updated_at: _dt.datetime


# --- Returns ---

class ReturnCreate(BaseModel):
    item_name: str
    reason: ReturnReason
    selling_price: Decimal
    refund_percent: int = 100
    date: Optional[_dt.date] = None
    note: Optional[str] = None


class ReturnUpdate(BaseModel):
    item_name: Optional[str] = None
    reason: Optional[ReturnReason] = None
    selling_price: Optional[Decimal] = None
    refund_percent: Optional[int] = None
    date: Optional[_dt.date] = None
    note: Optional[str] = None


class ReturnResponse(DecimalModel):
    id: int
    quotation_id: int
    item_name: str
    reason: ReturnReason
    selling_price: Decimal
    refund_percent: int
    refund_amount: Decimal
    date: _dt.date
    note: Optional[str]
    transaction_id: Optional[int]
    created_by: int
    created_at: _dt.datetime
    updated_at: _dt.datetime


class QuotationListItem(DecimalModel):
    id: int
    customer_name: str
    customer_id: int
    status: QuotationStatus
    total_amount: Decimal
    total_paid: Decimal
    total_trade_in: Decimal
    remaining: Decimal
    warranty_active: int = 0
    warranty_total: int = 0
    created_at: _dt.datetime
    deletable: bool = True


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    limit: int
