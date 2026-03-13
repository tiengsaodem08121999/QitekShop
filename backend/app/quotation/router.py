# backend/app/quotation/router.py
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_role
from app.auth.models import User, UserRole
from app.database import get_db
from app.quotation.models import QuotationStatus
from app.quotation.schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    PaymentCreate,
    PaymentResponse,
    PaymentUpdate,
    QuotationCreate,
    QuotationListItem,
    QuotationResponse,
    QuotationUpdate,
    ReturnCreate,
    ReturnResponse,
    ReturnUpdate,
)
from app.quotation.service import (
    confirm_quotation,
    create_customer,
    create_payment,
    create_quotation,
    create_return,
    delete_payment,
    delete_return,
    enrich_response,
    get_customers,
    get_quotation,
    list_payments,
    list_quotations,
    list_returns,
    update_customer,
    update_payment,
    update_quotation,
    update_return,
)

router = APIRouter(prefix="/api", tags=["quotation"])


# --- Customers ---

@router.get("/customers")
def list_customers_endpoint(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = get_customers(db, search=search, page=page, limit=limit)
    return {"items": [CustomerResponse.model_validate(c) for c in items], "total": total, "page": page, "limit": limit}


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
    status: Optional[QuotationStatus] = None,
    search: Optional[str] = None,
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


@router.get("/quotations/{quotation_id}/pdf")
def export_pdf_endpoint(
    quotation_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models import Setting
    from app.quotation.pdf import generate_quotation_pdf

    quotation = get_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")

    settings_rows = db.query(Setting).all()
    settings_dict = {s.key: s.value for s in settings_rows}

    pdf_bytes = generate_quotation_pdf(quotation, settings_dict)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=bao-gia-{quotation_id}.pdf"},
    )


# --- Payments ---

@router.get("/quotations/{quotation_id}/payments", response_model=list[PaymentResponse])
def list_payments_endpoint(
    quotation_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_payments(db, quotation_id)


@router.post("/quotations/{quotation_id}/payments", response_model=PaymentResponse, status_code=201)
def create_payment_endpoint(
    quotation_id: int,
    data: PaymentCreate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return create_payment(db, quotation_id, data, user.id, customer_name=quotation.customer.name)


@router.put("/quotations/{quotation_id}/payments/{payment_id}", response_model=PaymentResponse)
def update_payment_endpoint(
    quotation_id: int,
    payment_id: int,
    data: PaymentUpdate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    payment = update_payment(db, payment_id, quotation_id, data, user.id, customer_name=quotation.customer.name)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.delete("/quotations/{quotation_id}/payments/{payment_id}", status_code=204)
def delete_payment_endpoint(
    quotation_id: int,
    payment_id: int,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    if not delete_payment(db, payment_id, quotation_id):
        raise HTTPException(status_code=404, detail="Payment not found")


# --- Returns ---

@router.get("/quotations/{quotation_id}/returns", response_model=list[ReturnResponse])
def list_returns_endpoint(
    quotation_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_returns(db, quotation_id)


@router.post("/quotations/{quotation_id}/returns", response_model=ReturnResponse, status_code=201)
def create_return_endpoint(
    quotation_id: int,
    data: ReturnCreate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return create_return(db, quotation_id, data, user.id, customer_name=quotation.customer.name)


@router.put("/quotations/{quotation_id}/returns/{return_id}", response_model=ReturnResponse)
def update_return_endpoint(
    quotation_id: int,
    return_id: int,
    data: ReturnUpdate,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    ret = update_return(db, return_id, quotation_id, data, user.id, customer_name=quotation.customer.name)
    if not ret:
        raise HTTPException(status_code=404, detail="Return not found")
    return ret


@router.delete("/quotations/{quotation_id}/returns/{return_id}", status_code=204)
def delete_return_endpoint(
    quotation_id: int,
    return_id: int,
    user: User = Depends(require_role(UserRole.admin, UserRole.sales)),
    db: Session = Depends(get_db),
):
    if not delete_return(db, return_id, quotation_id):
        raise HTTPException(status_code=404, detail="Return not found")
