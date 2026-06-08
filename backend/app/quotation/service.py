# backend/app/quotation/service.py
from datetime import date as date_type
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session, joinedload

from app.finance.models import Transaction, TransactionType
from app.quotation.models import Customer, Payment, PaymentMethod, PaymentType, Quotation, QuotationItem, QuotationStatus, Return, ReturnReason
from app.quotation.schemas import PaymentCreate, PaymentUpdate, ReturnCreate, ReturnUpdate, QuotationCreate, QuotationItemCreate, QuotationUpdate
from app.quotation.warranty_status import count_warranty_status


def get_customers(db: Session, search: Optional[str] = None, page: int = 1, limit: int = 20, sort: Optional[str] = None):
    query = db.query(Customer)
    if search:
        query = query.filter(Customer.name.ilike(f"%{search}%"))
    total = query.count()
    order = Customer.created_at.desc() if sort == "created_desc" else Customer.name
    items = query.order_by(order).offset((page - 1) * limit).limit(limit).all()
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


def get_claimed_inventory_ids(db: Session, exclude_quotation_id: Optional[int] = None) -> set:
    """Stock item ids claimed by a confirmed/delivered quotation."""
    q = (
        db.query(QuotationItem.inventory_item_id)
        .join(Quotation, Quotation.id == QuotationItem.quotation_id)
        .filter(
            Quotation.status.in_([QuotationStatus.confirmed, QuotationStatus.delivered]),
            QuotationItem.is_trade_in == False,  # noqa: E712
            QuotationItem.inventory_item_id.isnot(None),
        )
    )
    if exclude_quotation_id is not None:
        q = q.filter(QuotationItem.quotation_id != exclude_quotation_id)
    claimed = {row[0] for row in q.all()}
    # A quotation return sends the item back to stock -> no longer claimed.
    returned = {
        row[0]
        for row in db.query(Return.inventory_item_id).filter(Return.inventory_item_id.isnot(None)).all()
    }
    return claimed - returned


def get_referenced_inventory_ids(db: Session) -> set:
    """Stock item ids referenced by ANY quotation line (sale or trade-in, any status).
    Used to warn before deleting a stock item still attached to a quotation."""
    return {
        row[0]
        for row in db.query(QuotationItem.inventory_item_id).filter(QuotationItem.inventory_item_id.isnot(None)).all()
    }


def _check_duplicate_inventory_links(items) -> None:
    ids = [it.inventory_item_id for it in items if not it.is_trade_in and it.inventory_item_id is not None]
    if len(ids) != len(set(ids)):
        raise ValueError("err_inventory_duplicate_link")


def annotate_inventory_conflicts(db: Session, quotation) -> None:
    """Set transient `inventory_conflict` per sale item: true when its linked stock
    item is claimed by another confirmed/delivered quotation."""
    claimed = get_claimed_inventory_ids(db, exclude_quotation_id=quotation.id)
    for item in quotation.items:
        item.inventory_conflict = (
            not item.is_trade_in
            and item.inventory_item_id is not None
            and item.inventory_item_id in claimed
        )


def _writeback_sale_to_stock(db: Session, quotation) -> None:
    """Sale lines linked to stock push their selling price AND serial number
    back to the stock item. Runs only when the quotation is committed
    (confirmed/delivered), not on draft. The S/N is mirrored exactly, so a
    blank line S/N clears the stock item's S/N."""
    from app.inventory.models import InventoryItem
    for item in quotation.items:
        if not item.is_trade_in and item.inventory_item_id is not None:
            inv = db.query(InventoryItem).filter(InventoryItem.id == item.inventory_item_id).first()
            if inv:
                inv.selling_price = item.selling_price
                inv.serial_number = item.serial_number


def _import_trade_in_stock(db: Session, quotation, old_trade_in_links: set) -> None:
    """Reconcile trade-in lines into stock. Runs ONLY on the explicit "Nhập kho"
    action: create stock for new trade-ins, update linked ones, delete dropped ones
    (unless sold/claimed)."""
    from app.inventory.models import InventoryItem, InventoryStatus

    for item in quotation.items:
        if not item.is_trade_in:
            continue
        inv = (
            db.query(InventoryItem).filter(InventoryItem.id == item.inventory_item_id).first()
            if item.inventory_item_id is not None else None
        )
        if inv is None:
            inv = InventoryItem(status=InventoryStatus.in_stock)
            db.add(inv)
        inv.name = item.name
        inv.serial_number = item.serial_number
        inv.purchase_price = item.purchase_price
        inv.selling_price = item.resale_price
        db.flush()
        item.inventory_item_id = inv.id

    claimed = get_claimed_inventory_ids(db, exclude_quotation_id=quotation.id)
    current = {i.inventory_item_id for i in quotation.items if i.is_trade_in and i.inventory_item_id is not None}
    for removed_id in old_trade_in_links - current:
        inv = db.query(InventoryItem).filter(InventoryItem.id == removed_id).first()
        if inv and inv.status != InventoryStatus.sold and removed_id not in claimed:
            db.delete(inv)


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
    quotation.note = data.note
    db.add(quotation)
    db.flush()

    _check_duplicate_inventory_links(data.items)
    for item_data in data.items:
        payload = item_data.model_dump()
        if payload.get("is_trade_in"):
            payload["inventory_item_id"] = None
        db.add(QuotationItem(quotation_id=quotation.id, **payload))

    db.flush()

    # Recalculate totals
    total_amount, total_trade_in = _compute_totals(quotation.items)
    quotation.total_amount = total_amount
    quotation.total_trade_in = total_trade_in

    # Writeback only once the quotation is committed (confirmed/delivered), not draft.
    if quotation.status in (QuotationStatus.confirmed, QuotationStatus.delivered):
        _writeback_sale_to_stock(db, quotation)
    if data.import_trade_ins:
        _import_trade_in_stock(db, quotation, set())

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
    query = query.options(
        joinedload(Quotation.returns),
        joinedload(Quotation.payments),
        joinedload(Quotation.items),
    ).order_by(Quotation.created_at.desc())
    # limit=0 is the "load all" sentinel: skip pagination entirely.
    if limit:
        query = query.offset((page - 1) * limit).limit(limit)
    rows = query.all()
    today = date_type.today()
    # Build list items with computed remaining
    items = []
    for q in rows:
        total_paid = sum(p.amount for p in q.payments if p.payment_type == PaymentType.payment)
        total_refund = sum(r.refund_amount for r in q.returns)
        total_refund_paid = sum(p.amount for p in q.payments if p.payment_type == PaymentType.refund)
        warranty_active, warranty_total = count_warranty_status(
            (i for i in q.items if not i.is_trade_in), today
        )
        items.append({
            "id": q.id,
            "customer_name": q.customer.name,
            "customer_id": q.customer_id,
            "status": q.status,
            "total_amount": q.total_amount,
            "total_paid": total_paid,
            "total_trade_in": q.total_trade_in,
            "remaining": q.total_amount - q.total_trade_in - total_refund - (total_paid - total_refund_paid),
            "warranty_active": warranty_active,
            "warranty_total": warranty_total,
            "created_at": q.created_at,
            "deletable": len(q.payments) == 0 and len(q.returns) == 0,
        })
    return items, total


def update_quotation(db: Session, quotation_id: int, data: QuotationUpdate) -> Optional[Quotation]:
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        return None

    if data.customer_id is not None:
        quotation.customer_id = data.customer_id
    elif data.customer_name is not None:
        quotation.customer.name = data.customer_name

    quotation.note = data.note

    if data.items is not None:
        # Check: items with returns cannot have their name changed
        returned_names = {r.item_name for r in quotation.returns}
        if returned_names:
            new_names = {item.name for item in data.items if not item.is_trade_in}
            missing = returned_names - new_names
            if missing:
                raise ValueError("err_rename_returned_item")

        old_trade_in_links = {
            i.inventory_item_id for i in quotation.items
            if i.is_trade_in and i.inventory_item_id is not None
        }
        _check_duplicate_inventory_links(data.items)

        # Replace all items, keeping payload links (sale + existing trade-in) so
        # _import_trade_in_stock can update them in place.
        db.query(QuotationItem).filter(QuotationItem.quotation_id == quotation_id).delete()
        for item_data in data.items:
            db.add(QuotationItem(quotation_id=quotation_id, **item_data.model_dump()))
        db.flush()
        db.refresh(quotation)
        total_amount, total_trade_in = _compute_totals(quotation.items)
        quotation.total_amount = total_amount
        quotation.total_trade_in = total_trade_in

        if quotation.status in (QuotationStatus.confirmed, QuotationStatus.delivered):
            # A committed quotation must not grab a stock item already held elsewhere.
            claimed = get_claimed_inventory_ids(db, exclude_quotation_id=quotation_id)
            if any(i.inventory_item_id in claimed for i in quotation.items
                   if not i.is_trade_in and i.inventory_item_id is not None):
                raise ValueError("err_item_conflict")
            _writeback_sale_to_stock(db, quotation)
        if data.import_trade_ins:
            _import_trade_in_stock(db, quotation, old_trade_in_links)

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


def deliver_quotation(db: Session, quotation_id: int) -> Optional[Quotation]:
    """Mark a confirmed inventory-enabled quotation as delivered; its linked sale
    items become `sold` in stock. One-way (no undo)."""
    from app.inventory.models import InventoryItem, InventoryStatus
    quotation = get_quotation(db, quotation_id)
    if not quotation or quotation.status != QuotationStatus.confirmed:
        return None
    # All sale lines must be linked to stock (enough goods imported) before delivery.
    if any(i.inventory_item_id is None for i in quotation.items if not i.is_trade_in):
        raise ValueError("err_deliver_requires_linked")
    for item in quotation.items:
        if not item.is_trade_in and item.inventory_item_id is not None:
            inv = db.query(InventoryItem).filter(InventoryItem.id == item.inventory_item_id).first()
            if inv:
                inv.status = InventoryStatus.sold
    quotation.status = QuotationStatus.delivered
    db.commit()
    db.refresh(quotation)
    return quotation


def import_trade_ins(db: Session, quotation_id: int) -> Optional[Quotation]:
    """Sync this quotation's saved trade-in lines into stock (detail-page "Nhập kho")."""
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        return None
    old_links = {i.inventory_item_id for i in quotation.items if i.is_trade_in and i.inventory_item_id is not None}
    _import_trade_in_stock(db, quotation, old_links)
    db.commit()
    db.refresh(quotation)
    return quotation


def delete_quotation(db: Session, quotation_id: int) -> Optional[bool]:
    """Hard-delete a quotation and its items.

    Blocked if the quotation has any payments or returns: those carry real
    Finance transactions, so deleting would orphan recorded money. The caller
    must remove all payments/returns first. Trade-in `resale_price` is just a
    field on an item (no transaction) and does not block deletion.

    Returns True on success, None if the quotation does not exist. Raises
    ValueError (with a user-facing message) when blocked.
    """
    quotation = get_quotation(db, quotation_id)
    if not quotation:
        return None
    if quotation.payments or quotation.returns:
        raise ValueError("err_quotation_has_transactions")
    from app.inventory.models import InventoryItem, InventoryStatus
    claimed_elsewhere = get_claimed_inventory_ids(db, exclude_quotation_id=quotation_id)
    for item in quotation.items:
        if item.inventory_item_id is None:
            continue
        inv = db.query(InventoryItem).filter(InventoryItem.id == item.inventory_item_id).first()
        if not inv:
            continue
        if item.is_trade_in:
            # Reclaim trade-in stock created from this quotation (unless sold elsewhere).
            if inv.status != InventoryStatus.sold and inv.id not in claimed_elsewhere:
                db.delete(inv)
        else:
            # Release a sold sale-line item back to stock.
            if inv.status == InventoryStatus.sold:
                inv.status = InventoryStatus.in_stock
    db.delete(quotation)
    db.commit()
    return True


def update_item_resale(
    db: Session,
    quotation_id: int,
    item_id: int,
    resale_price: Decimal,
) -> Optional[Quotation]:
    """Set `resale_price` on a single trade-in item.

    Allowed regardless of quotation status (draft or confirmed). This is a
    deliberate narrow exception to the "confirmed quotations are immutable"
    rule, because resale of a trade-in happens after the original quotation
    closes. Only the `resale_price` field can be changed; nothing else.

    Returns the updated quotation (with relationships loaded), or None if the
    item is not on the quotation. Raises ValueError if the item is not a
    trade-in.
    """
    item = (
        db.query(QuotationItem)
        .filter(QuotationItem.id == item_id, QuotationItem.quotation_id == quotation_id)
        .first()
    )
    if not item:
        return None
    if not item.is_trade_in:
        raise ValueError("resale_price can only be set on trade-in items")

    item.resale_price = resale_price
    db.flush()
    db.commit()
    return get_quotation(db, quotation_id)


def enrich_response(quotation: Quotation) -> dict:
    """Add computed fields: remaining, total_purchase, total_trade_in_resale, profit, payments, returns."""
    items = quotation.items
    total_purchase = sum(item.purchase_price for item in items if not item.is_trade_in)
    total_trade_in_resale = sum(item.resale_price for item in items if item.is_trade_in)
    total_refund = sum(r.refund_amount for r in quotation.returns)
    # total_paid is derived from payments (no denormalized column) — single source of truth
    # avoids race conditions on concurrent payment writes.
    total_paid = sum(p.amount for p in quotation.payments if p.payment_type == PaymentType.payment)
    total_refund_paid = sum(p.amount for p in quotation.payments if p.payment_type == PaymentType.refund)

    # remaining = (what customer owes) - (what customer paid net)
    # customer owes: total_amount - trade_in - refund
    # customer paid net: total_paid - refund_paid
    # Note: resale_price does NOT reduce what the customer owes — it represents
    # a separate downstream sale of the trade-in inventory.
    remaining = quotation.total_amount - quotation.total_trade_in - total_refund - (total_paid - total_refund_paid)

    # Profit: simple product margin (selling - purchase). Trade-in and resale
    # are tracked separately in cashflow rather than folded in.
    profit = quotation.total_amount - total_purchase

    # Cashflow: cash NET đã thực chảy ra/vào từ đơn này tính đến hiện tại.
    # = (khách trả − shop hoàn) + bán lại trade-in − mua hàng đầu vào.
    # Không gồm các khoản còn nợ qua lại; số đó nằm ở `remaining`.
    cashflow = (total_paid - total_refund_paid) + total_trade_in_resale - total_purchase

    return {
        **{c.key: getattr(quotation, c.key) for c in quotation.__table__.columns},
        "customer": quotation.customer,
        "items": quotation.items,
        "payments": quotation.payments,
        "returns": quotation.returns,
        "total_paid": total_paid,
        "remaining": remaining,
        "total_refund": total_refund,
        "total_refund_paid": total_refund_paid,
        "total_purchase": total_purchase,
        "total_trade_in_resale": total_trade_in_resale,
        "profit": profit,
        "cashflow": cashflow,
        "deletable": len(quotation.payments) == 0 and len(quotation.returns) == 0,
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
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if quotation and data.payment_type != PaymentType.refund:
        sale_lines = [i for i in quotation.items if not i.is_trade_in]
        claimed = get_claimed_inventory_ids(db, exclude_quotation_id=quotation_id)
        conflict_lines = [i for i in sale_lines if i.inventory_item_id is not None and i.inventory_item_id in claimed]
        if conflict_lines:
            if not data.unlink_conflicts:
                raise ValueError("err_payment_conflict")
            # Confirmed by the user: drop the stock link, keep the line as a virtual
            # (not-in-stock) item. It must be re-linked before delivery. The S/N
            # came from the now-detached stock item, so clear it too.
            for i in conflict_lines:
                i.inventory_item_id = None
                i.serial_number = None
        # A transaction confirms the quotation (linking can still be completed up to delivery).
        if quotation.status == QuotationStatus.draft:
            quotation.status = QuotationStatus.confirmed
        # Now committed -> push sale-line prices and serials to the linked stock items.
        _writeback_sale_to_stock(db, quotation)

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

    # A confirmed quotation is confirmed BY having a payment. If the last income
    # payment is removed, revert it to draft (releasing the stock claim).
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if quotation and quotation.status == QuotationStatus.confirmed:
        remaining = (
            db.query(Payment)
            .filter(Payment.quotation_id == quotation_id, Payment.payment_type == PaymentType.payment)
            .count()
        )
        if remaining == 0:
            quotation.status = QuotationStatus.draft

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
    from app.inventory.models import InventoryItem, InventoryStatus
    refund_amount = _calc_refund_amount(data.selling_price, data.refund_percent)
    # Resolve the stock item this return brings back (customer returns it to us).
    sale_line = (
        db.query(QuotationItem)
        .filter(
            QuotationItem.quotation_id == quotation_id,
            QuotationItem.is_trade_in == False,  # noqa: E712
            QuotationItem.name == data.item_name,
            QuotationItem.inventory_item_id.isnot(None),
        )
        .first()
    )
    inventory_item_id = sale_line.inventory_item_id if sale_line else None
    ret = Return(
        quotation_id=quotation_id,
        item_name=data.item_name,
        inventory_item_id=inventory_item_id,
        reason=data.reason,
        selling_price=data.selling_price,
        refund_percent=data.refund_percent,
        refund_amount=refund_amount,
        date=data.date or date_type.today(),
        note=data.note,
        created_by=user_id,
    )
    db.add(ret)
    # The returned product goes back into our stock, available to sell again.
    if inventory_item_id is not None:
        inv = db.query(InventoryItem).filter(InventoryItem.id == inventory_item_id).first()
        if inv:
            inv.status = InventoryStatus.in_stock
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

    # Undoing a return: the item is sold again if its quotation was delivered.
    if ret.inventory_item_id is not None:
        from app.inventory.models import InventoryItem, InventoryStatus
        quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
        if quotation and quotation.status == QuotationStatus.delivered:
            inv = db.query(InventoryItem).filter(InventoryItem.id == ret.inventory_item_id).first()
            if inv:
                inv.status = InventoryStatus.sold

    db.delete(ret)
    db.commit()
    return True
