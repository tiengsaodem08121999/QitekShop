"""Tests for payment QR CRUD endpoints."""

from conftest import auth_headers


def test_list_payment_qrs_requires_auth(client):
    assert client.get("/api/payment-qrs").status_code == 401


def test_payment_qr_crud(client, admin_user):
    headers = auth_headers(admin_user)

    r = client.get("/api/payment-qrs", headers=headers)
    assert r.status_code == 200
    assert r.json() == []

    created = client.post(
        "/api/payment-qrs",
        json={"name": "VCB", "image": "data:image/png;base64,abc", "note": "1234567890"},
        headers=headers,
    )
    assert created.status_code == 201
    data = created.json()
    assert data["name"] == "VCB"
    assert data["note"] == "1234567890"

    updated = client.put(
        f"/api/payment-qrs/{data['id']}",
        json={"name": "Techcombank", "image": "data:image/png;base64,xyz", "note": None},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Techcombank"

    listed = client.get("/api/payment-qrs", headers=headers)
    assert len(listed.json()) == 1

    deleted = client.delete(f"/api/payment-qrs/{data['id']}", headers=headers)
    assert deleted.status_code == 204

    assert client.get("/api/payment-qrs", headers=headers).json() == []


def test_payment_qr_requires_admin(client, sales_user):
    headers = auth_headers(sales_user)
    r = client.post(
        "/api/payment-qrs",
        json={"name": "VCB", "image": "data:image/png;base64,abc"},
        headers=headers,
    )
    assert r.status_code == 403
