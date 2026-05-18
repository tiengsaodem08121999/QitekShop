"""Integration tests for the PATCH resale endpoint."""
from conftest import auth_headers


def _create_quotation_with_trade_in(client, user, *, purchase_price: int = 600_000):
    """Helper: POST a quotation with one product and one trade-in, return its body."""
    payload = {
        "new_customer": {"name": "Acme"},
        "items": [
            {
                "is_trade_in": False,
                "name": "Ram 16gb",
                "condition": "2nd",
                "purchase_price": 800_000,
                "selling_price": 1_000_000,
                "warranty_count": 1,
                "warranty_unit": "week",
            },
            {
                "is_trade_in": True,
                "name": "Ram 8gb",
                "purchase_price": purchase_price,
            },
        ],
    }
    r = client.post("/api/quotations", json=payload, headers=auth_headers(user))
    assert r.status_code == 201, r.text
    return r.json()


def test_patch_resale_sets_price(client, sales_user):
    q = _create_quotation_with_trade_in(client, sales_user)
    trade_in = next(i for i in q["items"] if i["is_trade_in"])

    r = client.patch(
        f"/api/quotations/{q['id']}/items/{trade_in['id']}/resale",
        json={"resale_price": 800_000},
        headers=auth_headers(sales_user),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    updated_item = next(i for i in body["items"] if i["id"] == trade_in["id"])
    assert updated_item["resale_price"] == 800_000
    assert body["total_trade_in_resale"] == 800_000
    # Profit doesn't depend on resale (just selling - purchase = 200,000).
    # Cashflow does: 1M - (800K + 600K) + 800K - 400K(remaining) = 0.
    assert body["profit"] == 200_000
    assert body["cashflow"] == 0


def test_patch_resale_works_on_confirmed_quotation(client, sales_user):
    q = _create_quotation_with_trade_in(client, sales_user)
    trade_in = next(i for i in q["items"] if i["is_trade_in"])

    # Confirm the quotation
    r = client.patch(
        f"/api/quotations/{q['id']}/confirm",
        headers=auth_headers(sales_user),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"

    # Patch resale on the confirmed quotation
    r = client.patch(
        f"/api/quotations/{q['id']}/items/{trade_in['id']}/resale",
        json={"resale_price": 800_000},
        headers=auth_headers(sales_user),
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"


def test_patch_resale_rejects_non_trade_in(client, sales_user):
    q = _create_quotation_with_trade_in(client, sales_user)
    product = next(i for i in q["items"] if not i["is_trade_in"])

    r = client.patch(
        f"/api/quotations/{q['id']}/items/{product['id']}/resale",
        json={"resale_price": 100_000},
        headers=auth_headers(sales_user),
    )
    assert r.status_code == 400
    assert "trade-in" in r.json()["detail"].lower()


def test_patch_resale_rejects_negative(client, sales_user):
    q = _create_quotation_with_trade_in(client, sales_user)
    trade_in = next(i for i in q["items"] if i["is_trade_in"])

    r = client.patch(
        f"/api/quotations/{q['id']}/items/{trade_in['id']}/resale",
        json={"resale_price": -1},
        headers=auth_headers(sales_user),
    )
    assert r.status_code == 422   # pydantic validation error


def test_patch_resale_returns_404_for_unknown_item(client, sales_user):
    q = _create_quotation_with_trade_in(client, sales_user)

    r = client.patch(
        f"/api/quotations/{q['id']}/items/999999/resale",
        json={"resale_price": 800_000},
        headers=auth_headers(sales_user),
    )
    assert r.status_code == 404


def test_patch_resale_requires_auth(client):
    r = client.patch(
        "/api/quotations/1/items/1/resale",
        json={"resale_price": 800_000},
    )
    # No Authorization header → 401 from the dependency
    assert r.status_code == 401


def test_patch_resale_forbidden_for_accountant(client, accountant_user, sales_user):
    """Only admin and sales can mutate; accountant is read-only."""
    q = _create_quotation_with_trade_in(client, sales_user)
    trade_in = next(i for i in q["items"] if i["is_trade_in"])

    r = client.patch(
        f"/api/quotations/{q['id']}/items/{trade_in['id']}/resale",
        json={"resale_price": 800_000},
        headers=auth_headers(accountant_user),
    )
    assert r.status_code == 403
