# backend/app/settings_router.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.models import Setting

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
def get_settings(
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    settings = db.query(Setting).all()
    return {s.key: s.value for s in settings}


@router.put("")
def update_settings(
    data: dict[str, str],
    _user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    for key, value in data.items():
        setting = db.query(Setting).filter_by(key=key).first()
        if setting:
            setting.value = value
        else:
            db.add(Setting(key=key, value=value))
    db.commit()
    return {"status": "ok"}
