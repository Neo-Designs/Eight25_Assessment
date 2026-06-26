import asyncio
import sys

# Force the ProactorEventLoop on Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
import os
import json
import logging
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.database import init_db, get_db, log_prompt_response, get_prompt_logs
from app.scraper import PlaywrightScraper
from app.ai_engine import AIEngine
from app.models.schemas import ScrapedPageData, AIAuditOutput

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit_tool")

app = FastAPI(title="Website Audit Tool API")

# Setup CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize scraper and AI engine instances
scraper = PlaywrightScraper()
ai_engine = AIEngine()

# Create tables on startup
@app.on_event("startup")
def on_startup():
    logger.info("Initializing database...")
    init_db()

class AuditRequest(BaseModel):
    url: str

class AuditResponse(BaseModel):
    scraped_data: ScrapedPageData
    audit_output: AIAuditOutput
    log_id: int

@app.post("/api/audit", response_model=AuditResponse)
async def perform_audit(request: AuditRequest, db: Session = Depends(get_db)):
    url = request.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme. URL must start with http:// or https://")
    
    logger.info(f"Starting audit for: {url}")
    try:
        # Step 1: Scrape webpage
        scraped_data = await scraper.scrape(url)
        logger.info(f"Successfully scraped page. Word count: {scraped_data.word_count}")
        
        # Step 2: Run AI Audit
        audit_output, system_prompt, user_prompt = await ai_engine.run_audit(scraped_data)
        logger.info("Successfully executed AI engine pass-1 and pass-2 analysis.")
        
        # Step 3: Log prompt and response
        response_json_str = audit_output.model_dump_json()
        log_entry = log_prompt_response(
            db=db,
            url=url,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_content=response_json_str,
            seo_score=audit_output.overall_seo_health_score
        )
        logger.info(f"Log entry saved to SQLite with ID: {log_entry.id}")
        
        return AuditResponse(
            scraped_data=scraped_data,
            audit_output=audit_output,
            log_id=log_entry.id
        )
    except Exception as e:
        logger.error(f"Audit failed for {url}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")

@app.get("/api/logs")
def fetch_logs(limit: int = Query(50, ge=1, le=100), db: Session = Depends(get_db)):
    logs = get_prompt_logs(db, limit=limit)
    formatted_logs = []
    for log in logs:
        # Try to parse response content back into JSON if possible
        try:
            resp_data = json.loads(log.response_content)
        except Exception:
            resp_data = log.response_content
            
        formatted_logs.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "url": log.url,
            "system_prompt": log.system_prompt,
            "user_prompt": log.user_prompt,
            "response_content": resp_data,
            "seo_score": log.seo_score
        })
    return formatted_logs

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "provider": ai_engine.provider,
        "model": ai_engine.model_name
    }
