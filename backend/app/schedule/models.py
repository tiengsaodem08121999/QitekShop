import enum
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Enum, ForeignKey, Index, String, Table,
    Text, Time, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"
    cancelled = "cancelled"


schedule_event_tags = Table(
    "schedule_event_tags",
    Base.metadata,
    Column("event_id", ForeignKey("schedule_events.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("schedule_tags.id", ondelete="CASCADE"), primary_key=True),
)


class ScheduleTag(Base):
    __tablename__ = "schedule_tags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    color: Mapped[str] = mapped_column(String(7))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )


class ScheduleEvent(Base):
    __tablename__ = "schedule_events"
    __table_args__ = (Index("ix_schedule_events_date_active", "date", "is_deleted"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200))
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus), default=EventStatus.pending, server_default="pending"
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    tags: Mapped[list[ScheduleTag]] = relationship(
        "ScheduleTag", secondary=schedule_event_tags, lazy="selectin"
    )
