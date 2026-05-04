from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.schedule.models import EventStatus


HEX_COLOR = r"^#[0-9A-Fa-f]{6}$"


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(pattern=HEX_COLOR)


class TagUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(pattern=HEX_COLOR)


class TagResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    color: str


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: date
    start_time: time
    end_time: time
    status: EventStatus = EventStatus.pending
    description: Optional[str] = None
    tag_ids: list[int] = Field(default_factory=list)

    @model_validator(mode="after")
    def _end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class EventStatusUpdate(BaseModel):
    status: EventStatus


class EventResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    date: date
    start_time: time
    end_time: time
    status: EventStatus
    description: Optional[str]
    tags: list[TagResponse]
    created_by: int
    created_by_name: str
    created_at: datetime
