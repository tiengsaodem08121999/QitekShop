"""Buybacks (báo giá thu cũ): named, customer-less quotations whose lines own stock items."""
from datetime import date

from conftest import auth_headers

from app.inventory.models import InventoryItem, InventoryStatus


def _body(**ov):
    body = {
        "title": "Thu cu may anh A",
        "note": None,
        "items": [
            {"name": "Laptop cu", "serial_number": "SN1", "purchase_price": 1000, "expected_price": 1500},
            {"name": "RAM cu", "purchase_price": 200, "expected_price": 300},
        ],
    }
    body.update(ov)
    return body


def _create(client, user, **ov):
    r = client.post("/api/buybacks", json=_body(**ov), headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()


def _get(client, user, bid):
    return client.get(f"/api/buybacks/{bid}", headers=auth_headers(user)).json()


def _put(client, user, bid, **ov):
    return client.put(f"/api/buybacks/{bid}", json=_body(**ov), headers=auth_headers(user))


def _stock(db):
    db.expire_all()
    return {i.name: i for i in db.query(InventoryItem).all()}


def _line(item, **ov):
    keys = ("name", "serial_number", "purchase_price", "expected_price", "inventory_item_id")
    return {**{k: item[k] for k in keys}, **ov}


def _sell_via_finance(client, user, stock_id, price):
    txn = {"date": "2026-06-18", "description": "Ban", "type": "thu", "amount": price,
           "sold_items": [{"inventory_item_id": stock_id, "selling_price": price}]}
    r = client.post("/api/finance/transactions", json=txn, headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()


def _quotation_for(client, user, stock_id, price):
    r = client.post("/api/quotations", json={"new_customer": {"name": "A"}, "items": [
        {"name": "Laptop cu", "selling_price": price, "purchase_price": 1000, "inventory_item_id": stock_id},
    ]}, headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_list_shows_title_total_buy_and_date_newest_first(client, admin_user):
    _create(client, admin_user, title="Cu hon")
    second = _create(client, admin_user, title="Moi hon")
    r = client.get("/api/buybacks", headers=auth_headers(admin_user))
    assert r.status_code == 200
    rows = r.json()
    assert [row["title"] for row in rows] == ["Moi hon", "Cu hon"]
    assert rows[0]["id"] == second["id"]
    assert rows[0]["total_purchase"] == 1200
    assert rows[0]["created_at"]


def test_detail_returns_lines_and_note(client, admin_user):
    created = _create(client, admin_user, note="Ghi chu")
    data = _get(client, admin_user, created["id"])
    assert data["note"] == "Ghi chu"
    assert [(i["name"], i["serial_number"], i["purchase_price"], i["expected_price"]) for i in data["items"]] == [
        ("Laptop cu", "SN1", 1000, 1500),
        ("RAM cu", None, 200, 300),
    ]


def test_title_and_a_named_line_are_required(client, admin_user):
    h = auth_headers(admin_user)
    r = client.post("/api/buybacks", json=_body(title="   "), headers=h)
    assert (r.status_code, r.json()["detail"]) == (400, "err_buyback_title_required")
    r = client.post("/api/buybacks", json=_body(items=[{"name": "  ", "purchase_price": 5}]), headers=h)
    assert (r.status_code, r.json()["detail"]) == (400, "err_buyback_no_items")
    assert client.get("/api/buybacks", headers=h).json() == []


def test_negative_prices_are_rejected(client, admin_user):
    h = auth_headers(admin_user)
    assert client.post("/api/buybacks", json=_body(items=[{"name": "X", "purchase_price": -1}]), headers=h).status_code == 422
    assert client.post("/api/buybacks", json=_body(items=[{"name": "X", "expected_price": -1}]), headers=h).status_code == 422


# --- Saving always keeps stock in step ---

def test_saving_always_creates_stock_offered_publicly(client, admin_user, db_session):
    data = _create(client, admin_user)
    laptop = _stock(db_session)["Laptop cu"]
    assert (laptop.purchase_price, laptop.expected_price, laptop.serial_number) == (1000, 1500, "SN1")
    assert laptop.status == InventoryStatus.in_stock
    assert laptop.selling_price is None
    assert all(i["inventory_item_id"] is not None for i in data["items"])
    public = client.get("/api/public/stock").json()["items"]
    assert {(i["name"], i["expected_price"]) for i in public} == {("Laptop cu", 1500), ("RAM cu", 300)}


def test_edit_updates_the_same_stock_and_adds_new_lines(client, admin_user, db_session):
    data = _create(client, admin_user)
    laptop, ram = data["items"]
    r = _put(client, admin_user, data["id"], items=[
        _line(laptop, name="Laptop moi ten", purchase_price=1100, expected_price=1600, serial_number="SN2"),
        _line(ram),
        {"name": "SSD cu", "purchase_price": 50, "expected_price": 70},
    ])
    assert r.status_code == 200, r.text
    assert r.json()["total_purchase"] == 1350
    stock = _stock(db_session)
    assert set(stock) == {"Laptop moi ten", "RAM cu", "SSD cu"}
    renamed = stock["Laptop moi ten"]
    assert renamed.id == laptop["inventory_item_id"]  # updated, not duplicated
    assert (renamed.purchase_price, renamed.expected_price, renamed.serial_number) == (1100, 1600, "SN2")


def test_edit_can_clear_serial_and_expected_price_from_stock(client, admin_user, db_session):
    data = _create(client, admin_user)
    laptop, ram = data["items"]
    r = _put(client, admin_user, data["id"], items=[_line(laptop, serial_number="", expected_price=0), _line(ram)])
    assert r.status_code == 200, r.text
    item = r.json()["items"][0]
    assert (item["serial_number"], item["expected_price"]) == (None, 0)
    stock = _stock(db_session)["Laptop cu"]
    assert (stock.serial_number, stock.expected_price) == (None, None)


def test_stock_edit_shows_up_in_the_buyback(client, admin_user):
    data = _create(client, admin_user)
    stock_id = data["items"][0]["inventory_item_id"]
    r = client.put(f"/api/inventory/{stock_id}", json={"expected_price": 1999, "purchase_price": 1234},
                   headers=auth_headers(admin_user))
    assert r.status_code == 200, r.text
    fresh = _get(client, admin_user, data["id"])
    assert (fresh["items"][0]["expected_price"], fresh["items"][0]["purchase_price"]) == (1999, 1234)
    assert fresh["total_purchase"] == 1434


def test_dropping_a_line_reclaims_its_stock(client, admin_user, db_session):
    data = _create(client, admin_user)
    r = _put(client, admin_user, data["id"], items=[_line(data["items"][0])])
    assert r.status_code == 200, r.text
    assert set(_stock(db_session)) == {"Laptop cu"}


def test_a_line_cannot_link_to_stock_it_does_not_own(client, admin_user, db_session):
    other = InventoryItem(name="Hang khac", purchase_price=9999, status=InventoryStatus.in_stock)
    db_session.add(other)
    db_session.commit()
    other_id = other.id
    data = _create(client, admin_user, items=[{"name": "X", "purchase_price": 1, "inventory_item_id": other_id}])
    assert data["items"][0]["inventory_item_id"] != other_id
    r = _put(client, admin_user, data["id"], items=[{"name": "Y", "purchase_price": 1, "inventory_item_id": other_id}])
    assert r.json()["items"][0]["inventory_item_id"] != other_id
    assert _stock(db_session)["Hang khac"].purchase_price == 9999


def test_two_lines_cannot_share_one_stock_item(client, admin_user, db_session):
    data = _create(client, admin_user, items=[{"name": "A", "purchase_price": 1}])
    line = data["items"][0]
    r = _put(client, admin_user, data["id"], items=[_line(line), _line(line, name="B")])
    links = [i["inventory_item_id"] for i in r.json()["items"]]
    assert len(set(links)) == 2
    assert set(_stock(db_session)) == {"A", "B"}


def test_delete_removes_an_unsold_buyback_and_its_stock(client, admin_user, db_session):
    data = _create(client, admin_user)
    assert data["deletable"] is True
    r = client.delete(f"/api/buybacks/{data['id']}", headers=auth_headers(admin_user))
    assert r.status_code == 204
    assert _stock(db_session) == {}
    assert client.get(f"/api/buybacks/{data['id']}", headers=auth_headers(admin_user)).status_code == 404


def test_delete_is_blocked_once_a_unit_is_sold_and_allowed_again_if_the_sale_is_undone(client, admin_user, db_session):
    h = auth_headers(admin_user)
    data = _create(client, admin_user)
    txn = _sell_via_finance(client, admin_user, data["items"][0]["inventory_item_id"], 2000)
    assert client.get("/api/buybacks", headers=h).json()[0]["deletable"] is False
    assert _get(client, admin_user, data["id"])["deletable"] is False

    r = client.delete(f"/api/buybacks/{data['id']}", headers=h)
    assert (r.status_code, r.json()["detail"]) == (400, "err_buyback_has_sold")
    assert len(_get(client, admin_user, data["id"])["items"]) == 2
    assert set(_stock(db_session)) == {"Laptop cu", "RAM cu"}

    client.delete(f"/api/finance/transactions/{txn['id']}", headers=h)
    assert client.get("/api/buybacks", headers=h).json()[0]["deletable"] is True
    assert client.delete(f"/api/buybacks/{data['id']}", headers=h).status_code == 204


def test_delete_is_blocked_while_a_quotation_holds_or_sold_a_unit(client, admin_user):
    h = auth_headers(admin_user)
    data = _create(client, admin_user)
    qid = _quotation_for(client, admin_user, data["items"][0]["inventory_item_id"], 1800)
    # A draft quotation only references the unit: nothing is held yet.
    assert client.get("/api/buybacks", headers=h).json()[0]["deletable"] is True
    client.patch(f"/api/quotations/{qid}/confirm", headers=h)
    assert client.get("/api/buybacks", headers=h).json()[0]["deletable"] is False
    assert client.delete(f"/api/buybacks/{data['id']}", headers=h).status_code == 400
    client.patch(f"/api/quotations/{qid}/deliver", headers=h)
    assert client.get("/api/buybacks", headers=h).json()[0]["deletable"] is False
    assert client.delete(f"/api/buybacks/{data['id']}", headers=h).status_code == 400


def test_unsold_line_can_still_be_removed_from_a_buyback_with_a_sold_unit(client, admin_user, db_session):
    data = _create(client, admin_user)
    laptop, ram = data["items"]
    _sell_via_finance(client, admin_user, laptop["inventory_item_id"], 2000)
    r = _put(client, admin_user, data["id"], items=[_line(laptop)])
    assert r.status_code == 200, r.text
    assert [i["name"] for i in r.json()["items"]] == ["Laptop cu"]
    assert set(_stock(db_session)) == {"Laptop cu"}


# --- The selling price is only ever what the unit actually sold for ---

def test_unsold_line_has_no_selling_price_and_total_is_zero(client, admin_user):
    data = _create(client, admin_user)
    assert [i["selling_price"] for i in data["items"]] == [None, None]
    assert [i["sold"] for i in data["items"]] == [False, False]
    assert data["total_resale"] == 0
    assert client.get("/api/buybacks", headers=auth_headers(admin_user)).json()[0]["total_resale"] == 0


def test_finance_sale_shows_price_and_keeps_expected(client, admin_user):
    data = _create(client, admin_user)
    _sell_via_finance(client, admin_user, data["items"][0]["inventory_item_id"], 2000)
    laptop, ram = _get(client, admin_user, data["id"])["items"]
    assert (laptop["selling_price"], laptop["expected_price"], laptop["sold"], laptop["locked"]) == (2000, 1500, True, True)
    assert (ram["selling_price"], ram["sold"], ram["locked"]) == (None, False, False)
    assert client.get("/api/buybacks", headers=auth_headers(admin_user)).json()[0]["total_resale"] == 2000


def test_deleting_the_finance_sale_clears_the_price(client, admin_user):
    data = _create(client, admin_user)
    txn = _sell_via_finance(client, admin_user, data["items"][0]["inventory_item_id"], 2000)
    client.delete(f"/api/finance/transactions/{txn['id']}", headers=auth_headers(admin_user))
    laptop = _get(client, admin_user, data["id"])["items"][0]
    assert (laptop["selling_price"], laptop["sold"], laptop["expected_price"]) == (None, False, 1500)


def test_quotation_holds_then_sells_the_unit(client, admin_user):
    h = auth_headers(admin_user)
    data = _create(client, admin_user)
    stock_id = data["items"][0]["inventory_item_id"]
    qid = _quotation_for(client, admin_user, stock_id, 1800)
    r = client.patch(f"/api/quotations/{qid}/confirm", headers=h)
    assert r.status_code == 200, r.text
    laptop = _get(client, admin_user, data["id"])["items"][0]
    assert (laptop["selling_price"], laptop["sold"], laptop["locked"]) == (None, False, True)  # held, not sold

    r = client.patch(f"/api/quotations/{qid}/deliver", headers=h)
    assert r.status_code == 200, r.text
    laptop = _get(client, admin_user, data["id"])["items"][0]
    assert (laptop["selling_price"], laptop["sold"], laptop["locked"], laptop["expected_price"]) == (1800, True, True, 1500)
    assert client.get("/api/buybacks", headers=h).json()[0]["total_resale"] == 1800


def test_sold_line_cannot_be_changed_or_dropped(client, admin_user, db_session):
    data = _create(client, admin_user)
    laptop, ram = data["items"]
    _sell_via_finance(client, admin_user, laptop["inventory_item_id"], 2000)

    r = _put(client, admin_user, data["id"], title="Doi ten", items=[
        _line(laptop, name="Doi ten", purchase_price=1, expected_price=1, serial_number="X"),
        _line(ram, expected_price=333),
    ])
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "Doi ten"
    sold, other = r.json()["items"]
    assert (sold["name"], sold["purchase_price"], sold["serial_number"], sold["selling_price"]) == ("Laptop cu", 1000, "SN1", 2000)
    assert other["expected_price"] == 333
    stock = _stock(db_session)["Laptop cu"]
    assert (stock.purchase_price, stock.selling_price, stock.status) == (1000, 2000, InventoryStatus.sold)

    r = _put(client, admin_user, data["id"], title="Mat dong", items=[_line(ram)])
    assert (r.status_code, r.json()["detail"]) == (400, "err_buyback_line_locked")
    fresh = _get(client, admin_user, data["id"])
    assert fresh["title"] == "Doi ten"
    assert len(fresh["items"]) == 2


def test_held_line_cannot_be_dropped(client, admin_user, db_session):
    h = auth_headers(admin_user)
    data = _create(client, admin_user)
    laptop, ram = data["items"]
    qid = _quotation_for(client, admin_user, laptop["inventory_item_id"], 1800)
    client.patch(f"/api/quotations/{qid}/confirm", headers=h)
    r = _put(client, admin_user, data["id"], items=[_line(ram)])
    assert (r.status_code, r.json()["detail"]) == (400, "err_buyback_line_locked")
    assert "Laptop cu" in _stock(db_session)


# --- Kept apart from sale quotations ---

def test_buyback_is_kept_out_of_sale_quotation_endpoints(client, admin_user):
    h = auth_headers(admin_user)
    data = _create(client, admin_user)
    bid, item_id = data["id"], data["items"][0]["id"]
    assert client.get("/api/quotations?limit=0", headers=h).json()["items"] == []
    assert client.get(f"/api/quotations/{bid}", headers=h).status_code == 404
    assert client.put(f"/api/quotations/{bid}", json={"items": []}, headers=h).status_code == 404
    assert client.delete(f"/api/quotations/{bid}", headers=h).status_code == 404
    assert client.patch(f"/api/quotations/{bid}/deliver", headers=h).status_code == 400
    assert client.patch(f"/api/quotations/{bid}/confirm", headers=h).status_code == 400
    assert client.patch(f"/api/quotations/{bid}/import-trade-ins", headers=h).status_code == 404
    assert client.post(f"/api/quotations/{bid}/send-email", headers=h).status_code == 404
    pay = {"amount": 100, "date": "2026-06-18", "method": "cash"}
    assert client.post(f"/api/quotations/{bid}/payments", json=pay, headers=h).status_code == 404
    r = client.patch(f"/api/quotations/{bid}/items/{item_id}/resale", json={"resale_price": 1}, headers=h)
    assert r.status_code == 404
    assert _get(client, admin_user, bid)["items"][0]["expected_price"] == 1500


def test_sale_quotation_is_not_reachable_as_a_buyback(client, admin_user):
    h = auth_headers(admin_user)
    q = client.post("/api/quotations", json={"new_customer": {"name": "A"}, "items": []}, headers=h).json()
    assert client.get("/api/buybacks", headers=h).json() == []
    assert client.get(f"/api/buybacks/{q['id']}", headers=h).status_code == 404
    assert client.put(f"/api/buybacks/{q['id']}", json=_body(), headers=h).status_code == 404
    assert client.delete(f"/api/buybacks/{q['id']}", headers=h).status_code == 404
    assert client.get(f"/api/quotations/{q['id']}", headers=h).status_code == 200


def test_buyback_counts_in_sales_profit_only_once_sold(client, admin_user, db_session):
    from app.dashboard_service import get_yearly_sales_profit
    h = auth_headers(admin_user)
    data = _create(client, admin_user)
    series = get_yearly_sales_profit(db_session, date.today().year)
    assert all(m["revenue"] == 0 and m["cost"] == 0 for m in series)
    assert client.get("/api/customers", headers=h).json()["items"] == []

    _sell_via_finance(client, admin_user, data["items"][0]["inventory_item_id"], 2000)
    db_session.expire_all()
    june = next(m for m in get_yearly_sales_profit(db_session, 2026) if m["month"] == 6)
    assert (june["revenue"], june["cost"], june["profit"]) == (2000, 1000, 1000)


def test_roles_read_for_all_write_for_admin_and_sales(client, admin_user, sales_user, accountant_user):
    data = _create(client, sales_user)
    h = auth_headers(accountant_user)
    assert client.get("/api/buybacks", headers=h).status_code == 200
    assert client.get(f"/api/buybacks/{data['id']}", headers=h).status_code == 200
    assert client.post("/api/buybacks", json=_body(), headers=h).status_code == 403
    assert client.put(f"/api/buybacks/{data['id']}", json=_body(), headers=h).status_code == 403
    assert client.delete(f"/api/buybacks/{data['id']}", headers=h).status_code == 403
    assert client.get("/api/buybacks").status_code in (401, 403)
