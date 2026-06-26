import asyncio
import sys

# Force the ProactorEventLoop on Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import os
import json
import logging
from fastapi import FastAPI, BackgroundTasks, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database import init_db, get_db, log_prompt_response, get_prompt_logs
from app.scraper import PlaywrightScraper
from app.ai_engine import AIEngine
from app.models.schemas import (
    ScrapedPageData, AIAuditOutput, ChatMessage, ChatRequest, ChatResponse,
    DriftRequest, DriftResponse
)
from app.models.db_models import PromptLog

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit_tool")

# ─────────────────────────────────────────────
# App + CORS
# ─────────────────────────────────────────────
app = FastAPI(title="Website Audit Tool API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # Restrict to your domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Singletons
# ─────────────────────────────────────────────
scraper = PlaywrightScraper()
ai_engine = AIEngine()

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database...")
    init_db()

# ─────────────────────────────────────────────
# Request / Response models
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

# ─────────────────────────────────────────────
# In-memory store for pending/completed audits
# Keyed by log_id → full AuditResponse payload
# ─────────────────────────────────────────────
_audit_cache: Dict[int, Dict[str, Any]] = {}

# ─────────────────────────────────────────────
# Utility: validate URL
# ─────────────────────────────────────────────
def _require_valid_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="Invalid URL scheme. URL must start with http:// or https://"
        )
    return url

# ═══════════════════════════════════════════════════════════════════
# TASK 1  —  Core REST endpoints (new aligned surface)
# ═══════════════════════════════════════════════════════════════════

# ── GET /api/history ───────────────────────────────────────────────
@app.get("/api/history", response_model=List[HistoryItem], tags=["Audit"])
def get_history(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Return a paginated list of all past audit logs (newest first)."""
    logs = get_prompt_logs(db, limit=limit)
    return [
        HistoryItem(
            id=log.id,
            timestamp=log.timestamp.isoformat() if log.timestamp else None,
            url=log.url,
            seo_score=log.seo_score,
        )
        for log in logs
    ]

# ── POST /api/audit/start ──────────────────────────────────────────
@app.post("/api/audit/start", response_model=AuditStartResponse, tags=["Audit"])
async def audit_start(request: AuditStartRequest, db: Session = Depends(get_db)):
    """
    Accepts a URL + optional custom weights.
    Scrapes the page, runs the AI engine, persists the result, and
    returns the new audit_id immediately so the client can poll for results.
    """
    url = _require_valid_url(request.url)
    logger.info(f"[audit/start] URL={url}  weights={request.weights}")

    try:
        # Step 1 – scrape
        scraped_data = await scraper.scrape(url)
        logger.info(f"[audit/start] Scraped word_count={scraped_data.word_count}")

        # Step 2 – AI analysis
        audit_output, system_prompt, user_prompt = await ai_engine.run_audit(
            scraped_data, weights=request.weights
        )
        logger.info("[audit/start] AI engine completed.")

        # Step 3 – persist
        log_entry = log_prompt_response(
            db=db,
            url=url,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_content=audit_output.model_dump_json(),
            seo_score=audit_output.overall_seo_health_score,
        )
        logger.info(f"[audit/start] Saved log_id={log_entry.id}")

        # Step 4 – warm the in-memory cache
        _audit_cache[log_entry.id] = {
            "scraped_data": scraped_data,
            "audit_output": audit_output,
        }

        return AuditStartResponse(
            audit_id=log_entry.id,
            url=url,
            message=f"Audit completed successfully. Retrieve results at /api/audit/{log_entry.id}/results",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[audit/start] FAILED for {url}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")


# ── GET /api/audit/{id}/results ────────────────────────────────────
@app.get("/api/audit/{audit_id}/results", response_model=AuditResultsResponse, tags=["Audit"])
async def audit_results(audit_id: int, db: Session = Depends(get_db)):
    """
    Returns the full structured metrics and AI insights for a specific audit ID.
    Attempts in-memory cache first, falls back to DB for historical IDs.
    """
    log_entry: Optional[PromptLog] = db.query(PromptLog).filter(PromptLog.id == audit_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail=f"Audit #{audit_id} not found.")

    cached = _audit_cache.get(audit_id)

    scraped_data_out: Optional[ScrapedPageData] = None
    audit_output_out: Optional[AIAuditOutput] = None

    if cached:
        scraped_data_out = cached["scraped_data"]
        audit_output_out = cached["audit_output"]
    else:
        # Reconstruct audit_output from persisted JSON
        try:
            audit_dict = json.loads(log_entry.response_content)
            audit_output_out = AIAuditOutput(**audit_dict)
        except Exception as e:
            logger.warning(f"[audit/results] Could not parse stored response for #{audit_id}: {e}")

    return AuditResultsResponse(
        log_id=log_entry.id,
        url=log_entry.url,
        timestamp=log_entry.timestamp.isoformat() if log_entry.timestamp else None,
        seo_score=log_entry.seo_score,
        scraped_data=scraped_data_out,
        audit_output=audit_output_out,
    )


# ── GET /api/audit/{id}/logs ───────────────────────────────────────
@app.get("/api/audit/{audit_id}/logs", response_model=AuditLogsResponse, tags=["Audit"])
def audit_logs(audit_id: int, db: Session = Depends(get_db)):
    """
    Returns the raw Prompt Logs / Reasoning Traces for full transparency.
    This feeds the 'Audit Insight' / prompt-log drawer in the frontend.
    """
    log_entry: Optional[PromptLog] = db.query(PromptLog).filter(PromptLog.id == audit_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail=f"Audit log #{audit_id} not found.")

    return AuditLogsResponse(
        log_id=log_entry.id,
        url=log_entry.url,
        timestamp=log_entry.timestamp.isoformat() if log_entry.timestamp else None,
        system_prompt=log_entry.system_prompt,
        user_prompt=log_entry.user_prompt,
    )


# ═══════════════════════════════════════════════════════════════════
# LEGACY  —  Kept for backward compat with existing frontend calls
# ═══════════════════════════════════════════════════════════════════

class AuditRequest(BaseModel):
    url: str
    weights: Optional[Dict[str, float]] = None

class AuditResponse(BaseModel):
    scraped_data: ScrapedPageData
    audit_output: AIAuditOutput
    log_id: int

@app.post("/api/audit", response_model=AuditResponse, tags=["Legacy"])
async def perform_audit(request: AuditRequest, db: Session = Depends(get_db)):
    """Legacy combined audit endpoint — use /api/audit/start instead."""
    url = _require_valid_url(request.url)
    logger.info(f"[legacy /api/audit] URL={url}")
    try:
        scraped_data = await scraper.scrape(url)
        audit_output, system_prompt, user_prompt = await ai_engine.run_audit(
            scraped_data, weights=request.weights
        )
        log_entry = log_prompt_response(
            db=db, url=url,
            system_prompt=system_prompt, user_prompt=user_prompt,
            response_content=audit_output.model_dump_json(),
            seo_score=audit_output.overall_seo_health_score,
        )
        _audit_cache[log_entry.id] = {
            "scraped_data": scraped_data,
            "audit_output": audit_output,
        }
        return AuditResponse(scraped_data=scraped_data, audit_output=audit_output, log_id=log_entry.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[legacy /api/audit] FAILED: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")


@app.post("/api/drift", response_model=DriftResponse, tags=["Analysis"])
async def perform_drift_analysis(request: DriftRequest):
    """Competitive SEO drift: scrape two URLs in parallel and return side-by-side metrics."""
    url = _require_valid_url(request.url)
    comp_url = _require_valid_url(request.competitor_url)
    try:
        logger.info(f"[drift] {url} vs {comp_url}")
        primary_data, competitor_data = await asyncio.gather(
            scraper.scrape(url), scraper.scrape(comp_url)
        )
        return DriftResponse(primary_data=primary_data, competitor_data=competitor_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[drift] FAILED: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Drift analysis failed: {str(e)}")


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_reasoning(request: ChatRequest, db: Session = Depends(get_db)):
    """Stateless multi-turn chat grounded in the stored audit output."""
    log_entry = db.query(PromptLog).filter(PromptLog.id == request.log_id).first()
    if not log_entry:
        raise HTTPException(status_code=404, detail="Audit log entry not found")
    try:
        try:
            audit_output_dict = json.loads(log_entry.response_content)
        except Exception:
            audit_output_dict = {"raw_content": log_entry.response_content}

        chat_reply = await ai_engine.run_chat(
            scraped_data={"url": log_entry.url},
            audit_output=audit_output_dict,
            message=request.message,
            history=request.history,
        )
        return ChatResponse(response=chat_reply)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[chat] FAILED: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat reasoning failed: {str(e)}")


@app.get("/api/logs", tags=["Legacy"])
def fetch_logs(limit: int = Query(50, ge=1, le=100), db: Session = Depends(get_db)):
    """Legacy raw logs list — use /api/history for the clean history feed."""
    logs = get_prompt_logs(db, limit=limit)
    return [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "url": log.url,
            "system_prompt": log.system_prompt,
            "user_prompt": log.user_prompt,
            "response_content": (
                json.loads(log.response_content)
                if log.response_content else {}
            ),
            "seo_score": log.seo_score,
        }
        for log in logs
    ]


@app.get("/api/health", tags=["System"])
def health_check():
    """Service health + model info."""
    return {
        "status": "healthy",
        "provider": ai_engine.provider,
        "model": ai_engine.model_name,
    }
