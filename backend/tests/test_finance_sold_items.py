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
