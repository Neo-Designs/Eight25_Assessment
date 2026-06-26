import json
import os
from typing import Optional, Tuple

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.models.db_models import Base, ScanHistory
from app.models.schemas import AIAuditOutput, ScrapedPageData

# SQLite file located in the backend root directory
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./audit_tool.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    # To handle the schema change cleanly in development, drop tables and recreate.
    # In production, use Alembic for migrations.
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def log_scan_history(db: Session, url: str, system_prompt: str, user_prompt: str, scraped_data_snapshot: str, audit_findings: str, seo_score: int = None, user_id: int = None) -> ScanHistory:
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


def get_scan_history_or_404(db: Session, audit_id: int) -> ScanHistory:
    entry = db.query(ScanHistory).filter(ScanHistory.id == audit_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Audit #{audit_id} not found.")
    return entry


def format_timestamp(entry: ScanHistory) -> Optional[str]:
    return entry.timestamp.isoformat() if entry.timestamp else None


def parse_audit_json(entry: ScanHistory) -> Tuple[Optional[ScrapedPageData], Optional[AIAuditOutput]]:
    try:
        audit_output = AIAuditOutput(**json.loads(entry.audit_findings))
        scraped_data = ScrapedPageData(**json.loads(entry.scraped_data_snapshot))
        return scraped_data, audit_output
    except Exception:
        return None, None
