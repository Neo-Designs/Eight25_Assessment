"""Unit tests for app/database.py - Database operations."""
import pytest
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import log_scan_history, get_scan_history
from app.models.db_models import ScanHistory, User


class TestLogScanHistory:
    """Tests for the log_scan_history function."""

    def test_creates_scan_record(self, db_session):
        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="System prompt text",
            user_prompt="User prompt text",
            scraped_data_snapshot='{"url": "https://example.com"}',
            audit_findings='{"score": 75}',
            seo_score=75,
        )
        assert entry.id is not None
        assert entry.url == "https://example.com"
        assert entry.seo_score == 75

    def test_stores_all_fields(self, db_session):
        entry = log_scan_history(
            db=db_session,
            url="https://test.org",
            system_prompt="sys prompt",
            user_prompt="user prompt",
            scraped_data_snapshot='{"data": "snapshot"}',
            audit_findings='{"findings": []}',
            seo_score=90,
            user_id=None,
        )
        assert entry.system_prompt == "sys prompt"
        assert entry.user_prompt == "user prompt"
        assert entry.scraped_data_snapshot == '{"data": "snapshot"}'
        assert entry.audit_findings == '{"findings": []}'

    def test_timestamp_is_set_automatically(self, db_session):
        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
        )
        assert entry.timestamp is not None
        assert isinstance(entry.timestamp, datetime)

    def test_seo_score_can_be_none(self, db_session):
        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
            seo_score=None,
        )
        assert entry.seo_score is None

    def test_user_id_association(self, db_session):
        user = User(email="dbtest@test.com", hashed_password="hashed")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        entry = log_scan_history(
            db=db_session,
            url="https://example.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
            user_id=user.id,
        )
        assert entry.user_id == user.id

    def test_multiple_entries_get_unique_ids(self, db_session):
        entry1 = log_scan_history(
            db=db_session,
            url="https://first.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
        )
        entry2 = log_scan_history(
            db=db_session,
            url="https://second.com",
            system_prompt="sp",
            user_prompt="up",
            scraped_data_snapshot="{}",
            audit_findings="{}",
        )
        assert entry1.id != entry2.id


class TestGetScanHistory:
    """Tests for the get_scan_history function."""

    def test_returns_empty_list_when_no_records(self, db_session):
        results = get_scan_history(db_session)
        assert results == []

    def test_returns_all_records_up_to_limit(self, db_session):
        for i in range(5):
            log_scan_history(
                db=db_session,
                url=f"https://site{i}.com",
                system_prompt="sp",
                user_prompt="up",
                scraped_data_snapshot="{}",
                audit_findings="{}",
            )
        results = get_scan_history(db_session, limit=50)
        assert len(results) == 5

    def test_respects_limit_parameter(self, db_session):
        for i in range(10):
            log_scan_history(
                db=db_session,
                url=f"https://site{i}.com",
                system_prompt="sp",
                user_prompt="up",
                scraped_data_snapshot="{}",
                audit_findings="{}",
            )
        results = get_scan_history(db_session, limit=3)
        assert len(results) == 3

    def test_ordered_by_timestamp_desc(self, db_session):
        for i in range(3):
            log_scan_history(
                db=db_session,
                url=f"https://site{i}.com",
                system_prompt="sp",
                user_prompt="up",
                scraped_data_snapshot="{}",
                audit_findings="{}",
            )
        results = get_scan_history(db_session, limit=50)
        # Most recent first
        for i in range(len(results) - 1):
            assert results[i].timestamp >= results[i + 1].timestamp

    def test_filters_by_user_id(self, db_session):
        user1 = User(email="user1@test.com", hashed_password="h1")
        user2 = User(email="user2@test.com", hashed_password="h2")
        db_session.add_all([user1, user2])
        db_session.commit()
        db_session.refresh(user1)
        db_session.refresh(user2)

        # Create entries for different users
        log_scan_history(
            db=db_session, url="https://user1.com",
            system_prompt="sp", user_prompt="up",
            scraped_data_snapshot="{}", audit_findings="{}",
            user_id=user1.id,
        )
        log_scan_history(
            db=db_session, url="https://user2.com",
            system_prompt="sp", user_prompt="up",
            scraped_data_snapshot="{}", audit_findings="{}",
            user_id=user2.id,
        )
        log_scan_history(
            db=db_session, url="https://user1b.com",
            system_prompt="sp", user_prompt="up",
            scraped_data_snapshot="{}", audit_findings="{}",
            user_id=user1.id,
        )

        results = get_scan_history(db_session, user_id=user1.id)
        assert len(results) == 2
        assert all(r.user_id == user1.id for r in results)

    def test_no_user_id_returns_all(self, db_session):
        user = User(email="u@test.com", hashed_password="h")
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        log_scan_history(
            db=db_session, url="https://a.com",
            system_prompt="sp", user_prompt="up",
            scraped_data_snapshot="{}", audit_findings="{}",
            user_id=user.id,
        )
        log_scan_history(
            db=db_session, url="https://b.com",
            system_prompt="sp", user_prompt="up",
            scraped_data_snapshot="{}", audit_findings="{}",
            user_id=None,
        )

        results = get_scan_history(db_session, user_id=None)
        assert len(results) == 2
