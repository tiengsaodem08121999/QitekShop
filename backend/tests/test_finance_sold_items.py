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
