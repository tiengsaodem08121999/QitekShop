# backend/app/finance/schemas.py
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.finance.models import TransactionType


class DecimalModel(BaseModel):
    model_config = {"from_attributes": True, "json_encoders": {Decimal: float}}


class TransactionCreate(BaseModel):
    date: date
    description: str
    type: TransactionType
    amount: Decimal
    notes: str | None = None


class TransactionUpdate(BaseModel):
    date: date | None = None
    description: str | None = None
    type: TransactionType | None = None
    amount: Decimal | None = None
    notes: str | None = None


class TransactionResponse(DecimalModel):
    id: int
    date: date
    description: str
    type: TransactionType
    amount: Decimal
    notes: str | None
    created_by: int
    created_at: datetime


class MonthlySummary(DecimalModel):
    year: int
    month: int
    opening_balance: Decimal
    total_income: Decimal
    total_expense: Decimal
    profit: Decimal
    closing_balance: Decimal
