"""End-to-end backend tests for Sentinel Predictive Maintenance SaaS."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://asset-sentinel-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@predmaint.io"
DEMO_PASS = "Demo@1234"
DEMO_MACHINE = "machine-demo-001"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(session, token):
    session.headers.update({"Authorization": f"Bearer {token}"})
    return session


@pytest.fixture(scope="session")
def factory_id(auth):
    r = auth.get(f"{API}/factories")
    assert r.status_code == 200
    facs = r.json()
    assert len(facs) >= 1
    return facs[0]["id"]


# ---------- health ----------
def test_health(session):
    r = session.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------- auth ----------
def test_register_new_user(session):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": "Test@1234", "full_name": "Test User",
        "role": "factory_owner", "organization_name": f"TestOrg_{uuid.uuid4().hex[:6]}",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and len(data["token"]) > 20
    assert data["user"]["email"] == email
    assert data["user"]["role"] == "factory_owner"


def test_login_demo(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["user"]["email"] == DEMO_EMAIL


def test_login_invalid(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_token(session):
    s = requests.Session()
    r = s.get(f"{API}/auth/me")
    assert r.status_code in (401, 403)


def test_me_with_token(auth):
    r = auth.get(f"{API}/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == DEMO_EMAIL
    assert "password_hash" not in body


# ---------- factories ----------
def test_factories_list(auth, factory_id):
    assert factory_id  # implicit from fixture


# ---------- machines ----------
def test_list_machines_seeded(auth):
    r = auth.get(f"{API}/machines")
    assert r.status_code == 200
    machines = r.json()
    assert len(machines) >= 5, f"expected >=5 seeded machines, got {len(machines)}"


def test_get_demo_machine(auth):
    r = auth.get(f"{API}/machines/{DEMO_MACHINE}")
    assert r.status_code == 200, r.text
    m = r.json()
    assert "health_score" in m
    assert "status" in m
    assert "rul_days" in m
    assert m["status"] in ("healthy", "warning", "critical")


def test_create_and_delete_machine(auth, factory_id):
    name = f"TEST_Machine_{uuid.uuid4().hex[:6]}"
    r = auth.post(f"{API}/machines", json={
        "name": name, "machine_type": "pump", "factory_id": factory_id,
        "category": "production", "usage_type": "continuous",
        "maintenance_interval_days": 90,
    })
    assert r.status_code == 200, r.text
    mid = r.json()["id"]

    # verify GET
    r = auth.get(f"{API}/machines/{mid}")
    assert r.status_code == 200
    assert r.json()["name"] == name

    # delete
    r = auth.delete(f"{API}/machines/{mid}")
    assert r.status_code == 200
    assert r.json()["deleted"] == 1

    # verify gone
    r = auth.get(f"{API}/machines/{mid}")
    assert r.status_code == 404


# ---------- sensors ----------
def test_sensor_latest_after_sim(auth):
    # simulator runs every 2s; should have data already at startup
    time.sleep(3)
    r = auth.get(f"{API}/machines/{DEMO_MACHINE}/sensors/latest")
    assert r.status_code == 200, r.text
    reading = r.json()
    assert reading["machine_id"] == DEMO_MACHINE
    assert "timestamp" in reading
    assert "health_score" in reading


def test_sensor_history(auth):
    r = auth.get(f"{API}/machines/{DEMO_MACHINE}/sensors/history?limit=30")
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) >= 1


def test_sensor_ingest(auth):
    payload = {
        "machine_id": DEMO_MACHINE,
        "vibration": 9.5, "temperature": 95.0, "pressure": 7.5,
        "rpm": 1500, "current": 12.0, "voltage": 220.0, "humidity": 50.0,
        "oil_level": 80.0, "noise": 70.0, "power_consumption": 5.0,
    }
    r = auth.post(f"{API}/sensors/ingest", json=payload)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["machine_id"] == DEMO_MACHINE
    assert "health_score" in doc


# ---------- diagnostic ----------
def test_diagnostic_rule_based(auth):
    r = auth.get(f"{API}/machines/{DEMO_MACHINE}/diagnostic?ai=false")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["machine_id"] == DEMO_MACHINE
    assert "anomalies" in d
    assert "recommendations" in d
    assert "safety_instructions" in d
    assert "root_cause" in d


# ---------- dashboard ----------
def test_dashboard_overview(auth):
    r = auth.get(f"{API}/dashboard/overview")
    assert r.status_code == 200
    data = r.json()
    assert data["total_machines"] >= 5
    assert "healthy" in data and "warning" in data and "critical" in data
    assert "machines" in data and isinstance(data["machines"], list)
    assert "recent_alerts" in data


# ---------- alerts ----------
def test_alerts_list(auth):
    r = auth.get(f"{API}/alerts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_alert_acknowledge_flow(auth):
    """Try to acknowledge an alert; if none, trigger via extreme sensor ingest."""
    # try to ensure an alert exists
    for _ in range(3):
        r = auth.get(f"{API}/alerts?acknowledged=false")
        items = r.json()
        if items:
            break
        # trigger by ingest of extreme values
        auth.post(f"{API}/sensors/ingest", json={
            "machine_id": DEMO_MACHINE,
            "vibration": 25.0, "temperature": 120.0, "pressure": 12.0,
            "rpm": 4000, "current": 30.0, "voltage": 250.0, "humidity": 90.0,
            "oil_level": 10.0, "noise": 110.0, "power_consumption": 15.0,
        })
        time.sleep(3)
    r = auth.get(f"{API}/alerts?acknowledged=false")
    items = r.json()
    if not items:
        pytest.skip("No alerts present after triggering — simulator dependent")
    aid = items[0]["id"]
    r = auth.post(f"{API}/alerts/{aid}/acknowledge", json={})
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ---------- maintenance ----------
def test_maintenance_create_list_complete(auth):
    payload = {
        "machine_id": DEMO_MACHINE, "title": "TEST_Service",
        "description": "Routine check", "priority": "medium",
    }
    r = auth.post(f"{API}/maintenance", json=payload)
    assert r.status_code == 200, r.text
    tid = r.json()["id"]

    r = auth.get(f"{API}/maintenance")
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert tid in ids

    r = auth.post(f"{API}/maintenance/{tid}/complete", json={"notes": "done"})
    assert r.status_code == 200


# ---------- reports ----------
def test_reports_summary(auth):
    r = auth.get(f"{API}/reports/summary")
    assert r.status_code == 200
    body = r.json()
    assert "alerts_by_day" in body
    assert "energy_by_machine" in body
    assert "downtime_estimate_hr" in body
    assert isinstance(body["energy_by_machine"], list)
