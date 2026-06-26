import sys
import asyncio
import os
import json
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

# Force ProactorEventLoop on Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Local App Imports
from app.database import init_db
from app.auth import router as auth_router
from app.audit import router as audit_router

# ─────────────────────────────────────────────
# 1. Initialize FastAPI
# ─────────────────────────────────────────────
app = FastAPI()

# 2. CORS & Preflight Handling (Must be first)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://eight25-assessment.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    return {"message": "Preflight OK"}

# Expose simple URL validator for tests and other modules
def _require_valid_url(url: str) -> str:
    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme.")
    return url

# 3. Routers & Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audit_tool")

# Include routers
app.include_router(auth_router)
app.include_router(audit_router)

for route in app.routes:
    if hasattr(route, "path"):
        print(f"ROUTE: {route.path} | METHODS: {route.methods}")

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database...")
    init_db()