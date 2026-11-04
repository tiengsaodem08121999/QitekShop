from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus


def _add(db, name, status=InventoryStatus.in_stock, expected=None):
    it = InventoryItem(name=name, serial_number="SN-" + name, purchase_price=100,
                       expected_price=expected, supplier="ACME", note="Like new", status=status)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def test_public_stock_needs_no_login_and_hides_internal_fields(client, db_session):
    _add(db_session, "RAM", expected=500)
    r = client.get("/api/public/stock")  # no auth header
    assert r.status_code == 200
    assert r.json()["items"] == [{"name": "RAM", "note": "Like new", "expected_price": 500}]


def test_public_stock_lists_only_available_in_stock(client, sales_user, db_session):
    _add(db_session, "B-in-stock", expected=200)
    _add(db_session, "A-no-price")
    _add(db_session, "Sold", status=InventoryStatus.sold, expected=300)
    _add(db_session, "Returned", status=InventoryStatus.returned, expected=300)
    held = _add(db_session, "Held", expected=400)
    # A confirmed quotation holds "Held" for a customer -> not offered publicly.
    q = client.post("/api/quotations", json={"new_customer": {"name": "A"}, "items": [
        {"is_trade_in": False, "name": "Held", "selling_price": 400, "inventory_item_id": held.id},
    ]}, headers=auth_headers(sales_user)).json()
    client.patch(f"/api/quotations/{q['id']}/confirm", headers=auth_headers(sales_user))
    items = client.get("/api/public/stock").json()["items"]
    assert [i["name"] for i in items] == ["A-no-price", "B-in-stock"]
    assert items[0]["expected_price"] is None


def test_public_stock_lists_newest_first(client, db_session):
    from datetime import datetime
    for name, created in [("Mid", datetime(2026, 6, 1)), ("Zed-old", datetime(2026, 1, 1)),
                          ("Alpha-new", datetime(2026, 11, 1)), ("Same-sec-1", datetime(2026, 3, 1)),
                          ("Same-sec-2", datetime(2026, 3, 1))]:
        db_session.add(InventoryItem(name=name, purchase_price=100, created_at=created))
        db_session.flush()
    db_session.commit()
    names = [i["name"] for i in client.get("/api/public/stock").json()["items"]]
    assert names == ["Alpha-new", "Mid", "Same-sec-2", "Same-sec-1", "Zed-old"]
