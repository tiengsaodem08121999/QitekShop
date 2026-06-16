from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus


def _add_item(db, name="RAM"):
    it = InventoryItem(name=name, purchase_price=100, selling_price=200)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def _quote(client, user, items, import_trade_ins=False):
    return client.post("/api/quotations",
                       json={"new_customer": {"name": "A"}, "items": items, "import_trade_ins": import_trade_ins},
                       headers=auth_headers(user)).json()


def _detail(client, user, qid):
    return client.get(f"/api/quotations/{qid}", headers=auth_headers(user)).json()


def _put(client, user, qid, items, import_trade_ins=False):
    return client.put(f"/api/quotations/{qid}",
                      json={"items": items, "import_trade_ins": import_trade_ins},
                      headers=auth_headers(user))


SALE = {"is_trade_in": False, "name": "Laptop", "selling_price": 1000}
TRADE = {"is_trade_in": True, "name": "Old RAM", "purchase_price": 80, "resale_price": 150}


def test_stock_edit_syncs_to_linked_line_and_total(client, sales_user, db_session):
    it = _add_item(db_session)  # selling_price 200
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM",
                                     "selling_price": 200, "inventory_item_id": it.id}])
    client.put(f"/api/inventory/{it.id}",
               json={"selling_price": 999, "name": "RAM-X"},
               headers=auth_headers(sales_user))
    db_session.expire_all()
    detail = _detail(client, sales_user, q["id"])
    line = detail["items"][0]
    assert int(line["selling_price"]) == 999
    assert line["name"] == "RAM-X"
    assert int(detail["total_amount"]) == 999


def test_stock_edit_zero_selling_does_not_wipe_line(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM",
                                     "selling_price": 555, "inventory_item_id": it.id}])
    client.put(f"/api/inventory/{it.id}", json={"selling_price": 0},
               headers=auth_headers(sales_user))
    db_session.expire_all()
    line = _detail(client, sales_user, q["id"])["items"][0]
    assert int(line["selling_price"]) == 555  # 0 treated as blank -> no wipe


def test_create_trade_in_no_stock_without_button(client, sales_user, db_session):
    _quote(client, sales_user, [dict(SALE), dict(TRADE)])  # import_trade_ins defaults False
    db_session.expire_all()
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 0


def test_create_trade_in_creates_stock_with_button(client, sales_user, db_session):
    _quote(client, sales_user, [dict(SALE), dict(TRADE)], import_trade_ins=True)
    db_session.expire_all()
    created = db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").one()
    assert int(created.purchase_price) == 80
    assert int(created.selling_price) == 150
    assert created.supplier is None
    assert created.status == InventoryStatus.in_stock


def test_draft_syncs_price_to_stock(client, sales_user, db_session):
    it = _add_item(db_session)  # selling_price 200
    _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 777, "inventory_item_id": it.id}])
    db_session.expire_all()
    # Sync now happens on every save, draft included.
    assert int(db_session.get(InventoryItem, it.id).selling_price) == 777


def test_update_edit_trade_in_updates_same_stock(client, sales_user, db_session):
    q = _quote(client, sales_user, [dict(SALE), dict(TRADE)], import_trade_ins=True)
    before = db_session.query(InventoryItem).count()
    items = list(_detail(client, sales_user, q["id"])["items"])
    for it in items:
        if it["is_trade_in"]:
            it["resale_price"] = 222
    assert _put(client, sales_user, q["id"], items, import_trade_ins=True).status_code == 200
    db_session.expire_all()
    assert db_session.query(InventoryItem).count() == before  # no duplicate
    assert int(db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").one().selling_price) == 222


def test_update_remove_trade_in_deletes_stock_with_button(client, sales_user, db_session):
    q = _quote(client, sales_user, [dict(SALE), dict(TRADE)], import_trade_ins=True)
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 1
    items = [it for it in _detail(client, sales_user, q["id"])["items"] if not it["is_trade_in"]]
    assert _put(client, sales_user, q["id"], items, import_trade_ins=True).status_code == 200
    db_session.expire_all()
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 0


def test_normal_update_does_not_touch_trade_in_stock(client, sales_user, db_session):
    q = _quote(client, sales_user, [dict(SALE), dict(TRADE)], import_trade_ins=True)
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 1
    # Remove the trade-in line via a NORMAL save (no button) -> stock kept.
    items = [it for it in _detail(client, sales_user, q["id"])["items"] if not it["is_trade_in"]]
    assert _put(client, sales_user, q["id"], items).status_code == 200
    db_session.expire_all()
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 1


def test_edit_confirmed_add_unlinked_stays_confirmed(client, sales_user, db_session):
    # Linking is only required at delivery, so adding an unlinked line keeps confirmed.
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 200, "inventory_item_id": it.id}])
    client.post(f"/api/quotations/{q['id']}/payments", json={"amount": 50, "method": "cash"}, headers=auth_headers(sales_user))
    assert _detail(client, sales_user, q["id"])["status"] == "confirmed"
    items = list(_detail(client, sales_user, q["id"])["items"])
    items.append({"is_trade_in": False, "name": "Freebie", "selling_price": 0})
    assert _put(client, sales_user, q["id"], items).status_code == 200
    assert _detail(client, sales_user, q["id"])["status"] == "confirmed"


def test_draft_syncs_sn_to_stock(client, sales_user, db_session):
    it = _add_item(db_session)  # serial_number None initially
    _quote(client, sales_user, [{
        "is_trade_in": False, "name": "RAM", "selling_price": 200,
        "serial_number": "SN-NEW-1", "inventory_item_id": it.id,
    }])
    db_session.expire_all()
    assert db_session.get(InventoryItem, it.id).serial_number == "SN-NEW-1"


def test_sn_edit_on_confirmed_writes_back(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{
        "is_trade_in": False, "name": "RAM", "selling_price": 200,
        "serial_number": "SN-OLD", "inventory_item_id": it.id,
    }])
    # Confirm via payment, which writes back "SN-OLD".
    client.post(f"/api/quotations/{q['id']}/payments",
                json={"amount": 50, "method": "cash"},
                headers=auth_headers(sales_user))
    db_session.expire_all()
    assert db_session.get(InventoryItem, it.id).serial_number == "SN-OLD"
    # Edit the S/N via PUT on the now-confirmed quotation.
    items = list(_detail(client, sales_user, q["id"])["items"])
    items[0]["serial_number"] = "SN-EDITED"
    assert _put(client, sales_user, q["id"], items).status_code == 200
    db_session.expire_all()
    assert db_session.get(InventoryItem, it.id).serial_number == "SN-EDITED"


def test_blank_line_sn_does_not_clear_stock(client, sales_user, db_session):
    it = _add_item(db_session)
    it.serial_number = "SN-EXISTING"
    db_session.commit()
    _quote(client, sales_user, [{
        "is_trade_in": False, "name": "RAM", "selling_price": 200,
        "serial_number": None, "inventory_item_id": it.id,
    }])
    db_session.expire_all()
    # Blank line S/N must NOT wipe the stock S/N (Bug 1 fixed).
    assert db_session.get(InventoryItem, it.id).serial_number == "SN-EXISTING"


def test_import_trade_in_blank_line_keeps_stock_sn(client, sales_user, db_session):
    q = _quote(client, sales_user,
               [dict(SALE), {"is_trade_in": True, "name": "Old", "purchase_price": 80,
                             "resale_price": 150, "serial_number": "TI-SN"}],
               import_trade_ins=True)
    db_session.expire_all()
    inv = db_session.query(InventoryItem).filter(InventoryItem.name == "Old").one()
    assert inv.serial_number == "TI-SN"
    # Re-import with a blank S/N on the line -> stock keeps its S/N.
    items = list(_detail(client, sales_user, q["id"])["items"])
    for it in items:
        if it["is_trade_in"]:
            it["serial_number"] = None
    assert _put(client, sales_user, q["id"], items, import_trade_ins=True).status_code == 200
    db_session.expire_all()
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old").one().serial_number == "TI-SN"
