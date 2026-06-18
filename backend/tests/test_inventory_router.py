from conftest import auth_headers


def _create(client, user, **ov):
    body = {"name": "RAM", "serial_number": "SN1", "purchase_price": 800_000, "supplier": "ACME"}
    body.update(ov)
    r = client.post("/api/inventory", json=body, headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_list(client, sales_user):
    b = _create(client, sales_user)
    assert b["status"] == "in_stock" and b["selling_price"] is None and b["supplier"] == "ACME"
    r = client.get("/api/inventory", headers=auth_headers(sales_user)).json()
    assert r["total"] == 1


def test_available_excludes_non_in_stock(client, sales_user):
    b = _create(client, sales_user, name="A")
    _create(client, sales_user, name="B")
    client.put(f"/api/inventory/{b['id']}", json={"status": "returned"}, headers=auth_headers(sales_user))
    r = client.get("/api/inventory?available=true", headers=auth_headers(sales_user)).json()
    assert {i["name"] for i in r["items"]} == {"B"}


def test_update_and_delete(client, sales_user):
    b = _create(client, sales_user)
    r = client.put(f"/api/inventory/{b['id']}", json={"name": "RAM2"}, headers=auth_headers(sales_user))
    assert r.status_code == 200 and r.json()["name"] == "RAM2"
    assert client.delete(f"/api/inventory/{b['id']}", headers=auth_headers(sales_user)).status_code == 204


def test_cannot_set_sold_manually(client, sales_user):
    b = _create(client, sales_user)
    r = client.put(f"/api/inventory/{b['id']}", json={"status": "sold"}, headers=auth_headers(sales_user))
    assert r.status_code == 400


def test_edit_sold_item_blocked(client, sales_user, db_session):
    from app.inventory.models import InventoryItem, InventoryStatus
    it = InventoryItem(name="Sold", serial_number="S1", purchase_price=100, status=InventoryStatus.sold)
    db_session.add(it)
    db_session.commit()
    db_session.refresh(it)
    r = client.put(f"/api/inventory/{it.id}", json={"name": "X"}, headers=auth_headers(sales_user))
    assert r.status_code == 400


def test_create_allows_null_serial(client, sales_user):
    r = client.post("/api/inventory", json={"name": "NoSN", "purchase_price": 100},
                    headers=auth_headers(sales_user))
    assert r.status_code == 201
    assert r.json()["serial_number"] is None


def test_create_with_condition_roundtrips(client, sales_user):
    b = _create(client, sales_user, condition="new")
    assert b["condition"] == "new"
    r = client.put(f"/api/inventory/{b['id']}", json={"condition": "2nd"}, headers=auth_headers(sales_user))
    assert r.status_code == 200 and r.json()["condition"] == "2nd"


def test_available_includes_own_quotation_claimed(client, sales_user):
    b = _create(client, sales_user, name="RAM", serial_number="SNX")
    q = client.post("/api/quotations", json={"new_customer": {"name": "A"},
                    "items": [{"is_trade_in": False, "name": "RAM", "selling_price": 200,
                               "inventory_item_id": b["id"]}]},
                    headers=auth_headers(sales_user)).json()
    # Confirm so the item becomes claimed.
    client.post(f"/api/quotations/{q['id']}/payments", json={"amount": 50, "method": "cash"},
                headers=auth_headers(sales_user))
    avail = client.get("/api/inventory?available=true", headers=auth_headers(sales_user)).json()
    assert b["id"] not in {i["id"] for i in avail["items"]}  # claimed -> hidden
    own = client.get(f"/api/inventory?available=true&exclude_quotation_id={q['id']}",
                     headers=auth_headers(sales_user)).json()
    assert b["id"] in {i["id"] for i in own["items"]}  # selectable again for its own quotation


def test_accountant_cannot_create(client, accountant_user):
    assert client.post("/api/inventory", json={"name": "x"}, headers=auth_headers(accountant_user)).status_code == 403


def test_limit_zero_returns_all(client, sales_user):
    for n in ("A", "B", "C"):
        _create(client, sales_user, name=n, serial_number=f"SN{n}")
    paged = client.get("/api/inventory?limit=2&page=1", headers=auth_headers(sales_user)).json()
    assert len(paged["items"]) == 2 and paged["total"] == 3
    all_items = client.get("/api/inventory?limit=0", headers=auth_headers(sales_user)).json()
    assert len(all_items["items"]) == 3 and all_items["total"] == 3
