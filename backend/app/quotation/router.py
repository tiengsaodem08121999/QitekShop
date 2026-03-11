# backend/app/quotation/router.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.quotation.models import QuotationStatus
from app.quotation.schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    QuotationCreate,
    QuotationListItem,
    QuotationResponse,
    QuotationUpdate,
)
from app.quotation.service import (
    confirm_quotation,
    create_customer,
    create_quotation,
    delete_quotation,
    enrich_response,
    get_customers,
    get_quotation,
    list_quotations,
    update_customer,
    update_quotation,
)

router = APIRouter(prefix="/api", tags=["quotation"])


# --- Customers ---

@router.get("/customers", response_model=list[CustomerResponse])
def list_customers_endpoint(
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, _total = get_customers(db, search=search, page=page, limit=limit)
    return items


@router.post("/customers", response_model=CustomerResponse, status_code=201)
def create_customer_endpoint(
    data: CustomerCreate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    customer = create_customer(db, **data.model_dump())
    db.commit()
    return customer


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer_endpoint(
    customer_id: int,
    data: CustomerUpdate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    customer = update_customer(db, customer_id, **data.model_dump(exclude_unset=True))
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.commit()
    return customer


# --- Quotations ---

@router.get("/quotations")
def list_quotations_endpoint(
    status: QuotationStatus | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = list_quotations(db, status=status, search=search, page=page, limit=limit)
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.post("/quotations", response_model=QuotationResponse, status_code=201)
def create_quotation_endpoint(
    data: QuotationCreate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    quotation = create_quotation(db, data, user.id)
    return enrich_response(quotation)


@router.get("/quotations/{quotation_id}", response_model=QuotationResponse)
def get_quotation_endpoint(
    quotation_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return enrich_response(quotation)


@router.put("/quotations/{quotation_id}", response_model=QuotationResponse)
def update_quotation_endpoint(
    quotation_id: int,
    data: QuotationUpdate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    quotation = update_quotation(db, quotation_id, data)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found or already confirmed")
    return enrich_response(quotation)


@router.patch("/quotations/{quotation_id}/confirm", response_model=QuotationResponse)
def confirm_quotation_endpoint(
    quotation_id: int,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    quotation = confirm_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=400, detail="Cannot confirm quotation")
    return enrich_response(quotation)


@router.delete("/quotations/{quotation_id}", status_code=204)
def delete_quotation_endpoint(
    quotation_id: int,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    if not delete_quotation(db, quotation_id):
        raise HTTPException(status_code=400, detail="Cannot delete (not found or already confirmed)")
