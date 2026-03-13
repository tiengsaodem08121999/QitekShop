# backend/app/quotation/service.py
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.quotation.models import Customer, Quotation, QuotationItem, QuotationStatus
from app.quotation.schemas import QuotationCreate, QuotationItemCreate, QuotationUpdate


def get_customers(db: Session, search: Optional[str] = None, page: int = 1, limit: int = 20):
    query = db.query(Customer)
    if search:
        query = query.filter(Customer.name.ilike(f"%{search}%"))
    total = query.count()
    items = query.order_by(Customer.name).offset((page - 1) * limit).limit(limit).all()
    return items, total


def create_customer(db: Session, name: str, phone: Optional[str] = None, email: Optional[str] = None, address: Optional[str] = None, notes: Optional[str] = None) -> Customer:
    customer = Customer(name=name, phone=phone, email=email, address=address, notes=notes)
    db.add(customer)
    db.flush()
    return customer


def update_customer(db: Session, customer_id: int, **kwargs) -> Optional[Customer]:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None
    for key, value in kwargs.items():
        if value is not None:
            setattr(customer, key, value)
    db.flush()
    return customer


def _compute_totals(items: List[QuotationItem]) -> Tuple[Decimal, Decimal]:
    """Returns (total_amount, total_trade_in)"""
    total_amount = sum(item.selling_price for item in items if not item.is_trade_in)
    total_trade_in = sum(item.purchase_price for item in items if item.is_trade_in)
    return Decimal(total_amount), Decimal(total_trade_in)


def create_quotation(db: Session, data: QuotationCreate, user_id: int) -> Quotation:
    if data.new_customer:
        customer = create_customer(db, **data.new_customer.model_dump())
        customer_id = customer.id
    else:
        customer_id = data.customer_id

    quotation = Quotation(customer_id=customer_id, created_by=user_id)
    db.add(quotation)
    db.flush()

    for item_data in data.items:
        item = QuotationItem(quotation_id=quotation.id, **item_data.model_dump())
        db.add(item)

    db.flush()

    # Recalculate totals
    total_amount, total_trade_in = _compute_totals(quotation.items)
    quotation.total_amount = total_amount
    quotation.total_trade_in = total_trade_in

    db.commit()
    db.refresh(quotation)
    return quotation


def get_quotation(db: Session, quotation_id: int) -> Optional[Quotation]:
    return (
        db.query(Quotation)
        .options(joinedload(Quotation.customer), joinedload(Quotation.items))
        .filter(Quotation.id == quotation_id)
        .first()
    )


def list_quotations(
    db: Session,
    status: Optional[QuotationStatus] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
):
    query = db.query(Quotation).join(Customer)
    if status:
        query = query.filter(Quotation.status == status)
    if search:
        query = query.filter(Customer.name.ilike(f"%{search}%"))
    total = query.count()
    rows = query.order_by(Quotation.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    # Build list items with computed remaining
    items = []
    for q in rows:
        items.append({
            "id": q.id,
            "customer_name": q.customer.name,
            "customer_id": q.customer_id,
            "status": q.status,
            "total_amount": q.total_amount,
            "total_paid": q.total_paid,
            "total_trade_in": q.total_trade_in,
            "remaining": q.total_amount - q.total_paid - q.total_trade_in,
            "created_at": q.created_at,
        })
    return items, total


def update_quotation(db: Session, quotation_id: int, data: QuotationUpdate) -> Optional[Quotation]:
    quotation = get_quotation(db, quotation_id)
    if not quotation or quotation.status == QuotationStatus.confirmed:
        return None

    if data.total_paid is not None:
        quotation.total_paid = data.total_paid

    if data.items is not None:
        # Replace all items
        db.query(QuotationItem).filter(QuotationItem.quotation_id == quotation_id).delete()
        for item_data in data.items:
            item = QuotationItem(quotation_id=quotation_id, **item_data.model_dump())
            db.add(item)
        db.flush()
        db.refresh(quotation)
        total_amount, total_trade_in = _compute_totals(quotation.items)
        quotation.total_amount = total_amount
        quotation.total_trade_in = total_trade_in

    db.commit()
    db.refresh(quotation)
    return quotation


def confirm_quotation(db: Session, quotation_id: int) -> Optional[Quotation]:
    quotation = get_quotation(db, quotation_id)
    if not quotation or quotation.status != QuotationStatus.draft:
        return None
    quotation.status = QuotationStatus.confirmed
    db.commit()
    db.refresh(quotation)
    return quotation


def delete_quotation(db: Session, quotation_id: int) -> bool:
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation or quotation.status != QuotationStatus.draft:
        return False
    db.query(QuotationItem).filter(QuotationItem.quotation_id == quotation_id).delete()
    db.delete(quotation)
    db.commit()
    return True


def enrich_response(quotation: Quotation) -> dict:
    """Add computed fields: remaining, total_purchase, profit."""
    items = quotation.items
    total_purchase = sum(item.purchase_price for item in items if not item.is_trade_in)
    remaining = quotation.total_amount - quotation.total_paid - quotation.total_trade_in
    profit = quotation.total_amount - total_purchase
    return {
        **{c.key: getattr(quotation, c.key) for c in quotation.__table__.columns},
        "customer": quotation.customer,
        "items": quotation.items,
        "remaining": remaining,
        "total_purchase": total_purchase,
        "profit": profit,
    }
