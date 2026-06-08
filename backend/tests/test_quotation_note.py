from conftest import auth_headers


def _create(client, user, note=None):
    body = {"new_customer": {"name": "A"}, "items": [{"is_trade_in": False, "name": "X", "selling_price": 100}]}
    if note is not None:
        body["note"] = note
    return client.post("/api/quotations", json=body, headers=auth_headers(user)).json()


def test_create_quotation_with_note(client, sales_user):
    q = _create(client, sales_user, note="giao hàng tận nơi")
    assert q["note"] == "giao hàng tận nơi"


def test_create_quotation_without_note_is_null(client, sales_user):
    q = _create(client, sales_user)
    assert q["note"] is None


def test_update_quotation_sets_note(client, sales_user):
    q = _create(client, sales_user)
    items = [{"is_trade_in": False, "name": "X", "selling_price": 100}]
    r = client.put(f"/api/quotations/{q['id']}",
                   json={"items": items, "note": "ghi chú mới"},
                   headers=auth_headers(sales_user))
    assert r.status_code == 200
    assert r.json()["note"] == "ghi chú mới"
