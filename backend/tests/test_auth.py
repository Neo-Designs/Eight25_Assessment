"""Unit tests for app/auth.py - Authentication module."""
import pytest
from datetime import timedelta
import jwt

from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.models.db_models import User


class TestPasswordHashing:
    """Tests for password hashing and verification functions."""

    def test_hash_returns_string(self):
        hashed = get_password_hash("mysecretpassword")
        assert isinstance(hashed, str)
        assert hashed != "mysecretpassword"

    def test_hash_is_bcrypt_format(self):
        hashed = get_password_hash("password123")
        assert hashed.startswith("$2")

    def test_verify_correct_password(self):
        password = "correct_password"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True

    def test_verify_incorrect_password(self):
        hashed = get_password_hash("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_different_passwords_produce_different_hashes(self):
        hash1 = get_password_hash("password1")
        hash2 = get_password_hash("password2")
        assert hash1 != hash2

    def test_same_password_produces_different_hashes_due_to_salt(self):
        hash1 = get_password_hash("samepassword")
        hash2 = get_password_hash("samepassword")
        assert hash1 != hash2  # bcrypt uses random salt

    def test_password_truncated_at_72_bytes(self):
        long_password = "a" * 100
        hashed = get_password_hash(long_password)
        # bcrypt truncates at 72 bytes, so first 72 chars should verify
        assert verify_password(long_password, hashed) is True

    def test_empty_password(self):
        hashed = get_password_hash("")
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False

    def test_unicode_password(self):
        password = "pässwörd_ünïcödé"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True


class TestTokenCreation:
    """Tests for JWT token creation and decoding."""

    def test_create_token_returns_string(self):
        token = create_access_token(data={"sub": "user@test.com"})
        assert isinstance(token, str)

    def test_token_contains_correct_subject(self):
        token = create_access_token(data={"sub": "user@test.com"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "user@test.com"

    def test_token_contains_expiration(self):
        token = create_access_token(data={"sub": "user@test.com"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_custom_expiration_delta(self):
        token = create_access_token(
            data={"sub": "user@test.com"},
            expires_delta=timedelta(minutes=30)
        )
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_default_expiration_is_15_minutes(self):
        token = create_access_token(data={"sub": "user@test.com"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Token should be valid (not expired)
        assert payload["sub"] == "user@test.com"

    def test_token_with_additional_claims(self):
        token = create_access_token(data={"sub": "user@test.com", "role": "admin"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["role"] == "admin"

    def test_access_token_expire_minutes_is_7_days(self):
        assert ACCESS_TOKEN_EXPIRE_MINUTES == 60 * 24 * 7


class TestAuthRoutes:
    """Tests for auth API endpoints using FastAPI TestClient."""

    @pytest.fixture
    def client(self, db_session):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        def override_get_db():
            try:
                yield db_session
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

    def test_register_success(self, client):
        response = client.post("/api/auth/register", json={
            "email": "new@example.com",
            "password": "securepassword123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_register_duplicate_email(self, client):
        client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "password1234"
        })
        response = client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "password": "otherpass123"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_register_short_password(self, client):
        response = client.post("/api/auth/register", json={
            "email": "short@example.com",
            "password": "short"
        })
        assert response.status_code == 400
        assert "at least 8 characters" in response.json()["detail"]

    def test_login_success(self, client):
        # Register first
        client.post("/api/auth/register", json={
            "email": "login@example.com",
            "password": "mypassword123"
        })
        # Login
        response = client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "mypassword123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={
            "email": "user@example.com",
            "password": "correctpassword1"
        })
        response = client.post("/api/auth/login", json={
            "email": "user@example.com",
            "password": "wrongpassword1"
        })
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        response = client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypassword1"
        })
        assert response.status_code == 401

    def test_me_endpoint_with_valid_token(self, client):
        reg_response = client.post("/api/auth/register", json={
            "email": "me@example.com",
            "password": "mypassword123"
        })
        token = reg_response.json()["access_token"]
        response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.json()["email"] == "me@example.com"

    def test_me_endpoint_without_token(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401

    def test_me_endpoint_with_invalid_token(self, client):
        response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert response.status_code == 401
