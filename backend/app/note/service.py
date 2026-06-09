from typing import Optional

from sqlalchemy.orm import Session

from app.note.models import Note


def get_note(db: Session) -> Note:
    """Return the single shared note row, creating an empty one on first access."""
    note = db.query(Note).order_by(Note.id).first()
    if note is None:
        note = Note(content=None)
        db.add(note)
        db.commit()
        db.refresh(note)
    return note


def update_note(db: Session, content: Optional[str]) -> Note:
    note = get_note(db)
    note.content = content
    db.commit()
    db.refresh(note)
    return note
