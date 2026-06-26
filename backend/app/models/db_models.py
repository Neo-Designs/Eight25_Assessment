from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class PromptLog(Base):
    __tablename__ = "prompt_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    url = Column(String(500), nullable=False)
    system_prompt = Column(Text, nullable=False)
    user_prompt = Column(Text, nullable=False)
    response_content = Column(Text, nullable=False)
    seo_score = Column(Integer, nullable=True)
