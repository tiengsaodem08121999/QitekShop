from conftest import auth_headers


def _post_quotation(client, user, items, name):
    payload = {"new_customer": {"name": name}, "items": items}
    r = client.post("/api/quotations", json=payload, headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()


def _get_customer_by_name(client, user, name):
    r = client.get("/api/customers?limit=100", headers=auth_headers(user))
    assert r.status_code == 200, r.text
    return next(c for c in r.json()["items"] if c["name"] == name)


def test_profit_margin_ignores_trade_in(client, sales_user):
    _post_quotation(
        client,
        sales_user,
        [
            {"is_trade_in": False, "name": "Ram", "purchase_price": 800_000, "selling_price": 1_000_000},
            {"is_trade_in": True, "name": "Old Ram", "purchase_price": 600_000},
        ],
        name="Acme",
    )
    c = _get_customer_by_name(client, sales_user, "Acme")
    assert c["total_purchased"] == 1_000_000
    assert c["profit_margin_pct"] == 25  # (1000-800)/800*100, trade-in excluded


def test_profit_margin_negative_when_sold_at_loss(client, sales_user):
    _post_quotation(
        client,
        sales_user,
        [{"is_trade_in": False, "name": "X", "purchase_price": 1_000_000, "selling_price": 800_000}],
        name="LossCo",
    )
    c = _get_customer_by_name(client, sales_user, "LossCo")
    assert c["profit_margin_pct"] == -20


def test_profit_margin_null_when_no_purchases(client, sales_user):
    r = client.post("/api/customers", json={"name": "NoBuy"}, headers=auth_headers(sales_user))
    assert r.status_code == 201, r.text
    c = _get_customer_by_name(client, sales_user, "NoBuy")
    assert c["total_purchased"] == 0
    assert c["profit_margin_pct"] is None
