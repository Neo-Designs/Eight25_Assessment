from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
import asyncio
import json
import logging

from app.database import get_db, log_scan_history, get_scan_history
from app.scraper import PlaywrightScraper
from app.analyzer import AnalyzerService
from app.ai_engine import AIEngine
from app.models.schemas import (
    ScrapedPageData, AIAuditOutput, ChatRequest, ChatResponse,
    DriftRequest, DriftResponse
)
from app.models.db_models import ScanHistory, User
from app.auth import get_current_user_optional

router = APIRouter(prefix="/api", tags=["Audit"]) 
logger = logging.getLogger("audit_tool.audit")

# Singletons (lazy-protected)
scraper = PlaywrightScraper()
try:
    analyzer = AnalyzerService()
except Exception as e:
    analyzer = None
    logger.warning(f"AnalyzerService init failed: {e}")

try:
    ai_engine = AIEngine()
except Exception as e:
    ai_engine = None
    logger.warning(f"AIEngine init failed: {e}")

_audit_cache: Dict[int, Dict[str, Any]] = {}

# Request/Response models reused from main; re-declare small helper if needed
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

class HistoryItem(BaseModel):
    id: int
    timestamp: Optional[str]
    url: str
    seo_score: Optional[int]

class AuditLogsResponse(BaseModel):
    system_prompt: str
    user_prompt: str


def _require_valid_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme.")
    return url


@router.get("/history", response_model=List[HistoryItem])
def get_history(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db), user: User = Depends(get_current_user_optional)):
    user_id = user.id if user else None
    logs = get_scan_history(db, limit=limit, user_id=user_id)
    return [HistoryItem(id=log.id, timestamp=log.timestamp.isoformat() if log.timestamp else None, url=log.url, seo_score=log.seo_score) for log in logs]


@router.post("/audit/start", response_model=AuditStartResponse)
async def audit_start(request: AuditStartRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user_optional)):
    url = _require_valid_url(request.url)
    scraped_data = await scraper.scrape(url)

    if analyzer is None:
        raise HTTPException(status_code=500, detail="AnalyzerService not available")

    audit_output, system_prompt, user_prompt = await analyzer.analyze(scraped_data, weights=request.weights)

    log_entry = log_scan_history(db, url=url, system_prompt=system_prompt, user_prompt=user_prompt,
                                 scraped_data_snapshot=scraped_data.model_dump_json(),
                                 audit_findings=audit_output.model_dump_json(),
                                 seo_score=audit_output.overall_seo_health_score, user_id=user.id if user else None)

    _audit_cache[log_entry.id] = {"scraped_data": scraped_data, "audit_output": audit_output}
    return AuditStartResponse(audit_id=log_entry.id, url=url, message="Audit completed.")


@router.get("/audit/{audit_id}/results", response_model=AuditResultsResponse)
async def audit_results(audit_id: int, db: Session = Depends(get_db)):
    log_entry = db.query(ScanHistory).filter(ScanHistory.id == audit_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Audit not found.")

    cached = _audit_cache.get(audit_id)
    if cached:
        return AuditResultsResponse(log_id=log_entry.id, url=log_entry.url, timestamp=log_entry.timestamp.isoformat(),
                                    seo_score=log_entry.seo_score, scraped_data=cached["scraped_data"], audit_output=cached["audit_output"])

    audit_dict = json.loads(log_entry.audit_findings)
    scraped_dict = json.loads(log_entry.scraped_data_snapshot)
    return AuditResultsResponse(log_id=log_entry.id, url=log_entry.url, timestamp=log_entry.timestamp.isoformat(),
                                seo_score=log_entry.seo_score, scraped_data=ScrapedPageData(**scraped_dict), audit_output=AIAuditOutput(**audit_dict))


@router.get("/audit/{audit_id}/logs", response_model=AuditLogsResponse)
def audit_logs(audit_id: int, db: Session = Depends(get_db)):
    log_entry = db.query(ScanHistory).filter(ScanHistory.id == audit_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Audit not found.")
    return AuditLogsResponse(system_prompt=log_entry.system_prompt, user_prompt=log_entry.user_prompt)


@router.post("/drift", response_model=DriftResponse)
async def drift_compare(request: DriftRequest):
    primary_url = _require_valid_url(request.url)
    competitor_url = _require_valid_url(request.competitor_url)

    try:
        primary_task = asyncio.create_task(scraper.scrape(primary_url))
        competitor_task = asyncio.create_task(scraper.scrape(competitor_url))
        primary_result, competitor_result = await asyncio.gather(primary_task, competitor_task)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scraping pages: {str(e)}")

    return DriftResponse(primary_data=primary_result, competitor_data=competitor_result)


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    log_entry = db.query(ScanHistory).filter(ScanHistory.id == request.log_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Audit log not found.")

    try:
        scraped = json.loads(log_entry.scraped_data_snapshot)
    except Exception:
        scraped = {}
    try:
        audit_out = json.loads(log_entry.audit_findings)
    except Exception:
        audit_out = {}

    if ai_engine is None:
        raise HTTPException(status_code=500, detail="AIEngine not available")

    reply = await ai_engine.run_chat(scraped, audit_out, request.message, request.history)
    return ChatResponse(response=reply)


@router.get("/health")
def health_check():
    provider = ai_engine.provider if ai_engine else None
    model = ai_engine.model_name if ai_engine else None
    return {"status": "healthy", "provider": provider, "model": model}
