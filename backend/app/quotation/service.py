# backend/app/quotation/service.py
from datetime import date as date_type
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session, joinedload

from app.finance.models import Transaction, TransactionType
from app.quotation.models import Customer, Payment, PaymentMethod, PaymentType, Quotation, QuotationItem, QuotationStatus, Return, ReturnReason
from app.quotation.schemas import PaymentCreate, PaymentUpdate, ReturnCreate, ReturnUpdate, QuotationCreate, QuotationItemCreate, QuotationUpdate


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


def _recalc_total_paid(db: Session, quotation_id: int) -> None:
    """Recalculate and update the denormalized total_paid on the quotation.
    Only sums 'payment' type (gross amount customer paid in)."""
    total = (
        db.query(sa_func.coalesce(sa_func.sum(Payment.amount), 0))
        .filter(Payment.quotation_id == quotation_id, Payment.payment_type == PaymentType.payment)
        .scalar()
    )
    db.query(Quotation).filter(Quotation.id == quotation_id).update(
        {"total_paid": total}
    )


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
        .options(
            joinedload(Quotation.customer),
            joinedload(Quotation.items),
            joinedload(Quotation.payments),
            joinedload(Quotation.returns),
        )
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
    rows = (
        query.options(joinedload(Quotation.returns), joinedload(Quotation.payments))
        .order_by(Quotation.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    # Build list items with computed remaining
    items = []
    for q in rows:
        total_refund = sum(r.refund_amount for r in q.returns)
        total_refund_paid = sum(p.amount for p in q.payments if p.payment_type == PaymentType.refund)
        items.append({
            "id": q.id,
            "customer_name": q.customer.name,
            "customer_id": q.customer_id,
            "status": q.status,
            "total_amount": q.total_amount,
            "total_paid": q.total_paid,
            "total_trade_in": q.total_trade_in,
            "remaining": q.total_amount - q.total_trade_in - total_refund - (q.total_paid - total_refund_paid),
            "created_at": q.created_at,
        })
    return items, total


def update_quotation(db: Session, quotation_id: int, data: QuotationUpdate) -> Optional[Quotation]:
    quotation = get_quotation(db, quotation_id)
    if not quotation or quotation.status == QuotationStatus.confirmed:
        return None

    if data.customer_id is not None:
        quotation.customer_id = data.customer_id
    elif data.customer_name is not None:
        quotation.customer.name = data.customer_name

    if data.items is not None:
        # Check: items with returns cannot have their name changed
        returned_names = {r.item_name for r in quotation.returns}
        if returned_names:
            new_names = {item.name for item in data.items if not item.is_trade_in}
            missing = returned_names - new_names
            if missing:
                raise ValueError(f"Không thể đổi tên sản phẩm đã có trả hàng: {', '.join(missing)}")

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


def enrich_response(quotation: Quotation) -> dict:
    """Add computed fields: remaining, total_purchase, profit, payments, returns."""
    items = quotation.items
    total_purchase = sum(item.purchase_price for item in items if not item.is_trade_in)
    total_refund = sum(r.refund_amount for r in quotation.returns)
    total_refund_paid = sum(p.amount for p in quotation.payments if p.payment_type == PaymentType.refund)

    # remaining = (what customer owes) - (what customer paid net)
    # customer owes: total_amount - trade_in - refund
    # customer paid net: total_paid - refund_paid
    remaining = quotation.total_amount - quotation.total_trade_in - total_refund - (quotation.total_paid - total_refund_paid)

    # Profit: selling - purchase - trade_in - refund
    profit = quotation.total_amount - total_purchase - quotation.total_trade_in - total_refund

    return {
        **{c.key: getattr(quotation, c.key) for c in quotation.__table__.columns},
        "customer": quotation.customer,
        "items": quotation.items,
        "payments": quotation.payments,
        "returns": quotation.returns,
        "remaining": remaining,
        "total_refund": total_refund,
        "total_refund_paid": total_refund_paid,
        "total_purchase": total_purchase,
        "profit": profit,
    }


# --- Payments ---

def list_payments(db: Session, quotation_id: int) -> list[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.quotation_id == quotation_id)
        .order_by(Payment.date.desc(), Payment.id.desc())
        .all()
    )


def _txn_description(customer_name: str, quotation_id: int) -> str:
    return f"{customer_name} - Thanh toán báo giá #{quotation_id}"


def create_payment(db: Session, quotation_id: int, data: PaymentCreate, user_id: int, customer_name: str = "") -> Payment:
    payment = Payment(
        quotation_id=quotation_id,
        amount=data.amount,
        method=data.method,
        payment_type=data.payment_type,
        date=data.date or date_type.today(),
        note=data.note,
        created_by=user_id,
    )
    db.add(payment)

    # Always create transaction: payment → thu (income), refund → chi (expense)
    is_refund = data.payment_type == PaymentType.refund
    txn = Transaction(
        date=payment.date,
        description=_refund_txn_description(customer_name, quotation_id) if is_refund else _txn_description(customer_name, quotation_id),
        type=TransactionType.chi if is_refund else TransactionType.thu,
        amount=data.amount,
        notes=data.note,
        created_by=user_id,
    )
    db.add(txn)
    db.flush()
    payment.transaction_id = txn.id

    db.flush()
    _recalc_total_paid(db, quotation_id)
    db.commit()
    db.refresh(payment)
    return payment


def update_payment(db: Session, payment_id: int, quotation_id: int, data: PaymentUpdate, user_id: int, customer_name: str = "") -> Optional[Payment]:
    payment = (
        db.query(Payment)
        .filter(Payment.id == payment_id, Payment.quotation_id == quotation_id)
        .first()
    )
    if not payment:
        return None

    if data.amount is not None:
        payment.amount = data.amount
    if data.method is not None:
        payment.method = data.method
    if data.payment_type is not None:
        payment.payment_type = data.payment_type
    if data.date is not None:
        payment.date = data.date
    if data.note is not None:
        payment.note = data.note

    is_refund = payment.payment_type == PaymentType.refund
    txn_type = TransactionType.chi if is_refund else TransactionType.thu
    txn_desc = _refund_txn_description(customer_name, quotation_id) if is_refund else _txn_description(customer_name, quotation_id)

    # Sync finance transaction
    if payment.transaction_id:
        txn = db.query(Transaction).filter(Transaction.id == payment.transaction_id).first()
        if txn:
            txn.amount = payment.amount
            txn.date = payment.date
            txn.notes = payment.note
            txn.type = txn_type
            txn.description = txn_desc
    else:
        txn = Transaction(
            date=payment.date,
            description=txn_desc,
            type=txn_type,
            amount=payment.amount,
            notes=payment.note,
            created_by=user_id,
        )
        db.add(txn)
        db.flush()
        payment.transaction_id = txn.id

    db.flush()
    _recalc_total_paid(db, quotation_id)
    db.commit()
    db.refresh(payment)
    return payment


def _refund_txn_description(customer_name: str, quotation_id: int) -> str:
    return f"{customer_name} - Hoàn tiền báo giá #{quotation_id}"


def delete_payment(db: Session, payment_id: int, quotation_id: int) -> bool:
    payment = (
        db.query(Payment)
        .filter(Payment.id == payment_id, Payment.quotation_id == quotation_id)
        .first()
    )
    if not payment:
        return False

    if payment.transaction_id:
        txn = db.query(Transaction).filter(Transaction.id == payment.transaction_id).first()
        if txn:
            txn.is_deleted = True

    db.delete(payment)
    db.flush()
    _recalc_total_paid(db, quotation_id)
    db.commit()
    return True


# --- Returns ---

def _calc_refund_amount(selling_price: Decimal, refund_percent: int) -> Decimal:
    return Decimal(int(selling_price * refund_percent / 100))


def list_returns(db: Session, quotation_id: int) -> list[Return]:
    return (
        db.query(Return)
        .filter(Return.quotation_id == quotation_id)
        .order_by(Return.date.desc(), Return.id.desc())
        .all()
    )


def create_return(db: Session, quotation_id: int, data: ReturnCreate, user_id: int, customer_name: str = "") -> Return:
    refund_amount = _calc_refund_amount(data.selling_price, data.refund_percent)
    ret = Return(
        quotation_id=quotation_id,
        item_name=data.item_name,
        reason=data.reason,
        selling_price=data.selling_price,
        refund_percent=data.refund_percent,
        refund_amount=refund_amount,
        date=data.date or date_type.today(),
        note=data.note,
        created_by=user_id,
    )
    db.add(ret)
    db.flush()
    db.commit()
    db.refresh(ret)
    return ret


def update_return(db: Session, return_id: int, quotation_id: int, data: ReturnUpdate, user_id: int, customer_name: str = "") -> Optional[Return]:
    ret = (
        db.query(Return)
        .filter(Return.id == return_id, Return.quotation_id == quotation_id)
        .first()
    )
    if not ret:
        return None

    if data.item_name is not None:
        ret.item_name = data.item_name
    if data.reason is not None:
        ret.reason = data.reason
    if data.selling_price is not None:
        ret.selling_price = data.selling_price
    if data.refund_percent is not None:
        ret.refund_percent = data.refund_percent
    if data.date is not None:
        ret.date = data.date
    if data.note is not None:
        ret.note = data.note

    ret.refund_amount = _calc_refund_amount(ret.selling_price, ret.refund_percent)

    db.flush()
    db.commit()
    db.refresh(ret)
    return ret


def delete_return(db: Session, return_id: int, quotation_id: int) -> bool:
    ret = (
        db.query(Return)
        .filter(Return.id == return_id, Return.quotation_id == quotation_id)
        .first()
    )
    if not ret:
        return False

    db.delete(ret)
    db.commit()
    return True
