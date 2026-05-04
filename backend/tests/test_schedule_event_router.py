from conftest import auth_headers


def _payload(**overrides):
    base = {
        "title": "Pick up RAM",
        "date": "2026-05-04",
        "start_time": "18:00:00",
        "end_time": "19:00:00",
    }
    base.update(overrides)
    return base


def test_sales_user_can_create_event(client, sales_user):
    r = client.post("/api/schedule/events", json=_payload(), headers=auth_headers(sales_user))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "Pick up RAM"
    assert body["status"] == "pending"
    assert body["created_by"] == sales_user.id
    assert body["created_by_name"] == sales_user.full_name
    assert body["tags"] == []


def test_create_event_end_before_start_rejected(client, admin_user):
    r = client.post(
        "/api/schedule/events",
        json=_payload(start_time="20:00:00", end_time="18:00:00"),
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 422


def test_list_events_in_range(client, admin_user):
    client.post("/api/schedule/events", json=_payload(date="2026-05-04"), headers=auth_headers(admin_user))
    client.post("/api/schedule/events", json=_payload(date="2026-05-10"), headers=auth_headers(admin_user))
    client.post("/api/schedule/events", json=_payload(date="2026-06-01"), headers=auth_headers(admin_user))

    r = client.get(
        "/api/schedule/events?start_date=2026-05-01&end_date=2026-05-31",
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_update_event(client, admin_user):
    created = client.post("/api/schedule/events", json=_payload(), headers=auth_headers(admin_user)).json()
    r = client.put(
        f"/api/schedule/events/{created['id']}",
        json=_payload(title="Pick up SSD"),
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Pick up SSD"


def test_patch_status(client, admin_user):
    created = client.post("/api/schedule/events", json=_payload(), headers=auth_headers(admin_user)).json()
    r = client.patch(
        f"/api/schedule/events/{created['id']}/status",
        json={"status": "done"},
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "done"


def test_delete_event_soft(client, admin_user):
    created = client.post("/api/schedule/events", json=_payload(), headers=auth_headers(admin_user)).json()
    r = client.delete(f"/api/schedule/events/{created['id']}", headers=auth_headers(admin_user))
    assert r.status_code == 204

    listing = client.get(
        "/api/schedule/events?start_date=2026-05-04&end_date=2026-05-04",
        headers=auth_headers(admin_user),
    ).json()
    assert listing == []


def test_create_event_with_unknown_tag_returns_400(client, admin_user):
    r = client.post(
        "/api/schedule/events",
        json=_payload(tag_ids=[999]),
        headers=auth_headers(admin_user),
    )
    assert r.status_code == 400


def test_unauthenticated_event_list_rejected(client):
    r = client.get("/api/schedule/events?start_date=2026-05-04&end_date=2026-05-04")
    assert r.status_code in (401, 403)
