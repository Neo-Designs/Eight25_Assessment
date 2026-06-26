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


    @patch("app.main.analyzer")
    @patch("app.main.scraper")
    def test_audit_start_success(self, mock_scraper, mock_analyzer, client, db_session):
        scraped = ScrapedPageData(
            url="https://example.com",
            meta_title="Example",
            meta_description="Desc",
            word_count=500,
            cta_count=3,
            headings=HeadingMetrics(h1_count=1, h2_count=2, h3_count=3, headings_list=[]),
            links=LinkMetrics(total_links=10, internal_links=7, external_links=3, ratio_internal_external=2.33),
            images=ImageMetrics(total_images=5, images_with_alt=4, images_without_alt=1, alt_text_coverage_pct=80.0),
        )
        audit_output = AIAuditOutput(
            overall_seo_health_score=75,
            summary="Good site",
            findings=[{
                "category": "SEO structure",
                "observation": "obs",
                "impact": "imp",
                "grounding": [{"metric_name": "m", "metric_value": "v"}]
            }],
            recommendations=[
                {"priority": i, "title": f"Rec {i}", "details": "d", "expected_outcome": "e",
                 "confidence_score": 0.8, "grounding": [{"metric_name": "m", "metric_value": "v"}]}
                for i in range(1, 4)
            ]
        )
        mock_scraper.scrape = AsyncMock(return_value=scraped)
        mock_analyzer.analyze = AsyncMock(return_value=(audit_output, "sys prompt", "user prompt"))

        response = client.post("/api/audit/start", json={"url": "https://example.com"})
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://example.com"
        assert "audit_id" in data
        assert data["message"].startswith("Audit completed")

    @patch("app.main.analyzer")
    @patch("app.main.scraper")
    def test_audit_start_with_weights(self, mock_scraper, mock_analyzer, client, db_session):
        scraped = ScrapedPageData(
            url="https://example.com",
            meta_title="Example",
            meta_description="Desc",
            word_count=500,
            cta_count=3,
            headings=HeadingMetrics(h1_count=1, h2_count=2, h3_count=3, headings_list=[]),
            links=LinkMetrics(total_links=10, internal_links=7, external_links=3, ratio_internal_external=2.33),
            images=ImageMetrics(total_images=5, images_with_alt=4, images_without_alt=1, alt_text_coverage_pct=80.0),
        )
        audit_output = AIAuditOutput(
            overall_seo_health_score=80,
            summary="Good",
            findings=[{
                "category": "SEO structure",
                "observation": "obs",
                "impact": "imp",
                "grounding": [{"metric_name": "m", "metric_value": "v"}]
            }],
            recommendations=[
                {"priority": i, "title": f"Rec {i}", "details": "d", "expected_outcome": "e",
                 "confidence_score": 0.8, "grounding": [{"metric_name": "m", "metric_value": "v"}]}
                for i in range(1, 4)
            ]
        )
        mock_scraper.scrape = AsyncMock(return_value=scraped)
        mock_analyzer.analyze = AsyncMock(return_value=(audit_output, "sys", "usr"))

        response = client.post("/api/audit/start", json={
            "url": "https://example.com",
            "weights": {"SEO structure": 0.5, "Content depth": 0.5}
        })
        assert response.status_code == 200

    @patch("app.main.scraper")
    def test_audit_start_scraper_exception(self, mock_scraper, client):
        mock_scraper.scrape = AsyncMock(side_effect=RuntimeError("Browser crashed"))

        response = client.post("/api/audit/start", json={"url": "https://example.com"})
        assert response.status_code == 500
        assert "Audit failed" in response.json()["detail"]


class TestAuditResultsCacheAndFallback:
    """Tests for cache hit and JSON parse failure in /api/audit/{id}/results."""

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

    def test_results_from_cache(self, client, db_session):
        from app.database import log_scan_history
        from app.main import _audit_cache

        scraped = ScrapedPageData(
            url="https://cached.com",
            meta_title="Cached",
            meta_description="Cached desc",
            word_count=300,
            cta_count=2,
            headings=HeadingMetrics(h1_count=1, h2_count=1, h3_count=0, headings_list=[]),
            links=LinkMetrics(total_links=5, internal_links=3, external_links=2, ratio_internal_external=1.5),
            images=ImageMetrics(total_images=2, images_with_alt=2, images_without_alt=0, alt_text_coverage_pct=100.0),
        )
        audit_output = AIAuditOutput(
            overall_seo_health_score=85,
            summary="Excellent",
            findings=[{
                "category": "SEO structure",
                "observation": "obs",
                "impact": "imp",
                "grounding": [{"metric_name": "m", "metric_value": "v"}]
            }],
            recommendations=[
                {"priority": i, "title": f"Rec {i}", "details": "d", "expected_outcome": "e",
                 "confidence_score": 0.9, "grounding": [{"metric_name": "m", "metric_value": "v"}]}
                for i in range(1, 4)
            ]
        )

        entry = log_scan_history(
            db=db_session,
            url="https://cached.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
            seo_score=85,
        )

        # Populate the in-memory cache
        _audit_cache[entry.id] = {
            "scraped_data": scraped,
            "audit_output": audit_output,
        }

        response = client.get(f"/api/audit/{entry.id}/results")
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://cached.com"
        assert data["seo_score"] == 85
        assert data["scraped_data"]["word_count"] == 300
        assert data["audit_output"]["overall_seo_health_score"] == 85

        # Clean up cache
        del _audit_cache[entry.id]

    def test_results_with_invalid_json_returns_null_fields(self, client, db_session):
        from app.database import log_scan_history

        entry = log_scan_history(
            db=db_session,
            url="https://broken.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="not valid json {{{",
            audit_findings="also not valid",
            seo_score=50,
        )

        response = client.get(f"/api/audit/{entry.id}/results")
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://broken.com"
        assert data["scraped_data"] is None
        assert data["audit_output"] is None


class TestDriftEndpoint:
    """Tests for the /api/drift endpoint."""

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

    @patch("app.main.scraper")
    def test_drift_success(self, mock_scraper, client):
        primary_data = ScrapedPageData(
            url="https://mysite.com",
            meta_title="My Site",
            meta_description="Primary",
            word_count=800,
            cta_count=5,
            headings=HeadingMetrics(h1_count=1, h2_count=3, h3_count=2, headings_list=[]),
            links=LinkMetrics(total_links=15, internal_links=10, external_links=5, ratio_internal_external=2.0),
            images=ImageMetrics(total_images=4, images_with_alt=4, images_without_alt=0, alt_text_coverage_pct=100.0),
        )
        competitor_data = ScrapedPageData(
            url="https://competitor.com",
            meta_title="Competitor",
            meta_description="Competitor",
            word_count=1200,
            cta_count=8,
            headings=HeadingMetrics(h1_count=1, h2_count=4, h3_count=3, headings_list=[]),
            links=LinkMetrics(total_links=20, internal_links=15, external_links=5, ratio_internal_external=3.0),
            images=ImageMetrics(total_images=6, images_with_alt=5, images_without_alt=1, alt_text_coverage_pct=83.3),
        )

        async def mock_scrape(url):
            if "mysite" in url:
                return primary_data
            return competitor_data

        mock_scraper.scrape = AsyncMock(side_effect=mock_scrape)

        response = client.post("/api/drift", json={
            "url": "https://mysite.com",
            "competitor_url": "https://competitor.com"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["primary_data"]["url"] == "https://mysite.com"
        assert data["competitor_data"]["url"] == "https://competitor.com"
        assert data["primary_data"]["word_count"] == 800
        assert data["competitor_data"]["word_count"] == 1200

    @patch("app.main.scraper")
    def test_drift_scraper_exception(self, mock_scraper, client):
        mock_scraper.scrape = AsyncMock(side_effect=RuntimeError("Network error"))

        response = client.post("/api/drift", json={
            "url": "https://mysite.com",
            "competitor_url": "https://competitor.com"
        })
        assert response.status_code == 500
        assert "Drift analysis failed" in response.json()["detail"]


class TestChatEndpoint:
    """Tests for the /api/chat endpoint."""

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

    def test_chat_log_not_found(self, client):
        response = client.post("/api/chat", json={
            "log_id": 9999,
            "message": "Tell me about the findings",
            "history": []
        })
        assert response.status_code == 404

    @patch("app.main.ai_engine")
    def test_chat_success(self, mock_ai_engine, client, db_session):
        from app.database import log_scan_history

        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot=json.dumps({"url": "https://example.com", "word_count": 500}),
            audit_findings=json.dumps({"overall_seo_health_score": 75, "summary": "Good"}),
            seo_score=75,
        )

        mock_ai_engine.run_chat = AsyncMock(return_value="The SEO score is 75 because...")

        response = client.post("/api/chat", json={
            "log_id": entry.id,
            "message": "Why is the score 75?",
            "history": []
        })
        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "The SEO score is 75 because..."

    @patch("app.main.ai_engine")
    def test_chat_with_history(self, mock_ai_engine, client, db_session):
        from app.database import log_scan_history

        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot=json.dumps({"url": "https://example.com"}),
            audit_findings=json.dumps({"summary": "OK"}),
            seo_score=60,
        )

        mock_ai_engine.run_chat = AsyncMock(return_value="Here's more detail...")

        response = client.post("/api/chat", json={
            "log_id": entry.id,
            "message": "Tell me more",
            "history": [
                {"role": "user", "content": "What's the score?"},
                {"role": "assistant", "content": "The score is 60."}
            ]
        })
        assert response.status_code == 200
        assert response.json()["response"] == "Here's more detail..."

    @patch("app.main.ai_engine")
    def test_chat_with_invalid_stored_json(self, mock_ai_engine, client, db_session):
        from app.database import log_scan_history

        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="not-json",
            audit_findings="also-not-json",
            seo_score=50,
        )

        mock_ai_engine.run_chat = AsyncMock(return_value="I can help with that")

        response = client.post("/api/chat", json={
            "log_id": entry.id,
            "message": "Help me",
            "history": []
        })
        assert response.status_code == 200
        # Should still work, using fallback dicts
        assert response.json()["response"] == "I can help with that"

    @patch("app.main.ai_engine")
    def test_chat_engine_exception(self, mock_ai_engine, client, db_session):
        from app.database import log_scan_history

        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
            seo_score=50,
        )

        mock_ai_engine.run_chat = AsyncMock(side_effect=RuntimeError("API down"))

        response = client.post("/api/chat", json={
            "log_id": entry.id,
            "message": "question",
            "history": []
        })
        assert response.status_code == 500
        assert "Chat reasoning failed" in response.json()["detail"]
