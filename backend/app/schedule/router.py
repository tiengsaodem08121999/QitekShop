from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.schedule.schemas import (
    TagCreate, TagResponse, TagUpdate,
)
from app.schedule.service import (
    create_tag, delete_tag, list_tags, update_tag,
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
