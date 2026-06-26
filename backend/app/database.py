import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.models.db_models import Base, PromptLog

# SQLite file located in the backend root directory
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./audit_tool.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def log_prompt_response(db: Session, url: str, system_prompt: str, user_prompt: str, response_content: str, seo_score: int = None) -> PromptLog:
    db_log = PromptLog(
        url=url,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        response_content=response_content,
        seo_score=seo_score
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_prompt_logs(db: Session, limit: int = 50):
    return db.query(PromptLog).order_by(PromptLog.timestamp.desc()).limit(limit).all()
