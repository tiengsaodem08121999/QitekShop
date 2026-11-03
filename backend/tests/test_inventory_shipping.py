from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus


def _add(db, name, status=InventoryStatus.in_stock):
    it = InventoryItem(name=name, purchase_price=100, expected_price=500, status=status)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


def test_set_shipping_manually(client, sales_user, db_session):
    it = _add(db_session, "RAM")
    r = client.put(f"/api/inventory/{it.id}", json={"status": "shipping"}, headers=auth_headers(sales_user))
    assert r.status_code == 200 and r.json()["status"] == "shipping"


def test_shipping_hidden_from_quotation_picker_and_public_page(client, sales_user, db_session):
    _add(db_session, "Ship", status=InventoryStatus.shipping)
    _add(db_session, "Stock")
    picker = client.get("/api/inventory?available=true", headers=auth_headers(sales_user)).json()
    assert [i["name"] for i in picker["items"]] == ["Stock"]
    public = client.get("/api/public/stock").json()["items"]
    assert [i["name"] for i in public] == ["Stock"]


def test_shipping_is_sellable_through_finance(client, sales_user, admin_user, db_session):
    ship = _add(db_session, "Ship", status=InventoryStatus.shipping)
    _add(db_session, "Sold", status=InventoryStatus.sold)
    sellable = client.get("/api/inventory?sellable=true", headers=auth_headers(sales_user)).json()
    assert {i["name"] for i in sellable["items"]} == {"Ship"}
    body = {"type": "thu", "amount": 700, "description": "Ban hang", "date": "2026-11-03",
            "sold_items": [{"inventory_item_id": ship.id, "selling_price": 700}]}
    r = client.post("/api/finance/transactions", json=body, headers=auth_headers(admin_user))
    assert r.status_code == 201, r.text
    db_session.expire_all()
    inv = db_session.get(InventoryItem, ship.id)
    assert inv.status == InventoryStatus.sold and int(inv.selling_price) == 700
