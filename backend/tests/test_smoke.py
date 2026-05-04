def test_health_endpoint(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_admin_fixture(admin_user):
    assert admin_user.id is not None
    assert admin_user.role.value == "admin"
