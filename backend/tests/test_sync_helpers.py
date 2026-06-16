from decimal import Decimal

from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.models import Customer, Quotation, QuotationItem
from app.quotation.service import _sync_line_to_stock, sync_stock_to_quotations


def _stock(db, **ov):
    data = dict(name="Stock", serial_number="S-OLD", purchase_price=100, selling_price=200,
                condition="new", status=InventoryStatus.in_stock)
    data.update(ov)
    it = InventoryItem(**data)
    db.add(it); db.commit(); db.refresh(it)
    return it


def _line(db, inv_id, **ov):
    # customer_id is NOT NULL; created_by FK isn't enforced under SQLite test PRAGMA.
    c = Customer(name="C")
    db.add(c); db.flush()
    q = Quotation(customer_id=c.id, created_by=1)
    db.add(q); db.flush()
    data = dict(quotation_id=q.id, is_trade_in=False, name="Line", serial_number="S-NEW",
                purchase_price=300, selling_price=400, resale_price=0, condition="2nd",
                inventory_item_id=inv_id)
    data.update(ov)
    it = QuotationItem(**data)
    db.add(it); db.commit(); db.refresh(it)
    return q, it


def test_line_to_stock_copies_nonblank(db_session):
    inv = _stock(db_session)
    _q, line = _line(db_session, inv.id)
    _sync_line_to_stock(db_session, line)
    db_session.commit(); db_session.refresh(inv)
    assert inv.name == "Line"
    assert inv.serial_number == "S-NEW"
    assert int(inv.purchase_price) == 300
    assert int(inv.selling_price) == 400
    assert inv.condition == "2nd"


def test_line_to_stock_skips_blank_sn_and_zero_price(db_session):
    inv = _stock(db_session)
    _q, line = _line(db_session, inv.id, serial_number=None, selling_price=Decimal(0))
    _sync_line_to_stock(db_session, line)
    db_session.commit(); db_session.refresh(inv)
    assert inv.serial_number == "S-OLD"   # blank line S/N must NOT wipe stock
    assert int(inv.selling_price) == 200  # zero line price must NOT wipe stock


def test_trade_in_resale_maps_to_stock_selling(db_session):
    inv = _stock(db_session, selling_price=None)
    _q, line = _line(db_session, inv.id, is_trade_in=True, selling_price=Decimal(0),
                     resale_price=Decimal(150), condition=None)
    _sync_line_to_stock(db_session, line)
    db_session.commit(); db_session.refresh(inv)
    assert int(inv.selling_price) == 150  # trade-in resale -> stock selling


def test_stock_to_quotations_updates_line_and_total(db_session):
    inv = _stock(db_session)
    q, line = _line(db_session, inv.id, selling_price=Decimal(400))
    q.total_amount = Decimal(400); db_session.commit()
    inv.name = "Renamed"; inv.selling_price = Decimal(999)
    sync_stock_to_quotations(db_session, inv)
    db_session.commit(); db_session.refresh(line); db_session.refresh(q)
    assert line.name == "Renamed"
    assert int(line.selling_price) == 999
    assert int(q.total_amount) == 999
