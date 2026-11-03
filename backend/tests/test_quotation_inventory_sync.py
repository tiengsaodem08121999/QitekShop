from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus


def _add_item(db, name="RAM"):
    it = InventoryItem(name=name, purchase_price=100, expected_price=200)
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


def test_stock_edit_syncs_name_but_not_sale_price(client, sales_user, db_session):
    it = _add_item(db_session)  # expected_price 200
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM",
                                     "selling_price": 300, "inventory_item_id": it.id}])
    client.put(f"/api/inventory/{it.id}",
               json={"expected_price": 999, "name": "RAM-X"},
               headers=auth_headers(sales_user))
    db_session.expire_all()
    detail = _detail(client, sales_user, q["id"])
    line = detail["items"][0]
    assert line["name"] == "RAM-X"
    assert int(line["selling_price"]) == 300  # the quotation authors its own price
    assert int(detail["total_amount"]) == 300


def test_stock_edit_zero_selling_does_not_wipe_line(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM",
                                     "selling_price": 555, "inventory_item_id": it.id}])
    client.put(f"/api/inventory/{it.id}", json={"expected_price": 0},
               headers=auth_headers(sales_user))
    db_session.expire_all()
    line = _detail(client, sales_user, q["id"])["items"][0]
    assert int(line["selling_price"]) == 555  # 0 treated as blank -> no wipe


def test_sale_save_propagates_price_to_trade_in_sibling(client, sales_user, db_session):
    # Quotation A: a trade-in imported to stock with resale 0 (stock selling stays empty).
    qa = _quote(client, sales_user,
                [dict(SALE), {"is_trade_in": True, "name": "GPU", "purchase_price": 1500, "resale_price": 0}],
                import_trade_ins=True)
    db_session.expire_all()
    inv = db_session.query(InventoryItem).filter(InventoryItem.name == "GPU").one()
    # Quotation B sells that same stock item at 2300.
    qb = _quote(client, sales_user, [{"is_trade_in": False, "name": "GPU",
                                      "selling_price": 2300, "inventory_item_id": inv.id}])
    db_session.expire_all()
    # Not sold yet: a draft does not touch stock, so A's resale is unchanged.
    trade_line = [it for it in _detail(client, sales_user, qa["id"])["items"] if it["is_trade_in"]][0]
    assert int(trade_line["resale_price"]) == 0
    # Delivering B sells the unit; its actual price flows to A's trade-in line.
    assert client.patch(f"/api/quotations/{qb['id']}/confirm", headers=auth_headers(sales_user)).status_code == 200
    assert client.patch(f"/api/quotations/{qb['id']}/deliver", headers=auth_headers(sales_user)).status_code == 200
    db_session.expire_all()
    trade_line = [it for it in _detail(client, sales_user, qa["id"])["items"] if it["is_trade_in"]][0]
    assert int(trade_line["resale_price"]) == 2300


def test_create_trade_in_no_stock_without_button(client, sales_user, db_session):
    _quote(client, sales_user, [dict(SALE), dict(TRADE)])  # import_trade_ins defaults False
    db_session.expire_all()
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 0


def test_create_trade_in_creates_stock_with_button(client, sales_user, db_session):
    _quote(client, sales_user, [dict(SALE), dict(TRADE)], import_trade_ins=True)
    db_session.expire_all()
    created = db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").one()
    assert int(created.purchase_price) == 80
    assert int(created.expected_price) == 150  # resale -> expected price
    assert created.selling_price is None       # not sold yet
    assert created.supplier is None
    assert created.status == InventoryStatus.in_stock


def test_undelivered_quotation_does_not_touch_stock_prices(client, sales_user, db_session):
    it = _add_item(db_session)  # expected_price 200
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 777, "inventory_item_id": it.id}])
    assert client.patch(f"/api/quotations/{q['id']}/confirm", headers=auth_headers(sales_user)).status_code == 200
    db_session.expire_all()
    inv = db_session.get(InventoryItem, it.id)
    assert int(inv.expected_price) == 200
    assert inv.selling_price is None


def test_deliver_writes_actual_selling_price(client, sales_user, db_session):
    it = _add_item(db_session)  # expected_price 200
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 777, "inventory_item_id": it.id}])
    client.patch(f"/api/quotations/{q['id']}/confirm", headers=auth_headers(sales_user))
    assert client.patch(f"/api/quotations/{q['id']}/deliver", headers=auth_headers(sales_user)).status_code == 200
    db_session.expire_all()
    inv = db_session.get(InventoryItem, it.id)
    assert inv.status == InventoryStatus.sold
    assert int(inv.selling_price) == 777   # actual price
    assert int(inv.expected_price) == 200  # expected price kept for comparison


def test_edit_price_on_delivered_quotation_updates_actual_price(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM", "selling_price": 777, "inventory_item_id": it.id}])
    client.patch(f"/api/quotations/{q['id']}/confirm", headers=auth_headers(sales_user))
    client.patch(f"/api/quotations/{q['id']}/deliver", headers=auth_headers(sales_user))
    items = list(_detail(client, sales_user, q["id"])["items"])
    items[0]["selling_price"] = 750
    assert _put(client, sales_user, q["id"], items).status_code == 200
    db_session.expire_all()
    assert int(db_session.get(InventoryItem, it.id).selling_price) == 750


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
    assert int(db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").one().expected_price) == 222


def test_update_remove_trade_in_deletes_stock_with_button(client, sales_user, db_session):
    q = _quote(client, sales_user, [dict(SALE), dict(TRADE)], import_trade_ins=True)
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 1
    items = [it for it in _detail(client, sales_user, q["id"])["items"] if not it["is_trade_in"]]
    assert _put(client, sales_user, q["id"], items, import_trade_ins=True).status_code == 200
    db_session.expire_all()
    assert db_session.query(InventoryItem).filter(InventoryItem.name == "Old RAM").count() == 0


def test_remove_linked_sale_line_leaves_stock_prices(client, sales_user, db_session):
    it = _add_item(db_session)  # expected_price 200
    q = _quote(client, sales_user, [
        dict(SALE),
        {"is_trade_in": False, "name": "RAM", "selling_price": 777, "inventory_item_id": it.id},
    ])
    # Remove the linked RAM line, keeping only the unlinked SALE line.
    items = [i for i in _detail(client, sales_user, q["id"])["items"]
             if i.get("inventory_item_id") is None]
    assert _put(client, sales_user, q["id"], items).status_code == 200
    db_session.expire_all()
    inv = db_session.get(InventoryItem, it.id)
    assert int(inv.expected_price) == 200
    assert inv.selling_price is None


def test_keep_linked_sale_line_does_not_reset_stock(client, sales_user, db_session):
    it = _add_item(db_session)
    q = _quote(client, sales_user, [{"is_trade_in": False, "name": "RAM",
                                     "selling_price": 777, "inventory_item_id": it.id}])
    # Edit an unrelated field (name) but keep the link -> price stays.
    items = list(_detail(client, sales_user, q["id"])["items"])
    items[0]["name"] = "RAM-2"
    assert _put(client, sales_user, q["id"], items).status_code == 200
    db_session.expire_all()
    inv = db_session.get(InventoryItem, it.id)
    assert int(inv.expected_price) == 200 and inv.selling_price is None


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
