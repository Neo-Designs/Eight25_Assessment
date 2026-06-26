import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models.db_models import Base, ScanHistory

# 1. Configuration: Look for DATABASE_URL, default to local SQLite
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./webcrawler.db")

# 2. Engine Setup: SQLite needs check_same_thread=False
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)

# 3. Session Factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initializes/Resets the database schema. 
    Note: Base.metadata.drop_all(bind=engine) deletes ALL data.
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

# --- Scan History Helpers ---

def log_scan_history(db: Session, url: str, system_prompt: str, user_prompt: str, 
                     scraped_data_snapshot: str, audit_findings: str, 
                     seo_score: int = None, user_id: int = None) -> ScanHistory:
    db_log = ScanHistory(
        url=url,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        scraped_data_snapshot=scraped_data_snapshot,
        audit_findings=audit_findings,
        seo_score=seo_score,
        user_id=user_id
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_scan_history(db: Session, limit: int = 50, user_id: int = None):
    query = db.query(ScanHistory)
    if user_id:
        query = query.filter(ScanHistory.user_id == user_id)
    return query.order_by(ScanHistory.timestamp.desc()).limit(limit).all()