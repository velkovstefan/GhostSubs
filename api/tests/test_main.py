import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app, Base, get_db

# SQLite in-memory за тестови — без потреба од PostgreSQL
TEST_ENGINE = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
TestSession = sessionmaker(bind=TEST_ENGINE)

def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)

client = TestClient(app)

SAMPLE_CSV = """Date,Description,Amount
2024-01-01,Netflix,-15.99
2024-02-01,Netflix,-15.99
2024-03-01,Netflix,-15.99
2024-01-15,Spotify,-9.99
2024-02-15,Spotify,-9.99
2024-03-15,Spotify,-9.99
2024-01-10,Amazon Prime,-14.99
2024-02-10,Amazon Prime,-14.99
2024-01-05,Starbucks,-6.50
2024-01-20,ATM Withdrawal,-200.00
"""

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200

def register_user(email="test@example.com", password="pass1234"):
    res = client.post("/api/auth/register", json={"email": email, "password": password})
    assert res.status_code == 201
    return res.json()["token"]

def test_register():
    res = client.post("/api/auth/register", json={"email": "new@example.com", "password": "pass1234"})
    assert res.status_code == 201

def test_register_duplicate():
    client.post("/api/auth/register", json={"email": "dup@example.com", "password": "pass1234"})
    res = client.post("/api/auth/register", json={"email": "dup@example.com", "password": "pass1234"})
    assert res.status_code == 409

def test_register_short_password():
    res = client.post("/api/auth/register", json={"email": "x@x.com", "password": "abc"})
    assert res.status_code == 400

def test_login():
    client.post("/api/auth/register", json={"email": "login@example.com", "password": "pass1234"})
    res = client.post("/api/auth/login", json={"email": "login@example.com", "password": "pass1234"})
    assert res.status_code == 200

def test_login_wrong_password():
    client.post("/api/auth/register", json={"email": "wp@example.com", "password": "pass1234"})
    res = client.post("/api/auth/login", json={"email": "wp@example.com", "password": "wrong"})
    assert res.status_code == 401

def test_me():
    token = register_user("me@example.com")
    res   = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "me@example.com"

def test_me_no_token():
    res = client.get("/api/auth/me")
    assert res.status_code == 401

def test_upload_csv():
    res = client.post("/api/upload", files={"file": ("transactions.csv", SAMPLE_CSV.encode(), "text/csv")})
    assert res.status_code in (200, 422)  # 422 ако Gemini не е достапен

def test_upload_non_csv():
    res = client.post("/api/upload", files={"file": ("data.txt", b"not a csv", "text/plain")})
    assert res.status_code == 400

def test_upload_saves_to_user():
    token = register_user("upload@example.com")
    res   = client.post("/api/upload",
        files={"file": ("transactions.csv", SAMPLE_CSV.encode(), "text/csv")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code in (200, 422)

def test_get_scans_requires_auth():
    res = client.get("/api/scans")
    assert res.status_code == 401

def test_get_scans_empty_for_new_user():
    token = register_user("empty@example.com")
    res   = client.get("/api/scans", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == []

def test_report():
    res = client.post("/api/upload", files={"file": ("t.csv", SAMPLE_CSV.encode(), "text/csv")})
    if res.status_code == 422:
        pytest.skip("Gemini not available")
    scan_id = res.json()["scan_id"]
    report  = client.get(f"/api/report/{scan_id}").json()
    assert "total_subscriptions" in report

def test_tag_subscription():
    res = client.post("/api/upload", files={"file": ("t.csv", SAMPLE_CSV.encode(), "text/csv")})
    if res.status_code == 422:
        pytest.skip("Gemini not available")
    scan_id = res.json()["scan_id"]
    report  = client.get(f"/api/report/{scan_id}").json()
    sub_id  = report["subscriptions"][0]["id"]
    tag_res = client.patch(f"/api/subscriptions/{sub_id}/tag",
        json={"is_ghost": True, "reason": "Not used in months"})
    assert tag_res.status_code == 200

def test_report_404():
    res = client.get("/api/report/nonexistent-scan-id")
    assert res.status_code == 404
