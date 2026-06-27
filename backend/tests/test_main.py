"""Unit tests for app/main.py - FastAPI routes and URL validation."""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.db_models import Base, ScanHistory, User
from app.models.schemas import ScrapedPageData, HeadingMetrics, LinkMetrics, ImageMetrics, AIAuditOutput
from app.main import _require_valid_url, app
from app.database import get_db
from fastapi import HTTPException


class TestRequireValidUrl:
    """Tests for the _require_valid_url utility function."""

    def test_valid_http_url(self):
        result = _require_valid_url("http://example.com")
        assert result == "http://example.com"

    def test_valid_https_url(self):
        result = _require_valid_url("https://example.com")
        assert result == "https://example.com"

    def test_strips_whitespace(self):
        result = _require_valid_url("  https://example.com  ")
        assert result == "https://example.com"

    def test_invalid_scheme_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            _require_valid_url("ftp://example.com")
        assert exc_info.value.status_code == 400

    def test_no_scheme_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            _require_valid_url("example.com")
        assert exc_info.value.status_code == 400

    def test_empty_string_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            _require_valid_url("")
        assert exc_info.value.status_code == 400

    def test_javascript_scheme_raises_400(self):
        with pytest.raises(HTTPException) as exc_info:
            _require_valid_url("javascript:alert(1)")
        assert exc_info.value.status_code == 400


class TestHealthEndpoint:
    """Tests for the /api/health endpoint."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_health_returns_200(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200

    def test_health_contains_status(self, client):
        response = client.get("/api/health")
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_contains_provider(self, client):
        response = client.get("/api/health")
        data = response.json()
        assert "provider" in data

    def test_health_contains_model(self, client):
        response = client.get("/api/health")
        data = response.json()
        assert "model" in data


class TestHistoryEndpoint:
    """Tests for the /api/history endpoint."""

    @pytest.fixture
    def db_session(self):
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)

    @pytest.fixture
    def client(self, db_session):
        def override_get_db():
            try:
                yield db_session
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

    def test_history_empty(self, client):
        response = client.get("/api/history")
        assert response.status_code == 200
        assert response.json() == []

    def test_history_returns_records(self, client, db_session):
        from app.database import log_scan_history
        log_scan_history(
            db=db_session,
            url="https://test.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
            seo_score=80,
        )
        response = client.get("/api/history")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["url"] == "https://test.com"
        assert data[0]["seo_score"] == 80

    def test_history_respects_limit(self, client, db_session):
        from app.database import log_scan_history
        for i in range(5):
            log_scan_history(
                db=db_session,
                url=f"https://site{i}.com",
                system_prompt="sp",
                user_prompt="up",
                scraped_data_snapshot="{}",
                audit_findings="{}",
            )
        response = client.get("/api/history?limit=2")
        assert response.status_code == 200
        assert len(response.json()) == 2


class TestAuditResultsEndpoint:
    """Tests for the /api/audit/{id}/results endpoint."""

    @pytest.fixture
    def db_session(self):
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)

    @pytest.fixture
    def client(self, db_session):
        def override_get_db():
            try:
                yield db_session
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

    def test_results_not_found(self, client):
        response = client.get("/api/audit/9999/results")
        assert response.status_code == 404

    def test_results_found(self, client, db_session):
        from app.database import log_scan_history

        scraped_data = {
            "url": "https://example.com",
            "meta_title": "Example",
            "meta_description": "Desc",
            "word_count": 500,
            "cta_count": 3,
            "headings": {"h1_count": 1, "h2_count": 2, "h3_count": 3, "headings_list": []},
            "links": {"total_links": 10, "internal_links": 7, "external_links": 3, "ratio_internal_external": 2.33},
            "images": {"total_images": 5, "images_with_alt": 4, "images_without_alt": 1, "alt_text_coverage_pct": 80.0},
        }
        audit_output = {
            "overall_seo_health_score": 75,
            "summary": "Good",
            "findings": [{
                "category": "SEO structure",
                "observation": "obs",
                "impact": "imp",
                "grounding": [{"metric_name": "m", "metric_value": "v"}]
            }],
            "recommendations": [
                {
                    "priority": i,
                    "title": f"Rec {i}",
                    "details": "d",
                    "expected_outcome": "e",
                    "confidence_score": 0.8,
                    "grounding": [{"metric_name": "m", "metric_value": "v"}]
                }
                for i in range(1, 4)
            ]
        }

        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot=json.dumps(scraped_data),
            audit_findings=json.dumps(audit_output),
            seo_score=75,
        )

        response = client.get(f"/api/audit/{entry.id}/results")
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://example.com"
        assert data["seo_score"] == 75


class TestAuditLogsEndpoint:
    """Tests for the /api/audit/{id}/logs endpoint."""

    @pytest.fixture
    def db_session(self):
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)

    @pytest.fixture
    def client(self, db_session):
        def override_get_db():
            try:
                yield db_session
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

    def test_logs_not_found(self, client):
        response = client.get("/api/audit/9999/logs")
        assert response.status_code == 404

    def test_logs_found(self, client, db_session):
        from app.database import log_scan_history
        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="System prompt here",
            user_prompt="User prompt here",
            scraped_data_snapshot="{}",
            audit_findings="{}",
            seo_score=80,
        )
        response = client.get(f"/api/audit/{entry.id}/logs")
        assert response.status_code == 200
        data = response.json()
        assert data["system_prompt"] == "System prompt here"
        assert data["user_prompt"] == "User prompt here"


class TestAuditStartEndpoint:
    """Tests for the /api/audit/start endpoint."""

    @pytest.fixture
    def db_session(self):
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()
            Base.metadata.drop_all(bind=engine)

    @pytest.fixture
    def client(self, db_session):
        def override_get_db():
            try:
                yield db_session
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

    def test_audit_start_invalid_url(self, client):
        response = client.post("/api/audit/start", json={"url": "not-a-url"})
        assert response.status_code == 400

    def test_audit_start_empty_url(self, client):
        response = client.post("/api/audit/start", json={"url": ""})
        assert response.status_code == 400

    @patch("app.audit.audit_pipeline")
    def test_audit_start_success(self, mock_pipeline, client, db_session):
        from app.database import log_scan_history
        from app.pipeline import AuditPipelineResult

        scraped = ScrapedPageData(
            url="https://example.com",
            meta_title="Example",
            meta_description="Desc",
            word_count=500,
            cta_count=2,
            headings=HeadingMetrics(h1_count=1, h2_count=2, h3_count=0, headings_list=[]),
            links=LinkMetrics(total_links=5, internal_links=3, external_links=2, ratio_internal_external=1.5),
            images=ImageMetrics(total_images=2, images_with_alt=2, images_without_alt=0, alt_text_coverage_pct=100.0),
        )
        audit_output = AIAuditOutput(
            overall_seo_health_score=80,
            summary="Good page",
            findings=[{
                "category": "SEO structure",
                "observation": "Single H1",
                "impact": "Positive",
                "grounding": [{"metric_name": "h1_count", "metric_value": "1"}],
            }],
            recommendations=[
                {
                    "priority": i,
                    "title": f"Rec {i}",
                    "details": "Do this",
                    "expected_outcome": "Better SEO",
                    "confidence_score": 0.9,
                    "grounding": [{"metric_name": "word_count", "metric_value": "500"}],
                }
                for i in range(1, 4)
            ],
        )
        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot=scraped.model_dump_json(),
            audit_findings=audit_output.model_dump_json(),
            seo_score=80,
        )
        mock_pipeline.run = AsyncMock(
            return_value=AuditPipelineResult(
                log_entry=entry,
                scraped_data=scraped,
                audit_output=audit_output,
                system_prompt="sp",
                user_prompt="up",
            )
        )

        response = client.post("/api/audit/start", json={"url": "https://example.com"})
        assert response.status_code == 200
        data = response.json()
        assert data["audit_id"] == entry.id
        assert data["url"] == "https://example.com"


class TestDriftEndpoint:
    """Tests for the /api/drift endpoint."""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    def test_drift_invalid_primary_url(self, client):
        response = client.post("/api/drift", json={
            "url": "not-valid",
            "competitor_url": "https://competitor.com"
        })
        assert response.status_code == 400

    def test_drift_invalid_competitor_url(self, client):
        response = client.post("/api/drift", json={
            "url": "https://mysite.com",
            "competitor_url": "not-valid"
        })
        assert response.status_code == 400
