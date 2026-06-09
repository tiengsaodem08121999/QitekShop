from conftest import auth_headers


def test_get_note_requires_auth(client):
    r = client.get("/api/note")
    assert r.status_code == 401


def test_put_note_requires_auth(client):
    r = client.put("/api/note", json={"content": "x"})
    assert r.status_code == 401


def test_get_note_returns_empty_on_fresh_db(client, sales_user):
    r = client.get("/api/note", headers=auth_headers(sales_user))
    assert r.status_code == 200
    assert r.json()["content"] is None


def test_put_then_get_returns_saved_content(client, sales_user):
    put = client.put("/api/note", json={"content": "remember this"},
                     headers=auth_headers(sales_user))
    assert put.status_code == 200
    assert put.json()["content"] == "remember this"

    get = client.get("/api/note", headers=auth_headers(sales_user))
    assert get.json()["content"] == "remember this"


def test_all_roles_can_read_and_write(client, admin_user, sales_user, accountant_user):
    for user in (admin_user, sales_user, accountant_user):
        assert client.get("/api/note", headers=auth_headers(user)).status_code == 200
        assert client.put("/api/note", json={"content": "ok"},
                          headers=auth_headers(user)).status_code == 200


def test_put_note_can_clear_content(client, sales_user):
    client.put("/api/note", json={"content": "filled"}, headers=auth_headers(sales_user))
    r = client.put("/api/note", json={"content": None}, headers=auth_headers(sales_user))
    assert r.status_code == 200
    assert r.json()["content"] is None
