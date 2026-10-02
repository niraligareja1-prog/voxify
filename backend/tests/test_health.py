"""Step 2 tests: server starts, health works, errors have one consistent shape."""


def test_health_ok(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["app"] == "Voxify"


def test_root(client):
    assert client.get("/").status_code == 200


def test_unknown_url_returns_json_404(client):
    r = client.get("/api/v1/does-not-exist")
    assert r.status_code == 404
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


def test_wrong_method_returns_405(client):
    r = client.post("/api/v1/health")
    assert r.status_code == 405
    assert r.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_security_headers_present(client):
    r = client.get("/api/v1/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_cors_allows_frontend_origin(client):
    r = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://127.0.0.1:5500",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert r.headers["access-control-allow-origin"] == "http://127.0.0.1:5500"


def test_cors_blocks_unknown_origin(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://evil.example.com"})
    assert "access-control-allow-origin" not in r.headers
