from datetime import date as DateType
from typing import Optional

from sqlalchemy.orm import Session

from app.schedule.models import EventStatus, ScheduleEvent, ScheduleTag
from app.schedule.schemas import EventCreate, TagCreate, TagUpdate


# ---------- Tags ----------

def list_tags(db: Session) -> list[ScheduleTag]:
    return db.query(ScheduleTag).order_by(ScheduleTag.name).all()


def get_tag(db: Session, tag_id: int) -> Optional[ScheduleTag]:
    return db.query(ScheduleTag).filter(ScheduleTag.id == tag_id).first()


def create_tag(db: Session, data: TagCreate) -> ScheduleTag:
    tag = ScheduleTag(name=data.name, color=data.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def update_tag(db: Session, tag_id: int, data: TagUpdate) -> Optional[ScheduleTag]:
    tag = get_tag(db, tag_id)
    if not tag:
        return None
    tag.name = data.name
    tag.color = data.color
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, tag_id: int) -> bool:
    tag = get_tag(db, tag_id)
    if not tag:
        return False
    db.delete(tag)
    db.commit()
    return True


# ---------- Events ----------

def _resolve_tags(db: Session, tag_ids: list[int]) -> list[ScheduleTag]:
    if not tag_ids:
        return []
    tags = db.query(ScheduleTag).filter(ScheduleTag.id.in_(tag_ids)).all()
    if len(tags) != len(set(tag_ids)):
        raise ValueError("One or more tag_ids do not exist")
    return tags


def _check_overlap(db: Session, data: EventCreate, exclude_id: Optional[int] = None) -> None:
    """Reject if another non-deleted, non-cancelled event on the same date overlaps the given range."""
    query = db.query(ScheduleEvent).filter(
        ScheduleEvent.is_deleted == False,
        ScheduleEvent.status != EventStatus.cancelled,
        ScheduleEvent.date == data.date,
        ScheduleEvent.start_time < data.end_time,
        ScheduleEvent.end_time > data.start_time,
    )
    if exclude_id is not None:
        query = query.filter(ScheduleEvent.id != exclude_id)
    conflict = query.first()
    if conflict:
        raise ValueError(
            f"Time conflict with \"{conflict.title}\" "
            f"({conflict.start_time.strftime('%H:%M')}-{conflict.end_time.strftime('%H:%M')})"
        )


def get_event(db: Session, event_id: int) -> Optional[ScheduleEvent]:
    return (
        db.query(ScheduleEvent)
        .filter(ScheduleEvent.id == event_id, ScheduleEvent.is_deleted == False)
        .first()
    )


def list_events(
    db: Session,
    start_date: DateType,
    end_date: DateType,
    status: Optional[EventStatus] = None,
    tag_id: Optional[int] = None,
) -> list[ScheduleEvent]:
    query = (
        db.query(ScheduleEvent)
        .filter(
            ScheduleEvent.is_deleted == False,
            ScheduleEvent.date >= start_date,
            ScheduleEvent.date <= end_date,
        )
    )
    if status is not None:
        query = query.filter(ScheduleEvent.status == status)
    if tag_id is not None:
        query = query.filter(ScheduleEvent.tags.any(ScheduleTag.id == tag_id))
    return query.order_by(ScheduleEvent.date, ScheduleEvent.start_time, ScheduleEvent.id).all()


def create_event(db: Session, data: EventCreate, user_id: int) -> ScheduleEvent:
    _check_overlap(db, data)
    tags = _resolve_tags(db, data.tag_ids)
    event = ScheduleEvent(
        title=data.title,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        status=data.status,
        description=data.description,
        created_by=user_id,
        tags=tags,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def update_event(db: Session, event_id: int, data: EventCreate) -> Optional[ScheduleEvent]:
    event = get_event(db, event_id)
    if not event:
        return None
    _check_overlap(db, data, exclude_id=event_id)
    tags = _resolve_tags(db, data.tag_ids)
    event.title = data.title
    event.date = data.date
    event.start_time = data.start_time
    event.end_time = data.end_time
    event.status = data.status
    event.description = data.description
    event.tags = tags
    db.commit()
    db.refresh(event)
    return event


def update_event_status(db: Session, event_id: int, status: EventStatus) -> Optional[ScheduleEvent]:
    event = get_event(db, event_id)
    if not event:
        return None
    event.status = status
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event_id: int) -> bool:
    event = get_event(db, event_id)
    if not event:
        return False
    event.is_deleted = True
    db.commit()
    return True
