# backend/app/quotation/schemas.py
import datetime as _dt
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, model_validator

from app.quotation.models import PaymentMethod, PaymentType, QuotationStatus, ReturnReason


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
    warranty: Optional[str] = None
    warranty_start: Optional[_dt.date] = None
    delivery_date: Optional[_dt.date] = None
    notes: Optional[str] = None

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
    condition: Optional[str]
    purchase_price: Decimal
    selling_price: Decimal
    warranty: Optional[str]
    warranty_start: Optional[_dt.date]
    delivery_date: Optional[_dt.date]
    notes: Optional[str]

    model_config = {"from_attributes": True}


# --- Quotation ---

class QuotationCreate(BaseModel):
    customer_id: Optional[int] = None
    new_customer: Optional[CustomerCreate] = None
    items: List[QuotationItemCreate] = []

    @model_validator(mode="after")
    def require_customer(self):
        if not self.customer_id and not self.new_customer:
            raise ValueError("Either customer_id or new_customer is required")
        return self


class QuotationUpdate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    items: Optional[List[QuotationItemCreate]] = None


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
    created_at: _dt.datetime


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    limit: int
