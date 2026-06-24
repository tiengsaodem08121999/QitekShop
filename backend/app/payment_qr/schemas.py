from typing import Optional

from pydantic import BaseModel, Field


class PaymentQrCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    image: str = Field(min_length=1)
    note: Optional[str] = Field(default=None, max_length=200)


class PaymentQrUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    image: str = Field(min_length=1)
    note: Optional[str] = Field(default=None, max_length=200)


class PaymentQrResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    image: str
    note: Optional[str] = None
