from conftest import auth_headers


def test_list_tags_empty_for_any_authenticated_user(client, sales_user):
    r = client.get("/api/schedule/tags", headers=auth_headers(sales_user))
    assert r.status_code == 200
    assert r.json() == []


def test_list_tags_unauthenticated_rejected(client):
    r = client.get("/api/schedule/tags")
    assert r.status_code in (401, 403)


def test_admin_can_create_tag(client, admin_user):
    r = client.post(
        "/api/schedule/tags",
        json={"name": "pickup", "color": "#FF5733"},
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["name"] == "pickup"
    assert body["color"] == "#FF5733"
    assert "id" in body


def test_sales_cannot_create_tag(client, sales_user):
    r = client.post(
        "/api/schedule/tags",
        json={"name": "pickup", "color": "#FF5733"},
        headers=auth_headers(sales_user),
    )
    assert r.status_code == 403


def test_create_tag_invalid_color_rejected(client, admin_user):
    r = client.post(
        "/api/schedule/tags",
        json={"name": "pickup", "color": "red"},
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 422


def test_admin_can_update_tag(client, admin_user):
    created = client.post(
        "/api/schedule/tags",
        json={"name": "pickup", "color": "#FF5733"},
        headers=auth_headers(admin_user),
    ).json()
    r = client.put(
        f"/api/schedule/tags/{created['id']}",
        json={"name": "pick-up", "color": "#000000"},
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 200
    assert r.json()["name"] == "pick-up"


def test_admin_can_delete_tag(client, admin_user):
    created = client.post(
        "/api/schedule/tags",
        json={"name": "pickup", "color": "#FF5733"},
        headers=auth_headers(admin_user),
    ).json()
    r = client.delete(
        f"/api/schedule/tags/{created['id']}",
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 204


def test_update_missing_tag_returns_404(client, admin_user):
    r = client.put(
        "/api/schedule/tags/9999",
        json={"name": "x", "color": "#000000"},
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 404
