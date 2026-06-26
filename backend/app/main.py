import sys
import asyncio
import os
import json
import logging
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

# Force ProactorEventLoop on Windows for compatibility
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Local App Imports
from app.database import init_db, get_db, log_scan_history, get_scan_history
from app.scraper import PlaywrightScraper
from app.analyzer import AnalyzerService
from app.ai_engine import AIEngine
from app.models.schemas import (
    ScrapedPageData, AIAuditOutput, ChatRequest, ChatResponse,
    DriftRequest, DriftResponse
)
from app.models.db_models import ScanHistory, User
from app.auth import router as auth_router, get_current_user_optional

# ─────────────────────────────────────────────
# 1. Initialize FastAPI & Middleware (Crucial Order)
# ─────────────────────────────────────────────
app = FastAPI()

# CORS must be the absolute first middleware added
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://eight25-assessment.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# 2. Logging & Routers
# ─────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit_tool")

app.include_router(auth_router)

# ─────────────────────────────────────────────
# 3. Singletons & Startup
# ─────────────────────────────────────────────
scraper = PlaywrightScraper()
analyzer = AnalyzerService()
ai_engine = AIEngine()

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database...")
    init_db()

# ─────────────────────────────────────────────
# 4. Request / Response Models
# ─────────────────────────────────────────────
class AuditStartRequest(BaseModel):
    url: str
    weights: Optional[Dict[str, float]] = None

class AuditStartResponse(BaseModel):
    audit_id: int
    url: str
    message: str

class AuditResultsResponse(BaseModel):
    log_id: int
    url: str
    timestamp: Optional[str]
    seo_score: Optional[int]
    scraped_data: Optional[ScrapedPageData]
    audit_output: Optional[AIAuditOutput]

class AuditLogsResponse(BaseModel):
    log_id: int
    url: str
    timestamp: Optional[str]
    system_prompt: str
    user_prompt: str

class HistoryItem(BaseModel):
    id: int
    timestamp: Optional[str]
    url: str
    seo_score: Optional[int]

_audit_cache: Dict[int, Dict[str, Any]] = {}

# ─────────────────────────────────────────────
# 5. Core Endpoints
# ─────────────────────────────────────────────
def _require_valid_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme.")
    return url

@app.get("/api/history", response_model=List[HistoryItem], tags=["Audit"])
def get_history(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db), user: User = Depends(get_current_user_optional)):
    user_id = user.id if user else None
    logs = get_scan_history(db, limit=limit, user_id=user_id)
    return [HistoryItem(id=log.id, timestamp=log.timestamp.isoformat() if log.timestamp else None, url=log.url, seo_score=log.seo_score) for log in logs]

@app.post("/api/audit/start", response_model=AuditStartResponse, tags=["Audit"])
async def audit_start(request: AuditStartRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user_optional)):
    url = _require_valid_url(request.url)
    scraped_data = await scraper.scrape(url)
    audit_output, system_prompt, user_prompt = await analyzer.analyze(scraped_data, weights=request.weights)
    
    log_entry = log_scan_history(db, url=url, system_prompt=system_prompt, user_prompt=user_prompt, 
                                 scraped_data_snapshot=scraped_data.model_dump_json(), 
                                 audit_findings=audit_output.model_dump_json(), 
                                 seo_score=audit_output.overall_seo_health_score, user_id=user.id if user else None)
    
    _audit_cache[log_entry.id] = {"scraped_data": scraped_data, "audit_output": audit_output}
    return AuditStartResponse(audit_id=log_entry.id, url=url, message="Audit completed.")

@app.get("/api/audit/{audit_id}/results", response_model=AuditResultsResponse, tags=["Audit"])
async def audit_results(audit_id: int, db: Session = Depends(get_db)):
    log_entry = db.query(ScanHistory).filter(ScanHistory.id == audit_id).first()
    if not log_entry: raise HTTPException(status_code=404, detail="Audit not found.")
    
    cached = _audit_cache.get(audit_id)
    if cached:
        return AuditResultsResponse(log_id=log_entry.id, url=log_entry.url, timestamp=log_entry.timestamp.isoformat(), 
                                    seo_score=log_entry.seo_score, scraped_data=cached["scraped_data"], audit_output=cached["audit_output"])
    
    # Fallback to DB
    audit_dict = json.loads(log_entry.audit_findings)
    scraped_dict = json.loads(log_entry.scraped_data_snapshot)
    return AuditResultsResponse(log_id=log_entry.id, url=log_entry.url, timestamp=log_entry.timestamp.isoformat(), 
                                seo_score=log_entry.seo_score, scraped_data=ScrapedPageData(**scraped_dict), audit_output=AIAuditOutput(**audit_dict))

@app.get("/api/health", tags=["System"])
def health_check():
    return {"status": "healthy", "provider": ai_engine.provider, "model": ai_engine.model_name}