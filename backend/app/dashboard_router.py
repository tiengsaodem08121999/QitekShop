# backend/app/dashboard_router.py
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.database import get_db
from app.finance.service import get_yearly_revenue_profit

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(
    year: Optional[int] = Query(None),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if year is None:
        year = datetime.now(timezone.utc).year
    return {"year": year, "months": get_yearly_revenue_profit(db, year)}
