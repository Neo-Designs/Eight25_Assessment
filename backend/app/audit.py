from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
import asyncio
import json
import logging

from app.database import get_db, get_scan_history
from app.scraper import PlaywrightScraper
from app.ai_engine import AIEngine
from app.pipeline import AuditPipeline
from app.models.schemas import (
    ScrapedPageData, AIAuditOutput, ChatRequest, ChatResponse,
    DriftRequest, DriftResponse
)
from app.models.db_models import ScanHistory, User
from app.auth import get_current_user_optional

router = APIRouter(prefix="/api", tags=["Audit"])
logger = logging.getLogger("audit_tool.audit")

scraper = PlaywrightScraper()
try:
    ai_engine = AIEngine()
except Exception as e:
    ai_engine = None
    logger.warning(f"AIEngine init failed: {e}")

try:
    audit_pipeline = AuditPipeline(scraper=scraper)
except Exception as e:
    audit_pipeline = None
    logger.warning(f"AuditPipeline init failed: {e}")

_audit_cache: Dict[int, Dict[str, Any]] = {}


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
def get_history(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional),
):
    user_id = user.id if user else None
    logs = get_scan_history(db, limit=limit, user_id=user_id)
    return [
        HistoryItem(
            id=log.id,
            timestamp=log.timestamp.isoformat() if log.timestamp else None,
            url=log.url,
            seo_score=log.seo_score,
        )
        for log in logs
    ]


@router.post("/audit/start", response_model=AuditStartResponse)
async def audit_start(
    request: AuditStartRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional),
):
    url = _require_valid_url(request.url)

    if audit_pipeline is None:
        raise HTTPException(status_code=500, detail="Audit pipeline not available")

    try:
        result = await audit_pipeline.run(
            db,
            url=url,
            weights=request.weights,
            user_id=user.id if user else None,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("Audit pipeline failed")
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")

    _audit_cache[result.log_entry.id] = {
        "scraped_data": result.scraped_data,
        "audit_output": result.audit_output,
    }
    return AuditStartResponse(
        audit_id=result.log_entry.id,
        url=url,
        message="Audit completed.",
    )


@router.get("/audit/{audit_id}/results", response_model=AuditResultsResponse)
async def audit_results(audit_id: int, db: Session = Depends(get_db)):
    log_entry = db.query(ScanHistory).filter(ScanHistory.id == audit_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Audit not found.")

    cached = _audit_cache.get(audit_id)
    if cached:
        return AuditResultsResponse(
            log_id=log_entry.id,
            url=log_entry.url,
            timestamp=log_entry.timestamp.isoformat(),
            seo_score=log_entry.seo_score,
            scraped_data=cached["scraped_data"],
            audit_output=cached["audit_output"],
        )

    audit_dict = json.loads(log_entry.audit_findings)
    scraped_dict = json.loads(log_entry.scraped_data_snapshot)
    return AuditResultsResponse(
        log_id=log_entry.id,
        url=log_entry.url,
        timestamp=log_entry.timestamp.isoformat(),
        seo_score=log_entry.seo_score,
        scraped_data=ScrapedPageData(**scraped_dict),
        audit_output=AIAuditOutput(**audit_dict),
    )


@router.get("/audit/{audit_id}/logs", response_model=AuditLogsResponse)
def audit_logs(audit_id: int, db: Session = Depends(get_db)):
    log_entry = db.query(ScanHistory).filter(ScanHistory.id == audit_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Audit not found.")
    return AuditLogsResponse(
        system_prompt=log_entry.system_prompt,
        user_prompt=log_entry.user_prompt,
    )


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
    ai_info = ai_engine.health_info() if ai_engine else {}
    return {
        "status": "healthy",
        "provider": ai_info.get("provider"),
        "model": ai_info.get("model"),
        "ai": ai_info,
        "pipeline": "ready" if audit_pipeline else "degraded",
    }
