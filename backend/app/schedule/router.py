from datetime import date as DateType

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.schedule.models import EventStatus
from app.schedule.schemas import (
    EventCreate, EventResponse, EventStatusUpdate,
    TagCreate, TagResponse, TagUpdate,
)
from app.schedule.service import (
    create_event, create_tag, delete_event, delete_tag,
    list_events, list_tags, update_event, update_event_status, update_tag,
)

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


# ---------- Tags ----------

@router.get("/tags", response_model=list[TagResponse])
def list_tags_endpoint(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_tags(db)


@router.post("/tags", response_model=TagResponse, status_code=201)
def create_tag_endpoint(
    data: TagCreate,
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return create_tag(db, data)


@router.put("/tags/{tag_id}", response_model=TagResponse)
def update_tag_endpoint(
    tag_id: int,
    data: TagUpdate,
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    tag = update_tag(db, tag_id, data)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.delete("/tags/{tag_id}", status_code=204)
def delete_tag_endpoint(
    tag_id: int,
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    if not delete_tag(db, tag_id):
        raise HTTPException(status_code=404, detail="Tag not found")


# ---------- Events ----------

def _to_response(event, db: Session) -> EventResponse:
    creator = db.query(User).filter(User.id == event.created_by).first()
    return EventResponse(
        id=event.id,
        title=event.title,
        date=event.date,
        start_time=event.start_time,
        end_time=event.end_time,
        status=event.status,
        description=event.description,
        tags=[TagResponse.model_validate(t) for t in event.tags],
        created_by=event.created_by,
        created_by_name=creator.full_name if creator else "",
        created_at=event.created_at,
    )


@router.get("/events", response_model=list[EventResponse])
def list_events_endpoint(
    start_date: DateType = Query(...),
    end_date: DateType = Query(...),
    status_filter: EventStatus | None = Query(None, alias="status"),
    tag_id: int | None = Query(None),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = list_events(db, start_date, end_date, status=status_filter, tag_id=tag_id)
    return [_to_response(i, db) for i in items]


@router.post("/events", response_model=EventResponse, status_code=201)
def create_event_endpoint(
    data: EventCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        event = create_event(db, data, user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_response(event, db)


@router.put("/events/{event_id}", response_model=EventResponse)
def update_event_endpoint(
    event_id: int,
    data: EventCreate,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        event = update_event(db, event_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_response(event, db)


@router.patch("/events/{event_id}/status", response_model=EventResponse)
def update_event_status_endpoint(
    event_id: int,
    data: EventStatusUpdate,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = update_event_status(db, event_id, data.status)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _to_response(event, db)


@router.delete("/events/{event_id}", status_code=204)
def delete_event_endpoint(
    event_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not delete_event(db, event_id):
        raise HTTPException(status_code=404, detail="Event not found")
