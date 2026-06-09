from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.note.schemas import NoteResponse, NoteUpdate
from app.note.service import get_note, update_note

router = APIRouter(prefix="/api/note", tags=["note"])


@router.get("", response_model=NoteResponse)
def read_note(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_note(db)


@router.put("", response_model=NoteResponse)
def write_note(
    data: NoteUpdate,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_note(db, data.content)
