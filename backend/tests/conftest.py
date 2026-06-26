import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure the backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set a fake API key so AIEngine doesn't crash on import
os.environ.setdefault("GEMINI_API_KEY", "fake-key-for-testing")

from app.models.db_models import Base, User, ScanHistory


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database session for testing.

    Uses StaticPool to ensure all connections share the same in-memory
    database, which is required for TestClient (runs in a separate thread).
    """
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
def sample_user(db_session):
    """Create a sample user in the test database."""
    from app.auth import get_password_hash
    user = User(email="test@example.com", hashed_password=get_password_hash("testpassword123"))
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
