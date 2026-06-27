from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models.db_models import Base, ScanHistory


def _build_engine():
    url = settings.database_url
    connect_args: dict = {}

    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return create_engine(url, connect_args=connect_args)

    if url.startswith("postgresql"):
        connect_args["sslmode"] = "require"
        # Supabase transaction pooler (port 6543) does not support prepared statements.
        connect_args["prepare_threshold"] = 0
        return create_engine(
            url,
            connect_args=connect_args,
            poolclass=NullPool,
            pool_pre_ping=True,
        )

    return create_engine(url, connect_args=connect_args)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)


def log_scan_history(
    db: Session,
    url: str,
    system_prompt: str,
    user_prompt: str,
    scraped_data_snapshot: str,
    audit_findings: str,
    seo_score: int = None,
    user_id: int = None,
) -> ScanHistory:
    db_log = ScanHistory(
        url=url,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        scraped_data_snapshot=scraped_data_snapshot,
        audit_findings=audit_findings,
        seo_score=seo_score,
        user_id=user_id,
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
