"""Buybacks (báo giá thu cũ): goods bought from someone without a sale attached.

A buyback is a quotation row with kind=buyback, no customer and only trade-in lines.
Every line owns a stock item: saving creates or updates it, so the form is the stock
item's editor (blanks included) until the unit sells. The sale itself happens elsewhere,
through a quotation or a Finance transaction, and the actual price is read from stock.

It takes no payments, returns or status changes, and get_quotation() never returns one,
which keeps it out of every sale quotation endpoint.
"""
from typing import Iterable, Optional

from sqlalchemy.orm import Session, joinedload

from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.buyback_schemas import BuybackSave
from app.quotation.models import Quotation, QuotationItem, QuotationKind
from app.quotation.service import (
    _compute_totals,
    _delete_quotation_with_stock,
    _reclaim_dropped_trade_in_stock,
    get_claimed_inventory_ids,
    sync_stock_to_quotations,
)


def _load(db: Session, buyback_id: int) -> Optional[Quotation]:
    return (
        db.query(Quotation)
        .options(joinedload(Quotation.items))
        .filter(Quotation.id == buyback_id, Quotation.kind == QuotationKind.buyback)
        .first()
    )


def _stock_by_id(db: Session, ids: Iterable[Optional[int]]) -> dict[int, InventoryItem]:
    wanted = {i for i in ids if i is not None}
    if not wanted:
        return {}
    return {inv.id: inv for inv in db.query(InventoryItem).filter(InventoryItem.id.in_(wanted)).all()}


def _is_sold(inv: Optional[InventoryItem]) -> bool:
    return inv is not None and inv.status == InventoryStatus.sold


def _sold_price(inv: Optional[InventoryItem]):
    return inv.selling_price if _is_sold(inv) else None


def _has_locked_line(buyback: Quotation, stock: dict[int, InventoryItem], claimed: set) -> bool:
    """A unit that is sold or held by a confirmed quotation ties the buyback to that sale."""
    return any(
        _is_sold(stock.get(i.inventory_item_id)) or i.inventory_item_id in claimed
        for i in buyback.items
    )


def _summary(buyback: Quotation, stock: dict[int, InventoryItem], claimed: set) -> dict:
    return {
        "id": buyback.id,
        "title": buyback.title,
        "total_purchase": buyback.total_trade_in,
        "total_resale": sum(_sold_price(stock.get(i.inventory_item_id)) or 0 for i in buyback.items),
        "created_at": buyback.created_at,
        "deletable": not _has_locked_line(buyback, stock, claimed),
    }


def _to_response(db: Session, buyback: Quotation) -> dict:
    stock = _stock_by_id(db, (i.inventory_item_id for i in buyback.items))
    claimed = get_claimed_inventory_ids(db)
    items = []
    for line in buyback.items:
        inv = stock.get(line.inventory_item_id)
        items.append({
            "id": line.id,
            "name": line.name,
            "serial_number": line.serial_number,
            "purchase_price": line.purchase_price,
            "expected_price": (inv.expected_price or 0) if inv else line.resale_price,
            "selling_price": _sold_price(inv),
            "inventory_item_id": line.inventory_item_id,
            "sold": _is_sold(inv),
            "locked": _is_sold(inv) or line.inventory_item_id in claimed,
        })
    return {**_summary(buyback, stock, claimed), "note": buyback.note, "items": items}


def _validated(data: BuybackSave) -> tuple[str, list]:
    title = data.title.strip()
    if not title:
        raise ValueError("err_buyback_title_required")
    lines = [line for line in data.items if line.name.strip()]
    if not lines:
        raise ValueError("err_buyback_no_items")
    return title, lines


def _save_lines(db: Session, buyback: Quotation, lines: list) -> None:
    """Replace a buyback's lines and bring stock in line with them. A line can only keep
    a stock link it already had; a sold line cannot change; a sold or held line cannot be
    dropped; any other dropped line takes its stock with it."""
    previous = {
        i.inventory_item_id: (i.name, i.serial_number, i.purchase_price, i.resale_price)
        for i in buyback.items if i.inventory_item_id is not None
    }
    stock = _stock_by_id(db, previous)
    claimed = get_claimed_inventory_ids(db)
    locked = {inv_id for inv_id, inv in stock.items() if _is_sold(inv) or inv_id in claimed}
    if locked - {line.inventory_item_id for line in lines}:
        raise ValueError("err_buyback_line_locked")

    db.query(QuotationItem).filter(QuotationItem.quotation_id == buyback.id).delete()
    unclaimed_links = set(previous)
    for line in lines:
        link = line.inventory_item_id if line.inventory_item_id in unclaimed_links else None
        unclaimed_links.discard(link)
        values = (line.name.strip(), line.serial_number or None, line.purchase_price, line.expected_price)
        if _is_sold(stock.get(link)):
            values = previous[link]
        name, serial, purchase, resale = values
        db.add(QuotationItem(
            quotation_id=buyback.id,
            is_trade_in=True,
            name=name,
            serial_number=serial,
            purchase_price=purchase,
            resale_price=resale,
            selling_price=0,
            inventory_item_id=link,
        ))
    db.flush()
    db.refresh(buyback)

    for item in buyback.items:
        inv = stock.get(item.inventory_item_id)
        if _is_sold(inv):
            continue
        if inv is None:
            inv = InventoryItem(status=InventoryStatus.in_stock)
            db.add(inv)
        inv.name = item.name
        inv.serial_number = item.serial_number
        inv.purchase_price = item.purchase_price
        inv.expected_price = item.resale_price or None
        db.flush()
        item.inventory_item_id = inv.id
        db.flush()
        sync_stock_to_quotations(db, inv)

    buyback.total_amount, buyback.total_trade_in = _compute_totals(buyback.items)
    _reclaim_dropped_trade_in_stock(db, buyback, set(previous))


def list_buybacks(db: Session) -> list[dict]:
    rows = (
        db.query(Quotation)
        .options(joinedload(Quotation.items))
        .filter(Quotation.kind == QuotationKind.buyback)
        .order_by(Quotation.created_at.desc(), Quotation.id.desc())
        .all()
    )
    stock = _stock_by_id(db, (i.inventory_item_id for b in rows for i in b.items))
    claimed = get_claimed_inventory_ids(db)
    return [_summary(b, stock, claimed) for b in rows]


def get_buyback(db: Session, buyback_id: int) -> Optional[dict]:
    buyback = _load(db, buyback_id)
    return _to_response(db, buyback) if buyback else None


def create_buyback(db: Session, data: BuybackSave, user_id: int) -> dict:
    title, lines = _validated(data)
    buyback = Quotation(
        kind=QuotationKind.buyback,
        customer_id=None,
        title=title,
        note=data.note,
        created_by=user_id,
    )
    db.add(buyback)
    db.flush()
    _save_lines(db, buyback, lines)
    db.commit()
    db.refresh(buyback)
    return _to_response(db, buyback)


def update_buyback(db: Session, buyback_id: int, data: BuybackSave) -> Optional[dict]:
    title, lines = _validated(data)
    buyback = _load(db, buyback_id)
    if not buyback:
        return None
    _save_lines(db, buyback, lines)
    buyback.title = title
    buyback.note = data.note
    db.commit()
    db.refresh(buyback)
    return _to_response(db, buyback)


def delete_buyback(db: Session, buyback_id: int) -> bool:
    """Delete a buyback and its stock. Raises ValueError once a unit is sold or held."""
    buyback = _load(db, buyback_id)
    if not buyback:
        return False
    stock = _stock_by_id(db, (i.inventory_item_id for i in buyback.items))
    if _has_locked_line(buyback, stock, get_claimed_inventory_ids(db)):
        raise ValueError("err_buyback_has_sold")
    _delete_quotation_with_stock(db, buyback)
    return True
