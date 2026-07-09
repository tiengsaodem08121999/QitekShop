from conftest import auth_headers


def _item(client, user, **ov):
    body = {"name": "RAM", "purchase_price": 800_000}
    body.update(ov)
    r = client.post("/api/inventory", json=body, headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()


def _txn_body(**ov):
    body = {"date": "2026-06-18", "description": "Ban hang", "type": "thu",
            "amount": 1_000_000, "notes": None}
    body.update(ov)
    return body


def test_inventory_item_has_transaction_id_column(db_session, admin_user):
    from datetime import date
    from app.inventory.models import InventoryItem, InventoryStatus
    from app.finance.models import Transaction, TransactionType
    txn = Transaction(date=date(2026, 6, 18), description="x", type=TransactionType.thu,
                      amount=1, created_by=admin_user.id)
    db_session.add(txn)
    db_session.flush()
    it = InventoryItem(name="Linked", purchase_price=1, status=InventoryStatus.sold,
                       selling_price=999, transaction_id=txn.id)
    db_session.add(it)
    db_session.commit()
    db_session.refresh(it)
    assert it.transaction_id == txn.id


def test_schemas_accept_and_default_sold_items():
    from app.finance.schemas import TransactionCreate, TransactionResponse
    c = TransactionCreate(date="2026-06-18", description="x", type="thu", amount=100,
                          sold_items=[{"inventory_item_id": 1, "selling_price": 500}])
    assert c.sold_items[0].inventory_item_id == 1
    c2 = TransactionCreate(date="2026-06-18", description="x", type="chi", amount=100)
    assert c2.sold_items is None
    fields = TransactionResponse.model_fields
    assert "sold_items" in fields


def test_create_sells_item(client, admin_user):
    it = _item(client, admin_user)
    body = _txn_body(sold_items=[{"inventory_item_id": it["id"], "selling_price": 1_200_000}])
    r = client.post("/api/finance/transactions", json=body, headers=auth_headers(admin_user))
    assert r.status_code == 201, r.text
    data = r.json()
    assert len(data["sold_items"]) == 1
    assert data["sold_items"][0]["inventory_item_id"] == it["id"]
    assert data["sold_items"][0]["selling_price"] == 1_200_000
    inv = client.get("/api/inventory", headers=auth_headers(admin_user)).json()["items"][0]
    assert inv["status"] == "sold" and inv["selling_price"] == 1_200_000


def test_create_chi_with_sold_items_rejected(client, admin_user):
    it = _item(client, admin_user)
    body = _txn_body(type="chi",
                     sold_items=[{"inventory_item_id": it["id"], "selling_price": 100}])
    r = client.post("/api/finance/transactions", json=body, headers=auth_headers(admin_user))
    assert r.status_code == 400


def test_create_rejects_already_sold_item(client, admin_user):
    it = _item(client, admin_user)
    first = _txn_body(sold_items=[{"inventory_item_id": it["id"], "selling_price": 100}])
    client.post("/api/finance/transactions", json=first, headers=auth_headers(admin_user))
    second = _txn_body(sold_items=[{"inventory_item_id": it["id"], "selling_price": 200}])
    r = client.post("/api/finance/transactions", json=second, headers=auth_headers(admin_user))
    assert r.status_code == 400


def test_create_rejects_nonpositive_price(client, admin_user):
    it = _item(client, admin_user)
    body = _txn_body(sold_items=[{"inventory_item_id": it["id"], "selling_price": 0}])
    r = client.post("/api/finance/transactions", json=body, headers=auth_headers(admin_user))
    assert r.status_code == 400


def _create_txn_with(client, user, items_prices):
    body = _txn_body(sold_items=[{"inventory_item_id": i, "selling_price": p}
                                 for i, p in items_prices])
    r = client.post("/api/finance/transactions", json=body, headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()


def test_update_adds_item(client, admin_user):
    a = _item(client, admin_user, name="A")
    b = _item(client, admin_user, name="B")
    txn = _create_txn_with(client, admin_user, [(a["id"], 100)])
    body = _txn_body(sold_items=[{"inventory_item_id": a["id"], "selling_price": 100},
                                 {"inventory_item_id": b["id"], "selling_price": 200}])
    r = client.put(f"/api/finance/transactions/{txn['id']}", json=body,
                   headers=auth_headers(admin_user))
    assert r.status_code == 200 and len(r.json()["sold_items"]) == 2


def test_update_removes_item_rolls_back(client, admin_user):
    a = _item(client, admin_user, name="A")
    b = _item(client, admin_user, name="B")
    txn = _create_txn_with(client, admin_user, [(a["id"], 100), (b["id"], 200)])
    body = _txn_body(sold_items=[{"inventory_item_id": a["id"], "selling_price": 100}])
    r = client.put(f"/api/finance/transactions/{txn['id']}", json=body,
                   headers=auth_headers(admin_user))
    assert r.status_code == 200 and len(r.json()["sold_items"]) == 1
    items = {i["name"]: i for i in
             client.get("/api/inventory", headers=auth_headers(admin_user)).json()["items"]}
    assert items["B"]["status"] == "in_stock" and items["B"]["selling_price"] is None


def test_update_reprice(client, admin_user):
    a = _item(client, admin_user, name="A")
    txn = _create_txn_with(client, admin_user, [(a["id"], 100)])
    body = _txn_body(sold_items=[{"inventory_item_id": a["id"], "selling_price": 555}])
    r = client.put(f"/api/finance/transactions/{txn['id']}", json=body,
                   headers=auth_headers(admin_user))
    assert r.json()["sold_items"][0]["selling_price"] == 555


def test_update_type_to_chi_rolls_back_all(client, admin_user):
    a = _item(client, admin_user, name="A")
    txn = _create_txn_with(client, admin_user, [(a["id"], 100)])
    body = _txn_body(type="chi", sold_items=[])
    r = client.put(f"/api/finance/transactions/{txn['id']}", json=body,
                   headers=auth_headers(admin_user))
    assert r.status_code == 200 and r.json()["sold_items"] == []
    inv = client.get("/api/inventory", headers=auth_headers(admin_user)).json()["items"][0]
    assert inv["status"] == "in_stock" and inv["selling_price"] is None


def test_finance_sale_propagates_price_to_trade_in_line(client, admin_user, db_session):
    from conftest import auth_headers as _auth
    from app.inventory.models import InventoryItem
    # Quotation with a trade-in imported to stock at resale 0 (stock selling stays blank).
    q = client.post(
        "/api/quotations",
        json={
            "new_customer": {"name": "A"},
            "items": [
                {"is_trade_in": False, "name": "Laptop", "selling_price": 1000},
                {"is_trade_in": True, "name": "Old GPU", "purchase_price": 1500, "resale_price": 0},
            ],
            "import_trade_ins": True,
        },
        headers=_auth(admin_user),
    ).json()
    db_session.expire_all()
    inv = db_session.query(InventoryItem).filter(InventoryItem.name == "Old GPU").one()
    # Sell that stock item via a finance transaction at 2300.
    body = _txn_body(sold_items=[{"inventory_item_id": inv.id, "selling_price": 2300}])
    r = client.post("/api/finance/transactions", json=body, headers=_auth(admin_user))
    assert r.status_code == 201, r.text
    # The entered sale price must propagate to the quotation's trade-in line resale_price.
    detail = client.get(f"/api/quotations/{q['id']}", headers=_auth(admin_user)).json()
    trade_line = [it for it in detail["items"] if it["is_trade_in"]][0]
    assert int(trade_line["resale_price"]) == 2300


def test_delete_rolls_back_items(client, admin_user):
    a = _item(client, admin_user, name="A")
    txn = _create_txn_with(client, admin_user, [(a["id"], 100)])
    r = client.delete(f"/api/finance/transactions/{txn['id']}", headers=auth_headers(admin_user))
    assert r.status_code == 204
    inv = client.get("/api/inventory", headers=auth_headers(admin_user)).json()["items"][0]
    assert inv["status"] == "in_stock" and inv["selling_price"] is None
