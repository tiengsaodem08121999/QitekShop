from decimal import Decimal

from app.inventory.models import InventoryItem, InventoryStatus
from app.quotation.models import Customer, Quotation, QuotationItem
from app.quotation.service import _sync_line_to_stock, sync_stock_to_quotations


def _stock(db, **ov):
    data = dict(name="Stock", serial_number="S-OLD", purchase_price=100, expected_price=200,
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
    assert inv.selling_price is None       # not delivered -> no actual price
    assert int(inv.expected_price) == 200  # a sale line never sets the expected price
    assert inv.condition == "2nd"


def test_line_to_stock_skips_blank_sn_but_writes_zero_sale_price(db_session):
    inv = _stock(db_session)
    _q, line = _line(db_session, inv.id, serial_number=None, selling_price=Decimal(0))
    _sync_line_to_stock(db_session, line, delivered=True)
    db_session.commit(); db_session.refresh(inv)
    assert inv.serial_number == "S-OLD"   # blank line S/N must NOT wipe stock
    assert int(inv.selling_price) == 0    # a sale line's 0 IS an intentional price


def test_line_to_stock_skips_zero_purchase_price(db_session):
    inv = _stock(db_session)
    _q, line = _line(db_session, inv.id, purchase_price=Decimal(0))
    _sync_line_to_stock(db_session, line)
    db_session.commit(); db_session.refresh(inv)
    assert int(inv.purchase_price) == 100  # zero line cost must NOT wipe stock


def test_trade_in_resale_maps_to_stock_expected(db_session):
    inv = _stock(db_session, expected_price=None)
    _q, line = _line(db_session, inv.id, is_trade_in=True, selling_price=Decimal(0),
                     resale_price=Decimal(150), condition=None)
    _sync_line_to_stock(db_session, line)
    db_session.commit(); db_session.refresh(inv)
    assert int(inv.expected_price) == 150  # trade-in resale -> stock expected price
    assert inv.selling_price is None


def test_stock_to_quotations_updates_line_and_total(db_session):
    inv = _stock(db_session)
    q, line = _line(db_session, inv.id, selling_price=Decimal(400))
    q.total_amount = Decimal(400); db_session.commit()
    inv.name = "Renamed"; inv.expected_price = Decimal(999)
    sync_stock_to_quotations(db_session, inv)
    db_session.commit(); db_session.refresh(line); db_session.refresh(q)
    assert line.name == "Renamed"
    assert int(line.selling_price) == 400  # sale price is never pulled from stock
    assert int(q.total_amount) == 400


def test_trade_in_resale_follows_expected_then_actual(db_session):
    inv = _stock(db_session, expected_price=Decimal(150))
    _q, line = _line(db_session, inv.id, is_trade_in=True, selling_price=Decimal(0),
                     resale_price=Decimal(0), condition=None)
    sync_stock_to_quotations(db_session, inv)
    db_session.commit(); db_session.refresh(line)
    assert int(line.resale_price) == 150  # unsold -> expected price
    inv.selling_price = Decimal(180)      # sold
    sync_stock_to_quotations(db_session, inv)
    db_session.commit(); db_session.refresh(line)
    assert int(line.resale_price) == 180  # sold -> actual price
