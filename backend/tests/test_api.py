"""API tests for the Kawayan Atlas backend."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["calculator_enabled"] is False


# --- Species ---


def test_list_species(client):
    r = client.get("/api/species")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    # sorted alphabetically by local name
    names = [s["name_local"] for s in data]
    assert names == sorted(names)


def test_filter_species_by_role(client):
    r = client.get("/api/species", params={"role": "truss"})
    ids = {s["id"] for s in r.json()}
    assert ids == {"kawayan-tinik", "giant-bamboo"}


def test_search_species(client):
    r = client.get("/api/species", params={"q": "blumeana"})
    data = r.json()
    assert len(data) == 1
    assert data[0]["id"] == "kawayan-tinik"


def test_species_detail_and_404(client):
    r = client.get("/api/species/buho")
    assert r.status_code == 200
    assert r.json()["name_scientific"] == "Schizostachyum lumampao"

    assert client.get("/api/species/does-not-exist").status_code == 404


def test_species_content_is_verified(client):
    """Guards the content-verification pass: no leftover placeholders, and every
    species carries at least one source."""
    for s in client.get("/api/species").json():
        assert s["sources"], f"{s['id']} has no sources"
        assert "[PLACEHOLDER]" not in s["density"]
        assert "[PLACEHOLDER]" not in s["culm_diam_range"]


# --- Joints ---


def test_list_joints(client):
    r = client.get("/api/joints")
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_filter_joints_by_species(client):
    r = client.get("/api/joints", params={"species_id": "buho"})
    # Buho only appears on the traditional lashing joint in the seed set.
    ids = {j["id"] for j in r.json()}
    assert "lashing-tie" in ids
    assert "bolted-mortar-plug" not in ids


def test_joint_detail_and_404(client):
    assert client.get("/api/joints/bolted").status_code == 200
    assert client.get("/api/joints/nope").status_code == 404


# --- Templates ---


def test_list_and_filter_templates(client):
    assert len(client.get("/api/templates").json()) == 4
    dwellings = client.get("/api/templates", params={"category": "dwelling"}).json()
    assert all(t["category"] == "dwelling" for t in dwellings)
    assert len(dwellings) >= 1


def test_template_detail_and_404(client):
    r = client.get("/api/templates/event-pavilion")
    assert r.status_code == 200
    assert r.json()["components"]
    assert client.get("/api/templates/nope").status_code == 404


# --- Designs (anonymous save/share) ---


def test_design_create_and_read_roundtrip(client):
    payload = {
        "based_on_template_id": "bahay-kubo-traditional",
        "components": [{"type": "frame", "species_id": "kawayan-tinik"}],
        "params": {"roof": "hip", "bays": 2, "width": 3.6},
    }
    created = client.post("/api/designs", json=payload)
    assert created.status_code == 201
    body = created.json()
    design_id = body["id"]
    # The server stamps the template's current version (authoritative), not the client.
    assert body["based_on_template_version"] == "1"

    fetched = client.get(f"/api/designs/{design_id}")
    assert fetched.status_code == 200
    assert fetched.json()["params"]["roof"] == "hip"

    assert client.get("/api/designs/missing").status_code == 404


def test_design_version_null_without_template(client):
    r = client.post("/api/designs", json={"params": {"bays": 1}})
    assert r.status_code == 201
    assert r.json()["based_on_template_version"] is None


def test_design_params_are_validated(client):
    # bays out of range and an invalid roof value are rejected (422).
    assert client.post("/api/designs", json={"params": {"bays": 99}}).status_code == 422
    assert (
        client.post("/api/designs", json={"params": {"roof": "dome"}}).status_code == 422
    )
    assert (
        client.post("/api/designs", json={"params": {"width": -5}}).status_code == 422
    )


# --- Calculator (gated) ---


def test_graph_save_and_load_roundtrip(client):
    graph = {"nodes": [{"id": "a", "type": "graphNode", "data": {"type": "arc", "params": {}}}], "edges": []}
    created = client.post("/api/graphs", json={"data": graph})
    assert created.status_code == 201
    gid = created.json()["id"]

    fetched = client.get(f"/api/graphs/{gid}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["nodes"][0]["id"] == "a"

    assert client.get("/api/graphs/missing").status_code == 404


def test_graph_rejects_malformed(client):
    # missing nodes/edges arrays
    assert client.post("/api/graphs", json={"data": {"foo": 1}}).status_code == 422


# --- Accounts (Release 2) ---


def _register(client, email, password="hunter2pass"):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def test_register_login_and_me(client):
    r = _register(client, "Ana@Example.com")
    assert r.status_code == 201
    body = r.json()
    token = body["access_token"]
    assert body["user"]["email"] == "ana@example.com"  # normalized to lowercase
    assert "password" not in body["user"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"

    login = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "hunter2pass"})
    assert login.status_code == 200
    assert login.json()["user"]["id"] == body["user"]["id"]


def test_register_rejects_duplicate_and_bad_input(client):
    _register(client, "dup@example.com")
    assert _register(client, "dup@example.com").status_code == 409
    assert _register(client, "not-an-email").status_code == 422  # invalid email
    assert client.post("/api/auth/register", json={"email": "x@y.com", "password": "short"}).status_code == 422


def test_login_wrong_password_is_401(client):
    _register(client, "carl@example.com")
    r = client.post("/api/auth/login", json={"email": "carl@example.com", "password": "wrongwrong"})
    assert r.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_owned_graph_appears_in_mine_and_stays_shareable(client):
    token = _register(client, "owner@example.com").json()["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    graph = {"nodes": [{"id": "a", "type": "graphNode", "data": {"type": "arc", "params": {}}}], "edges": []}

    created = client.post("/api/graphs", json={"data": graph, "title": "My vault"}, headers=auth)
    assert created.status_code == 201
    assert created.json()["title"] == "My vault"
    gid = created.json()["id"]

    mine = client.get("/api/graphs/mine", headers=auth)
    assert mine.status_code == 200
    assert [g["id"] for g in mine.json()] == [gid]
    assert mine.json()[0]["title"] == "My vault"

    # The saved graph is still fetchable by anyone with the link (anonymous share).
    assert client.get(f"/api/graphs/{gid}").status_code == 200


def test_mine_requires_auth_and_is_isolated_per_user(client):
    assert client.get("/api/graphs/mine").status_code == 401

    tok_a = _register(client, "a1@example.com").json()["access_token"]
    tok_b = _register(client, "b1@example.com").json()["access_token"]
    graph = {"nodes": [], "edges": []}
    client.post("/api/graphs", json={"data": graph}, headers={"Authorization": f"Bearer {tok_a}"})

    # B sees none of A's graphs.
    assert client.get("/api/graphs/mine", headers={"Authorization": f"Bearer {tok_b}"}).json() == []


def test_anonymous_graph_has_no_owner(client):
    created = client.post("/api/graphs", json={"data": {"nodes": [], "edges": []}})
    assert created.status_code == 201
    assert created.json()["owner_id"] is None


def test_calculator_is_gated_off(client):
    r = client.post(
        "/api/calculator/single-member",
        json={
            "species_id": "kawayan-tinik",
            "diameter_mm": 100,
            "wall_thickness_mm": 15,
            "span_m": 4,
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["enabled"] is False
    assert "not a stamped" in body["disclaimer"].lower()
    # No structural numbers leak while gated.
    assert body["axial_capacity_kn"] is None
