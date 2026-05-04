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
